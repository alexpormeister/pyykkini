-- Create enum for pricing models
CREATE TYPE public.pricing_model AS ENUM ('FIXED', 'PER_M2');

-- Create enum for order status tracking
CREATE TYPE public.order_tracking_status AS ENUM (
  'PENDING',
  'PICKED_UP', 
  'WASHING',
  'PACKAGING',
  'OUT_FOR_DELIVERY',
  'COMPLETED'
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT UNIQUE NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.categories(category_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  pricing_model public.pricing_model NOT NULL DEFAULT 'FIXED',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to existing orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS tracking_status public.order_tracking_status DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS pickup_slot TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS delivery_slot TIMESTAMP WITH TIME ZONE;

-- Add new columns to existing order_items table
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS unit_price_charged NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS dimensions_cm JSONB;

-- Enable RLS on new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for categories (public read)
CREATE POLICY "Anyone can view categories"
  ON public.categories
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for products (public read, admin manage)
CREATE POLICY "Anyone can view active products"
  ON public.products
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all products"
  ON public.products
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage products"
  ON public.products
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);
CREATE INDEX idx_orders_tracking_status ON public.orders(tracking_status);

-- Add triggers for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();