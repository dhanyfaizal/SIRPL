-- =========================================================================
-- Notifikasi WhatsApp mode manual (klik-untuk-kirim).
--   * Pesan tetap disusun pemicu basis data dan masuk antrean_notifikasi.
--   * Mode 'manual' (bawaan): staf pemegang nomor WA Business institusi
--     membuka pesan lewat tautan wa.me (WhatsApp Desktop/Web), menekan Kirim,
--     lalu menandai pesan terkirim di SIRPL.
--   * Mode 'otomatis': Edge Function notifikasi-wa mengirim lewat Fonnte
--     (kode disimpan, aktif hanya bila mode diubah oleh Admin).
-- Bergantung pada 20261118000000_notifikasi_wa.sql. Aman dijalankan ulang.
-- =========================================================================
BEGIN;

ALTER TABLE public.pengaturan_notifikasi ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'manual';
ALTER TABLE public.pengaturan_notifikasi DROP CONSTRAINT IF EXISTS pengaturan_notifikasi_mode_check;
ALTER TABLE public.pengaturan_notifikasi ADD CONSTRAINT pengaturan_notifikasi_mode_check CHECK (mode IN ('manual', 'otomatis'));

ALTER TABLE public.antrean_notifikasi ADD COLUMN IF NOT EXISTS dikirim_oleh uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Peran yang mengoperasikan nomor WA Business (mengirim pesan manual).
CREATE OR REPLACE FUNCTION public.operator_wa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.punya_peran('admin', 'baak', 'pmb', 'sekretaris', 'ketua_tim')
$$;

-- Daftar pesan untuk halaman "WA keluar", lengkap dengan nama penerima.
CREATE OR REPLACE FUNCTION public.daftar_wa_keluar(p_status text DEFAULT 'menunggu', p_batas int DEFAULT 200)
RETURNS TABLE (
  id bigint, jenis text, no_wa text, pesan text, status text, created_at timestamptz, terkirim_at timestamptz,
  pengajuan_id uuid, nomor_pendaftaran text, penerima text, peran_penerima text, untuk_pemohon boolean, pengirim text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.operator_wa() THEN RAISE EXCEPTION 'Hanya staf pengirim WhatsApp'; END IF;
  RETURN QUERY
  SELECT a.id, a.jenis::text, a.no_wa::text, a.pesan, a.status::text, a.created_at, a.terkirim_at,
    a.pengajuan_id, p.nomor_pendaftaran::text, coalesce(pf.nama_lengkap, pf.email)::text, pf.role::text,
    (p.user_id IS NOT NULL AND p.user_id = a.profile_id), coalesce(ps.nama_lengkap, ps.email)::text
  FROM antrean_notifikasi a
  LEFT JOIN profiles pf ON pf.id = a.profile_id
  LEFT JOIN pengajuan_rpl p ON p.id = a.pengajuan_id
  LEFT JOIN profiles ps ON ps.id = a.dikirim_oleh
  WHERE CASE WHEN p_status = 'menunggu' THEN a.status IN ('menunggu', 'diproses', 'gagal')
             WHEN p_status = 'semua' THEN true
             ELSE a.status = p_status END
  ORDER BY CASE WHEN p_status = 'menunggu' THEN a.id END ASC, a.id DESC
  LIMIT least(greatest(p_batas, 1), 500);
END $$;

-- Jumlah pesan yang menunggu dikirim (badge menu).
CREATE OR REPLACE FUNCTION public.jumlah_wa_menunggu() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.operator_wa()
    THEN (SELECT count(*)::int FROM antrean_notifikasi WHERE status IN ('menunggu', 'diproses', 'gagal'))
    ELSE 0 END
$$;

-- Tandai pesan: terkirim / dilewati, atau kembalikan ke menunggu (batal).
CREATE OR REPLACE FUNCTION public.tandai_wa(p_id bigint, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.operator_wa() THEN RAISE EXCEPTION 'Hanya staf pengirim WhatsApp'; END IF;
  IF p_status NOT IN ('terkirim', 'dilewati', 'menunggu') THEN RAISE EXCEPTION 'Status tidak dikenal: %', p_status; END IF;
  UPDATE antrean_notifikasi
     SET status = p_status,
         terkirim_at = CASE WHEN p_status = 'menunggu' THEN NULL ELSE now() END,
         dikirim_oleh = CASE WHEN p_status = 'menunggu' THEN NULL ELSE auth.uid() END,
         galat = NULL
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesan tidak ditemukan'; END IF;
END $$;

-- Pengiriman otomatis (Edge Function) hanya berjalan pada mode 'otomatis'.
CREATE OR REPLACE FUNCTION public.ambil_antrean_wa(p_batas int DEFAULT 20)
RETURNS SETOF antrean_notifikasi LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE antrean_notifikasi SET status = 'diproses', percobaan = percobaan + 1
  WHERE (SELECT mode FROM pengaturan_notifikasi WHERE id = 1) = 'otomatis'
    AND id IN (
    SELECT id FROM antrean_notifikasi
    WHERE (status = 'menunggu' OR (status = 'diproses' AND created_at < now() - interval '15 minutes'))
      AND percobaan < 3 AND created_at > now() - interval '2 days'
    ORDER BY id LIMIT least(greatest(p_batas, 1), 50)
    FOR UPDATE SKIP LOCKED)
  RETURNING *
$$;
REVOKE EXECUTE ON FUNCTION public.ambil_antrean_wa(int) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_wa() FROM anon;
REVOKE EXECUTE ON FUNCTION public.daftar_wa_keluar(text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.jumlah_wa_menunggu() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tandai_wa(bigint, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.daftar_wa_keluar(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jumlah_wa_menunggu() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tandai_wa(bigint, text) TO authenticated;

COMMIT;
