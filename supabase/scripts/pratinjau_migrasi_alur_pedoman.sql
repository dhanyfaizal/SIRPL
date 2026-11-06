-- =========================================================================
-- PRATINJAU migrasi alur pedoman (HANYA MEMBACA, tidak mengubah data)
-- Jalankan di SQL Editor sebelum 20261106010000_alur_pedoman_migrasi_data.sql
-- Setiap blok menghasilkan satu tabel hasil; jalankan per blok bila perlu.
-- =========================================================================

-- A. Sebaran status lama dan status barunya
SELECT p.status AS status_lama,
       CASE p.status
         WHEN 'draft' THEN 'draft'
         WHEN 'submitted' THEN 'diajukan'
         WHEN 'returned_baak' THEN 'dikembalikan_sekretariat'
         WHEN 'returned_kaprodi' THEN 'diajukan'
         WHEN 'validated_baak' THEN 'terverifikasi'
         WHEN 'recognized_kaprodi' THEN 'asesmen'
         WHEN 'returned_asessor' THEN 'asesmen'
         WHEN 'returned_admin' THEN 'asesmen'
         WHEN 'assessed_asessor' THEN 'pleno'
         WHEN 'mapped_admin' THEN 'selesai'
         ELSE '(TIDAK DIKENAL - migrasi akan gagal)'
       END AS status_baru,
       count(*) AS jumlah
FROM pengajuan_rpl p
GROUP BY p.status ORDER BY jumlah DESC;

-- B. Mata kuliah yang akan ditandai tugas akhir (tidak dapat direkognisi)
SELECT ps.kode AS prodi, mk.kode_mk, mk.nama_mk, mk.sks
FROM mata_kuliah_kurikulum mk JOIN program_studi ps ON ps.id = mk.prodi_id
WHERE mk.nama_mk ~* '(skripsi|tugas\s*akhir)'
ORDER BY ps.kode, mk.kode_mk;

-- C. Pemetaan MK lama yang akan dipindahkan ke penilaian_mk
--    baris_valid  = punya MK tujuan yang ada di kurikulum
--    baris_lewati = MK tujuan kosong/tidak valid (tetap tersimpan di JSON lama)
WITH butir AS (
  SELECT r.pengajuan_id, e
  FROM tabel_rekognisi r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
)
SELECT count(*) AS total_baris,
       count(*) FILTER (WHERE mk.id IS NOT NULL) AS baris_valid,
       count(*) FILTER (WHERE mk.id IS NULL) AS baris_lewati,
       count(DISTINCT b.pengajuan_id) AS jumlah_pengajuan
FROM butir b
LEFT JOIN mata_kuliah_kurikulum mk
  ON mk.id = CASE WHEN (b.e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN (b.e ->> 'MK_Tujuan_ID')::uuid END;

-- D. Pengajuan yang SKS diakuinya melebihi batas baru (maks 100 SKS)
--    Data lama tetap disimpan; ini hanya untuk ditinjau Tim RPL.
SELECT p.id, pr.nama_lengkap, ps.kode AS prodi, p.status, pa.total_sks_diakui
FROM pengajuan_rpl p
JOIN profiles pr ON pr.id = p.user_id
LEFT JOIN program_studi ps ON ps.id = p.prodi_pilihan_id
LEFT JOIN penetapan_akhir pa ON pa.pengajuan_id = p.id
WHERE coalesce(pa.total_sks_diakui, 0) > 100
ORDER BY pa.total_sks_diakui DESC;

-- E. Pengajuan yang memetakan tugas akhir sebagai MK diakui (melanggar pedoman 2.1)
SELECT DISTINCT p.id, pr.nama_lengkap, mk.nama_mk, p.status
FROM tabel_rekognisi r
JOIN pengajuan_rpl p ON p.id = r.pengajuan_id
JOIN profiles pr ON pr.id = p.user_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
JOIN mata_kuliah_kurikulum mk
  ON mk.id = CASE WHEN (e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN (e ->> 'MK_Tujuan_ID')::uuid END
WHERE (e ->> 'Status') = 'diakui' AND mk.nama_mk ~* '(skripsi|tugas\s*akhir)';

-- F. Pengguna dan peran (cek tidak ada peran di luar daftar yang diizinkan)
SELECT role, count(*) FROM profiles GROUP BY role ORDER BY count(*) DESC;
