-- =========================================================================
-- Temuan uji 10 Nov 2026 (#46-#48).
--   #46 Pengajuan yang berhenti (tidak_memenuhi_syarat/dibatalkan) tidak
--       menerima bukti bayar baru. Pembayaran lunas lama tetap tercatat.
--   #47 Penilaian dibuka kembali (status klarifikasi: sanggahan diterima atau
--       permintaan Komite) -> WA ke asesor yang ditugaskan.
--   #48 Pemohon mengirim ulang setelah dikembalikan -> pesan khusus ke BAAK
--       (berbeda isi, sehingga tidak tertahan anti-kembar).
-- Bergantung pada 20261125000000_wa_perbaikan.sql. Aman dijalankan ulang.
-- =========================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.jaga_bayar_pengajuan_berhenti() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status::text INTO v_status FROM pengajuan_rpl WHERE id = NEW.pengajuan_id;
  IF v_status IN ('tidak_memenuhi_syarat', 'dibatalkan') THEN
    RAISE EXCEPTION 'Pengajuan sudah dihentikan; tagihan ditutup dan bukti bayar tidak dapat dikirim';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jaga_bayar_pengajuan_berhenti ON public.pembayaran_rpl;
CREATE TRIGGER trg_jaga_bayar_pengajuan_berhenti BEFORE INSERT ON public.pembayaran_rpl
  FOR EACH ROW EXECUTE FUNCTION public.jaga_bayar_pengajuan_berhenti();

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
    IF OLD.status = 'dikembalikan_sekretariat' THEN
      -- Kiriman ulang setelah perbaikan: pesan berbeda agar BAAK tahu dan tidak tertahan anti-kembar.
      PERFORM public.antre_wa(NEW.user_id, NEW.id, 'pengajuan_diterima', k || 'Halo ' || v_nama || ', perbaikan pengajuan RPL Anda (' || v_no
        || ') sudah kami terima dan akan diperiksa ulang oleh BAAK.' || nl || nl || 'Pantau status: ' || public.url_sirpl('/pemohon'));
      PERFORM public.antre_wa_peran(ARRAY['baak'], NEW.id, 'berkas_masuk', k || 'Pengajuan RPL DIKIRIM ULANG setelah perbaikan, mohon diperiksa kembali: '
        || v_nama || ' (' || v_no || ', ' || v_prodi || ').' || nl || public.url_sirpl('/tim'));
    ELSE
      PERFORM public.antre_wa(NEW.user_id, NEW.id, 'pengajuan_diterima', k || 'Halo ' || v_nama || ', pengajuan RPL Anda (' || v_no || ', ' || v_prodi
        || ') sudah kami terima dan akan diperiksa kelengkapannya oleh BAAK.' || nl || nl || 'Pantau status: ' || public.url_sirpl('/pemohon'));
      PERFORM public.antre_wa_peran(ARRAY['baak'], NEW.id, 'berkas_masuk', k || 'Pengajuan RPL baru perlu diverifikasi: ' || v_nama || ' (' || v_no || ', ' || v_prodi || ').'
        || nl || public.url_sirpl('/tim'));
    END IF;
  WHEN 'klarifikasi' THEN
    -- Penilaian dibuka kembali (sanggahan diterima atau permintaan Komite): beri tahu asesor.
    FOR r IN SELECT asesor_id FROM penugasan_asesor WHERE pengajuan_id = NEW.id LOOP
      PERFORM public.antre_wa(r.asesor_id, NEW.id, 'nilai_ulang', k || 'Penilaian pengajuan ' || v_nama || ' (' || v_no || ') dibuka kembali untuk dinilai ulang'
        || CASE WHEN OLD.status = 'dikembalikan_komite' THEN ' atas permintaan Komite RPL' ELSE ' karena sanggahan pemohon' END
        || '. Lihat catatannya di halaman penilaian.' || nl || public.url_sirpl('/asesor'));
    END LOOP;
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

COMMIT;
