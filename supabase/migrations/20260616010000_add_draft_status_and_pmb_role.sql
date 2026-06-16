-- Skrip Migrasi: Penambahan Status 'draft', Peran 'pmb', Kolom Berkas SMA, Kolom Arsip, Kolom Waktu Tunggu, dan Update RLS
-- Tanggal: 2026-06-16

-- 1. Tambah kolom file_ijazah_sma_url, file_transkrip_sma_url, is_archived, dan submitted_at ke tabel pengajuan_rpl
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS file_ijazah_sma_url TEXT;
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS file_transkrip_sma_url TEXT;
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

-- 2. Tambah kolom is_active ke tabel program_studi
ALTER TABLE program_studi ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Update Check Constraint untuk status pada tabel pengajuan_rpl
ALTER TABLE pengajuan_rpl DROP CONSTRAINT IF EXISTS pengajuan_rpl_status_check;
ALTER TABLE pengajuan_rpl ADD CONSTRAINT pengajuan_rpl_status_check CHECK (
    status IN (
        'draft',              -- Disimpan sebagai draf oleh calon mhs
        'submitted',          -- Dikirim calon mhs
        'returned_baak',      -- Dikembalikan oleh BAAK ke calon mhs
        'validated_baak',     -- Disetujui BAAK, dikirim ke Ka. Prodi
        'returned_kaprodi',   -- Dikembalikan oleh Ka. Prodi ke BAAK
        'recognized_kaprodi', -- Selesai rekognisi Ka. Prodi, dikirim ke Asessor
        'returned_asessor',   -- Dikembalikan oleh Asessor ke Ka. Prodi
        'assessed_asessor',   -- Selesai asesmen Asessor, dikirim ke Admin
        'returned_admin',     -- Dikembalikan oleh Admin ke Asessor
        'mapped_admin'        -- Selesai finalisasi Admin (Rencana Studi Diterbitkan)
    )
);

-- 4. Update Check Constraint untuk role pada tabel profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('calon_rpl', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
);

-- 5. Perbarui RLS Policies agar peran 'pmb' dapat melihat pengajuan, rekognisi, dan penetapan_akhir

-- a. Tabel pengajuan_rpl
DROP POLICY IF EXISTS "Allow select for owner and staff" ON pengajuan_rpl;
CREATE POLICY "Allow select for owner and staff" ON pengajuan_rpl
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
        )
    );

DROP POLICY IF EXISTS "Allow update for owner and staff" ON pengajuan_rpl;
CREATE POLICY "Allow update for owner and staff" ON pengajuan_rpl
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
        )
    );

-- b. Tabel tabel_rekognisi
DROP POLICY IF EXISTS "Allow select rekognisi for owner and staff" ON tabel_rekognisi;
CREATE POLICY "Allow select rekognisi for owner and staff" ON tabel_rekognisi
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = tabel_rekognisi.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
        )
    );

-- c. Tabel penetapan_akhir
DROP POLICY IF EXISTS "Allow select penetapan for owner and staff" ON penetapan_akhir;
CREATE POLICY "Allow select penetapan for owner and staff" ON penetapan_akhir
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM pengajuan_rpl 
            WHERE pengajuan_rpl.id = penetapan_akhir.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
        )
    );
