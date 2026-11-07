-- =========================================================================
-- Tabel referensi untuk isian pilihan pada Formulir Aplikasi (F02)
-- Tanggal : 2026-11-08
-- Prasyarat: 20261108000000_juknis_skema.sql
--
-- ref_wilayah          : kabupaten/kota untuk "Tempat lahir".
--                        Diisi awal 119 kab/kota di Pulau Jawa (DKI, Jabar,
--                        Jateng, DIY, Jatim, Banten). Provinsi lain dapat
--                        ditambahkan dengan impor CSV (kolom: nama, jenis,
--                        provinsi) lewat Table Editor Supabase.
-- ref_perguruan_tinggi : perguruan tinggi asal. Diisi lewat impor CSV
--                        (kolom: kode_pddikti, nama, kota). Pemohon tetap
--                        dapat mengetik sendiri bila tidak ada di daftar.
-- Aman dijalankan ulang.
-- =========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ref_wilayah (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(120) NOT NULL,
  jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('kabupaten', 'kota')),
  provinsi VARCHAR(60) NOT NULL,
  UNIQUE (nama, provinsi)
);
CREATE INDEX IF NOT EXISTS ref_wilayah_nama_idx ON ref_wilayah (lower(nama));

CREATE TABLE IF NOT EXISTS ref_perguruan_tinggi (
  id SERIAL PRIMARY KEY,
  kode_pddikti VARCHAR(10) UNIQUE,
  nama VARCHAR(255) NOT NULL UNIQUE,
  kota VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS ref_pt_nama_idx ON ref_perguruan_tinggi (lower(nama));

INSERT INTO ref_wilayah (nama, jenis, provinsi) VALUES
  ('Kab. Kepulauan Seribu', 'kabupaten', 'DKI Jakarta'),
  ('Kota Jakarta Pusat', 'kota', 'DKI Jakarta'),
  ('Kota Jakarta Utara', 'kota', 'DKI Jakarta'),
  ('Kota Jakarta Barat', 'kota', 'DKI Jakarta'),
  ('Kota Jakarta Selatan', 'kota', 'DKI Jakarta'),
  ('Kota Jakarta Timur', 'kota', 'DKI Jakarta'),
  ('Kab. Bogor', 'kabupaten', 'Jawa Barat'),
  ('Kab. Sukabumi', 'kabupaten', 'Jawa Barat'),
  ('Kab. Cianjur', 'kabupaten', 'Jawa Barat'),
  ('Kab. Bandung', 'kabupaten', 'Jawa Barat'),
  ('Kab. Garut', 'kabupaten', 'Jawa Barat'),
  ('Kab. Tasikmalaya', 'kabupaten', 'Jawa Barat'),
  ('Kab. Ciamis', 'kabupaten', 'Jawa Barat'),
  ('Kab. Kuningan', 'kabupaten', 'Jawa Barat'),
  ('Kab. Cirebon', 'kabupaten', 'Jawa Barat'),
  ('Kab. Majalengka', 'kabupaten', 'Jawa Barat'),
  ('Kab. Sumedang', 'kabupaten', 'Jawa Barat'),
  ('Kab. Indramayu', 'kabupaten', 'Jawa Barat'),
  ('Kab. Subang', 'kabupaten', 'Jawa Barat'),
  ('Kab. Purwakarta', 'kabupaten', 'Jawa Barat'),
  ('Kab. Karawang', 'kabupaten', 'Jawa Barat'),
  ('Kab. Bekasi', 'kabupaten', 'Jawa Barat'),
  ('Kab. Bandung Barat', 'kabupaten', 'Jawa Barat'),
  ('Kab. Pangandaran', 'kabupaten', 'Jawa Barat'),
  ('Kota Bogor', 'kota', 'Jawa Barat'),
  ('Kota Sukabumi', 'kota', 'Jawa Barat'),
  ('Kota Bandung', 'kota', 'Jawa Barat'),
  ('Kota Cirebon', 'kota', 'Jawa Barat'),
  ('Kota Bekasi', 'kota', 'Jawa Barat'),
  ('Kota Depok', 'kota', 'Jawa Barat'),
  ('Kota Cimahi', 'kota', 'Jawa Barat'),
  ('Kota Tasikmalaya', 'kota', 'Jawa Barat'),
  ('Kota Banjar', 'kota', 'Jawa Barat'),
  ('Kab. Cilacap', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Banyumas', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Purbalingga', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Banjarnegara', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Kebumen', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Purworejo', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Wonosobo', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Magelang', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Boyolali', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Klaten', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Sukoharjo', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Wonogiri', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Karanganyar', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Sragen', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Grobogan', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Blora', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Rembang', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Pati', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Kudus', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Jepara', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Demak', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Semarang', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Temanggung', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Kendal', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Batang', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Pekalongan', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Pemalang', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Tegal', 'kabupaten', 'Jawa Tengah'),
  ('Kab. Brebes', 'kabupaten', 'Jawa Tengah'),
  ('Kota Magelang', 'kota', 'Jawa Tengah'),
  ('Kota Surakarta', 'kota', 'Jawa Tengah'),
  ('Kota Salatiga', 'kota', 'Jawa Tengah'),
  ('Kota Semarang', 'kota', 'Jawa Tengah'),
  ('Kota Pekalongan', 'kota', 'Jawa Tengah'),
  ('Kota Tegal', 'kota', 'Jawa Tengah'),
  ('Kab. Kulon Progo', 'kabupaten', 'DI Yogyakarta'),
  ('Kab. Bantul', 'kabupaten', 'DI Yogyakarta'),
  ('Kab. Gunungkidul', 'kabupaten', 'DI Yogyakarta'),
  ('Kab. Sleman', 'kabupaten', 'DI Yogyakarta'),
  ('Kota Yogyakarta', 'kota', 'DI Yogyakarta'),
  ('Kab. Pacitan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Ponorogo', 'kabupaten', 'Jawa Timur'),
  ('Kab. Trenggalek', 'kabupaten', 'Jawa Timur'),
  ('Kab. Tulungagung', 'kabupaten', 'Jawa Timur'),
  ('Kab. Blitar', 'kabupaten', 'Jawa Timur'),
  ('Kab. Kediri', 'kabupaten', 'Jawa Timur'),
  ('Kab. Malang', 'kabupaten', 'Jawa Timur'),
  ('Kab. Lumajang', 'kabupaten', 'Jawa Timur'),
  ('Kab. Jember', 'kabupaten', 'Jawa Timur'),
  ('Kab. Banyuwangi', 'kabupaten', 'Jawa Timur'),
  ('Kab. Bondowoso', 'kabupaten', 'Jawa Timur'),
  ('Kab. Situbondo', 'kabupaten', 'Jawa Timur'),
  ('Kab. Probolinggo', 'kabupaten', 'Jawa Timur'),
  ('Kab. Pasuruan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Sidoarjo', 'kabupaten', 'Jawa Timur'),
  ('Kab. Mojokerto', 'kabupaten', 'Jawa Timur'),
  ('Kab. Jombang', 'kabupaten', 'Jawa Timur'),
  ('Kab. Nganjuk', 'kabupaten', 'Jawa Timur'),
  ('Kab. Madiun', 'kabupaten', 'Jawa Timur'),
  ('Kab. Magetan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Ngawi', 'kabupaten', 'Jawa Timur'),
  ('Kab. Bojonegoro', 'kabupaten', 'Jawa Timur'),
  ('Kab. Tuban', 'kabupaten', 'Jawa Timur'),
  ('Kab. Lamongan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Gresik', 'kabupaten', 'Jawa Timur'),
  ('Kab. Bangkalan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Sampang', 'kabupaten', 'Jawa Timur'),
  ('Kab. Pamekasan', 'kabupaten', 'Jawa Timur'),
  ('Kab. Sumenep', 'kabupaten', 'Jawa Timur'),
  ('Kota Kediri', 'kota', 'Jawa Timur'),
  ('Kota Blitar', 'kota', 'Jawa Timur'),
  ('Kota Malang', 'kota', 'Jawa Timur'),
  ('Kota Probolinggo', 'kota', 'Jawa Timur'),
  ('Kota Pasuruan', 'kota', 'Jawa Timur'),
  ('Kota Mojokerto', 'kota', 'Jawa Timur'),
  ('Kota Madiun', 'kota', 'Jawa Timur'),
  ('Kota Surabaya', 'kota', 'Jawa Timur'),
  ('Kota Batu', 'kota', 'Jawa Timur'),
  ('Kab. Pandeglang', 'kabupaten', 'Banten'),
  ('Kab. Lebak', 'kabupaten', 'Banten'),
  ('Kab. Tangerang', 'kabupaten', 'Banten'),
  ('Kab. Serang', 'kabupaten', 'Banten'),
  ('Kota Tangerang', 'kota', 'Banten'),
  ('Kota Cilegon', 'kota', 'Banten'),
  ('Kota Serang', 'kota', 'Banten'),
  ('Kota Tangerang Selatan', 'kota', 'Banten')
ON CONFLICT (nama, provinsi) DO NOTHING;

INSERT INTO ref_perguruan_tinggi (nama, kota) VALUES
  ('Sekolah Tinggi Ilmu Komputer Yos Sudarso', 'Kab. Banyumas')
ON CONFLICT (nama) DO NOTHING;

ALTER TABLE ref_wilayah ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_perguruan_tinggi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "baca wilayah" ON ref_wilayah;
DROP POLICY IF EXISTS "admin kelola wilayah" ON ref_wilayah;
DROP POLICY IF EXISTS "baca pt" ON ref_perguruan_tinggi;
DROP POLICY IF EXISTS "admin kelola pt" ON ref_perguruan_tinggi;
CREATE POLICY "baca wilayah" ON ref_wilayah FOR SELECT USING (true);
CREATE POLICY "admin kelola wilayah" ON ref_wilayah FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));
CREATE POLICY "baca pt" ON ref_perguruan_tinggi FOR SELECT USING (true);
CREATE POLICY "admin kelola pt" ON ref_perguruan_tinggi FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));

-- Isian pilihan baru di biodata pemohon.
ALTER TABLE biodata_pemohon
  ADD COLUMN IF NOT EXISTS kewarganegaraan VARCHAR(3) NOT NULL DEFAULT 'WNI' CHECK (kewarganegaraan IN ('WNI', 'WNA'));
ALTER TABLE biodata_pemohon DROP CONSTRAINT IF EXISTS biodata_agama_check;
ALTER TABLE biodata_pemohon ADD CONSTRAINT biodata_agama_check CHECK (agama IS NULL OR agama IN
  ('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Kepercayaan terhadap Tuhan YME')) NOT VALID;
ALTER TABLE biodata_pemohon DROP CONSTRAINT IF EXISTS biodata_kode_pos_check;
ALTER TABLE biodata_pemohon ADD CONSTRAINT biodata_kode_pos_check CHECK (kode_pos IS NULL OR kode_pos ~ '^[0-9]{5}$') NOT VALID;

COMMIT;
