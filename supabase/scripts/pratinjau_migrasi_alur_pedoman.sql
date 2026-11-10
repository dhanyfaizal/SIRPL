-- =========================================================================
-- PRATINJAU migrasi alur pedoman (HANYA MEMBACA, tidak mengubah data)
-- Pasangan dari:
--   supabase/migrations/20261106000000_alur_pedoman_skema.sql      (peran)
--   supabase/migrations/20261106010000_alur_pedoman_migrasi_data.sql (data)
--
-- Hanya memakai tabel/kolom alur lama, jadi bisa dijalankan SEBELUM migrasi
-- apa pun, di produksi maupun di salinan gladi. Bila dijalankan di basis data
-- yang sudah dimigrasi (mis. staging), status/peran baru ditandai "sudah baru".
--
-- Cara pakai: SQL Editor Supabase hanya menampilkan hasil kueri TERAKHIR.
-- Blok satu kueri (mulai baris "-- [x]" sampai titik koma), lalu Run.
--   [1] RINGKASAN       wajib, satu tabel berisi semua butir penting
--   [2] Rincian pengajuan
--   [3] MK tugas akhir
--   [4] SKS diakui > 100
--   [5] Tugas akhir yang diakui di alur lama
--   [6] Peran pengguna
-- Simpan hasil [1] dan [2] (Export CSV) untuk dicocokkan sesudah migrasi.
-- Setiap baris bertanda "!!" harus diselesaikan sebelum migrasi dijalankan.
-- =========================================================================


-- [1] RINGKASAN ===========================================================
WITH peta (lama, baru) AS (VALUES
  ('draft', 'draft'), ('submitted', 'diajukan'), ('returned_baak', 'dikembalikan_sekretariat'),
  ('returned_kaprodi', 'diajukan'), ('validated_baak', 'terverifikasi'),
  ('recognized_kaprodi', 'asesmen'), ('returned_asessor', 'asesmen'), ('returned_admin', 'asesmen'),
  ('assessed_asessor', 'pleno'), ('mapped_admin', 'selesai')
),
status_baru (s) AS (VALUES
  ('draft'), ('diajukan'), ('dikembalikan_sekretariat'), ('terverifikasi'), ('asesmen'),
  ('menunggu_bukti_tambahan'), ('pleno'), ('hasil_disampaikan'), ('klarifikasi'), ('menunggu_komite'),
  ('dikembalikan_komite'), ('menunggu_sk'), ('sk_terbit'), ('selesai'), ('tidak_memenuhi_syarat'), ('dibatalkan')
),
peran_sah (r) AS (VALUES
  ('calon_rpl'), ('pmb'), ('baak'), ('kaprodi_si'), ('kaprodi_ti'), ('kaprodi_dkv'), ('kaprodi_ka'),
  ('asessor'), ('admin'), ('eksekutif'), ('ketua_tim'), ('sekretaris'), ('komite'), ('lpmp')
),
st AS (SELECT status::text AS status, count(*) AS n FROM pengajuan_rpl GROUP BY status),
-- Sama dengan langkah 5 migrasi data: setiap butir pemetaan MK lama (JSON).
butir AS (
  SELECT r.pengajuan_id,
         CASE WHEN (e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (e ->> 'MK_Tujuan_ID')::uuid END AS mk_id,
         coalesce(nullif(e ->> 'Kategori_Asal', ''), 'transkrip') AS kategori,
         (e ->> 'Status') = 'diakui' AS diakui
  FROM tabel_rekognisi r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
),
b2 AS (
  SELECT b.*, mk.id IS NOT NULL AS mk_ada,
         coalesce(mk.nama_mk ~* '(skripsi|tugas\s*akhir)', false) AS ta,
         p.status::text AS status
  FROM butir b
  LEFT JOIN mata_kuliah_kurikulum mk ON mk.id = b.mk_id
  JOIN pengajuan_rpl p ON p.id = b.pengajuan_id
),
hasil (urut, bagian, keterangan, jumlah) AS (
  -- 1. Peran pengguna (migrasi skema memasang daftar peran; peran di luar daftar membuatnya GAGAL)
  SELECT 10, '1. Peran', pr.role::text || CASE WHEN pr.role::text IN (SELECT r FROM peran_sah) THEN ''
                                             ELSE ' !! TIDAK ADA di daftar peran baru: migrasi skema akan GAGAL' END,
         count(*)::text
  FROM profiles pr GROUP BY pr.role

  -- 2. Pengajuan dan nomor pendaftaran (langkah 4)
  UNION ALL
  SELECT 20, '2. Pengajuan', 'Total pengajuan (ditandai alur_versi = 1 pada migrasi pertama)', count(*)::text FROM pengajuan_rpl

  -- 3. Status lama -> baru (langkah 7; status di luar peta membuat constraint GAGAL)
  UNION ALL
  SELECT 30, '3. Status', st.status || ' -> ' ||
         CASE WHEN peta.baru IS NOT NULL THEN peta.baru
              WHEN st.status IN (SELECT s FROM status_baru) THEN st.status || ' (sudah status baru, tidak diubah)'
              ELSE '!! TIDAK TERPETAKAN: migrasi data akan GAGAL saat memasang constraint status' END,
         st.n::text
  FROM st LEFT JOIN peta ON peta.lama = st.status

  -- 4. Program studi (langkah 1)
  UNION ALL
  SELECT 40, '4. Program studi', ps.kode || ' ' || ps.nama || ' -> ' ||
         CASE ps.kode WHEN 'IF' THEN 'penyelenggara RPL (S1, kode PDDikti 55201, 145 SKS, maks 100)'
                      WHEN 'SI' THEN 'penyelenggara RPL (S1, kode PDDikti 57201, 145 SKS, maks 100)'
                      ELSE 'BUKAN penyelenggara RPL' END,
         '1'
  FROM program_studi ps
  UNION ALL
  SELECT 41, '4. Program studi', '!! Kode IF dan/atau SI tidak ditemukan; periksa kolom kode program_studi', '0'
  WHERE (SELECT count(*) FROM program_studi WHERE kode IN ('IF', 'SI')) < 2

  -- 5. Tugas akhir (langkah 2; daftar lengkap di [3])
  UNION ALL
  SELECT 50, '5. MK tugas akhir', 'Ditandai tidak dapat direkognisi', count(*)::text
  FROM mata_kuliah_kurikulum WHERE nama_mk ~* '(skripsi|tugas\s*akhir)'

  -- 6. Pemetaan MK lama -> penilaian_mk (langkah 5)
  UNION ALL
  SELECT 60, '6. Pemetaan MK', 'Pengajuan yang punya pemetaan MK lama', count(DISTINCT pengajuan_id)::text FROM butir
  UNION ALL
  SELECT 61, '6. Pemetaan MK', 'Butir pemetaan (MK asal)', count(*)::text FROM butir
  UNION ALL
  SELECT 62, '6. Pemetaan MK', 'Baris penilaian_mk yang akan dibuat (pengajuan x MK tujuan valid)', count(DISTINCT (pengajuan_id, mk_id))::text FROM b2 WHERE mk_ada
  UNION ALL
  SELECT 63, '6. Pemetaan MK', 'Butir DILEWATI: MK tujuan kosong/tidak valid (tetap tersimpan di JSON lama)', count(*)::text FROM b2 WHERE NOT mk_ada
  UNION ALL
  SELECT 64, '6. Pemetaan MK', 'Butir diakui di alur lama', count(*)::text FROM b2 WHERE mk_ada AND diakui
  UNION ALL
  SELECT 65, '6. Pemetaan MK', 'Pengakuan TUGAS AKHIR yang DIBATALKAN (pengajuan belum mapped_admin; rincian di [5])', count(*)::text
  FROM b2 WHERE mk_ada AND diakui AND ta AND status <> 'mapped_admin'

  -- 7. Jenis RPL (langkah 6)
  UNION ALL
  SELECT 70, '7. Jenis RPL', j.jenis, count(*)::text
  FROM (
    SELECT p.id,
      CASE
        WHEN count(b2.mk_id) > 0 THEN
          CASE WHEN bool_and(b2.kategori = 'transkrip') THEN 'transfer'
               WHEN bool_and(b2.kategori <> 'transkrip') THEN 'perolehan' ELSE 'gabungan' END
        WHEN coalesce(p.file_transkrip_url, '') <> '' AND
             (jsonb_array_length(coalesce(p.sertifikat_kompetensi, '[]')) > 0 OR
              jsonb_array_length(coalesce(p.pengalaman_kerja, '[]')) > 0) THEN 'gabungan (dari berkas)'
        WHEN coalesce(p.file_transkrip_url, '') <> '' THEN 'transfer (dari berkas)'
        ELSE 'perolehan (dari berkas)' END AS jenis
    FROM pengajuan_rpl p
    LEFT JOIN b2 ON b2.pengajuan_id = p.id AND b2.mk_ada
    GROUP BY p.id, p.file_transkrip_url, p.sertifikat_kompetensi, p.pengalaman_kerja
  ) j
  GROUP BY j.jenis

  -- 8. Hal yang perlu ditinjau Tim RPL (tidak menggagalkan migrasi)
  UNION ALL
  SELECT 80, '8. Tinjau', 'Pengajuan dengan SKS diakui > 100 (batas baru; rincian di [4])', count(*)::text
  FROM penetapan_akhir WHERE coalesce(total_sks_diakui, 0) > 100
)
SELECT bagian, keterangan, jumlah FROM hasil ORDER BY urut, keterangan;


-- [2] Rincian per pengajuan ===============================================
WITH peta (lama, baru) AS (VALUES
  ('draft', 'draft'), ('submitted', 'diajukan'), ('returned_baak', 'dikembalikan_sekretariat'),
  ('returned_kaprodi', 'diajukan'), ('validated_baak', 'terverifikasi'),
  ('recognized_kaprodi', 'asesmen'), ('returned_asessor', 'asesmen'), ('returned_admin', 'asesmen'),
  ('assessed_asessor', 'pleno'), ('mapped_admin', 'selesai')
),
butir AS (
  SELECT r.pengajuan_id,
         CASE WHEN (e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (e ->> 'MK_Tujuan_ID')::uuid END AS mk_id,
         (e ->> 'Status') = 'diakui' AS diakui
  FROM tabel_rekognisi r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
)
SELECT
  p.id,
  pr.nama_lengkap,
  to_char(p.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS dibuat,
  'RPL-' || to_char(p.created_at, 'YYYY') || '-' || lpad((row_number() OVER (ORDER BY p.created_at, p.id))::text, 4, '0') AS calon_nomor,
  p.status::text AS status_lama,
  coalesce(m.baru, CASE WHEN p.status::text = ANY (ARRAY['draft','diajukan','dikembalikan_sekretariat','terverifikasi','asesmen',
                          'menunggu_bukti_tambahan','pleno','hasil_disampaikan','klarifikasi','menunggu_komite','dikembalikan_komite',
                          'menunggu_sk','sk_terbit','selesai','tidak_memenuhi_syarat','dibatalkan'])
                        THEN p.status::text || ' (sudah baru)' ELSE '!! TIDAK TERPETAKAN' END) AS status_baru,
  count(b.pengajuan_id) AS total_butir,
  count(mk.id) AS butir_valid,
  count(DISTINCT b.mk_id) FILTER (WHERE mk.id IS NOT NULL AND b.diakui) AS mk_diakui
FROM pengajuan_rpl p
LEFT JOIN profiles pr ON pr.id = p.user_id
LEFT JOIN peta m ON m.lama = p.status::text
LEFT JOIN butir b ON b.pengajuan_id = p.id
LEFT JOIN mata_kuliah_kurikulum mk ON mk.id = b.mk_id
GROUP BY p.id, pr.nama_lengkap, p.created_at, p.status, m.baru
ORDER BY p.created_at, p.id;
-- calon_nomor hanya berlaku bila pengajuan belum bernomor.


-- [3] MK yang akan ditandai tugas akhir ===================================
SELECT ps.kode AS prodi, mk.kode_mk, mk.nama_mk, mk.sks
FROM mata_kuliah_kurikulum mk LEFT JOIN program_studi ps ON ps.id = mk.prodi_id
WHERE mk.nama_mk ~* '(skripsi|tugas\s*akhir)'
ORDER BY ps.kode, mk.kode_mk;


-- [4] Pengajuan yang SKS diakuinya melebihi batas baru (maks 100 SKS) =====
--     Data lama tetap disimpan; hanya untuk ditinjau Tim RPL.
SELECT p.id, pr.nama_lengkap, ps.kode AS prodi, p.status, pa.total_sks_diakui
FROM pengajuan_rpl p
JOIN profiles pr ON pr.id = p.user_id
LEFT JOIN program_studi ps ON ps.id = p.prodi_pilihan_id
LEFT JOIN penetapan_akhir pa ON pa.pengajuan_id = p.id
WHERE coalesce(pa.total_sks_diakui, 0) > 100
ORDER BY pa.total_sks_diakui DESC;


-- [5] Tugas akhir yang diakui di alur lama (melanggar Pedoman 2.1) ========
--     dibatalkan_migrasi = true  -> pengakuan dibatalkan oleh migrasi data
--     dibatalkan_migrasi = false -> pengajuan sudah tuntas (mapped_admin), disimpan apa adanya
SELECT DISTINCT p.id, pr.nama_lengkap, mk.nama_mk, p.status,
       p.status::text <> 'mapped_admin' AS dibatalkan_migrasi
FROM tabel_rekognisi r
JOIN pengajuan_rpl p ON p.id = r.pengajuan_id
JOIN profiles pr ON pr.id = p.user_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
JOIN mata_kuliah_kurikulum mk
  ON mk.id = CASE WHEN (e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN (e ->> 'MK_Tujuan_ID')::uuid END
WHERE (e ->> 'Status') = 'diakui' AND mk.nama_mk ~* '(skripsi|tugas\s*akhir)';


-- [6] Peran pengguna (peran di luar daftar membuat migrasi skema GAGAL) ====
SELECT role, count(*) AS jumlah,
       CASE WHEN role::text IN ('calon_rpl', 'pmb', 'baak', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka',
                                'asessor', 'admin', 'eksekutif', 'ketua_tim', 'sekretaris', 'komite', 'lpmp')
            THEN 'sah' ELSE '!! TIDAK ADA di daftar peran baru' END AS keterangan
FROM profiles GROUP BY role ORDER BY count(*) DESC;
