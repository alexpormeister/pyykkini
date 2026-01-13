import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createOrderSchema = z.object({
  validatedOrder: z.object({
    validatedItems: z.array(z.any()),
    subtotal: z.number().positive(),
    finalPrice: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    coupon: z.any().optional()
  }),
  formData: z.object({
    phone: z.string(),
    address: z.string(),
    specialInstructions: z.string().optional(),
    pickupOption: z.string(),
    selectedTimeSlot: z.object({
      date: z.string(),
      start: z.string(),
      end: z.string(),
      display: z.string()
    }),
    estimatedReturnSlot: z.object({
      date: z.string(),
      start: z.string(),
      end: z.string(),
      display: z.string()
    }).optional()
  }),
  cartItems: z.array(z.any()),
  paymentMethod: z.enum(['stripe', 'cash', 'free'])
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const validated = createOrderSchema.parse(body);

    const { validatedOrder, formData, cartItems } = validated;

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    const pickupSlot = formData.selectedTimeSlot 
      ? new Date(`${formData.selectedTimeSlot.date}T${formData.selectedTimeSlot.start}:00`).toISOString()
      : null;
    
    const deliverySlot = formData.estimatedReturnSlot
      ? new Date(`${formData.estimatedReturnSlot.date}T${formData.estimatedReturnSlot.start}:00`).toISOString()
      : null;
    
    // Create the order
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user.id,
        service_type: 'multiple',
        service_name: validatedOrder.validatedItems.length === 1 
          ? validatedOrder.validatedItems[0].name 
          : `${validatedOrder.validatedItems.length} palvelua`,
        price: validatedOrder.subtotal,
        final_price: validatedOrder.finalPrice,
        first_name: 'Asiakas',
        last_name: 'Asiakas',
        phone: formData.phone,
        address: formData.address,
        special_instructions: formData.specialInstructions || null,
        pickup_option: formData.pickupOption,
        pickup_date: formData.selectedTimeSlot?.date || currentDate,
        pickup_time: formData.selectedTimeSlot?.start || currentTime,
        return_option: 'automatic',
        return_date: formData.estimatedReturnSlot?.date || currentDate,
        return_time: formData.estimatedReturnSlot?.start || currentTime,
        discount_code: validatedOrder.coupon?.code || null,
        terms_accepted: true,
        status: 'pending',
        pickup_slot: pickupSlot,
        delivery_slot: deliverySlot,
        tracking_status: 'PENDING',
        access_code: null,
        payment_method: validated.paymentMethod
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error('Failed to create order');
    }

    // Create order items
    const orderItems = cartItems.map((item: any) => ({
      order_id: orderData.id,
      service_type: item.serviceId,
      service_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      metadata: item.metadata || null,
      rug_dimensions: item.metadata?.rugDimensions ? 
        `${item.metadata.rugDimensions.length}cm x ${item.metadata.rugDimensions.width}cm` : 
        null,
      product_name: item.name,
      unit_price_charged: item.price,
      dimensions_cm: item.metadata?.rugDimensions ? {
        width: item.metadata.rugDimensions.width,
        length: item.metadata.rugDimensions.length
      } : null
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      throw new Error('Failed to create order items');
    }

    // Create service role client for privileged operations
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update coupon usage if applied
    if (validatedOrder.coupon) {
      const { data: currentCoupon } = await serviceRoleClient
        .from('coupons')
        .select('usage_count')
        .eq('code', validatedOrder.coupon.code)
        .single();
      
      if (currentCoupon) {
        await serviceRoleClient
          .from('coupons')
          .update({ usage_count: currentCoupon.usage_count + 1 })
          .eq('code', validatedOrder.coupon.code);
      }
    }

    // Award points for the order (1 € = 1 point)
    const pointsToAward = Math.floor(validatedOrder.finalPrice);
    if (pointsToAward > 0) {
      // Insert points transaction with 12 month expiration
      await serviceRoleClient
        .from('points_transactions')
        .insert({
          user_id: user.id,
          order_id: orderData.id,
          points: pointsToAward,
          transaction_type: 'earned',
          description: 'Pisteet tilauksesta',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });

      // Update user's points balance
      const { data: currentProfile } = await serviceRoleClient
        .from('profiles')
        .select('points_balance')
        .eq('user_id', user.id)
        .single();

      if (currentProfile) {
        await serviceRoleClient
          .from('profiles')
          .update({ 
            points_balance: (currentProfile.points_balance || 0) + pointsToAward 
          })
          .eq('user_id', user.id);
      }

      console.log(`Awarded ${pointsToAward} points to user ${user.id} for order ${orderData.id}`);
    }

    // Update user profile address/phone
    const { data: currentProfile } = await supabaseClient
      .from('profiles')
      .select('address, phone')
      .eq('user_id', user.id)
      .single();

    if (currentProfile && (currentProfile.address !== formData.address || currentProfile.phone !== formData.phone)) {
      await supabaseClient
        .from('profiles')
        .update({ 
          address: formData.address,
          phone: formData.phone 
        })
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: orderData.id,
        finalPrice: validatedOrder.finalPrice
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create order error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid order data' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Order creation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
