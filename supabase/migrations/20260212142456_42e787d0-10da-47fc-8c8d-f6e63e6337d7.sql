
-- Create action_logs table
CREATE TABLE public.action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  action text NOT NULL, -- 'create', 'update', 'delete'
  entity_type text NOT NULL, -- 'customer', 'supplier', 'sales_invoice', etc.
  entity_id text,
  entity_name text,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view logs
CREATE POLICY "Authenticated users can view logs"
ON public.action_logs FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert logs
CREATE POLICY "Authenticated users can insert logs"
ON public.action_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_action_logs_created_at ON public.action_logs(created_at DESC);
CREATE INDEX idx_action_logs_user_id ON public.action_logs(user_id);
