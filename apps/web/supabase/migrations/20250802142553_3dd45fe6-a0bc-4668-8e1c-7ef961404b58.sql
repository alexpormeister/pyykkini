-- Add fields for driver shift management
CREATE TABLE IF NOT EXISTS public.driver_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for driver_shifts
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_shifts
CREATE POLICY "Drivers can view their own shifts" 
ON public.driver_shifts 
FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can manage their own shifts" 
ON public.driver_shifts 
FOR ALL 
USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all shifts" 
ON public.driver_shifts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updating updated_at
CREATE TRIGGER update_driver_shifts_updated_at
BEFORE UPDATE ON public.driver_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add rug dimensions field to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS rug_dimensions TEXT;

-- Create function to check if all drivers have rejected an order
CREATE OR REPLACE FUNCTION public.check_all_drivers_rejected()
RETURNS TRIGGER AS $$
DECLARE
  total_active_drivers INTEGER;
  total_rejections INTEGER;
BEGIN
  -- Count active drivers (those currently in shift)
  SELECT COUNT(DISTINCT driver_id) INTO total_active_drivers
  FROM public.driver_shifts 
  WHERE is_active = TRUE;
  
  -- Count rejections for this order
  SELECT COUNT(*) INTO total_rejections
  FROM public.orders 
  WHERE id = NEW.id 
    AND status = 'rejected' 
    AND rejected_by IS NOT NULL;
  
  -- If all active drivers have rejected this order, mark it as rejected
  IF total_rejections >= total_active_drivers AND total_active_drivers > 0 THEN
    UPDATE public.orders 
    SET status = 'rejected'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table to track order rejections by drivers
CREATE TABLE IF NOT EXISTS public.order_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  rejection_reason TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for order_rejections
ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

-- Create policies for order_rejections
CREATE POLICY "Drivers can create their own rejections" 
ON public.order_rejections 
FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can view all rejections" 
ON public.order_rejections 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can view rejections for their orders" 
ON public.order_rejections 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_rejections.order_id 
    AND orders.driver_id = auth.uid()
  )
);