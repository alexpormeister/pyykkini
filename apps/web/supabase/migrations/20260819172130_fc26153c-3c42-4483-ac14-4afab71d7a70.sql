CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  issue_type text NOT NULL DEFAULT 'other',
  description text,
  image_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  compensation_amount numeric NOT NULL DEFAULT 0,
  coupon_code text,
  admin_notes text,
  created_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage complaints" ON public.complaints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own complaints" ON public.complaints FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own complaints" ON public.complaints FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_complaints_order_id ON public.complaints(order_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();