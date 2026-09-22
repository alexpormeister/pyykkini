-- Fix remaining functions with mutable search paths

-- Fix log_time_changes function
CREATE OR REPLACE FUNCTION public.log_time_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Log pickup time changes
  IF OLD.pickup_date IS DISTINCT FROM NEW.pickup_date OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'pickup_time_changed',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time
      ),
      'Noutohaarukka muutettu: ' || 
      COALESCE(OLD.pickup_date::text, 'null') || ' ' || COALESCE(OLD.pickup_time::text, 'null') || 
      ' -> ' || NEW.pickup_date::text || ' ' || NEW.pickup_time::text
    );
  END IF;
  
  -- Log return time changes
  IF OLD.return_date IS DISTINCT FROM NEW.return_date OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'return_time_changed',
      jsonb_build_object(
        'return_date', OLD.return_date,
        'return_time', OLD.return_time
      ),
      jsonb_build_object(
        'return_date', NEW.return_date,
        'return_time', NEW.return_time
      ),
      'Palautushaarukka muutettu: ' || 
      COALESCE(OLD.return_date::text, 'null') || ' ' || COALESCE(OLD.return_time::text, 'null') || 
      ' -> ' || NEW.return_date::text || ' ' || NEW.return_time::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix log_order_status_change function
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_order_change(
      NEW.id,
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Tilauksen tila muuttui: ' || COALESCE(OLD.status::text, 'null') || ' -> ' || NEW.status::text
    );
  END IF;
  
  -- Log when driver is assigned
  IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.log_order_change(
      NEW.id,
      'accepted',
      jsonb_build_object('driver_id', OLD.driver_id),
      jsonb_build_object('driver_id', NEW.driver_id),
      'Kuljettaja hyväksyi tilauksen'
    );
  END IF;
  
  -- Log when pickup/return times are updated
  IF OLD.actual_pickup_time IS DISTINCT FROM NEW.actual_pickup_time 
     OR OLD.actual_return_time IS DISTINCT FROM NEW.actual_return_time
     OR OLD.pickup_date IS DISTINCT FROM NEW.pickup_date
     OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time
     OR OLD.return_date IS DISTINCT FROM NEW.return_date
     OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'time_updated',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time,
        'return_date', OLD.return_date,
        'return_time', OLD.return_time,
        'actual_pickup_time', OLD.actual_pickup_time,
        'actual_return_time', OLD.actual_return_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time,
        'return_date', NEW.return_date,
        'return_time', NEW.return_time,
        'actual_pickup_time', NEW.actual_pickup_time,
        'actual_return_time', NEW.actual_return_time
      ),
      'Nouto- tai palautusaikoja päivitettiin'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix log_order_creation function
CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.log_order_change(
    NEW.id,
    'created',
    NULL,
    row_to_json(NEW)::jsonb,
    'Tilaus luotu'
  );
  
  RETURN NEW;
END;
$$;

-- Fix delete_auth_user function
CREATE OR REPLACE FUNCTION public.delete_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This will be handled by the edge function instead
  -- Just return the old record for now
  RETURN OLD;
END;
$$;

-- Fix check_all_drivers_rejected function
CREATE OR REPLACE FUNCTION public.check_all_drivers_rejected()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  total_active_drivers INTEGER;
  total_rejections INTEGER;
BEGIN
  -- Count active drivers (those currently in shift)
  SELECT COUNT(DISTINCT driver_id) INTO total_active_drivers
  FROM public.driver_shifts 
  WHERE is_active = TRUE;
  
  -- Count rejections for this order
  SELECT COUNT(*) INTO total_rejections
  FROM public.orders 
  WHERE id = NEW.id 
    AND status = 'rejected' 
    AND rejected_by IS NOT NULL;
  
  -- If all active drivers have rejected this order, mark it as rejected
  IF total_rejections >= total_active_drivers AND total_active_drivers > 0 THEN
    UPDATE public.orders 
    SET status = 'rejected'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix get_driver_orders function
CREATE OR REPLACE FUNCTION public.get_driver_orders()
RETURNS TABLE(id uuid, pickup_date date, pickup_time time without time zone, return_date date, return_time time without time zone, service_type text, service_name text, price numeric, status order_status, created_at timestamp with time zone, address text, first_name text, last_name text, phone text, driver_id uuid, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;