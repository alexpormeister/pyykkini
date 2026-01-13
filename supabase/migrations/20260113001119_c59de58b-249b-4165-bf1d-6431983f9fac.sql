-- Create points transactions table to track all point changes
CREATE TABLE public.points_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired')),
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_points_transactions_user_id ON public.points_transactions(user_id);
CREATE INDEX idx_points_transactions_expires_at ON public.points_transactions(expires_at);

-- Enable RLS
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own points
CREATE POLICY "Users can view their own points"
ON public.points_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert points (via service role in edge functions)
CREATE POLICY "Admins can manage all points"
ON public.points_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add points column to profiles for quick access to current balance
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;

-- Function to calculate user's valid points (excluding expired)
CREATE OR REPLACE FUNCTION public.get_user_points_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_points INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'earned' AND (expires_at IS NULL OR expires_at > now()) THEN points
      WHEN transaction_type = 'redeemed' THEN -points
      WHEN transaction_type = 'expired' THEN -points
      ELSE 0
    END
  ), 0)
  INTO total_points
  FROM public.points_transactions
  WHERE user_id = p_user_id;
  
  RETURN GREATEST(total_points, 0);
END;
$$;

-- Function to award points from an order
CREATE OR REPLACE FUNCTION public.award_order_points(p_order_id UUID, p_user_id UUID, p_amount NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_earned INTEGER;
BEGIN
  -- 1 € = 1 point (round down)
  points_earned := FLOOR(p_amount);
  
  IF points_earned > 0 THEN
    -- Insert points transaction with 12 month expiration
    INSERT INTO public.points_transactions (
      user_id,
      order_id,
      points,
      transaction_type,
      description,
      expires_at
    ) VALUES (
      p_user_id,
      p_order_id,
      points_earned,
      'earned',
      'Pisteet tilauksesta',
      now() + INTERVAL '12 months'
    );
    
    -- Update user's points balance
    UPDATE public.profiles
    SET points_balance = public.get_user_points_balance(p_user_id)
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN points_earned;
END;
$$;

-- Function to redeem points
CREATE OR REPLACE FUNCTION public.redeem_points(p_user_id UUID, p_points INTEGER, p_description TEXT DEFAULT 'Pisteet lunastettu')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current valid balance
  current_balance := public.get_user_points_balance(p_user_id);
  
  -- Check if user has enough points
  IF current_balance < p_points THEN
    RETURN FALSE;
  END IF;
  
  -- Insert redemption transaction
  INSERT INTO public.points_transactions (
    user_id,
    points,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    p_points,
    'redeemed',
    p_description
  );
  
  -- Update user's points balance
  UPDATE public.profiles
  SET points_balance = public.get_user_points_balance(p_user_id)
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;