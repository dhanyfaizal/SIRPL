-- Temuan uji #19 (repositori): nama berkas dokumen menampilkan kode mentah "SURAT_HASIL",
-- dan dua Berita Acara (F11) dari dua pleno bernama sama persis.
-- Nama berkas dokumen kini memakai judul tanpa kode untuk Surat Hasil dan
-- menambahkan nomor dokumen (garis miring diganti tanda hubung agar aman untuk nama berkas).
-- Kolom view tidak berubah.
BEGIN;

CREATE OR REPLACE VIEW public.v_berkas_repositori AS
 WITH pg AS (
         SELECT p.id AS pengajuan_id,
            p.user_id,
            p.periode_id,
            p.prodi_pilihan_id AS prodi_id,
            p.status,
            p.nim,
            p.nomor_pendaftaran,
            pr_1.nama_lengkap,
            m.mekanisme,
            p.file_ijazah_url,
            p.file_transkrip_url,
            p.file_ijazah_sma_url,
            p.file_transkrip_sma_url,
            p.file_f07_ttd_url
           FROM pengajuan_rpl p
             JOIN profiles pr_1 ON pr_1.id = p.user_id
             CROSS JOIN LATERAL ( VALUES ('transfer'::text), ('perolehan'::text)) m(mekanisme)
          WHERE p.alur_versi = 2 AND (m.mekanisme = 'transfer'::text AND (p.jenis_rpl::text = ANY (ARRAY['transfer'::character varying::text, 'gabungan'::character varying::text])) OR m.mekanisme = 'perolehan'::text AND (p.jenis_rpl::text = ANY (ARRAY['perolehan'::character varying::text, 'gabungan'::character varying::text])))
        ), berkas AS (
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
            'dokumen_pendukung'::text AS kategori,
            b_1.nama,
            b_1.path,
            'pengajuan'::text AS sumber,
            NULL::uuid AS sumber_id
           FROM pg
             CROSS JOIN LATERAL ( VALUES ('Ijazah perguruan tinggi asal'::text,
                        CASE
                            WHEN pg.mekanisme = 'transfer'::text THEN pg.file_ijazah_url
                            ELSE NULL::text
                        END), ('Transkrip nilai asal'::text,
                        CASE
                            WHEN pg.mekanisme = 'transfer'::text THEN pg.file_transkrip_url
                            ELSE NULL::text
                        END), ('Ijazah SLTA'::text,pg.file_ijazah_sma_url), ('Transkrip SLTA'::text,pg.file_transkrip_sma_url), ('F07 bertanda tangan atasan'::text,pg.file_f07_ttd_url)) b_1(nama, path)
          WHERE b_1.path IS NOT NULL
        UNION ALL
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
            bp.kategori_folder,
            (('Bukti '::text || bp.nomor) || ' - '::text) || bp.nama_dokumen::text,
            bp.file_url,
            'bukti'::text AS text,
            bp.id
           FROM pg
             JOIN bukti_portofolio bp ON bp.pengajuan_id = pg.pengajuan_id
          WHERE bp.file_url IS NOT NULL AND (bp.mekanisme IS NULL OR bp.mekanisme::text = pg.mekanisme)
        UNION ALL
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
            COALESCE(d.kategori_folder, j.kategori_folder) AS "coalesce",
            (d.jenis_kode::text || ' '::text) || d.judul::text,
            d.file_path,
            'dokumen'::text AS text,
            d.id
           FROM pg
             JOIN dokumen_terbit d ON d.pengajuan_id = pg.pengajuan_id
             JOIN jenis_dokumen j ON j.kode::text = d.jenis_kode::text
          WHERE d.status::text = 'final'::text AND (d.mekanisme IS NULL OR d.mekanisme::text = pg.mekanisme)
        UNION ALL
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
                CASE
                    WHEN pl.jenis::text = 'awal'::text THEN 'pleno_awal'::text
                    ELSE 'pleno_akhir'::text
                END AS "case",
            (d.jenis_kode::text || ' '::text) || d.judul::text,
            d.file_path,
            'dokumen'::text AS text,
            d.id
           FROM pg
             JOIN pleno_pengajuan pp ON pp.pengajuan_id = pg.pengajuan_id AND pp.mekanisme::text = pg.mekanisme
             JOIN pleno_rpl pl ON pl.id = pp.pleno_id
             JOIN dokumen_terbit d ON d.pleno_id = pl.id AND d.pengajuan_id IS NULL
          WHERE d.status::text = 'final'::text
        UNION ALL
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
            'pleno_akhir'::text AS text,
            (d.jenis_kode::text || ' '::text) || d.judul::text,
            d.file_path,
            'dokumen'::text AS text,
            d.id
           FROM pg
             JOIN pengajuan_rpl p ON p.id = pg.pengajuan_id
             JOIN dokumen_terbit d ON d.sk_id = p.sk_id AND d.pengajuan_id IS NULL
          WHERE d.status::text = 'final'::text
        UNION ALL
         SELECT pg.pengajuan_id,
            pg.user_id,
            pg.periode_id,
            pg.prodi_id,
            pg.status,
            pg.nim,
            pg.nomor_pendaftaran,
            pg.nama_lengkap,
            pg.mekanisme,
            pg.file_ijazah_url,
            pg.file_transkrip_url,
            pg.file_ijazah_sma_url,
            pg.file_transkrip_sma_url,
            pg.file_f07_ttd_url,
            'penilaian'::text AS text,
            (d.jenis_kode::text || ' '::text) || d.judul::text,
            d.file_path,
            'dokumen'::text AS text,
            d.id
           FROM pg
             JOIN penugasan_asesor pa ON pa.pengajuan_id = pg.pengajuan_id
             JOIN dokumen_terbit d ON d.asesor_id = pa.asesor_id AND d.pengajuan_id IS NULL AND (d.jenis_kode::text = ANY (ARRAY['F04'::text, 'F05'::text]))
          WHERE d.status::text = 'final'::text
        )
 SELECT b.pengajuan_id,
    b.periode_id,
    b.prodi_id,
    b.mekanisme,
    b.kategori,
    b.sumber,
    b.sumber_id,
    b.status::text = ANY (ARRAY['sk_terbit'::character varying::text, 'selesai'::character varying::text]) AS sudah_sk,
    ('Pelaporan RPL Semester '::text || pr.nama::text) || COALESCE(' '::text || initcap(pr.semester::text), ''::text) AS folder_semester,
    nama_folder(ps.nama::text) AS folder_prodi,
        CASE b.mekanisme
            WHEN 'transfer'::text THEN '01_TRANSFER_KREDIT'::text
            ELSE '02_PEROLEHAN_KREDIT'::text
        END AS folder_mekanisme,
    nama_folder((COALESCE(b.nim, b.nomor_pendaftaran)::text || '_'::text) || b.nama_lengkap::text) AS folder_mahasiswa,
    nama_subfolder(b.mekanisme, b.kategori) AS subfolder,
        CASE
            WHEN b.sumber = 'dokumen'::text THEN COALESCE(( SELECT
                    CASE WHEN dt.jenis_kode::text = 'SURAT_HASIL'::text THEN dt.judul::text
                         ELSE (dt.jenis_kode::text || ' '::text) || dt.judul::text END
                    || COALESCE(' - No '::text || replace(dt.nomor::text, '/'::text, '-'::text), ''::text)
                   FROM dokumen_terbit dt WHERE dt.id = b.sumber_id), b.nama)
            ELSE b.nama
        END AS nama_berkas,
    b.path AS storage_path
   FROM berkas b
     LEFT JOIN periode_rpl pr ON pr.id = b.periode_id
     LEFT JOIN program_studi ps ON ps.id = b.prodi_id
  WHERE auth.uid() IS NULL OR boleh_lihat_repositori(b.pengajuan_id);
REVOKE ALL ON public.v_berkas_repositori FROM anon;
GRANT SELECT ON public.v_berkas_repositori TO authenticated, service_role;

COMMIT;
