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