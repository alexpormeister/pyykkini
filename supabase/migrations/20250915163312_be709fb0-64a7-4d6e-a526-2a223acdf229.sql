-- Additional security hardening: Fix remaining coupon exposure issue

-- Drop the existing permissive coupon policy
DROP POLICY IF EXISTS "Users can validate specific coupons" ON public.coupons;

-- Create a more restrictive policy that prevents browsing all coupons
-- This policy will only allow RPC function access, not direct table access
CREATE POLICY "Coupons require secure validation" 
ON public.coupons 
FOR SELECT 
USING (
  -- Only allow admin access for management
  has_role(auth.uid(), 'admin'::app_role)
);

-- Update the secure coupon validation function to be the only way to validate coupons
-- This prevents direct table access for coupon enumeration