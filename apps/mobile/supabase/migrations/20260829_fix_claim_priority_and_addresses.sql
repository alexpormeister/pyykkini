-- 1. Päivitetään driver_claim_task siten että se etsii ENSIJAISESTI suoralla tehtävän ID:llä (id = v_task_uuid)
CREATE OR REPLACE FUNCTION public.driver_claim_task(p_task_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_task public.delivery_tasks%ROWTYPE;
    v_task_uuid UUID;
    v_current_user UUID;
    v_order public.orders%ROWTYPE;
BEGIN
    v_current_user := auth.uid();
    
    IF v_current_user IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Ei kirjautunutta käyttäjää');
    END IF;

    BEGIN
        v_task_uuid := p_task_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_task_uuid := NULL;
    END;

    IF v_task_uuid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Virheellinen ID');
    END IF;

    -- 1. Etsitään ensisijaisesti suoraan tehtävän omalla ID:llä
    SELECT * INTO v_task 
    FROM public.delivery_tasks 
    WHERE id = v_task_uuid
    FOR UPDATE;

    -- Jos ei löytynyt suoralla task id:llä, etsitään vapaa task order_id:llä
    IF NOT FOUND THEN
        SELECT * INTO v_task 
        FROM public.delivery_tasks 
        WHERE order_id = v_task_uuid AND (driver_id IS NULL OR driver_id = v_current_user)
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF FOUND THEN
        IF v_task.driver_id IS NOT NULL AND v_task.driver_id != v_current_user THEN
            RETURN json_build_object('success', false, 'error', 'Keikka on jo toisen kuljettajan ottama');
        END IF;

        UPDATE public.delivery_tasks
        SET driver_id = v_current_user, 
            status = 'assigned', 
            updated_at = now()
        WHERE id = v_task.id;

        IF v_task.order_id IS NOT NULL THEN
            UPDATE public.orders
            SET driver_id = v_current_user, 
                status = CASE 
                    WHEN status = 'delivered' OR status = 'completed' THEN 'accepted'
                    WHEN status = 'rejected' OR status = 'cancelled' THEN 'pending'
                    ELSE status 
                END,
                updated_at = now()
            WHERE id = v_task.order_id;
        END IF;

        RETURN json_build_object('success', true);
    END IF;

    -- 2. Jos keikka löytyy vain orders-taulusta
    SELECT * INTO v_order FROM public.orders WHERE id = v_task_uuid FOR UPDATE;

    IF FOUND THEN
        IF v_order.driver_id IS NOT NULL AND v_order.driver_id != v_current_user THEN
            RETURN json_build_object('success', false, 'error', 'Keikka on jo toisen kuljettajan ottama');
        END IF;

        UPDATE public.orders
        SET driver_id = v_current_user, 
            status = CASE 
                WHEN status = 'delivered' OR status = 'completed' THEN 'accepted'
                WHEN status = 'rejected' OR status = 'cancelled' THEN 'pending'
                ELSE status 
            END,
            updated_at = now()
        WHERE id = v_order.id;

        INSERT INTO public.delivery_tasks (
            order_id,
            driver_id,
            task_type,
            status,
            pickup_address,
            delivery_address,
            scheduled_date,
            scheduled_time,
            driver_payout,
            created_at,
            updated_at
        ) VALUES (
            v_order.id,
            v_current_user,
            'pickup',
            'assigned',
            COALESCE(v_order.address, 'Asiakasosoite'),
            'Pesuni Pesulakeskus, Lohjanharjuntie 15, Lohja',
            COALESCE(v_order.pickup_date::text, CURRENT_DATE::text)::date,
            COALESCE(v_order.pickup_time::text, '10:00'),
            COALESCE(ROUND((COALESCE(v_order.price, 45) * 0.4 / 2)::numeric, 0), 19),
            now(),
            now()
        );

        RETURN json_build_object('success', true);
    END IF;

    RETURN json_build_object('success', false, 'error', 'Keikkaa ei löytynyt');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Täydennetään vanhojen delivery_tasks rivien puuttuvat osoitteet ja payoutit
UPDATE public.delivery_tasks dt
SET 
    pickup_address = COALESCE(dt.pickup_address, dt.origin_address, o.address, 'Asiakasosoite'),
    delivery_address = COALESCE(dt.delivery_address, dt.destination_address, 'Pesuni Pesulakeskus, Lohjanharjuntie 15, Lohja'),
    scheduled_time = COALESCE(dt.scheduled_time, dt.scheduled_time_slot, '10:00'),
    driver_payout = CASE WHEN dt.driver_payout IS NULL OR dt.driver_payout = 0 THEN 19.00 ELSE dt.driver_payout END
FROM public.orders o
WHERE dt.order_id = o.id;

-- 3. Jos tilauksella on jo tehty nouto ja pyykit ovat pesussa (status = 'washing'), merkitään NOUTOTEHTÄVÄ valmiiksi
UPDATE public.delivery_tasks dt
SET 
    status = 'completed',
    driver_id = o.driver_id,
    completed_at = COALESCE(o.actual_pickup_time, now()),
    updated_at = now()
FROM public.orders o
WHERE dt.order_id = o.id
AND dt.task_type = 'pickup'
AND o.status = 'washing'
AND dt.status != 'completed';
