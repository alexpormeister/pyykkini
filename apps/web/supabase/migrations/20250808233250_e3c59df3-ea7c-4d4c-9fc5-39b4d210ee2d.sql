-- Fix all functions to have secure search_path
-- This prevents SQL injection attacks through search path manipulation

-- Function 1: log_order_change
DROP FUNCTION IF EXISTS public.log_order_change(uuid, text, jsonb, jsonb, text);
CREATE OR REPLACE FUNCTION public.log_order_change(p_order_id uuid, p_change_type text, p_old_value jsonb DEFAULT NULL::jsonb, p_new_value jsonb DEFAULT NULL::jsonb, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO public.order_history (
    order_id,
    changed_by,
    change_type,
    old_value,
    new_value,
    change_description
  ) VALUES (
    p_order_id,
    auth.uid(),
    p_change_type,
    p_old_value,
    p_new_value,
    p_description
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$function$;

-- Function 2: log_order_status_change
DROP FUNCTION IF EXISTS public.log_order_status_change();
CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Function 3: log_order_creation
DROP FUNCTION IF EXISTS public.log_order_creation();
CREATE OR REPLACE FUNCTION public.log_order_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Function 4: update_updated_at_column
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function 5: handle_new_user
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  
  -- Assign customer role by default for new signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$function$;

-- Function 6: has_role
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Function 7: check_all_drivers_rejected
DROP FUNCTION IF EXISTS public.check_all_drivers_rejected();
CREATE OR REPLACE FUNCTION public.check_all_drivers_rejected()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;