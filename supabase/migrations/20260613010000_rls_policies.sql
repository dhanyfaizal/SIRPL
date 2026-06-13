-- Pilihlah salah satu dari dua opsi di bawah ini untuk dijalankan di SQL Editor Supabase Anda.

-- =========================================================================
-- OPSI A: [DIREKOMENDASIKAN UNTUK PENGEMBANGAN CEPAT / MENGATASI ERROR 403]
-- MENONAKTIFKAN RLS (Row Level Security) UNTUK SEMUA TABEL
-- =========================================================================
-- Jika Anda tidak memerlukan aturan keamanan ketat di level Supabase REST API sekarang 
-- dan ingin aplikasi bekerja persis seperti simulasi Mock DB (tanpa masalah perizinan):

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE program_studi DISABLE ROW LEVEL SECURITY;
ALTER TABLE mata_kuliah_kurikulum DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_rpl DISABLE ROW LEVEL SECURITY;
ALTER TABLE tabel_rekognisi DISABLE ROW LEVEL SECURITY;
ALTER TABLE penetapan_akhir DISABLE ROW LEVEL SECURITY;


-- =========================================================================
-- OPSI B: [DIREKOMENDASIKAN UNTUK PRODUKSI]
-- MENYETEL KEBIJAKAN (POLICIES) SECARA AMAN DAN MENGAKTIFKAN RLS
-- =========================================================================
-- Jika Anda ingin RLS tetap aktif dan aman, jalankan perintah di bawah ini.
-- Ini akan mengatur izin SELECT, INSERT, dan UPDATE agar tidak mengalami error 403.

/*
-- 1. Aktifkan RLS pada seluruh tabel
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_studi ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_kuliah_kurikulum ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_rpl ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabel_rekognisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE penetapan_akhir ENABLE ROW LEVEL SECURITY;

-- 2. Kebijakan untuk tabel 'profiles'
-- Mengizinkan pembacaan profile oleh semua user terautentikasi (untuk pencarian Ka. Prodi/Asessor/Admin)
CREATE POLICY "Allow select for authenticated users" ON profiles
    FOR SELECT TO authenticated USING (true);

-- Mengizinkan registrasi awal (insert) oleh diri sendiri
CREATE POLICY "Allow insert for self registration" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Mengizinkan update profile sendiri
CREATE POLICY "Allow update for self profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. Kebijakan untuk tabel 'program_studi' (Semua orang boleh melihat prodi)
CREATE POLICY "Allow select for program_studi" ON program_studi
    FOR SELECT USING (true);

-- 4. Kebijakan untuk tabel 'mata_kuliah_kurikulum' (Semua orang boleh melihat mata kuliah)
CREATE POLICY "Allow select for mata_kuliah_kurikulum" ON mata_kuliah_kurikulum
    FOR SELECT USING (true);

-- 5. Kebijakan untuk tabel 'pengajuan_rpl'
-- Calon Mhs hanya bisa melihat miliknya. Staf (baak/kaprodi/asessor/admin) bisa melihat semuanya.
CREATE POLICY "Allow select for owner and staff" ON pengajuan_rpl
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );

-- Calon Mhs bisa mendaftarkan pengajuannya sendiri
CREATE POLICY "Allow insert for owner" ON pengajuan_rpl
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Calon Mhs atau Staf bisa meng-update status atau file pengajuan
CREATE POLICY "Allow update for owner and staff" ON pengajuan_rpl
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );

-- 6. Kebijakan untuk tabel 'tabel_rekognisi'
-- Calon Mhs bisa melihat miliknya. Staf bisa melihat dan mengubah.
CREATE POLICY "Allow select rekognisi for owner and staff" ON tabel_rekognisi
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = tabel_rekognisi.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );

CREATE POLICY "Allow all actions on rekognisi for staff" ON tabel_rekognisi
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );

-- 7. Kebijakan untuk tabel 'penetapan_akhir'
-- Calon Mhs bisa melihat miliknya. Staf bisa melihat dan mengubah.
CREATE POLICY "Allow select penetapan for owner and staff" ON penetapan_akhir
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = penetapan_akhir.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );

CREATE POLICY "Allow all actions on penetapan for staff" ON penetapan_akhir
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi', 'asessor', 'admin')
        )
    );
*/
