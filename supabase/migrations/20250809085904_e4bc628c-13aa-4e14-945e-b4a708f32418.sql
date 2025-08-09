-- First, update any existing rows that might have invalid pickup_option values
UPDATE public.orders 
SET pickup_option = 'immediate' 
WHERE pickup_option NOT IN ('immediate', 'choose_time') OR pickup_option IS NULL;

-- Now drop and recreate the pickup_option constraint to allow new values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS pickup_option_check;
ALTER TABLE public.orders ADD CONSTRAINT pickup_option_check 
CHECK (pickup_option IN ('immediate', 'choose_time', 'asap'));