CREATE TABLE public.settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payee_type text NOT NULL CHECK (payee_type IN ('laundry','driver')),
  payee_id uuid,
  payee_name text NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  platform_commission numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  order_ids uuid[] NOT NULL DEFAULT '{}',
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'paid',
  paid_at timestamp with time zone DEFAULT now(),
  paid_by uuid,
  paid_by_name text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settlements" ON public.settlements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create settlements" ON public.settlements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update settlements" ON public.settlements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete settlements" ON public.settlements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON public.settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_settlements_payee ON public.settlements (payee_type, payee_id);
CREATE INDEX idx_settlements_paid_at ON public.settlements (paid_at DESC);