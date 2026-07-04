-- Skrip Migrasi: Penambahan Kolom Pembiayaan Bulanan ke Tabel 'penetapan_akhir'
-- Tanggal: 2026-07-04

ALTER TABLE public.penetapan_akhir 
ADD COLUMN IF NOT EXISTS monthly_payment_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS is_monthly_payment BOOLEAN DEFAULT false;
