
-- Allow authenticated users to delete sales invoices
CREATE POLICY "Authenticated users can delete sales invoices"
ON public.sales_invoices
FOR DELETE
USING (true);

-- Allow authenticated users to delete purchase invoices
CREATE POLICY "Authenticated users can delete purchase invoices"
ON public.purchase_invoices
FOR DELETE
USING (true);

-- Allow authenticated users to delete inventory movements
CREATE POLICY "Authenticated users can delete movements"
ON public.inventory_movements
FOR DELETE
USING (true);
