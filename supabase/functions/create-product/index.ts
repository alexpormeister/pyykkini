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
  base_price: z.number().positive("Price must be positive").min(0.01, "Minimum price is 0.01€").max(10000, "Maximum price is 10000€")
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
        is_active: true,
        pricing_model: 'FIXED'
      })
      .select()
      .single();

    if (productError) {
      console.error('Product creation error:', productError);
      throw new Error('Failed to create product');
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
