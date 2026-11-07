-- =========================================================================
-- Mesin dokumen: penerbitan, tanda tangan digital ber-QR, finalisasi.
--
--   * terbitkan_dokumen   : menyimpan isi (snapshot JSON), mengambil nomor
--                            (bila bernomor), dan menyiapkan penanda tangan.
--   * tandatangani_dokumen: saat penanda tangan terakhir menandatangani,
--                            dokumen final dengan sidik SHA-256 atas isinya.
--   * Dokumen dirender dari snapshot (halaman cetak A4); sidik SHA-256
--     ditampilkan di halaman verifikasi QR sehingga isi tidak dapat diubah.
--
-- Aman dijalankan ulang.
-- =========================================================================
BEGIN;

-- Penanda tangan tetap untuk sumber "peran" (mis. Ketua STIKOM tertentu)
ALTER TABLE penandatangan_dokumen ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "admin kelola penandatangan" ON penandatangan_dokumen;
CREATE POLICY "admin kelola penandatangan" ON penandatangan_dokumen FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));

-- Format dan nomor awal diatur admin atau Ketua Tim
DROP POLICY IF EXISTS "admin atur penomoran" ON penomoran_dokumen;
CREATE POLICY "admin atur penomoran" ON penomoran_dokumen FOR UPDATE TO authenticated
  USING (public.punya_peran('admin', 'ketua_tim')) WITH CHECK (public.punya_peran('admin', 'ketua_tim'));

-- Nomor unik per jenis untuk dokumen yang berlaku. Dokumen yang digantikan
-- melepas nomornya; F08 (lampiran SK per pemohon) memakai nomor SK yang sama.
DROP INDEX IF EXISTS dokumen_terbit_nomor_unik;
CREATE UNIQUE INDEX dokumen_terbit_nomor_unik ON dokumen_terbit (jenis_kode, nomor)
  WHERE nomor IS NOT NULL AND status <> 'dicabut' AND jenis_kode <> 'F08';

CREATE OR REPLACE FUNCTION public.label_peran(p_role text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'ketua_tim' THEN 'Ketua Tim Pengelola RPL' WHEN 'sekretaris' THEN 'Sekretaris Tim Pengelola RPL'
    WHEN 'asessor' THEN 'Asesor' WHEN 'komite' THEN 'Komite RPL' WHEN 'eksekutif' THEN 'Pimpinan'
    WHEN 'admin' THEN 'Administrator' WHEN 'baak' THEN 'BAAK' WHEN 'lpmp' THEN 'LPMP'
    WHEN 'calon_rpl' THEN 'Pemohon'
    ELSE CASE WHEN p_role LIKE 'kaprodi_%' THEN 'Koordinator Program Studi' ELSE initcap(replace(p_role, '_', ' ')) END
  END
$$;

-- -------------------------------------------------------------------------
-- terbitkan_dokumen
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.terbitkan_dokumen(
  p_jenis text, p_isi jsonb, p_judul text,
  p_pengajuan uuid DEFAULT NULL, p_pleno uuid DEFAULT NULL, p_sk uuid DEFAULT NULL,
  p_jadwal uuid DEFAULT NULL, p_klarifikasi uuid DEFAULT NULL,
  p_tanggal date DEFAULT CURRENT_DATE, p_nomor text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jenis jenis_dokumen%ROWTYPE; v_p pengajuan_rpl%ROWTYPE; v_pleno pleno_rpl%ROWTYPE;
  v_prodi uuid; v_kode_prodi text; v_nomor text := nullif(btrim(p_nomor), ''); v_id uuid; v_lama uuid;
  s record; v_urut int := 0; v_orang record;
BEGIN
  SELECT * INTO v_jenis FROM jenis_dokumen WHERE kode = p_jenis;
  IF v_jenis.kode IS NULL THEN RAISE EXCEPTION 'Jenis dokumen % tidak dikenal', p_jenis; END IF;
  IF p_pengajuan IS NOT NULL THEN SELECT * INTO v_p FROM pengajuan_rpl WHERE id = p_pengajuan; END IF;
  IF p_pleno IS NOT NULL THEN SELECT * INTO v_pleno FROM pleno_rpl WHERE id = p_pleno; END IF;

  IF NOT (public.punya_peran('admin', 'ketua_tim', 'sekretaris')
       OR (p_jenis = 'F08' AND public.punya_peran('eksekutif'))
       OR (p_jenis IN ('F03', 'F09', 'F10') AND p_pengajuan IS NOT NULL AND public.saya_asesor(p_pengajuan))) THEN
    RAISE EXCEPTION 'Tidak berwenang menerbitkan dokumen %', p_jenis;
  END IF;
  IF p_isi IS NULL OR jsonb_typeof(p_isi) <> 'object' THEN RAISE EXCEPTION 'Isi dokumen kosong'; END IF;

  v_prodi := coalesce(v_p.prodi_pilihan_id, v_pleno.prodi_id, (SELECT prodi_id FROM sk_rekognisi WHERE id = p_sk));
  SELECT kode INTO v_kode_prodi FROM program_studi WHERE id = v_prodi;

  -- Dokumen sebelumnya dengan sasaran yang sama digantikan.
  SELECT id INTO v_lama FROM dokumen_terbit
  WHERE jenis_kode = p_jenis AND status <> 'dicabut'
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
    klarifikasi_id, periode_id, prodi_id, kategori_folder, isi_snapshot, status, menggantikan_id, dibuat_oleh)
  VALUES (p_jenis, v_nomor, p_tanggal, coalesce(nullif(btrim(p_judul), ''), v_jenis.nama), p_pengajuan, p_pleno, p_sk,
    p_jadwal, p_klarifikasi, coalesce(v_p.periode_id, v_pleno.periode_id, (SELECT id FROM periode_rpl WHERE is_aktif LIMIT 1)),
    v_prodi, v_jenis.kategori_folder, p_isi, 'menunggu_ttd', v_lama, auth.uid())
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
      FOR v_orang IN SELECT pr.id, pr.nama_lengkap,
                       coalesce(s.label_jabatan, 'Asesor') || CASE pa.peran WHEN 'koordinator' THEN ' (Koordinator)' ELSE '' END AS jab
                     FROM penugasan_asesor pa JOIN profiles pr ON pr.id = pa.asesor_id
                     WHERE pa.pengajuan_id = p_pengajuan
                     ORDER BY (pa.peran = 'koordinator') DESC, pr.nama_lengkap LOOP
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

-- -------------------------------------------------------------------------
-- Tanda tangan; penanda tangan terakhir memfinalkan dokumen.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tandatangani_dokumen(p_ttd uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tanda_tangan_dokumen; v_sisa int; v_isi jsonb;
BEGIN
  SELECT * INTO r FROM tanda_tangan_dokumen WHERE id = p_ttd FOR UPDATE;
  IF NOT FOUND OR r.penandatangan_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Tanda tangan ini bukan milik Anda';
  END IF;
  IF r.status <> 'menunggu' THEN RAISE EXCEPTION 'Dokumen ini sudah Anda tanggapi'; END IF;
  SELECT isi_snapshot INTO v_isi FROM dokumen_terbit WHERE id = r.dokumen_id AND status = 'menunggu_ttd' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak dalam status menunggu tanda tangan'; END IF;

  UPDATE tanda_tangan_dokumen SET status = 'ditandatangani', ditandatangani_at = NOW() WHERE id = p_ttd;
  SELECT count(*) INTO v_sisa FROM tanda_tangan_dokumen WHERE dokumen_id = r.dokumen_id AND status <> 'ditandatangani';
  IF v_sisa = 0 THEN
    UPDATE dokumen_terbit SET status = 'final', final_at = NOW(),
      file_path = 'snapshot:' || id::text,
      sha256 = encode(sha256(convert_to(v_isi::text, 'UTF8')), 'hex'),
      ukuran_byte = octet_length(v_isi::text)
    WHERE id = r.dokumen_id;
  END IF;
  RETURN jsonb_build_object('dokumen_id', r.dokumen_id, 'kode_verifikasi', r.kode_verifikasi, 'semua_sudah', v_sisa = 0);
END $$;

-- Pemohon menolak bila isi tidak sesuai; dokumen perlu diterbitkan ulang.
CREATE OR REPLACE FUNCTION public.tolak_tanda_tangan(p_ttd uuid, p_catatan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tanda_tangan_dokumen;
BEGIN
  SELECT * INTO r FROM tanda_tangan_dokumen WHERE id = p_ttd FOR UPDATE;
  IF NOT FOUND OR r.penandatangan_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Tanda tangan ini bukan milik Anda'; END IF;
  IF r.status <> 'menunggu' THEN RAISE EXCEPTION 'Dokumen ini sudah Anda tanggapi'; END IF;
  IF coalesce(btrim(p_catatan), '') = '' THEN RAISE EXCEPTION 'Tuliskan bagian yang tidak sesuai'; END IF;
  UPDATE tanda_tangan_dokumen SET status = 'ditolak', catatan_tolak = btrim(p_catatan) WHERE id = p_ttd;
END $$;
REVOKE ALL ON FUNCTION public.tolak_tanda_tangan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tolak_tanda_tangan(uuid, text) TO authenticated;

-- Verifikasi publik juga menampilkan dokumen pengganti bila ada.
CREATE OR REPLACE FUNCTION public.verifikasi_dokumen(p_kode text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'status', CASE WHEN d.status = 'dicabut' THEN 'dicabut' WHEN d.status = 'final' THEN 'sah' ELSE 'belum_final' END,
    'jenis_kode', d.jenis_kode, 'jenis_dokumen', j.nama, 'judul', d.judul, 'nomor', d.nomor,
    'tanggal_dokumen', d.tanggal_dokumen,
    'pemilik', (SELECT pr.nama_lengkap FROM pengajuan_rpl p JOIN profiles pr ON pr.id = p.user_id WHERE p.id = d.pengajuan_id),
    'nomor_pendaftaran', (SELECT p.nomor_pendaftaran FROM pengajuan_rpl p WHERE p.id = d.pengajuan_id),
    'program_studi', (SELECT ps.nama FROM program_studi ps WHERE ps.id = d.prodi_id),
    'penandatangan', t.nama_snapshot, 'jabatan', t.jabatan_snapshot, 'ditandatangani_at', t.ditandatangani_at,
    'semua_penandatangan', (SELECT jsonb_agg(jsonb_build_object('nama', x.nama_snapshot, 'jabatan', x.jabatan_snapshot,
                              'status', x.status, 'waktu', x.ditandatangani_at) ORDER BY x.urutan)
                            FROM tanda_tangan_dokumen x WHERE x.dokumen_id = d.id),
    'sha256', d.sha256, 'final_at', d.final_at, 'dicabut_at', d.dicabut_at, 'alasan_cabut', d.alasan_cabut,
    'diganti', EXISTS (SELECT 1 FROM dokumen_terbit g WHERE g.menggantikan_id = d.id))
  FROM tanda_tangan_dokumen t
  JOIN dokumen_terbit d ON d.id = t.dokumen_id
  JOIN jenis_dokumen j ON j.kode = d.jenis_kode
  WHERE t.kode_verifikasi = upper(btrim(p_kode)) AND t.status = 'ditandatangani'
$$;
REVOKE ALL ON FUNCTION public.verifikasi_dokumen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifikasi_dokumen(text) TO anon, authenticated;

COMMIT;
