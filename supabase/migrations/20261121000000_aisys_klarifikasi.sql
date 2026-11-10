-- Temuan uji #21: AISYS ditolak saat pengajuan berstatus "klarifikasi" (sanggahan
-- diproses), padahal asesor boleh merevisi penilaian pada status itu.
BEGIN;

CREATE OR REPLACE FUNCTION public.cek_aisys(p_pengajuan uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'Silakan masuk terlebih dahulu'; END IF;
  SELECT status INTO v_status FROM pengajuan_rpl WHERE id = p_pengajuan;
  IF NOT FOUND THEN RETURN 'Pengajuan tidak ditemukan'; END IF;
  IF NOT (public.saya_asesor(p_pengajuan) OR public.punya_peran('admin', 'ketua_tim')) THEN
    RETURN 'AISYS hanya dapat dipakai oleh asesor yang ditugaskan pada pengajuan ini';
  END IF;
  IF v_status NOT IN ('asesmen', 'menunggu_bukti_tambahan', 'penilaian_lanjutan', 'klarifikasi') THEN
    RETURN 'Pengajuan tidak sedang dalam tahap penilaian';
  END IF;
  SELECT count(*) INTO v_n FROM penggunaan_aisys WHERE pengguna_id = auth.uid() AND created_at > now() - interval '1 day';
  IF v_n >= 40 THEN RETURN 'Batas pemakaian AISYS hari ini (40 kali) sudah tercapai'; END IF;
  RETURN NULL;
END $$;

COMMIT;
