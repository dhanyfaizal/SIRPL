-- =========================================================================
-- Laporan dan analitik RPL untuk pimpinan, LPM, Tim, dan Ka. Prodi.
-- Data dikembalikan per pengajuan tanpa identitas pemohon; Ka. Prodi hanya
-- melihat program studinya sendiri. Aman dijalankan ulang.
-- =========================================================================

-- Program studi yang boleh dilihat pengguna saat ini (null = semua).
CREATE OR REPLACE FUNCTION public.prodi_laporan_saya()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_prodi uuid;
BEGIN
  SELECT role, prodi_id INTO v_role, v_prodi FROM profiles WHERE id = auth.uid();
  IF v_role IN ('admin', 'eksekutif', 'komite', 'lpmp', 'ketua_tim', 'sekretaris', 'baak', 'pmb') THEN
    RETURN NULL;
  END IF;
  IF v_role LIKE 'kaprodi_%' THEN
    IF v_prodi IS NULL THEN
      SELECT id INTO v_prodi FROM program_studi
      WHERE upper(kode) = CASE v_role WHEN 'kaprodi_si' THEN 'SI' WHEN 'kaprodi_ti' THEN 'IF' WHEN 'kaprodi_dkv' THEN 'DKV' WHEN 'kaprodi_ka' THEN 'KA' END
         OR (v_role = 'kaprodi_ti' AND upper(kode) = 'TI')
      LIMIT 1;
    END IF;
    IF v_prodi IS NULL THEN RAISE EXCEPTION 'Akun Ka. Prodi belum dihubungkan dengan program studi. Hubungi Admin'; END IF;
    RETURN v_prodi;
  END IF;
  RAISE EXCEPTION 'Peran Anda tidak dapat membuka laporan RPL';
END $$;

CREATE OR REPLACE FUNCTION public.laporan_rpl()
RETURNS TABLE (
  id uuid, prodi_id uuid, periode_id uuid, jenis_rpl text, status text, status_pelaporan text,
  submitted_at timestamptz, tanggal_sk date, sks_diajukan int, sks_diakui int,
  pt_asal text, terbayar numeric, potongan numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prodi uuid := public.prodi_laporan_saya();
BEGIN
  RETURN QUERY
  SELECT p.id, p.prodi_pilihan_id, p.periode_id, p.jenis_rpl::text, p.status::text, p.status_pelaporan::text,
    p.submitted_at, s.tanggal_sk,
    (SELECT coalesce(sum(m.sks), 0)::int FROM mk_diajukan d JOIN mata_kuliah_kurikulum m ON m.id = d.mk_id WHERE d.pengajuan_id = p.id),
    pa.total_sks_diakui::int,
    nullif(btrim(p.pt_asal), ''),
    (SELECT coalesce(sum(b.jumlah), 0) FROM pembayaran_rpl b WHERE b.pengajuan_id = p.id AND b.status = 'lunas'),
    (SELECT coalesce(sum(t.potongan), 0) FROM tagihan_rpl t WHERE t.pengajuan_id = p.id)
  FROM pengajuan_rpl p
  LEFT JOIN sk_rekognisi s ON s.id = p.sk_id
  LEFT JOIN penetapan_akhir pa ON pa.pengajuan_id = p.id
  WHERE p.alur_versi IS DISTINCT FROM 1 AND p.status <> 'draft'
    AND (v_prodi IS NULL OR p.prodi_pilihan_id = v_prodi);
END $$;

-- Rata-rata kepuasan layanan (skala 1-5) per pengajuan, tanpa komentar.
CREATE OR REPLACE FUNCTION public.laporan_kepuasan()
RETURNS TABLE (pengajuan_id uuid, kemudahan numeric, kejelasan numeric, kecepatan numeric, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prodi uuid := public.prodi_laporan_saya();
BEGIN
  RETURN QUERY
  SELECT f.pengajuan_id, f.rating_kemudahan::numeric, f.rating_kejelasan::numeric, f.rating_kecepatan::numeric, f.created_at
  FROM feedback_pelayanan f
  JOIN pengajuan_rpl p ON p.id = f.pengajuan_id
  WHERE p.alur_versi IS DISTINCT FROM 1 AND (v_prodi IS NULL OR p.prodi_pilihan_id = v_prodi);
END $$;

REVOKE EXECUTE ON FUNCTION public.prodi_laporan_saya() FROM anon;
REVOKE EXECUTE ON FUNCTION public.laporan_rpl() FROM anon;
REVOKE EXECUTE ON FUNCTION public.laporan_kepuasan() FROM anon;
