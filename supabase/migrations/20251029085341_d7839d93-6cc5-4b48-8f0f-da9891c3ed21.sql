-- Create carts table
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Create cart_items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE NOT NULL,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carts
CREATE POLICY "Users can view their own cart"
ON public.carts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cart"
ON public.carts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart"
ON public.carts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart"
ON public.carts
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for cart_items
CREATE POLICY "Users can view their own cart items"
ON public.cart_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.carts
    WHERE carts.id = cart_items.cart_id
    AND carts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own cart items"
ON public.cart_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.carts
    WHERE carts.id = cart_items.cart_id
    AND carts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own cart items"
ON public.cart_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.carts
    WHERE carts.id = cart_items.cart_id
    AND carts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own cart items"
ON public.cart_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.carts
    WHERE carts.id = cart_items.cart_id
    AND carts.user_id = auth.uid()
  )
);

-- Trigger to update updated_at on carts
CREATE TRIGGER update_carts_updated_at
BEFORE UPDATE ON public.carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();