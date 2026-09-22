-- First update existing null addresses with a placeholder
UPDATE public.profiles 
SET address = 'Osoite puuttuu - päivitä profiilissa' 
WHERE address IS NULL OR address = '';

-- Add rejection functionality to orders table
ALTER TABLE public.orders 
ADD COLUMN rejected_by uuid REFERENCES auth.users(id),
ADD COLUMN rejection_reason text,
ADD COLUMN rejection_timestamp timestamp with time zone;

-- Now make address required
ALTER TABLE public.profiles 
ALTER COLUMN address SET NOT NULL;

-- Update profiles RLS to allow admins to see all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));