-- Temuan uji: pengajuan yang dibuat saat belum ada periode aktif tersimpan
-- dengan periode_id kosong, sehingga tarif tidak ditemukan dan tagihan tidak
-- pernah terbentuk.
--   1. Periode diisi otomatis dari periode aktif saat pengajuan dibuat/diubah.
--   2. Pengajuan tidak dapat dikirim tanpa periode.
--   3. Pengajuan alur baru yang periodenya kosong diisi periode aktif, lalu
--      tagihannya disusun ulang.
BEGIN;

CREATE OR REPLACE FUNCTION public.isi_periode_pengajuan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.alur_versi = 1 THEN RETURN NEW; END IF;
  IF NEW.periode_id IS NULL THEN
    SELECT id INTO NEW.periode_id FROM periode_rpl WHERE is_aktif LIMIT 1;  -- hanya satu yang aktif (aktifkan_periode)
  END IF;
  IF NEW.periode_id IS NULL AND NEW.status = 'diajukan' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'diajukan') THEN
    RAISE EXCEPTION 'Belum ada periode RPL yang dibuka. Hubungi Sekretariat RPL';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_isi_periode_pengajuan ON pengajuan_rpl;
CREATE TRIGGER trg_isi_periode_pengajuan BEFORE INSERT OR UPDATE ON pengajuan_rpl
  FOR EACH ROW EXECUTE FUNCTION public.isi_periode_pengajuan();

-- Data yang sudah ada.
DO $$ DECLARE v_periode uuid; r record; BEGIN
  SELECT id INTO v_periode FROM periode_rpl WHERE is_aktif LIMIT 1;
  IF v_periode IS NULL THEN RETURN; END IF;
  UPDATE pengajuan_rpl SET periode_id = v_periode
  WHERE periode_id IS NULL AND alur_versi IS DISTINCT FROM 1;
  FOR r IN SELECT id FROM pengajuan_rpl WHERE alur_versi IS DISTINCT FROM 1 AND status NOT IN ('draft', 'dibatalkan') LOOP
    PERFORM public.siapkan_tagihan(r.id);
  END LOOP;
END $$;

COMMIT;
