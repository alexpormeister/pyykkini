ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS min_order_fee numeric NOT NULL DEFAULT 7.00;
