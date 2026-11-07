-- =========================================================================
-- Pengaturan status RPL mata kuliah oleh Admin dan Koordinator Prodi
-- Tanggal : 2026-11-08
-- Prasyarat: 20261108000000_juknis_skema.sql
--
-- Keputusan (7 Nov 2026):
--   - Status RPL melekat permanen di mata kuliah sampai diubah lagi.
--   - Diatur oleh Admin dan Koordinator Prodi (untuk prodinya sendiri).
--   - MK yang ditutup setelah dipilih pemohon: tetap ada di pengajuan draf
--     dengan tanda, dan pengajuan tidak dapat dikirim sebelum diganti.
--     Pengajuan yang sudah dikirim tidak terpengaruh.
-- Aman dijalankan ulang.
-- =========================================================================

BEGIN;

ALTER TABLE mata_kuliah_kurikulum
  ADD COLUMN IF NOT EXISTS alasan_tidak_rpl TEXT,
  ADD COLUMN IF NOT EXISTS status_rpl_diubah_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_rpl_diubah_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.mk_tertutup(p_mk uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_tugas_akhir OR rangkaian_ta OR NOT coalesce(dapat_rpl, false)
                   FROM mata_kuliah_kurikulum WHERE id = p_mk), true)
$$;

-- Catat siapa dan kapan status RPL diubah.
CREATE OR REPLACE FUNCTION public.catat_status_rpl_mk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dapat_rpl IS DISTINCT FROM OLD.dapat_rpl
     OR NEW.is_tugas_akhir IS DISTINCT FROM OLD.is_tugas_akhir
     OR NEW.rangkaian_ta IS DISTINCT FROM OLD.rangkaian_ta THEN
    NEW.status_rpl_diubah_oleh := auth.uid();
    NEW.status_rpl_diubah_at := NOW();
  END IF;
  IF coalesce(NEW.dapat_rpl, false) THEN NEW.alasan_tidak_rpl := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catat_status_rpl_mk ON mata_kuliah_kurikulum;
CREATE TRIGGER trg_catat_status_rpl_mk BEFORE UPDATE ON mata_kuliah_kurikulum
  FOR EACH ROW EXECUTE FUNCTION public.catat_status_rpl_mk();

-- MK yang sudah dipilih lalu ditutup tetap boleh tersimpan di pengajuan
-- (agar tampil bertanda), tetapi tidak boleh ditambahkan baru.
CREATE OR REPLACE FUNCTION public.cek_mk_diajukan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mk record; v_p record;
BEGIN
  SELECT * INTO v_mk FROM mata_kuliah_kurikulum WHERE id = NEW.mk_id;
  SELECT * INTO v_p FROM pengajuan_rpl WHERE id = NEW.pengajuan_id;
  IF (v_mk.is_tugas_akhir OR v_mk.rangkaian_ta OR NOT coalesce(v_mk.dapat_rpl, false))
     AND NOT (TG_OP = 'UPDATE' AND OLD.mk_id = NEW.mk_id) THEN
    RAISE EXCEPTION 'Mata kuliah % tidak dibuka untuk RPL', v_mk.nama_mk;
  END IF;
  IF v_mk.prodi_id IS DISTINCT FROM v_p.prodi_pilihan_id THEN
    RAISE EXCEPTION 'Mata kuliah % bukan milik program studi yang dipilih', v_mk.nama_mk;
  END IF;
  IF v_p.jenis_rpl IS NOT NULL AND v_p.jenis_rpl <> 'gabungan' AND v_p.jenis_rpl <> NEW.mekanisme THEN
    RAISE EXCEPTION 'Mekanisme % tidak sesuai jenis RPL pengajuan (%)', NEW.mekanisme, v_p.jenis_rpl;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_staf_rpl()
     AND v_p.status NOT IN ('draft', 'dikembalikan_sekretariat') THEN
    RAISE EXCEPTION 'Daftar mata kuliah tidak dapat diubah setelah pengajuan dikirim';
  END IF;
  RETURN NEW;
END $$;

-- Syarat kirim: ditambah pemeriksaan MK yang sudah ditutup (kode mk_ditutup).
CREATE OR REPLACE FUNCTION public.cek_syarat_pengajuan(p_pengajuan uuid)
RETURNS TABLE (kode text, pesan text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_buka date; v_ada_transfer boolean; v_ada_perolehan boolean; v_tutup text;
BEGIN
  SELECT * INTO p FROM pengajuan_rpl WHERE id = p_pengajuan;
  IF NOT FOUND THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND p.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_staf_rpl() THEN
    RAISE EXCEPTION 'Tidak berwenang';
  END IF;

  v_ada_transfer  := p.jenis_rpl IN ('transfer', 'gabungan');
  v_ada_perolehan := p.jenis_rpl IN ('perolehan', 'gabungan');
  SELECT coalesce(pr.tanggal_buka, CURRENT_DATE) INTO v_buka FROM periode_rpl pr WHERE pr.id = p.periode_id;
  v_buka := coalesce(v_buka, CURRENT_DATE);

  IF p.jenis_rpl IS NULL THEN
    kode := 'jenis_rpl'; pesan := 'Pilih jenis RPL: transfer kredit, perolehan kredit, atau gabungan.'; RETURN NEXT;
  END IF;
  IF p.prodi_pilihan_id IS NULL THEN
    kode := 'prodi'; pesan := 'Pilih program studi tujuan.'; RETURN NEXT;
  END IF;
  IF v_ada_transfer AND NOT public.prodi_boleh_transfer(p.prodi_pilihan_id) THEN
    kode := 'prodi_transfer'; pesan := 'Program studi ini belum memenuhi syarat penyelenggara transfer kredit (Juknis II.B.2.a).'; RETURN NEXT;
  END IF;
  IF v_ada_perolehan AND NOT public.prodi_boleh_perolehan(p.prodi_pilihan_id) THEN
    kode := 'prodi_perolehan'; pesan := 'Perolehan kredit hanya untuk prodi terakreditasi minimal Baik Sekali/B (Juknis II.B.2.b).'; RETURN NEXT;
  END IF;

  -- Status keluar di PDDikti (Juknis II.A angka 4 dan 5)
  IF p.pt_asal_stikom AND p.status_pddikti_asal IN ('putus_studi', 'dikeluarkan') THEN
    kode := 'pddikti_pt_asal'; pesan := 'Pendaftar berstatus putus studi atau dikeluarkan hanya dapat melanjutkan melalui RPL di perguruan tinggi lain.'; RETURN NEXT;
  END IF;
  IF p.pt_asal_stikom AND p.status_pddikti_asal = 'mengundurkan_diri' AND (
       p.tanggal_mengundurkan_diri IS NULL OR p.tanggal_mengundurkan_diri > (v_buka - INTERVAL '1 year')::date) THEN
    kode := 'pddikti_satu_tahun'; pesan := 'Pendaftar yang mengundurkan diri dapat kembali ke STIKOM paling cepat 1 tahun akademik setelah SK pengunduran diri.'; RETURN NEXT;
  END IF;
  IF v_ada_transfer AND (p.pt_asal IS NULL OR p.status_pddikti_asal IS NULL) THEN
    kode := 'data_pt_asal'; pesan := 'Lengkapi perguruan tinggi asal dan status di PDDikti.'; RETURN NEXT;
  END IF;

  -- Berkas wajib
  IF v_ada_transfer AND (p.file_transkrip_url IS NULL) THEN
    kode := 'berkas_transkrip'; pesan := 'Unggah transkrip nilai dari perguruan tinggi asal.'; RETURN NEXT;
  END IF;
  IF v_ada_perolehan AND p.file_ijazah_sma_url IS NULL THEN
    kode := 'berkas_ijazah_slta'; pesan := 'Unggah ijazah SMA/SMK/MA atau sederajat (Juknis II.C angka 2).'; RETURN NEXT;
  END IF;

  -- F02 dan F07
  IF NOT EXISTS (SELECT 1 FROM biodata_pemohon b WHERE b.user_id = p.user_id
                 AND b.tempat_lahir IS NOT NULL AND b.tanggal_lahir IS NOT NULL AND b.alamat IS NOT NULL) THEN
    kode := 'f02_biodata'; pesan := 'Lengkapi data pribadi pada Formulir Aplikasi (F02).'; RETURN NEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM riwayat_hidup r WHERE r.user_id = p.user_id) THEN
    kode := 'f07'; pesan := 'Isi Daftar Riwayat Hidup (F07).'; RETURN NEXT;
  ELSIF EXISTS (SELECT 1 FROM riwayat_hidup r WHERE r.user_id = p.user_id AND r.status_pekerjaan = 'pegawai_tetap')
        AND p.file_f07_ttd_url IS NULL THEN
    kode := 'f07_atasan'; pesan := 'Unggah F07 yang sudah ditandatangani atasan langsung.'; RETURN NEXT;
  END IF;

  -- Daftar MK yang diajukan
  IF NOT EXISTS (SELECT 1 FROM mk_diajukan WHERE pengajuan_id = p.id) THEN
    kode := 'mk_kosong'; pesan := 'Pilih minimal satu mata kuliah yang diajukan.'; RETURN NEXT;
  END IF;

  -- F03 untuk setiap MK perolehan kredit
  IF EXISTS (
    SELECT 1 FROM mk_diajukan md
    WHERE md.pengajuan_id = p.id AND md.mekanisme = 'perolehan'
      AND NOT EXISTS (
        SELECT 1 FROM evaluasi_diri e
        WHERE e.pengajuan_id = p.id AND e.pernyataan_setuju
          AND (e.mk_id = md.mk_id OR EXISTS (SELECT 1 FROM klaster_mk k WHERE k.id = e.klaster_id AND md.mk_id = ANY (k.mk_ids)))
          AND jsonb_array_length(e.butir) > 0
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.butir) x WHERE coalesce(x->>'profisiensi', '') = '')
      )) THEN
    kode := 'f03'; pesan := 'Lengkapi Formulir Evaluasi Diri (F03) dan pernyataannya untuk setiap mata kuliah perolehan kredit.'; RETURN NEXT;
  END IF;
  -- MK yang sudah ditutup untuk RPL setelah dipilih pemohon
  SELECT string_agg(mk.nama_mk, ', ' ORDER BY mk.semester, mk.kode_mk) INTO v_tutup
  FROM mk_diajukan md JOIN mata_kuliah_kurikulum mk ON mk.id = md.mk_id
  WHERE md.pengajuan_id = p.id AND public.mk_tertutup(md.mk_id);
  IF v_tutup IS NOT NULL THEN
    kode := 'mk_ditutup';
    pesan := 'Mata kuliah berikut sudah tidak dibuka untuk RPL, ganti atau hapus dari daftar: ' || v_tutup || '.';
    RETURN NEXT;
  END IF;
END $$;

COMMIT;
