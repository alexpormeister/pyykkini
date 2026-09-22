import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization required' }, 401);

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return json({ error: 'Invalid authentication' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const body = await req.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || 'customer');
    const first_name = String(body.first_name || '').trim();
    const last_name = String(body.last_name || '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const company_name = body.company_name ? String(body.company_name).trim() : null;
    const business_id = body.business_id ? String(body.business_id).trim() : null;

    if (!email || password.length < 6 || !first_name || !last_name) {
      return json({ error: 'Puuttuvia tai virheellisiä tietoja' }, 400);
    }
    if (!['customer', 'driver', 'admin', 'laundry'].includes(role)) {
      return json({ error: 'Virheellinen rooli' }, 400);
    }
    if ((role === 'driver' || role === 'laundry') && (!company_name || !business_id)) {
      return json({ error: 'Yrityksen nimi ja y-tunnus ovat pakollisia' }, 400);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name },
    });
    if (createError || !created?.user) {
      return json({ error: createError?.message || 'Käyttäjän luominen epäonnistui' }, 400);
    }

    const newUserId = created.user.id;

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { user_id: newUserId, email, first_name, last_name, phone, company_name, business_id },
        { onConflict: 'user_id' }
      );
    if (profileError) console.error('profile error', profileError.message);

    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: newUserId, role }, { onConflict: 'user_id,role' });
    if (roleError) {
      console.error('role error', roleError.message);
      return json({ error: 'Roolin asettaminen epäonnistui' }, 500);
    }
    // remove any other roles so the user has exactly the selected one
    await supabase.from('user_roles').delete().eq('user_id', newUserId).neq('role', role);

    let laundryId: string | null = null;
    if (role === 'laundry') {
      const { data: laundry, error: laundryError } = await supabase
        .from('laundries')
        .insert({ name: company_name, business_id, contact_email: email, contact_phone: phone })
        .select('id')
        .single();
      if (laundryError) {
        console.error('laundry error', laundryError.message);
      } else {
        laundryId = laundry.id;
        const { error: linkError } = await supabase
          .from('laundry_users')
          .insert({ laundry_id: laundry.id, user_id: newUserId });
        if (linkError) console.error('laundry link error', linkError.message);
      }
    }

    return json({ success: true, user_id: newUserId, laundry_id: laundryId });
  } catch (error) {
    console.error('create-user error', error);
    return json({ error: 'Internal server error' }, 500);
  }
});