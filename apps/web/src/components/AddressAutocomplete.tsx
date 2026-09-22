import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { searchAddressPhoton } from '@/lib/addressUtils';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AddressSuggestion {
  address: string;
  street: string;
  city: string;
  postcode: string;
  isOutOfService?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showHelperText?: boolean;
}

interface ServiceAreaRecord {
  city: string;
  postal_code: string | null;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = "Kirjoita osoite, esim. Arvelantie 5",
  className,
  showHelperText = true,
}: AddressAutocompleteProps) => {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeServiceAreas, setActiveServiceAreas] = useState<ServiceAreaRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load active service areas
  useEffect(() => {
    let cancelled = false;
    const loadServiceAreas = async () => {
      try {
        const { data, error } = await supabase
          .from("service_areas")
          .select("city, postal_code")
          .eq("is_active", true);

        if (!cancelled && !error && data) {
          setActiveServiceAreas(data as ServiceAreaRecord[]);
        }
      } catch (err) {
        console.error("Error fetching active service areas:", err);
      }
    };
    loadServiceAreas();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchAddressPhoton(value);
        if (results && results.length > 0) {
          const defaultCities = ["helsinki", "espoo", "vantaa", "kauniainen", "kirkkonummi"];
          
          const processed: AddressSuggestion[] = results.map((r) => {
            const city = (r.city || "").trim();
            const postcode = (r.postcode || "").trim();
            const cityNorm = city.toLowerCase();

            let isSupported = false;
            if (activeServiceAreas.length > 0) {
              isSupported = activeServiceAreas.some((area) => {
                const areaCityNorm = (area.city || "").trim().toLowerCase();
                if (areaCityNorm === cityNorm) {
                  if (!area.postal_code) return true;
                  return area.postal_code.trim() === postcode;
                }
                return false;
              });
            } else {
              isSupported = defaultCities.includes(cityNorm);
            }

            return {
              address: r.formatted,
              street: r.street + (r.housenumber ? ` ${r.housenumber}` : ''),
              city,
              postcode,
              isOutOfService: city.length > 0 ? !isSupported : false,
              coordinates: r.coordinates,
            };
          });

          setSuggestions(processed);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, 280);

    return () => clearTimeout(debounceTimer);
  }, [value, activeServiceAreas]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    if (suggestion.isOutOfService) {
      toast({
        title: "Ei palvelualueella",
        description: `Osoite ${suggestion.city ? "(" + suggestion.city + ")" : ""} on Pesunin palvelualueen ulkopuolella.`,
        variant: "destructive",
      });
      return;
    }

    const chosenStreet = suggestion.street || suggestion.address;
    onChange(chosenStreet, suggestion.coordinates);
    if (onSelect) {
      onSelect(suggestion);
    }
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", className)}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors border-b last:border-b-0",
                suggestion.isOutOfService ? "bg-red-50/40 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/40" : "hover:bg-accent",
                selectedIndex === index && (suggestion.isOutOfService ? "bg-red-100 dark:bg-red-950/50" : "bg-accent")
              )}
            >
              <div className="flex items-start gap-2">
                <MapPin className={cn("h-4 w-4 mt-1 flex-shrink-0", suggestion.isOutOfService ? "text-destructive" : "text-primary")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">
                      {suggestion.street}
                    </p>
                    {suggestion.isOutOfService && (
                      <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded font-semibold shrink-0">
                        Ei palvelualueella
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.postcode} {suggestion.city}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {showHelperText && (
        <p className="text-xs text-muted-foreground mt-1">
          Kirjoita osoite, esim. "Arvelantie" tai "Arvelantie 5, Helsinki"
        </p>
      )}
    </div>
  );
};
