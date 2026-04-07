-- Create Cost of Goods Sold account
INSERT INTO public.accounts (code, name, type, level, parent_id, is_active)
VALUES ('512', 'تكلفة البضاعة المباعة', 'expense', 2, 
  (SELECT id FROM public.accounts WHERE code = '51' LIMIT 1), true);
