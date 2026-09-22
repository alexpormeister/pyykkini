-- Create order_history table for tracking all changes
CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_type TEXT NOT NULL, -- 'created', 'accepted', 'time_updated', 'status_changed', 'rejected'
  old_value JSONB,
  new_value JSONB,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Create policies for order_history
CREATE POLICY "Admins can view all order history" 
ON public.order_history 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create order history entries" 
ON public.order_history 
FOR INSERT 
WITH CHECK (auth.uid() = changed_by);

-- Function to log order changes
CREATE OR REPLACE FUNCTION public.log_order_change(
  p_order_id UUID,
  p_change_type TEXT,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO public.order_history (
    order_id,
    changed_by,
    change_type,
    old_value,
    new_value,
    change_description
  ) VALUES (
    p_order_id,
    auth.uid(),
    p_change_type,
    p_old_value,
    p_new_value,
    p_description
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$;

-- Add trigger to automatically log order status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_order_change(
      NEW.id,
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Tilauksen tila muuttui: ' || COALESCE(OLD.status::text, 'null') || ' -> ' || NEW.status::text
    );
  END IF;
  
  -- Log when driver is assigned
  IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.log_order_change(
      NEW.id,
      'accepted',
      jsonb_build_object('driver_id', OLD.driver_id),
      jsonb_build_object('driver_id', NEW.driver_id),
      'Kuljettaja hyväksyi tilauksen'
    );
  END IF;
  
  -- Log when pickup/return times are updated
  IF OLD.actual_pickup_time IS DISTINCT FROM NEW.actual_pickup_time 
     OR OLD.actual_return_time IS DISTINCT FROM NEW.actual_return_time
     OR OLD.pickup_date IS DISTINCT FROM NEW.pickup_date
     OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time
     OR OLD.return_date IS DISTINCT FROM NEW.return_date
     OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'time_updated',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time,
        'return_date', OLD.return_date,
        'return_time', OLD.return_time,
        'actual_pickup_time', OLD.actual_pickup_time,
        'actual_return_time', OLD.actual_return_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time,
        'return_date', NEW.return_date,
        'return_time', NEW.return_time,
        'actual_pickup_time', NEW.actual_pickup_time,
        'actual_return_time', NEW.actual_return_time
      ),
      'Nouto- tai palautusaikoja päivitettiin'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order changes
CREATE TRIGGER order_history_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- Create trigger for initial order creation
CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.log_order_change(
    NEW.id,
    'created',
    NULL,
    row_to_json(NEW)::jsonb,
    'Tilaus luotu'
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_creation_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_creation();