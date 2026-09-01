const { runSql } = require('C:/Users/Alex/Desktop/pesuni/scripts/db.js');

const sql = `
-- 1. Luodaan taulu asiakkaan tallennetuille tekstiileille
CREATE TABLE IF NOT EXISTS public.customer_saved_textiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Matto',
    product_id TEXT NULL,
    length_cm NUMERIC NULL,
    width_cm NUMERIC NULL,
    square_meters NUMERIC NULL,
    material TEXT NULL,
    care_instructions TEXT NULL,
    special_notes TEXT NULL,
    photo_url TEXT NULL,
    last_washed_at TIMESTAMPTZ NULL,
    last_order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeksit haulle
CREATE INDEX IF NOT EXISTS idx_customer_saved_textiles_user ON public.customer_saved_textiles(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_saved_textiles_category ON public.customer_saved_textiles(category);

-- 2. RLS-tietoturva
ALTER TABLE public.customer_saved_textiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own saved textiles" ON public.customer_saved_textiles;
CREATE POLICY "Users view own saved textiles"
ON public.customer_saved_textiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own saved textiles" ON public.customer_saved_textiles;
CREATE POLICY "Users insert own saved textiles"
ON public.customer_saved_textiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users update own saved textiles" ON public.customer_saved_textiles;
CREATE POLICY "Users update own saved textiles"
ON public.customer_saved_textiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users delete own saved textiles" ON public.customer_saved_textiles;
CREATE POLICY "Users delete own saved textiles"
ON public.customer_saved_textiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Automaattinen updated_at -triggeri
DROP TRIGGER IF EXISTS trg_customer_saved_textiles_updated_at ON public.customer_saved_textiles;
CREATE TRIGGER trg_customer_saved_textiles_updated_at
BEFORE UPDATE ON public.customer_saved_textiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Triggeri pesuhistorian päivittämiseen, kun tilaus valmistuu
CREATE OR REPLACE FUNCTION public.sync_saved_textiles_wash_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kun tilaus siirtyy valmiiksi (COMPLETED tai delivered)
  IF (NEW.status::text IN ('delivered', 'completed') OR NEW.tracking_status::text = 'COMPLETED') AND
     (OLD.status::text NOT IN ('delivered', 'completed') AND (OLD.tracking_status IS NULL OR OLD.tracking_status::text != 'COMPLETED')) THEN
     
     -- Päivitetään käyttäjän tallennettujen tekstiilien pesupäivä, jos ko. tilauksessa pestiin ko. tuotteita
     UPDATE public.customer_saved_textiles st
     SET last_washed_at = COALESCE(NEW.actual_return_time, now()),
         last_order_id = NEW.id,
         updated_at = now()
     FROM public.order_items oi
     WHERE st.user_id = NEW.user_id
       AND oi.order_id = NEW.id
       AND (
         lower(st.name) = lower(COALESCE(oi.product_name, oi.service_name))
         OR (st.product_id IS NOT NULL AND st.product_id = oi.service_type)
         OR (st.category = 'Matto' AND lower(COALESCE(oi.product_name, oi.service_name)) LIKE '%matto%')
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_saved_textiles_wash_history ON public.orders;
CREATE TRIGGER trg_sync_saved_textiles_wash_history
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_saved_textiles_wash_history();
`;

async function run() {
  await runSql(sql);
  console.log('Successfully created customer_saved_textiles table, RLS policies, and sync triggers!');
}

run().catch(console.error);
