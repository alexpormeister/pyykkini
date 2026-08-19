import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation schema – amount is NEVER accepted from the client
const paymentSchema = z.object({
  order_id: z.string().uuid(),
  currency: z.string().length(3).optional().default("eur")
});

const round2 = (n: number) => Math.round(n * 100) / 100;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = paymentSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { order_id, currency } = validationResult.data;

    // Service client for trusted server-side reads/writes
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Load the order and verify ownership
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select("id, user_id, payment_status, coupon_id, discount_code")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recompute the amount from the database (order items + delivery fee - discount)
    const { data: itemRows, error: itemsError } = await supabaseService
      .from("order_items")
      .select("total_price")
      .eq("order_id", order_id);

    if (itemsError) throw new Error("Failed to load order items");

    const subtotal = round2((itemRows || []).reduce((s, it: { total_price: number | null }) => s + Number(it.total_price || 0), 0));

    let discount = 0;
    if (order.coupon_id || order.discount_code) {
      const couponQuery = supabaseService
        .from("coupons")
        .select("discount_type, discount_value, valid_from, valid_until, usage_limit, usage_count");
      const { data: coupon } = order.coupon_id
        ? await couponQuery.eq("id", order.coupon_id).maybeSingle()
        : await couponQuery.eq("code", order.discount_code as string).maybeSingle();

      if (coupon) {
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;
        const limitOk = coupon.usage_limit == null || Number(coupon.usage_count || 0) <= Number(coupon.usage_limit);
        const dateOk = (!validFrom || validFrom <= now) && (!validUntil || validUntil >= now);
        if (limitOk && dateOk) {
          discount = coupon.discount_type === "percentage"
            ? round2(subtotal * Number(coupon.discount_value) / 100)
            : Math.min(Number(coupon.discount_value), subtotal);
        }
      }
    }

    const { data: deliveryFeeRow } = await supabaseService
      .from("service_areas")
      .select("delivery_fee")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const deliveryFee = round2(Number(deliveryFeeRow?.delivery_fee || 0));
    const amount = round2(Math.max(subtotal + deliveryFee - discount, 0));

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create a one-time payment session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: { 
              name: "Pesuni Pesulapalvelu",
              description: "Tilaus #" + order_id.substring(0, 8)
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/app?payment=cancelled`,
      metadata: {
        order_id: order_id,
        user_id: user.id,
      },
    });

    // Update order with Stripe session ID and the server-verified amount
    await supabaseService
      .from("orders")
      .update({
        stripe_session_id: session.id,
        payment_method: 'stripe',
        payment_status: 'pending',
        payment_amount: amount,
        final_price: amount
      })
      .eq('id', order_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    return new Response(JSON.stringify({ error: 'Payment processing failed' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});