-- Add weight fields to orders table
ALTER TABLE public.orders 
ADD COLUMN pickup_weight_kg DECIMAL(5,2),
ADD COLUMN return_weight_kg DECIMAL(5,2);

-- Add acceptance terms field
ALTER TABLE public.orders 
ADD COLUMN terms_accepted BOOLEAN NOT NULL DEFAULT false;