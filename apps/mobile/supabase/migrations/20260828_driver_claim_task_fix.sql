-- 1. Varmistetaan että delivery_tasks taulu ja KAIKKI sen sarakkeet ovat olemassa
CREATE TABLE IF NOT EXISTS public.delivery_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    task_type TEXT DEFAULT 'pickup',
    status TEXT DEFAULT 'assigned',
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    laundry_id UUID,
    driver_payout NUMERIC DEFAULT 19,
    pickup_weight_kg NUMERIC,
    return_weight_kg NUMERIC,
    scheduled_date DATE,
    scheduled_time TEXT,
    pickup_name TEXT,
    pickup_address TEXT,
    pickup_city TEXT,
    pickup_phone TEXT,
    delivery_name TEXT,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_phone TEXT,
    pickup_photos TEXT[] DEFAULT '{}',
    notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lisätään sarakkeet siltä varalta että taulu oli aiemmin olemassa vanhassa muodossa
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_name TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_city TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_phone TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS delivery_name TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS delivery_city TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS delivery_phone TEXT;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_photos TEXT[] DEFAULT '{}';
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS pickup_weight_kg NUMERIC;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS driver_payout NUMERIC DEFAULT 19;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.delivery_tasks ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

-- 2. Luodaan atominen driver_claim_task funktio
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

    -- 1. Etsitään delivery_tasks taulusta
    SELECT * INTO v_task 
    FROM public.delivery_tasks 
    WHERE (id = v_task_uuid OR order_id = v_task_uuid)
    LIMIT 1
    FOR UPDATE;

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
                status = CASE WHEN status = 'delivered' OR status = 'completed' THEN 'accepted' ELSE status END,
                updated_at = now()
            WHERE id = v_task.order_id;
        END IF;

        RETURN json_build_object('success', true);
    END IF;

    -- 2. Jos keikka löytyy orders-taulusta mutta delivery_tasks puuttuu
    SELECT * INTO v_order FROM public.orders WHERE id = v_task_uuid FOR UPDATE;

    IF FOUND THEN
        IF v_order.driver_id IS NOT NULL AND v_order.driver_id != v_current_user THEN
            RETURN json_build_object('success', false, 'error', 'Keikka on jo toisen kuljettajan ottama');
        END IF;

        UPDATE public.orders
        SET driver_id = v_current_user, 
            status = CASE WHEN status = 'delivered' OR status = 'completed' THEN 'accepted' ELSE status END,
            updated_at = now()
        WHERE id = v_order.id;

        -- Luodaan noutotehtävä delivery_tasks tauluun
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

-- 3. RLS -lukuoikeudet kuntoon
ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers view unassigned and own tasks" ON public.delivery_tasks;
CREATE POLICY "Drivers view unassigned and own tasks"
ON public.delivery_tasks
FOR SELECT
TO authenticated
USING (
    status = 'unassigned' 
    OR driver_id IS NULL
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Drivers can view assigned and pending orders" ON public.orders;
CREATE POLICY "Drivers can view assigned and pending orders" 
ON public.orders 
FOR SELECT 
TO authenticated 
USING (
    driver_id = auth.uid()
    OR user_id = auth.uid()
    OR (driver_id IS NULL AND (status = 'pending' OR status = 'accepted'))
    OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Synkronoidaan kaikki olemassa olevat tilaukset joilla on kuljettaja heti näkyviksi
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
)
SELECT 
    o.id,
    o.driver_id,
    'pickup',
    'assigned',
    COALESCE(o.address, 'Asiakasosoite'),
    'Pesuni Pesulakeskus, Lohjanharjuntie 15, Lohja',
    COALESCE(o.pickup_date::text, CURRENT_DATE::text)::date,
    COALESCE(o.pickup_time::text, '10:00'),
    COALESCE(ROUND((COALESCE(o.price, 45) * 0.4 / 2)::numeric, 0), 19),
    now(),
    now()
FROM public.orders o
WHERE o.driver_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM public.delivery_tasks dt WHERE dt.order_id = o.id
);
