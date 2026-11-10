-- Temuan uji #29: NIM dapat ditetapkan padahal biaya RPL belum lunas.
-- Keputusan: seluruh tagihan pemohon harus lunas sebelum BAAK menetapkan NIM.
-- (Asesmen tetap boleh berjalan sebelum lunas.)
BEGIN;

-- Sisa tagihan satu pengajuan (cermin ringkasTagihan di src/keuangan/tagihan.js):
-- angsuran dianggap terbayar bila ada pembayaran berstatus lunas untuk angsuran itu.
CREATE OR REPLACE FUNCTION public.sisa_tagihan(p_pengajuan uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(greatest(x.total - x.terbayar, 0)), 0)
  FROM (
    SELECT greatest(t.nominal - coalesce(t.potongan, 0), 0) AS total,
      coalesce((
        SELECT sum((a->>'jumlah')::numeric)
        FROM jsonb_array_elements(
          CASE WHEN t.angsuran IS NOT NULL AND jsonb_array_length(t.angsuran) > 0 THEN t.angsuran
               ELSE jsonb_build_array(jsonb_build_object('ke', 1, 'jumlah', greatest(t.nominal - coalesce(t.potongan, 0), 0))) END) a
        WHERE EXISTS (SELECT 1 FROM pembayaran_rpl b
                      WHERE b.tagihan_id = t.id AND coalesce(b.angsuran_ke, 1) = (a->>'ke')::int AND b.status = 'lunas')
      ), 0) AS terbayar
    FROM tagihan_rpl t WHERE t.pengajuan_id = p_pengajuan
      -- hanya staf RPL atau pemilik pengajuan
      AND (auth.uid() IS NULL OR public.is_staf_rpl() OR public.pengajuan_milik_saya(p_pengajuan))
  ) x
$$;
REVOKE EXECUTE ON FUNCTION public.sisa_tagihan(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.tetapkan_nim(p_pengajuan uuid, p_nim text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_alur int; v_sisa numeric;
BEGIN
  IF NOT public.punya_peran('admin', 'baak') THEN RAISE EXCEPTION 'NIM ditetapkan oleh BAAK'; END IF;
  IF coalesce(btrim(p_nim), '') !~ '^[0-9A-Za-z.\-]{5,20}$' THEN RAISE EXCEPTION 'Format NIM tidak valid'; END IF;
  SELECT status, alur_versi INTO v_status, v_alur FROM pengajuan_rpl WHERE id = p_pengajuan FOR UPDATE;
  IF v_status NOT IN ('sk_terbit', 'selesai') THEN RAISE EXCEPTION 'NIM ditetapkan setelah SK terbit'; END IF;
  IF v_alur IS DISTINCT FROM 1 THEN
    v_sisa := public.sisa_tagihan(p_pengajuan);
    IF v_sisa > 0 THEN
      RAISE EXCEPTION 'Biaya RPL belum lunas (sisa Rp%). NIM ditetapkan setelah seluruh tagihan lunas',
        replace(to_char(v_sisa, 'FM999,999,999,990'), ',', '.');
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pengajuan_rpl WHERE nim = btrim(p_nim) AND id <> p_pengajuan) THEN
    RAISE EXCEPTION 'NIM % sudah dipakai', btrim(p_nim);
  END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET nim = btrim(p_nim), status = 'selesai' WHERE id = p_pengajuan;
  PERFORM set_config('sirpl.rpc', '', true);
END $$;

COMMIT;
