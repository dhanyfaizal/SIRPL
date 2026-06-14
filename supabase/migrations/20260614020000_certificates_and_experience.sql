-- Skrip Migrasi: Penambahan Kolom Sertifikat Kompetensi & Pengalaman Kerja ke tabel pengajuan_rpl

ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS sertifikat_kompetensi JSONB DEFAULT '[]'::jsonb;
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS pengalaman_kerja JSONB DEFAULT '[]'::jsonb;
