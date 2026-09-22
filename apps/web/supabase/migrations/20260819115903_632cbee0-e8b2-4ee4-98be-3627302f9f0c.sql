CREATE TABLE public.service_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  postal_code text,
  is_active boolean NOT NULL DEFAULT true,
  delivery_fee numeric NOT NULL DEFAULT 0.00,
  delivery_days text[] NOT NULL DEFAULT ARRAY['Maanantai','Tiistai','Keskiviikko','Torstai','Perjantai']::text[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX service_areas_city_postal_unique ON public.service_areas (city, COALESCE(postal_code, ''));

GRANT SELECT ON public.service_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT ALL ON public.service_areas TO service_role;

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service areas"
ON public.service_areas FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert service areas"
ON public.service_areas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service areas"
ON public.service_areas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service areas"
ON public.service_areas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_service_areas_updated_at
BEFORE UPDATE ON public.service_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_areas (city, postal_code, is_active, delivery_fee)
VALUES
  ('Helsinki', NULL, true, 0.00),
  ('Espoo', NULL, true, 0.00),
  ('Vantaa', NULL, true, 0.00),
  ('Kauniainen', NULL, true, 0.00),
  ('Kirkkonummi', NULL, true, 4.90);
