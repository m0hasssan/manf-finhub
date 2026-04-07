
-- Allow authenticated users to delete journal entries
CREATE POLICY "Authenticated users can delete entries"
ON public.journal_entries
FOR DELETE
USING (true);
