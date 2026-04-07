-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department TEXT,
  job_title TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update employees" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Admins can delete employees" ON public.employees FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add employee_id and account_id to custodies
ALTER TABLE public.custodies ADD COLUMN employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.custodies ADD COLUMN account_id UUID REFERENCES public.accounts(id);

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();