CREATE SEQUENCE IF NOT EXISTS public.journal_entries_number_seq;

SELECT setval(
  'public.journal_entries_number_seq',
  COALESCE(
    (
      SELECT MAX(NULLIF(regexp_replace(number, '\D', '', 'g'), '')::bigint)
      FROM public.journal_entries
    ),
    0
  )
);

CREATE OR REPLACE FUNCTION public.set_journal_entry_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR btrim(NEW.number) = '' THEN
    NEW.number := 'JE-' || lpad(nextval('public.journal_entries_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_journal_entry_number ON public.journal_entries;

CREATE TRIGGER trg_set_journal_entry_number
BEFORE INSERT ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_journal_entry_number();