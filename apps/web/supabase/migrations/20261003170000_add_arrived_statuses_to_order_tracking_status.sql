-- Add ARRIVED_PICKUP and ARRIVED_DELIVERY to order_tracking_status enum
ALTER TYPE public.order_tracking_status ADD VALUE IF NOT EXISTS 'ARRIVED_PICKUP';
ALTER TYPE public.order_tracking_status ADD VALUE IF NOT EXISTS 'ARRIVED_DELIVERY';
