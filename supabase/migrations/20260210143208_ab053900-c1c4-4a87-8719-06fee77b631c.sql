CREATE POLICY "Authenticated users can delete custodies"
ON public.custodies
FOR DELETE
USING (true);