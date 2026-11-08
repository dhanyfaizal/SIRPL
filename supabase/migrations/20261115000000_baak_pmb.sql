-- =========================================================================
-- Pembagian tugas unit layanan:
--   * Akun pemohon langsung aktif; hanya akun staf yang perlu diverifikasi.
--   * BAAK   : verifikasi kelengkapan berkas (dipindah dari Sekretaris),
--              penetapan NIM, status pelaporan.
--   * PMB    : verifikasi pembayaran, tagihan, diskon, dan skema bayar
--              (cicilan).
-- Aman dijalankan ulang.
-- =========================================================================
BEGIN;

-- -------------------------------------------------------------------------
-- 1. Akun pemohon langsung aktif
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_kolom_profil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.punya_peran('admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'calon_rpl';
    NEW.is_verified := true;
  ELSE
    NEW.role := OLD.role;
    NEW.is_verified := OLD.is_verified;
    NEW.prodi_id := OLD.prodi_id;
  END IF;
  RETURN NEW;
END $$;

-- Akun yang belum pernah diberi peran staf dianggap pemohon dan diaktifkan.
UPDATE profiles SET is_verified = true WHERE role = 'calon_rpl' AND is_verified IS DISTINCT FROM true;

-- -------------------------------------------------------------------------
-- 2. BAAK memverifikasi kelengkapan berkas
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "tim kelola verifikasi berkas" ON verifikasi_berkas;
CREATE POLICY "tim kelola verifikasi berkas" ON verifikasi_berkas FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'baak'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'baak'));

DROP POLICY IF EXISTS "penilai kelola verifikasi pddikti" ON verifikasi_pddikti;
CREATE POLICY "penilai kelola verifikasi pddikti" ON verifikasi_pddikti FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'baak') OR public.saya_asesor(pengajuan_id))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'baak') OR public.saya_asesor(pengajuan_id));

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

  -- Verifikasi kelengkapan berkas: BAAK (Ketua Tim sebagai cadangan).
  IF v_role IN ('baak', 'ketua_tim') AND (
       (OLD.status = 'diajukan' AND NEW.status IN ('terverifikasi', 'dikembalikan_sekretariat', 'tidak_memenuhi_syarat'))
    OR (OLD.status = 'terverifikasi' AND NEW.status IN ('dikembalikan_sekretariat', 'tidak_memenuhi_syarat'))) THEN
    RETURN NEW;
  END IF;
  IF v_role = 'ketua_tim' AND OLD.status = 'terverifikasi' AND NEW.status = 'asesmen' THEN
    RETURN NEW;
  END IF;
  IF v_role IN ('ketua_tim', 'sekretaris') AND OLD.status = ANY (v_pasca) AND NEW.status = ANY (v_pasca) THEN
    RETURN NEW;
  END IF;
  IF v_role IN ('komite', 'eksekutif') AND OLD.status = ANY (v_pasca) AND NEW.status = ANY (v_pasca) THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('pleno_awal', 'pleno') THEN
    RAISE EXCEPTION 'Pengajuan sedang menunggu pleno. Status berubah saat Ketua Tim menetapkan hasil pleno';
  END IF;
  IF OLD.status IN ('diajukan', 'terverifikasi') AND v_role = 'sekretaris' THEN
    RAISE EXCEPTION 'Verifikasi kelengkapan berkas dilakukan oleh BAAK';
  END IF;
  RAISE EXCEPTION 'Peran Anda tidak dapat mengubah status dari % ke %', OLD.status, NEW.status;
END $$;

-- -------------------------------------------------------------------------
-- 3. Master diskon dan skema bayar (dikelola PMB)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skema_diskon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama varchar(120) NOT NULL,
  jenis varchar(10) NOT NULL CHECK (jenis IN ('persen', 'nominal')),
  nilai numeric NOT NULL CHECK (nilai > 0),
  komponen varchar(40),                       -- null = semua komponen
  periode_id uuid REFERENCES periode_rpl(id) ON DELETE SET NULL, -- null = semua periode
  keterangan text,
  is_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jenis <> 'persen' OR nilai <= 100)
);

-- rincian: [{ "persen": 50, "hari": 0 }, { "persen": 50, "hari": 30 }]
CREATE TABLE IF NOT EXISTS skema_bayar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama varchar(120) NOT NULL,
  rincian jsonb NOT NULL CHECK (jsonb_typeof(rincian) = 'array' AND jsonb_array_length(rincian) BETWEEN 1 AND 12),
  keterangan text,
  is_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE skema_diskon ENABLE ROW LEVEL SECURITY;
ALTER TABLE skema_bayar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "baca skema diskon" ON skema_diskon;
CREATE POLICY "baca skema diskon" ON skema_diskon FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pmb kelola skema diskon" ON skema_diskon;
CREATE POLICY "pmb kelola skema diskon" ON skema_diskon FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'pmb')) WITH CHECK (public.punya_peran('admin', 'pmb'));
DROP POLICY IF EXISTS "baca skema bayar" ON skema_bayar;
CREATE POLICY "baca skema bayar" ON skema_bayar FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pmb kelola skema bayar" ON skema_bayar;
CREATE POLICY "pmb kelola skema bayar" ON skema_bayar FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'pmb')) WITH CHECK (public.punya_peran('admin', 'pmb'));
GRANT SELECT, INSERT, UPDATE, DELETE ON skema_diskon, skema_bayar TO authenticated;

-- -------------------------------------------------------------------------
-- 4. Tagihan per pemohon
--    angsuran: [{ "ke": 1, "jumlah": 150000, "jatuh_tempo": "2026-12-01" }, ...]
--    null = dibayar sekali (lunas).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tagihan_rpl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id uuid NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  komponen varchar(40) NOT NULL CHECK (komponen IN ('pendaftaran', 'asesmen', 'matrikulasi', 'moocs', 'lain_lain')),
  keterangan text,
  nominal numeric NOT NULL DEFAULT 0 CHECK (nominal >= 0),
  diskon_id uuid REFERENCES skema_diskon(id) ON DELETE SET NULL,
  potongan numeric NOT NULL DEFAULT 0 CHECK (potongan >= 0),
  alasan_potongan text,
  angsuran jsonb CHECK (angsuran IS NULL OR jsonb_typeof(angsuran) = 'array'),
  otomatis boolean NOT NULL DEFAULT false,      -- dihitung dari tarif
  diubah_oleh uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (potongan <= nominal)
);
CREATE UNIQUE INDEX IF NOT EXISTS tagihan_otomatis_unik ON tagihan_rpl (pengajuan_id, komponen) WHERE otomatis;
CREATE INDEX IF NOT EXISTS tagihan_pengajuan ON tagihan_rpl (pengajuan_id);

ALTER TABLE tagihan_rpl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pemohon baca tagihan" ON tagihan_rpl;
CREATE POLICY "pemohon baca tagihan" ON tagihan_rpl FOR SELECT TO authenticated USING (public.pengajuan_milik_saya(pengajuan_id));
DROP POLICY IF EXISTS "staf baca tagihan" ON tagihan_rpl;
CREATE POLICY "staf baca tagihan" ON tagihan_rpl FOR SELECT TO authenticated USING (public.is_staf_rpl());
GRANT SELECT ON tagihan_rpl TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON tagihan_rpl FROM authenticated, anon;

ALTER TABLE pembayaran_rpl ADD COLUMN IF NOT EXISTS tagihan_id uuid REFERENCES tagihan_rpl(id) ON DELETE SET NULL;
ALTER TABLE pembayaran_rpl ADD COLUMN IF NOT EXISTS angsuran_ke int NOT NULL DEFAULT 1;

-- Tarif yang berlaku: tarif khusus prodi mengalahkan tarif umum.
CREATE OR REPLACE FUNCTION public.tarif_berlaku(p_periode uuid, p_prodi uuid, p_komponen text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT besaran FROM tarif_biaya
  WHERE periode_id = p_periode AND komponen = p_komponen AND NOT coalesce(is_internal, false)
    AND (prodi_id = p_prodi OR prodi_id IS NULL)
  ORDER BY (prodi_id IS NULL) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.hitung_potongan(p_nominal numeric, p_diskon uuid, p_manual numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_diskon IS NULL THEN least(coalesce(p_manual, 0), p_nominal)
    ELSE (SELECT least(CASE WHEN jenis = 'persen' THEN round(p_nominal * nilai / 100) ELSE nilai END, p_nominal) FROM skema_diskon WHERE id = p_diskon)
  END
$$;

-- Ada pembayaran yang sedang diperiksa atau sudah lunas pada tagihan ini.
CREATE OR REPLACE FUNCTION public.tagihan_sudah_dibayar(p_tagihan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM pembayaran_rpl WHERE tagihan_id = p_tagihan AND status IN ('menunggu', 'lunas'))
$$;

-- Menyusun atau menyegarkan tagihan pendaftaran dan asesmen dari tarif.
-- Nominal disegarkan selama belum ada pembayaran pada tagihan itu.
CREATE OR REPLACE FUNCTION public.siapkan_tagihan(p_pengajuan uuid)
RETURNS SETOF tagihan_rpl LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v pengajuan_rpl%ROWTYPE; v_sks int; k text; v_nom numeric; t tagihan_rpl%ROWTYPE;
BEGIN
  SELECT * INTO v FROM pengajuan_rpl WHERE id = p_pengajuan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF auth.uid() IS NOT NULL AND v.user_id <> auth.uid() AND NOT public.is_staf_rpl() THEN
    RAISE EXCEPTION 'Tidak berhak';
  END IF;
  IF v.alur_versi IS DISTINCT FROM 1 AND v.status NOT IN ('dibatalkan') THEN
    SELECT coalesce(sum(m.sks), 0) INTO v_sks FROM mk_diajukan d JOIN mata_kuliah_kurikulum m ON m.id = d.mk_id WHERE d.pengajuan_id = p_pengajuan;
    FOREACH k IN ARRAY ARRAY['pendaftaran', 'asesmen'] LOOP
      v_nom := CASE k WHEN 'pendaftaran' THEN coalesce(public.tarif_berlaku(v.periode_id, v.prodi_pilihan_id, 'pendaftaran'), 0)
                      ELSE v_sks * coalesce(public.tarif_berlaku(v.periode_id, v.prodi_pilihan_id, 'asesmen_per_sks'), 0) END;
      SELECT * INTO t FROM tagihan_rpl WHERE pengajuan_id = p_pengajuan AND komponen = k AND otomatis;
      IF NOT FOUND THEN
        IF v_nom > 0 THEN
          INSERT INTO tagihan_rpl (pengajuan_id, komponen, nominal, otomatis, keterangan)
          VALUES (p_pengajuan, k, v_nom, true, CASE k WHEN 'asesmen' THEN v_sks || ' SKS diajukan' END) RETURNING * INTO t;
          UPDATE pembayaran_rpl SET tagihan_id = t.id WHERE pengajuan_id = p_pengajuan AND komponen = k AND tagihan_id IS NULL;
        END IF;
      ELSIF t.nominal <> v_nom AND NOT public.tagihan_sudah_dibayar(t.id) THEN
        UPDATE tagihan_rpl SET nominal = v_nom,
          potongan = public.hitung_potongan(v_nom, diskon_id, potongan),
          angsuran = NULL,  -- cicilan disusun ulang oleh PMB
          keterangan = CASE k WHEN 'asesmen' THEN v_sks || ' SKS diajukan' ELSE keterangan END,
          updated_at = now()
        WHERE id = t.id;
      END IF;
    END LOOP;
  END IF;
  RETURN QUERY SELECT * FROM tagihan_rpl WHERE pengajuan_id = p_pengajuan ORDER BY created_at;
END $$;

-- Tagihan disusun otomatis saat pengajuan dikirim.
CREATE OR REPLACE FUNCTION public.tagihan_saat_diajukan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'diajukan' AND OLD.status IS DISTINCT FROM 'diajukan' AND NEW.alur_versi IS DISTINCT FROM 1 THEN
    PERFORM public.siapkan_tagihan(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tagihan_saat_diajukan ON pengajuan_rpl;
CREATE TRIGGER trg_tagihan_saat_diajukan AFTER UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.tagihan_saat_diajukan();

-- PMB: diskon dan skema bayar satu tagihan.
CREATE OR REPLACE FUNCTION public.atur_tagihan(p_id uuid, p_diskon uuid, p_potongan numeric, p_alasan text, p_angsuran jsonb)
RETURNS tagihan_rpl LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tagihan_rpl%ROWTYPE; v_pot numeric; v_total numeric; v_jml numeric := 0; e jsonb; v_lalu date; v_i int := 0;
  d skema_diskon%ROWTYPE;
BEGIN
  IF NOT public.punya_peran('admin', 'pmb') THEN RAISE EXCEPTION 'Diskon dan skema bayar diatur oleh PMB'; END IF;
  SELECT * INTO t FROM tagihan_rpl WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF;
  IF public.tagihan_sudah_dibayar(p_id) THEN
    RAISE EXCEPTION 'Tagihan ini sudah dibayar atau sedang diperiksa. Tolak dulu bukti bayarnya bila perlu diubah';
  END IF;
  IF p_diskon IS NOT NULL THEN
    SELECT * INTO d FROM skema_diskon WHERE id = p_diskon;
    IF NOT FOUND OR NOT d.is_aktif THEN RAISE EXCEPTION 'Skema diskon tidak aktif'; END IF;
    IF d.komponen IS NOT NULL AND d.komponen <> t.komponen THEN RAISE EXCEPTION 'Diskon % hanya untuk komponen %', d.nama, d.komponen; END IF;
  END IF;
  v_pot := public.hitung_potongan(t.nominal, p_diskon, coalesce(p_potongan, 0));
  IF coalesce(p_potongan, 0) > t.nominal AND p_diskon IS NULL THEN RAISE EXCEPTION 'Potongan melebihi nominal tagihan'; END IF;
  IF v_pot > 0 AND coalesce(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Tuliskan alasan pemberian diskon'; END IF;
  v_total := t.nominal - v_pot;

  IF p_angsuran IS NOT NULL AND jsonb_typeof(p_angsuran) = 'array' AND jsonb_array_length(p_angsuran) > 0 THEN
    IF jsonb_array_length(p_angsuran) > 12 THEN RAISE EXCEPTION 'Paling banyak 12 angsuran'; END IF;
    FOR e IN SELECT * FROM jsonb_array_elements(p_angsuran) LOOP
      v_i := v_i + 1;
      IF (e->>'ke')::int IS DISTINCT FROM v_i THEN RAISE EXCEPTION 'Urutan angsuran tidak valid'; END IF;
      IF coalesce((e->>'jumlah')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Jumlah angsuran ke-% harus lebih dari nol', v_i; END IF;
      IF (e->>'jatuh_tempo') IS NULL THEN RAISE EXCEPTION 'Isi jatuh tempo angsuran ke-%', v_i; END IF;
      IF v_lalu IS NOT NULL AND (e->>'jatuh_tempo')::date < v_lalu THEN RAISE EXCEPTION 'Jatuh tempo angsuran harus berurutan'; END IF;
      v_lalu := (e->>'jatuh_tempo')::date;
      v_jml := v_jml + (e->>'jumlah')::numeric;
    END LOOP;
    IF v_jml <> v_total THEN RAISE EXCEPTION 'Jumlah angsuran (%) tidak sama dengan total tagihan (%)', v_jml, v_total; END IF;
    IF v_i = 1 THEN p_angsuran := NULL; END IF;
  ELSE
    p_angsuran := NULL;
  END IF;

  UPDATE tagihan_rpl SET diskon_id = p_diskon, potongan = v_pot, alasan_potongan = CASE WHEN v_pot > 0 THEN btrim(p_alasan) END,
    angsuran = p_angsuran, diubah_oleh = auth.uid(), updated_at = now()
  WHERE id = p_id RETURNING * INTO t;
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
  VALUES (t.pengajuan_id, auth.uid(), 'atur_tagihan',
    t.komponen || ': total ' || (t.nominal - t.potongan) || CASE WHEN t.potongan > 0 THEN ', diskon ' || t.potongan ELSE '' END
      || CASE WHEN t.angsuran IS NOT NULL THEN ', ' || jsonb_array_length(t.angsuran) || ' kali angsuran' ELSE '' END);
  RETURN t;
END $$;

-- PMB: tagihan tambahan (matrikulasi, MOOCs, lain-lain).
CREATE OR REPLACE FUNCTION public.tambah_tagihan(p_pengajuan uuid, p_komponen text, p_nominal numeric, p_keterangan text)
RETURNS tagihan_rpl LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tagihan_rpl%ROWTYPE;
BEGIN
  IF NOT public.punya_peran('admin', 'pmb') THEN RAISE EXCEPTION 'Tagihan ditambahkan oleh PMB'; END IF;
  IF p_komponen NOT IN ('matrikulasi', 'moocs', 'lain_lain') THEN RAISE EXCEPTION 'Komponen tambahan: matrikulasi, MOOCs, atau lain-lain'; END IF;
  IF coalesce(p_nominal, 0) <= 0 THEN RAISE EXCEPTION 'Isi nominal tagihan'; END IF;
  IF coalesce(btrim(p_keterangan), '') = '' THEN RAISE EXCEPTION 'Tuliskan keterangan tagihan'; END IF;
  INSERT INTO tagihan_rpl (pengajuan_id, komponen, nominal, keterangan, diubah_oleh)
  VALUES (p_pengajuan, p_komponen, p_nominal, btrim(p_keterangan), auth.uid()) RETURNING * INTO t;
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan) VALUES (p_pengajuan, auth.uid(), 'tambah_tagihan', p_komponen || ' ' || p_nominal || ': ' || btrim(p_keterangan));
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.hapus_tagihan(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tagihan_rpl%ROWTYPE;
BEGIN
  IF NOT public.punya_peran('admin', 'pmb') THEN RAISE EXCEPTION 'Tagihan dihapus oleh PMB'; END IF;
  SELECT * INTO t FROM tagihan_rpl WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF;
  IF t.otomatis THEN RAISE EXCEPTION 'Tagihan pendaftaran dan asesmen dihitung dari tarif dan tidak dapat dihapus'; END IF;
  IF EXISTS (SELECT 1 FROM pembayaran_rpl WHERE tagihan_id = p_id AND status <> 'ditolak') THEN RAISE EXCEPTION 'Tagihan yang sudah dibayar tidak dapat dihapus'; END IF;
  DELETE FROM tagihan_rpl WHERE id = p_id;
  INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan) VALUES (t.pengajuan_id, auth.uid(), 'hapus_tagihan', t.komponen || ' ' || t.nominal);
END $$;

-- -------------------------------------------------------------------------
-- 5. Pembayaran mengikuti tagihan; diverifikasi PMB
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cek_pembayaran_baru() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tagihan_rpl%ROWTYPE; v_harus numeric;
BEGIN
  IF NEW.tagihan_id IS NULL THEN
    IF auth.uid() IS NULL OR EXISTS (SELECT 1 FROM pengajuan_rpl WHERE id = NEW.pengajuan_id AND alur_versi = 1) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Pilih tagihan yang dibayar';
  END IF;
  SELECT * INTO t FROM tagihan_rpl WHERE id = NEW.tagihan_id;
  IF NOT FOUND OR t.pengajuan_id <> NEW.pengajuan_id THEN RAISE EXCEPTION 'Tagihan tidak sesuai'; END IF;
  IF t.angsuran IS NULL THEN
    IF NEW.angsuran_ke <> 1 THEN RAISE EXCEPTION 'Tagihan ini dibayar sekali'; END IF;
    v_harus := t.nominal - t.potongan;
  ELSE
    SELECT (e->>'jumlah')::numeric INTO v_harus FROM jsonb_array_elements(t.angsuran) e WHERE (e->>'ke')::int = NEW.angsuran_ke;
    IF v_harus IS NULL THEN RAISE EXCEPTION 'Angsuran ke-% tidak ada', NEW.angsuran_ke; END IF;
  END IF;
  IF v_harus <= 0 THEN RAISE EXCEPTION 'Tagihan ini tidak perlu dibayar'; END IF;
  IF EXISTS (SELECT 1 FROM pembayaran_rpl WHERE tagihan_id = NEW.tagihan_id AND angsuran_ke = NEW.angsuran_ke AND status IN ('menunggu', 'lunas')) THEN
    RAISE EXCEPTION 'Bukti bayar untuk tagihan ini sudah dikirim';
  END IF;
  NEW.jumlah := v_harus;
  NEW.komponen := t.komponen;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_pembayaran_baru ON pembayaran_rpl;
CREATE TRIGGER trg_cek_pembayaran_baru BEFORE INSERT ON pembayaran_rpl
  FOR EACH ROW EXECUTE FUNCTION public.cek_pembayaran_baru();

DROP POLICY IF EXISTS "keuangan verifikasi pembayaran" ON pembayaran_rpl;
CREATE POLICY "keuangan verifikasi pembayaran" ON pembayaran_rpl FOR UPDATE TO authenticated
  USING (public.punya_peran('admin', 'pmb')) WITH CHECK (public.punya_peran('admin', 'pmb'));

-- -------------------------------------------------------------------------
-- 6. Susun tagihan untuk pengajuan yang sudah berjalan
-- -------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM pengajuan_rpl WHERE alur_versi IS DISTINCT FROM 1 AND status NOT IN ('draft', 'dibatalkan') LOOP
    PERFORM public.siapkan_tagihan(r.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.siapkan_tagihan(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atur_tagihan(uuid, uuid, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tambah_tagihan(uuid, text, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hapus_tagihan(uuid) FROM anon;

COMMIT;
