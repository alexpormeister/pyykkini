-- Add payment-related fields to orders table
ALTER TABLE public.orders 
ADD COLUMN payment_method TEXT,
ADD COLUMN payment_status TEXT DEFAULT 'pending',
ADD COLUMN stripe_session_id TEXT,
ADD COLUMN stripe_payment_intent_id TEXT,
ADD COLUMN payment_amount DECIMAL(10,2),
ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster payment queries
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_stripe_session ON public.orders(stripe_session_id);

-- Add payment method constraint
ALTER TABLE public.orders 
ADD CONSTRAINT check_payment_method 
CHECK (payment_method IN ('stripe', 'cash', 'free'));

-- Add payment status constraint  
ALTER TABLE public.orders 
ADD CONSTRAINT check_payment_status 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled'));

-- Update existing orders to have default payment values
UPDATE public.orders 
SET payment_method = 'cash', 
    payment_status = 'paid',
    payment_amount = final_price,
    paid_at = created_at
WHERE payment_method IS NULL;