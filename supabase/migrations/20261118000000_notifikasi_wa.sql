-- =========================================================================
-- Notifikasi WhatsApp dari server.
--   * Pesan disusun oleh pemicu basis data dan masuk antrean_notifikasi.
--   * Edge Function "notifikasi-wa" (dipanggil Database Webhook saat ada
--     baris baru) mengirim lewat Fonnte; token hanya ada di server.
--   * Admin mengatur aktif/nonaktif, jenis pesan, dan alamat aplikasi.
-- Aman dijalankan ulang.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.pengaturan_notifikasi (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  aktif boolean NOT NULL DEFAULT false,
  url_aplikasi text NOT NULL DEFAULT 'https://sirpl.stikomyos.ac.id',
  jenis_nonaktif text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pengaturan_notifikasi (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.antrean_notifikasi (
  id bigserial PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pengajuan_id uuid REFERENCES pengajuan_rpl(id) ON DELETE SET NULL,
  jenis varchar(40) NOT NULL,
  no_wa varchar(20) NOT NULL,
  pesan text NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'diproses', 'terkirim', 'gagal', 'dilewati')),
  percobaan smallint NOT NULL DEFAULT 0,
  galat text,
  created_at timestamptz NOT NULL DEFAULT now(),
  terkirim_at timestamptz
);
CREATE INDEX IF NOT EXISTS antrean_notifikasi_status ON public.antrean_notifikasi (status, id);
CREATE INDEX IF NOT EXISTS antrean_notifikasi_waktu ON public.antrean_notifikasi (created_at DESC);

ALTER TABLE public.pengaturan_notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antrean_notifikasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin kelola pengaturan notifikasi" ON public.pengaturan_notifikasi;
CREATE POLICY "admin kelola pengaturan notifikasi" ON public.pengaturan_notifikasi FOR ALL TO authenticated
  USING (public.punya_peran('admin')) WITH CHECK (public.punya_peran('admin'));
DROP POLICY IF EXISTS "admin baca antrean notifikasi" ON public.antrean_notifikasi;
CREATE POLICY "admin baca antrean notifikasi" ON public.antrean_notifikasi FOR SELECT TO authenticated USING (public.punya_peran('admin'));
GRANT SELECT, UPDATE ON public.pengaturan_notifikasi TO authenticated;
GRANT SELECT ON public.antrean_notifikasi TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.antrean_notifikasi FROM anon, authenticated;

-- Nomor WhatsApp ke format 62xxxxxxxxxx; null bila tidak sah.
CREATE OR REPLACE FUNCTION public.normal_wa(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n ~ '^62[0-9]{8,13}$' THEN n END
  FROM (SELECT CASE
    WHEN d LIKE '0%' THEN '62' || substr(d, 2)
    WHEN d LIKE '8%' THEN '62' || d
    ELSE d END AS n
    FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d) x) y
$$;

-- Masukkan satu pesan ke antrean untuk satu akun.
CREATE OR REPLACE FUNCTION public.antre_wa(p_profile uuid, p_pengajuan uuid, p_jenis text, p_pesan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s pengaturan_notifikasi%ROWTYPE; v_wa text;
BEGIN
  SELECT * INTO s FROM pengaturan_notifikasi WHERE id = 1;
  IF NOT FOUND OR NOT s.aktif OR p_jenis = ANY (s.jenis_nonaktif) THEN RETURN; END IF;
  SELECT public.normal_wa(no_whatsapp) INTO v_wa FROM profiles WHERE id = p_profile;
  IF v_wa IS NULL THEN RETURN; END IF;
  -- Cegah pesan kembar dalam 10 menit.
  IF EXISTS (SELECT 1 FROM antrean_notifikasi WHERE profile_id = p_profile AND jenis = p_jenis
             AND pengajuan_id IS NOT DISTINCT FROM p_pengajuan AND created_at > now() - interval '10 minutes') THEN
    RETURN;
  END IF;
  INSERT INTO antrean_notifikasi (profile_id, pengajuan_id, jenis, no_wa, pesan)
  VALUES (p_profile, p_pengajuan, p_jenis, v_wa, left(p_pesan, 1500));
END $$;

-- Ke semua akun aktif berperan tertentu.
CREATE OR REPLACE FUNCTION public.antre_wa_peran(p_peran text[], p_pengajuan uuid, p_jenis text, p_pesan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE role = ANY (p_peran) AND is_verified AND no_whatsapp IS NOT NULL LOOP
    PERFORM public.antre_wa(r.id, p_pengajuan, p_jenis, p_pesan);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.kepala_wa() RETURNS text LANGUAGE sql STABLE AS $$ SELECT '*SIRPL STIKOM Yos Sudarso*' || chr(10) || chr(10) $$;
CREATE OR REPLACE FUNCTION public.url_sirpl(p_jalur text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rtrim(coalesce((SELECT url_aplikasi FROM pengaturan_notifikasi WHERE id = 1), ''), '/') || p_jalur
$$;

-- -------------------------------------------------------------------------
-- Perubahan status pengajuan
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_status_pengajuan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := public.kepala_wa(); v_nama text; v_prodi text; v_no text; nl text := chr(10); r record;
BEGIN
  IF NEW.alur_versi = 1 OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT coalesce(nama_lengkap, email) INTO v_nama FROM profiles WHERE id = NEW.user_id;
  SELECT nama INTO v_prodi FROM program_studi WHERE id = NEW.prodi_pilihan_id;
  v_no := coalesce(NEW.nomor_pendaftaran, '-');

  CASE NEW.status
  WHEN 'diajukan' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'pengajuan_diterima', k || 'Halo ' || v_nama || ', pengajuan RPL Anda (' || v_no || ', ' || v_prodi
      || ') sudah kami terima dan akan diperiksa kelengkapannya oleh BAAK.' || nl || nl || 'Pantau status: ' || public.url_sirpl('/pemohon'));
    PERFORM public.antre_wa_peran(ARRAY['baak'], NEW.id, 'berkas_masuk', k || 'Pengajuan RPL baru perlu diverifikasi: ' || v_nama || ' (' || v_no || ', ' || v_prodi || ').'
      || nl || public.url_sirpl('/tim'));
  WHEN 'dikembalikan_sekretariat' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'berkas_dikembalikan', k || 'Halo ' || v_nama || ', berkas pengajuan RPL Anda (' || v_no || ') perlu diperbaiki:'
      || nl || coalesce(NEW.catatan_revisi, '-') || nl || nl || 'Perbaiki lalu kirim ulang di ' || public.url_sirpl('/pemohon'));
  WHEN 'terverifikasi' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'berkas_terverifikasi', k || 'Halo ' || v_nama || ', berkas pengajuan RPL Anda (' || v_no
      || ') sudah lengkap. Tahap berikutnya adalah penilaian oleh asesor.');
    PERFORM public.antre_wa_peran(ARRAY['ketua_tim'], NEW.id, 'perlu_asesor', k || 'Pengajuan ' || v_nama || ' (' || v_no || ', ' || v_prodi
      || ') sudah terverifikasi dan menunggu penugasan asesor.' || nl || public.url_sirpl('/tim'));
  WHEN 'tidak_memenuhi_syarat' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'tidak_memenuhi', k || 'Halo ' || v_nama || ', mohon maaf, pengajuan RPL Anda (' || v_no
      || ') dinyatakan tidak memenuhi syarat.' || coalesce(nl || 'Catatan: ' || NEW.catatan_revisi, '') || nl || 'Rincian: ' || public.url_sirpl('/pemohon'));
  WHEN 'menunggu_bukti_tambahan' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'bukti_tambahan', k || 'Halo ' || v_nama || ', asesor meminta bukti tambahan untuk pengajuan RPL Anda (' || v_no || ').'
      || coalesce(nl || NEW.catatan_revisi, '') || nl || nl || 'Unggah di ' || public.url_sirpl('/pemohon/pengajuan/bukti'));
  WHEN 'pleno_awal', 'pleno' THEN
    PERFORM public.antre_wa_peran(ARRAY['ketua_tim', 'sekretaris'], NEW.id, 'siap_pleno', k || 'Penilaian ' || v_nama || ' (' || v_no || ') siap dibahas dalam '
      || CASE NEW.status WHEN 'pleno_awal' THEN 'pleno awal' ELSE 'pleno' END || '.' || nl || public.url_sirpl('/tim/pleno'));
  WHEN 'penilaian_lanjutan' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'penilaian_lanjutan', k || 'Halo ' || v_nama || ', pengajuan perolehan kredit Anda (' || v_no
      || ') masuk penilaian lanjutan (wawancara/uji). Jadwal akan dikirim setelah ditetapkan.');
  WHEN 'hasil_disampaikan' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'hasil_rpl', k || 'Halo ' || v_nama || ', hasil asesmen RPL Anda (' || v_no || ') sudah dapat dilihat.'
      || ' Bila ada keberatan, ajukan klarifikasi dalam masa sanggah.' || nl || nl || public.url_sirpl('/pemohon/hasil'));
  WHEN 'menunggu_komite' THEN
    PERFORM public.antre_wa_peran(ARRAY['komite'], NEW.id, 'perlu_komite', k || 'Hasil RPL ' || v_nama || ' (' || v_no || ', ' || v_prodi
      || ') menunggu keputusan Komite.' || nl || public.url_sirpl('/pimpinan/komite'));
  WHEN 'dikembalikan_komite' THEN
    PERFORM public.antre_wa_peran(ARRAY['ketua_tim'], NEW.id, 'dikembalikan_komite', k || 'Komite mengembalikan hasil RPL ' || v_nama || ' (' || v_no || ') untuk ditinjau.'
      || coalesce(nl || NEW.catatan_revisi, '') || nl || public.url_sirpl('/tim'));
  WHEN 'sk_terbit' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'sk_terbit', k || 'Selamat ' || v_nama || ', SK rekognisi RPL Anda (' || v_no || ') sudah terbit. NIM akan ditetapkan oleh BAAK.'
      || nl || public.url_sirpl('/pemohon/hasil'));
    PERFORM public.antre_wa_peran(ARRAY['baak'], NEW.id, 'perlu_nim', k || 'SK RPL ' || v_nama || ' (' || v_no || ', ' || v_prodi || ') terbit. Mohon tetapkan NIM.'
      || nl || public.url_sirpl('/pimpinan/nim'));
  WHEN 'selesai' THEN
    PERFORM public.antre_wa(NEW.user_id, NEW.id, 'nim_terbit', k || 'Selamat ' || v_nama || ', Anda resmi menjadi mahasiswa ' || v_prodi || ' STIKOM Yos Sudarso'
      || coalesce(' dengan NIM ' || NEW.nim, '') || '.');
  ELSE
    NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi tidak boleh menggagalkan proses utama.
  RAISE WARNING 'wa_status_pengajuan: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_status_pengajuan ON public.pengajuan_rpl;
CREATE TRIGGER trg_wa_status_pengajuan AFTER UPDATE OF status ON public.pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.wa_status_pengajuan();

-- -------------------------------------------------------------------------
-- Penugasan asesor, jadwal, pembayaran, dan tanda tangan
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_penugasan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  SELECT p.nomor_pendaftaran, pr.nama AS prodi, p.jenis_rpl INTO v
  FROM pengajuan_rpl p LEFT JOIN program_studi pr ON pr.id = p.prodi_pilihan_id WHERE p.id = NEW.pengajuan_id;
  PERFORM public.antre_wa(NEW.asesor_id, NEW.pengajuan_id, 'tugas_asesor', public.kepala_wa() || 'Anda ditugaskan sebagai '
    || CASE NEW.peran WHEN 'koordinator' THEN 'asesor koordinator' ELSE 'asesor' END || ' untuk pengajuan ' || coalesce(v.nomor_pendaftaran, '-')
    || ' (' || coalesce(v.prodi, '-') || ', ' || coalesce(v.jenis_rpl::text, '-') || ').' || chr(10) || public.url_sirpl('/asesor'));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi tidak boleh menggagalkan proses utama.
  RAISE WARNING 'wa_penugasan: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_penugasan ON public.penugasan_asesor;
CREATE TRIGGER trg_wa_penugasan AFTER INSERT ON public.penugasan_asesor FOR EACH ROW EXECUTE FUNCTION public.wa_penugasan();

CREATE OR REPLACE FUNCTION public.wa_jadwal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_nama text; v_waktu text; v_tempat text; v_jenis text; nl text := chr(10); a uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.waktu IS NOT DISTINCT FROM OLD.waktu AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.tautan_undangan IS NOT DISTINCT FROM OLD.tautan_undangan THEN RETURN NEW; END IF;
  SELECT p.user_id, coalesce(pf.nama_lengkap, pf.email) INTO v_user, v_nama FROM pengajuan_rpl p JOIN profiles pf ON pf.id = p.user_id WHERE p.id = NEW.pengajuan_id;
  v_waktu := to_char(NEW.waktu AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY "pukul" HH24:MI') || ' WIB';
  v_tempat := CASE WHEN NEW.mode = 'daring' THEN 'Daring: ' || coalesce(NEW.tautan_undangan, NEW.tempat_atau_tautan, 'tautan menyusul')
                   ELSE 'Luring: ' || coalesce(NEW.ruangan, NEW.tempat_atau_tautan, 'STIKOM Yos Sudarso') END;
  v_jenis := initcap(replace(NEW.jenis, '_', ' '));
  IF NEW.status = 'dibatalkan' THEN
    PERFORM public.antre_wa(v_user, NEW.pengajuan_id, 'jadwal_batal', public.kepala_wa() || 'Halo ' || v_nama || ', jadwal ' || lower(v_jenis) || ' pada ' || v_waktu || ' dibatalkan. Jadwal pengganti akan dikirim kemudian.');
    RETURN NEW;
  END IF;
  IF NEW.status <> 'dijadwalkan' THEN RETURN NEW; END IF;
  PERFORM public.antre_wa(v_user, NEW.pengajuan_id, CASE TG_OP WHEN 'INSERT' THEN 'jadwal_baru' ELSE 'jadwal_ubah' END,
    public.kepala_wa() || 'Halo ' || v_nama || ', ' || CASE TG_OP WHEN 'INSERT' THEN 'jadwal ' ELSE 'perubahan jadwal ' END || lower(v_jenis) || ' RPL Anda:' || nl
    || v_waktu || nl || v_tempat || coalesce(nl || 'Durasi ' || NEW.durasi_menit || ' menit', '') || nl || nl
    || 'Konfirmasi kehadiran di ' || public.url_sirpl('/pemohon/jadwal'));
  FOREACH a IN ARRAY array_remove(array_prepend(NEW.asesor_id, NEW.asesor_lain), NULL) LOOP
    PERFORM public.antre_wa(a, NEW.pengajuan_id, 'jadwal_asesor', public.kepala_wa() || 'Jadwal ' || lower(v_jenis) || ' pemohon ' || v_nama || ':' || nl
      || v_waktu || nl || v_tempat || nl || public.url_sirpl('/asesor/jadwal'));
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi tidak boleh menggagalkan proses utama.
  RAISE WARNING 'wa_jadwal: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_jadwal ON public.jadwal_asesmen;
CREATE TRIGGER trg_wa_jadwal AFTER INSERT OR UPDATE ON public.jadwal_asesmen FOR EACH ROW EXECUTE FUNCTION public.wa_jadwal();

CREATE OR REPLACE FUNCTION public.wa_pembayaran() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_nama text; v_no text; v_rp text;
BEGIN
  SELECT p.user_id, coalesce(pf.nama_lengkap, pf.email), p.nomor_pendaftaran INTO v_user, v_nama, v_no
  FROM pengajuan_rpl p JOIN profiles pf ON pf.id = p.user_id WHERE p.id = NEW.pengajuan_id;
  v_rp := 'Rp' || replace(to_char(NEW.jumlah, 'FM999,999,999,999'), ',', '.');
  IF TG_OP = 'INSERT' AND NEW.status = 'menunggu' THEN
    PERFORM public.antre_wa_peran(ARRAY['pmb'], NEW.pengajuan_id, 'bukti_bayar', public.kepala_wa() || 'Bukti bayar baru ' || v_rp || ' dari ' || v_nama
      || ' (' || coalesce(v_no, '-') || ') menunggu verifikasi.' || chr(10) || public.url_sirpl('/keuangan/verifikasi'));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('lunas', 'ditolak') THEN
    PERFORM public.antre_wa(v_user, NEW.pengajuan_id, 'bayar_' || NEW.status, public.kepala_wa() || 'Halo ' || v_nama || ', pembayaran ' || v_rp || ' '
      || CASE NEW.status WHEN 'lunas' THEN 'sudah diverifikasi lunas. Terima kasih.'
         ELSE 'ditolak: ' || coalesce(NEW.catatan, '-') || chr(10) || 'Kirim ulang bukti bayar di ' || public.url_sirpl('/pemohon/pembayaran') END);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi tidak boleh menggagalkan proses utama.
  RAISE WARNING 'wa_pembayaran: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_pembayaran ON public.pembayaran_rpl;
CREATE TRIGGER trg_wa_pembayaran AFTER INSERT OR UPDATE OF status ON public.pembayaran_rpl FOR EACH ROW EXECUTE FUNCTION public.wa_pembayaran();

CREATE OR REPLACE FUNCTION public.wa_tanda_tangan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF NEW.status <> 'menunggu' THEN RETURN NEW; END IF;
  SELECT judul, pengajuan_id INTO v FROM dokumen_terbit WHERE id = NEW.dokumen_id;
  -- Dokumen biodata yang diterbitkan sendiri tidak perlu diberitahukan.
  IF NEW.penandatangan_id = auth.uid() THEN RETURN NEW; END IF;
  PERFORM public.antre_wa(NEW.penandatangan_id, v.pengajuan_id, 'tanda_tangan', public.kepala_wa() || 'Dokumen menunggu tanda tangan Anda: '
    || coalesce(v.judul, 'dokumen RPL') || '.' || chr(10) || public.url_sirpl('/tanda-tangan'));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi tidak boleh menggagalkan proses utama.
  RAISE WARNING 'wa_tanda_tangan: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_tanda_tangan ON public.tanda_tangan_dokumen;
CREATE TRIGGER trg_wa_tanda_tangan AFTER INSERT ON public.tanda_tangan_dokumen FOR EACH ROW EXECUTE FUNCTION public.wa_tanda_tangan();

-- -------------------------------------------------------------------------
-- Pengiriman (dipakai Edge Function dengan service role)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ambil_antrean_wa(p_batas int DEFAULT 20)
RETURNS SETOF antrean_notifikasi LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE antrean_notifikasi SET status = 'diproses', percobaan = percobaan + 1
  WHERE id IN (
    SELECT id FROM antrean_notifikasi
    WHERE (status = 'menunggu' OR (status = 'diproses' AND created_at < now() - interval '15 minutes'))
      AND percobaan < 3 AND created_at > now() - interval '2 days'
    ORDER BY id LIMIT least(greatest(p_batas, 1), 50)
    FOR UPDATE SKIP LOCKED)
  RETURNING *
$$;
REVOKE EXECUTE ON FUNCTION public.ambil_antrean_wa(int) FROM anon, authenticated;

-- Admin: kirim ulang pesan gagal, dan pesan uji ke nomor sendiri.
CREATE OR REPLACE FUNCTION public.ulangi_notifikasi(p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya Admin'; END IF;
  UPDATE antrean_notifikasi SET status = 'menunggu', percobaan = 0, galat = NULL, created_at = now() WHERE id = p_id AND status IN ('gagal', 'dilewati');
END $$;

CREATE OR REPLACE FUNCTION public.uji_notifikasi()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wa text;
BEGIN
  IF NOT public.punya_peran('admin') THEN RAISE EXCEPTION 'Hanya Admin'; END IF;
  SELECT public.normal_wa(no_whatsapp) INTO v_wa FROM profiles WHERE id = auth.uid();
  IF v_wa IS NULL THEN RAISE EXCEPTION 'Isi nomor WhatsApp Anda di halaman Profil terlebih dahulu'; END IF;
  INSERT INTO antrean_notifikasi (profile_id, jenis, no_wa, pesan)
  VALUES (auth.uid(), 'uji', v_wa, public.kepala_wa() || 'Pesan uji notifikasi. Bila pesan ini sampai, pengiriman WhatsApp sudah berjalan.');
  RETURN v_wa;
END $$;
REVOKE EXECUTE ON FUNCTION public.ulangi_notifikasi(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.uji_notifikasi() FROM anon;
REVOKE EXECUTE ON FUNCTION public.antre_wa(uuid, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.antre_wa_peran(text[], uuid, text, text) FROM anon, authenticated;
