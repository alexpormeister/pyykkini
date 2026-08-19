-- Map users to laundries
CREATE TABLE public.laundry_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  laundry_id uuid NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (laundry_id, user_id)
);
GRANT SELECT ON public.laundry_users TO authenticated;
GRANT ALL ON public.laundry_users TO service_role;
ALTER TABLE public.laundry_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_laundry_member(_user_id uuid, _laundry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.laundry_users WHERE user_id = _user_id AND laundry_id = _laundry_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_laundry_member(uuid, uuid) FROM anon;

CREATE POLICY "Members and admins can view laundry memberships" ON public.laundry_users
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage laundry memberships" ON public.laundry_users
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Laundry staff access to their orders
CREATE POLICY "Laundry members can view their orders" ON public.orders
FOR SELECT TO authenticated USING (laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), laundry_id));
CREATE POLICY "Laundry members can update their orders" ON public.orders
FOR UPDATE TO authenticated USING (laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), laundry_id))
WITH CHECK (laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), laundry_id));

CREATE POLICY "Laundry members can view their order items" ON public.order_items
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), o.laundry_id))
);

CREATE POLICY "Laundry members can view their settlements" ON public.settlements
FOR SELECT TO authenticated USING (payee_type = 'laundry' AND payee_id IS NOT NULL AND public.is_laundry_member(auth.uid(), payee_id));

CREATE POLICY "Laundry members can view their laundry" ON public.laundries
FOR SELECT TO authenticated USING (public.is_laundry_member(auth.uid(), id));

CREATE POLICY "Laundry members can view their prices" ON public.product_laundry_prices
FOR SELECT TO authenticated USING (public.is_laundry_member(auth.uid(), laundry_id));

-- Intake notes / condition photos
CREATE TABLE public.laundry_order_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  laundry_id uuid NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  created_by uuid,
  note text,
  image_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.laundry_order_notes TO authenticated;
GRANT ALL ON public.laundry_order_notes TO service_role;
ALTER TABLE public.laundry_order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Laundry members and admins can view notes" ON public.laundry_order_notes
FOR SELECT TO authenticated USING (public.is_laundry_member(auth.uid(), laundry_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Laundry members can add notes" ON public.laundry_order_notes
FOR INSERT TO authenticated WITH CHECK (public.is_laundry_member(auth.uid(), laundry_id) AND created_by = auth.uid());

-- Contracts
CREATE TABLE public.laundry_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  laundry_id uuid NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  valid_from date,
  valid_until date,
  payment_terms text,
  notes text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.laundry_contracts TO authenticated;
GRANT ALL ON public.laundry_contracts TO service_role;
ALTER TABLE public.laundry_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Laundry members can view their contracts" ON public.laundry_contracts
FOR SELECT TO authenticated USING (public.is_laundry_member(auth.uid(), laundry_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage contracts" ON public.laundry_contracts
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_laundry_contracts_updated_at BEFORE UPDATE ON public.laundry_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();