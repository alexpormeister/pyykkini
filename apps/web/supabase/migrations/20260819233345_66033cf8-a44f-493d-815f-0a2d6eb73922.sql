-- 1) Points functions hardening
CREATE OR REPLACE FUNCTION public.award_order_points(p_order_id uuid, p_user_id uuid, p_amount numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points_earned INTEGER;
BEGIN
  -- Only server-side (no JWT) callers or admins may award points
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  points_earned := FLOOR(p_amount);

  IF points_earned > 0 THEN
    IF EXISTS (SELECT 1 FROM public.points_transactions WHERE order_id = p_order_id AND transaction_type = 'earned') THEN
      RETURN 0;
    END IF;

    INSERT INTO public.points_transactions (user_id, order_id, points, transaction_type, description, expires_at)
    VALUES (p_user_id, p_order_id, points_earned, 'earned', 'Pisteet tilauksesta', now() + INTERVAL '12 months');

    UPDATE public.profiles
    SET points_balance = public.get_user_points_balance(p_user_id)
    WHERE user_id = p_user_id;
  END IF;

  RETURN points_earned;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.award_order_points(uuid, uuid, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_order_points(uuid, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_points(p_user_id uuid, p_points integer, p_description text DEFAULT 'Pisteet lunastettu'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN FALSE;
  END IF;

  current_balance := public.get_user_points_balance(p_user_id);
  IF current_balance < p_points THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.points_transactions (user_id, points, transaction_type, description)
  VALUES (p_user_id, p_points, 'redeemed', p_description);

  UPDATE public.profiles
  SET points_balance = public.get_user_points_balance(p_user_id)
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_points(uuid, integer, text) FROM anon;

CREATE OR REPLACE FUNCTION public.deduct_points(user_id_param uuid, amount_to_deduct integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> user_id_param AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF amount_to_deduct IS NULL OR amount_to_deduct <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT COALESCE(points_balance, 0) INTO current_balance
  FROM public.profiles WHERE user_id = user_id_param;

  IF current_balance IS NULL OR current_balance < amount_to_deduct THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;

  UPDATE public.profiles
  SET points_balance = COALESCE(points_balance, 0) - amount_to_deduct
  WHERE user_id = user_id_param;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.deduct_points(uuid, integer) FROM anon;

-- 2) Storage access helper for the laundry-uploads bucket
CREATE OR REPLACE FUNCTION public.can_access_laundry_upload(_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parts text[];
  p1 text;
  p2 text;
  uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN true;
  END IF;

  parts := string_to_array(COALESCE(_name, ''), '/');
  p1 := parts[1];
  p2 := parts[2];

  -- orders/{order_id}/*
  IF p1 = 'orders' AND p2 ~ uuid_re THEN
    RETURN EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = p2::uuid
        AND (o.user_id = auth.uid()
             OR (o.laundry_id IS NOT NULL AND public.is_laundry_member(auth.uid(), o.laundry_id)))
    );
  END IF;

  -- complaints/{complaint_id}/*
  IF p1 = 'complaints' AND p2 ~ uuid_re THEN
    RETURN EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = p2::uuid
        AND (c.user_id = auth.uid() OR c.created_by = auth.uid())
    );
  END IF;

  -- contracts/{laundry_id}/*
  IF p1 = 'contracts' AND p2 ~ uuid_re THEN
    RETURN public.is_laundry_member(auth.uid(), p2::uuid);
  END IF;

  -- legacy layout: {laundry_id}/{order_id}/*
  IF p1 ~ uuid_re THEN
    IF public.is_laundry_member(auth.uid(), p1::uuid) THEN
      RETURN true;
    END IF;
    IF p2 ~ uuid_re THEN
      RETURN EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p2::uuid AND o.user_id = auth.uid());
    END IF;
  END IF;

  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_laundry_upload(text) FROM anon;

-- 3) Storage RLS for laundry-uploads
DROP POLICY IF EXISTS "Authenticated can read laundry uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert laundry uploads" ON storage.objects;

CREATE POLICY "laundry-uploads scoped read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'laundry-uploads' AND public.can_access_laundry_upload(name));

CREATE POLICY "laundry-uploads scoped insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'laundry-uploads' AND public.can_access_laundry_upload(name));

CREATE POLICY "laundry-uploads scoped update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'laundry-uploads' AND public.can_access_laundry_upload(name))
WITH CHECK (bucket_id = 'laundry-uploads' AND public.can_access_laundry_upload(name));

CREATE POLICY "laundry-uploads admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'laundry-uploads' AND public.has_role(auth.uid(), 'admin'));