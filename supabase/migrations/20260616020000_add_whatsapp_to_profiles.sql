-- Skrip Migrasi: Penambahan Kolom no_whatsapp pada tabel profiles
-- Tanggal: 2026-06-16

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS no_whatsapp TEXT;
