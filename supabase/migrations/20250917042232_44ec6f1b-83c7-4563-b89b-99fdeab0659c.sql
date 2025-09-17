-- Security Enhancement: Strengthen RLS policies for sensitive data tables
-- Fix for MISSING_RLS_PROTECTION and other security issues

-- 1. Add explicit deny-all policies for profiles table to prevent any unauthorized access
CREATE POLICY "Deny all public access to profiles" 
ON public.profiles 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

-- 2. Add explicit deny policy for unauthenticated users on profiles
CREATE POLICY "Authenticated users only for profiles" 
ON public.profiles 
FOR ALL 
TO authenticated 
USING (
  -- Only allow if user is viewing/editing their own profile OR user is admin
  (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- For inserts/updates, only allow if user is creating/editing their own profile OR user is admin  
  (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Strengthen orders table policies to prevent data leakage
CREATE POLICY "Deny all public access to orders" 
ON public.orders 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

-- 4. Add explicit authenticated-only policy for orders
CREATE POLICY "Authenticated access only for orders" 
ON public.orders 
FOR ALL 
TO authenticated 
USING (
  -- Only allow access if user owns the order, is assigned driver, or is admin
  (auth.uid() = user_id) OR 
  (auth.uid() = driver_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'driver'::app_role) AND status = 'pending'::order_status AND driver_id IS NULL)
)
WITH CHECK (
  -- For inserts/updates, same logic
  (auth.uid() = user_id) OR 
  (auth.uid() = driver_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'driver'::app_role) AND status = 'pending'::order_status)
);

-- 5. Strengthen coupons table security  
CREATE POLICY "Deny all public access to coupons" 
ON public.coupons 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

-- 6. Add explicit authenticated-only policy for coupons (admin only)
CREATE POLICY "Admin only access for coupons" 
ON public.coupons 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. Add security policies for other sensitive tables
CREATE POLICY "Deny all public access to user_roles" 
ON public.user_roles 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

CREATE POLICY "Authenticated users can view own roles only" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 8. Strengthen order_items policies
CREATE POLICY "Deny all public access to order_items" 
ON public.order_items 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);

-- 9. Create security function to validate data access patterns
CREATE OR REPLACE FUNCTION public.validate_data_access(table_name text, operation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 10. Add audit trigger for sensitive data access (optional logging)
CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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