-- Fix get_driver_orders function to handle admin role and improve data hiding
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
    FROM public.orders o;
    
    RETURN;
  END IF;

  -- Check if driver is on active shift for pending orders
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_shifts 
    WHERE driver_shifts.driver_id = auth.uid() 
    AND is_active = true
  ) THEN
    -- If not on shift, only return their assigned orders
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
    WHERE o.driver_id = auth.uid();
    
    RETURN;
  END IF;

  -- Driver is on shift, return both assigned orders and pending orders with limited details
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
    -- Hide full address for pending orders
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.address
      ELSE split_part(o.address, ',', 1) || ', [Osoite piilotettu kunnes hyväksytty]'
    END as address,
    -- Hide customer name for pending orders
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.first_name
      ELSE 'Asiakas'
    END as first_name,
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.last_name
      ELSE ''
    END as last_name,
    -- Hide phone for pending orders
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.phone
      ELSE '[Piilotettu]'
    END as phone,
    o.driver_id,
    o.user_id
  FROM public.orders o
  WHERE 
    o.driver_id = auth.uid() OR o.status = 'pending'::order_status;
    
END;
$function$;