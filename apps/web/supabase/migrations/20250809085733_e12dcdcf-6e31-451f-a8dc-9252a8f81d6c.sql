-- Update return_option check constraint to allow 'automatic' value
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS return_option_check;

-- Add updated constraint that includes 'automatic' as valid option
ALTER TABLE public.orders ADD CONSTRAINT return_option_check 
CHECK (return_option IN ('immediate', 'choose_time', 'automatic'));