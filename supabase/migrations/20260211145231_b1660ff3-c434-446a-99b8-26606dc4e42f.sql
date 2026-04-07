
-- Create inventory_requests table
CREATE TABLE public.inventory_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  type public.movement_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NULL,
  total NUMERIC NULL,
  warehouse TEXT DEFAULT 'المخزن الرئيسي',
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view requests" ON public.inventory_requests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert requests" ON public.inventory_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update requests" ON public.inventory_requests FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete requests" ON public.inventory_requests FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_requests_updated_at
  BEFORE UPDATE ON public.inventory_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for auto-numbering
CREATE SEQUENCE IF NOT EXISTS inventory_request_seq START 1;
