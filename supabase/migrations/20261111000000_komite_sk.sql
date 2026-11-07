-- =========================================================================
-- Sanggahan, Komite RPL, SK Ketua, dan penetapan NIM (Juknis II.D.3-4)
--
--   hasil_disampaikan -> (pemohon setuju)  menunggu_komite
--                     -> (pemohon sanggah) klarifikasi
--   klarifikasi       -> sanggahan ditolak Ketua Tim: hasil_disampaikan
--                     -> sanggahan diterima: asesor menilai ulang, lalu
--                        ajukan_ke_pleno -> pleno -> hasil_disampaikan
--   menunggu_komite   -> disetujui: menunggu_sk  | dikembalikan: dikembalikan_komite
--   dikembalikan_komite -> Tim: menunggu_komite (kirim ulang) atau klarifikasi (nilai ulang)
--   menunggu_sk       -> SK terbit: sk_terbit
--   sk_terbit         -> BAAK menetapkan NIM: selesai
--
-- Semua perpindahan lewat RPC. Aman dijalankan ulang.
-- =========================================================================
BEGIN;

-- -------------------------------------------------------------------------
-- 0. Tanggal lahir wajar (minimal 15 tahun, setelah 1940)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cek_tanggal_lahir()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tanggal_lahir IS NOT NULL AND (NEW.tanggal_lahir > (current_date - interval '15 years')::date
     OR NEW.tanggal_lahir < DATE '1940-01-01') THEN
    RAISE EXCEPTION 'Tanggal lahir tidak valid. Periksa kembali tahun lahir Anda';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_tanggal_lahir ON biodata_pemohon;
CREATE TRIGGER trg_cek_tanggal_lahir BEFORE INSERT OR UPDATE OF tanggal_lahir ON biodata_pemohon
  FOR EACH ROW EXECUTE FUNCTION public.cek_tanggal_lahir();

-- -------------------------------------------------------------------------
-- 1. Tanggapan sanggahan oleh Ketua Tim
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tanggapi_sanggahan(p_klarifikasi uuid, p_keputusan text, p_tanggapan text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_k klarifikasi_rpl%ROWTYPE; v_status text;
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN
    RAISE EXCEPTION 'Sanggahan ditanggapi oleh Ketua Tim Pengelola RPL';
  END IF;
  IF p_keputusan NOT IN ('diterima', 'diterima_sebagian', 'ditolak') THEN
    RAISE EXCEPTION 'Keputusan sanggahan tidak dikenal';
  END IF;
  IF coalesce(btrim(p_tanggapan), '') = '' THEN RAISE EXCEPTION 'Tuliskan tanggapan untuk pemohon'; END IF;
  SELECT * INTO v_k FROM klarifikasi_rpl WHERE id = p_klarifikasi FOR UPDATE;
  IF v_k.id IS NULL THEN RAISE EXCEPTION 'Sanggahan tidak ditemukan'; END IF;
  IF v_k.status = 'selesai' THEN RAISE EXCEPTION 'Sanggahan sudah ditanggapi'; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = v_k.pengajuan_id FOR UPDATE;
  IF v_status <> 'klarifikasi' THEN RAISE EXCEPTION 'Pengajuan tidak sedang dalam masa sanggahan'; END IF;

  UPDATE klarifikasi_rpl SET keputusan = p_keputusan, tanggapan = btrim(p_tanggapan), ditanggapi_oleh = auth.uid(),
    status = CASE WHEN p_keputusan = 'ditolak' THEN 'selesai' ELSE 'diproses' END,
    selesai_at = CASE WHEN p_keputusan = 'ditolak' THEN NOW() END
  WHERE id = p_klarifikasi;

  PERFORM set_config('sirpl.rpc', '1', true);
  IF p_keputusan = 'ditolak' THEN
    -- Hasil tetap; pemohon diminta menanggapi kembali.
    UPDATE pengajuan_rpl SET status = 'hasil_disampaikan', hasil_disampaikan_at = NOW() WHERE id = v_k.pengajuan_id;
  END IF;
  PERFORM set_config('sirpl.rpc', '', true);
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
  VALUES (v_k.pengajuan_id, auth.uid(), 'tanggapi_sanggahan',
          CASE p_keputusan WHEN 'ditolak' THEN 'Sanggahan ditolak' ELSE 'Sanggahan diterima, asesor menilai ulang' END);
  RETURN p_keputusan;
END $$;

-- Sanggahan yang diterima selesai saat pleno ulang ditetapkan.
CREATE OR REPLACE FUNCTION public.selesaikan_sanggahan_saat_hasil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'hasil_disampaikan' AND OLD.status = 'pleno' THEN
    UPDATE klarifikasi_rpl SET status = 'selesai', selesai_at = NOW()
    WHERE pengajuan_id = NEW.id AND status <> 'selesai';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_selesaikan_sanggahan ON pengajuan_rpl;
CREATE TRIGGER trg_selesaikan_sanggahan AFTER UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.selesaikan_sanggahan_saat_hasil();

-- -------------------------------------------------------------------------
-- 2. Komite RPL
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.putuskan_komite(p_pengajuan uuid, p_keputusan text, p_catatan text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_diakui int; v_beban int; v_tujuan text;
BEGIN
  IF NOT public.punya_peran('admin', 'komite') THEN
    RAISE EXCEPTION 'Keputusan ini diambil oleh Komite RPL';
  END IF;
  IF p_keputusan NOT IN ('disetujui', 'dikembalikan') THEN RAISE EXCEPTION 'Keputusan tidak dikenal'; END IF;
  IF p_keputusan = 'dikembalikan' AND coalesce(btrim(p_catatan), '') = '' THEN
    RAISE EXCEPTION 'Tuliskan alasan pengembalian';
  END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_status <> 'menunggu_komite' THEN RAISE EXCEPTION 'Pengajuan tidak sedang menunggu Komite (status: %)', v_status; END IF;

  INSERT INTO persetujuan_komite (pengajuan_id, komite_id, keputusan, catatan)
  VALUES (p_pengajuan, auth.uid(), p_keputusan, nullif(btrim(p_catatan), ''));
  v_tujuan := CASE p_keputusan WHEN 'disetujui' THEN 'menunggu_sk' ELSE 'dikembalikan_komite' END;

  IF p_keputusan = 'disetujui' THEN
    SELECT coalesce(sum(mk.sks), 0) INTO v_diakui FROM penilaian_mk pm
    JOIN mata_kuliah_kurikulum mk ON mk.id = pm.mk_id
    WHERE pm.pengajuan_id = p_pengajuan AND pm.keputusan = 'diakui';
    SELECT ps.beban_sks_minimal INTO v_beban FROM pengajuan_rpl p JOIN program_studi ps ON ps.id = p.prodi_pilihan_id WHERE p.id = p_pengajuan;
    INSERT INTO penetapan_akhir (pengajuan_id, total_sks_diakui, total_sks_sisa)
    VALUES (p_pengajuan, v_diakui, greatest(coalesce(v_beban, 144) - v_diakui, 0))
    ON CONFLICT (pengajuan_id) DO UPDATE SET total_sks_diakui = EXCLUDED.total_sks_diakui, total_sks_sisa = EXCLUDED.total_sks_sisa;
  END IF;

  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = v_tujuan,
    catatan_revisi = CASE WHEN p_keputusan = 'dikembalikan' THEN btrim(p_catatan) END
  WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
  RETURN v_tujuan;
END $$;

-- Tim menindaklanjuti pengembalian Komite
CREATE OR REPLACE FUNCTION public.tindak_lanjut_komite(p_pengajuan uuid, p_tujuan text, p_catatan text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN
    RAISE EXCEPTION 'Tindak lanjut dilakukan oleh Ketua Tim Pengelola RPL';
  END IF;
  IF p_tujuan NOT IN ('menunggu_komite', 'klarifikasi') THEN RAISE EXCEPTION 'Tujuan tidak dikenal'; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_status <> 'dikembalikan_komite' THEN RAISE EXCEPTION 'Pengajuan tidak sedang dikembalikan Komite'; END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = p_tujuan, catatan_revisi = NULL WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
  VALUES (p_pengajuan, auth.uid(), 'tindak_lanjut_komite',
          CASE p_tujuan WHEN 'klarifikasi' THEN 'Asesor diminta menilai ulang' ELSE 'Dikirim ulang ke Komite' END
          || coalesce(': ' || nullif(btrim(p_catatan), ''), ''));
  RETURN p_tujuan;
END $$;

-- -------------------------------------------------------------------------
-- 3. SK Ketua STIKOM (satu SK untuk banyak pemohon)
-- -------------------------------------------------------------------------
ALTER TABLE sk_rekognisi ADD COLUMN IF NOT EXISTS prodi_id UUID REFERENCES program_studi(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.terbitkan_sk(p_nomor text, p_tanggal date, p_perihal text, p_file text,
  p_pengajuan uuid[], p_prodi uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sk uuid; v_n int; v_salah int;
BEGIN
  IF NOT public.punya_peran('admin', 'eksekutif', 'sekretaris') THEN
    RAISE EXCEPTION 'SK dicatat oleh Pimpinan atau Sekretariat RPL';
  END IF;
  IF coalesce(btrim(p_nomor), '') = '' OR p_tanggal IS NULL THEN RAISE EXCEPTION 'Isi nomor dan tanggal SK'; END IF;
  IF coalesce(array_length(p_pengajuan, 1), 0) = 0 THEN RAISE EXCEPTION 'Pilih pemohon yang ditetapkan dalam SK'; END IF;
  SELECT count(*) FILTER (WHERE status <> 'menunggu_sk'), count(*) INTO v_salah, v_n FROM pengajuan_rpl WHERE id = ANY (p_pengajuan);
  IF v_n <> array_length(p_pengajuan, 1) OR v_salah > 0 THEN
    RAISE EXCEPTION 'Hanya pengajuan yang sudah disetujui Komite yang dapat dimasukkan ke SK';
  END IF;
  INSERT INTO sk_rekognisi (nomor_sk, tanggal_sk, perihal, file_sk_url, ditetapkan_oleh, prodi_id,
    periode_id)
  VALUES (btrim(p_nomor), p_tanggal, nullif(btrim(p_perihal), ''), nullif(p_file, ''), auth.uid(), p_prodi,
    (SELECT id FROM periode_rpl WHERE is_aktif LIMIT 1))
  RETURNING id INTO v_sk;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = 'sk_terbit', sk_id = v_sk WHERE id = ANY (p_pengajuan);
  PERFORM set_config('sirpl.rpc', '', true);
  RETURN v_sk;
END $$;

-- -------------------------------------------------------------------------
-- 4. BAAK menetapkan NIM
-- -------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_pengajuan_nim_unik ON pengajuan_rpl (nim) WHERE nim IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tetapkan_nim(p_pengajuan uuid, p_nim text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.punya_peran('admin', 'baak') THEN RAISE EXCEPTION 'NIM ditetapkan oleh BAAK'; END IF;
  IF coalesce(btrim(p_nim), '') !~ '^[0-9A-Za-z.\-]{5,20}$' THEN RAISE EXCEPTION 'Format NIM tidak valid'; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_status NOT IN ('sk_terbit', 'selesai') THEN RAISE EXCEPTION 'NIM ditetapkan setelah SK terbit'; END IF;
  IF EXISTS (SELECT 1 FROM pengajuan_rpl WHERE nim = btrim(p_nim) AND id <> p_pengajuan) THEN
    RAISE EXCEPTION 'NIM % sudah dipakai', btrim(p_nim);
  END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET nim = btrim(p_nim), status = 'selesai' WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['tanggapi_sanggahan(uuid, text, text)', 'putuskan_komite(uuid, text, text)',
    'tindak_lanjut_komite(uuid, text, text)', 'terbitkan_sk(text, date, text, text, uuid[], uuid)', 'tetapkan_nim(uuid, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- BAAK perlu membaca pengajuan yang sudah ber-SK (is_staf_rpl sudah mencakup baak).
COMMIT;
