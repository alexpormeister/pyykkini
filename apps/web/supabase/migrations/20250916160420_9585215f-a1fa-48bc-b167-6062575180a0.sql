-- Fix the SELECT policy to allow drivers to see pending unassigned orders
-- Drop all existing driver SELECT policies and create a new one

DROP POLICY IF EXISTS "Drivers can view assigned and pending orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can only view their assigned orders" ON public.orders;

-- Create a new policy that allows drivers to see both assigned orders and pending unassigned orders
CREATE POLICY "Drivers can view assigned and pending orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role) AND (
    -- Can see their own assigned orders
    driver_id = auth.uid() OR
    -- Can see pending unassigned orders (to accept them)
    (status = 'pending'::order_status AND driver_id IS NULL)
  )
);