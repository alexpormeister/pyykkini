CREATE OR REPLACE FUNCTION public.driver_claim_task(p_task_id uuid, p_take_return boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_other RECORD;
  v_other_claimed boolean := false;
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

  IF v_task.task_type = 'delivery' THEN
    SELECT * INTO v_other FROM public.delivery_tasks
    WHERE order_id = v_task.order_id AND task_type = 'pickup'
    FOR UPDATE;

    -- Return task can only be claimed alone if the pickup is already handled by someone
    IF v_other.id IS NOT NULL AND v_other.status = 'unassigned' AND v_other.driver_id IS NULL THEN
      IF NOT p_take_return THEN
        RETURN jsonb_build_object('success', false, 'reason', 'pickup_required');
      END IF;
      UPDATE public.delivery_tasks
      SET driver_id = auth.uid(), status = 'assigned'
      WHERE id = v_other.id;
      v_other_claimed := true;
    END IF;
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
    v_other_claimed := FOUND;
  END IF;

  RETURN jsonb_build_object('success', true, 'return_claimed', v_other_claimed, 'pickup_claimed', v_other_claimed);
END;
$$;