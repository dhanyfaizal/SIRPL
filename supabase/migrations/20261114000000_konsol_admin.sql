-- Konsol Admin: pengelolaan pengguna, periode aktif, pembatalan pengajuan,
-- status pelaporan ke Sistem RPL / LLDIKTI / PDDikti, dan log tindakan admin.

-- 1. Log tindakan admin ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_admin (
  id bigserial PRIMARY KEY,
  aktor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  aksi varchar(40) NOT NULL,
  sasaran text,
  rincian jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS log_admin_waktu ON public.log_admin (created_at DESC);
ALTER TABLE public.log_admin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin baca log admin" ON public.log_admin;
CREATE POLICY "admin baca log admin" ON public.log_admin FOR SELECT TO authenticated USING (public.punya_peran('admin'));
REVOKE INSERT, UPDATE, DELETE ON public.log_admin FROM anon, authenticated;

-- 2. Pengguna -------------------------------------------------------------
-- Admin mana pun (bukan hanya akun awal) dapat mengubah peran, prodi, status
-- verifikasi, dan nama. Admin terakhir yang terverifikasi tidak dapat
-- diturunkan atau dinonaktifkan agar sistem tidak terkunci.
CREATE OR REPLACE FUNCTION public.atur_pengguna(p_id uuid, p_role text, p_prodi uuid, p_verified boolean, p_nama text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lama profiles%ROWTYPE; v_nama text := btrim(coalesce(p_nama, ''));
BEGIN
  IF NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya Admin yang dapat mengubah data pengguna'; END IF;
  SELECT * INTO v_lama FROM profiles WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengguna tidak ditemukan'; END IF;
  IF length(v_nama) < 3 THEN RAISE EXCEPTION 'Nama minimal 3 karakter'; END IF;
  IF p_role LIKE 'kaprodi_%' AND p_prodi IS NULL THEN RAISE EXCEPTION 'Ka. Prodi wajib dihubungkan dengan program studi'; END IF;
  IF v_lama.role = 'admin' AND v_lama.is_verified AND (p_role <> 'admin' OR NOT p_verified)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin' AND is_verified AND id <> p_id) THEN
    RAISE EXCEPTION 'Harus ada sedikitnya satu Admin aktif';
  END IF;
  IF v_lama.role = 'calon_rpl' AND p_role <> 'calon_rpl' AND EXISTS (SELECT 1 FROM pengajuan_rpl WHERE user_id = p_id AND status <> 'draft') THEN
    RAISE EXCEPTION 'Akun ini sudah memiliki pengajuan RPL sehingga perannya tidak dapat diubah';
  END IF;
  UPDATE profiles SET role = p_role, prodi_id = p_prodi, is_verified = p_verified, nama_lengkap = v_nama WHERE id = p_id;
  INSERT INTO log_admin (aktor_id, aksi, sasaran, rincian) VALUES (auth.uid(), 'atur_pengguna', v_lama.email,
    jsonb_build_object('dari', jsonb_build_object('role', v_lama.role, 'prodi_id', v_lama.prodi_id, 'is_verified', v_lama.is_verified, 'nama', v_lama.nama_lengkap),
                       'ke', jsonb_build_object('role', p_role, 'prodi_id', p_prodi, 'is_verified', p_verified, 'nama', v_nama)));
END $$;

-- 3. Periode aktif --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aktifkan_periode(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nama text;
BEGIN
  IF NOT public.punya_peran('admin', 'ketua_tim') THEN RAISE EXCEPTION 'Periode diaktifkan oleh Admin atau Ketua Tim'; END IF;
  SELECT nama INTO v_nama FROM periode_rpl WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Periode tidak ditemukan'; END IF;
  UPDATE periode_rpl SET is_aktif = false WHERE is_aktif AND id <> p_id;
  UPDATE periode_rpl SET is_aktif = true WHERE id = p_id;
  INSERT INTO log_admin (aktor_id, aksi, sasaran) VALUES (auth.uid(), 'aktifkan_periode', v_nama);
END $$;

-- 4. Pembatalan pengajuan -------------------------------------------------
CREATE OR REPLACE FUNCTION public.batalkan_pengajuan(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v pengajuan_rpl%ROWTYPE;
BEGIN
  IF NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya Admin yang dapat membatalkan pengajuan'; END IF;
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN RAISE EXCEPTION 'Tuliskan alasan pembatalan (minimal 10 karakter)'; END IF;
  SELECT * INTO v FROM pengajuan_rpl WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF v.status IN ('sk_terbit', 'selesai', 'dibatalkan') THEN
    RAISE EXCEPTION 'Pengajuan berstatus % tidak dapat dibatalkan', v.status;
  END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  UPDATE pengajuan_rpl SET status = 'dibatalkan', catatan_revisi = btrim(p_alasan) WHERE id = p_id;
  UPDATE pengajuan_rpl SET catatan_revisi = NULL WHERE id = p_id;
  PERFORM set_config('sirpl.rpc', '', true);
  INSERT INTO log_admin (aktor_id, aksi, sasaran, rincian) VALUES (auth.uid(), 'batalkan_pengajuan', v.nomor_pendaftaran,
    jsonb_build_object('pengajuan_id', p_id, 'dari_status', v.status, 'alasan', btrim(p_alasan)));
END $$;

-- 5. Status pelaporan -----------------------------------------------------
-- Urutan: belum -> dilaporkan_sistem_rpl -> diverifikasi_lldikti -> diinput_pddikti.
-- Hanya pemohon yang sudah ber-SK. Boleh mundur satu langkah untuk koreksi.
CREATE OR REPLACE FUNCTION public.atur_status_pelaporan(p_ids uuid[], p_status text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_urut text[] := ARRAY['belum', 'dilaporkan_sistem_rpl', 'diverifikasi_lldikti', 'diinput_pddikti'];
  v_ke int := array_position(v_urut, p_status); r record; v_n int := 0;
BEGIN
  IF NOT public.punya_peran('admin', 'baak') THEN RAISE EXCEPTION 'Status pelaporan diatur oleh Admin atau BAAK'; END IF;
  IF v_ke IS NULL THEN RAISE EXCEPTION 'Status pelaporan tidak dikenal'; END IF;
  IF coalesce(array_length(p_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Pilih sedikitnya satu pemohon'; END IF;
  PERFORM set_config('sirpl.rpc', '1', true);
  FOR r IN SELECT id, nomor_pendaftaran, status, status_pelaporan FROM pengajuan_rpl WHERE id = ANY (p_ids) FOR UPDATE LOOP
    IF r.status NOT IN ('sk_terbit', 'selesai') THEN
      RAISE EXCEPTION 'Pengajuan % belum ber-SK', r.nomor_pendaftaran;
    END IF;
    IF abs(v_ke - array_position(v_urut, r.status_pelaporan::text)) > 1 THEN
      RAISE EXCEPTION 'Pengajuan % berstatus pelaporan %, ubah satu langkah setiap kali', r.nomor_pendaftaran, r.status_pelaporan;
    END IF;
    UPDATE pengajuan_rpl SET status_pelaporan = p_status,
      dilaporkan_sistem_rpl_at = CASE WHEN v_ke >= 2 THEN coalesce(dilaporkan_sistem_rpl_at, now()) END,
      diverifikasi_lldikti_at = CASE WHEN v_ke >= 3 THEN coalesce(diverifikasi_lldikti_at, now()) END,
      dilaporkan_pddikti_at = CASE WHEN v_ke >= 4 THEN coalesce(dilaporkan_pddikti_at, now()) END
    WHERE id = r.id;
    INSERT INTO log_aktivitas_rpl (pengajuan_id, aktor_id, aksi, catatan)
    VALUES (r.id, auth.uid(), 'status_pelaporan', r.status_pelaporan || ' -> ' || p_status);
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('sirpl.rpc', '', true);
  RETURN v_n;
END $$;

-- 6. Program studi: pencatatan perubahan pengaturan -----------------------
CREATE OR REPLACE FUNCTION public.catat_ubah_prodi() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO log_admin (aktor_id, aksi, sasaran, rincian) VALUES (auth.uid(), 'ubah_prodi', NEW.nama,
      (SELECT jsonb_object_agg(k, jsonb_build_object('dari', to_jsonb(OLD) -> k, 'ke', to_jsonb(NEW) -> k))
         FROM jsonb_object_keys(to_jsonb(NEW)) k WHERE to_jsonb(NEW) -> k IS DISTINCT FROM to_jsonb(OLD) -> k));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_ubah_prodi ON public.program_studi;
CREATE TRIGGER trg_catat_ubah_prodi AFTER UPDATE ON public.program_studi FOR EACH ROW EXECUTE FUNCTION public.catat_ubah_prodi();

REVOKE EXECUTE ON FUNCTION public.atur_pengguna(uuid, text, uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aktifkan_periode(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batalkan_pengajuan(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atur_status_pelaporan(uuid[], text) FROM anon;
