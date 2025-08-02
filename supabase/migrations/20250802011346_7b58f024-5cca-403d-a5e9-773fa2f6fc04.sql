-- Add new columns for pickup and return options
ALTER TABLE public.orders 
ADD COLUMN pickup_option text,
ADD COLUMN return_option text;

-- Add check constraints for the new columns
ALTER TABLE public.orders 
ADD CONSTRAINT pickup_option_check 
CHECK (pickup_option IN ('immediate', 'choose_time', 'no_preference'));

ALTER TABLE public.orders 
ADD CONSTRAINT return_option_check 
CHECK (return_option IN ('immediate', 'choose_time', 'no_preference'));