-- =========================================================================
-- Migrasi Alur Pedoman RPL Tipe A STIKOM Yos Sudarso
-- Bagian 2 dari 2: PEMETAAN DATA LAMA KE ALUR BARU
-- Tanggal : 2026-11-06
-- Prasyarat: 20261106000000_alur_pedoman_skema.sql sudah dijalankan.
--
-- Jalankan dulu scripts/pratinjau_migrasi_alur_pedoman.sql untuk melihat
-- apa yang akan berubah. Setiap langkah aman dijalankan ulang, jadi bila
-- terhenti di tengah, perbaiki penyebabnya lalu jalankan seluruh file lagi.
-- =========================================================================

BEGIN;

-- Selama pemetaan, updated_at dan log status otomatis dimatikan agar tanggal
-- pembaruan asli tidak tertimpa dan pemetaan dicatat satu kali (langkah 7).
ALTER TABLE pengajuan_rpl DISABLE TRIGGER trg_pengajuan_updated_at;
ALTER TABLE pengajuan_rpl DISABLE TRIGGER trg_catat_status;

-- -------------------------------------------------------------------------
-- 1. Program studi penyelenggara (Pedoman Subbab 2.4 dan 2.5)
--    Kode 'IF' di database = Teknik Informatika.
-- -------------------------------------------------------------------------
UPDATE program_studi SET
  jenjang = 'S1', akreditasi = 'Baik Sekali', beban_sks_minimal = 145, maks_sks_rpl = 100,
  is_penyelenggara_rpl = true, kode_pddikti = '55201'
WHERE kode = 'IF';

UPDATE program_studi SET
  jenjang = 'S1', akreditasi = 'Baik Sekali', beban_sks_minimal = 145, maks_sks_rpl = 100,
  is_penyelenggara_rpl = true, kode_pddikti = '57201'
WHERE kode = 'SI';

UPDATE program_studi SET is_penyelenggara_rpl = false WHERE kode NOT IN ('IF', 'SI');

-- -------------------------------------------------------------------------
-- 2. Tugas akhir tidak dapat direkognisi (Pedoman 2.1 butir 3)
-- -------------------------------------------------------------------------
UPDATE mata_kuliah_kurikulum SET is_tugas_akhir = true, dapat_rpl = false
WHERE nama_mk ~* '(skripsi|tugas\s*akhir)';

-- -------------------------------------------------------------------------
-- 3. Periode aktif dan tarif (Pedoman Bab IV)
--    Nilai lama yang tersimpan di localStorage browser tidak dapat dibaca
--    dari database, jadi tarif diisi dari Bab IV pedoman.
-- -------------------------------------------------------------------------
INSERT INTO periode_rpl (nama, batas_rekognisi_persen, is_aktif)
VALUES ('2026/2027', 70, true)
ON CONFLICT (nama) DO NOTHING;

INSERT INTO tarif_biaya (periode_id, komponen, besaran, keterangan, is_internal)
SELECT p.id, t.komponen, t.besaran, t.keterangan, t.is_internal
FROM periode_rpl p
CROSS JOIN (VALUES
  ('pendaftaran',         200000::numeric, 'Dibayar satu kali saat mendaftar',               false),
  ('asesmen_per_sks',      50000,          'Dihitung dari SKS yang diajukan',                false),
  ('kuliah_per_semester', 5400000,         'Sesuai SK biaya pendidikan',                     false),
  ('matrikulasi_per_mk',   100000,         'Bila direkomendasikan asesor',                   false),
  ('cuti_per_semester',    900000,         'Bila mengajukan cuti',                           false),
  ('lain_lain',           3000000,         'Biaya pendukung dan wisuda',                     false),
  ('moocs_per_mk',         100000,         'Kebijakan internal: mata kuliah jalur asinkron', true)
) AS t(komponen, besaran, keterangan, is_internal)
WHERE p.nama = '2026/2027'
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 4. Tandai pengajuan lama, beri periode dan nomor pendaftaran
-- -------------------------------------------------------------------------
-- Hanya pada migrasi pertama (belum ada log migrasi), agar pengajuan baru
-- tidak ikut ditandai sebagai alur lama bila file ini dijalankan ulang.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM log_aktivitas_rpl WHERE aksi = 'migrasi_alur') THEN
    UPDATE pengajuan_rpl SET alur_versi = 1;
  END IF;
END $$;

UPDATE pengajuan_rpl SET periode_id = (SELECT id FROM periode_rpl WHERE nama = '2026/2027')
WHERE periode_id IS NULL;

WITH urut AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n, created_at
  FROM pengajuan_rpl WHERE nomor_pendaftaran IS NULL
)
UPDATE pengajuan_rpl p
SET nomor_pendaftaran = 'RPL-' || to_char(u.created_at, 'YYYY') || '-' || lpad(u.n::text, 4, '0')
FROM urut u WHERE p.id = u.id;

SELECT setval('nomor_pendaftaran_rpl_seq', greatest(
  (SELECT count(*) FROM pengajuan_rpl),
  (SELECT last_value FROM nomor_pendaftaran_rpl_seq),
  1));

-- -------------------------------------------------------------------------
-- 5. Pindahkan pemetaan MK lama (JSON) ke tabel penilaian_mk
--    Satu baris per MK tujuan; beberapa MK asal yang menuju MK yang sama
--    digabung ke kolom asal. Baris dengan MK tujuan kosong/tidak valid
--    dilewati (tetap tersimpan di tabel_rekognisi.data_mapping_mk).
-- -------------------------------------------------------------------------
WITH butir AS (
  SELECT r.pengajuan_id,
         CASE WHEN (e ->> 'MK_Tujuan_ID') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (e ->> 'MK_Tujuan_ID')::uuid END AS mk_id,
         coalesce(nullif(e ->> 'Kategori_Asal', ''), 'transkrip') AS kategori,
         e ->> 'MK_Asal' AS nama,
         CASE WHEN (e ->> 'SKS_Asal') ~ '^\s*\d+(\.\d+)?\s*$'
              THEN round(trim(e ->> 'SKS_Asal')::numeric)::int ELSE 0 END AS sks,
         nullif(upper(trim(e ->> 'Nilai')), '') AS nilai,
         (e ->> 'Status') = 'diakui' AS diakui
  FROM tabel_rekognisi r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.data_mapping_mk) = 'array' THEN r.data_mapping_mk ELSE '[]'::jsonb END) e
),
valid AS (
  -- Tugas akhir pada pengajuan yang belum tuntas tidak lagi diakui (Pedoman 2.1);
  -- riwayat pengajuan yang sudah tuntas (mapped_admin) disimpan apa adanya.
  SELECT b.pengajuan_id, b.mk_id, b.kategori, b.nama, b.sks, b.nilai,
         b.diakui AND NOT (mk.is_tugas_akhir AND p.status <> 'mapped_admin') AS diakui,
         b.diakui AND mk.is_tugas_akhir AND p.status <> 'mapped_admin' AS ta_dibatalkan
  FROM butir b
  JOIN mata_kuliah_kurikulum mk ON mk.id = b.mk_id
  JOIN pengajuan_rpl p ON p.id = b.pengajuan_id
)
INSERT INTO penilaian_mk (pengajuan_id, mk_id, mekanisme, asal, keputusan, nilai_huruf, catatan, sumber_usulan, dinilai_at)
SELECT pengajuan_id,
       mk_id,
       CASE WHEN bool_or(kategori = 'transkrip') THEN 'transfer' ELSE 'perolehan' END,
       jsonb_agg(jsonb_build_object('kategori', kategori, 'nama', nama, 'sks', sks, 'nilai', nilai)),
       CASE WHEN bool_or(diakui) THEN 'diakui' ELSE 'tidak_diakui' END,
       CASE WHEN bool_or(diakui)
            THEN coalesce(min(nilai) FILTER (WHERE diakui AND nilai ~ '^[A-E][+-]?$'), 'B') END,
       CASE WHEN bool_or(ta_dibatalkan)
            THEN 'Dipindahkan dari alur lama. Semula diakui; dibatalkan karena tugas akhir tidak dapat direkognisi (Pedoman 2.1)'
            ELSE 'Dipindahkan dari pemetaan alur lama' END,
       'manual',
       NOW()
FROM valid
GROUP BY pengajuan_id, mk_id
ON CONFLICT (pengajuan_id, mk_id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 6. Jenis RPL per pengajuan
-- -------------------------------------------------------------------------
UPDATE pengajuan_rpl p SET jenis_rpl = x.jenis
FROM (
  SELECT pengajuan_id,
         CASE WHEN bool_and(mekanisme = 'transfer')  THEN 'transfer'
              WHEN bool_and(mekanisme = 'perolehan') THEN 'perolehan'
              ELSE 'gabungan' END AS jenis
  FROM penilaian_mk GROUP BY pengajuan_id
) x
WHERE p.id = x.pengajuan_id AND p.jenis_rpl IS NULL;

-- Pengajuan yang belum punya penilaian: tentukan dari berkas yang diunggah.
UPDATE pengajuan_rpl SET jenis_rpl = CASE
    WHEN coalesce(file_transkrip_url, '') <> '' AND
         (jsonb_array_length(coalesce(sertifikat_kompetensi, '[]')) > 0 OR
          jsonb_array_length(coalesce(pengalaman_kerja, '[]')) > 0) THEN 'gabungan'
    WHEN coalesce(file_transkrip_url, '') <> '' THEN 'transfer'
    ELSE 'perolehan' END
WHERE jenis_rpl IS NULL;

-- -------------------------------------------------------------------------
-- 7. Status lama -> status alur pedoman
--
--    Lama                 Baru
--    draft                draft
--    submitted            diajukan
--    returned_baak        dikembalikan_sekretariat
--    returned_kaprodi     diajukan            (kembali ke antrean Sekretariat)
--    validated_baak       terverifikasi       (menunggu penugasan asesor)
--    recognized_kaprodi   asesmen
--    returned_asessor     asesmen
--    returned_admin       asesmen
--    assessed_asessor     pleno               (hasil penilaian menunggu pleno)
--    mapped_admin         selesai             (sudah tuntas di alur lama)
-- -------------------------------------------------------------------------
ALTER TABLE pengajuan_rpl DROP CONSTRAINT IF EXISTS pengajuan_rpl_status_check;

-- Satu perintah: ubah status lalu catat ke log. Tidak memakai tabel sementara
-- karena SQL Editor dapat menjalankan tiap perintah di koneksi berbeda.
-- Aman dijalankan ulang: status yang sudah baru tidak cocok dengan peta lagi.
WITH peta (lama, baru) AS (VALUES
  ('draft', 'draft'), ('submitted', 'diajukan'), ('returned_baak', 'dikembalikan_sekretariat'),
  ('returned_kaprodi', 'diajukan'), ('validated_baak', 'terverifikasi'),
  ('recognized_kaprodi', 'asesmen'), ('returned_asessor', 'asesmen'), ('returned_admin', 'asesmen'),
  ('assessed_asessor', 'pleno'), ('mapped_admin', 'selesai')
),
diubah AS (
  UPDATE pengajuan_rpl p SET status = m.baru
  FROM peta m
  WHERE m.lama = p.status
    AND NOT EXISTS (SELECT 1 FROM log_aktivitas_rpl l WHERE l.pengajuan_id = p.id AND l.aksi = 'migrasi_alur')
  RETURNING p.id, m.lama, m.baru
)
INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, dari_status, ke_status, catatan)
SELECT id, NULL, 'migrasi_alur', lama, baru, 'Pemetaan otomatis dari alur lama ke alur pedoman'
FROM diubah;

ALTER TABLE pengajuan_rpl ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE pengajuan_rpl DROP CONSTRAINT IF EXISTS pengajuan_rpl_status_check;
ALTER TABLE pengajuan_rpl ADD CONSTRAINT pengajuan_rpl_status_check CHECK (status IN (
  'draft',                     -- disusun pemohon
  'diajukan',                  -- dikirim, menunggu verifikasi Sekretariat
  'dikembalikan_sekretariat',  -- berkas kurang, kembali ke pemohon
  'terverifikasi',             -- berkas lengkap, menunggu penugasan asesor
  'asesmen',                   -- dinilai Tim Penilai
  'menunggu_bukti_tambahan',   -- asesor meminta bukti tambahan dari pemohon
  'pleno',                     -- hasil penilaian dibahas di pleno
  'hasil_disampaikan',         -- hasil dikirim ke pemohon, menunggu tanggapan
  'klarifikasi',               -- pemohon mengajukan klarifikasi
  'menunggu_komite',           -- pemohon setuju, menunggu persetujuan Komite
  'dikembalikan_komite',       -- Komite meminta perbaikan
  'menunggu_sk',               -- disetujui Komite, menunggu SK Ketua
  'sk_terbit',                 -- SK terbit; jalur kuliah dan biaya disusun
  'selesai',                   -- rencana studi terbit, siap registrasi ulang
  'tidak_memenuhi_syarat',     -- tidak memenuhi persyaratan pedoman
  'dibatalkan'                 -- dibatalkan pemohon
));

ALTER TABLE pengajuan_rpl ENABLE TRIGGER trg_catat_status;
ALTER TABLE pengajuan_rpl ENABLE TRIGGER trg_pengajuan_updated_at;

COMMIT;
