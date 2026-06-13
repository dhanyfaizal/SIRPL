-- Skrip Migrasi: Penambahan Peran Baru (Roles) & Sistem Verifikasi Pengguna Baru

-- 1. Bersihkan / update data lama agar sesuai dengan batasan peran baru
UPDATE profiles SET role = 'calon_rpl' WHERE role = 'calon_mhs';
UPDATE profiles SET role = 'kaprodi_ti' WHERE role = 'kaprodi';

-- 2. Hapus check constraint lama dan pasang check constraint baru untuk roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('calon_rpl', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
);

-- 3. Ubah default is_verified menjadi false agar pengguna SSO baru tidak langsung aktif sebelum diverifikasi Admin
ALTER TABLE profiles ALTER COLUMN is_verified SET DEFAULT false;

-- 4. Tambah Program Studi Baru: Komputerisasi Akuntansi (KA)
INSERT INTO program_studi (kode, nama) VALUES
('KA', 'Komputerisasi Akuntansi')
ON CONFLICT (kode) DO NOTHING;

-- 5. Seed Mata Kuliah Kurikulum untuk KA (Komputerisasi Akuntansi)
DO $$
DECLARE
    ka_id UUID;
BEGIN
    SELECT id INTO ka_id FROM program_studi WHERE kode = 'KA';

    IF ka_id IS NOT NULL THEN
        -- MK Umum
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (ka_id, 'MKU101', 'Pancasila', 2, 'umum'),
        (ka_id, 'MKU102', 'Kewarganegaraan', 2, 'umum')
        ON CONFLICT DO NOTHING;

        -- MK Inti (Komputerisasi Akuntansi)
        INSERT INTO mata_kuliah_kurikulum (prodi_id, kode_mk, nama_mk, sks, jenis) VALUES
        (ka_id, 'MKI501', 'Pengantar Akuntansi & Keuangan', 3, 'inti'),
        (ka_id, 'MKI502', 'Sistem Informasi Akuntansi', 3, 'inti'),
        (ka_id, 'MKI503', 'Perpajakan Terapan', 3, 'inti'),
        (ka_id, 'MKI504', 'Analisis Data Keuangan', 3, 'inti')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
