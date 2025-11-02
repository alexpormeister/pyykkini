import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoapifyResponse {
  features: Array<{
    geometry: {
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      formatted: string;
      country: string;
      city?: string;
    };
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    
    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { address } = await req.json();
    
    console.log('📍 Geocoding request received for address:', address);
    
    if (!address || !address.trim()) {
      console.error('❌ Empty address provided');
      return new Response(
        JSON.stringify({ error: 'Address is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
    if (!apiKey) {
      console.error('❌ Geoapify API key not configured');
      return new Response(
        JSON.stringify({ error: 'Geocoding service unavailable' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Geoapify API works well with Finnish addresses
    console.log('🌍 Geocoding address:', address);

    // Make the geocoding request to Geoapify
    const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&filter=countrycode:fi&apiKey=${apiKey}`;
    
    console.log('🔗 API URL:', geocodeUrl.replace(apiKey, 'HIDDEN'));
    
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      console.error('❌ Geoapify API request failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Geocoding request failed' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data: GeoapifyResponse = await response.json();
    
    console.log('📊 Geoapify API response features count:', data.features?.length || 0);
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.geometry.coordinates;
      
      console.log('✅ Geocoding successful:', { lat, lng });
      console.log('📍 Formatted address:', feature.properties.formatted);
      
      return new Response(
        JSON.stringify({
          success: true,
          coordinates: {
            lat: lat,
            lng: lng
          },
          formatted_address: feature.properties.formatted
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.warn('⚠️ Address not found.');
      console.warn('⚠️ Address searched:', address);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Address not found',
          details: 'Geoapify could not find the specified address. Please check if the address is correct.'
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('❌ Error in secure-geocoding function:', error);
    return new Response(
      JSON.stringify({ error: 'Geocoding service unavailable' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});