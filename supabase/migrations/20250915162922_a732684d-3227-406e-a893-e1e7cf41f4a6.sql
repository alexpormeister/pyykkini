-- Fix critical security issue: Replace view with secure function

-- Drop the insecure view
DROP VIEW IF EXISTS public.driver_pending_orders;

-- Create a secure function that returns filtered order data for drivers
CREATE OR REPLACE FUNCTION public.get_driver_orders()
RETURNS TABLE (
  id uuid,
  pickup_date date,
  pickup_time time,
  return_date date,
  return_time time,
  service_type text,
  service_name text,
  price numeric,
  status order_status,
  created_at timestamp with time zone,
  address text,
  first_name text,
  last_name text,
  phone text,
  driver_id uuid,
  user_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is a driver
  IF NOT has_role(auth.uid(), 'driver'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only drivers can access this function';
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

  -- Driver is on shift, return both assigned orders and safe pending orders
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
    -- Show full details for assigned orders, limited details for pending
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.address
      ELSE split_part(o.address, ',', 1) || ', [Exact address hidden until accepted]'
    END as address,
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.first_name
      ELSE '[Hidden]'
    END as first_name,
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.last_name
      ELSE '[Hidden]'
    END as last_name,
    CASE 
      WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.phone
      ELSE '[Hidden]'
    END as phone,
    o.driver_id,
    o.user_id
  FROM public.orders o
  WHERE 
    o.driver_id = auth.uid() OR o.status = 'pending'::order_status;
    
END;
$$;