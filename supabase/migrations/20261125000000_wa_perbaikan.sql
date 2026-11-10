-- =========================================================================
-- Perbaikan notifikasi WhatsApp (temuan uji 10 Nov 2026).
--   #39 Anti-kembar: pesan dianggap kembar hanya bila ISI pesan sama persis
--       untuk penerima dan pengajuan yang sama dalam 10 menit (sebelumnya
--       cukup jenis yang sama, sehingga pesan sah ikut tertahan).
--   #40 Pemicu baru:
--       - Komite menyetujui (menunggu_sk) -> Sekretariat: catat SK.
--       - Pemohon mengirim bukti tambahan (menunggu_bukti_tambahan -> asesmen)
--         -> asesor yang ditugaskan.
--       - Jadwal dibatalkan -> asesor yang terlibat.
-- Bergantung pada 20261118000000_notifikasi_wa.sql. Aman dijalankan ulang.
-- =========================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.antre_wa(p_profile uuid, p_pengajuan uuid, p_jenis text, p_pesan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s pengaturan_notifikasi%ROWTYPE; v_wa text; v_pesan text := left(p_pesan, 1500);
BEGIN
  SELECT * INTO s FROM pengaturan_notifikasi WHERE id = 1;
  IF NOT FOUND OR NOT s.aktif OR p_jenis = ANY (s.jenis_nonaktif) THEN RETURN; END IF;
  SELECT public.normal_wa(no_whatsapp) INTO v_wa FROM profiles WHERE id = p_profile;
  IF v_wa IS NULL THEN RETURN; END IF;
  -- Cegah pesan kembar: isi sama persis ke penerima dan pengajuan yang sama dalam 10 menit.
  IF EXISTS (SELECT 1 FROM antrean_notifikasi WHERE profile_id = p_profile AND jenis = p_jenis
             AND pengajuan_id IS NOT DISTINCT FROM p_pengajuan AND pesan = v_pesan
             AND created_at > now() - interval '10 minutes') THEN
    RETURN;
  END IF;
  INSERT INTO antrean_notifikasi (profile_id, pengajuan_id, jenis, no_wa, pesan)
  VALUES (p_profile, p_pengajuan, p_jenis, v_wa, v_pesan);
END $$;
REVOKE EXECUTE ON FUNCTION public.antre_wa(uuid, uuid, text, text) FROM anon, authenticated;

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
  WHEN 'asesmen' THEN
    -- Pemohon selesai mengirim bukti tambahan: beri tahu asesor yang ditugaskan.
    IF OLD.status = 'menunggu_bukti_tambahan' THEN
      FOR r IN SELECT asesor_id FROM penugasan_asesor WHERE pengajuan_id = NEW.id LOOP
        PERFORM public.antre_wa(r.asesor_id, NEW.id, 'bukti_tambahan_masuk', k || 'Pemohon ' || v_nama || ' (' || v_no
          || ') sudah mengirim bukti tambahan yang diminta. Penilaian dapat dilanjutkan.' || nl || public.url_sirpl('/asesor'));
      END LOOP;
    END IF;
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
  WHEN 'menunggu_sk' THEN
    PERFORM public.antre_wa_peran(ARRAY['sekretaris'], NEW.id, 'perlu_sk', k || 'Hasil RPL ' || v_nama || ' (' || v_no || ', ' || v_prodi
      || ') sudah disetujui Komite. Mohon catat SK Ketua STIKOM.' || nl || public.url_sirpl('/pimpinan/sk'));
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
    -- Asesor yang terlibat juga diberi tahu.
    FOREACH a IN ARRAY array_remove(array_prepend(NEW.asesor_id, NEW.asesor_lain), NULL) LOOP
      PERFORM public.antre_wa(a, NEW.pengajuan_id, 'jadwal_asesor', public.kepala_wa() || 'Jadwal ' || lower(v_jenis) || ' pemohon ' || v_nama
        || ' pada ' || v_waktu || ' DIBATALKAN.' || nl || public.url_sirpl('/asesor/jadwal'));
    END LOOP;
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

COMMIT;
