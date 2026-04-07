
-- Create inventory_request_lines table for multi-item requests
CREATE TABLE public.inventory_request_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.inventory_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT NULL,
  total NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_request_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view request lines" ON public.inventory_request_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert request lines" ON public.inventory_request_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update request lines" ON public.inventory_request_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete request lines" ON public.inventory_request_lines FOR DELETE USING (true);

-- Migrate existing single-item requests to lines table
INSERT INTO public.inventory_request_lines (request_id, item_id, quantity, unit_price, total)
SELECT id, item_id, quantity, unit_price, total
FROM public.inventory_requests;
