-- 🌟 PESUNI TUOTEKOHTAINEN NOUTOTARKISTUS (KILOMITTAUS VS. VALOKUVAUS) 🌟

-- 1. Lisätään products-tauluun verification_type
ALTER TABLE IF EXISTS public.products 
ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'weight' 
CHECK (verification_type IN ('weight', 'photo', 'both'));

-- Päivitetään matot ja erikoistuotteet oletuksena valokuvaukseksi
UPDATE public.products 
SET verification_type = 'photo' 
WHERE name ILIKE '%matto%' OR name ILIKE '%takki%' OR name ILIKE '%puku%' OR name ILIKE '%kenkä%' OR name ILIKE '%kengät%';

-- 2. Lisätään order_items-tauluun verification_type
ALTER TABLE IF EXISTS public.order_items 
ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'weight';

-- 3. Lisätään orders-tauluun pickup_photos
ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS pickup_photos TEXT[] DEFAULT '{}';

-- 4. Lisätään delivery_tasks-tauluun pickup_photos
ALTER TABLE IF EXISTS public.delivery_tasks 
ADD COLUMN IF NOT EXISTS pickup_photos TEXT[] DEFAULT '{}';

-- 5. Luodaan Supabase Storage Bucket noutokuville (jos ei ole olemassa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-pickup-photos', 'order-pickup-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS-säännöt
CREATE POLICY "Public read for order pickup photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-pickup-photos');

CREATE POLICY "Authenticated users can upload order pickup photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-pickup-photos');
