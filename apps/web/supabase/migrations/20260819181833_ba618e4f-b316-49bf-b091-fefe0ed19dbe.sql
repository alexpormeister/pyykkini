ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text, ADD COLUMN IF NOT EXISTS business_id text;
ALTER TABLE public.laundries ADD COLUMN IF NOT EXISTS business_id text;