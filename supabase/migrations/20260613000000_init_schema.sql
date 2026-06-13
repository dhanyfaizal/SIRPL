-- Skema Database SI-RPL (Sistem Informasi Rekognisi Pembelajaran Lampau)
-- Berbasis PostgreSQL / Supabase

-- 1. Tipe Enum Peran
-- (Kita buat tipe atau gunakan check constraint untuk kelenturan)
CREATE TABLE IF NOT EXISTS program_studi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('calon_mhs', 'baak', 'kaprodi', 'asessor', 'admin')),
    is_verified BOOLEAN DEFAULT true,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mata_kuliah_kurikulum (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prodi_id UUID REFERENCES program_studi(id) ON DELETE CASCADE,
    kode_mk VARCHAR(50) NOT NULL,
    nama_mk VARCHAR(255) NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0),
    jenis VARCHAR(50) NOT NULL CHECK (jenis IN ('inti', 'umum')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengajuan_rpl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    prodi_pilihan_id UUID REFERENCES program_studi(id) ON DELETE SET NULL,
    file_ijazah_url TEXT,
    file_transkrip_url TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('submitted', 'validated_baak', 'recognized_kaprodi', 'assessed_asessor', 'mapped_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tabel_rekognisi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pengajuan_id UUID REFERENCES pengajuan_rpl(id) ON DELETE CASCADE UNIQUE,
    data_ekstraksi_ocr JSONB DEFAULT '{}'::jsonb,
    data_mapping_mk JSONB DEFAULT '[]'::jsonb,
    is_manual_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS penetapan_akhir (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pengajuan_id UUID REFERENCES pengajuan_rpl(id) ON DELETE CASCADE UNIQUE,
    total_sks_diakui INTEGER DEFAULT 0,
    total_sks_sisa INTEGER DEFAULT 0,
    biaya_total NUMERIC DEFAULT 0,
    potongan_biaya NUMERIC DEFAULT 0,
    catatan_potongan TEXT DEFAULT '',
    rencana_studi JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Data Awal untuk Program Studi
INSERT INTO program_studi (kode, nama) VALUES
('IF', 'Teknik Informatika'),
('SI', 'Sistem Informasi'),
('DKV', 'Desain Komunikasi Visual')
ON CONFLICT (kode) DO NOTHING;

-- Seed Data Mata Kuliah Kurikulum Informatika
-- Kita butuh ID prodi untuk mengisi. Kita cari prodi 'IF'
DO $$
DECLARE
    if_id UUID;
    si_id UUID;
    dkv_id UUID;
BEGIN
    SELECT id INTO if_id FROM program_studi WHERE kode = 'IF';
    SELECT id INTO si_id FROM program_studi WHERE kode = 'SI';
    SELECT id INTO dkv_id FROM program_studi WHERE kode = 'DKV';

    IF if_id IS NOT NULL THEN
        -- MK Umum (Jalur Asinkron / MOOCs)
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (if_id, 'MKU101', 'Pancasila', 2, 'umum'),
        (if_id, 'MKU102', 'Kewarganegaraan', 2, 'umum'),
        (if_id, 'MKU103', 'Bahasa Indonesia', 2, 'umum'),
        (if_id, 'MKU104', 'Bahasa Inggris Akademik', 2, 'umum'),
        (if_id, 'MKU105', 'Kewirausahaan', 3, 'umum'),
        (if_id, 'MKU106', 'Etika Profesi IT', 2, 'umum');

        -- MK Inti (Jalur Sinkron / Tatap Muka)
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (if_id, 'MKI201', 'Dasar-Dasar Pemrograman', 4, 'inti'),
        (if_id, 'MKI202', 'Struktur Data & Algoritma', 4, 'inti'),
        (if_id, 'MKI203', 'Basis Data Terdistribusi', 3, 'inti'),
        (if_id, 'MKI204', 'Pemrograman Web Enterprise', 4, 'inti'),
        (if_id, 'MKI205', 'Rekayasa Perangkat Lunak', 3, 'inti'),
        (if_id, 'MKI206', 'Kecerdasan Buatan (AI)', 3, 'inti'),
        (if_id, 'MKI207', 'Keamanan Jaringan & Siber', 3, 'inti'),
        (if_id, 'MKI208', 'Sistem Operasi', 3, 'inti');
    END IF;

    IF si_id IS NOT NULL THEN
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (si_id, 'MKU101', 'Pancasila', 2, 'umum'),
        (si_id, 'MKU102', 'Kewarganegaraan', 2, 'umum'),
        (si_id, 'MKI301', 'Pengantar Sistem Informasi', 3, 'inti'),
        (si_id, 'MKI302', 'Analisis & Perancangan Sistem', 3, 'inti'),
        (si_id, 'MKI303', 'E-Business & E-Commerce', 3, 'inti');
    END IF;

    IF dkv_id IS NOT NULL THEN
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (dkv_id, 'MKU101', 'Pancasila', 2, 'umum'),
        (dkv_id, 'MKI401', 'Menggambar Bentuk', 3, 'inti'),
        (dkv_id, 'MKI402', 'Tipografi Dasar', 3, 'inti'),
        (dkv_id, 'MKI403', 'Desain Grafis Digital', 4, 'inti');
    END IF;
END $$;
