-- Fix critical security issue: Restrict direct access to orders table for drivers

-- Drop the overly permissive driver policy on orders table
DROP POLICY IF EXISTS "Drivers can view basic pending order info" ON public.orders;

-- Create a much more restrictive policy for drivers on the orders table
CREATE POLICY "Drivers can only view their assigned orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  -- Drivers can ONLY see their own assigned orders, not pending orders
  driver_id = auth.uid()
);

-- Create a separate policy for drivers to accept pending orders (UPDATE only)
CREATE POLICY "Drivers can accept unassigned pending orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  status = 'pending'::order_status AND 
  driver_id IS NULL
);

-- Add a policy for drivers to update their assigned orders
CREATE POLICY "Drivers can update their assigned orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  driver_id = auth.uid()
);

-- Note: Drivers will now need to use the get_driver_orders() function to see pending orders
-- This function provides data masking and proper access control