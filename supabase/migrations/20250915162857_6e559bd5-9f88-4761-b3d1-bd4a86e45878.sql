-- Fix critical security issue: Add RLS policies for driver_pending_orders view

-- First, enable RLS on the view
ALTER VIEW public.driver_pending_orders SET (security_invoker = true);

-- Add RLS policies specifically for the driver_pending_orders view
-- Note: Views inherit some security from underlying tables, but need explicit policies for full protection

-- Create a policy that ensures only drivers can access the view and only see appropriate data
CREATE POLICY "Drivers can view pending orders safely" 
ON public.driver_pending_orders 
FOR SELECT 
USING (
  -- Only drivers can access this view
  has_role(auth.uid(), 'driver'::app_role) AND 
  (
    -- Drivers can see full details of their assigned orders
    driver_id = auth.uid() 
    OR 
    -- For pending orders, drivers can only see them if they are currently on an active shift
    (status = 'pending'::order_status AND 
     EXISTS (
       SELECT 1 FROM public.driver_shifts 
       WHERE driver_id = auth.uid() 
       AND is_active = true
     )
    )
  )
);

-- Also add admin access policy for the view
CREATE POLICY "Admins can view all driver pending orders" 
ON public.driver_pending_orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));