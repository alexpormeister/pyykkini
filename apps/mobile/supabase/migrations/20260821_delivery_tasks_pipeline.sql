-- ==============================================================================
-- 1. LAUNDRIES TAULU (Varmistetaan taulun olemassaolo)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.laundries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. DELIVERY_TASKS TAULU (Kuljettajien keikat: Nouto ja Palautus)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('pickup', 'delivery')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'unassigned', 'assigned', 'in_progress', 'completed', 'cancelled')),
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    laundry_id UUID REFERENCES public.laundries(id) ON DELETE SET NULL,
    driver_payout NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    pickup_weight_kg NUMERIC(5,2),
    return_weight_kg NUMERIC(5,2),
    scheduled_date DATE,
    scheduled_time TEXT,
    
    -- LÄHTÖPAIKKA (Pickup location)
    pickup_name TEXT,
    pickup_address TEXT,
    pickup_city TEXT,
    pickup_postal_code TEXT,
    pickup_phone TEXT,
    
    -- MÄÄRÄNPÄÄ (Destination / Dropoff location)
    delivery_name TEXT,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_postal_code TEXT,
    delivery_phone TEXT,

    notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeksit haun nopeuttamiseksi
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_status ON public.delivery_tasks(status);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_driver ON public.delivery_tasks(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_order ON public.delivery_tasks(order_id);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view unassigned and own tasks"
ON public.delivery_tasks
FOR SELECT
TO authenticated
USING (
    status = 'unassigned' 
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Drivers claim and update own tasks"
ON public.delivery_tasks
FOR UPDATE
TO authenticated
USING (
    (status = 'unassigned' AND driver_id IS NULL)
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
    driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins manage all tasks"
ON public.delivery_tasks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.delivery_tasks;

-- ==============================================================================
-- 4. TRIGGERIT: AUTOMAATTINEN KEIKKOJEN LUONTI TILAUKSEN SYNTYESSÄ
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trigger_create_delivery_tasks_for_order()
RETURNS TRIGGER AS $$
DECLARE
    v_half_payout NUMERIC(10,2);
    v_customer_name TEXT;
BEGIN
    v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    v_half_payout := ROUND((COALESCE(NEW.price, 0) * 0.40) / 2.0, 2);

    -- 1. NOUTOKEIKKA (pickup: alustavasti asiakas -> odottaa pesulan hyväksyntää)
    INSERT INTO public.delivery_tasks (
        order_id,
        task_type,
        status,
        driver_payout,
        scheduled_date,
        scheduled_time,
        pickup_name,
        pickup_address,
        pickup_phone,
        notes
    ) VALUES (
        NEW.id,
        'pickup',
        'pending',
        v_half_payout,
        NEW.pickup_date,
        COALESCE(NEW.pickup_time::text, '07:30 - 08:00'),
        v_customer_name,
        NEW.address,
        NEW.phone,
        NEW.special_instructions
    );

    -- 2. PALAUTUSKEIKKA (delivery: alustavasti odottaa pesulan valmistumista)
    INSERT INTO public.delivery_tasks (
        order_id,
        task_type,
        status,
        driver_payout,
        scheduled_date,
        scheduled_time,
        delivery_name,
        delivery_address,
        delivery_phone,
        notes
    ) VALUES (
        NEW.id,
        'delivery',
        'pending',
        v_half_payout,
        NEW.return_date,
        COALESCE(NEW.return_time::text, '16:00 - 16:30'),
        v_customer_name,
        NEW.address,
        NEW.phone,
        NEW.special_instructions
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_delivery_tasks ON public.orders;
CREATE TRIGGER trg_create_delivery_tasks
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_create_delivery_tasks_for_order();

-- ==============================================================================
-- 5. TRIGGER: PESULAN HYVÄKSYNTÄ PÄIVITTÄÄ OSOITTEET & VAPAUTTAA NOUTOKEIKAN
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trigger_handle_laundry_decision()
RETURNS TRIGGER AS $$
DECLARE
    v_laundry RECORD;
    v_customer_name TEXT;
BEGIN
    -- Kun pesula hyväksyy tilauksen (laundry_status='accepted' tai status='accepted')
    IF (NEW.status = 'accepted' OR NEW.laundry_status = 'accepted') AND 
       (OLD.status IS NULL OR OLD.status = 'pending' OR OLD.laundry_status IS NULL OR OLD.laundry_status = 'pending') THEN
        
        v_customer_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

        -- Haetaan hyväksyneen pesulan osoitetiedot public.laundries -taulusta
        SELECT * INTO v_laundry 
        FROM public.laundries 
        WHERE id = COALESCE(NEW.laundry_id, (SELECT id FROM public.laundries WHERE is_active = true LIMIT 1));

        -- 1. NOUTOKEIKKA: Lähtö = Asiakas | Määränpää = Pesula
        UPDATE public.delivery_tasks
        SET 
            status = 'unassigned',
            laundry_id = v_laundry.id,
            pickup_name = v_customer_name,
            pickup_address = NEW.address,
            pickup_phone = NEW.phone,
            delivery_name = COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
            delivery_address = COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
            delivery_city = COALESCE(v_laundry.city, 'Lohja'),
            delivery_postal_code = v_laundry.postal_code,
            delivery_phone = v_laundry.contact_phone,
            updated_at = now()
        WHERE order_id = NEW.id AND task_type = 'pickup';

        -- 2. PALAUTUSKEIKKA: Lähtö = Pesula | Määränpää = Asiakas
        UPDATE public.delivery_tasks
        SET 
            laundry_id = v_laundry.id,
            pickup_name = COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
            pickup_address = COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
            pickup_city = COALESCE(v_laundry.city, 'Lohja'),
            pickup_postal_code = v_laundry.postal_code,
            pickup_phone = v_laundry.contact_phone,
            delivery_name = v_customer_name,
            delivery_address = NEW.address,
            delivery_phone = NEW.phone,
            updated_at = now()
        WHERE order_id = NEW.id AND task_type = 'delivery';
    END IF;

    -- Jos tilaus hylätään / perutaan -> perutaan keikat
    IF NEW.status IN ('rejected', 'cancelled') OR NEW.laundry_status IN ('rejected', 'cancelled') THEN
        UPDATE public.delivery_tasks
        SET status = 'cancelled', updated_at = now()
        WHERE order_id = NEW.id AND status != 'completed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_laundry_decision ON public.orders;
CREATE TRIGGER trg_handle_laundry_decision
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_handle_laundry_decision();

-- ==============================================================================
-- 6. RPC FUNKTIOT KULJETTAJALLE (Atomic toiminnot)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.driver_claim_task(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
    v_task public.delivery_tasks%ROWTYPE;
BEGIN
    SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_task_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Keikkaa ei löytynyt');
    END IF;

    IF v_task.status != 'unassigned' THEN
        RETURN json_build_object('success', false, 'error', 'Keikka on jo toisen kuljettajan ottama');
    END IF;

    UPDATE public.delivery_tasks
    SET driver_id = auth.uid(), status = 'assigned', updated_at = now()
    WHERE id = p_task_id;

    UPDATE public.orders
    SET driver_id = auth.uid()
    WHERE id = v_task.order_id AND driver_id IS NULL;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.driver_start_task(p_task_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE public.delivery_tasks
    SET status = 'in_progress', started_at = now(), updated_at = now()
    WHERE id = p_task_id AND driver_id = auth.uid();

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.driver_complete_pickup(p_task_id UUID, p_weight_kg NUMERIC)
RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
BEGIN
    UPDATE public.delivery_tasks
    SET status = 'completed', pickup_weight_kg = p_weight_kg, completed_at = now(), updated_at = now()
    WHERE id = p_task_id AND driver_id = auth.uid()
    RETURNING order_id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        UPDATE public.orders
        SET status = 'washing', tracking_status = 'WASHING', pickup_weight_kg = p_weight_kg, actual_pickup_time = now()
        WHERE id = v_order_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.driver_complete_delivery(p_task_id UUID, p_weight_kg NUMERIC DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
BEGIN
    UPDATE public.delivery_tasks
    SET status = 'completed', return_weight_kg = p_weight_kg, completed_at = now(), updated_at = now()
    WHERE id = p_task_id AND driver_id = auth.uid()
    RETURNING order_id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        UPDATE public.orders
        SET status = 'delivered', tracking_status = 'COMPLETED', actual_return_time = now()
        WHERE id = v_order_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. OLEMASSA OLEVIEN TILAUSTEN PÄIVITYS (BACKFILL)
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    v_laundry RECORD;
    v_half_payout NUMERIC(10,2);
    v_customer_name TEXT;
    v_customer_city TEXT;
BEGIN
    SELECT * INTO v_laundry FROM public.laundries WHERE is_active = true LIMIT 1;

    FOR r IN SELECT * FROM public.orders LOOP
        v_customer_name := TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, ''));
        v_half_payout := ROUND((COALESCE(r.price, 0) * 0.40) / 2.0, 2);
        
        v_customer_city := TRIM(SPLIT_PART(r.address, ',', 2));
        IF v_customer_city IS NULL OR v_customer_city = '' THEN
            v_customer_city := 'Pääkaupunkiseutu';
        END IF;

        -- Noutokeikka (pickup)
        IF NOT EXISTS (SELECT 1 FROM public.delivery_tasks WHERE order_id = r.id AND task_type = 'pickup') THEN
            INSERT INTO public.delivery_tasks (
                order_id,
                task_type,
                status,
                driver_id,
                laundry_id,
                driver_payout,
                scheduled_date,
                scheduled_time,
                pickup_name,
                pickup_address,
                pickup_city,
                pickup_phone,
                delivery_name,
                delivery_address,
                delivery_city,
                delivery_phone,
                notes
            ) VALUES (
                r.id,
                'pickup',
                CASE WHEN r.driver_id IS NOT NULL THEN 'assigned' ELSE (CASE WHEN r.status = 'accepted' THEN 'unassigned' ELSE 'pending' END) END,
                r.driver_id,
                v_laundry.id,
                v_half_payout,
                r.pickup_date,
                COALESCE(r.pickup_time::text, '07:30 - 08:00'),
                v_customer_name,
                r.address,
                v_customer_city,
                r.phone,
                COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
                COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
                COALESCE(v_laundry.city, 'Lohja'),
                v_laundry.contact_phone,
                r.special_instructions
            );
        ELSE
            -- Päivitetään olemassa olevaan noutokeikkaan oikeat osoitteet
            UPDATE public.delivery_tasks
            SET
                pickup_name = v_customer_name,
                pickup_address = r.address,
                pickup_city = v_customer_city,
                pickup_phone = r.phone,
                delivery_name = COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
                delivery_address = COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
                delivery_city = COALESCE(v_laundry.city, 'Lohja'),
                delivery_phone = v_laundry.contact_phone
            WHERE order_id = r.id AND task_type = 'pickup';
        END IF;

        -- Palautuskeikka (delivery)
        IF NOT EXISTS (SELECT 1 FROM public.delivery_tasks WHERE order_id = r.id AND task_type = 'delivery') THEN
            INSERT INTO public.delivery_tasks (
                order_id,
                task_type,
                status,
                driver_id,
                laundry_id,
                driver_payout,
                scheduled_date,
                scheduled_time,
                pickup_name,
                pickup_address,
                pickup_city,
                pickup_phone,
                delivery_name,
                delivery_address,
                delivery_city,
                delivery_phone,
                notes
            ) VALUES (
                r.id,
                'delivery',
                'pending',
                r.driver_id,
                v_laundry.id,
                v_half_payout,
                r.return_date,
                COALESCE(r.return_time::text, '16:00 - 16:30'),
                COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
                COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
                COALESCE(v_laundry.city, 'Lohja'),
                v_laundry.contact_phone,
                v_customer_name,
                r.address,
                v_customer_city,
                r.phone,
                r.special_instructions
            );
        ELSE
            -- Päivitetään olemassa olevaan palautuskeikkaan oikeat osoitteet
            UPDATE public.delivery_tasks
            SET
                pickup_name = COALESCE(v_laundry.name, 'Pesuni Pesulakeskus'),
                pickup_address = COALESCE(v_laundry.address, 'Lohjanharjuntie 15'),
                pickup_city = COALESCE(v_laundry.city, 'Lohja'),
                pickup_phone = v_laundry.contact_phone,
                delivery_name = v_customer_name,
                delivery_address = r.address,
                delivery_city = v_customer_city,
                delivery_phone = r.phone
            WHERE order_id = r.id AND task_type = 'delivery';
        END IF;
    END LOOP;
END;
$$;

