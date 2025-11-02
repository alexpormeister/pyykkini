import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const orderValidationSchema = z.object({
  cartItems: z.array(z.object({
    serviceId: z.string().min(1),
    quantity: z.number().int().positive().max(100)
  })).min(1).max(50),
  phone: z.string().regex(/^[\d\s\-\+\(\)]{7,20}$/, "Invalid phone format"),
  address: z.string().min(5).max(500),
  specialInstructions: z.string().max(1000).optional(),
  pickupOption: z.string().min(1).max(50),
  selectedTimeSlot: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    display: z.string()
  }),
  estimatedReturnSlot: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    display: z.string()
  }).optional(),
  couponCode: z.string().max(50).optional()
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
    const validated = orderValidationSchema.parse(body);

    // Validate time slots are in the future
    const now = new Date();
    const pickupDate = new Date(`${validated.selectedTimeSlot.date}T${validated.selectedTimeSlot.start}`);
    if (pickupDate < now) {
      return new Response(JSON.stringify({ error: 'Pickup time must be in the future' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate products exist and get actual prices
    const validatedItems = [];
    let subtotal = 0;

    for (const item of validated.cartItems) {
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('product_id, name, base_price, is_active')
        .eq('product_id', item.serviceId)
        .eq('is_active', true)
        .single();

      if (productError || !product) {
        return new Response(JSON.stringify({ error: `Invalid product: ${item.serviceId}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const itemTotal = product.base_price * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        serviceId: product.product_id,
        name: product.name,
        price: product.base_price,
        quantity: item.quantity,
        total: itemTotal
      });
    }

    // Validate and apply coupon if provided
    let discount = 0;
    let finalPrice = subtotal;
    let couponData = null;

    if (validated.couponCode) {
      const { data: couponValidation, error: couponError } = await supabaseClient.functions.invoke(
        'validate-coupon',
        {
          body: { 
            code: validated.couponCode,
            orderTotal: subtotal 
          }
        }
      );

      if (!couponError && couponValidation?.valid && couponValidation?.coupon) {
        const coupon = couponValidation.coupon;
        if (coupon.discount_type === 'percentage') {
          discount = subtotal * (coupon.discount_value / 100);
        } else {
          discount = Math.min(coupon.discount_value, subtotal);
        }
        finalPrice = Math.max(0, subtotal - discount);
        couponData = coupon;
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        validatedItems,
        subtotal,
        discount,
        finalPrice,
        coupon: couponData,
        validation: {
          phone: validated.phone,
          address: validated.address,
          specialInstructions: validated.specialInstructions || null,
          pickupOption: validated.pickupOption,
          selectedTimeSlot: validated.selectedTimeSlot,
          estimatedReturnSlot: validated.estimatedReturnSlot
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Order validation error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: error.errors.map(e => e.message)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Order validation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
