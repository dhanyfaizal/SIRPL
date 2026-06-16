-- =========================================================================
-- Migrasi: Penambahan Peran 'pmb' ke Kebijakan Unduh Storage
-- Tanggal: 2026-06-16
-- =========================================================================

-- Perbarui Kebijakan Storage SELECT agar peran 'pmb' juga dapat mengunduh berkas calon mahasiswa
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
                AND profiles.role IN ('pmb', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin')
            )
        )
    );
