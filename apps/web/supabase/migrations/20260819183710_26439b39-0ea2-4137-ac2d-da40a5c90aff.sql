CREATE TABLE public.delivery_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('pickup','delivery')),
  driver_id UUID,
  laundry_id UUID REFERENCES public.laundries(id) ON DELETE SET NULL,
  origin_name TEXT,
  origin_address TEXT,
  origin_phone TEXT,
  destination_name TEXT,
  destination_address TEXT,
  destination_phone TEXT,
  scheduled_date DATE,
  scheduled_time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('pending','unassigned','assigned','in_progress','completed','failed')),
  driver_payout NUMERIC NOT NULL DEFAULT 0,
  route_order INTEGER,
  batch_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_tasks_order ON public.delivery_tasks(order_id);
CREATE INDEX idx_delivery_tasks_driver ON public.delivery_tasks(driver_id);
CREATE INDEX idx_delivery_tasks_status ON public.delivery_tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tasks TO authenticated;
GRANT ALL ON public.delivery_tasks TO service_role;

ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all delivery tasks"
ON public.delivery_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers view own and open tasks"
ON public.delivery_tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'driver')
  AND (driver_id = auth.uid() OR (driver_id IS NULL AND status = 'unassigned'))
);

CREATE POLICY "Drivers claim and update own tasks"
ON public.delivery_tasks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'driver')
  AND (driver_id = auth.uid() OR (driver_id IS NULL AND status = 'unassigned'))
)
WITH CHECK (public.has_role(auth.uid(), 'driver') AND driver_id = auth.uid());

CREATE POLICY "Laundry members view their tasks"
ON public.delivery_tasks FOR SELECT TO authenticated
USING (laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), laundry_id));

CREATE POLICY "Customers view their order tasks"
ON public.delivery_tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = delivery_tasks.order_id AND o.user_id = auth.uid()));

CREATE TRIGGER update_delivery_tasks_updated_at
BEFORE UPDATE ON public.delivery_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_delivery_tasks_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_laundry RECORD;
  v_total_payout NUMERIC;
  v_half NUMERIC;
  v_customer_name TEXT;
  v_laundry_name TEXT;
  v_laundry_address TEXT;
  v_laundry_phone TEXT;
BEGIN
  SELECT * INTO v_laundry FROM public.laundries WHERE id = NEW.laundry_id;

  v_laundry_name := COALESCE(v_laundry.name, 'Pesula (määritetään)');
  v_laundry_address := COALESCE(v_laundry.address, '');
  v_laundry_phone := COALESCE(v_laundry.contact_phone, '');
  v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  SELECT COALESCE(SUM(driver_payout), 0) INTO v_total_payout
  FROM public.order_items WHERE order_id = NEW.id;

  IF v_total_payout = 0 THEN
    v_total_payout := ROUND(COALESCE(NEW.final_price, 0) * 0.15, 2);
  END IF;

  v_half := ROUND(v_total_payout / 2.0, 2);

  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    scheduled_date, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'pickup', NEW.laundry_id,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    NEW.pickup_date, to_char(NEW.pickup_time, 'HH24:MI'), 'unassigned', v_half
  );

  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    scheduled_date, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'delivery', NEW.laundry_id,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    v_customer_name, NEW.address, NEW.phone,
    NEW.return_date, to_char(NEW.return_time, 'HH24:MI'), 'pending', v_total_payout - v_half
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_delivery_tasks_after_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.create_delivery_tasks_for_order();

CREATE OR REPLACE FUNCTION public.activate_return_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status
     AND NEW.tracking_status::text IN ('PACKAGING','OUT_FOR_DELIVERY') THEN
    UPDATE public.delivery_tasks
    SET status = 'unassigned'
    WHERE order_id = NEW.id AND task_type = 'delivery' AND status = 'pending';
  END IF;

  IF NEW.laundry_id IS DISTINCT FROM OLD.laundry_id AND NEW.laundry_id IS NOT NULL THEN
    UPDATE public.delivery_tasks dt
    SET laundry_id = NEW.laundry_id,
        destination_name = CASE WHEN dt.task_type = 'pickup' THEN l.name ELSE dt.destination_name END,
        destination_address = CASE WHEN dt.task_type = 'pickup' THEN COALESCE(l.address, '') ELSE dt.destination_address END,
        destination_phone = CASE WHEN dt.task_type = 'pickup' THEN COALESCE(l.contact_phone, '') ELSE dt.destination_phone END,
        origin_name = CASE WHEN dt.task_type = 'delivery' THEN l.name ELSE dt.origin_name END,
        origin_address = CASE WHEN dt.task_type = 'delivery' THEN COALESCE(l.address, '') ELSE dt.origin_address END,
        origin_phone = CASE WHEN dt.task_type = 'delivery' THEN COALESCE(l.contact_phone, '') ELSE dt.origin_phone END
    FROM public.laundries l
    WHERE l.id = NEW.laundry_id AND dt.order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER activate_return_task_on_order_update
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.activate_return_task();