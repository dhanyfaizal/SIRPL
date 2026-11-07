-- =========================================================================
-- Migrasi Juknis RPL Tipe A (Kepdirjen Dikti 112/B/KPT/2025)
-- Tanggal : 2026-11-08
-- Acuan   : Spesifikasi Integrasi Juknis RPL Tipe A ke SIRPL (disetujui 7 Nov 2026)
-- Prasyarat: 20261106000000_alur_pedoman_skema.sql dan
--            20261106010000_alur_pedoman_migrasi_data.sql sudah dijalankan.
-- Jalankan di STAGING dulu. Jangan dijalankan di produksi sebelum frontend
-- alur baru siap.
--
-- Sifat file ini: menambah tabel, kolom, fungsi, dan trigger. Tidak ada data
-- yang dihapus. Perubahan pada objek lama:
--   (a) daftar status pengajuan ditambah 'pleno_awal' dan 'penilaian_lanjutan',
--   (b) fungsi batas_sks_rpl kini mengambil nilai terkecil dari batas prodi
--       dan 70% beban SKS (Juknis Bab II.A angka 1),
--   (c) evaluasi_diri.mk_id boleh kosong bila FED dibuat per klaster MK,
--   (d) daftar jenis bukti ditambah jenis yang ada di F03 resmi,
--   (e) fungsi penjaga pengajuan dan penjaga tugas akhir diperbarui.
-- Aman dijalankan ulang.
-- =========================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -------------------------------------------------------------------------
-- 1. Status alur baru
--    Perolehan kredit: asesmen -> pleno_awal -> penilaian_lanjutan -> pleno
--    Transfer kredit : asesmen -> pleno
--    'pleno' kini berarti pleno akhir (atau pleno tunggal transfer kredit).
-- -------------------------------------------------------------------------
ALTER TABLE pengajuan_rpl DROP CONSTRAINT IF EXISTS pengajuan_rpl_status_check;
ALTER TABLE pengajuan_rpl ADD CONSTRAINT pengajuan_rpl_status_check CHECK (status IN (
  'draft', 'diajukan', 'dikembalikan_sekretariat', 'terverifikasi', 'asesmen',
  'menunggu_bukti_tambahan',
  'pleno_awal',            -- perolehan kredit: pleno hasil penilaian portofolio
  'penilaian_lanjutan',    -- perolehan kredit: wawancara (wajib), unjuk kerja, uji tulis
  'pleno',                 -- pleno akhir / pleno tunggal transfer kredit
  'hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite',
  'menunggu_sk', 'sk_terbit', 'selesai', 'tidak_memenuhi_syarat', 'dibatalkan'
));

-- -------------------------------------------------------------------------
-- 2. Periode: semester pelaporan (judul repositori)
-- -------------------------------------------------------------------------
ALTER TABLE periode_rpl
  ADD COLUMN IF NOT EXISTS semester VARCHAR(10) CHECK (semester IN ('ganjil', 'genap'));

-- -------------------------------------------------------------------------
-- 3. Program studi: syarat penyelenggara per mekanisme (Juknis Bab II.B.2)
-- -------------------------------------------------------------------------
ALTER TABLE program_studi
  ADD COLUMN IF NOT EXISTS sudah_ada_lulusan BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS akreditasi_sebelumnya VARCHAR(50),
  ADD COLUMN IF NOT EXISTS file_sk_akreditasi_sebelumnya_url TEXT;

COMMENT ON COLUMN program_studi.sudah_ada_lulusan IS
  'Juknis II.B.2.a.2: sudah menghasilkan lulusan dari mahasiswa berstatus awal peserta didik baru (syarat transfer kredit).';
COMMENT ON COLUMN program_studi.akreditasi_sebelumnya IS
  'Juknis II.B.2.c: peringkat Baik Sekali/B atau Unggul/A pada periode sebelumnya, bila setelah perpanjangan berperingkat "Terakreditasi".';

-- Prodi penyelenggara yang sudah berjalan dianggap sudah meluluskan mahasiswa.
-- Periksa kembali di menu Program Studi.
UPDATE program_studi SET sudah_ada_lulusan = true
WHERE is_penyelenggara_rpl AND NOT sudah_ada_lulusan;

CREATE OR REPLACE FUNCTION public.peringkat_akreditasi_minimal_baik_sekali(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(coalesce(p, ''))) IN ('unggul', 'a', 'baik sekali', 'b')
$$;

CREATE OR REPLACE FUNCTION public.prodi_boleh_transfer(p_prodi uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_penyelenggara_rpl AND menerima_transfer_kredit AND sudah_ada_lulusan
                          AND nullif(trim(akreditasi), '') IS NOT NULL
                          AND lower(trim(akreditasi)) NOT IN ('tidak terakreditasi', 'belum terakreditasi')
                   FROM program_studi WHERE id = p_prodi), false)
$$;

CREATE OR REPLACE FUNCTION public.prodi_boleh_perolehan(p_prodi uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_penyelenggara_rpl AND menerima_perolehan_kredit AND (
                            public.peringkat_akreditasi_minimal_baik_sekali(akreditasi)
                         OR (lower(trim(coalesce(akreditasi, ''))) = 'terakreditasi'
                             AND public.peringkat_akreditasi_minimal_baik_sekali(akreditasi_sebelumnya)
                             AND file_sk_akreditasi_sebelumnya_url IS NOT NULL))
                   FROM program_studi WHERE id = p_prodi), false)
$$;

-- Batas SKS: nilai terkecil dari batas prodi dan 70% beban SKS minimal.
CREATE OR REPLACE FUNCTION public.batas_sks_rpl(p_prodi uuid, p_periode uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT least(
           coalesce(ps.maks_sks_rpl, 2147483647),
           floor(ps.beban_sks_minimal * least(coalesce(pr.batas_rekognisi_persen, 70), 70) / 100)::int)
  FROM program_studi ps
  LEFT JOIN periode_rpl pr ON pr.id = p_periode
  WHERE ps.id = p_prodi
$$;

-- -------------------------------------------------------------------------
-- 4. Mata kuliah: rangkaian tugas akhir, nomor FED, deskripsi (F01 dan F03)
-- -------------------------------------------------------------------------
ALTER TABLE mata_kuliah_kurikulum
  ADD COLUMN IF NOT EXISTS rangkaian_ta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nomor_fed VARCHAR(20),
  ADD COLUMN IF NOT EXISTS deskripsi TEXT;

COMMENT ON COLUMN mata_kuliah_kurikulum.rangkaian_ta IS
  'Juknis II.A angka 3: rangkaian tugas akhir (mis. seminar proposal) tidak dapat direkognisi.';

UPDATE mata_kuliah_kurikulum SET dapat_rpl = false WHERE rangkaian_ta AND dapat_rpl;
ALTER TABLE mata_kuliah_kurikulum DROP CONSTRAINT IF EXISTS mk_rangkaian_ta_tidak_rpl;
ALTER TABLE mata_kuliah_kurikulum ADD CONSTRAINT mk_rangkaian_ta_tidak_rpl
  CHECK (NOT (rangkaian_ta AND dapat_rpl));

-- Klaster MK: FED boleh dibuat per klaster (catatan kaki F03).
CREATE TABLE IF NOT EXISTS klaster_mk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prodi_id UUID NOT NULL REFERENCES program_studi(id) ON DELETE CASCADE,
  nama VARCHAR(255) NOT NULL,
  nomor_fed VARCHAR(20),
  mk_ids UUID[] NOT NULL DEFAULT '{}',
  sub_cpmk JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prodi_id, nama)
);

-- Tugas akhir dan rangkaiannya tidak boleh diakui.
CREATE OR REPLACE FUNCTION public.cek_tugas_akhir_tidak_diakui()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.keputusan = 'diakui'
     AND EXISTS (SELECT 1 FROM mata_kuliah_kurikulum
                 WHERE id = NEW.mk_id AND (is_tugas_akhir OR rangkaian_ta))
     AND NOT EXISTS (SELECT 1 FROM pengajuan_rpl WHERE id = NEW.pengajuan_id
                     AND alur_versi = 1 AND status IN ('mapped_admin', 'selesai')) THEN
    RAISE EXCEPTION 'Tugas akhir dan rangkaiannya tidak dapat direkognisi (Juknis Bab II.A angka 3)';
  END IF;
  RETURN NEW;
END $$;

-- -------------------------------------------------------------------------
-- 5. Biodata pemohon (F02 Bagian 1) dan Daftar Riwayat Hidup (F07)
--    Disimpan per akun; PDF formulir membekukan isinya saat ditandatangani.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS biodata_pemohon (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tempat_lahir VARCHAR(100),
  tanggal_lahir DATE,
  jenis_kelamin VARCHAR(10) CHECK (jenis_kelamin IN ('pria', 'wanita')),
  status_perkawinan VARCHAR(20) CHECK (status_perkawinan IN ('menikah', 'lajang', 'pernah_menikah')),
  agama VARCHAR(30),
  kebangsaan VARCHAR(60) DEFAULT 'Indonesia',
  alamat TEXT,
  kode_pos VARCHAR(10),
  telepon_rumah VARCHAR(30),
  telepon_kantor VARCHAR(30),
  -- Data pendidikan terakhir (F02 Bagian 1.b)
  pendidikan_terakhir VARCHAR(30),
  nama_sekolah_pt VARCHAR(255),
  prodi_pendidikan_terakhir VARCHAR(255),
  tahun_lulus SMALLINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS riwayat_hidup (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  institusi_kerja VARCHAR(255),
  jabatan VARCHAR(255),
  status_pekerjaan VARCHAR(20) CHECK (status_pekerjaan IN
    ('pegawai_tetap', 'pegawai_honorer', 'pns', 'lainnya', 'tidak_bekerja')),
  status_pekerjaan_lainnya VARCHAR(100),
  alamat_kerja TEXT,
  telepon_kerja VARCHAR(30),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Butir tabel F07. Kolom yang dipakai bergantung pada kategori:
--   pendidikan  : nama, tahun, jurusan
--   pelatihan   : tahun, nama (+ uraian materi), penyelenggara, jangka_waktu
--   seminar     : tahun, nama, penyelenggara, peran (panitia/peserta/pembicara)
--   penghargaan : tahun, nama (bentuk), penyelenggara (pemberi)
--   organisasi  : tahun, nama, peran (jabatan/jenjang)
--   pekerjaan   : nama (+ alamat institusi), mulai, selesai, peran (posisi), uraian
CREATE TABLE IF NOT EXISTS riwayat_hidup_butir (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kategori VARCHAR(15) NOT NULL CHECK (kategori IN
    ('pendidikan', 'pelatihan', 'seminar', 'penghargaan', 'organisasi', 'pekerjaan')),
  urutan SMALLINT NOT NULL DEFAULT 0,
  tahun SMALLINT,
  nama TEXT NOT NULL,
  jurusan VARCHAR(255),
  penyelenggara VARCHAR(255),
  jangka_waktu VARCHAR(100),
  peran VARCHAR(255),
  mulai DATE,
  selesai DATE,
  uraian TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS riwayat_hidup_butir_user_idx ON riwayat_hidup_butir (user_id, kategori, urutan);

-- -------------------------------------------------------------------------
-- 6. Pengajuan: PDDikti, NIM, F07 bertanda tangan atasan, status pelaporan
-- -------------------------------------------------------------------------
ALTER TABLE pengajuan_rpl
  ADD COLUMN IF NOT EXISTS pt_asal_stikom BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_f07_ttd_url TEXT,
  ADD COLUMN IF NOT EXISTS nim VARCHAR(20),
  ADD COLUMN IF NOT EXISTS status_pelaporan VARCHAR(25) NOT NULL DEFAULT 'belum' CHECK (status_pelaporan IN
    ('belum', 'dilaporkan_sistem_rpl', 'diverifikasi_lldikti', 'diinput_pddikti')),
  ADD COLUMN IF NOT EXISTS diverifikasi_lldikti_at TIMESTAMPTZ;

COMMENT ON COLUMN pengajuan_rpl.tanggal_mengundurkan_diri IS
  'Tanggal SK keluar/pengunduran diri dari PT asal (Juknis II.A angka 4 dan 5).';
CREATE UNIQUE INDEX IF NOT EXISTS pengajuan_rpl_nim_unik ON pengajuan_rpl (nim) WHERE nim IS NOT NULL;

-- Daftar MK yang diajukan (F02 Bagian 2).
CREATE TABLE IF NOT EXISTS mk_diajukan (
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mk_id UUID NOT NULL REFERENCES mata_kuliah_kurikulum(id) ON DELETE RESTRICT,
  mekanisme VARCHAR(20) NOT NULL CHECK (mekanisme IN ('transfer', 'perolehan')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pengajuan_id, mk_id)
);

CREATE OR REPLACE FUNCTION public.cek_mk_diajukan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mk record; v_p record;
BEGIN
  SELECT * INTO v_mk FROM mata_kuliah_kurikulum WHERE id = NEW.mk_id;
  SELECT * INTO v_p FROM pengajuan_rpl WHERE id = NEW.pengajuan_id;
  IF v_mk.is_tugas_akhir OR v_mk.rangkaian_ta OR NOT coalesce(v_mk.dapat_rpl, false) THEN
    RAISE EXCEPTION 'Mata kuliah % tidak dibuka untuk RPL', v_mk.nama_mk;
  END IF;
  IF v_mk.prodi_id IS DISTINCT FROM v_p.prodi_pilihan_id THEN
    RAISE EXCEPTION 'Mata kuliah % bukan milik program studi yang dipilih', v_mk.nama_mk;
  END IF;
  IF v_p.jenis_rpl IS NOT NULL AND v_p.jenis_rpl <> 'gabungan' AND v_p.jenis_rpl <> NEW.mekanisme THEN
    RAISE EXCEPTION 'Mekanisme % tidak sesuai jenis RPL pengajuan (%)', NEW.mekanisme, v_p.jenis_rpl;
  END IF;
  -- Pemohon hanya boleh mengubah daftar selama draf atau dikembalikan.
  IF auth.uid() IS NOT NULL AND NOT public.is_staf_rpl()
     AND v_p.status NOT IN ('draft', 'dikembalikan_sekretariat') THEN
    RAISE EXCEPTION 'Daftar mata kuliah tidak dapat diubah setelah pengajuan dikirim';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_mk_diajukan ON mk_diajukan;
CREATE TRIGGER trg_cek_mk_diajukan BEFORE INSERT OR UPDATE ON mk_diajukan
  FOR EACH ROW EXECUTE FUNCTION public.cek_mk_diajukan();

CREATE OR REPLACE FUNCTION public.cek_hapus_mk_diajukan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staf_rpl() AND EXISTS (
       SELECT 1 FROM pengajuan_rpl WHERE id = OLD.pengajuan_id
       AND status NOT IN ('draft', 'dikembalikan_sekretariat')) THEN
    RAISE EXCEPTION 'Daftar mata kuliah tidak dapat diubah setelah pengajuan dikirim';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_cek_hapus_mk_diajukan ON mk_diajukan;
CREATE TRIGGER trg_cek_hapus_mk_diajukan BEFORE DELETE ON mk_diajukan
  FOR EACH ROW EXECUTE FUNCTION public.cek_hapus_mk_diajukan();

-- -------------------------------------------------------------------------
-- 7. Evaluasi diri (F03): klaster MK dan pernyataan
--    Kolom asesor (V-A-T-M dan komentar) ada di penilaian_mk.vatm dan .catatan.
-- -------------------------------------------------------------------------
ALTER TABLE evaluasi_diri
  ADD COLUMN IF NOT EXISTS klaster_id UUID REFERENCES klaster_mk(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tempat_pernyataan VARCHAR(100);
ALTER TABLE evaluasi_diri ALTER COLUMN mk_id DROP NOT NULL;
ALTER TABLE evaluasi_diri DROP CONSTRAINT IF EXISTS evaluasi_diri_mk_atau_klaster;
ALTER TABLE evaluasi_diri ADD CONSTRAINT evaluasi_diri_mk_atau_klaster
  CHECK (num_nonnulls(mk_id, klaster_id) = 1);
CREATE UNIQUE INDEX IF NOT EXISTS evaluasi_diri_klaster_unik
  ON evaluasi_diri (pengajuan_id, klaster_id) WHERE klaster_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 8. Bukti portofolio: jenis F03, pengesahan atasan, folder repositori
-- -------------------------------------------------------------------------
ALTER TABLE bukti_portofolio DROP CONSTRAINT IF EXISTS bukti_portofolio_jenis_check;
ALTER TABLE bukti_portofolio ADD CONSTRAINT bukti_portofolio_jenis_check CHECK (jenis IN (
  -- 15 jenis bukti pada F03 resmi
  'ijazah', 'transkrip', 'riwayat_pekerjaan', 'sertifikat_kompetensi', 'lisensi',
  'foto_pekerjaan', 'buku_harian', 'lembar_kerja', 'dokumen_perancangan', 'logbook',
  'catatan_pelatihan', 'keanggotaan_asosiasi', 'surat_referensi', 'penghargaan',
  'penilaian_kinerja', 'lainnya',
  -- jenis tambahan dari alur sebelumnya (tetap diterima)
  'surat_keterangan_lulus_mk', 'silabus_rps', 'surat_keterangan_kerja', 'sertifikat_pelatihan',
  'dokumentasi_pekerjaan', 'portofolio_proyek', 'tautan_repositori'));

ALTER TABLE bukti_portofolio
  ADD COLUMN IF NOT EXISTS mekanisme VARCHAR(20) CHECK (mekanisme IN ('transfer', 'perolehan')),
  ADD COLUMN IF NOT EXISTS kategori_folder VARCHAR(25) NOT NULL DEFAULT 'dokumen_pendukung' CHECK (kategori_folder IN
    ('dokumen_pendukung', 'penilaian', 'pleno_awal', 'penilaian_lanjutan', 'pleno_akhir', 'sanggahan')),
  ADD COLUMN IF NOT EXISTS ukuran_byte BIGINT;

-- Bukti bertanda * pada daftar bukti Juknis wajib disahkan atasan.
ALTER TABLE bukti_portofolio DROP CONSTRAINT IF EXISTS bukti_wajib_disahkan;
ALTER TABLE bukti_portofolio ADD CONSTRAINT bukti_wajib_disahkan CHECK (
  jenis NOT IN ('foto_pekerjaan', 'dokumentasi_pekerjaan', 'buku_harian', 'lembar_kerja',
                'dokumen_perancangan', 'logbook', 'penilaian_kinerja')
  OR disahkan_atasan) NOT VALID;

-- Pemohon mengubah bukti hanya selama draf/dikembalikan. Saat asesor meminta
-- bukti tambahan atau saat sanggahan, pemohon hanya boleh MENAMBAH bukti,
-- yang otomatis ditandai sebagai bukti tambahan.
CREATE OR REPLACE FUNCTION public.jaga_bukti_pemohon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_pengajuan uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_staf_rpl() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_pengajuan := CASE WHEN TG_OP = 'DELETE' THEN OLD.pengajuan_id ELSE NEW.pengajuan_id END;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = v_pengajuan;
  IF v_status IN ('draft', 'dikembalikan_sekretariat') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' AND v_status IN ('menunggu_bukti_tambahan', 'klarifikasi') THEN
    NEW.is_bukti_tambahan := true;
    IF NEW.kategori_folder = 'dokumen_pendukung' THEN
      NEW.kategori_folder := CASE WHEN v_status = 'klarifikasi' THEN 'sanggahan' ELSE 'penilaian_lanjutan' END;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Bukti tidak dapat diubah pada tahap ini';
END $$;
DROP TRIGGER IF EXISTS trg_jaga_bukti_pemohon ON bukti_portofolio;
CREATE TRIGGER trg_jaga_bukti_pemohon BEFORE INSERT OR UPDATE OR DELETE ON bukti_portofolio
  FOR EACH ROW EXECUTE FUNCTION public.jaga_bukti_pemohon();

-- F03 hanya dapat diubah pemohon selama draf/dikembalikan.
CREATE OR REPLACE FUNCTION public.jaga_evaluasi_diri_pemohon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pengajuan uuid;
BEGIN
  v_pengajuan := CASE WHEN TG_OP = 'DELETE' THEN OLD.pengajuan_id ELSE NEW.pengajuan_id END;
  IF auth.uid() IS NOT NULL AND NOT public.is_staf_rpl() AND EXISTS (
       SELECT 1 FROM pengajuan_rpl WHERE id = v_pengajuan AND status NOT IN ('draft', 'dikembalikan_sekretariat')) THEN
    RAISE EXCEPTION 'Formulir Evaluasi Diri tidak dapat diubah setelah pengajuan dikirim';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_evaluasi_diri_pemohon ON evaluasi_diri;
CREATE TRIGGER trg_jaga_evaluasi_diri_pemohon BEFORE INSERT OR UPDATE OR DELETE ON evaluasi_diri
  FOR EACH ROW EXECUTE FUNCTION public.jaga_evaluasi_diri_pemohon();

CREATE OR REPLACE FUNCTION public.nomor_jenis_bukti_f03(p_jenis text)
RETURNS smallint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_jenis
    WHEN 'ijazah' THEN 1 WHEN 'transkrip' THEN 1 WHEN 'surat_keterangan_lulus_mk' THEN 1
    WHEN 'riwayat_pekerjaan' THEN 2 WHEN 'surat_keterangan_kerja' THEN 2
    WHEN 'sertifikat_kompetensi' THEN 3 WHEN 'lisensi' THEN 4
    WHEN 'foto_pekerjaan' THEN 5 WHEN 'dokumentasi_pekerjaan' THEN 5 WHEN 'portofolio_proyek' THEN 5
    WHEN 'buku_harian' THEN 6 WHEN 'lembar_kerja' THEN 7 WHEN 'dokumen_perancangan' THEN 8
    WHEN 'logbook' THEN 9 WHEN 'catatan_pelatihan' THEN 10 WHEN 'sertifikat_pelatihan' THEN 10
    WHEN 'keanggotaan_asosiasi' THEN 11 WHEN 'surat_referensi' THEN 12 WHEN 'penghargaan' THEN 13
    WHEN 'penilaian_kinerja' THEN 14 ELSE 15 END::smallint
$$;

-- -------------------------------------------------------------------------
-- 9. Penilaian (F03 sisi asesor dan F09 konversi MK)
-- -------------------------------------------------------------------------
ALTER TABLE penilaian_mk
  ADD COLUMN IF NOT EXISTS rujukan_bukti INTEGER[] NOT NULL DEFAULT '{}',   -- nomor bukti (mis. silabus/RPS)
  ADD COLUMN IF NOT EXISTS tahap VARCHAR(20) NOT NULL DEFAULT 'awal' CHECK (tahap IN ('awal', 'akhir'));

-- Cek keaslian ijazah dan transkrip di PDDikti (Juknis II.D.2.b angka 1), bagian dari F09.
CREATE TABLE IF NOT EXISTS verifikasi_pddikti (
  pengajuan_id UUID PRIMARY KEY REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  ijazah_sesuai BOOLEAN,
  transkrip_sesuai BOOLEAN,
  status_mahasiswa_pddikti VARCHAR(50),
  tautan_bukti TEXT,
  catatan TEXT,
  diperiksa_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  diperiksa_at TIMESTAMPTZ DEFAULT NOW()
);

-- V-A-T-M wajib lengkap sebelum MK perolehan kredit diputuskan.
CREATE OR REPLACE FUNCTION public.cek_vatm_lengkap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_jumlah_sub int; v_lengkap int;
BEGIN
  IF auth.uid() IS NULL OR NEW.mekanisme <> 'perolehan'
     OR NEW.keputusan NOT IN ('diakui', 'tidak_diakui')
     OR EXISTS (SELECT 1 FROM pengajuan_rpl WHERE id = NEW.pengajuan_id AND alur_versi = 1) THEN
    RETURN NEW;
  END IF;
  SELECT greatest(jsonb_array_length(coalesce(sub_cpmk, '[]'::jsonb)), 1) INTO v_jumlah_sub
  FROM mata_kuliah_kurikulum WHERE id = NEW.mk_id;
  SELECT count(*) INTO v_lengkap
  FROM jsonb_array_elements(coalesce(NEW.vatm, '[]'::jsonb)) e
  WHERE jsonb_typeof(e->'valid') = 'boolean' AND jsonb_typeof(e->'autentik') = 'boolean'
    AND jsonb_typeof(e->'terkini') = 'boolean' AND jsonb_typeof(e->'memadai') = 'boolean';
  IF v_lengkap < v_jumlah_sub THEN
    RAISE EXCEPTION 'Penilaian V-A-T-M belum lengkap (% dari % butir)', v_lengkap, v_jumlah_sub;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_vatm ON penilaian_mk;
CREATE TRIGGER trg_cek_vatm BEFORE INSERT OR UPDATE ON penilaian_mk
  FOR EACH ROW EXECUTE FUNCTION public.cek_vatm_lengkap();

-- -------------------------------------------------------------------------
-- 10. Jadwal asesmen: wawancara lewat tautan Meet, kehadiran
-- -------------------------------------------------------------------------
ALTER TABLE jadwal_asesmen
  ADD COLUMN IF NOT EXISTS tautan_undangan TEXT,
  ADD COLUMN IF NOT EXISTS ruangan VARCHAR(255),
  ADD COLUMN IF NOT EXISTS asesor_lain UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tahap VARCHAR(20) NOT NULL DEFAULT 'penilaian_lanjutan'
    CHECK (tahap IN ('penilaian_awal', 'penilaian_lanjutan', 'klarifikasi')),
  ADD COLUMN IF NOT EXISTS konfirmasi_hadir_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS durasi_menit SMALLINT DEFAULT 60 CHECK (durasi_menit > 0),
  ADD COLUMN IF NOT EXISTS catatan_kehadiran TEXT;

ALTER TABLE jadwal_asesmen DROP CONSTRAINT IF EXISTS jadwal_asesmen_status_check;
ALTER TABLE jadwal_asesmen ADD CONSTRAINT jadwal_asesmen_status_check CHECK (status IN
  ('dijadwalkan', 'selesai', 'tidak_hadir', 'dijadwalkan_ulang', 'dibatalkan'));
ALTER TABLE jadwal_asesmen DROP CONSTRAINT IF EXISTS jadwal_asesmen_tautan_check;
ALTER TABLE jadwal_asesmen ADD CONSTRAINT jadwal_asesmen_tautan_check CHECK (
  tautan_undangan IS NULL OR tautan_undangan ~* '^https://');
ALTER TABLE jadwal_asesmen DROP CONSTRAINT IF EXISTS jadwal_asesmen_moda_check;
ALTER TABLE jadwal_asesmen ADD CONSTRAINT jadwal_asesmen_moda_check CHECK (
  status <> 'dijadwalkan'
  OR (mode = 'daring' AND coalesce(tautan_undangan, tempat_atau_tautan) IS NOT NULL)
  OR (mode = 'luring' AND coalesce(ruangan, tempat_atau_tautan) IS NOT NULL)) NOT VALID;

-- Pemohon hanya boleh mengisi konfirmasi hadir pada jadwalnya sendiri.
CREATE OR REPLACE FUNCTION public.konfirmasi_hadir(p_jadwal uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE jadwal_asesmen j SET konfirmasi_hadir_at = NOW()
  WHERE j.id = p_jadwal AND j.status = 'dijadwalkan' AND public.pengajuan_milik_saya(j.pengajuan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Jadwal tidak ditemukan atau sudah lewat'; END IF;
END $$;

-- -------------------------------------------------------------------------
-- 11. Penilaian lanjutan (F10)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penilaian_lanjutan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jadwal_id UUID NOT NULL REFERENCES jadwal_asesmen(id) ON DELETE CASCADE,
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mk_id UUID NOT NULL REFERENCES mata_kuliah_kurikulum(id) ON DELETE RESTRICT,
  -- [{ "sub_cpmk": "Sub-CPMK-1", "pertanyaan": "...", "ringkasan_jawaban": "...",
  --    "hasil": "memenuhi|belum_memenuhi" }]
  butir JSONB NOT NULL DEFAULT '[]'::jsonb,
  hasil VARCHAR(20) CHECK (hasil IN ('memenuhi', 'belum_memenuhi')),
  perlu_bukti_tambahan BOOLEAN NOT NULL DEFAULT false,
  bukti_tambahan_diminta TEXT,
  catatan TEXT,
  asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (jadwal_id, mk_id)
);
DROP TRIGGER IF EXISTS trg_penilaian_lanjutan_updated_at ON penilaian_lanjutan;
CREATE TRIGGER trg_penilaian_lanjutan_updated_at BEFORE UPDATE ON penilaian_lanjutan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 12. Pleno awal / akhir dan pesertanya (F11)
-- -------------------------------------------------------------------------
ALTER TABLE pleno_rpl
  ADD COLUMN IF NOT EXISTS jenis VARCHAR(10) NOT NULL DEFAULT 'akhir' CHECK (jenis IN ('awal', 'akhir')),
  ADD COLUMN IF NOT EXISTS prodi_id UUID REFERENCES program_studi(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tempat VARCHAR(255);

CREATE TABLE IF NOT EXISTS peserta_pleno (
  pleno_id UUID NOT NULL REFERENCES pleno_rpl(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jabatan_dalam_pleno VARCHAR(100) NOT NULL DEFAULT 'Anggota',
  urutan SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (pleno_id, profile_id)
);

CREATE TABLE IF NOT EXISTS pleno_pengajuan (
  pleno_id UUID NOT NULL REFERENCES pleno_rpl(id) ON DELETE CASCADE,
  pengajuan_id UUID NOT NULL REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  mekanisme VARCHAR(20) NOT NULL CHECK (mekanisme IN ('transfer', 'perolehan')),
  keputusan TEXT,
  PRIMARY KEY (pleno_id, pengajuan_id, mekanisme)
);

-- -------------------------------------------------------------------------
-- 13. Sanggahan (F12) memakai klarifikasi_rpl
-- -------------------------------------------------------------------------
ALTER TABLE klarifikasi_rpl
  ADD COLUMN IF NOT EXISTS butir JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ "mk_id": "...", "alasan": "..." }]
  ADD COLUMN IF NOT EXISTS bukti_nomor INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keputusan VARCHAR(15) CHECK (keputusan IN ('diterima', 'diterima_sebagian', 'ditolak'));

-- -------------------------------------------------------------------------
-- 14. Biodata asesor (F04 akademisi, F05 praktisi)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS biodata_asesor (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('akademisi', 'praktisi')),
  jenis_kelamin VARCHAR(10) CHECK (jenis_kelamin IN ('pria', 'wanita')),
  tempat_lahir VARCHAR(100),
  tanggal_lahir DATE,
  no_hp VARCHAR(30),
  telepon_fax VARCHAR(30),
  alamat_rumah TEXT,
  pendidikan_terakhir VARCHAR(30),
  bidang_keilmuan VARCHAR(255),
  -- F04
  pangkat_golongan VARCHAR(50),
  jabatan_fungsional VARCHAR(50),
  nip_nidn VARCHAR(30),
  nama_pt VARCHAR(255),
  alamat_pt TEXT,
  -- F04 dan F05
  asosiasi_nama VARCHAR(255),
  asosiasi_nomor VARCHAR(100),
  -- F05
  asosiasi_jabatan VARCHAR(100),
  asosiasi_alamat TEXT,
  pekerjaan VARCHAR(255),
  instansi VARCHAR(255),
  jabatan VARCHAR(255),
  bidang_keahlian TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 15. Mesin dokumen: jenis, penomoran, dokumen terbit, tanda tangan, QR
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jenis_dokumen (
  kode VARCHAR(20) PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kategori_folder VARCHAR(25) CHECK (kategori_folder IN
    ('dokumen_pendukung', 'penilaian', 'pleno_awal', 'penilaian_lanjutan', 'pleno_akhir', 'sanggahan')),
  bernomor BOOLEAN NOT NULL DEFAULT false,
  urutan SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO jenis_dokumen (kode, nama, kategori_folder, bernomor, urutan) VALUES
  ('F01', 'Petunjuk untuk Pemohon RPL Tipe A', NULL, false, 1),
  ('F02', 'Formulir Aplikasi RPL Tipe A', 'dokumen_pendukung', false, 2),
  ('F03', 'Formulir Evaluasi Diri', 'penilaian', false, 3),
  ('F04', 'Biodata Asesor Akademisi', NULL, false, 4),
  ('F05', 'Biodata Asesor Praktisi/Profesi', NULL, false, 5),
  ('F07', 'Daftar Riwayat Hidup Pemohon', 'dokumen_pendukung', false, 7),
  ('F08', 'SK Ketua tentang Hasil Asesmen RPL Tipe A', 'pleno_akhir', true, 8),
  ('F09', 'Formulir Konversi Mata Kuliah', 'penilaian', false, 9),
  ('F10', 'Lembar Penilaian Lanjutan', 'penilaian_lanjutan', false, 10),
  ('F11', 'Berita Acara Pleno Hasil Rekognisi', 'pleno_akhir', true, 11),
  ('F12', 'Berkas Sanggahan dan Tanggapan', 'sanggahan', false, 12),
  ('SURAT_HASIL', 'Surat Hasil Rekognisi', 'pleno_akhir', true, 13)
ON CONFLICT (kode) DO NOTHING;

-- Penandatangan bawaan per jenis dokumen (dapat diubah admin).
--   sumber = 'peran'            : akun dengan peran tertentu (kolom peran)
--            'peserta_pleno'    : seluruh peserta pleno
--            'pemohon'          : pemilik pengajuan
--            'asesor_ditugaskan': asesor yang ditugaskan pada pengajuan
CREATE TABLE IF NOT EXISTS penandatangan_dokumen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis_kode VARCHAR(20) NOT NULL REFERENCES jenis_dokumen(kode) ON DELETE CASCADE,
  urutan SMALLINT NOT NULL DEFAULT 1,
  sumber VARCHAR(20) NOT NULL CHECK (sumber IN ('peran', 'peserta_pleno', 'pemohon', 'asesor_ditugaskan')),
  peran VARCHAR(50),
  label_jabatan VARCHAR(255),
  UNIQUE (jenis_kode, urutan),
  CHECK (sumber <> 'peran' OR peran IS NOT NULL)
);

INSERT INTO penandatangan_dokumen (jenis_kode, urutan, sumber, peran, label_jabatan) VALUES
  ('F02', 1, 'pemohon', NULL, 'Pemohon'),
  ('F03', 1, 'pemohon', NULL, 'Calon Peserta'),
  ('F03', 2, 'asesor_ditugaskan', NULL, 'Asesor'),
  ('F04', 1, 'asesor_ditugaskan', NULL, 'Asesor Akademisi'),
  ('F05', 1, 'asesor_ditugaskan', NULL, 'Asesor Praktisi'),
  ('F07', 1, 'pemohon', NULL, 'Yang Menyatakan'),
  ('F08', 1, 'peran', 'eksekutif', 'Ketua STIKOM Yos Sudarso'),
  ('F09', 1, 'asesor_ditugaskan', NULL, 'Asesor'),
  ('F10', 1, 'asesor_ditugaskan', NULL, 'Asesor'),
  ('F11', 1, 'peserta_pleno', NULL, NULL),
  ('F12', 1, 'pemohon', NULL, 'Pemohon'),
  ('F12', 2, 'peran', 'ketua_tim', 'Ketua Tim Pengelola RPL'),
  ('SURAT_HASIL', 1, 'peran', 'ketua_tim', 'Ketua Tim Pengelola RPL')
ON CONFLICT (jenis_kode, urutan) DO NOTHING;

-- Penomoran: format dan nomor awal diisi admin sekali; berikutnya otomatis.
-- Penanda format: {no} {no:3} (nol di depan) {bulan} {bulan_romawi} {tahun} {kode_prodi}
CREATE TABLE IF NOT EXISTS penomoran_dokumen (
  jenis_kode VARCHAR(20) PRIMARY KEY REFERENCES jenis_dokumen(kode) ON DELETE CASCADE,
  format TEXT,
  nomor_terakhir INTEGER NOT NULL DEFAULT 0 CHECK (nomor_terakhir >= 0),
  tahun_berjalan SMALLINT,
  reset_tahunan BOOLEAN NOT NULL DEFAULT true,
  sudah_diatur BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO penomoran_dokumen (jenis_kode)
  SELECT kode FROM jenis_dokumen WHERE bernomor
ON CONFLICT (jenis_kode) DO NOTHING;

CREATE OR REPLACE FUNCTION public.angka_romawi(n int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[n]
$$;

CREATE OR REPLACE FUNCTION public.format_nomor_dokumen(p_format text, p_no int, p_tanggal date, p_kode_prodi text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text := p_format; m text[];
BEGIN
  FOR m IN SELECT regexp_matches(p_format, '\{no:(\d+)\}', 'g') LOOP
    v := replace(v, '{no:' || m[1] || '}', lpad(p_no::text, m[1]::int, '0'));
  END LOOP;
  v := replace(v, '{no}', p_no::text);
  v := replace(v, '{bulan_romawi}', public.angka_romawi(extract(month FROM p_tanggal)::int));
  v := replace(v, '{bulan}', lpad(extract(month FROM p_tanggal)::text, 2, '0'));
  v := replace(v, '{tahun}', extract(year FROM p_tanggal)::text);
  v := replace(v, '{kode_prodi}', coalesce(p_kode_prodi, ''));
  RETURN v;
END $$;

-- Mengambil p_jumlah nomor berurutan dalam satu transaksi (baris dikunci),
-- sehingga penerbitan batch tidak menghasilkan nomor ganda.
CREATE OR REPLACE FUNCTION public.ambil_nomor_dokumen(
  p_jenis text, p_jumlah int DEFAULT 1, p_tanggal date DEFAULT CURRENT_DATE, p_kode_prodi text DEFAULT NULL)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r penomoran_dokumen; v_awal int; v_tahun smallint := extract(year FROM p_tanggal)::smallint;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'eksekutif') THEN
    RAISE EXCEPTION 'Tidak berwenang menerbitkan nomor dokumen';
  END IF;
  IF p_jumlah < 1 OR p_jumlah > 500 THEN RAISE EXCEPTION 'Jumlah nomor tidak valid'; END IF;
  SELECT * INTO r FROM penomoran_dokumen WHERE jenis_kode = p_jenis FOR UPDATE;
  IF NOT FOUND OR NOT r.sudah_diatur OR r.format IS NULL THEN
    RAISE EXCEPTION 'Penomoran % belum diatur. Isi format dan nomor awal di menu Pengaturan Dokumen.', p_jenis;
  END IF;
  IF r.reset_tahunan AND r.tahun_berjalan IS NOT NULL AND r.tahun_berjalan <> v_tahun THEN
    r.nomor_terakhir := 0;
  END IF;
  v_awal := r.nomor_terakhir + 1;
  UPDATE penomoran_dokumen
     SET nomor_terakhir = r.nomor_terakhir + p_jumlah, tahun_berjalan = v_tahun, updated_at = NOW()
   WHERE jenis_kode = p_jenis;
  RETURN QUERY SELECT public.format_nomor_dokumen(r.format, g, p_tanggal, p_kode_prodi)
               FROM generate_series(v_awal, v_awal + p_jumlah - 1) g;
END $$;

-- Kode verifikasi acak 12 karakter tanpa huruf yang mirip (0/O, 1/I/L).
CREATE OR REPLACE FUNCTION public.kode_verifikasi_baru()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE abjad text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(12); hasil text := '';
BEGIN
  FOR i IN 0..11 LOOP
    hasil := hasil || substr(abjad, (get_byte(b, i) % length(abjad)) + 1, 1);
  END LOOP;
  RETURN hasil;
END $$;

CREATE TABLE IF NOT EXISTS dokumen_terbit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis_kode VARCHAR(20) NOT NULL REFERENCES jenis_dokumen(kode),
  nomor VARCHAR(150),
  tanggal_dokumen DATE NOT NULL DEFAULT CURRENT_DATE,
  judul VARCHAR(255) NOT NULL,
  -- Pemilik dokumen: satu pengajuan, atau satu pleno (F11), atau satu SK (F08)
  pengajuan_id UUID REFERENCES pengajuan_rpl(id) ON DELETE CASCADE,
  pleno_id UUID REFERENCES pleno_rpl(id) ON DELETE CASCADE,
  sk_id UUID REFERENCES sk_rekognisi(id) ON DELETE CASCADE,
  jadwal_id UUID REFERENCES jadwal_asesmen(id) ON DELETE SET NULL,
  klarifikasi_id UUID REFERENCES klarifikasi_rpl(id) ON DELETE SET NULL,
  asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,     -- F04/F05
  periode_id UUID REFERENCES periode_rpl(id) ON DELETE SET NULL,
  prodi_id UUID REFERENCES program_studi(id) ON DELETE SET NULL,
  mekanisme VARCHAR(20) CHECK (mekanisme IN ('transfer', 'perolehan')),   -- NULL = berlaku keduanya
  kategori_folder VARCHAR(25) CHECK (kategori_folder IN
    ('dokumen_pendukung', 'penilaian', 'pleno_awal', 'penilaian_lanjutan', 'pleno_akhir', 'sanggahan')),
  file_path TEXT,               -- path di Storage, tanpa domain (siap migrasi self-hosted)
  ukuran_byte BIGINT,
  sha256 CHAR(64),
  isi_snapshot JSONB,           -- data formulir saat diterbitkan
  status VARCHAR(20) NOT NULL DEFAULT 'menunggu_ttd' CHECK (status IN ('draf', 'menunggu_ttd', 'final', 'dicabut')),
  dicabut_at TIMESTAMPTZ,
  alasan_cabut TEXT,
  menggantikan_id UUID REFERENCES dokumen_terbit(id) ON DELETE SET NULL,
  dibuat_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  final_at TIMESTAMPTZ,
  CHECK (status <> 'final' OR (file_path IS NOT NULL AND sha256 IS NOT NULL)),
  CHECK (status <> 'dicabut' OR alasan_cabut IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS dokumen_terbit_nomor_unik ON dokumen_terbit (jenis_kode, nomor) WHERE nomor IS NOT NULL;
CREATE INDEX IF NOT EXISTS dokumen_terbit_pengajuan_idx ON dokumen_terbit (pengajuan_id);
CREATE INDEX IF NOT EXISTS dokumen_terbit_pleno_idx ON dokumen_terbit (pleno_id);
CREATE INDEX IF NOT EXISTS dokumen_terbit_sk_idx ON dokumen_terbit (sk_id);

CREATE TABLE IF NOT EXISTS tanda_tangan_dokumen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dokumen_id UUID NOT NULL REFERENCES dokumen_terbit(id) ON DELETE CASCADE,
  penandatangan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  nama_snapshot VARCHAR(255) NOT NULL,
  jabatan_snapshot VARCHAR(255),
  urutan SMALLINT NOT NULL DEFAULT 1,
  kode_verifikasi CHAR(12) NOT NULL UNIQUE DEFAULT public.kode_verifikasi_baru(),
  status VARCHAR(15) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'ditandatangani', 'ditolak')),
  ditandatangani_at TIMESTAMPTZ,
  catatan_tolak TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dokumen_id, penandatangan_id)
);
CREATE INDEX IF NOT EXISTS ttd_penandatangan_idx ON tanda_tangan_dokumen (penandatangan_id, status);

-- Menandatangani: hanya penandatangan yang bersangkutan, dokumen belum final.
-- Konfirmasi kata sandi dilakukan di aplikasi (reautentikasi) sebelum memanggil fungsi ini.
CREATE OR REPLACE FUNCTION public.tandatangani_dokumen(p_ttd uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tanda_tangan_dokumen; v_sisa int;
BEGIN
  SELECT * INTO r FROM tanda_tangan_dokumen WHERE id = p_ttd FOR UPDATE;
  IF NOT FOUND OR r.penandatangan_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Tanda tangan ini bukan milik Anda';
  END IF;
  IF r.status <> 'menunggu' THEN RAISE EXCEPTION 'Dokumen ini sudah Anda tanggapi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM dokumen_terbit WHERE id = r.dokumen_id AND status = 'menunggu_ttd') THEN
    RAISE EXCEPTION 'Dokumen tidak dalam status menunggu tanda tangan';
  END IF;
  UPDATE tanda_tangan_dokumen SET status = 'ditandatangani', ditandatangani_at = NOW() WHERE id = p_ttd;
  SELECT count(*) INTO v_sisa FROM tanda_tangan_dokumen WHERE dokumen_id = r.dokumen_id AND status <> 'ditandatangani';
  RETURN jsonb_build_object('dokumen_id', r.dokumen_id, 'kode_verifikasi', r.kode_verifikasi,
                            'semua_sudah', v_sisa = 0);
END $$;

-- Finalisasi setelah semua tanda tangan masuk dan PDF ber-QR diunggah.
CREATE OR REPLACE FUNCTION public.finalisasi_dokumen(p_dokumen uuid, p_file_path text, p_sha256 text, p_ukuran bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_staf_rpl() OR EXISTS (
       SELECT 1 FROM dokumen_terbit d WHERE d.id = p_dokumen AND public.pengajuan_milik_saya(d.pengajuan_id))) THEN
    RAISE EXCEPTION 'Tidak berwenang';
  END IF;
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Sidik SHA-256 tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM tanda_tangan_dokumen WHERE dokumen_id = p_dokumen AND status <> 'ditandatangani') THEN
    RAISE EXCEPTION 'Masih ada penandatangan yang belum menandatangani';
  END IF;
  UPDATE dokumen_terbit SET status = 'final', file_path = p_file_path, sha256 = p_sha256,
         ukuran_byte = p_ukuran, final_at = NOW()
   WHERE id = p_dokumen AND status = 'menunggu_ttd';
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak dalam status menunggu tanda tangan'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cabut_dokumen(p_dokumen uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.punya_peran('admin', 'ketua_tim', 'eksekutif') THEN
    RAISE EXCEPTION 'Tidak berwenang mencabut dokumen';
  END IF;
  IF nullif(trim(p_alasan), '') IS NULL THEN RAISE EXCEPTION 'Alasan pencabutan wajib diisi'; END IF;
  UPDATE dokumen_terbit SET status = 'dicabut', dicabut_at = NOW(), alasan_cabut = p_alasan
   WHERE id = p_dokumen AND status <> 'dicabut';
END $$;

-- Halaman verifikasi publik: hanya informasi yang aman ditampilkan.
CREATE OR REPLACE FUNCTION public.verifikasi_dokumen(p_kode text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'status', CASE WHEN d.status = 'dicabut' THEN 'dicabut'
                   WHEN d.status = 'final' THEN 'sah'
                   ELSE 'belum_final' END,
    'jenis_kode', d.jenis_kode,
    'jenis_dokumen', j.nama,
    'judul', d.judul,
    'nomor', d.nomor,
    'tanggal_dokumen', d.tanggal_dokumen,
    'pemilik', (SELECT pr.nama_lengkap FROM pengajuan_rpl p JOIN profiles pr ON pr.id = p.user_id
                WHERE p.id = d.pengajuan_id),
    'program_studi', (SELECT ps.nama FROM program_studi ps WHERE ps.id = d.prodi_id),
    'penandatangan', t.nama_snapshot,
    'jabatan', t.jabatan_snapshot,
    'ditandatangani_at', t.ditandatangani_at,
    'semua_penandatangan', (SELECT jsonb_agg(jsonb_build_object('nama', x.nama_snapshot, 'jabatan', x.jabatan_snapshot,
                                   'status', x.status, 'waktu', x.ditandatangani_at) ORDER BY x.urutan)
                            FROM tanda_tangan_dokumen x WHERE x.dokumen_id = d.id),
    'sha256', d.sha256,
    'dicabut_at', d.dicabut_at,
    'alasan_cabut', d.alasan_cabut)
  FROM tanda_tangan_dokumen t
  JOIN dokumen_terbit d ON d.id = t.dokumen_id
  JOIN jenis_dokumen j ON j.kode = d.jenis_kode
  WHERE t.kode_verifikasi = upper(trim(p_kode)) AND t.status = 'ditandatangani'
$$;

-- -------------------------------------------------------------------------
-- 16. Syarat pengajuan dari Juknis (dipakai trigger dan dapat dipanggil
--     aplikasi untuk menampilkan daftar periksa sebelum mengirim)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cek_syarat_pengajuan(p_pengajuan uuid)
RETURNS TABLE (kode text, pesan text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_buka date; v_ada_transfer boolean; v_ada_perolehan boolean;
BEGIN
  SELECT * INTO p FROM pengajuan_rpl WHERE id = p_pengajuan;
  IF NOT FOUND THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND p.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_staf_rpl() THEN
    RAISE EXCEPTION 'Tidak berwenang';
  END IF;

  v_ada_transfer  := p.jenis_rpl IN ('transfer', 'gabungan');
  v_ada_perolehan := p.jenis_rpl IN ('perolehan', 'gabungan');
  SELECT coalesce(pr.tanggal_buka, CURRENT_DATE) INTO v_buka FROM periode_rpl pr WHERE pr.id = p.periode_id;
  v_buka := coalesce(v_buka, CURRENT_DATE);

  IF p.jenis_rpl IS NULL THEN
    kode := 'jenis_rpl'; pesan := 'Pilih jenis RPL: transfer kredit, perolehan kredit, atau gabungan.'; RETURN NEXT;
  END IF;
  IF p.prodi_pilihan_id IS NULL THEN
    kode := 'prodi'; pesan := 'Pilih program studi tujuan.'; RETURN NEXT;
  END IF;
  IF v_ada_transfer AND NOT public.prodi_boleh_transfer(p.prodi_pilihan_id) THEN
    kode := 'prodi_transfer'; pesan := 'Program studi ini belum memenuhi syarat penyelenggara transfer kredit (Juknis II.B.2.a).'; RETURN NEXT;
  END IF;
  IF v_ada_perolehan AND NOT public.prodi_boleh_perolehan(p.prodi_pilihan_id) THEN
    kode := 'prodi_perolehan'; pesan := 'Perolehan kredit hanya untuk prodi terakreditasi minimal Baik Sekali/B (Juknis II.B.2.b).'; RETURN NEXT;
  END IF;

  -- Status keluar di PDDikti (Juknis II.A angka 4 dan 5)
  IF p.pt_asal_stikom AND p.status_pddikti_asal IN ('putus_studi', 'dikeluarkan') THEN
    kode := 'pddikti_pt_asal'; pesan := 'Pendaftar berstatus putus studi atau dikeluarkan hanya dapat melanjutkan melalui RPL di perguruan tinggi lain.'; RETURN NEXT;
  END IF;
  IF p.pt_asal_stikom AND p.status_pddikti_asal = 'mengundurkan_diri' AND (
       p.tanggal_mengundurkan_diri IS NULL OR p.tanggal_mengundurkan_diri > (v_buka - INTERVAL '1 year')::date) THEN
    kode := 'pddikti_satu_tahun'; pesan := 'Pendaftar yang mengundurkan diri dapat kembali ke STIKOM paling cepat 1 tahun akademik setelah SK pengunduran diri.'; RETURN NEXT;
  END IF;
  IF v_ada_transfer AND (p.pt_asal IS NULL OR p.status_pddikti_asal IS NULL) THEN
    kode := 'data_pt_asal'; pesan := 'Lengkapi perguruan tinggi asal dan status di PDDikti.'; RETURN NEXT;
  END IF;

  -- Berkas wajib
  IF v_ada_transfer AND (p.file_transkrip_url IS NULL) THEN
    kode := 'berkas_transkrip'; pesan := 'Unggah transkrip nilai dari perguruan tinggi asal.'; RETURN NEXT;
  END IF;
  IF v_ada_perolehan AND p.file_ijazah_sma_url IS NULL THEN
    kode := 'berkas_ijazah_slta'; pesan := 'Unggah ijazah SMA/SMK/MA atau sederajat (Juknis II.C angka 2).'; RETURN NEXT;
  END IF;

  -- F02 dan F07
  IF NOT EXISTS (SELECT 1 FROM biodata_pemohon b WHERE b.user_id = p.user_id
                 AND b.tempat_lahir IS NOT NULL AND b.tanggal_lahir IS NOT NULL AND b.alamat IS NOT NULL) THEN
    kode := 'f02_biodata'; pesan := 'Lengkapi data pribadi pada Formulir Aplikasi (F02).'; RETURN NEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM riwayat_hidup r WHERE r.user_id = p.user_id) THEN
    kode := 'f07'; pesan := 'Isi Daftar Riwayat Hidup (F07).'; RETURN NEXT;
  ELSIF EXISTS (SELECT 1 FROM riwayat_hidup r WHERE r.user_id = p.user_id AND r.status_pekerjaan = 'pegawai_tetap')
        AND p.file_f07_ttd_url IS NULL THEN
    kode := 'f07_atasan'; pesan := 'Unggah F07 yang sudah ditandatangani atasan langsung.'; RETURN NEXT;
  END IF;

  -- Daftar MK yang diajukan
  IF NOT EXISTS (SELECT 1 FROM mk_diajukan WHERE pengajuan_id = p.id) THEN
    kode := 'mk_kosong'; pesan := 'Pilih minimal satu mata kuliah yang diajukan.'; RETURN NEXT;
  END IF;

  -- F03 untuk setiap MK perolehan kredit
  IF EXISTS (
    SELECT 1 FROM mk_diajukan md
    WHERE md.pengajuan_id = p.id AND md.mekanisme = 'perolehan'
      AND NOT EXISTS (
        SELECT 1 FROM evaluasi_diri e
        WHERE e.pengajuan_id = p.id AND e.pernyataan_setuju
          AND (e.mk_id = md.mk_id OR EXISTS (SELECT 1 FROM klaster_mk k WHERE k.id = e.klaster_id AND md.mk_id = ANY (k.mk_ids)))
          AND jsonb_array_length(e.butir) > 0
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.butir) x WHERE coalesce(x->>'profisiensi', '') = '')
      )) THEN
    kode := 'f03'; pesan := 'Lengkapi Formulir Evaluasi Diri (F03) dan pernyataannya untuk setiap mata kuliah perolehan kredit.'; RETURN NEXT;
  END IF;
END $$;

-- Wawancara wajib untuk setiap MK perolehan kredit sebelum pleno akhir.
CREATE OR REPLACE FUNCTION public.mk_perolehan_tanpa_wawancara(p_pengajuan uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md.mk_id FROM mk_diajukan md
  WHERE md.pengajuan_id = p_pengajuan AND md.mekanisme = 'perolehan'
    AND NOT EXISTS (SELECT 1 FROM jadwal_asesmen j
                    WHERE j.pengajuan_id = p_pengajuan AND j.jenis = 'wawancara'
                      AND j.status = 'selesai' AND md.mk_id = ANY (j.mk_ids))
$$;

CREATE OR REPLACE FUNCTION public.cek_tahap_pengajuan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pesan text; v_jumlah int;
BEGIN
  IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.alur_versi = 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'diajukan' THEN
    SELECT string_agg(s.pesan, ' ') INTO v_pesan FROM public.cek_syarat_pengajuan(NEW.id) s;
    IF v_pesan IS NOT NULL THEN
      RAISE EXCEPTION 'Pengajuan belum dapat dikirim: %', v_pesan;
    END IF;
    NEW.submitted_at := coalesce(NEW.submitted_at, NOW());
  END IF;

  IF NEW.status = 'pleno_awal' AND NEW.jenis_rpl NOT IN ('perolehan', 'gabungan') THEN
    RAISE EXCEPTION 'Pleno awal hanya untuk perolehan kredit';
  END IF;
  IF NEW.status = 'penilaian_lanjutan' AND OLD.status NOT IN ('pleno_awal', 'penilaian_lanjutan', 'klarifikasi', 'menunggu_bukti_tambahan') THEN
    RAISE EXCEPTION 'Penilaian lanjutan dimulai setelah pleno awal';
  END IF;
  IF NEW.status = 'pleno' AND NEW.jenis_rpl IN ('perolehan', 'gabungan') THEN
    SELECT count(*) INTO v_jumlah FROM public.mk_perolehan_tanpa_wawancara(NEW.id);
    IF v_jumlah > 0 THEN
      RAISE EXCEPTION 'Masih ada % mata kuliah perolehan kredit yang belum diwawancarai', v_jumlah;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cek_tahap_pengajuan ON pengajuan_rpl;
CREATE TRIGGER trg_cek_tahap_pengajuan BEFORE UPDATE OF status ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.cek_tahap_pengajuan();

-- Batas rekognisi juga diperiksa saat pleno akhir.
CREATE OR REPLACE FUNCTION public.cek_batas_rekognisi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_batas int;
BEGIN
  IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('pleno', 'hasil_disampaikan', 'menunggu_komite', 'menunggu_sk', 'sk_terbit') THEN
    RETURN NEW;
  END IF;
  v_total := public.total_sks_diakui(NEW.id);
  v_batas := public.batas_sks_rpl(NEW.prodi_pilihan_id, NEW.periode_id);
  IF v_batas IS NOT NULL AND v_total > v_batas THEN
    RAISE EXCEPTION 'SKS diakui (%) melebihi batas rekognisi program studi (% SKS)', v_total, v_batas;
  END IF;
  RETURN NEW;
END $$;

-- -------------------------------------------------------------------------
-- 17. Penjaga pengajuan diperbarui: kolom baru yang hanya boleh diubah tim
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jaga_pengajuan_pemohon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staf_rpl() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft') THEN NEW.status := 'draft'; END IF;
    NEW.alur_versi := 2;
    NEW.pleno_id := NULL; NEW.sk_id := NULL; NEW.nim := NULL;
    NEW.hasil_disampaikan_at := NULL; NEW.disetujui_pemohon_at := NULL;
    NEW.dilaporkan_sistem_rpl_at := NULL; NEW.dilaporkan_pddikti_at := NULL;
    NEW.status_pelaporan := 'belum'; NEW.diverifikasi_lldikti_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.nomor_pendaftaran IS DISTINCT FROM OLD.nomor_pendaftaran
     OR NEW.alur_versi IS DISTINCT FROM OLD.alur_versi
     OR NEW.pleno_id IS DISTINCT FROM OLD.pleno_id
     OR NEW.sk_id IS DISTINCT FROM OLD.sk_id
     OR NEW.nim IS DISTINCT FROM OLD.nim
     OR NEW.konsultan_id IS DISTINCT FROM OLD.konsultan_id
     OR NEW.hasil_disampaikan_at IS DISTINCT FROM OLD.hasil_disampaikan_at
     OR NEW.dilaporkan_sistem_rpl_at IS DISTINCT FROM OLD.dilaporkan_sistem_rpl_at
     OR NEW.dilaporkan_pddikti_at IS DISTINCT FROM OLD.dilaporkan_pddikti_at
     OR NEW.status_pelaporan IS DISTINCT FROM OLD.status_pelaporan
     OR NEW.diverifikasi_lldikti_at IS DISTINCT FROM OLD.diverifikasi_lldikti_at
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    RAISE EXCEPTION 'Kolom ini hanya dapat diubah oleh Tim Pengelola RPL';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status IN ('draft', 'dikembalikan_sekretariat') AND NEW.status = 'diajukan')
    OR (OLD.status = 'menunggu_bukti_tambahan'            AND NEW.status IN ('asesmen', 'penilaian_lanjutan'))
    OR (OLD.status = 'hasil_disampaikan'                  AND NEW.status IN ('klarifikasi', 'menunggu_komite'))
    OR (OLD.status IN ('draft', 'diajukan', 'dikembalikan_sekretariat') AND NEW.status = 'dibatalkan')
  ) THEN
    RAISE EXCEPTION 'Pemohon tidak dapat mengubah status dari % ke %', OLD.status, NEW.status;
  END IF;

  IF OLD.status NOT IN ('draft', 'dikembalikan_sekretariat') AND (
       NEW.prodi_pilihan_id IS DISTINCT FROM OLD.prodi_pilihan_id
    OR NEW.jenis_rpl IS DISTINCT FROM OLD.jenis_rpl
    OR NEW.pt_asal IS DISTINCT FROM OLD.pt_asal
    OR NEW.pt_asal_stikom IS DISTINCT FROM OLD.pt_asal_stikom
    OR NEW.status_pddikti_asal IS DISTINCT FROM OLD.status_pddikti_asal
    OR NEW.tanggal_mengundurkan_diri IS DISTINCT FROM OLD.tanggal_mengundurkan_diri
    OR NEW.file_ijazah_url IS DISTINCT FROM OLD.file_ijazah_url
    OR NEW.file_transkrip_url IS DISTINCT FROM OLD.file_transkrip_url
    OR NEW.file_ijazah_sma_url IS DISTINCT FROM OLD.file_ijazah_sma_url
    OR NEW.file_transkrip_sma_url IS DISTINCT FROM OLD.file_transkrip_sma_url
    OR NEW.file_f07_ttd_url IS DISTINCT FROM OLD.file_f07_ttd_url) THEN
    RAISE EXCEPTION 'Berkas tidak dapat diubah setelah pengajuan dikirim';
  END IF;

  IF NEW.status = 'menunggu_komite' AND OLD.status = 'hasil_disampaikan' THEN
    NEW.disetujui_pemohon_at := NOW();
  END IF;
  RETURN NEW;
END $$;

-- -------------------------------------------------------------------------
-- 18. Repositori pelaporan
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nama_folder(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(BOTH '_' FROM upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]+', '_', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.nama_subfolder(p_mekanisme text, p_kategori text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_mekanisme = 'transfer' THEN
    CASE p_kategori
      WHEN 'dokumen_pendukung'  THEN '01_DOKUMEN_PENDUKUNG'
      WHEN 'penilaian'          THEN '02_PENILAIAN'
      WHEN 'penilaian_lanjutan' THEN '02_PENILAIAN'
      WHEN 'pleno_awal'         THEN '03_PLENO'
      WHEN 'pleno_akhir'        THEN '03_PLENO'
      WHEN 'sanggahan'          THEN '04_SANGGAHAN' END
  ELSE
    CASE p_kategori
      WHEN 'dokumen_pendukung'  THEN '01_DOKUMEN_PENDUKUNG'
      WHEN 'penilaian'          THEN '02_PENILAIAN_AWAL'
      WHEN 'pleno_awal'         THEN '03_PLENO_AWAL'
      WHEN 'penilaian_lanjutan' THEN '04_PENILAIAN_LANJUTAN'
      WHEN 'pleno_akhir'        THEN '05_PLENO_AKHIR'
      WHEN 'sanggahan'          THEN '06_SANGGAHAN' END
  END
$$;

-- Siapa boleh membuka repositori untuk satu pengajuan (pengguna login).
CREATE OR REPLACE FUNCTION public.boleh_lihat_repositori(p_pengajuan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.punya_peran('admin', 'eksekutif', 'baak', 'ketua_tim', 'sekretaris', 'komite', 'lpmp',
                            'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka')
      OR (public.punya_peran('asessor') AND EXISTS (
            SELECT 1 FROM penugasan_asesor pa WHERE pa.pengajuan_id = p_pengajuan AND pa.asesor_id = auth.uid()))
$$;

-- Daftar seluruh berkas, sudah dipetakan ke struktur folder pelaporan.
-- Pemohon gabungan muncul di dua folder mekanisme. Dokumen tanpa mekanisme
-- (F02, F07, ijazah, SK) muncul di keduanya.
CREATE OR REPLACE VIEW public.v_berkas_repositori AS
WITH pg AS (
  SELECT p.id AS pengajuan_id, p.user_id, p.periode_id, p.prodi_pilihan_id AS prodi_id, p.status,
         p.nim, p.nomor_pendaftaran, pr.nama_lengkap,
         m.mekanisme,
         p.file_ijazah_url, p.file_transkrip_url, p.file_ijazah_sma_url, p.file_transkrip_sma_url, p.file_f07_ttd_url
  FROM pengajuan_rpl p
  JOIN profiles pr ON pr.id = p.user_id
  CROSS JOIN LATERAL (VALUES ('transfer'), ('perolehan')) m(mekanisme)
  WHERE p.alur_versi = 2
    AND ((m.mekanisme = 'transfer' AND p.jenis_rpl IN ('transfer', 'gabungan'))
      OR (m.mekanisme = 'perolehan' AND p.jenis_rpl IN ('perolehan', 'gabungan')))
),
berkas AS (
  -- Berkas utama pengajuan
  SELECT pg.*, 'dokumen_pendukung'::text AS kategori, b.nama, b.path, 'pengajuan'::text AS sumber, NULL::uuid AS sumber_id
  FROM pg CROSS JOIN LATERAL (VALUES
    ('Ijazah perguruan tinggi asal', CASE WHEN pg.mekanisme = 'transfer' THEN pg.file_ijazah_url END),
    ('Transkrip nilai asal',        CASE WHEN pg.mekanisme = 'transfer' THEN pg.file_transkrip_url END),
    ('Ijazah SLTA',                 pg.file_ijazah_sma_url),
    ('Transkrip SLTA',              pg.file_transkrip_sma_url),
    ('F07 bertanda tangan atasan',  pg.file_f07_ttd_url)) b(nama, path)
  WHERE b.path IS NOT NULL
  UNION ALL
  -- Bukti portofolio
  SELECT pg.*, bp.kategori_folder, 'Bukti ' || bp.nomor || ' - ' || bp.nama_dokumen, bp.file_url, 'bukti', bp.id
  FROM pg JOIN bukti_portofolio bp ON bp.pengajuan_id = pg.pengajuan_id
  WHERE bp.file_url IS NOT NULL AND (bp.mekanisme IS NULL OR bp.mekanisme = pg.mekanisme)
  UNION ALL
  -- Dokumen terbit milik pengajuan
  SELECT pg.*, coalesce(d.kategori_folder, j.kategori_folder), d.jenis_kode || ' ' || d.judul, d.file_path, 'dokumen', d.id
  FROM pg JOIN dokumen_terbit d ON d.pengajuan_id = pg.pengajuan_id
  JOIN jenis_dokumen j ON j.kode = d.jenis_kode
  WHERE d.status = 'final' AND (d.mekanisme IS NULL OR d.mekanisme = pg.mekanisme)
  UNION ALL
  -- Berita acara pleno (satu dokumen untuk banyak pemohon)
  SELECT pg.*, CASE WHEN pl.jenis = 'awal' THEN 'pleno_awal' ELSE 'pleno_akhir' END,
         d.jenis_kode || ' ' || d.judul, d.file_path, 'dokumen', d.id
  FROM pg JOIN pleno_pengajuan pp ON pp.pengajuan_id = pg.pengajuan_id AND pp.mekanisme = pg.mekanisme
  JOIN pleno_rpl pl ON pl.id = pp.pleno_id
  JOIN dokumen_terbit d ON d.pleno_id = pl.id AND d.pengajuan_id IS NULL
  WHERE d.status = 'final'
  UNION ALL
  -- SK Ketua (satu dokumen untuk banyak pemohon)
  SELECT pg.*, 'pleno_akhir', d.jenis_kode || ' ' || d.judul, d.file_path, 'dokumen', d.id
  FROM pg JOIN pengajuan_rpl p ON p.id = pg.pengajuan_id
  JOIN dokumen_terbit d ON d.sk_id = p.sk_id AND d.pengajuan_id IS NULL
  WHERE d.status = 'final'
)
SELECT
  b.pengajuan_id, b.periode_id, b.prodi_id, b.mekanisme, b.kategori, b.sumber, b.sumber_id,
  b.status IN ('sk_terbit', 'selesai') AS sudah_sk,
  'Pelaporan RPL Semester ' || pr.nama || coalesce(' ' || initcap(pr.semester), '') AS folder_semester,
  public.nama_folder(ps.nama) AS folder_prodi,
  CASE b.mekanisme WHEN 'transfer' THEN '01_TRANSFER_KREDIT' ELSE '02_PEROLEHAN_KREDIT' END AS folder_mekanisme,
  public.nama_folder(coalesce(b.nim, b.nomor_pendaftaran) || '_' || b.nama_lengkap) AS folder_mahasiswa,
  public.nama_subfolder(b.mekanisme, b.kategori) AS subfolder,
  b.nama AS nama_berkas,
  b.path AS storage_path
FROM berkas b
LEFT JOIN periode_rpl pr ON pr.id = b.periode_id
LEFT JOIN program_studi ps ON ps.id = b.prodi_id
WHERE auth.uid() IS NULL OR public.boleh_lihat_repositori(b.pengajuan_id);

COMMENT ON VIEW public.v_berkas_repositori IS
  'Repositori pelaporan RPL. Pengguna login melihat sesuai peran; tautan berbagi dilayani Edge Function (service role) dengan filter cakupan dan sudah_sk.';

-- Tautan berbagi untuk LLDikti dan asesor eksternal.
CREATE TABLE IF NOT EXISTS tautan_berbagi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token CHAR(43) NOT NULL UNIQUE DEFAULT
    translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_'),
  nama VARCHAR(255) NOT NULL,                     -- mis. "LLDikti Wilayah XII - Semester Ganjil 2026/2027"
  periode_id UUID REFERENCES periode_rpl(id) ON DELETE CASCADE,
  prodi_ids UUID[] NOT NULL DEFAULT '{}',          -- kosong = semua prodi
  mekanisme VARCHAR(20) CHECK (mekanisme IN ('transfer', 'perolehan')),   -- NULL = keduanya
  pengajuan_ids UUID[] NOT NULL DEFAULT '{}',      -- kosong = semua pada cakupan (asesor eksternal: diisi)
  kedaluwarsa_at TIMESTAMPTZ,                      -- NULL = tanpa batas
  kata_sandi_hash TEXT,                            -- NULL = tautan terbuka
  dicabut_at TIMESTAMPTZ,
  dibuat_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_akses_repositori (
  id BIGSERIAL PRIMARY KEY,
  tautan_id UUID REFERENCES tautan_berbagi(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aksi VARCHAR(15) NOT NULL CHECK (aksi IN ('buka', 'lihat', 'unduh', 'unduh_zip', 'sandi_salah')),
  path TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS log_akses_repositori_tautan_idx ON log_akses_repositori (tautan_id, created_at);

-- Membuat tautan; kata sandi di-hash dengan bcrypt.
CREATE OR REPLACE FUNCTION public.buat_tautan_berbagi(
  p_nama text, p_periode uuid, p_prodi_ids uuid[] DEFAULT '{}', p_mekanisme text DEFAULT NULL,
  p_pengajuan_ids uuid[] DEFAULT '{}', p_kedaluwarsa timestamptz DEFAULT NULL, p_kata_sandi text DEFAULT NULL)
RETURNS tautan_berbagi LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r tautan_berbagi;
BEGIN
  IF NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya admin yang dapat membuat tautan berbagi'; END IF;
  IF p_kedaluwarsa IS NOT NULL AND p_kedaluwarsa <= NOW() THEN RAISE EXCEPTION 'Tanggal kedaluwarsa harus di masa depan'; END IF;
  IF p_kata_sandi IS NOT NULL AND length(p_kata_sandi) < 8 THEN RAISE EXCEPTION 'Kata sandi minimal 8 karakter'; END IF;
  INSERT INTO tautan_berbagi (nama, periode_id, prodi_ids, mekanisme, pengajuan_ids, kedaluwarsa_at, kata_sandi_hash, dibuat_oleh)
  VALUES (p_nama, p_periode, coalesce(p_prodi_ids, '{}'), p_mekanisme, coalesce(p_pengajuan_ids, '{}'), p_kedaluwarsa,
          CASE WHEN p_kata_sandi IS NOT NULL THEN extensions.crypt(p_kata_sandi, extensions.gen_salt('bf', 10)) END,
          auth.uid())
  RETURNING * INTO r;
  RETURN r;
END $$;

-- Dipanggil Edge Function sebelum menampilkan isi tautan.
CREATE OR REPLACE FUNCTION public.periksa_tautan_berbagi(p_token text, p_kata_sandi text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r tautan_berbagi;
BEGIN
  SELECT * INTO r FROM tautan_berbagi WHERE token = p_token;
  IF NOT FOUND OR r.dicabut_at IS NOT NULL OR (r.kedaluwarsa_at IS NOT NULL AND r.kedaluwarsa_at <= NOW()) THEN
    RETURN jsonb_build_object('valid', false, 'alasan', 'tidak_berlaku');
  END IF;
  IF r.kata_sandi_hash IS NOT NULL THEN
    IF p_kata_sandi IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'alasan', 'perlu_sandi', 'nama', r.nama);
    END IF;
    IF extensions.crypt(p_kata_sandi, r.kata_sandi_hash) <> r.kata_sandi_hash THEN
      INSERT INTO log_akses_repositori (tautan_id, aksi) VALUES (r.id, 'sandi_salah');
      RETURN jsonb_build_object('valid', false, 'alasan', 'sandi_salah', 'nama', r.nama);
    END IF;
  END IF;
  RETURN jsonb_build_object('valid', true, 'id', r.id, 'nama', r.nama, 'periode_id', r.periode_id,
    'prodi_ids', to_jsonb(r.prodi_ids), 'mekanisme', r.mekanisme,
    'pengajuan_ids', to_jsonb(r.pengajuan_ids), 'kedaluwarsa_at', r.kedaluwarsa_at);
END $$;

-- Ringkasan pemakaian penyimpanan (admin).
CREATE OR REPLACE FUNCTION public.ringkasan_penyimpanan()
RETURNS TABLE (bucket text, jumlah_file bigint, total_byte numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  RETURN QUERY
    SELECT o.bucket_id::text, count(*), coalesce(sum((o.metadata->>'size')::numeric), 0)
    FROM storage.objects o GROUP BY o.bucket_id ORDER BY 1;
END $$;

-- -------------------------------------------------------------------------
-- 19. updated_at untuk tabel baru
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_biodata_pemohon_updated_at ON biodata_pemohon;
CREATE TRIGGER trg_biodata_pemohon_updated_at BEFORE UPDATE ON biodata_pemohon
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_riwayat_hidup_updated_at ON riwayat_hidup;
CREATE TRIGGER trg_riwayat_hidup_updated_at BEFORE UPDATE ON riwayat_hidup
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_biodata_asesor_updated_at ON biodata_asesor;
CREATE TRIGGER trg_biodata_asesor_updated_at BEFORE UPDATE ON biodata_asesor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 20. RLS tabel baru
-- -------------------------------------------------------------------------
ALTER TABLE klaster_mk             ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodata_pemohon        ENABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat_hidup          ENABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat_hidup_butir    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mk_diajukan            ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifikasi_pddikti     ENABLE ROW LEVEL SECURITY;
ALTER TABLE penilaian_lanjutan     ENABLE ROW LEVEL SECURITY;
ALTER TABLE peserta_pleno          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pleno_pengajuan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodata_asesor         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jenis_dokumen          ENABLE ROW LEVEL SECURITY;
ALTER TABLE penandatangan_dokumen  ENABLE ROW LEVEL SECURITY;
ALTER TABLE penomoran_dokumen      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumen_terbit         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanda_tangan_dokumen   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tautan_berbagi         ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_akses_repositori   ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama dulu agar file aman dijalankan ulang.
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['klaster_mk', 'biodata_pemohon', 'riwayat_hidup', 'riwayat_hidup_butir', 'mk_diajukan',
    'verifikasi_pddikti', 'penilaian_lanjutan', 'peserta_pleno', 'pleno_pengajuan', 'biodata_asesor',
    'jenis_dokumen', 'penandatangan_dokumen', 'penomoran_dokumen', 'dokumen_terbit', 'tanda_tangan_dokumen',
    'tautan_berbagi', 'log_akses_repositori'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Klaster MK: publik dibaca (bagian F01), dikelola admin/Koordinator Prodi.
CREATE POLICY "baca klaster" ON klaster_mk FOR SELECT USING (true);
CREATE POLICY "kelola klaster" ON klaster_mk FOR ALL TO authenticated
  USING (public.punya_peran('admin') OR EXISTS (SELECT 1 FROM program_studi ps WHERE ps.id = klaster_mk.prodi_id
         AND ps.kode = public.kode_prodi_peran(public.peran_saya())))
  WITH CHECK (public.punya_peran('admin') OR EXISTS (SELECT 1 FROM program_studi ps WHERE ps.id = klaster_mk.prodi_id
         AND ps.kode = public.kode_prodi_peran(public.peran_saya())));

-- Biodata dan riwayat hidup: milik pemohon, dibaca staf.
CREATE POLICY "pemilik kelola biodata" ON biodata_pemohon FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staf baca biodata" ON biodata_pemohon FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "pemilik kelola riwayat" ON riwayat_hidup FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staf baca riwayat" ON riwayat_hidup FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "pemilik kelola butir riwayat" ON riwayat_hidup_butir FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staf baca butir riwayat" ON riwayat_hidup_butir FOR SELECT TO authenticated USING (public.is_staf_rpl());

-- MK diajukan: pemohon mengelola (dibatasi trigger), staf membaca, tim/kaprodi menyesuaikan.
CREATE POLICY "pemohon kelola mk diajukan" ON mk_diajukan FOR ALL TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id)) WITH CHECK (public.pengajuan_milik_saya(pengajuan_id));
CREATE POLICY "staf baca mk diajukan" ON mk_diajukan FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "tim kelola mk diajukan" ON mk_diajukan FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka'));

-- Verifikasi PDDikti dan penilaian lanjutan: penilai.
CREATE POLICY "staf baca verifikasi pddikti" ON verifikasi_pddikti FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "penilai kelola verifikasi pddikti" ON verifikasi_pddikti FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'));
CREATE POLICY "staf baca penilaian lanjutan" ON penilaian_lanjutan FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "penilai kelola penilaian lanjutan" ON penilaian_lanjutan FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor'));
CREATE POLICY "pemohon baca hasil lanjutan" ON penilaian_lanjutan FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pengajuan_rpl p WHERE p.id = penilaian_lanjutan.pengajuan_id
    AND p.user_id = auth.uid() AND p.status IN ('hasil_disampaikan', 'klarifikasi', 'menunggu_komite',
        'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai')));

-- Pleno
CREATE POLICY "staf baca peserta pleno" ON peserta_pleno FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "kelola peserta pleno" ON peserta_pleno FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));
CREATE POLICY "staf baca pleno pengajuan" ON pleno_pengajuan FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "kelola pleno pengajuan" ON pleno_pengajuan FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim', 'sekretaris'))
  WITH CHECK (public.punya_peran('admin', 'ketua_tim', 'sekretaris'));

-- Biodata asesor: asesor mengelola miliknya, staf membaca, admin/ketua tim mengelola.
CREATE POLICY "asesor kelola biodata" ON biodata_asesor FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "staf baca biodata asesor" ON biodata_asesor FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "tim kelola biodata asesor" ON biodata_asesor FOR ALL TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim')) WITH CHECK (public.punya_peran('admin', 'ketua_tim'));

-- Pengaturan dokumen: dibaca semua pengguna login, dikelola admin.
CREATE POLICY "baca jenis dokumen" ON jenis_dokumen FOR SELECT USING (true);
CREATE POLICY "admin kelola jenis dokumen" ON jenis_dokumen FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));
CREATE POLICY "staf baca penandatangan" ON penandatangan_dokumen FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "admin kelola penandatangan" ON penandatangan_dokumen FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));
CREATE POLICY "staf baca penomoran" ON penomoran_dokumen FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "admin atur penomoran" ON penomoran_dokumen FOR UPDATE TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));

-- Dokumen terbit: staf membaca; pemohon membaca dokumen miliknya; dibuat tim/asesor/pemohon
-- untuk formulirnya sendiri. Status final hanya lewat finalisasi_dokumen().
CREATE POLICY "staf baca dokumen" ON dokumen_terbit FOR SELECT TO authenticated USING (public.is_staf_rpl());
CREATE POLICY "pemohon baca dokumen" ON dokumen_terbit FOR SELECT TO authenticated
  USING (public.pengajuan_milik_saya(pengajuan_id)
      OR (sk_id IS NOT NULL AND EXISTS (SELECT 1 FROM pengajuan_rpl p WHERE p.sk_id = dokumen_terbit.sk_id AND p.user_id = auth.uid())));
CREATE POLICY "buat dokumen" ON dokumen_terbit FOR INSERT TO authenticated
  WITH CHECK (status IN ('draf', 'menunggu_ttd') AND dibuat_oleh = auth.uid() AND (
       public.punya_peran('admin', 'ketua_tim', 'sekretaris', 'eksekutif', 'asessor',
                          'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka')
    OR (public.pengajuan_milik_saya(pengajuan_id) AND jenis_kode IN ('F02', 'F03', 'F07', 'F12'))));

-- Tanda tangan: penandatangan dan staf membaca; pemohon membaca tanda tangan dokumennya.
CREATE POLICY "penandatangan baca ttd" ON tanda_tangan_dokumen FOR SELECT TO authenticated
  USING (penandatangan_id = auth.uid() OR public.is_staf_rpl() OR EXISTS (
    SELECT 1 FROM dokumen_terbit d WHERE d.id = tanda_tangan_dokumen.dokumen_id AND public.pengajuan_milik_saya(d.pengajuan_id)));
CREATE POLICY "pembuat dokumen tambah ttd" ON tanda_tangan_dokumen FOR INSERT TO authenticated
  WITH CHECK (status = 'menunggu' AND EXISTS (
    SELECT 1 FROM dokumen_terbit d WHERE d.id = tanda_tangan_dokumen.dokumen_id
      AND d.dibuat_oleh = auth.uid() AND d.status IN ('draf', 'menunggu_ttd')));

-- Tautan berbagi dan log: admin.
CREATE POLICY "admin baca tautan" ON tautan_berbagi FOR SELECT TO authenticated USING (public.punya_peran('admin'));
CREATE POLICY "admin cabut tautan" ON tautan_berbagi FOR UPDATE TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));
CREATE POLICY "admin baca log akses" ON log_akses_repositori FOR SELECT TO authenticated
  USING (public.punya_peran('admin', 'lpmp'));
CREATE POLICY "pengguna catat akses" ON log_akses_repositori FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tautan_id IS NULL AND aksi IN ('buka', 'lihat', 'unduh', 'unduh_zip'));

-- -------------------------------------------------------------------------
-- 21. Hak eksekusi fungsi
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.verifikasi_dokumen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifikasi_dokumen(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.periksa_tautan_berbagi(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ambil_nomor_dokumen(text, int, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buat_tautan_berbagi(text, uuid, uuid[], text, uuid[], timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ringkasan_penyimpanan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tandatangani_dokumen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalisasi_dokumen(uuid, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cabut_dokumen(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.konfirmasi_hadir(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cek_syarat_pengajuan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ambil_nomor_dokumen(text, int, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buat_tautan_berbagi(text, uuid, uuid[], text, uuid[], timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ringkasan_penyimpanan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tandatangani_dokumen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalisasi_dokumen(uuid, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cabut_dokumen(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.konfirmasi_hadir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cek_syarat_pengajuan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.periksa_tautan_berbagi(text, text) TO service_role;

-- View repositori: hanya pengguna login (filter peran ada di dalam view).
REVOKE ALL ON public.v_berkas_repositori FROM anon;
GRANT SELECT ON public.v_berkas_repositori TO authenticated, service_role;

COMMIT;
