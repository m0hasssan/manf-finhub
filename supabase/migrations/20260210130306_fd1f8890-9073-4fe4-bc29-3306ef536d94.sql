
-- Sales Invoices table
CREATE TABLE public.sales_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Invoice Lines
CREATE TABLE public.sales_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Invoices table
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Invoice Lines
CREATE TABLE public.purchase_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_invoices
CREATE POLICY "Authenticated users can view sales invoices" ON public.sales_invoices FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert sales invoices" ON public.sales_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update sales invoices" ON public.sales_invoices FOR UPDATE USING (true);

-- RLS Policies for sales_invoice_lines
CREATE POLICY "Authenticated users can view sales invoice lines" ON public.sales_invoice_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert sales invoice lines" ON public.sales_invoice_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sales invoice lines" ON public.sales_invoice_lines FOR DELETE USING (true);

-- RLS Policies for purchase_invoices
CREATE POLICY "Authenticated users can view purchase invoices" ON public.purchase_invoices FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert purchase invoices" ON public.purchase_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update purchase invoices" ON public.purchase_invoices FOR UPDATE USING (true);

-- RLS Policies for purchase_invoice_lines
CREATE POLICY "Authenticated users can view purchase invoice lines" ON public.purchase_invoice_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert purchase invoice lines" ON public.purchase_invoice_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can delete purchase invoice lines" ON public.purchase_invoice_lines FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_sales_invoices_updated_at BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
