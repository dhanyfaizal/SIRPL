-- Migrasi: Menambahkan default value 'submitted' pada kolom status tabel pengajuan_rpl
-- Tanggal: 2026-06-13

ALTER TABLE pengajuan_rpl ALTER COLUMN status SET DEFAULT 'submitted';
