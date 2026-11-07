-- =========================================================================
-- Repositori pelaporan dan tautan berbagi; biodata asesor (F04/F05).
--
--   * Repositori mengikuti struktur folder pelaporan LLDIKTI:
--       Pelaporan RPL Semester .. / PRODI / 01_TRANSFER_KREDIT | 02_PEROLEHAN_KREDIT
--       / NIM_NAMA / 01_DOKUMEN_PENDUKUNG ... (pemohon gabungan muncul di dua folder)
--   * Pengguna internal membuka repositori setelah login (v_berkas_repositori).
--   * Pihak luar (LLDIKTI, asesor eksternal) memakai tautan berbagi dengan masa
--     berlaku dan kata sandi opsional. Tautan diperiksa Edge Function
--     "repositori" memakai service role; isi tidak pernah dibuka untuk anon.
--   * F04/F05 diterbitkan asesor sendiri dan masuk folder penilaian setiap
--     pengajuan yang ia nilai.
-- Aman dijalankan ulang.
-- =========================================================================
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
           FROM ((pengajuan_rpl p
             JOIN profiles pr_1 ON ((pr_1.id = p.user_id)))
             CROSS JOIN LATERAL ( VALUES ('transfer'::text), ('perolehan'::text)) m(mekanisme))
          WHERE ((p.alur_versi = 2) AND (((m.mekanisme = 'transfer'::text) AND ((p.jenis_rpl)::text = ANY ((ARRAY['transfer'::character varying, 'gabungan'::character varying])::text[]))) OR ((m.mekanisme = 'perolehan'::text) AND ((p.jenis_rpl)::text = ANY ((ARRAY['perolehan'::character varying, 'gabungan'::character varying])::text[])))))
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
           FROM (pg
             CROSS JOIN LATERAL ( VALUES ('Ijazah perguruan tinggi asal'::text,
                        CASE
                            WHEN (pg.mekanisme = 'transfer'::text) THEN pg.file_ijazah_url
                            ELSE NULL::text
                        END), ('Transkrip nilai asal'::text,
                        CASE
                            WHEN (pg.mekanisme = 'transfer'::text) THEN pg.file_transkrip_url
                            ELSE NULL::text
                        END), ('Ijazah SLTA'::text,pg.file_ijazah_sma_url), ('Transkrip SLTA'::text,pg.file_transkrip_sma_url), ('F07 bertanda tangan atasan'::text,pg.file_f07_ttd_url)) b_1(nama, path))
          WHERE (b_1.path IS NOT NULL)
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
            ((('Bukti '::text || bp.nomor) || ' - '::text) || (bp.nama_dokumen)::text),
            bp.file_url,
            'bukti'::text,
            bp.id
           FROM (pg
             JOIN bukti_portofolio bp ON ((bp.pengajuan_id = pg.pengajuan_id)))
          WHERE ((bp.file_url IS NOT NULL) AND ((bp.mekanisme IS NULL) OR ((bp.mekanisme)::text = pg.mekanisme)))
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
            (((d.jenis_kode)::text || ' '::text) || (d.judul)::text),
            d.file_path,
            'dokumen'::text,
            d.id
           FROM ((pg
             JOIN dokumen_terbit d ON ((d.pengajuan_id = pg.pengajuan_id)))
             JOIN jenis_dokumen j ON (((j.kode)::text = (d.jenis_kode)::text)))
          WHERE (((d.status)::text = 'final'::text) AND ((d.mekanisme IS NULL) OR ((d.mekanisme)::text = pg.mekanisme)))
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
                    WHEN ((pl.jenis)::text = 'awal'::text) THEN 'pleno_awal'::text
                    ELSE 'pleno_akhir'::text
                END AS "case",
            (((d.jenis_kode)::text || ' '::text) || (d.judul)::text),
            d.file_path,
            'dokumen'::text,
            d.id
           FROM (((pg
             JOIN pleno_pengajuan pp ON (((pp.pengajuan_id = pg.pengajuan_id) AND ((pp.mekanisme)::text = pg.mekanisme))))
             JOIN pleno_rpl pl ON ((pl.id = pp.pleno_id)))
             JOIN dokumen_terbit d ON (((d.pleno_id = pl.id) AND (d.pengajuan_id IS NULL))))
          WHERE ((d.status)::text = 'final'::text)
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
            'pleno_akhir'::text,
            (((d.jenis_kode)::text || ' '::text) || (d.judul)::text),
            d.file_path,
            'dokumen'::text,
            d.id
           FROM ((pg
             JOIN pengajuan_rpl p ON ((p.id = pg.pengajuan_id)))
             JOIN dokumen_terbit d ON (((d.sk_id = p.sk_id) AND (d.pengajuan_id IS NULL))))
          WHERE ((d.status)::text = 'final'::text)
        UNION ALL
         SELECT pg.pengajuan_id, pg.user_id, pg.periode_id, pg.prodi_id, pg.status, pg.nim, pg.nomor_pendaftaran, pg.nama_lengkap,
            pg.mekanisme, pg.file_ijazah_url, pg.file_transkrip_url, pg.file_ijazah_sma_url, pg.file_transkrip_sma_url, pg.file_f07_ttd_url,
            'penilaian'::text, (((d.jenis_kode)::text || ' '::text) || (d.judul)::text), d.file_path, 'dokumen'::text, d.id
           FROM pg
             JOIN penugasan_asesor pa ON pa.pengajuan_id = pg.pengajuan_id
             JOIN dokumen_terbit d ON d.asesor_id = pa.asesor_id AND d.pengajuan_id IS NULL AND (d.jenis_kode)::text IN ('F04', 'F05')
          WHERE (d.status)::text = 'final'
        )
 SELECT b.pengajuan_id,
    b.periode_id,
    b.prodi_id,
    b.mekanisme,
    b.kategori,
    b.sumber,
    b.sumber_id,
    ((b.status)::text = ANY ((ARRAY['sk_terbit'::character varying, 'selesai'::character varying])::text[])) AS sudah_sk,
    (('Pelaporan RPL Semester '::text || (pr.nama)::text) || COALESCE((' '::text || initcap((pr.semester)::text)), ''::text)) AS folder_semester,
    nama_folder((ps.nama)::text) AS folder_prodi,
        CASE b.mekanisme
            WHEN 'transfer'::text THEN '01_TRANSFER_KREDIT'::text
            ELSE '02_PEROLEHAN_KREDIT'::text
        END AS folder_mekanisme,
    nama_folder((((COALESCE(b.nim, b.nomor_pendaftaran))::text || '_'::text) || (b.nama_lengkap)::text)) AS folder_mahasiswa,
    nama_subfolder(b.mekanisme, b.kategori) AS subfolder,
    b.nama AS nama_berkas,
    b.path AS storage_path
   FROM ((berkas b
     LEFT JOIN periode_rpl pr ON ((pr.id = b.periode_id)))
     LEFT JOIN program_studi ps ON ((ps.id = b.prodi_id)))
  WHERE ((auth.uid() IS NULL) OR boleh_lihat_repositori(b.pengajuan_id));
REVOKE ALL ON public.v_berkas_repositori FROM anon;
GRANT SELECT ON public.v_berkas_repositori TO authenticated, service_role;

-- Tautan berbagi: dibuat dan dicabut Admin atau Ketua Tim
DROP POLICY IF EXISTS "admin baca tautan" ON tautan_berbagi;
CREATE POLICY "admin baca tautan" ON tautan_berbagi FOR SELECT TO authenticated USING (public.punya_peran('admin', 'ketua_tim'));
DROP POLICY IF EXISTS "admin cabut tautan" ON tautan_berbagi;
CREATE POLICY "admin cabut tautan" ON tautan_berbagi FOR UPDATE TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim')) WITH CHECK (public.punya_peran('admin', 'ketua_tim'));
DROP POLICY IF EXISTS "admin baca log akses" ON log_akses_repositori;
CREATE POLICY "admin baca log akses" ON log_akses_repositori FOR SELECT TO authenticated USING (public.punya_peran('admin', 'ketua_tim', 'lpmp'));

CREATE OR REPLACE FUNCTION public.buat_tautan_berbagi(p_nama text, p_periode uuid, p_prodi_ids uuid[] DEFAULT '{}'::uuid[],
  p_mekanisme text DEFAULT NULL, p_pengajuan_ids uuid[] DEFAULT '{}'::uuid[], p_kedaluwarsa timestamptz DEFAULT NULL,
  p_kata_sandi text DEFAULT NULL)
RETURNS tautan_berbagi LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tautan_berbagi;
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN RAISE EXCEPTION 'Tautan berbagi dibuat oleh Admin atau Ketua Tim Pengelola RPL'; END IF;
  IF coalesce(btrim(p_nama), '') = '' THEN RAISE EXCEPTION 'Beri nama tautan, mis. "LLDIKTI Wilayah VI"'; END IF;
  IF p_kedaluwarsa IS NOT NULL AND p_kedaluwarsa <= NOW() THEN RAISE EXCEPTION 'Tanggal kedaluwarsa harus di masa depan'; END IF;
  IF p_kata_sandi IS NOT NULL AND length(p_kata_sandi) < 8 THEN RAISE EXCEPTION 'Kata sandi minimal 8 karakter'; END IF;
  IF p_mekanisme IS NOT NULL AND p_mekanisme NOT IN ('transfer', 'perolehan') THEN RAISE EXCEPTION 'Mekanisme tidak dikenal'; END IF;
  INSERT INTO tautan_berbagi (nama, periode_id, prodi_ids, mekanisme, pengajuan_ids, kedaluwarsa_at, kata_sandi_hash, dibuat_oleh)
  VALUES (btrim(p_nama), p_periode, coalesce(p_prodi_ids, '{}'), p_mekanisme, coalesce(p_pengajuan_ids, '{}'), p_kedaluwarsa,
          CASE WHEN p_kata_sandi IS NOT NULL THEN extensions.crypt(p_kata_sandi, extensions.gen_salt('bf', 10)) END, auth.uid())
  RETURNING * INTO r;
  r.kata_sandi_hash := CASE WHEN r.kata_sandi_hash IS NOT NULL THEN 'ada' END;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.buat_tautan_berbagi(text, uuid, uuid[], text, uuid[], timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buat_tautan_berbagi(text, uuid, uuid[], text, uuid[], timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cabut_tautan_berbagi(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  UPDATE tautan_berbagi SET dicabut_at = NOW() WHERE id = p_id AND dicabut_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.cabut_tautan_berbagi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cabut_tautan_berbagi(uuid) TO authenticated;

-- Pencatatan akses lewat tautan (dipanggil Edge Function dengan service role)
CREATE OR REPLACE FUNCTION public.catat_akses_tautan(p_tautan uuid, p_aksi text, p_path text, p_ip text, p_ua text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO log_akses_repositori (tautan_id, aksi, path, ip, user_agent) VALUES (p_tautan, p_aksi, left(p_path, 500), left(p_ip, 64), left(p_ua, 300))
$$;
REVOKE ALL ON FUNCTION public.catat_akses_tautan(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catat_akses_tautan(uuid, text, text, text, text) TO service_role;

-- Biodata asesor (F04/F05) diterbitkan sendiri oleh asesor
CREATE OR REPLACE FUNCTION public.terbitkan_dokumen(
  p_jenis text, p_isi jsonb, p_judul text,
  p_pengajuan uuid DEFAULT NULL, p_pleno uuid DEFAULT NULL, p_sk uuid DEFAULT NULL,
  p_jadwal uuid DEFAULT NULL, p_klarifikasi uuid DEFAULT NULL,
  p_tanggal date DEFAULT CURRENT_DATE, p_nomor text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jenis jenis_dokumen%ROWTYPE; v_p pengajuan_rpl%ROWTYPE; v_pleno pleno_rpl%ROWTYPE;
  v_prodi uuid; v_kode_prodi text; v_nomor text := nullif(btrim(p_nomor), ''); v_id uuid; v_lama uuid;
  s record; v_urut int := 0; v_orang record; v_asesor uuid;
BEGIN
  SELECT * INTO v_jenis FROM jenis_dokumen WHERE kode = p_jenis;
  IF v_jenis.kode IS NULL THEN RAISE EXCEPTION 'Jenis dokumen % tidak dikenal', p_jenis; END IF;
  IF p_pengajuan IS NOT NULL THEN SELECT * INTO v_p FROM pengajuan_rpl WHERE id = p_pengajuan; END IF;
  IF p_pleno IS NOT NULL THEN SELECT * INTO v_pleno FROM pleno_rpl WHERE id = p_pleno; END IF;

  IF NOT (public.punya_peran('admin', 'ketua_tim', 'sekretaris')
       OR (p_jenis = 'F08' AND public.punya_peran('eksekutif'))
       OR (p_jenis IN ('F03', 'F09', 'F10') AND p_pengajuan IS NOT NULL AND public.saya_asesor(p_pengajuan))
       OR (p_jenis IN ('F04', 'F05') AND p_pengajuan IS NULL
           AND public.punya_peran('asessor', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka'))) THEN
    RAISE EXCEPTION 'Tidak berwenang menerbitkan dokumen %', p_jenis;
  END IF;
  IF p_isi IS NULL OR jsonb_typeof(p_isi) <> 'object' THEN RAISE EXCEPTION 'Isi dokumen kosong'; END IF;

  v_prodi := coalesce(v_p.prodi_pilihan_id, v_pleno.prodi_id, (SELECT prodi_id FROM sk_rekognisi WHERE id = p_sk));
  SELECT kode INTO v_kode_prodi FROM program_studi WHERE id = v_prodi;

  -- Biodata asesor (F04/F05) milik asesor yang menerbitkannya.
  IF p_jenis IN ('F04', 'F05') THEN v_asesor := auth.uid(); END IF;

  -- Dokumen sebelumnya dengan sasaran yang sama digantikan.
  SELECT id INTO v_lama FROM dokumen_terbit
  WHERE jenis_kode = p_jenis AND status <> 'dicabut' AND asesor_id IS NOT DISTINCT FROM v_asesor
    AND pengajuan_id IS NOT DISTINCT FROM p_pengajuan AND pleno_id IS NOT DISTINCT FROM p_pleno
    AND sk_id IS NOT DISTINCT FROM p_sk AND jadwal_id IS NOT DISTINCT FROM p_jadwal
    AND klarifikasi_id IS NOT DISTINCT FROM p_klarifikasi
  ORDER BY created_at DESC LIMIT 1;
  IF v_lama IS NOT NULL THEN
    -- Nomor dokumen lama dipakai lagi agar tidak ada nomor yang hilang.
    IF v_nomor IS NULL THEN SELECT nomor INTO v_nomor FROM dokumen_terbit WHERE id = v_lama; END IF;
    UPDATE dokumen_terbit SET status = 'dicabut', dicabut_at = NOW(), alasan_cabut = 'Digantikan dokumen terbitan baru'
    WHERE id = v_lama;
  END IF;
  IF v_nomor IS NULL AND v_jenis.bernomor THEN
    SELECT n INTO v_nomor FROM public.ambil_nomor_dokumen(p_jenis, 1, p_tanggal, v_kode_prodi) AS n LIMIT 1;
  END IF;

  INSERT INTO dokumen_terbit (jenis_kode, nomor, tanggal_dokumen, judul, pengajuan_id, pleno_id, sk_id, jadwal_id,
    klarifikasi_id, periode_id, prodi_id, kategori_folder, isi_snapshot, status, menggantikan_id, dibuat_oleh, asesor_id)
  VALUES (p_jenis, v_nomor, p_tanggal, coalesce(nullif(btrim(p_judul), ''), v_jenis.nama), p_pengajuan, p_pleno, p_sk,
    p_jadwal, p_klarifikasi, coalesce(v_p.periode_id, v_pleno.periode_id, (SELECT id FROM periode_rpl WHERE is_aktif LIMIT 1)),
    v_prodi, coalesce(v_jenis.kategori_folder, CASE WHEN p_jenis IN ('F04', 'F05') THEN 'penilaian' END), p_isi, 'menunggu_ttd', v_lama, auth.uid(), v_asesor)
  RETURNING id INTO v_id;

  -- Penanda tangan sesuai pengaturan per jenis dokumen
  FOR s IN SELECT * FROM penandatangan_dokumen WHERE jenis_kode = p_jenis ORDER BY urutan LOOP
    IF s.sumber = 'pemohon' THEN
      FOR v_orang IN SELECT pr.id, pr.nama_lengkap, coalesce(s.label_jabatan, 'Pemohon') AS jab
                     FROM profiles pr WHERE pr.id = v_p.user_id LOOP
        v_urut := v_urut + 1;
        INSERT INTO tanda_tangan_dokumen (dokumen_id, penandatangan_id, nama_snapshot, jabatan_snapshot, urutan)
        VALUES (v_id, v_orang.id, v_orang.nama_lengkap, v_orang.jab, v_urut);
      END LOOP;
    ELSIF s.sumber = 'asesor_ditugaskan' THEN
      FOR v_orang IN SELECT x.id, x.nama_lengkap, x.jab FROM (
                       SELECT pr.id, pr.nama_lengkap, pa.peran,
                         coalesce(s.label_jabatan, 'Asesor') || CASE pa.peran WHEN 'koordinator' THEN ' (Koordinator)' ELSE '' END AS jab
                       FROM penugasan_asesor pa JOIN profiles pr ON pr.id = pa.asesor_id
                       WHERE pa.pengajuan_id = p_pengajuan
                       UNION ALL
                       SELECT pr.id, pr.nama_lengkap, 'anggota', coalesce(s.label_jabatan, 'Asesor')
                       FROM profiles pr WHERE p_pengajuan IS NULL AND pr.id = v_asesor) x
                     ORDER BY (x.peran = 'koordinator') DESC, x.nama_lengkap LOOP
        v_urut := v_urut + 1;
        INSERT INTO tanda_tangan_dokumen (dokumen_id, penandatangan_id, nama_snapshot, jabatan_snapshot, urutan)
        VALUES (v_id, v_orang.id, v_orang.nama_lengkap, v_orang.jab, v_urut);
      END LOOP;
    ELSIF s.sumber = 'peserta_pleno' THEN
      FOR v_orang IN SELECT pr.id, pr.nama_lengkap, coalesce(pp.jabatan_dalam_pleno, public.label_peran(pr.role::text)) AS jab
                     FROM peserta_pleno pp JOIN profiles pr ON pr.id = pp.profile_id
                     WHERE pp.pleno_id = p_pleno ORDER BY pp.urutan, pr.nama_lengkap LOOP
        v_urut := v_urut + 1;
        INSERT INTO tanda_tangan_dokumen (dokumen_id, penandatangan_id, nama_snapshot, jabatan_snapshot, urutan)
        VALUES (v_id, v_orang.id, v_orang.nama_lengkap, v_orang.jab, v_urut);
      END LOOP;
    ELSIF s.sumber = 'peran' THEN
      SELECT pr.id, pr.nama_lengkap INTO v_orang FROM profiles pr
      WHERE pr.id = s.profile_id OR (s.profile_id IS NULL AND pr.role::text = s.peran)
      ORDER BY (pr.id = s.profile_id) DESC NULLS LAST, pr.created_at LIMIT 1;
      IF v_orang.id IS NULL THEN
        RAISE EXCEPTION 'Belum ada pengguna dengan peran % untuk menandatangani %', public.label_peran(s.peran), v_jenis.nama;
      END IF;
      v_urut := v_urut + 1;
      INSERT INTO tanda_tangan_dokumen (dokumen_id, penandatangan_id, nama_snapshot, jabatan_snapshot, urutan)
      VALUES (v_id, v_orang.id, v_orang.nama_lengkap, coalesce(s.label_jabatan, public.label_peran(s.peran)), v_urut);
    END IF;
  END LOOP;
  IF v_urut = 0 THEN
    RAISE EXCEPTION 'Penanda tangan % belum tersedia (mis. asesor belum ditugaskan atau peserta pleno kosong)', v_jenis.nama;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.terbitkan_dokumen(text, jsonb, text, uuid, uuid, uuid, uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terbitkan_dokumen(text, jsonb, text, uuid, uuid, uuid, uuid, uuid, date, text) TO authenticated;
COMMIT;
