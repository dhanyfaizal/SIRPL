-- =========================================================================
-- Migrasi Alur Pedoman RPL Tipe A STIKOM Yos Sudarso
-- Bagian 1 dari 2: SKEMA
-- Tanggal : 2026-11-06
-- Acuan   : Pedoman Penyelenggaraan RPL Tipe A STIKOM Yos Sudarso
--           Kepdirjen Dikti No. 112/B/KPT/2025 (Juknis RPL)
--
-- Sifat file ini: HANYA MENAMBAH. Tidak ada tabel, kolom, atau data lama
-- yang dihapus. Satu-satunya perubahan pada objek lama:
--   (a) daftar peran pada profiles_role_check ditambah 4 peran baru,
--   (b) policy UPDATE pemohon pada penetapan_akhir dicabut (celah keamanan),
--   (c) trigger penjaga ditambahkan pada profiles dan pengajuan_rpl.
-- Status pengajuan BELUM diubah di sini; itu dikerjakan di bagian 2.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Peran baru sesuai struktur Tim Pengelola RPL (Pedoman Subbab 2.7)
--    Pemetaan peran lama tetap dipakai:
--      pmb, baak        -> fungsi Sekretariat
--      kaprodi_*        -> Koordinator Prodi
--      asessor          -> Anggota Prodi / Tim Penilai (Asesor)
--      eksekutif        -> Pelindung (Ketua STIKOM), penerbit SK
--      admin            -> Administrator sistem
--    Peran baru:
--      ketua_tim        -> Ketua Tim Pengelola RPL
--      sekretaris       -> Sekretaris Tim Pengelola RPL
--      komite           -> Penasihat (berfungsi sebagai Komite RPL)
--      lpmp             -> Koordinator LPMP (penjaminan mutu, akses baca)
-- -------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN ('calon_rpl', 'pmb', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka',
           'asessor', 'admin', 'eksekutif', 'ketua_tim', 'sekretaris', 'komite', 'lpmp')
);

-- Asesor dan koordinator terikat ke program studi.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prodi_id UUID REFERENCES program_studi(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- 2. Fungsi bantu peran (dipakai policy RLS baru).
--    SECURITY DEFINER agar tidak terkena RLS saat membaca profiles.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peran_saya()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.punya_peran(VARIADIC daftar text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = ANY (daftar))
$$;

-- Semua akun selain pemohon dianggap staf RPL.
CREATE OR REPLACE FUNCTION public.is_staf_rpl()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text <> 'calon_rpl')
$$;

CREATE OR REPLACE FUNCTION public.pengajuan_milik_saya(p_pengajuan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pengajuan_rpl WHERE id = p_pengajuan AND user_id = auth.uid())
$$;

-- Kode prodi yang dipegang Koordinator Prodi (kaprodi_ti -> IF, dst.).
CREATE OR REPLACE FUNCTION public.kode_prodi_peran(p_role text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'kaprodi_ti'  THEN 'IF'
    WHEN 'kaprodi_si'  THEN 'SI'
    WHEN 'kaprodi_dkv' THEN 'DKV'
    WHEN 'kaprodi_ka'  THEN 'KA'
  END
$$;

-- -------------------------------------------------------------------------
-- 3. Program studi penyelenggara RPL (Pedoman Subbab 2.4 dan 2.5)
-- -------------------------------------------------------------------------
ALTER TABLE program_studi
  ADD COLUMN IF NOT EXISTS jenjang VARCHAR(10) DEFAULT 'S1',
  ADD COLUMN IF NOT EXISTS kode_pddikti VARCHAR(10),
  ADD COLUMN IF NOT EXISTS akreditasi VARCHAR(50),
  ADD COLUMN IF NOT EXISTS beban_sks_minimal INTEGER DEFAULT 144 CHECK (beban_sks_minimal > 0),
  ADD COLUMN IF NOT EXISTS maks_sks_rpl INTEGER CHECK (maks_sks_rpl IS NULL OR maks_sks_rpl > 0),
  ADD COLUMN IF NOT EXISTS is_penyelenggara_rpl BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS menerima_transfer_kredit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS menerima_perolehan_kredit BOOLEAN DEFAULT true;

COMMENT ON COLUMN program_studi.maks_sks_rpl IS
  'Batas SKS yang dapat direkognisi. Jika NULL, dihitung 70% dari beban_sks_minimal (dibulatkan ke bawah).';

-- -------------------------------------------------------------------------
-- 4. Mata kuliah: penanda RPL, tugas akhir, dan sub-CPMK untuk Evaluasi Diri
-- -------------------------------------------------------------------------
ALTER TABLE mata_kuliah_kurikulum
  ADD COLUMN IF NOT EXISTS dapat_rpl BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_tugas_akhir BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpmk TEXT,
  ADD COLUMN IF NOT EXISTS sub_cpmk JSONB DEFAULT '[]'::jsonb;  -- [{ "kode": "Sub-CPMK-1", "deskripsi": "..." }]

ALTER TABLE mata_kuliah_kurikulum DROP CONSTRAINT IF EXISTS mk_tugas_akhir_tidak_rpl;
ALTER TABLE mata_kuliah_kurikulum ADD CONSTRAINT mk_tugas_akhir_tidak_rpl
  CHECK (NOT (is_tugas_akhir AND dapat_rpl));  -- Pedoman 2.1 butir 3

-- -------------------------------------------------------------------------
-- 5. Periode (tahun akademik) dan tarif biaya (Pedoman Bab IV)
--    Menggantikan pengaturan biaya yang sebelumnya disimpan di localStorage.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS periode_rpl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL UNIQUE,              -- contoh: '2026/2027'
  tanggal_buka DATE,
  tanggal_tutup DATE,
  batas_rekognisi_persen NUMERIC(5,2) NOT NULL DEFAULT 70 CHECK (batas_rekognisi_persen > 0 AND batas_rekognisi_persen <= 70),
  is_aktif BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS periode_rpl_satu_aktif ON periode_rpl (is_aktif) WHERE is_aktif;

CREATE TABLE IF NOT EXISTS tarif_biaya (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID NOT NULL REFERENCES periode_rpl(id) ON DELETE CASCADE,
  prodi_id UUID REFERENCES program_studi(id) ON DELETE CASCADE,   -- NULL = berlaku semua prodi
  komponen VARCHAR(40) NOT NULL CHECK (komponen IN (
    'pendaftaran', 'asesmen_per_sks', 'kuliah_per_semester', 'matrikulasi_per_mk',
    'cuti_per_semester', 'lain_lain', 'moocs_per_mk')),
  besaran NUMERIC NOT NULL CHECK (besaran >= 0),
  keterangan TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,   -- true = kebijakan internal, tidak tercantum di pedoman
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS tarif_biaya_unik
  ON tarif_biaya (periode_id, komponen, coalesce(prodi_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- -------------------------------------------------------------------------
-- 6. Pleno dan SK (Pedoman Subbab 2.2.4 dan 3.5)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pleno_rpl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID REFERENCES periode_rpl(id) ON DELETE SET NULL,
  tanggal DATE NOT NULL,
  nomor_berita_acara VARCHAR(100),
  notulen TEXT,
  file_berita_acara_url TEXT,
  dipimpin_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sk_rekognisi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID REFERENCES periode_rpl(id) ON DELETE SET NULL,
  nomor_sk VARCHAR(100) NOT NULL UNIQUE,
  tanggal_sk DATE NOT NULL,
  perihal TEXT,
  file_sk_url TEXT,
  ditetapkan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. Kolom baru pada pengajuan_rpl
-- -------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS nomor_pendaftaran_rpl_seq;

ALTER TABLE pengajuan_rpl
  ADD COLUMN IF NOT EXISTS nomor_pendaftaran VARCHAR(30) UNIQUE,
  ADD COLUMN IF NOT EXISTS periode_id UUID REFERENCES periode_rpl(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alur_versi SMALLINT NOT NULL DEFAULT 2,      -- 1 = dibuat di alur lama (PRD)
  ADD COLUMN IF NOT EXISTS jenis_rpl VARCHAR(20) CHECK (jenis_rpl IN ('transfer', 'perolehan', 'gabungan')),
  -- Persyaratan calon (Pedoman 2.3)
  ADD COLUMN IF NOT EXISTS tahun_lulus_slta SMALLINT,
  ADD COLUMN IF NOT EXISTS is_lulusan_paket_c BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pengalaman_kerja_bulan INTEGER CHECK (pengalaman_kerja_bulan IS NULL OR pengalaman_kerja_bulan >= 0),
  ADD COLUMN IF NOT EXISTS pt_asal VARCHAR(255),
  ADD COLUMN IF NOT EXISTS prodi_asal VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status_pddikti_asal VARCHAR(30) CHECK (status_pddikti_asal IN
    ('lulus', 'aktif', 'cuti', 'mengundurkan_diri', 'putus_studi', 'dikeluarkan', 'tidak_ada')),
  ADD COLUMN IF NOT EXISTS tanggal_mengundurkan_diri DATE,
  -- Konsultasi (Pedoman 2.2.1)
  ADD COLUMN IF NOT EXISTS konsultan_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS konsultasi_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catatan_konsultasi TEXT,
  -- Penetapan (Pedoman 3.5)
  ADD COLUMN IF NOT EXISTS pleno_id UUID REFERENCES pleno_rpl(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hasil_disampaikan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disetujui_pemohon_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sk_id UUID REFERENCES sk_rekognisi(id) ON DELETE SET NULL,
  -- Pelaporan (Pedoman 3.5 butir 7)
  ADD COLUMN IF NOT EXISTS dilaporkan_sistem_rpl_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dilaporkan_pddikti_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS pengajuan_rpl_status_idx ON pengajuan_rpl (status);
CREATE INDEX IF NOT EXISTS pengajuan_rpl_periode_idx ON pengajuan_rpl (periode_id);

-- -------------------------------------------------------------------------
-- 8. Tabel proses asesmen
-- -------------------------------------------------------------------------

-- 8a. Penugasan asesor oleh Ketua Tim (Pedoman 2.7)
CREATE TABLE IF NOT EXISTS penugasan_asesor (
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  asesor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  peran VARCHAR(20) NOT NULL DEFAULT 'anggota' CHECK (peran IN ('koordinator', 'anggota', 'praktisi')),
  ditugaskan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pengajuan_id, asesor_id)
);

-- 8b. Bukti portofolio bernomor (Pedoman 3.4)
CREATE TABLE IF NOT EXISTS bukti_portofolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  nomor INTEGER NOT NULL CHECK (nomor > 0),
  jenis VARCHAR(40) NOT NULL CHECK (jenis IN (
    'ijazah', 'transkrip', 'surat_keterangan_lulus_mk', 'silabus_rps',
    'riwayat_pekerjaan', 'surat_keterangan_kerja', 'sertifikat_kompetensi', 'sertifikat_pelatihan',
    'lisensi', 'dokumentasi_pekerjaan', 'logbook', 'lembar_kerja', 'dokumen_perancangan',
    'portofolio_proyek', 'tautan_repositori', 'keanggotaan_asosiasi', 'surat_referensi',
    'penghargaan', 'penilaian_kinerja', 'lainnya')),
  nama_dokumen VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  file_url TEXT,
  tautan TEXT,
  disahkan_atasan BOOLEAN DEFAULT false,
  is_bukti_tambahan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pengajuan_id, nomor),
  CHECK (file_url IS NOT NULL OR tautan IS NOT NULL)
);

-- 8c. Formulir Evaluasi Diri / F03, satu baris per mata kuliah (Pedoman 3.3.1)
CREATE TABLE IF NOT EXISTS evaluasi_diri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mk_id UUID NOT NULL REFERENCES mata_kuliah_kurikulum(id) ON DELETE CASCADE,
  -- [{ "sub_cpmk": "Sub-CPMK-1", "profisiensi": "sangat_baik|baik|tidak_pernah", "bukti": [1, 3] }]
  butir JSONB NOT NULL DEFAULT '[]'::jsonb,
  pernyataan_setuju BOOLEAN NOT NULL DEFAULT false,
  diisi_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pengajuan_id, mk_id)
);

-- 8d. Penilaian per mata kuliah tujuan, menggantikan data_mapping_mk (JSON)
CREATE TABLE IF NOT EXISTS penilaian_mk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mk_id UUID NOT NULL REFERENCES mata_kuliah_kurikulum(id) ON DELETE RESTRICT,
  mekanisme VARCHAR(20) NOT NULL CHECK (mekanisme IN ('transfer', 'perolehan')),
  -- Sumber pengakuan: MK asal (transfer) atau sertifikat/pengalaman (perolehan)
  -- [{ "kategori": "transkrip|sertifikat|pengalaman", "nama": "...", "sks": 3, "nilai": "A" }]
  asal JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Penilaian bukti per sub-CPMK (Pedoman 3.3.2)
  -- [{ "sub_cpmk": "Sub-CPMK-1", "valid": true, "autentik": true, "terkini": true, "memadai": false }]
  vatm JSONB NOT NULL DEFAULT '[]'::jsonb,
  metode TEXT[] NOT NULL DEFAULT ARRAY['portofolio']::text[],
  keputusan VARCHAR(30) NOT NULL DEFAULT 'belum_dinilai' CHECK (keputusan IN
    ('belum_dinilai', 'diakui', 'tidak_diakui', 'perlu_asesmen_lanjutan')),
  nilai_huruf VARCHAR(3),
  catatan TEXT,
  sumber_usulan VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber_usulan IN ('manual', 'aisys')),
  dinilai_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  dinilai_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pengajuan_id, mk_id),
  CHECK (keputusan <> 'diakui' OR nilai_huruf IS NOT NULL)
);

-- 8e. Asesmen lanjutan: wawancara, demonstrasi, tulis, dll. (Pedoman 3.3.3 dan 3.3.4)
CREATE TABLE IF NOT EXISTS jadwal_asesmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('wawancara', 'tulis', 'praktik', 'presentasi', 'observasi', 'tugas')),
  mode VARCHAR(10) NOT NULL DEFAULT 'daring' CHECK (mode IN ('daring', 'luring')),
  waktu TIMESTAMPTZ NOT NULL,
  tempat_atau_tautan TEXT,
  mk_ids UUID[] NOT NULL DEFAULT '{}',
  asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'dijadwalkan' CHECK (status IN ('dijadwalkan', 'selesai', 'dibatalkan')),
  hasil TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8f. Klarifikasi / keberatan pemohon sebelum penetapan (Pedoman 3.5 butir 3)
CREATE TABLE IF NOT EXISTS klarifikasi_rpl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mk_ids UUID[] NOT NULL DEFAULT '{}',
  alasan TEXT NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan', 'diproses', 'selesai')),
  tanggapan TEXT,
  ditanggapi_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  selesai_at TIMESTAMPTZ
);

-- 8g. Persetujuan Komite RPL / Penasihat (Pedoman 3.5 butir 4)
CREATE TABLE IF NOT EXISTS persetujuan_komite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  komite_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  keputusan VARCHAR(15) NOT NULL CHECK (keputusan IN ('disetujui', 'dikembalikan')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8h. Pembayaran (pendaftaran, asesmen, dst.)
CREATE TABLE IF NOT EXISTS pembayaran_rpl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  komponen VARCHAR(40) NOT NULL CHECK (komponen IN ('pendaftaran', 'asesmen', 'lainnya')),
  jumlah NUMERIC NOT NULL CHECK (jumlah >= 0),
  bukti_bayar_url TEXT,
  status VARCHAR(15) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'lunas', 'ditolak')),
  diverifikasi_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  diverifikasi_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8i. Log aktivitas untuk audit LPMP (Pedoman 5.7)
CREATE TABLE IF NOT EXISTS log_aktivitas_rpl (
  id BIGSERIAL PRIMARY KEY,
  pengajuan_id UUID REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  aktor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aksi VARCHAR(50) NOT NULL,
  dari_status VARCHAR(50),
  ke_status VARCHAR(50),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS log_aktivitas_rpl_pengajuan_idx ON log_aktivitas_rpl (pengajuan_id, created_at);

-- -------------------------------------------------------------------------
-- 9. Trigger
-- -------------------------------------------------------------------------

-- 9a. updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_pengajuan_updated_at ON pengajuan_rpl;
CREATE TRIGGER trg_pengajuan_updated_at BEFORE UPDATE ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_evaluasi_diri_updated_at ON evaluasi_diri;
CREATE TRIGGER trg_evaluasi_diri_updated_at BEFORE UPDATE ON evaluasi_diri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_penilaian_mk_updated_at ON penilaian_mk;
CREATE TRIGGER trg_penilaian_mk_updated_at BEFORE UPDATE ON penilaian_mk
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9b. Nomor pendaftaran otomatis: RPL-2026-0001
CREATE OR REPLACE FUNCTION public.set_nomor_pendaftaran()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nomor_pendaftaran IS NULL THEN
    NEW.nomor_pendaftaran := 'RPL-' || to_char(coalesce(NEW.created_at, NOW()), 'YYYY') || '-'
                             || lpad(nextval('nomor_pendaftaran_rpl_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nomor_pendaftaran ON pengajuan_rpl;
CREATE TRIGGER trg_nomor_pendaftaran BEFORE INSERT ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.set_nomor_pendaftaran();

-- 9c. Catat setiap perubahan status ke log (untuk audit LPMP)
CREATE OR REPLACE FUNCTION public.catat_perubahan_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, dari_status, ke_status, catatan)
    VALUES (NEW.id, auth.uid(), 'ubah_status', OLD.status, NEW.status, NEW.catatan_revisi);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_status ON pengajuan_rpl;
CREATE TRIGGER trg_catat_status AFTER UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.catat_perubahan_status();

-- 9d. PENJAGA PROFIL (celah keamanan).
--     Sebelumnya pemohon dapat mengubah kolom role miliknya sendiri lewat API
--     (policy "Allow update for self and admin" tidak membatasi kolom).
--     Kini role dan is_verified hanya dapat diubah oleh admin atau dari SQL Editor.
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
    NEW.prodi_id := OLD.prodi_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_kolom_profil ON profiles;
CREATE TRIGGER trg_jaga_kolom_profil BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.jaga_kolom_profil();

-- 9e. PENJAGA PENGAJUAN (celah keamanan).
--     Sebelumnya pemohon dapat mengubah status pengajuannya sendiri ke nilai apa pun.
--     Kini pemohon hanya boleh melakukan transisi yang memang menjadi haknya.
CREATE OR REPLACE FUNCTION public.jaga_pengajuan_pemohon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- SQL Editor / service role dan staf tidak dibatasi trigger ini (dibatasi RLS).
  IF auth.uid() IS NULL OR public.is_staf_rpl() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'diajukan') THEN
      NEW.status := 'draft';
    END IF;
    NEW.alur_versi := 2;
    NEW.pleno_id := NULL; NEW.sk_id := NULL;
    NEW.hasil_disampaikan_at := NULL; NEW.disetujui_pemohon_at := NULL;
    NEW.dilaporkan_sistem_rpl_at := NULL; NEW.dilaporkan_pddikti_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.nomor_pendaftaran IS DISTINCT FROM OLD.nomor_pendaftaran
     OR NEW.alur_versi IS DISTINCT FROM OLD.alur_versi
     OR NEW.pleno_id IS DISTINCT FROM OLD.pleno_id
     OR NEW.sk_id IS DISTINCT FROM OLD.sk_id
     OR NEW.konsultan_id IS DISTINCT FROM OLD.konsultan_id
     OR NEW.hasil_disampaikan_at IS DISTINCT FROM OLD.hasil_disampaikan_at
     OR NEW.dilaporkan_sistem_rpl_at IS DISTINCT FROM OLD.dilaporkan_sistem_rpl_at
     OR NEW.dilaporkan_pddikti_at IS DISTINCT FROM OLD.dilaporkan_pddikti_at
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    RAISE EXCEPTION 'Kolom ini hanya dapat diubah oleh Tim Pengelola RPL';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status IN ('draft', 'dikembalikan_sekretariat') AND NEW.status = 'diajukan')
    OR (OLD.status = 'menunggu_bukti_tambahan'            AND NEW.status = 'asesmen')
    OR (OLD.status = 'hasil_disampaikan'                  AND NEW.status IN ('klarifikasi', 'menunggu_komite'))
    OR (OLD.status IN ('draft', 'diajukan', 'dikembalikan_sekretariat') AND NEW.status = 'dibatalkan')
  ) THEN
    RAISE EXCEPTION 'Pemohon tidak dapat mengubah status dari % ke %', OLD.status, NEW.status;
  END IF;

  -- Isi berkas hanya boleh diubah selama masih draf atau dikembalikan.
  IF OLD.status NOT IN ('draft', 'dikembalikan_sekretariat') AND (
       NEW.prodi_pilihan_id IS DISTINCT FROM OLD.prodi_pilihan_id
    OR NEW.jenis_rpl IS DISTINCT FROM OLD.jenis_rpl
    OR NEW.file_ijazah_url IS DISTINCT FROM OLD.file_ijazah_url
    OR NEW.file_transkrip_url IS DISTINCT FROM OLD.file_transkrip_url
    OR NEW.file_ijazah_sma_url IS DISTINCT FROM OLD.file_ijazah_sma_url
    OR NEW.file_transkrip_sma_url IS DISTINCT FROM OLD.file_transkrip_sma_url) THEN
    RAISE EXCEPTION 'Berkas tidak dapat diubah setelah pengajuan dikirim';
  END IF;

  IF NEW.status = 'menunggu_komite' AND OLD.status = 'hasil_disampaikan' THEN
    NEW.disetujui_pemohon_at := NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_pengajuan_pemohon ON pengajuan_rpl;
CREATE TRIGGER trg_jaga_pengajuan_pemohon BEFORE INSERT OR UPDATE ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.jaga_pengajuan_pemohon();

-- 9f. Tugas akhir tidak boleh diakui (Pedoman 2.1 butir 3).
--     Pengecualian hanya untuk riwayat pengajuan alur lama yang sudah tuntas.
CREATE OR REPLACE FUNCTION public.cek_tugas_akhir_tidak_diakui()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.keputusan = 'diakui'
     AND EXISTS (SELECT 1 FROM mata_kuliah_kurikulum WHERE id = NEW.mk_id AND is_tugas_akhir)
     AND NOT EXISTS (SELECT 1 FROM pengajuan_rpl WHERE id = NEW.pengajuan_id
                     AND alur_versi = 1 AND status IN ('mapped_admin', 'selesai')) THEN
    RAISE EXCEPTION 'Tugas akhir tidak dapat direkognisi (Pedoman RPL Subbab 2.1)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_tugas_akhir ON penilaian_mk;
CREATE TRIGGER trg_cek_tugas_akhir BEFORE INSERT OR UPDATE ON penilaian_mk
  FOR EACH ROW EXECUTE FUNCTION public.cek_tugas_akhir_tidak_diakui();

-- 9g. Batas SKS rekognisi (Pedoman 2.1 butir 1 dan 2.5).
--     Diperiksa saat pengajuan maju ke tahap hasil dan sesudahnya.
CREATE OR REPLACE FUNCTION public.batas_sks_rpl(p_prodi uuid, p_periode uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(ps.maks_sks_rpl,
                  floor(ps.beban_sks_minimal * coalesce(pr.batas_rekognisi_persen, 70) / 100)::int)
  FROM program_studi ps
  LEFT JOIN periode_rpl pr ON pr.id = p_periode
  WHERE ps.id = p_prodi
$$;

CREATE OR REPLACE FUNCTION public.total_sks_diakui(p_pengajuan uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(mk.sks), 0)::int
  FROM penilaian_mk pn JOIN mata_kuliah_kurikulum mk ON mk.id = pn.mk_id
  WHERE pn.pengajuan_id = p_pengajuan AND pn.keputusan = 'diakui'
$$;

CREATE OR REPLACE FUNCTION public.cek_batas_rekognisi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_batas int;
BEGIN
  -- Migrasi dan SQL Editor tidak diperiksa; aturan berlaku untuk aksi dari aplikasi.
  IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('hasil_disampaikan', 'menunggu_komite', 'menunggu_sk', 'sk_terbit') THEN
    RETURN NEW;
  END IF;
  v_total := public.total_sks_diakui(NEW.id);
  v_batas := public.batas_sks_rpl(NEW.prodi_pilihan_id, NEW.periode_id);
  IF v_batas IS NOT NULL AND v_total > v_batas THEN
    RAISE EXCEPTION 'SKS diakui (%) melebihi batas rekognisi program studi (% SKS)', v_total, v_batas;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_batas_rekognisi ON pengajuan_rpl;
CREATE TRIGGER trg_cek_batas_rekognisi BEFORE UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.cek_batas_rekognisi();

-- -------------------------------------------------------------------------
-- 10. RLS
-- -------------------------------------------------------------------------

-- 10a. Celah: pemohon dapat mengubah biaya di penetapan_akhir miliknya.
--      Kode aplikasi tidak pernah memakai hak ini, jadi aman dicabut.
DROP POLICY IF EXISTS "Allow update penetapan for owner" ON penetapan_akhir;

-- 10b. Akses peran baru ke tabel lama (policy tambahan, policy lama tetap)
DROP POLICY IF EXISTS "v2 staf baru baca pengajuan" ON pengajuan_rpl;
CREATE POLICY "v2 staf baru baca pengajuan" ON pengajuan_rpl FOR SELECT TO authenticated
  USING (public.punya_peran('ketua_tim', 'sekretaris', 'komite', 'lpmp'));
DROP POLICY IF EXISTS "v2 staf baru ubah pengajuan" ON pengajuan_rpl;
CREATE POLICY "v2 staf baru ubah pengajuan" ON pengajuan_rpl FOR UPDATE TO authenticated
  USING (public.punya_peran('ketua_tim', 'sekretaris', 'komite', 'eksekutif'))
  WITH CHECK (public.punya_peran('ketua_tim', 'sekretaris', 'komite', 'eksekutif'));

DROP POLICY IF EXISTS "v2 staf baru baca rekognisi" ON tabel_rekognisi;
CREATE POLICY "v2 staf baru baca rekognisi" ON tabel_rekognisi FOR SELECT TO authenticated
  USING (public.punya_peran('ketua_tim', 'sekretaris', 'komite', 'lpmp', 'eksekutif'));

DROP POLICY IF EXISTS "v2 staf baru kelola penetapan" ON penetapan_akhir;
CREATE POLICY "v2 staf baru kelola penetapan" ON penetapan_akhir FOR ALL TO authenticated
  USING (public.punya_peran('ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('ketua_tim', 'sekretaris'));
DROP POLICY IF EXISTS "v2 staf baru baca penetapan" ON penetapan_akhir;
CREATE POLICY "v2 staf baru baca penetapan" ON penetapan_akhir FOR SELECT TO authenticated
  USING (public.punya_peran('komite', 'lpmp'));

DROP POLICY IF EXISTS "v2 staf baru baca feedback" ON feedback_pelayanan;
CREATE POLICY "v2 staf baru baca feedback" ON feedback_pelayanan FOR SELECT TO authenticated
  USING (public.punya_peran('ketua_tim', 'sekretaris', 'komite', 'lpmp'));

DROP POLICY IF EXISTS "v2 admin kelola program studi" ON program_studi;
CREATE POLICY "v2 admin kelola program studi" ON program_studi FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));

-- Koordinator Prodi mengelola sub-CPMK dan penanda RPL mata kuliah prodinya.
DROP POLICY IF EXISTS "v2 kaprodi ubah mk prodinya" ON mata_kuliah_kurikulum;
CREATE POLICY "v2 kaprodi ubah mk prodinya" ON mata_kuliah_kurikulum FOR UPDATE TO authenticated
  USING (public.punya_peran('admin') OR EXISTS (
    SELECT 1 FROM program_studi ps WHERE ps.id = mata_kuliah_kurikulum.prodi_id
      AND ps.kode = public.kode_prodi_peran(public.peran_saya())))
  WITH CHECK (public.punya_peran('admin') OR EXISTS (
    SELECT 1 FROM program_studi ps WHERE ps.id = mata_kuliah_kurikulum.prodi_id
      AND ps.kode = public.kode_prodi_peran(public.peran_saya())));

-- 10c. Tabel baru
ALTER TABLE periode_rpl        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarif_biaya        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pleno_rpl          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sk_rekognisi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE penugasan_asesor   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bukti_portofolio   ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluasi_diri      ENABLE ROW LEVEL SECURITY;
ALTER TABLE penilaian_mk       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_asesmen     ENABLE ROW LEVEL SECURITY;
ALTER TABLE klarifikasi_rpl    ENABLE ROW LEVEL SECURITY;
ALTER TABLE persetujuan_komite ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran_rpl     ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_aktivitas_rpl  ENABLE ROW LEVEL SECURITY;

-- Periode dan tarif: informasi publik (Pedoman 5.1), dikelola pengelola.
CREATE POLICY "baca periode" ON periode_rpl FOR SELECT USING (true);
CREATE POLICY "kelola periode" ON periode_rpl FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));
CREATE POLICY "baca tarif" ON tarif_biaya FOR SELECT USING (true);
CREATE POLICY "kelola tarif" ON tarif_biaya FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));

-- Pleno
CREATE POLICY "staf baca pleno" ON pleno_rpl FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "kelola pleno" ON pleno_rpl FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));

-- SK: staf membaca; pemohon membaca SK yang memuat pengajuannya.
CREATE POLICY "baca sk" ON sk_rekognisi FOR SELECT TO authenticated USING (
  public.is_staf_rpl() OR EXISTS (
    SELECT 1 FROM pengajuan_rpl p WHERE p.sk_id = sk_rekognisi.id AND p.user_id = auth.uid()));
CREATE POLICY "kelola sk" ON sk_rekognisi FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'eksekutif', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'eksekutif', 'sekretaris'));

-- Penugasan asesor
CREATE POLICY "baca penugasan" ON penugasan_asesor FOR SELECT TO authenticated
  USING (public.is_staf_rpl());
CREATE POLICY "kelola penugasan" ON penugasan_asesor FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim'));

-- Bukti portofolio dan evaluasi diri: dikelola pemohon, dibaca staf.
CREATE POLICY "pemohon kelola bukti" ON bukti_portofolio FOR ALL TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id))
  WITH CHECK (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf baca bukti" ON bukti_portofolio FOR SELECT TO authenticated
  USING (public.is_staf_rpl());

CREATE POLICY "pemohon kelola evaluasi diri" ON evaluasi_diri FOR ALL TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id))
  WITH CHECK (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf baca evaluasi diri" ON evaluasi_diri FOR SELECT TO authenticated
  USING (public.is_staf_rpl());

-- Penilaian: diisi penilai; pemohon baru dapat melihat setelah hasil disampaikan.
CREATE POLICY "staf baca penilaian" ON penilaian_mk FOR SELECT TO authenticated
  USING (public.is_staf_rpl());
CREATE POLICY "penilai kelola penilaian" ON penilaian_mk FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'));
CREATE POLICY "pemohon baca hasil penilaian" ON penilaian_mk FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pengajuan_rpl p WHERE p.id = penilaian_mk.pengajuan_id
    AND p.user_id = auth.uid()
    AND p.status IN ('hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite',
                     'menunggu_sk', 'sk_terbit', 'selesai')));

-- Jadwal asesmen
CREATE POLICY "staf baca jadwal" ON jadwal_asesmen FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "pemohon baca jadwal" ON jadwal_asesmen FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "penilai kelola jadwal" ON jadwal_asesmen FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'));

-- Klarifikasi
CREATE POLICY "pemohon ajukan klarifikasi" ON klarifikasi_rpl FOR INSERT TO authenticated
  WITH CHECK (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "pemohon baca klarifikasi" ON klarifikasi_rpl FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf baca klarifikasi" ON klarifikasi_rpl FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "staf tanggapi klarifikasi" ON klarifikasi_rpl FOR UPDATE TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'komite'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'komite'));

-- Persetujuan Komite
CREATE POLICY "staf baca komite" ON persetujuan_komite FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "komite memutuskan" ON persetujuan_komite FOR INSERT TO authenticated
  WITH CHECK (public.punya_peran('admin', 'komite') AND komite_id = auth.uid());

-- Pembayaran
CREATE POLICY "pemohon unggah pembayaran" ON pembayaran_rpl FOR INSERT TO authenticated
  WITH CHECK (public.pengajuan_milik_saya(pengajuan_id) AND status = 'menunggu');
CREATE POLICY "pemohon baca pembayaran" ON pembayaran_rpl FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf baca pembayaran" ON pembayaran_rpl FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "keuangan verifikasi pembayaran" ON pembayaran_rpl FOR UPDATE TO authenticated
  USING (public.punya_peran('admin', 'pmb', 'baak', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'pmb', 'baak', 'sekretaris'));

-- Log aktivitas: dibaca staf (termasuk LPMP), ditulis trigger atau staf atas namanya sendiri.
CREATE POLICY "staf baca log" ON log_aktivitas_rpl FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "pemohon baca log sendiri" ON log_aktivitas_rpl FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf tulis log" ON log_aktivitas_rpl FOR INSERT TO authenticated
  WITH CHECK (public.is_staf_rpl() AND aktor_id = auth.uid());

COMMIT;
