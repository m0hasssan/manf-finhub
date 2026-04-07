
-- =============================================
-- 1. PROFILES TABLE (linked to auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  job_title TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. USER ROLES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'accountant',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Auto-assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'accountant');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- =============================================
-- 3. CHART OF ACCOUNTS (5 levels, self-referencing)
-- =============================================
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
  parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_accounts_parent ON public.accounts(parent_id);
CREATE INDEX idx_accounts_type ON public.accounts(type);
CREATE INDEX idx_accounts_code ON public.accounts(code);

-- =============================================
-- 4. CUSTOMERS
-- =============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit NUMERIC(15,2) DEFAULT 0,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 5. SUPPLIERS
-- =============================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit NUMERIC(15,2) DEFAULT 0,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 6. INVENTORY ITEMS
-- =============================================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  category TEXT,
  cost_price NUMERIC(15,2) DEFAULT 0,
  sell_price NUMERIC(15,2) DEFAULT 0,
  current_stock NUMERIC(15,3) DEFAULT 0,
  min_stock NUMERIC(15,3) DEFAULT 0,
  warehouse TEXT DEFAULT 'المخزن الرئيسي',
  is_active BOOLEAN NOT NULL DEFAULT true,
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view items" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert items" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update items" ON public.inventory_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete items" ON public.inventory_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 7. INVENTORY MOVEMENTS
-- =============================================
CREATE TYPE public.movement_type AS ENUM ('in', 'out');

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type movement_type NOT NULL,
  reference TEXT NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  total NUMERIC(15,2) NOT NULL,
  warehouse TEXT DEFAULT 'المخزن الرئيسي',
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  notes TEXT,
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update movements" ON public.inventory_movements FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_movements_item ON public.inventory_movements(item_id);
CREATE INDEX idx_movements_date ON public.inventory_movements(date);

-- =============================================
-- 8. BANK ACCOUNTS
-- =============================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  opening_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view banks" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert banks" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update banks" ON public.bank_accounts FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 9. CASH TRANSACTIONS (Treasury)
-- =============================================
CREATE TYPE public.cash_transaction_type AS ENUM ('receipt', 'payment');

CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type cash_transaction_type NOT NULL,
  reference TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cash txns" ON public.cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cash txns" ON public.cash_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cash txns" ON public.cash_transactions FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_cash_txns_date ON public.cash_transactions(date);

-- =============================================
-- 10. CHECKS
-- =============================================
CREATE TYPE public.check_type AS ENUM ('received', 'issued');
CREATE TYPE public.check_status AS ENUM ('pending', 'collected', 'bounced', 'cashed', 'endorsed');

CREATE TABLE public.checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  type check_type NOT NULL,
  status check_status NOT NULL DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  party_name TEXT NOT NULL,
  bank_name TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  notes TEXT,
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checks" ON public.checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert checks" ON public.checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update checks" ON public.checks FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_checks_due_date ON public.checks(due_date);
CREATE INDEX idx_checks_status ON public.checks(status);

-- =============================================
-- 11. CUSTODIES (العهد)
-- =============================================
CREATE TYPE public.custody_status AS ENUM ('active', 'partial', 'settled');

CREATE TABLE public.custodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_name TEXT NOT NULL,
  department TEXT,
  purpose TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  settled_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  status custody_status NOT NULL DEFAULT 'active',
  notes TEXT,
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custodies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custodies" ON public.custodies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custodies" ON public.custodies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update custodies" ON public.custodies FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 12. CUSTODY SETTLEMENTS (تسوية العهد)
-- =============================================
CREATE TABLE public.custody_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_id UUID REFERENCES public.custodies(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  receipt_number TEXT,
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custody_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settlements" ON public.custody_settlements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settlements" ON public.custody_settlements FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 13. JOURNAL ENTRIES (قيود اليومية)
-- =============================================
CREATE TYPE public.journal_status AS ENUM ('draft', 'posted', 'void');

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  status journal_status NOT NULL DEFAULT 'draft',
  reference_type TEXT,
  reference_id UUID,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  posted_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view entries" ON public.journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update entries" ON public.journal_entries FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_journal_date ON public.journal_entries(date);
CREATE INDEX idx_journal_number ON public.journal_entries(number);

-- =============================================
-- 14. JOURNAL ENTRY LINES (تفاصيل القيود)
-- =============================================
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lines" ON public.journal_entry_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lines" ON public.journal_entry_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lines" ON public.journal_entry_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete lines" ON public.journal_entry_lines FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_journal_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_entry_lines(account_id);

-- =============================================
-- 15. ADD FK for journal_entry_id references
-- =============================================
ALTER TABLE public.inventory_movements 
  ADD CONSTRAINT fk_inv_mov_journal FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);

ALTER TABLE public.cash_transactions 
  ADD CONSTRAINT fk_cash_txn_journal FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);

ALTER TABLE public.checks 
  ADD CONSTRAINT fk_check_journal FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);

ALTER TABLE public.custodies 
  ADD CONSTRAINT fk_custody_journal FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);

ALTER TABLE public.custody_settlements 
  ADD CONSTRAINT fk_settlement_journal FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);

-- =============================================
-- 16. UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checks_updated_at BEFORE UPDATE ON public.checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custodies_updated_at BEFORE UPDATE ON public.custodies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
