-- Skrip Migrasi: Perbaikan Seluruh Kebijakan RLS untuk Pengajuan Pembiayaan Bulanan
-- Tanggal: 2026-07-04

-- 1. Izinkan Calon Mahasiswa (Owner) memperbarui kolom penetapan_akhir milik mereka sendiri
DROP POLICY IF EXISTS "Allow update penetapan for owner" ON public.penetapan_akhir;
CREATE POLICY "Allow update penetapan for owner" ON public.penetapan_akhir
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pengajuan_rpl
            WHERE pengajuan_rpl.id = penetapan_akhir.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pengajuan_rpl
            WHERE pengajuan_rpl.id = penetapan_akhir.pengajuan_id AND pengajuan_rpl.user_id = auth.uid()
        )
    );

-- 2. Perbarui Kebijakan ALL (Tulis/Baca) pada tabel 'penetapan_akhir' untuk Staff akademik termasuk peran 'pmb'
DROP POLICY IF EXISTS "Allow all actions on penetapan for staff" ON public.penetapan_akhir;
CREATE POLICY "Allow all actions on penetapan for staff" ON public.penetapan_akhir
    FOR ALL TO authenticated
    USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
        )
    );

-- 3. Kebijakan penyisipan Notifikasi agar dapat dimasukkan oleh siapa pun (termasuk Calon Mahasiswa)
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifikasi;
CREATE POLICY "Anyone can insert notifications" ON public.notifikasi
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 4. Berikan izin hak akses penuh ke role authenticated pada tabel terkait
GRANT ALL ON public.penetapan_akhir TO authenticated;
GRANT ALL ON public.notifikasi TO authenticated;

-- 5. Beri tahu PostgREST untuk memuat ulang cache skema agar mendeteksi kolom baru seketika
NOTIFY pgrst, 'reload schema';
