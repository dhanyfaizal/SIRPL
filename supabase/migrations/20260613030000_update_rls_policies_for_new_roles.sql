-- Skrip Migrasi: Pembaruan Kebijakan RLS untuk Mendukung Peran Baru & Akses Admin

-- =========================================================================
-- OPSI UTAMA: JALANKAN KODE DI BAWAH INI JIKA ANDA INGIN MENGGUNAKAN RLS (AMAN)
-- =========================================================================

-- 1. Perbarui Kebijakan (Policies) pada tabel 'profiles'
-- Hapus kebijakan update lama jika ada
DROP POLICY IF EXISTS "Allow update for self profile" ON profiles;
DROP POLICY IF EXISTS "Allow update for self and admin" ON profiles;
DROP POLICY IF EXISTS "Allow update for users" ON profiles;

-- Buat kebijakan baru yang mengizinkan user mengupdate dirinya sendiri,
-- ATAU Admin Utama (danizsheila@gmail.com) mengupdate siapa saja (termasuk verifikasi dan ganti peran)
CREATE POLICY "Allow update for self and admin" ON profiles
    FOR UPDATE USING (
        auth.uid() = id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com'
    );


-- 2. Perbarui Kebijakan pada tabel 'pengajuan_rpl' (Daftar Matakuliah Asal/Timeline)
DROP POLICY IF EXISTS "Allow select for owner and staff" ON pengajuan_rpl;
DROP POLICY IF EXISTS "Allow update for owner and staff" ON pengajuan_rpl;

CREATE POLICY "Allow select for owner and staff" ON pengajuan_rpl
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );

CREATE POLICY "Allow update for owner and staff" ON pengajuan_rpl
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );


-- 3. Perbarui Kebijakan pada tabel 'tabel_rekognisi' (Smart Recognition Ka. Prodi)
DROP POLICY IF EXISTS "Allow select rekognisi for owner and staff" ON tabel_rekognisi;
DROP POLICY IF EXISTS "Allow all actions on rekognisi for staff" ON tabel_rekognisi;

CREATE POLICY "Allow select rekognisi for owner and staff" ON tabel_rekognisi
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = tabel_rekognisi.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );

CREATE POLICY "Allow all actions on rekognisi for staff" ON tabel_rekognisi
    FOR ALL USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );


-- 4. Perbarui Kebijakan pada tabel 'penetapan_akhir' (Jalur Studi & Keuangan)
DROP POLICY IF EXISTS "Allow select penetapan for owner and staff" ON penetapan_akhir;
DROP POLICY IF EXISTS "Allow all actions on penetapan for staff" ON penetapan_akhir;

CREATE POLICY "Allow select penetapan for owner and staff" ON penetapan_akhir
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = penetapan_akhir.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );

CREATE POLICY "Allow all actions on penetapan for staff" ON penetapan_akhir
    FOR ALL USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );
