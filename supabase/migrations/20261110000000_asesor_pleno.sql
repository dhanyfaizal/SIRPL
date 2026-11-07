-- =========================================================================
-- Modul Asesor dan Pleno (Juknis 112/B/KPT/2025 Bab II.D.2, Pedoman 3.2-3.5)
--
--   * Skala nilai STIKOM: A, AB, B, BC, C, CD, D, E. Diakui minimal C.
--   * Penilaian MK hanya oleh asesor yang ditugaskan untuk pengajuan itu
--     (Ka. Prodi dan staf lain hanya membaca), dan hanya selama asesmen.
--   * Asesor koordinator mengajukan ke pleno lewat RPC ajukan_ke_pleno.
--   * Sekretaris mencatat pleno (peserta, pengajuan); Ketua Tim menetapkan
--     lewat RPC tetapkan_pleno. Pleno yang sudah ditetapkan terkunci.
--   * Perubahan status oleh staf dibatasi per peran (alur versi 2).
--
-- Aman dijalankan ulang.
-- =========================================================================
BEGIN;

-- -------------------------------------------------------------------------
-- 1. Skala nilai
-- -------------------------------------------------------------------------
ALTER TABLE penilaian_mk DROP CONSTRAINT IF EXISTS penilaian_mk_nilai_check;
ALTER TABLE penilaian_mk ADD CONSTRAINT penilaian_mk_nilai_check
  CHECK (nilai_huruf IS NULL OR nilai_huruf IN ('A', 'AB', 'B', 'BC', 'C', 'CD', 'D', 'E')) NOT VALID;
ALTER TABLE penilaian_mk DROP CONSTRAINT IF EXISTS penilaian_mk_nilai_diakui_check;
ALTER TABLE penilaian_mk ADD CONSTRAINT penilaian_mk_nilai_diakui_check
  CHECK (keputusan <> 'diakui' OR nilai_huruf IN ('A', 'AB', 'B', 'BC', 'C')) NOT VALID;
COMMENT ON COLUMN penilaian_mk.nilai_huruf IS
  'Skala Peraturan Akademik STIKOM: A, AB, B, BC, C, CD, D, E. MK diakui bila minimal C.';

-- -------------------------------------------------------------------------
-- 2. Asesor yang ditugaskan
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.saya_asesor(p_pengajuan uuid, p_peran text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM penugasan_asesor
                 WHERE pengajuan_id = p_pengajuan AND asesor_id = auth.uid()
                   AND (p_peran IS NULL OR peran = p_peran))
$$;
REVOKE ALL ON FUNCTION public.saya_asesor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saya_asesor(uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- 3. RLS penilaian: tulis hanya asesor yang ditugaskan (dan admin)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "penilai kelola penilaian" ON penilaian_mk;
DROP POLICY IF EXISTS "asesor kelola penilaian" ON penilaian_mk;
CREATE POLICY "asesor kelola penilaian" ON penilaian_mk FOR ALL TO authenticated
  USING (public.punya_peran('admin') OR public.saya_asesor(pengajuan_id))
  WITH CHECK (public.punya_peran('admin') OR public.saya_asesor(pengajuan_id));

DROP POLICY IF EXISTS "penilai kelola penilaian lanjutan" ON penilaian_lanjutan;
DROP POLICY IF EXISTS "asesor kelola penilaian lanjutan" ON penilaian_lanjutan;
CREATE POLICY "asesor kelola penilaian lanjutan" ON penilaian_lanjutan FOR ALL TO authenticated
  USING (public.punya_peran('admin') OR public.saya_asesor(pengajuan_id))
  WITH CHECK (public.punya_peran('admin') OR public.saya_asesor(pengajuan_id));

-- Verifikasi PDDikti: Tim Pengelola dan asesor yang ditugaskan
DROP POLICY IF EXISTS "penilai kelola verifikasi pddikti" ON verifikasi_pddikti;
CREATE POLICY "penilai kelola verifikasi pddikti" ON verifikasi_pddikti FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris') OR public.saya_asesor(pengajuan_id))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris') OR public.saya_asesor(pengajuan_id));

-- Jadwal: Tim Pengelola membuat; asesor yang ditugaskan mencatat kehadiran/hasil
DROP POLICY IF EXISTS "penilai kelola jadwal" ON jadwal_asesmen;
DROP POLICY IF EXISTS "tim kelola jadwal" ON jadwal_asesmen;
DROP POLICY IF EXISTS "asesor catat jadwal" ON jadwal_asesmen;
CREATE POLICY "tim kelola jadwal" ON jadwal_asesmen FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));
CREATE POLICY "asesor catat jadwal" ON jadwal_asesmen FOR UPDATE TO authenticated
  USING (public.saya_asesor(pengajuan_id)) WITH CHECK (public.saya_asesor(pengajuan_id));

CREATE OR REPLACE FUNCTION public.jaga_jadwal_asesor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.punya_peran('admin', 'ketua_tim', 'sekretaris') THEN
    RETURN NEW;
  END IF;
  -- Asesor hanya mencatat status pelaksanaan dan hasil.
  IF NEW.pengajuan_id IS DISTINCT FROM OLD.pengajuan_id OR NEW.jenis IS DISTINCT FROM OLD.jenis
     OR NEW.mode IS DISTINCT FROM OLD.mode OR NEW.waktu IS DISTINCT FROM OLD.waktu
     OR NEW.tautan_undangan IS DISTINCT FROM OLD.tautan_undangan OR NEW.ruangan IS DISTINCT FROM OLD.ruangan
     OR NEW.tempat_atau_tautan IS DISTINCT FROM OLD.tempat_atau_tautan
     OR NEW.mk_ids IS DISTINCT FROM OLD.mk_ids OR NEW.asesor_id IS DISTINCT FROM OLD.asesor_id
     OR NEW.asesor_lain IS DISTINCT FROM OLD.asesor_lain OR NEW.tahap IS DISTINCT FROM OLD.tahap
     OR NEW.durasi_menit IS DISTINCT FROM OLD.durasi_menit THEN
    RAISE EXCEPTION 'Jadwal diubah oleh Sekretariat RPL. Asesor hanya mencatat pelaksanaan dan hasilnya';
  END IF;
  IF NEW.status NOT IN ('dijadwalkan', 'selesai', 'tidak_hadir') THEN
    RAISE EXCEPTION 'Asesor hanya dapat menandai jadwal selesai atau pemohon tidak hadir';
  END IF;
  IF NEW.status = 'selesai' AND NEW.waktu > NOW() THEN
    RAISE EXCEPTION 'Jadwal belum berlangsung';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_jadwal_asesor ON jadwal_asesmen;
CREATE TRIGGER trg_jaga_jadwal_asesor BEFORE UPDATE ON jadwal_asesmen
  FOR EACH ROW EXECUTE FUNCTION public.jaga_jadwal_asesor();

-- -------------------------------------------------------------------------
-- 4. Penjaga penilaian per MK (berjalan sebelum trigger lain: nama "trg_a_")
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_penilaian_mk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_baris record; v_status text; v_alur int; v_mekanisme text;
BEGIN
  v_baris := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF auth.uid() IS NULL THEN RETURN v_baris; END IF;
  SELECT status, alur_versi INTO v_status, v_alur FROM pengajuan_rpl WHERE id = v_baris.pengajuan_id;
  IF v_alur = 1 THEN RETURN v_baris; END IF;

  IF NOT public.punya_peran('admin')
     AND v_status NOT IN ('asesmen', 'menunggu_bukti_tambahan', 'penilaian_lanjutan', 'klarifikasi') THEN
    RAISE EXCEPTION 'Penilaian hanya dapat diubah selama asesmen berlangsung (status saat ini: %)', v_status;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  SELECT mekanisme INTO v_mekanisme FROM mk_diajukan
  WHERE pengajuan_id = NEW.pengajuan_id AND mk_id = NEW.mk_id;
  IF v_mekanisme IS NULL THEN
    RAISE EXCEPTION 'Mata kuliah ini tidak diajukan pemohon';
  END IF;
  NEW.mekanisme := v_mekanisme;
  IF NEW.keputusan = 'perlu_asesmen_lanjutan' AND v_mekanisme <> 'perolehan' THEN
    RAISE EXCEPTION 'Asesmen lanjutan hanya untuk mata kuliah perolehan kredit';
  END IF;
  IF NEW.keputusan <> 'diakui' THEN NEW.nilai_huruf := NULL; END IF;
  NEW.tahap := CASE WHEN v_status IN ('penilaian_lanjutan', 'klarifikasi') THEN 'akhir' ELSE 'awal' END;
  IF TG_OP = 'INSERT' OR NEW.keputusan IS DISTINCT FROM OLD.keputusan
     OR NEW.nilai_huruf IS DISTINCT FROM OLD.nilai_huruf OR NEW.vatm IS DISTINCT FROM OLD.vatm
     OR NEW.asal IS DISTINCT FROM OLD.asal OR NEW.catatan IS DISTINCT FROM OLD.catatan THEN
    NEW.dinilai_oleh := auth.uid();
    NEW.dinilai_at := NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_a_jaga_penilaian_mk ON penilaian_mk;
CREATE TRIGGER trg_a_jaga_penilaian_mk BEFORE INSERT OR UPDATE OR DELETE ON penilaian_mk
  FOR EACH ROW EXECUTE FUNCTION public.jaga_penilaian_mk();

-- Lembar penilaian lanjutan (F10)
CREATE OR REPLACE FUNCTION public.jaga_penilaian_lanjutan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_baris record; v_status text; v_jadwal jadwal_asesmen%ROWTYPE;
BEGIN
  v_baris := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF auth.uid() IS NULL THEN RETURN v_baris; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = v_baris.pengajuan_id;
  IF NOT public.punya_peran('admin')
     AND v_status NOT IN ('asesmen', 'menunggu_bukti_tambahan', 'penilaian_lanjutan', 'klarifikasi') THEN
    RAISE EXCEPTION 'Lembar penilaian lanjutan hanya dapat diubah selama asesmen berlangsung';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT * INTO v_jadwal FROM jadwal_asesmen WHERE id = NEW.jadwal_id;
  IF v_jadwal.id IS NULL OR v_jadwal.pengajuan_id <> NEW.pengajuan_id THEN
    RAISE EXCEPTION 'Jadwal asesmen tidak sesuai dengan pengajuan';
  END IF;
  IF NOT (NEW.mk_id = ANY (v_jadwal.mk_ids)) THEN
    RAISE EXCEPTION 'Mata kuliah ini tidak termasuk dalam jadwal asesmen tersebut';
  END IF;
  IF v_jadwal.status = 'dijadwalkan' AND v_jadwal.waktu > NOW() THEN
    RAISE EXCEPTION 'Lembar penilaian diisi setelah asesmen berlangsung';
  END IF;
  NEW.asesor_id := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_a_jaga_penilaian_lanjutan ON penilaian_lanjutan;
CREATE TRIGGER trg_a_jaga_penilaian_lanjutan BEFORE INSERT OR UPDATE OR DELETE ON penilaian_lanjutan
  FOR EACH ROW EXECUTE FUNCTION public.jaga_penilaian_lanjutan();

-- -------------------------------------------------------------------------
-- 5. Perubahan status oleh staf dibatasi per peran (alur versi 2).
--    RPC resmi menandai transaksinya dengan sirpl.rpc = '1'.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_status_staf()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_pasca text[] := ARRAY['hasil_disampaikan', 'klarifikasi', 'menunggu_komite',
  'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai'];
BEGIN
  IF auth.uid() IS NULL OR NEW.alur_versi = 1 OR coalesce(current_setting('sirpl.rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role IN ('calon_rpl', 'admin') THEN RETURN NEW; END IF;

  IF v_role IN ('asessor', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka') THEN
    RAISE EXCEPTION 'Asesor dan Ka. Prodi tidak mengubah pengajuan secara langsung. Gunakan tombol "Ajukan ke pleno" pada halaman penilaian';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF v_role IN ('ketua_tim', 'sekretaris') AND (
       (OLD.status = 'diajukan' AND NEW.status IN ('terverifikasi', 'dikembalikan_sekretariat', 'tidak_memenuhi_syarat'))
    OR (OLD.status = 'terverifikasi' AND NEW.status IN ('dikembalikan_sekretariat', 'tidak_memenuhi_syarat'))
    OR (OLD.status = 'terverifikasi' AND NEW.status = 'asesmen' AND v_role = 'ketua_tim')
    OR (OLD.status = ANY (v_pasca) AND NEW.status = ANY (v_pasca))) THEN
    RETURN NEW;
  END IF;
  IF v_role IN ('komite', 'eksekutif') AND OLD.status = ANY (v_pasca) AND NEW.status = ANY (v_pasca) THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('pleno_awal', 'pleno') THEN
    RAISE EXCEPTION 'Pengajuan sedang menunggu pleno. Status berubah saat Ketua Tim menetapkan hasil pleno';
  END IF;
  RAISE EXCEPTION 'Peran Anda tidak dapat mengubah status dari % ke %', OLD.status, NEW.status;
END $$;
DROP TRIGGER IF EXISTS trg_a_jaga_status_staf ON pengajuan_rpl;
CREATE TRIGGER trg_a_jaga_status_staf BEFORE UPDATE ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.jaga_status_staf();

-- -------------------------------------------------------------------------
-- 6. Asesor koordinator mengajukan ke pleno
--    asesmen -> pleno_awal (ada perolehan) atau pleno (transfer saja)
--    penilaian_lanjutan / klarifikasi -> pleno (akhir)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajukan_ke_pleno(p_pengajuan uuid, p_catatan text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p pengajuan_rpl%ROWTYPE; v_belum int; v_lanjut int; v_tujuan text; v_perolehan boolean;
BEGIN
  SELECT * INTO v_p FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF NOT (public.punya_peran('admin') OR public.saya_asesor(p_pengajuan, 'koordinator')) THEN
    RAISE EXCEPTION 'Hanya asesor koordinator yang dapat mengajukan ke pleno';
  END IF;
  IF v_p.status NOT IN ('asesmen', 'penilaian_lanjutan', 'klarifikasi') THEN
    RAISE EXCEPTION 'Pengajuan berstatus % tidak dapat diajukan ke pleno', v_p.status;
  END IF;

  SELECT count(*) FILTER (WHERE pm.id IS NULL OR pm.keputusan = 'belum_dinilai'),
         count(*) FILTER (WHERE pm.keputusan = 'perlu_asesmen_lanjutan'),
         bool_or(md.mekanisme = 'perolehan')
  INTO v_belum, v_lanjut, v_perolehan
  FROM mk_diajukan md
  LEFT JOIN penilaian_mk pm ON pm.pengajuan_id = md.pengajuan_id AND pm.mk_id = md.mk_id
  WHERE md.pengajuan_id = p_pengajuan;

  IF v_belum > 0 THEN
    RAISE EXCEPTION 'Masih ada % mata kuliah yang belum dinilai', v_belum;
  END IF;
  v_tujuan := CASE WHEN v_p.status = 'asesmen' AND coalesce(v_perolehan, false) THEN 'pleno_awal' ELSE 'pleno' END;
  IF v_tujuan = 'pleno' AND v_lanjut > 0 THEN
    RAISE EXCEPTION 'Masih ada % mata kuliah berstatus "perlu asesmen lanjutan". Tetapkan diakui atau tidak diakui', v_lanjut;
  END IF;

  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = v_tujuan WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
  VALUES (p_pengajuan, auth.uid(), 'ajukan_pleno',
          CASE v_tujuan WHEN 'pleno_awal' THEN 'Diajukan ke pleno awal' ELSE 'Diajukan ke pleno hasil rekognisi' END
          || coalesce(': ' || nullif(btrim(p_catatan), ''), ''));
  RETURN v_tujuan;
END $$;
REVOKE ALL ON FUNCTION public.ajukan_ke_pleno(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajukan_ke_pleno(uuid, text) TO authenticated;

-- Asesor meminta bukti tambahan (Juknis II.D.2.c.7); pemohon mengirim kembali
CREATE OR REPLACE FUNCTION public.minta_bukti_tambahan(p_pengajuan uuid, p_pesan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT (public.punya_peran('admin') OR public.saya_asesor(p_pengajuan)) THEN
    RAISE EXCEPTION 'Hanya asesor yang ditugaskan yang dapat meminta bukti tambahan';
  END IF;
  IF coalesce(btrim(p_pesan), '') = '' THEN RAISE EXCEPTION 'Tuliskan bukti yang diminta'; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_status NOT IN ('asesmen', 'penilaian_lanjutan') THEN
    RAISE EXCEPTION 'Bukti tambahan diminta selama asesmen atau penilaian lanjutan';
  END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = 'menunggu_bukti_tambahan', catatan_revisi = btrim(p_pesan) WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
END $$;
REVOKE ALL ON FUNCTION public.minta_bukti_tambahan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minta_bukti_tambahan(uuid, text) TO authenticated;

-- Pemohon mengirim bukti tambahan; pengajuan kembali ke tahap sebelum diminta.
CREATE OR REPLACE FUNCTION public.kirim_bukti_tambahan(p_pengajuan uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p pengajuan_rpl%ROWTYPE; v_diminta timestamptz; v_asal text;
BEGIN
  SELECT * INTO v_p FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_p.id IS NULL OR v_p.user_id <> auth.uid() THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF v_p.status <> 'menunggu_bukti_tambahan' THEN RAISE EXCEPTION 'Tidak ada permintaan bukti tambahan'; END IF;
  SELECT created_at, dari_status INTO v_diminta, v_asal FROM log_aktivitas_rpl
  WHERE pengajuan_id = p_pengajuan AND aksi = 'ubah_status' AND ke_status = 'menunggu_bukti_tambahan'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM bukti_portofolio WHERE pengajuan_id = p_pengajuan AND is_bukti_tambahan
                 AND created_at >= coalesce(v_diminta, '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'Unggah minimal satu bukti tambahan terlebih dahulu';
  END IF;
  v_asal := CASE WHEN v_asal IN ('asesmen', 'penilaian_lanjutan') THEN v_asal ELSE 'asesmen' END;
  UPDATE pengajuan_rpl SET status = v_asal, catatan_revisi = NULL WHERE id = p_pengajuan;
  RETURN v_asal;
END $$;
REVOKE ALL ON FUNCTION public.kirim_bukti_tambahan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kirim_bukti_tambahan(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- 7. Pleno: dicatat Sekretaris, ditetapkan Ketua Tim, lalu terkunci
-- -------------------------------------------------------------------------
ALTER TABLE pleno_rpl
  ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ditetapkan')),
  ADD COLUMN IF NOT EXISTS ditetapkan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ditetapkan_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.jaga_pleno()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_baris record; v_pleno pleno_rpl%ROWTYPE; v_status text; v_prodi uuid;
BEGIN
  v_baris := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF auth.uid() IS NULL OR coalesce(current_setting('sirpl.rpc', true), '') = '1' THEN RETURN v_baris; END IF;

  IF TG_TABLE_NAME = 'pleno_rpl' THEN
    IF TG_OP <> 'INSERT' AND OLD.status = 'ditetapkan' AND NOT public.punya_peran('admin') THEN
      RAISE EXCEPTION 'Pleno sudah ditetapkan dan tidak dapat diubah';
    END IF;
    IF TG_OP <> 'DELETE' THEN
      IF NEW.status IS DISTINCT FROM coalesce(OLD.status, 'draft') AND NOT public.punya_peran('admin') THEN
        RAISE EXCEPTION 'Pleno ditetapkan melalui tombol "Tetapkan hasil pleno"';
      END IF;
    END IF;
    RETURN v_baris;
  END IF;

  SELECT * INTO v_pleno FROM pleno_rpl WHERE id = v_baris.pleno_id;
  IF v_pleno.status = 'ditetapkan' AND NOT public.punya_peran('admin') THEN
    RAISE EXCEPTION 'Pleno sudah ditetapkan dan tidak dapat diubah';
  END IF;
  IF TG_TABLE_NAME = 'pleno_pengajuan' AND TG_OP = 'INSERT' THEN
    SELECT status, prodi_pilihan_id INTO v_status, v_prodi FROM pengajuan_rpl WHERE id = NEW.pengajuan_id;
    IF (v_pleno.jenis = 'awal' AND v_status <> 'pleno_awal') OR (v_pleno.jenis = 'akhir' AND v_status <> 'pleno') THEN
      RAISE EXCEPTION 'Pengajuan berstatus % tidak dapat dimasukkan ke pleno %', v_status, v_pleno.jenis;
    END IF;
    IF v_pleno.prodi_id IS NOT NULL AND v_prodi IS DISTINCT FROM v_pleno.prodi_id THEN
      RAISE EXCEPTION 'Pengajuan berasal dari program studi lain';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM mk_diajukan WHERE pengajuan_id = NEW.pengajuan_id AND mekanisme = NEW.mekanisme) THEN
      RAISE EXCEPTION 'Pengajuan tidak memiliki mata kuliah % kredit', NEW.mekanisme;
    END IF;
    IF v_pleno.jenis = 'awal' AND NEW.mekanisme <> 'perolehan' THEN
      RAISE EXCEPTION 'Pleno awal hanya membahas perolehan kredit';
    END IF;
  END IF;
  RETURN v_baris;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_pleno ON pleno_rpl;
CREATE TRIGGER trg_jaga_pleno BEFORE INSERT OR UPDATE OR DELETE ON pleno_rpl
  FOR EACH ROW EXECUTE FUNCTION public.jaga_pleno();
DROP TRIGGER IF EXISTS trg_jaga_peserta_pleno ON peserta_pleno;
CREATE TRIGGER trg_jaga_peserta_pleno BEFORE INSERT OR UPDATE OR DELETE ON peserta_pleno
  FOR EACH ROW EXECUTE FUNCTION public.jaga_pleno();
DROP TRIGGER IF EXISTS trg_jaga_pleno_pengajuan ON pleno_pengajuan;
CREATE TRIGGER trg_jaga_pleno_pengajuan BEFORE INSERT OR UPDATE OR DELETE ON pleno_pengajuan
  FOR EACH ROW EXECUTE FUNCTION public.jaga_pleno();

CREATE OR REPLACE FUNCTION public.tetapkan_pleno(p_pleno uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pleno pleno_rpl%ROWTYPE; v_n int; v_id uuid; v_sisa int;
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN
    RAISE EXCEPTION 'Hasil pleno ditetapkan oleh Ketua Tim Pengelola RPL';
  END IF;
  SELECT * INTO v_pleno FROM pleno_rpl WHERE id = p_pleno FOR UPDATE;
  IF v_pleno.id IS NULL THEN RAISE EXCEPTION 'Pleno tidak ditemukan'; END IF;
  IF v_pleno.status = 'ditetapkan' THEN RAISE EXCEPTION 'Pleno sudah ditetapkan'; END IF;
  IF v_pleno.tanggal IS NULL THEN RAISE EXCEPTION 'Isi tanggal pleno'; END IF;
  IF NOT EXISTS (SELECT 1 FROM peserta_pleno WHERE pleno_id = p_pleno) THEN
    RAISE EXCEPTION 'Tambahkan peserta pleno';
  END IF;
  SELECT count(DISTINCT pengajuan_id) INTO v_n FROM pleno_pengajuan WHERE pleno_id = p_pleno;
  IF v_n = 0 THEN RAISE EXCEPTION 'Belum ada pengajuan yang dibahas di pleno ini'; END IF;

  PERFORM set_config('sirpl.rpc', '1', true);
  FOR v_id IN SELECT DISTINCT pengajuan_id FROM pleno_pengajuan WHERE pleno_id = p_pleno LOOP
    IF v_pleno.jenis = 'awal' THEN
      UPDATE pengajuan_rpl SET status = 'penilaian_lanjutan' WHERE id = v_id AND status = 'pleno_awal';
    ELSE
      SELECT count(*) INTO v_sisa FROM penilaian_mk
      WHERE pengajuan_id = v_id AND keputusan NOT IN ('diakui', 'tidak_diakui');
      IF v_sisa > 0 THEN
        RAISE EXCEPTION 'Pengajuan % masih memiliki % mata kuliah tanpa keputusan akhir',
          (SELECT nomor_pendaftaran FROM pengajuan_rpl WHERE id = v_id), v_sisa;
      END IF;
      UPDATE pengajuan_rpl SET status = 'hasil_disampaikan', pleno_id = p_pleno, hasil_disampaikan_at = NOW()
      WHERE id = v_id AND status = 'pleno';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Status pengajuan % sudah berubah. Muat ulang halaman pleno',
        (SELECT nomor_pendaftaran FROM pengajuan_rpl WHERE id = v_id);
    END IF;
  END LOOP;
  UPDATE pleno_rpl SET status = 'ditetapkan', ditetapkan_oleh = auth.uid(), ditetapkan_at = NOW() WHERE id = p_pleno;
  PERFORM set_config('sirpl.rpc', '', true);
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.tetapkan_pleno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tetapkan_pleno(uuid) TO authenticated;

COMMIT;
