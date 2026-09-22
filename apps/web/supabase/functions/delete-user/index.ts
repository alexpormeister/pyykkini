import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    if (!userId) {
      console.error('Missing userId in request');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Redact user ID in logs for privacy
    const redactedUserId = `${userId.substring(0, 8)}...${userId.substring(userId.length - 4)}`;
    console.log('Attempting to delete user:', redactedUserId);

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the requesting user's ID from the JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('Invalid or expired token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if the requesting user is an admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      const redactedRequesterId = `${user.id.substring(0, 8)}...${user.id.substring(user.id.length - 4)}`;
      console.error('User is not admin:', redactedRequesterId, roleData?.role);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Delete all related data in correct order to avoid foreign key constraints
    console.log('Starting deletion of related data...');

    // 1. Delete order history records where this user made changes
    const { error: historyError } = await supabase
      .from('order_history')
      .delete()
      .eq('changed_by', userId);

    if (historyError) {
      console.error('Error deleting order history:', historyError);
    } else {
      console.log('Deleted order history records');
    }

    // 2. Delete order rejections by this user
    const { error: rejectionsError } = await supabase
      .from('order_rejections')
      .delete()
      .eq('driver_id', userId);

    if (rejectionsError) {
      console.error('Error deleting order rejections:', rejectionsError);
    } else {
      console.log('Deleted order rejections');
    }

    // 3. Delete driver calendar events
    const { error: calendarError } = await supabase
      .from('driver_calendar_events')
      .delete()
      .eq('driver_id', userId);

    if (calendarError) {
      console.error('Error deleting calendar events:', calendarError);
    } else {
      console.log('Deleted calendar events');
    }

    // 4. Delete driver shifts
    const { error: shiftsError } = await supabase
      .from('driver_shifts')
      .delete()
      .eq('driver_id', userId);

    if (shiftsError) {
      console.error('Error deleting driver shifts:', shiftsError);
    } else {
      console.log('Deleted driver shifts');
    }

    // 5. Update orders to remove driver assignments and user associations
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        driver_id: null,
        rejected_by: null 
      })
      .or(`driver_id.eq.${userId},rejected_by.eq.${userId}`);

    if (orderUpdateError) {
      console.error('Error updating orders:', orderUpdateError);
    } else {
      console.log('Updated orders to remove user references');
    }

    // 6. Delete orders created by this user
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('user_id', userId);

    if (ordersError) {
      console.error('Error deleting user orders:', ordersError);
    } else {
      console.log('Deleted user orders');
    }

    // 7. Delete from user_roles
    const { error: rolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Error deleting user roles:', rolesError);
    } else {
      console.log('Deleted user roles');
    }

    // 8. Delete from profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
    } else {
      console.log('Deleted user profile');
    }

    // Delete from auth.users (this requires service role)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user from authentication system' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully deleted user:', redactedUserId);

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in delete-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});