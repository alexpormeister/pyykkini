-- Fix the get_driver_orders function to properly handle driver access
DROP FUNCTION IF EXISTS public.get_driver_orders();

CREATE OR REPLACE FUNCTION public.get_driver_orders()
 RETURNS TABLE(id uuid, pickup_date date, pickup_time time without time zone, return_date date, return_time time without time zone, service_type text, service_name text, price numeric, status order_status, created_at timestamp with time zone, address text, first_name text, last_name text, phone text, driver_id uuid, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is a driver or admin
  IF NOT (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: Only drivers and admins can access this function';
  END IF;

  -- If admin, return all orders with full data
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.pickup_date,
      o.pickup_time,
      o.return_date,
      o.return_time,
      o.service_type,
      o.service_name,
      o.price,
      o.status,
      o.created_at,
      o.address,
      o.first_name,
      o.last_name,
      o.phone,
      o.driver_id,
      o.user_id
    FROM public.orders o
    ORDER BY o.created_at DESC;
    
    RETURN;
  END IF;

  -- For drivers: Return their assigned orders AND pending unassigned orders (if on shift)
  RETURN QUERY
  SELECT 
    o.id,
    o.pickup_date,
    o.pickup_time,
    o.return_date,
    o.return_time,
    o.service_type,
    o.service_name,
    o.price,
    o.status,
    o.created_at,
    -- Show full address for assigned orders, limited for pending
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.address
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN 
        split_part(o.address, ',', 1) || ', [Osoite piilotettu kunnes hyväksytty]'
      ELSE o.address
    END as address,
    -- Show full name for assigned orders, limited for pending
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
    -- Show phone for assigned orders, hidden for pending
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.phone
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN '[Piilotettu]'
      ELSE o.phone
    END as phone,
    o.driver_id,
    o.user_id
  FROM public.orders o
  WHERE 
    -- ALWAYS show orders assigned to this driver (regardless of shift status)
    o.driver_id = auth.uid() 
    OR 
    -- Show pending unassigned orders ONLY if driver is on active shift
    (o.status = 'pending'::order_status 
     AND o.driver_id IS NULL 
     AND EXISTS (
       SELECT 1 FROM public.driver_shifts 
       WHERE driver_shifts.driver_id = auth.uid() 
       AND is_active = true
     )
    )
  ORDER BY 
    CASE WHEN o.driver_id = auth.uid() THEN 0 ELSE 1 END, -- Assigned orders first
    o.created_at DESC;
    
END;
$function$;