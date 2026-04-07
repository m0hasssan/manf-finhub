
-- Add exchange_rate column to sales_invoices
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;

-- Add exchange_rate column to purchase_invoices
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;
