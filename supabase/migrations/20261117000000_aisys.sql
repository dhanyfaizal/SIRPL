-- =========================================================================
-- AISYS di server: kunci API hanya di Edge Function "aisys".
-- Pemakaian dicatat dan dibatasi per pengguna per hari.
-- Aman dijalankan ulang.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.penggunaan_aisys (
  id bigserial PRIMARY KEY,
  pengguna_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pengajuan_id uuid REFERENCES pengajuan_rpl(id) ON DELETE SET NULL,
  tugas varchar(40) NOT NULL,
  berhasil boolean NOT NULL DEFAULT true,
  model varchar(80),
  token_masuk int,
  token_keluar int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS penggunaan_aisys_harian ON public.penggunaan_aisys (pengguna_id, created_at DESC);
ALTER TABLE public.penggunaan_aisys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin baca penggunaan aisys" ON public.penggunaan_aisys;
CREATE POLICY "admin baca penggunaan aisys" ON public.penggunaan_aisys FOR SELECT TO authenticated USING (public.punya_peran('admin'));
REVOKE INSERT, UPDATE, DELETE ON public.penggunaan_aisys FROM anon, authenticated;

-- Hanya penilai pengajuan itu (asesor yang ditugaskan) dan Ketua Tim/Admin
-- yang boleh memakai AISYS, dan hanya selama penilaian masih bisa diubah.
-- Mengembalikan alasan penolakan atau null bila boleh.
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
  IF v_status NOT IN ('asesmen', 'menunggu_bukti_tambahan', 'penilaian_lanjutan') THEN
    RETURN 'Pengajuan tidak sedang dalam tahap penilaian';
  END IF;
  SELECT count(*) INTO v_n FROM penggunaan_aisys WHERE pengguna_id = auth.uid() AND created_at > now() - interval '1 day';
  IF v_n >= 40 THEN RETURN 'Batas pemakaian AISYS hari ini (40 kali) sudah tercapai'; END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.cek_aisys(uuid) FROM anon;
