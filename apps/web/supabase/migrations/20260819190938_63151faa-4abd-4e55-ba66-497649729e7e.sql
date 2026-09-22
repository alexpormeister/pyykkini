ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS laundry_status text NOT NULL DEFAULT 'pending';
UPDATE public.orders SET laundry_status = 'accepted' WHERE created_at < now();

CREATE OR REPLACE FUNCTION public.create_delivery_tasks_for_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_laundry RECORD;
  v_total_payout NUMERIC;
  v_half NUMERIC;
  v_customer_name TEXT;
  v_laundry_name TEXT;
  v_laundry_address TEXT;
  v_laundry_phone TEXT;
BEGIN
  SELECT * INTO v_laundry FROM public.laundries WHERE id = NEW.laundry_id;

  v_laundry_name := COALESCE(v_laundry.name, 'Pesula (määritetään)');
  v_laundry_address := COALESCE(v_laundry.address, '');
  v_laundry_phone := COALESCE(v_laundry.contact_phone, '');
  v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  SELECT COALESCE(SUM(driver_payout), 0) INTO v_total_payout
  FROM public.order_items WHERE order_id = NEW.id;

  IF v_total_payout = 0 THEN
    v_total_payout := ROUND(COALESCE(NEW.final_price, 0) * 0.15, 2);
  END IF;

  v_half := ROUND(v_total_payout / 2.0, 2);

  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    scheduled_date, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'pickup', NEW.laundry_id,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    NEW.pickup_date, to_char(NEW.pickup_time, 'HH24:MI'),
    CASE WHEN COALESCE(NEW.laundry_status, 'pending') = 'accepted' THEN 'unassigned' ELSE 'pending' END,
    v_half
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
    NEW.return_date, to_char(NEW.return_time, 'HH24:MI'), 'pending', v_total_payout - v_half
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_laundry_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.laundry_status IS DISTINCT FROM OLD.laundry_status THEN
    IF NEW.laundry_status = 'accepted' THEN
      UPDATE public.delivery_tasks
      SET status = 'unassigned'
      WHERE order_id = NEW.id AND task_type = 'pickup' AND status = 'pending';
    ELSIF NEW.laundry_status = 'rejected' THEN
      UPDATE public.delivery_tasks
      SET status = 'cancelled'
      WHERE order_id = NEW.id AND status IN ('pending', 'unassigned');
      NEW.status := 'cancelled'::order_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_laundry_decision ON public.orders;
CREATE TRIGGER orders_laundry_decision
BEFORE UPDATE OF laundry_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_laundry_decision();

CREATE OR REPLACE FUNCTION public.get_driver_orders()
 RETURNS TABLE(id uuid, pickup_date date, pickup_time time without time zone, return_date date, return_time time without time zone, service_type text, service_name text, price numeric, final_price numeric, status order_status, created_at timestamp with time zone, address text, first_name text, last_name text, phone text, driver_id uuid, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: Only drivers and admins can access this function';
  END IF;

  INSERT INTO public.audit_log (user_id, action, table_name, metadata)
  VALUES (
    auth.uid(),
    'get_driver_orders',
    'orders',
    jsonb_build_object(
      'role', CASE
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
        ELSE 'driver'
      END,
      'timestamp', now()
    )
  );

  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY
    SELECT
      o.id, o.pickup_date, o.pickup_time, o.return_date, o.return_time,
      o.service_type, o.service_name, o.price, o.final_price, o.status, o.created_at,
      o.address, o.first_name, o.last_name, o.phone, o.driver_id, o.user_id
    FROM public.orders o
    ORDER BY o.created_at DESC;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.pickup_date, o.pickup_time, o.return_date, o.return_time,
    o.service_type, o.service_name, o.price, o.final_price, o.status, o.created_at,
    CASE
      WHEN o.driver_id = auth.uid() THEN o.address
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN
        '[Osoite piilotettu kunnes hyväksytty]' ||
        CASE
          WHEN strpos(o.address, ',') > 0 THEN substr(o.address, strpos(o.address, ','))
          ELSE ''
        END
      ELSE o.address
    END as address,
    CASE
      WHEN o.driver_id = auth.uid() THEN o.first_name
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN 'Asiakas'
      ELSE o.first_name
    END as first_name,
    CASE
      WHEN o.driver_id = auth.uid() THEN o.last_name
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN ''
      ELSE o.last_name
    END as last_name,
    CASE
      WHEN o.driver_id = auth.uid() THEN o.phone
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN
        '***-' || RIGHT(o.phone, 4)
      ELSE o.phone
    END as phone,
    o.driver_id,
    o.user_id
  FROM public.orders o
  WHERE
    o.driver_id = auth.uid()
    OR (o.status = 'pending'::order_status
        AND o.driver_id IS NULL
        AND o.laundry_status = 'accepted'
        AND EXISTS (
          SELECT 1 FROM public.driver_shifts
          WHERE driver_shifts.driver_id = auth.uid()
          AND is_active = true
        ))
  ORDER BY
    CASE WHEN o.driver_id = auth.uid() THEN 0 ELSE 1 END,
    o.created_at DESC;
END;
$function$;