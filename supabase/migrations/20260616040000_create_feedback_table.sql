-- Skrip Migrasi: Pembuatan tabel feedback_pelayanan untuk survey kepuasan calon pendaftar
-- Tanggal: 2026-06-16

CREATE TABLE IF NOT EXISTS feedback_pelayanan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pengajuan_id UUID REFERENCES pengajuan_rpl(id) ON DELETE CASCADE UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating_kemudahan INTEGER NOT NULL CHECK (rating_kemudahan BETWEEN 1 AND 5),
    rating_kejelasan INTEGER NOT NULL CHECK (rating_kejelasan BETWEEN 1 AND 5),
    rating_kecepatan INTEGER NOT NULL CHECK (rating_kecepatan BETWEEN 1 AND 5),
    komentar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS
ALTER TABLE feedback_pelayanan ENABLE ROW LEVEL SECURITY;

-- Policy: Pemilik berkas dapat melakukan CRUD pada feedback miliknya
DROP POLICY IF EXISTS "Allow all for owner" ON feedback_pelayanan;
CREATE POLICY "Allow all for owner" ON feedback_pelayanan
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Pengelola akademik (Admin, BAAK, PMB) dapat membaca rekap feedback
DROP POLICY IF EXISTS "Allow select for staff" ON feedback_pelayanan;
CREATE POLICY "Allow select for staff" ON feedback_pelayanan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'baak', 'pmb')
        )
    );
