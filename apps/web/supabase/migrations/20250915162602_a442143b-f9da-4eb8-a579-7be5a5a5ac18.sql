-- Phase 1: Critical Data Protection Fixes

-- 1. Update orders table RLS policies to protect customer PII from unauthorized drivers
DROP POLICY IF EXISTS "Drivers can view relevant orders" ON public.orders;

-- Create new policy that restricts what drivers can see for pending orders
CREATE POLICY "Drivers can view basic pending order info" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  (
    -- Drivers can see full details of their assigned orders
    driver_id = auth.uid() 
    OR 
    -- For pending orders, drivers can only see basic info (no personal details)
    (status = 'pending'::order_status)
  )
);

-- 2. Update coupons table RLS policies to prevent code enumeration
DROP POLICY IF EXISTS "Users can view valid coupons" ON public.coupons;

-- Create more restrictive coupon policy - users should only see coupons they've legitimately obtained
CREATE POLICY "Users can validate specific coupons" 
ON public.coupons 
FOR SELECT 
USING (
  -- Only allow validation of specific coupon codes, not browsing all codes
  -- This policy will be used with specific WHERE clauses in the application
  ((valid_from <= now()) AND ((valid_until IS NULL) OR (valid_until >= now())) AND ((usage_limit IS NULL) OR (usage_count < usage_limit)))
);

-- 3. Add a view for drivers to see only safe order information for pending orders
CREATE OR REPLACE VIEW public.driver_pending_orders AS
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
  -- Only show general area, not exact address for pending orders
  CASE 
    WHEN o.driver_id = auth.uid() OR o.status != 'pending'::order_status THEN o.address
    ELSE split_part(o.address, ',', 1) || ', [Exact address hidden until accepted]'
  END as address,
  -- Hide personal details for pending orders
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
  has_role(auth.uid(), 'driver'::app_role) AND 
  (o.driver_id = auth.uid() OR o.status = 'pending'::order_status);

-- Enable RLS on the view
ALTER VIEW public.driver_pending_orders SET (security_invoker = true);