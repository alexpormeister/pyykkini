-- Drop cart_items table first (due to foreign key dependency)
DROP TABLE IF EXISTS public.cart_items CASCADE;

-- Drop carts table
DROP TABLE IF EXISTS public.carts CASCADE;