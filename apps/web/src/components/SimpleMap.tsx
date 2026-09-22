import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SimpleMapProps {
  address: string;
  coordinates?: { lat: number; lng: number } | null;
}

export const SimpleMap = ({ address, coordinates: providedCoordinates }: SimpleMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(providedCoordinates || null);

  useEffect(() => {
    // If coordinates are provided, use them directly
    if (providedCoordinates) {
      console.log('📍 Using provided coordinates:', providedCoordinates);
      setCoordinates(providedCoordinates);
      setLoading(false);
      setError(null);
      return;
    }

    // Otherwise, geocode the address
    const geocodeAddress = async () => {
      if (!address.trim()) {
        setError('Osoite puuttuu');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Geocoding address:', address);
        
        // Use secure geocoding edge function
        const { data, error } = await supabase.functions.invoke('secure-geocoding', {
          body: { address }
        });
        
        if (error) {
          throw new Error('Geocoding failed');
        }
        
        if (data.success && data.coordinates) {
          setCoordinates({
            lat: data.coordinates.lat,
            lng: data.coordinates.lng
          });
        } else {
          setError('Osoitetta ei löytynyt');
        }
      } catch (err) {
        setError('Kartan lataaminen epäonnistui');
        console.error('Geocoding error:', err);
      } finally {
        setLoading(false);
      }
    };

    geocodeAddress();
  }, [address, providedCoordinates]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
            <span>Ladataan karttaa...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!coordinates) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <MapPin className="h-6 w-6 mr-2" />
            <span>Osoitetta ei voitu paikantaa</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use a simple static map with coordinates instead of embedded Google Maps
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=15&size=600x300&markers=color:red%7C${coordinates.lat},${coordinates.lng}&key=STATIC_MAP_KEY`;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">Noutoosoite kartalla</h4>
        </div>
        <div className="relative h-64 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Osoite paikantamisessa</p>
            <p className="text-xs text-muted-foreground">
              Koordinaatit: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
            </p>
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`, '_blank')}
              className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition-colors"
            >
              Avaa Google Mapsissa
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {address}
        </p>
      </CardContent>
    </Card>
  );
};