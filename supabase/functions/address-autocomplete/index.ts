import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoapifyAutocompleteResponse {
  features: Array<{
    properties: {
      formatted: string;
      address_line1: string;
      address_line2: string;
      city?: string;
      postcode?: string;
      country: string;
      lon: number;
      lat: number;
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
    const { data } = await supabaseClient.auth.getUser(token);
    
    if (!data.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { text } = await req.json();
    
    console.log('🔍 Autocomplete request for:', text);
    
    if (!text || text.trim().length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [] }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
    if (!apiKey) {
      console.error('❌ Geoapify API key not configured');
      return new Response(
        JSON.stringify({ error: 'Autocomplete service unavailable' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Geoapify autocomplete API with Finland filter
    const autocompleteUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:fi&limit=5&apiKey=${apiKey}`;
    
    console.log('🔗 Calling Geoapify autocomplete');
    
    const response = await fetch(autocompleteUrl);
    
    if (!response.ok) {
      console.error('❌ Geoapify autocomplete failed:', response.status);
      return new Response(
        JSON.stringify({ error: 'Autocomplete request failed' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data: GeoapifyAutocompleteResponse = await response.json();
    
    console.log('✅ Found', data.features?.length || 0, 'suggestions');
    
    const suggestions = data.features.map(feature => ({
      address: feature.properties.formatted,
      street: feature.properties.address_line1,
      city: feature.properties.city || '',
      postcode: feature.properties.postcode || '',
      coordinates: {
        lat: feature.properties.lat,
        lng: feature.properties.lon
      }
    }));

    return new Response(
      JSON.stringify({ suggestions }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌ Error in address-autocomplete:', error);
    return new Response(
      JSON.stringify({ error: 'Address lookup service unavailable' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
