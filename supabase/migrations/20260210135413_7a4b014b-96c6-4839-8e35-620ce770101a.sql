CREATE POLICY "Authenticated users can delete cash txns"
ON public.cash_transactions
FOR DELETE
TO authenticated
USING (true);