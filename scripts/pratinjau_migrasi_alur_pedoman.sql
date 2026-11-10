-- =========================================================================
-- PRATINJAU migrasi data alur lama -> alur pedoman
-- Pasangan dari: supabase/migrations/20261106010000_alur_pedoman_migrasi_data.sql
--
-- HANYA MEMBACA (SELECT). Tidak mengubah data, aman dijalankan di produksi.
-- Hanya memakai tabel/kolom alur lama, sehingga bisa dijalankan SEBELUM
-- migrasi apa pun (disarankan: sebelum dan sesudah gladi bersih).
--
-- Cara pakai (SQL Editor Supabase menampilkan hasil kueri terakhir saja):
--   1. Blok/pilih KUERI A, klik Run  -> ringkasan satu tabel.
--   2. Blok/pilih KUERI B, klik Run  -> rincian per pengajuan.
--   3. Simpan kedua hasil (Export CSV) untuk dibandingkan sesudah migrasi.
--
-- Baris bertanda "!!" harus diselesaikan sebelum migrasi dijalankan.
-- =========================================================================


-- =========================================================================
-- KUERI A: RINGKASAN
-- =========================================================================
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
st AS (SELECT status::text AS status, count(*) AS n FROM pengajuan_rpl GROUP BY status),
-- Sama dengan langkah 5 migrasi: setiap butir pemetaan MK lama (JSON).
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
mk_ta AS (SELECT nama_mk FROM mata_kuliah_kurikulum WHERE nama_mk ~* '(skripsi|tugas\s*akhir)'),
hasil (urut, bagian, keterangan, jumlah) AS (
  SELECT 10, '1. Pengajuan', 'Total pengajuan (semua ditandai alur_versi = 1 pada migrasi pertama)', count(*)::text FROM pengajuan_rpl
  UNION ALL
  SELECT 11, '1. Pengajuan', 'Akan diberi nomor RPL-<tahun dibuat>-NNNN bila belum bernomor (urut created_at)', count(*)::text FROM pengajuan_rpl

  -- 2. Status lama -> baru (langkah 7)
  UNION ALL
  SELECT 20, '2. Status', st.status || ' -> ' ||
         CASE WHEN peta.baru IS NOT NULL THEN peta.baru
              WHEN st.status IN (SELECT s FROM status_baru) THEN st.status || ' (sudah status baru, tidak diubah)'
              ELSE '!! TIDAK TERPETAKAN: migrasi akan GAGAL saat memasang constraint status' END,
         st.n::text
  FROM st LEFT JOIN peta ON peta.lama = st.status

  -- 3. Program studi (langkah 1)
  UNION ALL
  SELECT 30, '3. Program studi', ps.kode || ' ' || ps.nama || ' -> ' ||
         CASE ps.kode WHEN 'IF' THEN 'penyelenggara RPL (S1, kode PDDikti 55201, 145 SKS, maks 100)'
                      WHEN 'SI' THEN 'penyelenggara RPL (S1, kode PDDikti 57201, 145 SKS, maks 100)'
                      ELSE 'BUKAN penyelenggara RPL' END,
         '1'
  FROM program_studi ps
  UNION ALL
  SELECT 31, '3. Program studi', '!! Kode IF dan/atau SI tidak ditemukan; periksa kolom kode program_studi', '0'
  WHERE (SELECT count(*) FROM program_studi WHERE kode IN ('IF', 'SI')) < 2

  -- 4. Tugas akhir (langkah 2)
  UNION ALL
  SELECT 40, '4. Mata kuliah tugas akhir', 'Ditandai tidak dapat direkognisi: ' || coalesce(string_agg(DISTINCT nama_mk, ', '), '-'), count(*)::text FROM mk_ta

  -- 5. Pemetaan MK lama -> penilaian_mk (langkah 5)
  UNION ALL
  SELECT 50, '5. Pemetaan MK', 'Pengajuan yang punya pemetaan MK lama', count(DISTINCT pengajuan_id)::text FROM butir
  UNION ALL
  SELECT 51, '5. Pemetaan MK', 'Butir pemetaan (MK asal)', count(*)::text FROM butir
  UNION ALL
  SELECT 52, '5. Pemetaan MK', 'Baris penilaian_mk yang akan dibuat (pengajuan x MK tujuan valid)', count(DISTINCT (pengajuan_id, mk_id))::text FROM b2 WHERE mk_ada
  UNION ALL
  SELECT 53, '5. Pemetaan MK', 'Butir DILEWATI: MK tujuan kosong/tidak valid/tidak ada di kurikulum (tetap tersimpan di JSON lama)', count(*)::text FROM b2 WHERE NOT mk_ada
  UNION ALL
  SELECT 54, '5. Pemetaan MK', 'Butir diakui di alur lama', count(*)::text FROM b2 WHERE mk_ada AND diakui
  UNION ALL
  SELECT 55, '5. Pemetaan MK', 'Pengakuan TUGAS AKHIR yang DIBATALKAN (pengajuan belum mapped_admin)', count(*)::text FROM b2 WHERE mk_ada AND diakui AND ta AND status <> 'mapped_admin'

  -- 6. Jenis RPL (langkah 6)
  UNION ALL
  SELECT 60, '6. Jenis RPL', j.jenis, count(*)::text
  FROM (
    SELECT p.id,
      CASE
        WHEN EXISTS (SELECT 1 FROM b2 WHERE b2.pengajuan_id = p.id AND b2.mk_ada) THEN
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
)
SELECT bagian, keterangan, jumlah FROM hasil ORDER BY urut, keterangan;


-- =========================================================================
-- KUERI B: RINCIAN PER PENGAJUAN (untuk dicocokkan satu per satu)
-- =========================================================================
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
  to_char(p.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS dibuat,
  'RPL-' || to_char(p.created_at, 'YYYY') || '-' || lpad((row_number() OVER (ORDER BY p.created_at, p.id))::text, 4, '0') AS calon_nomor,
  p.status::text AS status_lama,
  coalesce(m.baru, CASE WHEN p.status::text = ANY (ARRAY['draft','diajukan','dikembalikan_sekretariat','terverifikasi','asesmen',
                          'menunggu_bukti_tambahan','pleno','hasil_disampaikan','klarifikasi','menunggu_komite','dikembalikan_komite',
                          'menunggu_sk','sk_terbit','selesai','tidak_memenuhi_syarat','dibatalkan'])
                        THEN p.status::text || ' (sudah baru)' ELSE '!! TIDAK TERPETAKAN' END) AS status_baru,
  count(b.*) AS butir_mk,
  count(b.*) FILTER (WHERE mk.id IS NOT NULL) AS butir_valid,
  count(DISTINCT b.mk_id) FILTER (WHERE mk.id IS NOT NULL AND b.diakui) AS mk_diakui,
  coalesce(sum(mk.sks) FILTER (WHERE mk.id IS NOT NULL AND b.diakui), 0) AS sks_diakui_kasar
FROM pengajuan_rpl p
LEFT JOIN peta m ON m.lama = p.status::text
LEFT JOIN butir b ON b.pengajuan_id = p.id
LEFT JOIN mata_kuliah_kurikulum mk ON mk.id = b.mk_id
GROUP BY p.id, p.created_at, p.status, m.baru
ORDER BY p.created_at, p.id;
-- Catatan: calon_nomor hanya berlaku bila pengajuan belum bernomor; sks_diakui_kasar
-- menjumlah SKS per butir (MK tujuan yang sama dapat terhitung lebih dari sekali).
