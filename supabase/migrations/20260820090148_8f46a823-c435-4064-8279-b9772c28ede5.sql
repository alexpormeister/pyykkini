ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_price numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_bearer text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS discount_custom_partner_fee numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_custom_driver_fee numeric NULL;

CREATE OR REPLACE FUNCTION public.recalculate_order_payouts(p_order_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_platform_pct numeric;
  v_qty numeric;
  v_paid numeric;
  v_laundry numeric;
  v_normal numeric;
  v_margin numeric;
  v_platform_fee numeric;
  v_driver numeric;
  v_ratio numeric;
  v_total_driver numeric := 0;
  v_half numeric;
BEGIN
  FOR r IN
    SELECT oi.id, oi.total_price, oi.laundry_price, oi.quantity,
           p.platform_fee_type, p.platform_fee_value, p.base_price,
           p.discount_price, p.discount_bearer,
           p.discount_custom_partner_fee, p.discount_custom_driver_fee
    FROM public.order_items oi
    LEFT JOIN public.products p
      ON p.product_id = oi.service_type
      OR lower(p.name) = lower(COALESCE(oi.product_name, oi.service_name))
    WHERE oi.order_id = p_order_id
  LOOP
    v_platform_pct := CASE
      WHEN r.platform_fee_type = 'percent' THEN COALESCE(r.platform_fee_value, 20)
      ELSE 20
    END;
    v_qty := GREATEST(COALESCE(r.quantity, 1), 1);
    v_paid := COALESCE(r.total_price, 0);
    v_laundry := COALESCE(r.laundry_price, r.total_price, 0);

    -- normal (undiscounted) customer total for this line
    v_normal := CASE
      WHEN r.discount_price IS NOT NULL AND r.base_price IS NOT NULL AND r.discount_price < r.base_price
        THEN ROUND(r.base_price * v_qty, 2)
      ELSE v_paid
    END;

    v_margin := GREATEST(v_normal - v_laundry, 0);
    v_platform_fee := ROUND(v_margin * v_platform_pct / 100.0, 2);
    v_driver := ROUND(v_margin - v_platform_fee, 2);

    IF v_normal > v_paid THEN
      CASE COALESCE(r.discount_bearer, 'platform')
        WHEN 'pro_rata' THEN
          v_ratio := CASE WHEN v_normal > 0 THEN v_paid / v_normal ELSE 1 END;
          v_laundry := ROUND(v_laundry * v_ratio, 2);
          v_platform_fee := ROUND(v_platform_fee * v_ratio, 2);
          v_driver := ROUND(v_paid - v_laundry - v_platform_fee, 2);
        WHEN 'partner' THEN
          -- platform and driver keep normal fees, laundry absorbs the discount
          v_laundry := ROUND(v_paid - v_platform_fee - v_driver, 2);
        WHEN 'custom' THEN
          v_laundry := ROUND(COALESCE(r.discount_custom_partner_fee, v_laundry) * v_qty, 2);
          v_driver := ROUND(COALESCE(r.discount_custom_driver_fee, 0) * v_qty, 2);
          v_platform_fee := ROUND(v_paid - v_laundry - v_driver, 2);
        ELSE
          -- 'platform': laundry & driver keep full normal payouts, platform absorbs discount
          v_platform_fee := ROUND(v_paid - v_laundry - v_driver, 2);
      END CASE;
    END IF;

    UPDATE public.order_items
    SET platform_fee = v_platform_fee,
        driver_payout = v_driver,
        laundry_price = v_laundry,
        commission_percent = v_platform_pct
    WHERE id = r.id;

    v_total_driver := v_total_driver + GREATEST(v_driver, 0);
  END LOOP;

  v_half := ROUND(v_total_driver / 2.0, 2);

  UPDATE public.delivery_tasks
  SET driver_payout = CASE WHEN task_type = 'pickup' THEN v_half ELSE v_total_driver - v_half END
  WHERE order_id = p_order_id;

  RETURN v_total_driver;
END;
$function$;