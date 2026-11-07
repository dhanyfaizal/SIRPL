-- =========================================================================
-- Modul Tim Pengelola RPL: Sekretariat, Sekretaris, dan Ketua Tim
-- (Pedoman RPL STIKOM Yos Sudarso Subbab 2.7, Juknis 112/B/KPT/2025 Bab II.D)
--
--   * verifikasi_berkas : daftar periksa kelengkapan awal oleh Sekretariat
--   * pembayaran_rpl    : catatan penolakan bukti bayar
--   * verifikasi_pddikti: Sekretariat ikut memeriksa (membantu tim penilai)
--   * storage           : seluruh staf RPL dapat membuka berkas pemohon
--   * cek_tahap_tim     : syarat perpindahan status yang dilakukan tim
--
-- Aman dijalankan ulang.
-- =========================================================================
BEGIN;

-- -------------------------------------------------------------------------
-- 1. Daftar periksa kelengkapan berkas (satu baris per pengajuan)
--    butir: [{ "kode": "berkas_transkrip", "label": "...", "sesuai": true|false|null, "catatan": "..." }]
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verifikasi_berkas (
  pengajuan_id UUID PRIMARY KEY REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  butir JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(butir) = 'array'),
  catatan TEXT,
  diperiksa_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  diperiksa_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.catat_pemeriksa_berkas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.diperiksa_oleh := coalesce(auth.uid(), NEW.diperiksa_oleh);
  NEW.diperiksa_at := NOW();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_pemeriksa_berkas ON verifikasi_berkas;
CREATE TRIGGER trg_catat_pemeriksa_berkas BEFORE INSERT OR UPDATE ON verifikasi_berkas
  FOR EACH ROW EXECUTE FUNCTION public.catat_pemeriksa_berkas();

-- Semua butir sudah diperiksa dan dinyatakan sesuai.
CREATE OR REPLACE FUNCTION public.berkas_terverifikasi(p_pengajuan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM verifikasi_berkas v
    WHERE v.pengajuan_id = p_pengajuan
      AND jsonb_array_length(v.butir) > 0
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v.butir) e
                      WHERE coalesce((e->>'sesuai')::boolean, false) = false))
$$;

ALTER TABLE verifikasi_berkas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staf baca verifikasi berkas" ON verifikasi_berkas;
CREATE POLICY "staf baca verifikasi berkas" ON verifikasi_berkas FOR SELECT TO authenticated
  USING (public.is_staf_rpl());
DROP POLICY IF EXISTS "pemohon baca verifikasi berkas" ON verifikasi_berkas;
CREATE POLICY "pemohon baca verifikasi berkas" ON verifikasi_berkas FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id));
DROP POLICY IF EXISTS "tim kelola verifikasi berkas" ON verifikasi_berkas;
CREATE POLICY "tim kelola verifikasi berkas" ON verifikasi_berkas FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka'));
GRANT SELECT, INSERT, UPDATE, DELETE ON verifikasi_berkas TO authenticated;

-- -------------------------------------------------------------------------
-- 2. Pembayaran: alasan penolakan bukti bayar
-- -------------------------------------------------------------------------
ALTER TABLE pembayaran_rpl ADD COLUMN IF NOT EXISTS catatan TEXT;

CREATE OR REPLACE FUNCTION public.catat_verifikasi_pembayaran()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('lunas', 'ditolak') THEN
    IF NEW.status = 'ditolak' AND coalesce(btrim(NEW.catatan), '') = '' THEN
      RAISE EXCEPTION 'Tuliskan alasan penolakan bukti bayar';
    END IF;
    NEW.diverifikasi_oleh := coalesce(auth.uid(), NEW.diverifikasi_oleh);
    NEW.diverifikasi_at := NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_verifikasi_pembayaran ON pembayaran_rpl;
CREATE TRIGGER trg_catat_verifikasi_pembayaran BEFORE UPDATE ON pembayaran_rpl
  FOR EACH ROW EXECUTE FUNCTION public.catat_verifikasi_pembayaran();

-- -------------------------------------------------------------------------
-- 3. Verifikasi PDDikti: Sekretariat membantu pemeriksaan
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "penilai kelola verifikasi pddikti" ON verifikasi_pddikti;
CREATE POLICY "penilai kelola verifikasi pddikti" ON verifikasi_pddikti FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'));

CREATE OR REPLACE FUNCTION public.catat_pemeriksa_pddikti()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.diperiksa_oleh := coalesce(auth.uid(), NEW.diperiksa_oleh);
  NEW.diperiksa_at := NOW();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_pemeriksa_pddikti ON verifikasi_pddikti;
CREATE TRIGGER trg_catat_pemeriksa_pddikti BEFORE INSERT OR UPDATE ON verifikasi_pddikti
  FOR EACH ROW EXECUTE FUNCTION public.catat_pemeriksa_pddikti();

-- -------------------------------------------------------------------------
-- 4. Berkas pemohon dapat dibuka seluruh staf RPL (sebelumnya hanya peran lama)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "v2 staf rpl baca berkas" ON storage.objects;
CREATE POLICY "v2 staf rpl baca berkas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rpl-documents' AND public.is_staf_rpl());

-- -------------------------------------------------------------------------
-- 5. Syarat perpindahan status oleh tim (alur versi 2)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cek_tahap_tim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_jumlah int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staf_rpl()
     OR NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.alur_versi = 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('dikembalikan_sekretariat', 'tidak_memenuhi_syarat') THEN
    IF OLD.status NOT IN ('diajukan', 'terverifikasi') THEN
      RAISE EXCEPTION 'Pengajuan berstatus % tidak dapat dikembalikan atau ditolak oleh Sekretariat', OLD.status;
    END IF;
    IF coalesce(btrim(NEW.catatan_revisi), '') = '' THEN
      RAISE EXCEPTION 'Tuliskan catatan untuk pemohon';
    END IF;
  END IF;

  IF NEW.status = 'terverifikasi' THEN
    IF OLD.status <> 'diajukan' THEN
      RAISE EXCEPTION 'Hanya pengajuan yang baru diajukan yang dapat diverifikasi';
    END IF;
    IF NOT public.berkas_terverifikasi(NEW.id) THEN
      RAISE EXCEPTION 'Daftar periksa kelengkapan berkas belum lengkap atau masih ada butir yang perlu diperbaiki';
    END IF;
  END IF;

  IF NEW.status = 'asesmen' AND OLD.status = 'terverifikasi' THEN
    SELECT count(*) INTO v_jumlah FROM penugasan_asesor WHERE pengajuan_id = NEW.id;
    IF v_jumlah = 0 THEN
      RAISE EXCEPTION 'Tugaskan asesor terlebih dahulu sebelum asesmen dimulai';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_tahap_tim ON pengajuan_rpl;
CREATE TRIGGER trg_cek_tahap_tim BEFORE UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.cek_tahap_tim();

-- Penugasan asesor hanya pada pengajuan yang sudah diverifikasi.
CREATE OR REPLACE FUNCTION public.cek_penugasan_asesor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = NEW.pengajuan_id;
  IF v_status IN ('draft', 'diajukan', 'dikembalikan_sekretariat', 'dibatalkan', 'tidak_memenuhi_syarat') THEN
    RAISE EXCEPTION 'Asesor ditugaskan setelah berkas diverifikasi Sekretariat';
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = NEW.asesor_id;
  IF v_role IS NULL OR v_role NOT IN ('asessor', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'ketua_tim') THEN
    RAISE EXCEPTION 'Akun yang dipilih bukan asesor';
  END IF;
  NEW.ditugaskan_oleh := coalesce(auth.uid(), NEW.ditugaskan_oleh);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_penugasan_asesor ON penugasan_asesor;
CREATE TRIGGER trg_cek_penugasan_asesor BEFORE INSERT OR UPDATE ON penugasan_asesor
  FOR EACH ROW EXECUTE FUNCTION public.cek_penugasan_asesor();

-- Catat penugasan dan jadwal di log aktivitas (audit LPMP).
CREATE OR REPLACE FUNCTION public.catat_kegiatan_tim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nama text; v_baris record;
BEGIN
  v_baris := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_TABLE_NAME = 'penugasan_asesor' THEN
    SELECT nama_lengkap INTO v_nama FROM profiles WHERE id = v_baris.asesor_id;
    INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
    VALUES (v_baris.pengajuan_id, auth.uid(),
            CASE WHEN TG_OP = 'DELETE' THEN 'cabut_asesor' ELSE 'tugaskan_asesor' END,
            coalesce(v_nama, 'Asesor') || ' (' || v_baris.peran || ')');
  ELSIF TG_TABLE_NAME = 'jadwal_asesmen' THEN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.waktu IS DISTINCT FROM OLD.waktu THEN
      INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
      VALUES (NEW.pengajuan_id, auth.uid(), 'jadwal_' || NEW.status,
              initcap(NEW.jenis) || ' ' || to_char(NEW.waktu AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB');
    END IF;
  END IF;
  RETURN v_baris;
END $$;
DROP TRIGGER IF EXISTS trg_catat_penugasan ON penugasan_asesor;
CREATE TRIGGER trg_catat_penugasan AFTER INSERT OR DELETE ON penugasan_asesor
  FOR EACH ROW EXECUTE FUNCTION public.catat_kegiatan_tim();
DROP TRIGGER IF EXISTS trg_catat_jadwal ON jadwal_asesmen;
CREATE TRIGGER trg_catat_jadwal AFTER INSERT OR UPDATE ON jadwal_asesmen
  FOR EACH ROW EXECUTE FUNCTION public.catat_kegiatan_tim();

-- Penugasan asesor tetap wewenang Ketua Tim dan admin (Pedoman 2.7, policy
-- "kelola penugasan"); Sekretaris dan Sekretariat hanya membaca.

COMMIT;
