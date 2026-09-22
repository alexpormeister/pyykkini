const { runSql } = require('C:/Users/Alex/Desktop/pesuni/scripts/db.js');

const sql = `
CREATE OR REPLACE FUNCTION public.create_delivery_tasks_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_payout NUMERIC;
  v_half NUMERIC;
  v_customer_name TEXT;
  v_laundry_name TEXT := 'Pesula (määritetään)';
  v_laundry_address TEXT := '';
  v_laundry_phone TEXT := '';
  v_pickup_time_str TEXT := '10:00';
  v_return_time_str TEXT := '16:00';
BEGIN
  IF NEW.laundry_id IS NOT NULL THEN
    SELECT name, address, contact_phone
    INTO v_laundry_name, v_laundry_address, v_laundry_phone
    FROM public.laundries
    WHERE id = NEW.laundry_id;

    v_laundry_name := COALESCE(v_laundry_name, 'Pesula (määritetään)');
    v_laundry_address := COALESCE(v_laundry_address, '');
    v_laundry_phone := COALESCE(v_laundry_phone, '');
  END IF;

  v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  SELECT COALESCE(SUM(driver_payout), 0) INTO v_total_payout
  FROM public.order_items WHERE order_id = NEW.id;

  IF v_total_payout = 0 THEN
    v_total_payout := COALESCE(ROUND((COALESCE(NEW.price, 45) * 0.40)::numeric, 2), 38.00);
  END IF;

  v_half := ROUND(v_total_payout / 2.0, 2);

  IF NEW.pickup_time IS NOT NULL THEN
    v_pickup_time_str := to_char(NEW.pickup_time, 'HH24:MI');
  END IF;

  IF NEW.return_time IS NOT NULL THEN
    v_return_time_str := to_char(NEW.return_time, 'HH24:MI');
  END IF;

  -- Noutotehtävä (LEG 1): Aluksi 'pending' (aukeaa kun pesula hyväksyy)
  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    pickup_name, pickup_address, pickup_phone,
    delivery_name, delivery_address, delivery_phone,
    scheduled_date, scheduled_time, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'pickup', NEW.laundry_id,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    NEW.pickup_date, 
    v_pickup_time_str,
    v_pickup_time_str,
    'pending', 
    v_half
  );

  -- Palautustehtävä (LEG 2): Aluksi 'pending' (aukeaa vasta kun pesula merkitsee valmiiksi)
  INSERT INTO public.delivery_tasks (
    order_id, task_type, laundry_id,
    origin_name, origin_address, origin_phone,
    destination_name, destination_address, destination_phone,
    pickup_name, pickup_address, pickup_phone,
    delivery_name, delivery_address, delivery_phone,
    scheduled_date, scheduled_time, scheduled_time_slot, status, driver_payout
  ) VALUES (
    NEW.id, 'delivery', NEW.laundry_id,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    v_customer_name, NEW.address, NEW.phone,
    v_laundry_name, v_laundry_address, v_laundry_phone,
    v_customer_name, NEW.address, NEW.phone,
    NEW.return_date, 
    v_return_time_str,
    v_return_time_str,
    'pending', 
    v_total_payout - v_half
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_laundry_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laundry_name TEXT := 'Pesula';
  v_laundry_address TEXT := '';
  v_laundry_phone TEXT := '';
BEGIN
  IF NEW.laundry_status IS DISTINCT FROM OLD.laundry_status THEN
    IF NEW.laundry_status = 'accepted' THEN
      IF NEW.laundry_id IS NOT NULL THEN
        SELECT name, address, contact_phone
        INTO v_laundry_name, v_laundry_address, v_laundry_phone
        FROM public.laundries
        WHERE id = NEW.laundry_id;

        v_laundry_name := COALESCE(v_laundry_name, 'Pesula');
        v_laundry_address := COALESCE(v_laundry_address, '');
        v_laundry_phone := COALESCE(v_laundry_phone, '');
      END IF;

      -- 1. Pickup (Meno)
      UPDATE public.delivery_tasks
      SET laundry_id = NEW.laundry_id,
          destination_name = v_laundry_name,
          destination_address = v_laundry_address,
          destination_phone = v_laundry_phone,
          delivery_name = v_laundry_name,
          delivery_address = v_laundry_address,
          status = 'unassigned',
          updated_at = now()
      WHERE order_id = NEW.id AND task_type = 'pickup' AND status = 'pending';

      -- 2. Delivery (Paluu)
      UPDATE public.delivery_tasks
      SET laundry_id = NEW.laundry_id,
          origin_name = v_laundry_name,
          origin_address = v_laundry_address,
          origin_phone = v_laundry_phone,
          pickup_name = v_laundry_name,
          pickup_address = v_laundry_address,
          status = 'pending',
          updated_at = now()
      WHERE order_id = NEW.id AND task_type = 'delivery';

    ELSIF NEW.laundry_status = 'rejected' THEN
      UPDATE public.delivery_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE order_id = NEW.id;
      NEW.status := 'rejected'::order_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
`;

async function run() {
  await runSql(sql);
  console.log('Successfully fixed indeterminate record issue in triggers!');
}

run().catch(console.error);
