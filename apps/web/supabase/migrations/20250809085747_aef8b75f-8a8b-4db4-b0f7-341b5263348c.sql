-- First, update any existing rows that might have invalid return_option values
UPDATE public.orders 
SET return_option = 'immediate' 
WHERE return_option NOT IN ('immediate', 'choose_time') OR return_option IS NULL;

-- Now drop and recreate the constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS return_option_check;
ALTER TABLE public.orders ADD CONSTRAINT return_option_check 
CHECK (return_option IN ('immediate', 'choose_time', 'automatic'));