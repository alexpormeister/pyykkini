import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResponse {
  status: string;
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('❌ Google Maps API key not configured');
      return new Response(
        JSON.stringify({ error: 'Geocoding service unavailable' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Add Finland as the region bias for better Finnish address results
    const addressWithCountry = address.includes('Finland') || address.includes('Suomi') 
      ? address 
      : `${address}, Finland`;
    
    console.log('🌍 Geocoding with enhanced address:', addressWithCountry);

    // Make the geocoding request
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressWithCountry)}&region=fi&key=${apiKey}`;
    
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      console.error('❌ Google Maps API request failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Geocoding request failed' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data: GeocodeResponse = await response.json();
    
    console.log('📊 Google Maps API response status:', data.status);
    console.log('📊 Results count:', data.results?.length || 0);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log('✅ Geocoding successful:', location);
      return new Response(
        JSON.stringify({
          success: true,
          coordinates: {
            lat: location.lat,
            lng: location.lng
          }
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.warn('⚠️ Address not found. API Status:', data.status);
      console.warn('⚠️ Original address:', address);
      console.warn('⚠️ Enhanced address:', addressWithCountry);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Address not found',
          details: `Google Maps API returned status: ${data.status}. Please check if the address is correct.`
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in secure-geocoding function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});