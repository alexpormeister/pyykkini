

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'driver',
    'customer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'accepted',
    'picking_up',
    'washing',
    'returning',
    'delivered',
    'rejected',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_sensitive_access"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- This function can be extended to log sensitive data access
  -- For now, it just validates the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized access attempt to sensitive data';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."audit_sensitive_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_all_drivers_rejected"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_active_drivers INTEGER;
  total_rejections INTEGER;
BEGIN
  -- Count active drivers (those currently in shift)
  SELECT COUNT(DISTINCT driver_id) INTO total_active_drivers
  FROM public.driver_shifts 
  WHERE is_active = TRUE;
  
  -- Count rejections for this order
  SELECT COUNT(*) INTO total_rejections
  FROM public.orders 
  WHERE id = NEW.id 
    AND status = 'rejected' 
    AND rejected_by IS NOT NULL;
  
  -- If all active drivers have rejected this order, mark it as rejected
  IF total_rejections >= total_active_drivers AND total_active_drivers > 0 THEN
    UPDATE public.orders 
    SET status = 'rejected'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_all_drivers_rejected"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- This will be handled by the edge function instead
  -- Just return the old record for now
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_driver_orders"() RETURNS TABLE("id" "uuid", "pickup_date" "date", "pickup_time" time without time zone, "return_date" "date", "return_time" time without time zone, "service_type" "text", "service_name" "text", "price" numeric, "status" "public"."order_status", "created_at" timestamp with time zone, "address" "text", "first_name" "text", "last_name" "text", "phone" "text", "driver_id" "uuid", "user_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if user is a driver or admin
  IF NOT (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: Only drivers and admins can access this function';
  END IF;

  -- If admin, return all orders with full data
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.pickup_date,
      o.pickup_time,
      o.return_date,
      o.return_time,
      o.service_type,
      o.service_name,
      o.price,
      o.status,
      o.created_at,
      o.address,
      o.first_name,
      o.last_name,
      o.phone,
      o.driver_id,
      o.user_id
    FROM public.orders o
    ORDER BY o.created_at DESC;
    
    RETURN;
  END IF;

  -- For drivers: Return their assigned orders AND pending unassigned orders (if on shift)
  RETURN QUERY
  SELECT 
    o.id,
    o.pickup_date,
    o.pickup_time,
    o.return_date,
    o.return_time,
    o.service_type,
    o.service_name,
    o.price,
    o.status,
    o.created_at,
    -- Show full address for assigned orders, limited for pending
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.address
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN 
        split_part(o.address, ',', 1) || ', [Osoite piilotettu kunnes hyväksytty]'
      ELSE o.address
    END as address,
    -- Show full name for assigned orders, limited for pending
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.first_name
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN 'Asiakas'
      ELSE o.first_name
    END as first_name,
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.last_name
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN ''
      ELSE o.last_name
    END as last_name,
    -- Show phone for assigned orders, hidden for pending
    CASE 
      WHEN o.driver_id = auth.uid() THEN o.phone
      WHEN o.status = 'pending'::order_status AND o.driver_id IS NULL THEN '[Piilotettu]'
      ELSE o.phone
    END as phone,
    o.driver_id,
    o.user_id
  FROM public.orders o
  WHERE 
    -- ALWAYS show orders assigned to this driver (regardless of shift status)
    o.driver_id = auth.uid() 
    OR 
    -- Show pending unassigned orders ONLY if driver is on active shift
    (o.status = 'pending'::order_status 
     AND o.driver_id IS NULL 
     AND EXISTS (
       SELECT 1 FROM public.driver_shifts 
       WHERE driver_shifts.driver_id = auth.uid() 
       AND is_active = true
     )
    )
  ORDER BY 
    CASE WHEN o.driver_id = auth.uid() THEN 0 ELSE 1 END, -- Assigned orders first
    o.created_at DESC;
    
END;
$$;


ALTER FUNCTION "public"."get_driver_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  
  -- Only assign customer role if no role was manually assigned within 2 seconds
  -- This allows admin to create users with specific roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'customer'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_change"("p_order_id" "uuid", "p_change_type" "text", "p_old_value" "jsonb" DEFAULT NULL::"jsonb", "p_new_value" "jsonb" DEFAULT NULL::"jsonb", "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO public.order_history (
    order_id,
    changed_by,
    change_type,
    old_value,
    new_value,
    change_description
  ) VALUES (
    p_order_id,
    auth.uid(),
    p_change_type,
    p_old_value,
    p_new_value,
    p_description
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$;


ALTER FUNCTION "public"."log_order_change"("p_order_id" "uuid", "p_change_type" "text", "p_old_value" "jsonb", "p_new_value" "jsonb", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_order_change(
    NEW.id,
    'created',
    NULL,
    row_to_json(NEW)::jsonb,
    'Tilaus luotu'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_order_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_order_change(
      NEW.id,
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Tilauksen tila muuttui: ' || COALESCE(OLD.status::text, 'null') || ' -> ' || NEW.status::text
    );
  END IF;
  
  -- Log when driver is assigned
  IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.log_order_change(
      NEW.id,
      'accepted',
      jsonb_build_object('driver_id', OLD.driver_id),
      jsonb_build_object('driver_id', NEW.driver_id),
      'Kuljettaja hyväksyi tilauksen'
    );
  END IF;
  
  -- Log when pickup/return times are updated
  IF OLD.actual_pickup_time IS DISTINCT FROM NEW.actual_pickup_time 
     OR OLD.actual_return_time IS DISTINCT FROM NEW.actual_return_time
     OR OLD.pickup_date IS DISTINCT FROM NEW.pickup_date
     OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time
     OR OLD.return_date IS DISTINCT FROM NEW.return_date
     OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'time_updated',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time,
        'return_date', OLD.return_date,
        'return_time', OLD.return_time,
        'actual_pickup_time', OLD.actual_pickup_time,
        'actual_return_time', OLD.actual_return_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time,
        'return_date', NEW.return_date,
        'return_time', NEW.return_time,
        'actual_pickup_time', NEW.actual_pickup_time,
        'actual_return_time', NEW.actual_return_time
      ),
      'Nouto- tai palautusaikoja päivitettiin'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_time_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Log pickup time changes
  IF OLD.pickup_date IS DISTINCT FROM NEW.pickup_date OR OLD.pickup_time IS DISTINCT FROM NEW.pickup_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'pickup_time_changed',
      jsonb_build_object(
        'pickup_date', OLD.pickup_date,
        'pickup_time', OLD.pickup_time
      ),
      jsonb_build_object(
        'pickup_date', NEW.pickup_date,
        'pickup_time', NEW.pickup_time
      ),
      'Noutohaarukka muutettu: ' || 
      COALESCE(OLD.pickup_date::text, 'null') || ' ' || COALESCE(OLD.pickup_time::text, 'null') || 
      ' -> ' || NEW.pickup_date::text || ' ' || NEW.pickup_time::text
    );
  END IF;
  
  -- Log return time changes
  IF OLD.return_date IS DISTINCT FROM NEW.return_date OR OLD.return_time IS DISTINCT FROM NEW.return_time THEN
    PERFORM public.log_order_change(
      NEW.id,
      'return_time_changed',
      jsonb_build_object(
        'return_date', OLD.return_date,
        'return_time', OLD.return_time
      ),
      jsonb_build_object(
        'return_date', NEW.return_date,
        'return_time', NEW.return_time
      ),
      'Palautushaarukka muutettu: ' || 
      COALESCE(OLD.return_date::text, 'null') || ' ' || COALESCE(OLD.return_time::text, 'null') || 
      ' -> ' || NEW.return_date::text || ' ' || NEW.return_time::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_time_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_data_access"("table_name" "text", "operation" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Log access attempts for sensitive tables
  IF table_name IN ('profiles', 'orders', 'coupons', 'user_roles') THEN
    -- In production, this could log to an audit table
    RAISE LOG 'Access attempt to % table for % operation by user %', table_name, operation, auth.uid();
  END IF;
  
  -- Always return true for now (policies handle the actual restrictions)
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."validate_data_access"("table_name" "text", "operation" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric NOT NULL,
    "usage_limit" integer,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "coupons_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone,
    "event_type" "text" DEFAULT 'custom'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driver_calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driver_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "change_type" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "change_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "total_price" numeric NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rug_dimensions" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_rejections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "rejection_reason" "text",
    "rejected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_rejections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "service_type" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "discount_code" "text",
    "final_price" numeric(10,2) NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "special_instructions" "text",
    "pickup_date" "date" NOT NULL,
    "pickup_time" time without time zone NOT NULL,
    "return_date" "date" NOT NULL,
    "return_time" time without time zone NOT NULL,
    "actual_pickup_time" timestamp with time zone,
    "actual_return_time" timestamp with time zone,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "pickup_option" "text",
    "return_option" "text",
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "rejection_timestamp" timestamp with time zone,
    "coupon_id" "uuid",
    "pickup_weight_kg" numeric(5,2),
    "return_weight_kg" numeric(5,2),
    "terms_accepted" boolean DEFAULT false NOT NULL,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "stripe_session_id" "text",
    "stripe_payment_intent_id" "text",
    "payment_amount" numeric(10,2),
    "paid_at" timestamp with time zone,
    CONSTRAINT "check_payment_method" CHECK (("payment_method" = ANY (ARRAY['stripe'::"text", 'cash'::"text", 'free'::"text"]))),
    CONSTRAINT "check_payment_status" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "pickup_option_check" CHECK (("pickup_option" = ANY (ARRAY['immediate'::"text", 'choose_time'::"text", 'asap'::"text"]))),
    CONSTRAINT "return_option_check" CHECK (("return_option" = ANY (ARRAY['immediate'::"text", 'choose_time'::"text", 'automatic'::"text"])))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_image" integer DEFAULT 1,
    CONSTRAINT "profile_image_check" CHECK ((("profile_image" >= 1) AND ("profile_image" <= 5)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_calendar_events"
    ADD CONSTRAINT "driver_calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_shifts"
    ADD CONSTRAINT "driver_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_rejections"
    ADD CONSTRAINT "order_rejections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_driver_id" ON "public"."orders" USING "btree" ("driver_id");



CREATE INDEX "idx_orders_driver_status" ON "public"."orders" USING "btree" ("driver_id", "status");



CREATE INDEX "idx_orders_payment_status" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_status_driver_id" ON "public"."orders" USING "btree" ("status", "driver_id");



CREATE INDEX "idx_orders_stripe_session" ON "public"."orders" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "order_creation_trigger" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_order_creation"();



CREATE OR REPLACE TRIGGER "order_history_trigger" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_order_status_change"();



CREATE OR REPLACE TRIGGER "trigger_log_time_changes" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_time_changes"();



CREATE OR REPLACE TRIGGER "update_coupons_updated_at" BEFORE UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_calendar_events_updated_at" BEFORE UPDATE ON "public"."driver_calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_driver_shifts_updated_at" BEFORE UPDATE ON "public"."driver_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin only access for coupons" ON "public"."coupons" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete user roles" ON "public"."user_roles" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete users" ON "public"."profiles" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all coupons" ON "public"."coupons" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all order items" ON "public"."order_items" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all orders" ON "public"."orders" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all roles" ON "public"."user_roles" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all driver events" ON "public"."driver_calendar_events" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all order history" ON "public"."order_history" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all rejections" ON "public"."order_rejections" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all shifts" ON "public"."driver_shifts" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Authenticated access only for orders" ON "public"."orders" TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "driver_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("status" = 'pending'::"public"."order_status") AND ("driver_id" IS NULL)))) WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "driver_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("status" = 'pending'::"public"."order_status"))));



CREATE POLICY "Authenticated users can view own roles only" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Authenticated users only for profiles" ON "public"."profiles" TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Coupons require secure validation" ON "public"."coupons" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Deny all public access to coupons" ON "public"."coupons" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny all public access to order_items" ON "public"."order_items" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny all public access to orders" ON "public"."orders" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny all public access to profiles" ON "public"."profiles" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny all public access to user_roles" ON "public"."user_roles" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Drivers can accept and update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ((("status" = 'pending'::"public"."order_status") AND ("driver_id" IS NULL)) OR ("driver_id" = "auth"."uid"()))));



CREATE POLICY "Drivers can accept pending orders" ON "public"."orders" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("status" = 'pending'::"public"."order_status")));



CREATE POLICY "Drivers can accept unassigned pending orders" ON "public"."orders" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("status" = 'pending'::"public"."order_status") AND ("driver_id" IS NULL)));



CREATE POLICY "Drivers can create their own events" ON "public"."driver_calendar_events" FOR INSERT WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can create their own rejections" ON "public"."order_rejections" FOR INSERT WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can delete their own events" ON "public"."driver_calendar_events" FOR DELETE USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can manage their own shifts" ON "public"."driver_shifts" USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can update assigned orders" ON "public"."orders" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("driver_id" = "auth"."uid"())));



CREATE POLICY "Drivers can update their assigned orders" ON "public"."orders" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND ("driver_id" = "auth"."uid"())));



CREATE POLICY "Drivers can update their own events" ON "public"."driver_calendar_events" FOR UPDATE USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can view assigned and pending orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND (("driver_id" = "auth"."uid"()) OR (("status" = 'pending'::"public"."order_status") AND ("driver_id" IS NULL)))));



CREATE POLICY "Drivers can view rejections for their orders" ON "public"."order_rejections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_rejections"."order_id") AND ("orders"."driver_id" = "auth"."uid"())))));



CREATE POLICY "Drivers can view their own events" ON "public"."driver_calendar_events" FOR SELECT USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can view their own shifts" ON "public"."driver_shifts" FOR SELECT USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Users can create order history entries" ON "public"."order_history" FOR INSERT WITH CHECK (("auth"."uid"() = "changed_by"));



CREATE POLICY "Users can create their own order items" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create their own orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own orders" ON "public"."orders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own order items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_rejections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."audit_sensitive_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_sensitive_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_sensitive_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_all_drivers_rejected"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_all_drivers_rejected"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_all_drivers_rejected"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_driver_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_driver_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_driver_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_change"("p_order_id" "uuid", "p_change_type" "text", "p_old_value" "jsonb", "p_new_value" "jsonb", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_change"("p_order_id" "uuid", "p_change_type" "text", "p_old_value" "jsonb", "p_new_value" "jsonb", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_change"("p_order_id" "uuid", "p_change_type" "text", "p_old_value" "jsonb", "p_new_value" "jsonb", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_time_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_time_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_time_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_data_access"("table_name" "text", "operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_data_access"("table_name" "text", "operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_data_access"("table_name" "text", "operation" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."driver_calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."driver_calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."driver_shifts" TO "anon";
GRANT ALL ON TABLE "public"."driver_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."order_history" TO "anon";
GRANT ALL ON TABLE "public"."order_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_history" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_rejections" TO "anon";
GRANT ALL ON TABLE "public"."order_rejections" TO "authenticated";
GRANT ALL ON TABLE "public"."order_rejections" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
