import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name too long"),
  category_id: z.string().min(1, "Category is required"),
  description: z.string().max(2000, "Description too long").optional(),
  image_url: z.string().url("Must be valid URL").startsWith('https://', "Must use HTTPS").max(500).optional().or(z.literal('')),
  base_price: z.number().positive("Price must be positive").min(0.01, "Minimum price is 0.01€").max(10000, "Maximum price is 10000€"),
  commission_percent: z.number().min(0, "Commission must be 0-100").max(100, "Commission must be 0-100").optional(),
  platform_fee_type: z.enum(['percent', 'fixed']).optional(),
  platform_fee_value: z.number().min(0).max(10000).optional(),
  driver_fee_type: z.enum(['percent', 'fixed']).optional(),
  driver_fee_value: z.number().min(0).max(10000).optional(),
  badge_text: z.string().trim().max(60).optional().or(z.literal('')),
  is_featured: z.boolean().optional(),
  sort_order: z.number().int().min(1).max(9999).optional(),
  laundry_prices: z.array(z.object({
    laundry_id: z.string().uuid(),
    price: z.number().min(0).max(10000)
  })).max(50).optional()
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

    // Check if user is admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const validated = productSchema.parse(body);

    // Verify category exists
    const { data: category, error: categoryError } = await supabaseClient
      .from('categories')
      .select('category_id')
      .eq('category_id', validated.category_id)
      .single();

    if (categoryError || !category) {
      return new Response(JSON.stringify({ error: 'Invalid category' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate product_id from name
    const product_id = validated.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .substring(0, 50); // Limit length

    // Check for duplicate product_id
    const { data: existingProduct } = await supabaseClient
      .from('products')
      .select('product_id')
      .eq('product_id', product_id)
      .single();

    if (existingProduct) {
      return new Response(
        JSON.stringify({ error: 'Product with similar name already exists' }), 
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create product
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .insert({
        product_id,
        name: validated.name,
        category_id: validated.category_id,
        description: validated.description || null,
        image_url: validated.image_url || null,
        base_price: validated.base_price,
        commission_percent: validated.commission_percent ?? 15,
        platform_fee_type: validated.platform_fee_type ?? 'percent',
        platform_fee_value: validated.platform_fee_value ?? validated.commission_percent ?? 15,
        driver_fee_type: validated.driver_fee_type ?? 'percent',
        driver_fee_value: validated.driver_fee_value ?? 10,
        is_active: true,
        badge_text: validated.badge_text || null,
        is_featured: validated.is_featured ?? false,
        sort_order: validated.sort_order ?? 1,
        pricing_model: 'FIXED'
      })
      .select()
      .single();

    if (productError) {
      console.error('Product creation error:', productError);
      throw new Error('Failed to create product');
    }

    // Store per-laundry price list
    if (validated.laundry_prices?.length) {
      const { error: priceError } = await supabaseClient
        .from('product_laundry_prices')
        .upsert(
          validated.laundry_prices.map((p) => ({
            product_id,
            laundry_id: p.laundry_id,
            price: p.price
          })),
          { onConflict: 'product_id,laundry_id' }
        );

      if (priceError) {
        console.error('Laundry price creation error:', priceError);
        throw new Error('Failed to save laundry prices');
      }
    }

    return new Response(
      JSON.stringify({ success: true, product }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create product error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Product creation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
