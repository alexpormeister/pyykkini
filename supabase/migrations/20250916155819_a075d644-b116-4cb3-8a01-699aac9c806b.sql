-- Fix the RLS policies for driver order acceptance without OLD/NEW references

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
);