const { runSql } = require('C:/Users/Alex/Desktop/pesuni/scripts/db.js');

const sql = `
DROP TRIGGER IF EXISTS trg_recalculate_on_order_item ON public.order_items;
DROP FUNCTION IF EXISTS public.trigger_recalculate_on_order_item();

-- 1. Tuotteiden oletuskuljettajapalkkiot (driver_fee_value = 100 - platform_fee_value)
UPDATE public.products
SET platform_fee_type = 'percent',
    platform_fee_value = COALESCE(commission_percent, 15),
    driver_fee_type = 'percent',
    driver_fee_value = 100 - COALESCE(commission_percent, 15)
WHERE driver_fee_type = 'percent' AND (driver_fee_value IS NULL OR driver_fee_value <= 15);

-- 2. Uusi ja täsmällinen recalculate_order_payouts ilman rekursiota
CREATE OR REPLACE FUNCTION public.recalculate_order_payouts(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  r RECORD;
  v_qty numeric;
  v_paid numeric;
  v_laundry_unit numeric;
  v_laundry_total numeric;
  v_margin numeric;
  v_driver_pct numeric;
  v_driver numeric;
  v_platform_fee numeric;
  v_total_driver numeric := 0;
  v_half numeric;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT 
      oi.id,
      oi.quantity,
      oi.total_price,
      oi.unit_price,
      oi.service_type,
      oi.service_name,
      oi.product_name,
      oi.laundry_price as current_laundry_price,
      p.product_id,
      p.base_price,
      p.driver_fee_type,
      p.driver_fee_value,
      p.platform_fee_type,
      p.platform_fee_value,
      p.commission_percent,
      plp.price as plp_price
    FROM public.order_items oi
    LEFT JOIN public.products p
      ON p.product_id = oi.service_type
      OR lower(p.name) = lower(COALESCE(oi.product_name, oi.service_name))
    LEFT JOIN public.product_laundry_prices plp
      ON (plp.product_id = p.product_id OR plp.product_id = p.id::text)
      AND plp.laundry_id = v_order.laundry_id
      AND plp.is_active = true
    WHERE oi.order_id = p_order_id
  LOOP
    v_qty := GREATEST(COALESCE(r.quantity, 1), 1);
    v_paid := COALESCE(r.total_price, r.unit_price * v_qty, 0);

    -- 1. Pesulan osuus (löytyy pesulan tietojen alta / hinnastosta)
    IF r.plp_price IS NOT NULL THEN
      v_laundry_unit := r.plp_price;
    ELSIF r.current_laundry_price IS NOT NULL AND r.current_laundry_price > 0 THEN
      v_laundry_unit := ROUND(r.current_laundry_price / v_qty, 2);
    ELSIF r.base_price IS NOT NULL THEN
      v_laundry_unit := ROUND(r.base_price * 0.5, 2);
    ELSE
      v_laundry_unit := ROUND(v_paid * 0.5 / v_qty, 2);
    END IF;

    v_laundry_total := ROUND(v_laundry_unit * v_qty, 2);

    -- 2. Jäljelle jäävä summa (Marginaali)
    v_margin := GREATEST(v_paid - v_laundry_total, 0);

    -- 3. Kuljettajan osuus (x%) ja Alustakomissio (y%)
    IF r.driver_fee_type = 'percent' AND r.driver_fee_value IS NOT NULL AND r.driver_fee_value > 0 THEN
      v_driver_pct := r.driver_fee_value;
    ELSIF r.platform_fee_value IS NOT NULL AND r.platform_fee_value > 0 THEN
      v_driver_pct := GREATEST(100.0 - r.platform_fee_value, 0);
    ELSIF r.commission_percent IS NOT NULL AND r.commission_percent > 0 THEN
      v_driver_pct := GREATEST(100.0 - r.commission_percent, 0);
    ELSE
      v_driver_pct := 85.0;
    END IF;

    IF r.driver_fee_type = 'fixed' AND r.driver_fee_value IS NOT NULL AND r.driver_fee_value > 0 THEN
      v_driver := LEAST(ROUND(r.driver_fee_value * v_qty, 2), v_margin);
      v_platform_fee := ROUND(v_margin - v_driver, 2);
    ELSE
      v_driver := ROUND(v_margin * (v_driver_pct / 100.0), 2);
      v_platform_fee := ROUND(v_margin - v_driver, 2);
    END IF;

    -- Päivitetään tilausrivi
    UPDATE public.order_items
    SET laundry_id = v_order.laundry_id,
        laundry_price = v_laundry_total,
        driver_payout = v_driver,
        platform_fee = v_platform_fee,
        commission_percent = ROUND(100.0 - v_driver_pct, 2)
    WHERE id = r.id;

    v_total_driver := v_total_driver + GREATEST(v_driver, 0);
  END LOOP;

  -- Päivitetään tilauksen toimitustehtävien palkkiot (puolet noudolle, puolet palautukselle)
  IF v_total_driver > 0 THEN
    v_half := ROUND(v_total_driver / 2.0, 2);

    UPDATE public.delivery_tasks
    SET driver_payout = v_half,
        updated_at = now()
    WHERE order_id = p_order_id AND task_type = 'pickup';

    UPDATE public.delivery_tasks
    SET driver_payout = v_total_driver - v_half,
        updated_at = now()
    WHERE order_id = p_order_id AND task_type = 'delivery';
  END IF;

  RETURN v_total_driver;
END;
$$;

-- 3. Automaattinen laskenta kun uusi order_item lisätään (BEFORE INSERT / BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.calculate_order_item_payouts_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laundry_id uuid;
  v_qty numeric;
  v_paid numeric;
  v_laundry_unit numeric;
  v_laundry_total numeric;
  v_margin numeric;
  v_driver_pct numeric;
  v_driver numeric;
  v_platform_fee numeric;
  v_prod RECORD;
  v_plp RECORD;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT laundry_id INTO v_laundry_id FROM public.orders WHERE id = NEW.order_id;

  SELECT * INTO v_prod FROM public.products p
  WHERE p.product_id = NEW.service_type
     OR lower(p.name) = lower(COALESCE(NEW.product_name, NEW.service_name))
  LIMIT 1;

  IF v_laundry_id IS NOT NULL AND v_prod IS NOT NULL THEN
    SELECT * INTO v_plp FROM public.product_laundry_prices plp
    WHERE (plp.product_id = v_prod.product_id OR plp.product_id = v_prod.id::text)
      AND plp.laundry_id = v_laundry_id
      AND plp.is_active = true
    LIMIT 1;
  END IF;

  v_qty := GREATEST(COALESCE(NEW.quantity, 1), 1);
  v_paid := COALESCE(NEW.total_price, NEW.unit_price * v_qty, 0);

  IF v_plp.price IS NOT NULL THEN
    v_laundry_unit := v_plp.price;
  ELSIF NEW.laundry_price IS NOT NULL AND NEW.laundry_price > 0 THEN
    v_laundry_unit := ROUND(NEW.laundry_price / v_qty, 2);
  ELSIF v_prod.base_price IS NOT NULL THEN
    v_laundry_unit := ROUND(v_prod.base_price * 0.5, 2);
  ELSE
    v_laundry_unit := ROUND(v_paid * 0.5 / v_qty, 2);
  END IF;

  v_laundry_total := ROUND(v_laundry_unit * v_qty, 2);
  v_margin := GREATEST(v_paid - v_laundry_total, 0);

  IF v_prod.driver_fee_type = 'percent' AND v_prod.driver_fee_value IS NOT NULL AND v_prod.driver_fee_value > 0 THEN
    v_driver_pct := v_prod.driver_fee_value;
  ELSIF v_prod.platform_fee_value IS NOT NULL AND v_prod.platform_fee_value > 0 THEN
    v_driver_pct := GREATEST(100.0 - v_prod.platform_fee_value, 0);
  ELSIF v_prod.commission_percent IS NOT NULL AND v_prod.commission_percent > 0 THEN
    v_driver_pct := GREATEST(100.0 - v_prod.commission_percent, 0);
  ELSE
    v_driver_pct := 85.0;
  END IF;

  IF v_prod.driver_fee_type = 'fixed' AND v_prod.driver_fee_value IS NOT NULL AND v_prod.driver_fee_value > 0 THEN
    v_driver := LEAST(ROUND(v_prod.driver_fee_value * v_qty, 2), v_margin);
    v_platform_fee := ROUND(v_margin - v_driver, 2);
  ELSE
    v_driver := ROUND(v_margin * (v_driver_pct / 100.0), 2);
    v_platform_fee := ROUND(v_margin - v_driver, 2);
  END IF;

  NEW.laundry_id := v_laundry_id;
  NEW.laundry_price := v_laundry_total;
  NEW.driver_payout := v_driver;
  NEW.platform_fee := v_platform_fee;
  NEW.commission_percent := ROUND(100.0 - v_driver_pct, 2);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_order_item_payouts_before ON public.order_items;
CREATE TRIGGER trg_calculate_order_item_payouts_before
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.calculate_order_item_payouts_before();
`;

async function run() {
  await runSql(sql);
  console.log('Applied SQL changes successfully!');

  // Recalculate all orders
  const orders = await runSql('SELECT id FROM public.orders;');
  for (const o of orders.rows) {
    await runSql(`SELECT public.recalculate_order_payouts('${o.id}');`);
  }
  console.log(`Recalculated payouts for ${orders.rows.length} orders!`);
}

run().catch(console.error);
