-- Temuan uji: F03 dapat disimpan dengan profisiensi "Baik"/"Sangat baik"
-- tanpa merujuk satu pun bukti portofolio, dan lolos daftar periksa BAAK.
-- Juknis: setiap klaim kemampuan dirujuk ke nomor bukti.
BEGIN;

CREATE OR REPLACE FUNCTION public.jaga_bukti_f03() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kurang int;
BEGIN
  SELECT count(*) INTO v_kurang
  FROM jsonb_array_elements(coalesce(NEW.butir, '[]'::jsonb)) x
  WHERE x->>'profisiensi' IN ('baik', 'sangat_baik')
    AND jsonb_array_length(CASE WHEN jsonb_typeof(x->'bukti') = 'array' THEN x->'bukti' ELSE '[]'::jsonb END) = 0;
  IF v_kurang > 0 THEN
    RAISE EXCEPTION 'Rujuk nomor bukti untuk % butir berprofisiensi baik atau sangat baik, atau ubah menjadi "Tidak pernah"', v_kurang;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jaga_bukti_f03 ON evaluasi_diri;
CREATE TRIGGER trg_jaga_bukti_f03 BEFORE INSERT OR UPDATE OF butir ON evaluasi_diri
  FOR EACH ROW EXECUTE FUNCTION public.jaga_bukti_f03();

COMMIT;
