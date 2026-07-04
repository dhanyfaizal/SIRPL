-- Skrip Migrasi: Pembaruan Kebijakan RLS untuk Mendukung Peran PMB Officer pada Tabel 'penetapan_akhir' & 'notifikasi'
-- Tanggal: 2026-07-04

-- 1. Perbarui Kebijakan (Policies) pada tabel 'penetapan_akhir'
-- Hapus kebijakan write lama jika ada
DROP POLICY IF EXISTS "Allow all actions on penetapan for staff" ON public.penetapan_akhir;

-- Buat kebijakan baru yang mengizinkan PMB Officer ('pmb') melakukan operasi tulis (INSERT, UPDATE, DELETE)
CREATE POLICY "Allow all actions on penetapan for staff" ON public.penetapan_akhir
    FOR ALL USING (
        auth.jwt() ->> 'email' = 'danizsheila@gmail.com' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'asessor', 'admin', 'pmb')
        )
    );

-- 2. Perbarui Kebijakan (Policies) pada tabel 'notifikasi'
-- Pastikan PMB Officer / siapa pun dapat menyisipkan notifikasi ke tabel
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifikasi;

CREATE POLICY "Anyone can insert notifications" ON public.notifikasi
    FOR INSERT WITH CHECK (true);

-- Pastikan role authenticated memiliki izin insert pada tabel notifikasi
GRANT INSERT, SELECT, UPDATE, DELETE ON public.notifikasi TO authenticated;
GRANT ALL ON public.penetapan_akhir TO authenticated;
