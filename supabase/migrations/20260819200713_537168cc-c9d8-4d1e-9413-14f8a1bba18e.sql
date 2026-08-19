-- Return gig becomes openly available as soon as the laundry accepts the order
CREATE OR REPLACE FUNCTION public.handle_laundry_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.laundry_status IS DISTINCT FROM OLD.laundry_status THEN
    IF NEW.laundry_status = 'accepted' THEN
      UPDATE public.delivery_tasks
      SET status = 'unassigned'
      WHERE order_id = NEW.id AND status = 'pending';
    ELSIF NEW.laundry_status = 'rejected' THEN
      UPDATE public.delivery_tasks
      SET status = 'cancelled'
      WHERE order_id = NEW.id AND status IN ('pending', 'unassigned');
      NEW.status := 'cancelled'::order_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_delivery_tasks_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laundry RECORD;
  v_total_payout NUMERIC;
  v_half NUMERIC;
  v_customer_name TEXT;
  v_laundry_name TEXT;
  v_laundry_address TEXT;
  v_laundry_phone TEXT;
  v_status TEXT;
BEGIN
  SELECT * INTO v_laundry FROM public.laundries WHERE id = NEW.laundry_id;

  v_laundry_name := COALESCE(v_laundry.name, 'Pesula (määritetään)');
  v_laundry_address := COALESCE(v_laundry.address, '');
  v_laundry_phone := COALESCE(v_laundry.contact_phone, '');
  v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  SELECT COALESCE(SUM(driver_payout), 0) INTO v_total_payout
  FROM public.order_items WHERE order_id = NEW.id;

  v_half := ROUND(v_total_payout / 2.0, 2);
  v_status := CASE WHEN COALESCE(NEW.laundry_status, 'pending') = 'accepted' THEN 'unassigned' ELSE 'pending' END;

  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    scheduled_date, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'pickup', NEW.laundry_id,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    NEW.pickup_date, to_char(NEW.pickup_time, 'HH24:MI'), v_status, v_half
  );

  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    scheduled_date, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'delivery', NEW.laundry_id,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    v_customer_name, NEW.address, NEW.phone,
    NEW.return_date, to_char(NEW.return_time, 'HH24:MI'), v_status, v_total_payout - v_half
  );

  RETURN NEW;
END;
$$;

-- Open gigs for drivers, without exposing the exact street address before claiming
CREATE OR REPLACE FUNCTION public.get_open_delivery_tasks()
RETURNS TABLE(
  id uuid, order_id uuid, task_type text, status text,
  area text, laundry_name text,
  scheduled_date date, scheduled_time_slot text,
  driver_payout numeric, pickup_done boolean, pickup_claimed boolean,
  items text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dt.id, dt.order_id, dt.task_type, dt.status,
    CASE
      WHEN dt.task_type = 'pickup' THEN NULLIF(btrim(substr(COALESCE(dt.origin_address, ''), COALESCE(NULLIF(strpos(dt.origin_address, ','), 0) + 1, 1))), '')
      ELSE NULLIF(btrim(substr(COALESCE(dt.destination_address, ''), COALESCE(NULLIF(strpos(dt.destination_address, ','), 0) + 1, 1))), '')
    END AS area,
    COALESCE(l.name, 'Pesula') AS laundry_name,
    dt.scheduled_date, dt.scheduled_time_slot, dt.driver_payout,
    EXISTS (SELECT 1 FROM public.delivery_tasks p WHERE p.order_id = dt.order_id AND p.task_type = 'pickup' AND p.status = 'completed') AS pickup_done,
    EXISTS (SELECT 1 FROM public.delivery_tasks p WHERE p.order_id = dt.order_id AND p.task_type = 'pickup' AND p.driver_id IS NOT NULL) AS pickup_claimed,
    COALESCE(ARRAY(
      SELECT COALESCE(oi.product_name, oi.service_name) || ' × ' || oi.quantity
      FROM public.order_items oi WHERE oi.order_id = dt.order_id
    ), '{}'::text[]) AS items
  FROM public.delivery_tasks dt
  LEFT JOIN public.laundries l ON l.id = dt.laundry_id
  WHERE dt.status = 'unassigned'
    AND dt.driver_id IS NULL
    AND (public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin'))
  ORDER BY dt.scheduled_date, dt.scheduled_time_slot;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_delivery_tasks() TO authenticated;

-- Claim a gig; optionally take the matching return trip in the same move
CREATE OR REPLACE FUNCTION public.driver_claim_task(p_task_id uuid, p_take_return boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_return_claimed boolean := false;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.driver_id IS NOT NULL OR v_task.status <> 'unassigned' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_taken');
  END IF;

  UPDATE public.delivery_tasks
  SET driver_id = auth.uid(), status = 'assigned'
  WHERE id = p_task_id;

  IF v_task.task_type = 'pickup' AND p_take_return THEN
    UPDATE public.delivery_tasks
    SET driver_id = auth.uid(), status = 'assigned'
    WHERE order_id = v_task.order_id
      AND task_type = 'delivery'
      AND driver_id IS NULL
      AND status = 'unassigned';
    v_return_claimed := FOUND;
  END IF;

  RETURN jsonb_build_object('success', true, 'return_claimed', v_return_claimed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_claim_task(uuid, boolean) TO authenticated;

-- Return trip cannot be completed before the pickup trip is done
CREATE OR REPLACE FUNCTION public.driver_complete_delivery(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_pickup_done boolean;
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

  UPDATE public.delivery_tasks
  SET status = 'completed', completed_at = now()
  WHERE id = p_task_id;

  UPDATE public.orders
  SET tracking_status = 'COMPLETED', status = 'delivered', actual_return_time = now()
  WHERE id = v_task.order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_complete_delivery(uuid) TO authenticated;

-- Open up return trips for orders the laundry has already accepted
UPDATE public.delivery_tasks dt
SET status = 'unassigned'
WHERE dt.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dt.order_id AND o.laundry_status = 'accepted'
      AND o.status NOT IN ('cancelled', 'rejected', 'delivered')
  );