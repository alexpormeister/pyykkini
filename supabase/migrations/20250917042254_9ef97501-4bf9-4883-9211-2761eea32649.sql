-- Fix function search path security issue
-- Update existing functions to have secure search_path settings

-- Fix the validate_data_access function
CREATE OR REPLACE FUNCTION public.validate_data_access(table_name text, operation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log access attempts for sensitive tables
  IF table_name IN ('profiles', 'orders', 'coupons', 'user_roles') THEN
    -- In production, this could log to an audit table
    RAISE LOG 'Access attempt to % table for % operation by user %', table_name, operation, auth.uid();
  END IF;
  
  -- Always return true for now (policies handle the actual restrictions)
  RETURN true;
END;
$$;

-- Fix the audit_sensitive_access function
CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This function can be extended to log sensitive data access
  -- For now, it just validates the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized access attempt to sensitive data';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix existing functions that might have mutable search paths
CREATE OR REPLACE FUNCTION public.log_order_change(p_order_id uuid, p_change_type text, p_old_value jsonb DEFAULT NULL::jsonb, p_new_value jsonb DEFAULT NULL::jsonb, p_description text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix the has_role function to ensure secure search path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  
  -- Only assign customer role if no role was manually assigned within 2 seconds
  -- This allows admin to create users with specific roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'customer'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;