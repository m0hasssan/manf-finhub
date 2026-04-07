
-- Add currency support to journal_entries
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;
