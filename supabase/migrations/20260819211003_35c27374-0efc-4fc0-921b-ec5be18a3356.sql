CREATE OR REPLACE FUNCTION public.award_points_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount numeric;
  v_points integer;
BEGIN
  IF (NEW.status = 'delivered'::order_status OR NEW.tracking_status = 'COMPLETED'::order_tracking_status)
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.tracking_status IS DISTINCT FROM NEW.tracking_status) THEN

    IF EXISTS (
      SELECT 1 FROM public.points_transactions
      WHERE order_id = NEW.id AND transaction_type = 'earned'
    ) THEN
      RETURN NEW;
    END IF;

    v_amount := COALESCE(NEW.final_price, NEW.payment_amount, NEW.price, 0);
    v_points := FLOOR(v_amount)::int;

    IF v_points > 0 AND NEW.user_id IS NOT NULL THEN
      INSERT INTO public.points_transactions (user_id, order_id, points, transaction_type, description, expires_at)
      VALUES (NEW.user_id, NEW.id, v_points, 'earned', 'Pisteet tilauksesta', now() + INTERVAL '12 months');

      UPDATE public.profiles
      SET points_balance = public.get_user_points_balance(NEW.user_id)
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_points_on_delivery_trigger ON public.orders;
CREATE TRIGGER award_points_on_delivery_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_delivery();