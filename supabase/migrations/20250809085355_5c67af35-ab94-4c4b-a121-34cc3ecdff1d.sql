-- Add real-time updates for orders table to sync time changes
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add the orders table to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Create trigger to log time changes automatically
CREATE OR REPLACE FUNCTION public.log_time_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log pickup time changes
  IF OLD.pickup_date IS DISTINCT FROM NEW.pickup_date OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'pickup_time_changed',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time
      ),
      'Noutohaarukka muutettu: ' || 
      COALESCE(OLD.pickup_date::text, 'null') || ' ' || COALESCE(OLD.pickup_time::text, 'null') || 
      ' -> ' || NEW.pickup_date::text || ' ' || NEW.pickup_time::text
    );
  END IF;
  
  -- Log return time changes
  IF OLD.return_date IS DISTINCT FROM NEW.return_date OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'return_time_changed',
      jsonb_build_object(
        'return_date', OLD.return_date,
        'return_time', OLD.return_time
      ),
      jsonb_build_object(
        'return_date', NEW.return_date,
        'return_time', NEW.return_time
      ),
      'Palautushaarukka muutettu: ' || 
      COALESCE(OLD.return_date::text, 'null') || ' ' || COALESCE(OLD.return_time::text, 'null') || 
      ' -> ' || NEW.return_date::text || ' ' || NEW.return_time::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for time changes
CREATE TRIGGER trigger_log_time_changes
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_time_changes();