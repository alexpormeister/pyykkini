import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validointi pyynnölle
const paymentSchema = z.object({
  order_id: z.string(), // Nyt se hyväksyy minkä tahansa tekstin
  amount: z.number().positive().max(100000),
  currency: z.string().length(3).optional().default("eur")
});

serve(async (req) => {
  // CORS-esitarkistus
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // 1. Tunnistetaan käyttäjä tokenin perusteella
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user?.email) {
      throw new Error("Käyttäjää ei tunnistettu. Kirjaudu sisään uudelleen.");
    }

    // 2. Luetaan ja validoidaan body
    const body = await req.json();
    const { order_id, amount, currency } = paymentSchema.parse(body);

    // 3. Alustetaan Stripe käyttäen salassa pidettyä Secret Keytä
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // 4. Etsitään tai luodaan Stripe Customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let stripeCustomer;
    if (customers.data.length > 0) {
      stripeCustomer = customers.data[0];
    } else {
      stripeCustomer = await stripe.customers.create({ 
        email: user.email,
        metadata: { supabase_user_id: user.id } 
      });
    }

    // 5. Luodaan Ephemeral Key (tätä tarvitaan mobiilin maksutapojen hallintaan)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomer.id },
      { apiVersion: '2023-10-16' }
    );

    // 6. Luodaan PaymentIntent (itse maksu)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Eurot senteiksi
      currency: currency,
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { 
        order_id, 
        user_id: user.id 
      }
    });

    // 7. Päivitetään tilaus Supabaseen Service Rolella
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    await supabaseService
      .from("orders")
      .update({
        stripe_session_id: paymentIntent.id,
        payment_method: 'stripe',
        payment_status: 'pending',
        payment_amount: amount
      })
      .eq('id', order_id);

    // 8. Palautetaan tarvittavat "avaimet" sovellukselle
    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: stripeCustomer.id,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Maksuvirhe:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});