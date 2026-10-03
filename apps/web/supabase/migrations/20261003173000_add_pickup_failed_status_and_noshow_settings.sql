-- Add PICKUP_FAILED to order_tracking_status enum
ALTER TYPE public.order_tracking_status ADD VALUE IF NOT EXISTS 'PICKUP_FAILED';

-- Add driver_wait_time_minutes and no_show_fee to app_settings table
ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS driver_wait_time_minutes INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS no_show_fee NUMERIC(10,2) DEFAULT 7.90;
