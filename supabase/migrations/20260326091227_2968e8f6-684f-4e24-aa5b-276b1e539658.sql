
ALTER TABLE public.accounts ADD COLUMN opening_balance_debit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN opening_balance_credit numeric NOT NULL DEFAULT 0;

-- Migrate existing data: positive opening_balance goes to debit for asset/expense, credit for others
UPDATE public.accounts SET 
  opening_balance_debit = CASE 
    WHEN type IN ('asset', 'expense') AND opening_balance > 0 THEN opening_balance
    WHEN type NOT IN ('asset', 'expense') AND opening_balance < 0 THEN ABS(opening_balance)
    ELSE 0 
  END,
  opening_balance_credit = CASE 
    WHEN type NOT IN ('asset', 'expense') AND opening_balance > 0 THEN opening_balance
    WHEN type IN ('asset', 'expense') AND opening_balance < 0 THEN ABS(opening_balance)
    ELSE 0 
  END;
