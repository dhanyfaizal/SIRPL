-- Migrasi: Tambahkan kolom 'jalur' pada tabel mata_kuliah_kurikulum
ALTER TABLE mata_kuliah_kurikulum 
ADD COLUMN IF NOT EXISTS jalur VARCHAR(20) DEFAULT 'sinkron';

-- Update data default: jenis 'umum' -> 'asinkron', jenis 'inti' -> 'sinkron'
UPDATE mata_kuliah_kurikulum 
SET jalur = 'asinkron' 
WHERE jenis = 'umum' AND (jalur IS NULL OR jalur = '');

UPDATE mata_kuliah_kurikulum 
SET jalur = 'sinkron' 
WHERE jenis = 'inti' AND (jalur IS NULL OR jalur = '');
