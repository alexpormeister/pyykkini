ALTER TABLE public.delivery_tasks DROP CONSTRAINT IF EXISTS delivery_tasks_status_check;
ALTER TABLE public.delivery_tasks ADD CONSTRAINT delivery_tasks_status_check CHECK (status = ANY (ARRAY['pending','unassigned','assigned','in_progress','awaiting_laundry','completed','failed','cancelled','rejected']::text[]));

CREATE OR REPLACE FUNCTION public.driver_complete_pickup(p_task_id uuid, p_weight_kg numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF p_weight_kg IS NULL OR p_weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'weight_required');
  END IF;

  SELECT access_code INTO v_code FROM public.orders WHERE id = v_task.order_id;
  IF v_code IS NULL THEN
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  END IF;

  -- Task stays with the driver until the laundry confirms the handover code
  UPDATE public.delivery_tasks
  SET status = 'awaiting_laundry'
  WHERE id = p_task_id;

  UPDATE public.orders
  SET tracking_status = 'PICKED_UP',
      status = 'picking_up',
      actual_pickup_time = COALESCE(actual_pickup_time, now()),
      pickup_weight_kg = p_weight_kg,
      access_code = v_code
  WHERE id = v_task.order_id;

  RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$function$;

DROP FUNCTION IF EXISTS public.driver_complete_pickup(uuid);

CREATE OR REPLACE FUNCTION public.laundry_confirm_receipt(p_order_id uuid, p_laundry_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Pickup task is only completed once the laundry confirms receipt
  UPDATE public.delivery_tasks
  SET status = 'completed', completed_at = now()
  WHERE order_id = p_order_id
    AND task_type = 'pickup'
    AND status IN ('awaiting_laundry', 'in_progress', 'assigned');

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_handover_info(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_allowed boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.delivery_tasks dt
        WHERE dt.order_id = p_order_id AND dt.driver_id = auth.uid()
      )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT access_code, pickup_weight_kg, return_weight_kg, tracking_status
  INTO v_order
  FROM public.orders WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'access_code', v_order.access_code,
    'pickup_weight_kg', v_order.pickup_weight_kg,
    'return_weight_kg', v_order.return_weight_kg,
    'tracking_status', v_order.tracking_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_orders_handover_info(p_order_ids uuid[])
RETURNS TABLE(order_id uuid, access_code text, pickup_weight_kg numeric, tracking_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.access_code, o.pickup_weight_kg, o.tracking_status::text
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.delivery_tasks dt
        WHERE dt.order_id = o.id AND dt.driver_id = auth.uid()
      )
    );
$function$;