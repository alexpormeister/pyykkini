-- Fix calculate_order_item_payouts_before to prevent unassigned record errors when laundry_id is NULL
CREATE OR REPLACE FUNCTION public.calculate_order_item_payouts_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laundry_id uuid;
  v_qty numeric;
  v_paid numeric;
  v_laundry_unit numeric;
  v_laundry_total numeric;
  v_margin numeric;
  v_driver_pct numeric;
  v_driver numeric;
  v_platform_fee numeric;
  
  v_prod_id uuid;
  v_prod_product_id text;
  v_prod_name text;
  v_prod_base_price numeric;
  v_prod_driver_fee_type text;
  v_prod_driver_fee_value numeric;
  v_prod_platform_fee_value numeric;
  v_prod_commission_percent numeric;
  
  v_plp_price numeric;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT laundry_id INTO v_laundry_id FROM public.orders WHERE id = NEW.order_id;

  SELECT 
    p.id,
    p.product_id,
    p.name,
    p.base_price,
    p.driver_fee_type,
    p.driver_fee_value,
    p.platform_fee_value,
    p.commission_percent
  INTO 
    v_prod_id,
    v_prod_product_id,
    v_prod_name,
    v_prod_base_price,
    v_prod_driver_fee_type,
    v_prod_driver_fee_value,
    v_prod_platform_fee_value,
    v_prod_commission_percent
  FROM public.products p
  WHERE p.product_id = NEW.service_type
     OR lower(p.name) = lower(COALESCE(NEW.product_name, NEW.service_name))
     OR (lower(COALESCE(NEW.product_name, NEW.service_name)) LIKE '%matto%' AND p.product_id = 'mattopesu')
     OR (lower(COALESCE(NEW.product_name, NEW.service_name)) LIKE '%puku%' AND p.product_id = 'standard-puku')
     OR (lower(COALESCE(NEW.product_name, NEW.service_name)) LIKE '%takki%' AND p.product_id = 'prod_untuvatakki')
     OR (lower(COALESCE(NEW.product_name, NEW.service_name)) LIKE '%tyyny%' AND p.product_id = 'prod_tyyny')
  ORDER BY 
    CASE WHEN p.product_id = NEW.service_type THEN 1 
         WHEN lower(p.name) = lower(COALESCE(NEW.product_name, NEW.service_name)) THEN 2 
         ELSE 3 END
  LIMIT 1;

  IF v_laundry_id IS NOT NULL AND (v_prod_product_id IS NOT NULL OR v_prod_id IS NOT NULL) THEN
    SELECT plp.price INTO v_plp_price
    FROM public.product_laundry_prices plp
    WHERE (plp.product_id = v_prod_product_id OR plp.product_id = v_prod_id::text)
      AND plp.laundry_id = v_laundry_id
      AND plp.is_active = true
    LIMIT 1;
  END IF;

  v_qty := GREATEST(COALESCE(NEW.quantity, 1), 1);
  v_paid := COALESCE(NEW.total_price, NEW.unit_price * v_qty, 0);

  IF v_plp_price IS NOT NULL THEN
    v_laundry_unit := v_plp_price;
  ELSIF NEW.laundry_price IS NOT NULL AND NEW.laundry_price > 0 THEN
    v_laundry_unit := ROUND(NEW.laundry_price / v_qty, 2);
  ELSIF v_prod_base_price IS NOT NULL THEN
    v_laundry_unit := ROUND(v_prod_base_price * 0.5, 2);
  ELSE
    v_laundry_unit := ROUND(v_paid * 0.5 / v_qty, 2);
  END IF;

  v_laundry_total := ROUND(v_laundry_unit * v_qty, 2);
  v_margin := GREATEST(v_paid - v_laundry_total, 0);

  IF v_prod_driver_fee_type = 'percent' AND v_prod_driver_fee_value IS NOT NULL AND v_prod_driver_fee_value > 0 THEN
    v_driver_pct := v_prod_driver_fee_value;
  ELSIF v_prod_platform_fee_value IS NOT NULL AND v_prod_platform_fee_value > 0 THEN
    v_driver_pct := GREATEST(100.0 - v_prod_platform_fee_value, 0);
  ELSIF v_prod_commission_percent IS NOT NULL AND v_prod_commission_percent > 0 THEN
    v_driver_pct := GREATEST(100.0 - v_prod_commission_percent, 0);
  ELSE
    v_driver_pct := 85.0;
  END IF;

  IF v_prod_driver_fee_type = 'fixed' AND v_prod_driver_fee_value IS NOT NULL AND v_prod_driver_fee_value > 0 THEN
    v_driver := LEAST(ROUND(v_prod_driver_fee_value * v_qty, 2), v_margin);
    v_platform_fee := ROUND(v_margin - v_driver, 2);
  ELSE
    v_driver := ROUND(v_margin * (v_driver_pct / 100.0), 2);
    v_platform_fee := ROUND(v_margin - v_driver, 2);
  END IF;

  NEW.laundry_id := v_laundry_id;
  NEW.laundry_price := v_laundry_total;
  NEW.driver_payout := v_driver;
  NEW.platform_fee := v_platform_fee;
  NEW.commission_percent := ROUND(100.0 - v_driver_pct, 2);

  RETURN NEW;
END;
$$;
