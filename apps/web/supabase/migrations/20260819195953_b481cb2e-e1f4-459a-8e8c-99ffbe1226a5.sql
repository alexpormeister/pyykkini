-- Robust product resolution + laundry price assignment
CREATE OR REPLACE FUNCTION public.laundry_decide_order(p_order_id uuid, p_laundry_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_laundry_member(auth.uid(), p_laundry_id) AND NOT public.has_role(auth.uid(), 'admin') THEN
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

  UPDATE public.orders
  SET laundry_id = p_laundry_id, laundry_status = 'accepted'
  WHERE id = p_order_id;

  -- resolve product by product_id OR by product name (legacy rows store generic service_type)
  UPDATE public.order_items oi
  SET laundry_id = p_laundry_id,
      laundry_price = ROUND(COALESCE(plp.price, pr.base_price, 0) * oi.quantity, 2)
  FROM public.products pr
  LEFT JOIN public.product_laundry_prices plp
    ON plp.product_id = pr.product_id AND plp.laundry_id = p_laundry_id AND plp.is_active = true
  WHERE oi.order_id = p_order_id
    AND (pr.product_id = oi.service_type
         OR lower(pr.name) = lower(COALESCE(oi.product_name, oi.service_name)));

  -- unresolvable items: assume zero margin instead of paying out the whole line
  UPDATE public.order_items
  SET laundry_id = p_laundry_id,
      laundry_price = total_price
  WHERE order_id = p_order_id AND laundry_price IS NULL;

  PERFORM public.recalculate_order_payouts(p_order_id);

  RETURN jsonb_build_object('success', true, 'decision', 'accepted');
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_order_payouts(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_platform_pct numeric;
  v_margin numeric;
  v_platform_fee numeric;
  v_driver numeric;
  v_total_driver numeric := 0;
  v_half numeric;
BEGIN
  FOR r IN
    SELECT oi.id, oi.total_price, oi.laundry_price,
           p.platform_fee_type, p.platform_fee_value
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

    v_margin := GREATEST(COALESCE(r.total_price, 0) - COALESCE(r.laundry_price, r.total_price, 0), 0);
    v_platform_fee := ROUND(v_margin * v_platform_pct / 100.0, 2);
    v_driver := ROUND(v_margin - v_platform_fee, 2);

    UPDATE public.order_items
    SET platform_fee = v_platform_fee,
        driver_payout = v_driver,
        commission_percent = v_platform_pct
    WHERE id = r.id;

    v_total_driver := v_total_driver + v_driver;
  END LOOP;

  v_half := ROUND(v_total_driver / 2.0, 2);

  UPDATE public.delivery_tasks
  SET driver_payout = CASE WHEN task_type = 'pickup' THEN v_half ELSE v_total_driver - v_half END
  WHERE order_id = p_order_id;

  RETURN v_total_driver;
END;
$$;

-- Driver completes pickup: generates the handover code the laundry must enter
CREATE OR REPLACE FUNCTION public.driver_complete_pickup(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_code text;
BEGIN
  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.driver_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF v_task.task_type <> 'pickup' THEN
    RAISE EXCEPTION 'Not a pickup task';
  END IF;

  UPDATE public.delivery_tasks
  SET status = 'completed', completed_at = now()
  WHERE id = p_task_id;

  SELECT access_code INTO v_code FROM public.orders WHERE id = v_task.order_id;
  IF v_code IS NULL THEN
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  END IF;

  UPDATE public.orders
  SET tracking_status = 'PICKED_UP',
      actual_pickup_time = COALESCE(actual_pickup_time, now()),
      access_code = v_code
  WHERE id = v_task.order_id;

  RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_complete_pickup(uuid) TO authenticated;

-- Laundry confirms receipt only with the driver's handover code
CREATE OR REPLACE FUNCTION public.laundry_confirm_receipt(p_order_id uuid, p_laundry_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_laundry_member(auth.uid(), p_laundry_id) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND laundry_id = p_laundry_id FOR UPDATE;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.tracking_status::text <> 'PICKED_UP' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_arrived');
  END IF;

  IF v_order.access_code IS NULL OR upper(btrim(p_code)) <> upper(v_order.access_code) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  UPDATE public.orders SET tracking_status = 'WASHING', status = 'washing' WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.laundry_confirm_receipt(uuid, uuid, text) TO authenticated;