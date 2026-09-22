-- ==============================================================================
-- 1. APP_SETTINGS (Globaalit järjestelmäasetukset: Palvelumaksu & ALV)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY,
    service_fee NUMERIC(10,2) DEFAULT 2.00 NOT NULL,
    vat_rate NUMERIC(5,2) DEFAULT 25.5 NOT NULL,
    delivery_fee NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    min_order_amount NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    is_maintenance_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lisätään oletusrivi 'global'
INSERT INTO public.app_settings (id, service_fee, vat_rate, delivery_fee, min_order_amount)
VALUES ('global', 2.00, 25.5, 0.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Kaikki (myös kirjautumattomat ja sovellusasiakkaat) voivat lukea asetukset
CREATE POLICY "Public read app_settings" 
ON public.app_settings 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- Vain ylläpitäjät (admin) voivat muokata asetuksia
CREATE POLICY "Admins manage app_settings" 
ON public.app_settings 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime julkaisu app_settings taululle
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.app_settings;

-- ==============================================================================
-- 2. LISÄTÄÄN ORDERS-TAULUUN PALVELUMAKSU- JA ALV-SARAKKEET
-- ==============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_fee NUMERIC(10,2) DEFAULT 2.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 25.5;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0.00;
