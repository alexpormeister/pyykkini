-- 1. Laundries
CREATE TABLE IF NOT EXISTS public.laundries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  city text,
  address text,
  contact_email text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.laundries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundries TO authenticated;
GRANT ALL ON public.laundries TO service_role;

ALTER TABLE public.laundries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active laundries"
  ON public.laundries FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert laundries"
  ON public.laundries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update laundries"
  ON public.laundries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete laundries"
  ON public.laundries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_laundries_updated_at
  BEFORE UPDATE ON public.laundries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Product / laundry price list
CREATE TABLE IF NOT EXISTS public.product_laundry_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  laundry_id uuid NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (product_id, laundry_id)
);

GRANT SELECT ON public.product_laundry_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_laundry_prices TO authenticated;
GRANT ALL ON public.product_laundry_prices TO service_role;

ALTER TABLE public.product_laundry_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view laundry prices"
  ON public.product_laundry_prices FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert laundry prices"
  ON public.product_laundry_prices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update laundry prices"
  ON public.product_laundry_prices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete laundry prices"
  ON public.product_laundry_prices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_laundry_prices_updated_at
  BEFORE UPDATE ON public.product_laundry_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fee structure on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS platform_fee_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS platform_fee_value numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS driver_fee_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS driver_fee_value numeric NOT NULL DEFAULT 10;

UPDATE public.products SET platform_fee_value = COALESCE(commission_percent, 15) WHERE platform_fee_value = 15;

-- 4. Order-level laundry + item level breakdown
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS laundry_id uuid REFERENCES public.laundries(id);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS laundry_id uuid REFERENCES public.laundries(id),
  ADD COLUMN IF NOT EXISTS laundry_price numeric,
  ADD COLUMN IF NOT EXISTS platform_fee numeric;

-- 5. Pricing helper: resolve customer price + splits for a product/laundry
CREATE OR REPLACE FUNCTION public.get_product_pricing(p_product_id text, p_laundry_id uuid DEFAULT NULL)
RETURNS TABLE(
  product_id text,
  laundry_id uuid,
  laundry_price numeric,
  platform_fee numeric,
  driver_payout numeric,
  customer_price numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prod RECORD;
  v_laundry_price numeric;
  v_platform numeric;
  v_driver numeric;
BEGIN
  SELECT * INTO v_prod FROM public.products WHERE products.product_id = p_product_id;
  IF v_prod IS NULL THEN
    RETURN;
  END IF;

  SELECT plp.price INTO v_laundry_price
  FROM public.product_laundry_prices plp
  WHERE plp.product_id = p_product_id
    AND plp.laundry_id = p_laundry_id
    AND plp.is_active = true;

  IF v_laundry_price IS NULL THEN
    v_laundry_price := v_prod.base_price;
  END IF;

  IF v_prod.platform_fee_type = 'fixed' THEN
    v_platform := v_prod.platform_fee_value;
  ELSE
    v_platform := ROUND(v_laundry_price * v_prod.platform_fee_value / 100.0, 2);
  END IF;

  IF v_prod.driver_fee_type = 'fixed' THEN
    v_driver := v_prod.driver_fee_value;
  ELSE
    v_driver := ROUND(v_laundry_price * v_prod.driver_fee_value / 100.0, 2);
  END IF;

  RETURN QUERY SELECT
    p_product_id,
    p_laundry_id,
    v_laundry_price,
    v_platform,
    v_driver,
    ROUND(v_laundry_price + v_platform + v_driver, 2);
END;
$$;