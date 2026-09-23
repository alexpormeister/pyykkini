import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { 
      baseOrderPayload, 
      cartItems, 
      saveToMyTextiles, 
      pointsToUse,
      userId 
    } = await req.json();

    const extractStartTime = (timeStr?: string | null, fallback: string = "10:00"): string => {
      if (!timeStr) return fallback;
      const match = String(timeStr).match(/(\d{1,2}:\d{2})/);
      return match ? match[1] : fallback;
    };

    if (baseOrderPayload) {
      if (baseOrderPayload.pickup_time) {
        baseOrderPayload.pickup_time = extractStartTime(baseOrderPayload.pickup_time, "10:00");
      }
      if (baseOrderPayload.return_time) {
        baseOrderPayload.return_time = extractStartTime(baseOrderPayload.return_time, "18:00");
      }
    }

    // 1. Insert Order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert([baseOrderPayload])
      .select('id')
      .single();

    if (orderError) throw orderError;

    // 2. Insert Order Items
    if (cartItems && cartItems.length > 0) {
      const orderItemsToInsert = cartItems.map((item: any) => ({
        order_id: order.id,
        service_type: 'laundry',
        service_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Save to textiles
      if (saveToMyTextiles) {
        const savedTextilesPayload = cartItems.map((item: any) => {
          const lowerName = item.name.toLowerCase();
          let cat = 'Muu';
          if (lowerName.includes('matto')) cat = 'Matto';
          else if (lowerName.includes('puku') || lowerName.includes('juhla')) cat = 'Puku / Juhlavaate';
          else if (lowerName.includes('takki') || lowerName.includes('untuva')) cat = 'Takki / Untuvatuote';
          else if (lowerName.includes('verho') || lowerName.includes('peitto') || lowerName.includes('lakana') || lowerName.includes('tyyny')) cat = 'Kodintekstiili / Verhot';

          return {
            user_id: userId,
            name: item.name,
            category: cat,
            product_id: String(item.id),
            last_washed_at: new Date().toISOString(),
            last_order_id: order.id,
          };
        });

        await supabaseClient.from('customer_saved_textiles').insert(savedTextilesPayload);
      }
    }

    // 4. Deduct Points
    if (pointsToUse > 0) {
      await supabaseClient.rpc('deduct_points', {
        user_id_param: userId,
        amount_to_deduct: pointsToUse
      });
    }

    return new Response(JSON.stringify({ success: true, orderId: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
