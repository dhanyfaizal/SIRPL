-- Migrasi: Update check constraint pada tabel mata_kuliah_kurikulum untuk mendukung 'pilihan'
ALTER TABLE mata_kuliah_kurikulum 
DROP CONSTRAINT IF EXISTS mata_kuliah_kurikulum_jenis_check;

ALTER TABLE mata_kuliah_kurikulum 
ADD CONSTRAINT mata_kuliah_kurikulum_jenis_check 
CHECK (jenis IN ('inti', 'umum', 'pilihan'));
