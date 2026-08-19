-- 1) Laundries can see unclaimed pending orders
CREATE POLICY "Laundry members can view unclaimed orders"
ON public.orders FOR SELECT TO authenticated
USING (
  laundry_id IS NULL
  AND laundry_status = 'pending'
  AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.laundry_users lu WHERE lu.user_id = auth.uid())
);

CREATE POLICY "Laundry members can view unclaimed order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.laundry_id IS NULL
      AND o.laundry_status = 'pending'
  )
  AND EXISTS (SELECT 1 FROM public.laundry_users lu WHERE lu.user_id = auth.uid())
);

-- 2) Recompute payouts: (customer price - laundry price) - platform % = driver total, split 50/50
CREATE OR REPLACE FUNCTION public.recalculate_order_payouts(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_platform_pct numeric;
  v_margin numeric;
  v_platform_fee numeric;
  v_driver numeric;
  v_total_driver numeric := 0;
  v_final numeric;
  v_half numeric;
BEGIN
  FOR r IN
    SELECT oi.id, oi.total_price, oi.laundry_price, oi.quantity, oi.service_type,
           p.platform_fee_type, p.platform_fee_value
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.product_id = oi.service_type
    WHERE oi.order_id = p_order_id
  LOOP
    v_platform_pct := CASE
      WHEN r.platform_fee_type = 'percent' THEN COALESCE(r.platform_fee_value, 20)
      ELSE 20
    END;

    v_margin := GREATEST(COALESCE(r.total_price, 0) - COALESCE(r.laundry_price, 0), 0);
    v_platform_fee := ROUND(v_margin * v_platform_pct / 100.0, 2);
    v_driver := ROUND(v_margin - v_platform_fee, 2);

    UPDATE public.order_items
    SET platform_fee = v_platform_fee,
        driver_payout = v_driver,
        commission_percent = v_platform_pct
    WHERE id = r.id;

    v_total_driver := v_total_driver + v_driver;
  END LOOP;

  IF v_total_driver <= 0 THEN
    SELECT final_price INTO v_final FROM public.orders WHERE id = p_order_id;
    v_total_driver := ROUND(COALESCE(v_final, 0) * 0.15, 2);
  END IF;

  v_half := ROUND(v_total_driver / 2.0, 2);

  UPDATE public.delivery_tasks
  SET driver_payout = CASE WHEN task_type = 'pickup' THEN v_half ELSE v_total_driver - v_half END
  WHERE order_id = p_order_id;

  RETURN v_total_driver;
END;
$$;

-- 3) Laundry claims / rejects an order
CREATE OR REPLACE FUNCTION public.laundry_decide_order(p_order_id uuid, p_laundry_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_laundry_member(auth.uid(), p_laundry_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.laundry_id IS NOT NULL AND v_order.laundry_id <> p_laundry_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;

  IF v_order.laundry_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_decided');
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.orders SET laundry_status = 'rejected' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'decision', 'rejected');
  END IF;

  -- claim the order
  UPDATE public.orders
  SET laundry_id = p_laundry_id, laundry_status = 'accepted'
  WHERE id = p_order_id;

  -- set this laundry's purchase prices on the order items
  UPDATE public.order_items oi
  SET laundry_id = p_laundry_id,
      laundry_price = ROUND(COALESCE(plp.price, pr.base_price, 0) * oi.quantity, 2)
  FROM public.products pr
  LEFT JOIN public.product_laundry_prices plp
    ON plp.product_id = pr.product_id AND plp.laundry_id = p_laundry_id AND plp.is_active = true
  WHERE oi.order_id = p_order_id AND pr.product_id = oi.service_type;

  PERFORM public.recalculate_order_payouts(p_order_id);

  RETURN jsonb_build_object('success', true, 'decision', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.laundry_decide_order(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_order_payouts(uuid) TO authenticated, service_role;