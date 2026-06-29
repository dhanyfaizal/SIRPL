-- Migrasi: Penambahan Kolom Diskon Biaya Pendukung & Catatan Potongan Pendukung

ALTER TABLE penetapan_akhir 
ADD COLUMN IF NOT EXISTS potongan_biaya_pendukung NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS catatan_potongan_pendukung TEXT DEFAULT '';
