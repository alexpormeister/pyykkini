-- Fix the RLS policies for driver order acceptance
-- Drop the conflicting policies and create a clear, working policy

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Drivers can accept pending orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can accept unassigned pending orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can update assigned orders" ON public.orders; 
DROP POLICY IF EXISTS "Drivers can update their assigned orders" ON public.orders;

-- Create a single, clear policy for drivers to accept and update orders
CREATE POLICY "Drivers can accept and update orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role) AND (
    -- Can accept unassigned pending orders
    (status = 'pending'::order_status AND driver_id IS NULL) OR
    -- Can update their own assigned orders
    (driver_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'driver'::app_role) AND (
    -- When accepting: can assign to themselves
    (OLD.status = 'pending'::order_status AND OLD.driver_id IS NULL AND NEW.driver_id = auth.uid()) OR
    -- When updating their own orders: driver_id must remain theirs
    (OLD.driver_id = auth.uid() AND NEW.driver_id = auth.uid())
  )
);