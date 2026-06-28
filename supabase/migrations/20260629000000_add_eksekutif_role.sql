-- 1. Perbarui check constraint untuk role di tabel profiles agar mendukung peran 'eksekutif'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('calon_rpl', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb', 'eksekutif')
);

-- 2. Perbarui RLS Policies untuk pengajuan_rpl
DROP POLICY IF EXISTS "Allow select for owner and staff" ON pengajuan_rpl;
CREATE POLICY "Allow select for owner and staff" ON pengajuan_rpl
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb', 'eksekutif')
        )
    );

-- 3. Perbarui RLS Policies untuk tabel_rekognisi
DROP POLICY IF EXISTS "Allow select rekognisi for owner and staff" ON tabel_rekognisi;
CREATE POLICY "Allow select rekognisi for owner and staff" ON tabel_rekognisi
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pengajuan_rpl WHERE pengajuan_rpl.id = pengajuan_id AND (
                pengajuan_rpl.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb', 'eksekutif')
                )
            )
        )
    );

-- 4. Perbarui RLS Policies untuk penetapan_akhir
DROP POLICY IF EXISTS "Allow select penetapan for owner and staff" ON penetapan_akhir;
CREATE POLICY "Allow select penetapan for owner and staff" ON penetapan_akhir
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pengajuan_rpl WHERE pengajuan_rpl.id = pengajuan_id AND (
                pengajuan_rpl.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb', 'eksekutif')
                )
            )
        )
    );

-- 5. Perbarui RLS Policies untuk feedback_pelayanan
DROP POLICY IF EXISTS "Allow select for staff" ON feedback_pelayanan;
CREATE POLICY "Allow select for staff" ON feedback_pelayanan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'baak', 'pmb', 'eksekutif')
        )
    );
