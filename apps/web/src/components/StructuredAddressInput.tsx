import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Search, Loader2, CheckCircle2, Lock } from 'lucide-react';
import {
  parseStructuredAddress,
  formatAddressFromParts,
  searchAddressPhoton,
  PhotonAddressSuggestion,
  StructuredAddress
} from '@/lib/addressUtils';
import { cn } from '@/lib/utils';

interface StructuredAddressInputProps {
  value: string;
  onChange: (fullAddress: string, parts: StructuredAddress) => void;
  required?: boolean;
  label?: string;
  className?: string;
}

export const StructuredAddressInput = ({
  value,
  onChange,
  required = false,
  label = "Osoite",
  className,
}: StructuredAddressInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PhotonAddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Strukturoidut kentät
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Alustetaan olemassa olevan arvon mukaan
  useEffect(() => {
    if (value) {
      const parsed = parseStructuredAddress(value);
      setStreetName(parsed.streetName || '');
      setHouseNumber(parsed.houseNumber || '');
      setApartmentNumber(parsed.apartmentNumber || '');
      setPostalCode(parsed.postalCode || '');
      setCity(parsed.city || '');
    }
  }, [value]);

  // Debounce osoitehakuun
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchAddressPhoton(searchQuery);
      setSuggestions(results);
      setIsLoading(false);
      setShowDropdown(results.length > 0);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sulje lista kun klikataan ulkopuolelle
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Päivitä yläkomponenttiin kun kentät muuttuvat
  const updateAddress = (
    newStreet: string,
    newHouse: string,
    newApt: string,
    newPost: string,
    newCity: string
  ) => {
    const formatted = formatAddressFromParts({
      streetName: newStreet,
      houseNumber: newHouse,
      apartmentNumber: newApt,
      postalCode: newPost,
      city: newCity,
    });

    onChange(formatted, {
      streetName: newStreet,
      houseNumber: newHouse,
      apartmentNumber: newApt,
      postalCode: newPost,
      city: newCity,
      fullAddress: formatted,
    });
  };

  const handleSelectSuggestion = (item: PhotonAddressSuggestion) => {
    const parsed = parseStructuredAddress(item.formatted);
    const newStreet = item.street || parsed.streetName || '';
    const newHouse = item.housenumber || parsed.houseNumber || houseNumber || '';
    const newPost = item.postcode || parsed.postalCode || '';
    const newCity = item.city || parsed.city || '';

    setStreetName(newStreet);
    setHouseNumber(newHouse);
    setPostalCode(newPost);
    setCity(newCity);
    setShowDropdown(false);
    setSearchQuery('');

    updateAddress(newStreet, newHouse, apartmentNumber, newPost, newCity);
  };

  const handleHouseNumberChange = (newHouse: string) => {
    setHouseNumber(newHouse);
    updateAddress(streetName, newHouse, apartmentNumber, postalCode, city);
  };

  const handleApartmentNumberChange = (newApt: string) => {
    setApartmentNumber(newApt);
    updateAddress(streetName, houseNumber, newApt, postalCode, city);
  };

  const currentFullAddress = formatAddressFromParts({
    streetName,
    houseNumber,
    apartmentNumber,
    postalCode,
    city
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {currentFullAddress && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Valittu osoite
          </span>
        )}
      </div>

      {/* 1. OSOITEHAKU / AUTOCOMPLETE */}
      <div ref={searchContainerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Hae osoitetta (esim. Mannerheimintie tai Arvelantie)..."
            className="pl-9 pr-9 text-sm"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Ehdotuslista */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1.5 bg-popover text-popover-foreground border rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-border">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2.5 text-sm"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.street} {item.housenumber || ''}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.postcode} {item.city} {item.detail ? `• ${item.detail}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. STRUKTUROIDUT KENTÄT (KADUNNIMI, TALONRO, ASUNTO/LIIKETILA, POSTINRO, KAUPUNKI) */}
      <div className="bg-muted/30 p-3.5 rounded-xl border space-y-3">
        {/* Rivi 1: Kadunnimi (Lukittu) ja Talonumero (Muokattava) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Kadunnimi <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input
              value={streetName}
              readOnly
              disabled
              placeholder="Valitse hausta..."
              className="bg-muted/70 cursor-not-allowed text-sm font-medium text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">
              Talonumero {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              value={houseNumber}
              onChange={(e) => handleHouseNumberChange(e.target.value)}
              placeholder="esim. 15"
              required={required}
              className="text-sm font-medium bg-background"
            />
          </div>
        </div>

        {/* Rivi 2: Porras / Asunto / Liiketila */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Asunto / Liiketila / Rappu (valinnainen)
          </Label>
          <Input
            value={apartmentNumber}
            onChange={(e) => handleApartmentNumberChange(e.target.value)}
            placeholder="esim. Liiketila 2, B 4 tai Ovi A"
            className="text-sm bg-background"
          />
        </div>

        {/* Rivi 3: Postinumero ja Kaupunki (Lukitut) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Postinumero <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input
              value={postalCode}
              readOnly
              disabled
              placeholder="00100"
              className="bg-muted/70 cursor-not-allowed text-sm font-medium text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Kaupunki <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input
              value={city}
              readOnly
              disabled
              placeholder="Helsinki"
              className="bg-muted/70 cursor-not-allowed text-sm font-medium text-foreground"
            />
          </div>
        </div>
      </div>

      {/* 3. LOPULLINEN OSOITE ESIKATSELU */}
      {currentFullAddress && (
        <div className="text-xs text-muted-foreground bg-accent/50 px-3 py-2 rounded-lg border flex items-center justify-between">
          <span className="font-semibold text-foreground">Tallentuva osoite:</span>
          <span className="text-foreground font-mono">{currentFullAddress}</span>
        </div>
      )}
    </div>
  );
};
