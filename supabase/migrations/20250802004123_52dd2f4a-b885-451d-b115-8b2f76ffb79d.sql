-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'picking_up', 'washing', 'returning', 'delivered', 'rejected');

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount_code TEXT,
  final_price DECIMAL(10,2) NOT NULL,
  
  -- Customer information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  special_instructions TEXT,
  
  -- Scheduling
  pickup_date DATE NOT NULL,
  pickup_time TIME NOT NULL,
  return_date DATE NOT NULL,
  return_time TIME NOT NULL,
  
  -- Driver set times (after acceptance)
  actual_pickup_time TIMESTAMPTZ,
  actual_return_time TIMESTAMPTZ,
  
  -- Status tracking
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Drivers can view orders assigned to them or pending orders
CREATE POLICY "Drivers can view relevant orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  (driver_id = auth.uid() OR status = 'pending')
);

-- Drivers can update orders assigned to them
CREATE POLICY "Drivers can update assigned orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  driver_id = auth.uid()
);

-- Drivers can accept pending orders
CREATE POLICY "Drivers can accept pending orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'driver'::app_role) AND 
  status = 'pending'
);

-- Admins can manage all orders
CREATE POLICY "Admins can manage all orders" 
ON public.orders 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);