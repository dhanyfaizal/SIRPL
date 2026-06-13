-- =========================================================================
-- Migrasi: Konfigurasi Supabase Storage Bucket & RLS Kurikulum
-- Tanggal: 2026-06-13
-- =========================================================================

-- ─── 1. Buat Bucket Private 'rpl-documents' ────────────────────────────
-- Bucket ini digunakan untuk menyimpan file Ijazah & Transkrip calon mahasiswa RPL.
-- Catatan: Jalankan di SQL Editor Supabase (bucket creation via SQL).
INSERT INTO storage.buckets (id, name, public)
VALUES ('rpl-documents', 'rpl-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Kebijakan Storage: Upload File (INSERT) ────────────────────────
-- Calon mahasiswa hanya boleh mengunggah ke subfolder miliknya sendiri: {user_id}/filename
DROP POLICY IF EXISTS "Allow authenticated upload to own folder" ON storage.objects;
CREATE POLICY "Allow authenticated upload to own folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'rpl-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ─── 3. Kebijakan Storage: Download/View File (SELECT) ─────────────────
-- Pemilik file (calon) ATAU staff akademik (BAAK/Kaprodi/Asessor/Admin) boleh mengunduh.
DROP POLICY IF EXISTS "Allow download for owner and staff" ON storage.objects;
CREATE POLICY "Allow download for owner and staff" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'rpl-documents' AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
            )
        )
    );

-- ─── 4. Kebijakan Storage: Update File (UPDATE) ────────────────────────
-- Hanya pemilik file yang boleh menimpa file miliknya.
DROP POLICY IF EXISTS "Allow update own files" ON storage.objects;
CREATE POLICY "Allow update own files" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'rpl-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ─── 5. Kebijakan Storage: Delete File (DELETE) ────────────────────────
-- Hanya admin yang boleh menghapus file.
DROP POLICY IF EXISTS "Allow delete for admin" ON storage.objects;
CREATE POLICY "Allow delete for admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'rpl-documents' AND
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
    );

-- =========================================================================
-- 6. Kebijakan RLS pada tabel 'mata_kuliah_kurikulum'
-- =========================================================================

-- Aktifkan RLS (jika belum aktif karena dinonaktifkan sebelumnya di migrasi opsi A)
ALTER TABLE mata_kuliah_kurikulum ENABLE ROW LEVEL SECURITY;

-- Semua user terautentikasi boleh membaca (SELECT) data kurikulum
DROP POLICY IF EXISTS "Allow select for mata_kuliah_kurikulum" ON mata_kuliah_kurikulum;
CREATE POLICY "Allow select for mata_kuliah_kurikulum" ON mata_kuliah_kurikulum
    FOR SELECT TO authenticated
    USING (true);

-- Admin boleh menambah (INSERT) mata kuliah baru
DROP POLICY IF EXISTS "Allow insert for admin curriculum" ON mata_kuliah_kurikulum;
CREATE POLICY "Allow insert for admin curriculum" ON mata_kuliah_kurikulum
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
    );

-- Admin boleh mengubah (UPDATE) data mata kuliah
DROP POLICY IF EXISTS "Allow update for admin curriculum" ON mata_kuliah_kurikulum;
CREATE POLICY "Allow update for admin curriculum" ON mata_kuliah_kurikulum
    FOR UPDATE TO authenticated
    USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
    );

-- Admin boleh menghapus (DELETE) mata kuliah
DROP POLICY IF EXISTS "Allow delete for admin curriculum" ON mata_kuliah_kurikulum;
CREATE POLICY "Allow delete for admin curriculum" ON mata_kuliah_kurikulum
    FOR DELETE TO authenticated
    USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
    );

-- =========================================================================
-- 7. Aktifkan RLS juga pada tabel program_studi (read-only untuk semua)
-- =========================================================================
ALTER TABLE program_studi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for program_studi" ON program_studi;
CREATE POLICY "Allow select for program_studi" ON program_studi
    FOR SELECT TO authenticated
    USING (true);

-- =========================================================================
-- 8. Pastikan RLS aktif pada tabel lainnya yang pernah di-disable
-- =========================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_rpl ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabel_rekognisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE penetapan_akhir ENABLE ROW LEVEL SECURITY;

-- Pastikan profiles bisa di-SELECT oleh semua authenticated
DROP POLICY IF EXISTS "Allow select for authenticated users" ON profiles;
CREATE POLICY "Allow select for authenticated users" ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- Pastikan profiles bisa di-INSERT oleh user sendiri (registrasi awal)
DROP POLICY IF EXISTS "Allow insert for self registration" ON profiles;
CREATE POLICY "Allow insert for self registration" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Pastikan pengajuan_rpl bisa di-INSERT oleh calon
DROP POLICY IF EXISTS "Allow insert for owner" ON pengajuan_rpl;
CREATE POLICY "Allow insert for owner" ON pengajuan_rpl
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
