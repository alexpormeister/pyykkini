ALTER TABLE public.products ADD COLUMN IF NOT EXISTS processing_time_days numeric NOT NULL DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS processing_time_days numeric NOT NULL DEFAULT 1;
