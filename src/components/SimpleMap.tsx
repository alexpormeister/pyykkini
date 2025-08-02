import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, AlertCircle } from 'lucide-react';

interface SimpleMapProps {
  address: string;
}

export const SimpleMap = ({ address }: SimpleMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const geocodeAddress = async () => {
      if (!address.trim()) {
        setError('Osoite puuttuu');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Use a simple geocoding service (Nominatim - free OpenStreetMap service)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        
        if (!response.ok) {
          throw new Error('Geocoding failed');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          setCoordinates({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
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
  }, [address]);

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

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.01},${coordinates.lat - 0.01},${coordinates.lng + 0.01},${coordinates.lat + 0.01}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">Noutoosoite kartalla</h4>
        </div>
        <div className="relative h-64 rounded-lg overflow-hidden border">
          <iframe
            src={mapUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            title="Noutoosoitteen sijainti"
            loading="lazy"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {address}
        </p>
      </CardContent>
    </Card>
  );
};