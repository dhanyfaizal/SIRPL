-- =========================================================================
-- HOTFIX KEAMANAN untuk PRODUKSI (alur lama / PRD masih berjalan)
-- Tanggal : 2026-11-06
--
-- JALANKAN HANYA DI PROJECT PRODUKSI (DB_SistemRPL).
-- JANGAN dijalankan di SIRPL-staging: staging sudah memakai versi alur baru
-- dari fungsi-fungsi ini, dan file ini akan menimpanya dengan versi lama.
--
-- Menutup tiga celah:
--   1. Pemohon dapat mengubah kolom role/is_verified miliknya sendiri
--      (misalnya menjadi admin) lewat API.
--   2. Pemohon dapat mengubah status pengajuannya sendiri ke nilai apa pun
--      dan mengganti berkas setelah pengajuan dikirim.
--   3. Pemohon dapat mengubah biaya di penetapan_akhir miliknya.
--
-- Kompatibel dengan kode aplikasi saat ini. Perpindahan status yang dipakai
-- halaman Pendaftar tetap diizinkan:
--   draft / returned_baak  -> submitted atau draft  (simpan draf dan kirim)
--   mapped_admin           -> assessed_asessor      (ajukan sanggah)
--
-- Saat rilis alur baru, 20261106000000_alur_pedoman_skema.sql akan mengganti
-- fungsi dengan nama yang sama ini ke versi alur pedoman.
-- =========================================================================

BEGIN;

-- Fungsi bantu (definisinya sama dengan versi alur baru)
CREATE OR REPLACE FUNCTION public.punya_peran(VARIADIC daftar text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = ANY (daftar))
$$;

CREATE OR REPLACE FUNCTION public.is_staf_rpl()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text <> 'calon_rpl')
$$;

-- -------------------------------------------------------------------------
-- 1. Kunci kolom role dan is_verified pada profiles.
--    Hanya admin (atau SQL Editor) yang dapat mengubahnya. Pengguna tetap
--    dapat memperbarui nama, NIK, WhatsApp, dan data profil lainnya.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_kolom_profil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.punya_peran('admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'calon_rpl';
    NEW.is_verified := false;
  ELSE
    NEW.role := OLD.role;
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jaga_kolom_profil ON profiles;
CREATE TRIGGER trg_jaga_kolom_profil BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.jaga_kolom_profil();

-- -------------------------------------------------------------------------
-- 2. Batasi perubahan pengajuan oleh pemohon (alur lama).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_pengajuan_pemohon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staf_rpl() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'submitted') THEN
      NEW.status := 'draft';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    RAISE EXCEPTION 'Kolom ini hanya dapat diubah oleh Tim Pengelola RPL';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status IN ('draft', 'returned_baak') AND NEW.status IN ('draft', 'submitted'))
    OR (OLD.status = 'mapped_admin' AND NEW.status = 'assessed_asessor')
  ) THEN
    RAISE EXCEPTION 'Pemohon tidak dapat mengubah status dari % ke %', OLD.status, NEW.status;
  END IF;

  IF OLD.status NOT IN ('draft', 'returned_baak') AND (
       NEW.prodi_pilihan_id IS DISTINCT FROM OLD.prodi_pilihan_id
    OR NEW.file_ijazah_url IS DISTINCT FROM OLD.file_ijazah_url
    OR NEW.file_transkrip_url IS DISTINCT FROM OLD.file_transkrip_url
    OR NEW.file_ijazah_sma_url IS DISTINCT FROM OLD.file_ijazah_sma_url
    OR NEW.file_transkrip_sma_url IS DISTINCT FROM OLD.file_transkrip_sma_url) THEN
    RAISE EXCEPTION 'Berkas tidak dapat diubah setelah pengajuan dikirim';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jaga_pengajuan_pemohon ON pengajuan_rpl;
CREATE TRIGGER trg_jaga_pengajuan_pemohon BEFORE INSERT OR UPDATE ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.jaga_pengajuan_pemohon();

-- -------------------------------------------------------------------------
-- 3. Cabut hak pemohon mengubah penetapan_akhir (biaya, SKS, rencana studi).
--    Halaman Pendaftar hanya membaca tabel ini.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow update penetapan for owner" ON penetapan_akhir;

COMMIT;
