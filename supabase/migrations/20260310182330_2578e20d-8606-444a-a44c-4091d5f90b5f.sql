
-- Enum for work order status
CREATE TYPE public.work_order_status AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');

-- Enum for work order stage status
CREATE TYPE public.stage_status AS ENUM ('pending', 'in_progress', 'completed');

-- Enum for input type
CREATE TYPE public.input_type AS ENUM ('gold_raw', 'stones', 'other');

-- 1. Gold Work Orders
CREATE TABLE public.gold_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status work_order_status NOT NULL DEFAULT 'draft',
  product_name text NOT NULL,
  target_karat integer NOT NULL DEFAULT 21,
  gold_price_per_gram numeric NOT NULL DEFAULT 0,
  total_gold_input_weight numeric NOT NULL DEFAULT 0,
  total_output_weight numeric NOT NULL DEFAULT 0,
  total_loss_weight numeric NOT NULL DEFAULT 0,
  loss_percentage numeric NOT NULL DEFAULT 0,
  material_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  overhead_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Gold Work Order Inputs
CREATE TABLE public.gold_work_order_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.gold_work_orders(id) ON DELETE CASCADE,
  input_type input_type NOT NULL DEFAULT 'gold_raw',
  item_id uuid REFERENCES public.inventory_items(id),
  description text,
  karat integer DEFAULT 24,
  weight numeric NOT NULL DEFAULT 0,
  pure_gold_weight numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Gold Work Order Stages
CREATE TABLE public.gold_work_order_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.gold_work_orders(id) ON DELETE CASCADE,
  stage_order integer NOT NULL DEFAULT 1,
  stage_name text NOT NULL,
  status stage_status NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  input_weight numeric NOT NULL DEFAULT 0,
  output_weight numeric NOT NULL DEFAULT 0,
  loss_weight numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  worker_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Gold Work Order Outputs
CREATE TABLE public.gold_work_order_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.gold_work_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id),
  product_name text NOT NULL,
  karat integer NOT NULL DEFAULT 21,
  weight numeric NOT NULL DEFAULT 0,
  pure_gold_weight numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.gold_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_work_order_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_work_order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_work_order_outputs ENABLE ROW LEVEL SECURITY;

-- RLS for gold_work_orders
CREATE POLICY "Authenticated users can view work orders" ON public.gold_work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert work orders" ON public.gold_work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update work orders" ON public.gold_work_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete work orders" ON public.gold_work_orders FOR DELETE TO authenticated USING (true);

-- RLS for gold_work_order_inputs
CREATE POLICY "Authenticated users can view inputs" ON public.gold_work_order_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inputs" ON public.gold_work_order_inputs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inputs" ON public.gold_work_order_inputs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete inputs" ON public.gold_work_order_inputs FOR DELETE TO authenticated USING (true);

-- RLS for gold_work_order_stages
CREATE POLICY "Authenticated users can view stages" ON public.gold_work_order_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stages" ON public.gold_work_order_stages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stages" ON public.gold_work_order_stages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stages" ON public.gold_work_order_stages FOR DELETE TO authenticated USING (true);

-- RLS for gold_work_order_outputs
CREATE POLICY "Authenticated users can view outputs" ON public.gold_work_order_outputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert outputs" ON public.gold_work_order_outputs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update outputs" ON public.gold_work_order_outputs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete outputs" ON public.gold_work_order_outputs FOR DELETE TO authenticated USING (true);

-- Updated_at trigger for work orders
CREATE TRIGGER update_gold_work_orders_updated_at
  BEFORE UPDATE ON public.gold_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
