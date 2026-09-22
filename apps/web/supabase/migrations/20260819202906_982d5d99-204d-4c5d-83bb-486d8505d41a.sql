-- Driver picks up finished laundry from the laundry (only after laundry marked ready)
CREATE OR REPLACE FUNCTION public.driver_pickup_from_laundry(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_track text;
BEGIN
  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.driver_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF v_task.task_type <> 'delivery' THEN
    RAISE EXCEPTION 'Not a delivery task';
  END IF;

  SELECT tracking_status::text INTO v_track FROM public.orders WHERE id = v_task.order_id;

  IF v_track NOT IN ('PACKAGING', 'OUT_FOR_DELIVERY') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_ready');
  END IF;

  UPDATE public.delivery_tasks SET status = 'in_progress' WHERE id = p_task_id;

  UPDATE public.orders
  SET tracking_status = 'OUT_FOR_DELIVERY', status = 'returning'
  WHERE id = v_task.order_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Delivery completion now requires a measured return weight
CREATE OR REPLACE FUNCTION public.driver_complete_delivery(p_task_id uuid, p_weight_kg numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_pickup_done boolean;
  v_track text;
BEGIN
  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.driver_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_tasks p
    WHERE p.order_id = v_task.order_id AND p.task_type = 'pickup' AND p.status = 'completed'
  ) INTO v_pickup_done;

  IF NOT v_pickup_done THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pickup_not_done');
  END IF;

  SELECT tracking_status::text INTO v_track FROM public.orders WHERE id = v_task.order_id;
  IF v_track NOT IN ('OUT_FOR_DELIVERY', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_picked_from_laundry');
  END IF;

  IF p_weight_kg IS NULL OR p_weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'weight_required');
  END IF;

  UPDATE public.delivery_tasks
  SET status = 'completed', completed_at = now()
  WHERE id = p_task_id;

  UPDATE public.orders
  SET tracking_status = 'COMPLETED', status = 'delivered', actual_return_time = now(),
      return_weight_kg = p_weight_kg
  WHERE id = v_task.order_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Anonymised completed task history for drivers (no customer name/address/phone)
CREATE OR REPLACE FUNCTION public.get_driver_completed_tasks()
RETURNS TABLE(
  id uuid,
  order_id uuid,
  task_type text,
  completed_at timestamp with time zone,
  scheduled_date date,
  scheduled_time_slot text,
  driver_payout numeric,
  pickup_weight_kg numeric,
  return_weight_kg numeric,
  items text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    dt.id, dt.order_id, dt.task_type, dt.completed_at,
    dt.scheduled_date, dt.scheduled_time_slot, dt.driver_payout,
    o.pickup_weight_kg, o.return_weight_kg,
    COALESCE(ARRAY(
      SELECT COALESCE(oi.product_name, oi.service_name) || ' × ' || oi.quantity
      FROM public.order_items oi WHERE oi.order_id = dt.order_id
    ), '{}'::text[]) AS items
  FROM public.delivery_tasks dt
  JOIN public.orders o ON o.id = dt.order_id
  WHERE dt.driver_id = auth.uid()
    AND dt.status = 'completed'
  ORDER BY dt.completed_at DESC NULLS LAST;
$function$;