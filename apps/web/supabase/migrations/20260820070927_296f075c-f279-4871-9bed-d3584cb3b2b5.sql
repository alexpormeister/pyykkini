ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS badge_text TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.app_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  badge_text TEXT DEFAULT 'SUOSITUIN ARJEN SÄÄSTÄJÄ',
  image_url TEXT,
  product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
  button_text TEXT NOT NULL DEFAULT 'Tilaa heti',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_banners TO authenticated;
GRANT ALL ON public.app_banners TO service_role;
ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.app_banners
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage banners" ON public.app_banners
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_banners_updated_at BEFORE UPDATE ON public.app_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.app_trust_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'shield-check',
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_trust_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_trust_badges TO authenticated;
GRANT ALL ON public.app_trust_badges TO service_role;
ALTER TABLE public.app_trust_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active trust badges" ON public.app_trust_badges
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage trust badges" ON public.app_trust_badges
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_trust_badges_updated_at BEFORE UPDATE ON public.app_trust_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_trust_badges (title, icon_name, sort_order)
VALUES ('Nouto ovelta', 'truck', 1), ('Valmista 24-48h', 'clock', 2), ('100% Laatutakuu', 'shield-check', 3);