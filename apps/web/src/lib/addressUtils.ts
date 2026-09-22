/**
 * 📍 Osoitteiden jäsennys-, muotoilu- ja hakuapu (Pesuni Web Address Utils)
 * Yhdistää ja purkaa osoitteet muotoon:
 * [Kadunnimi] [Talonumero] [Asunto/Liiketila], [Postinumero] [Kaupunki]
 */

export interface StructuredAddress {
  streetName: string;
  houseNumber: string;
  apartmentNumber?: string;
  postalCode: string;
  city: string;
  fullAddress: string;
}

export interface PhotonAddressSuggestion {
  id: string;
  formatted: string;
  street: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  detail?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

const KNOWN_CITIES = [
  'Helsinki', 'Espoo', 'Vantaa', 'Lohja', 'Vihti', 'Kauniainen',
  'Kirkkonummi', 'Sundsberg', 'Järvenpää', 'Kerava', 'Tuusula',
  'Nurmijärvi', 'Siuntio', 'Karkkila', 'Tampere', 'Turku', 'Lempäälä',
  'Oulu', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori', 'Kouvola', 'Joensuu',
  'Lappeenranta', 'Hämeenlinna', 'Vaasa', 'Seinäjoki', 'Rovaniemi', 'Mikkeli',
  'Kotka', 'Salo', 'Porvoo', 'Kokkola', 'Hyvinkää', 'Rauma'
];

/**
 * 🔍 Purkaa merkkijonomuotoisen osoitteen osiin
 */
export function parseStructuredAddress(addressStr?: string): StructuredAddress {
  if (!addressStr || addressStr.trim() === '') {
    return {
      streetName: '',
      houseNumber: '',
      apartmentNumber: '',
      postalCode: '',
      city: '',
      fullAddress: '',
    };
  }

  const clean = addressStr.trim();
  let streetPart = '';
  let postalPart = '';
  let cityPart = '';

  if (clean.includes(',')) {
    const parts = clean.split(',').map(p => p.trim());
    streetPart = parts[0] || '';
    const secondPart = parts.slice(1).join(' ').trim();

    const postalMatch = secondPart.match(/\b\d{5}\b/);
    if (postalMatch) {
      postalPart = postalMatch[0];
      cityPart = secondPart.replace(postalMatch[0], '').trim();
    } else {
      cityPart = secondPart;
    }
  } else {
    const postalMatch = clean.match(/\b\d{5}\b/);
    if (postalMatch) {
      postalPart = postalMatch[0];
      const beforePostal = clean.substring(0, postalMatch.index).trim();
      const afterPostal = clean.substring((postalMatch.index || 0) + postalMatch[0].length).trim();
      streetPart = beforePostal;
      cityPart = afterPostal;
    } else {
      let foundCity = false;
      for (const city of KNOWN_CITIES) {
        const regex = new RegExp(`\\b${city}\\b`, 'i');
        if (regex.test(clean)) {
          cityPart = city;
          streetPart = clean.replace(regex, '').trim();
          foundCity = true;
          break;
        }
      }
      if (!foundCity) {
        streetPart = clean;
        cityPart = 'Helsinki';
      }
    }
  }

  cityPart = cityPart.replace(/^[0-9\s-]+/, '').trim();

  // Puretaan katuosa
  const streetTokens = streetPart.split(/\s+/).filter(Boolean);
  let streetName = streetPart;
  let houseNumber = '';
  let apartmentNumber: string | undefined = undefined;

  if (streetTokens.length >= 2) {
    const numberIndex = streetTokens.findIndex(t => /^\d/.test(t));
    if (numberIndex > 0) {
      streetName = streetTokens.slice(0, numberIndex).join(' ');
      houseNumber = streetTokens[numberIndex];
      const remaining = streetTokens.slice(numberIndex + 1);
      if (remaining.length > 0) {
        apartmentNumber = remaining.join(' ');
      }
    } else if (numberIndex === 0) {
      houseNumber = streetTokens[0];
      streetName = streetTokens.slice(1).join(' ');
    }
  }

  const fullStreet = [streetName, houseNumber, apartmentNumber].filter(Boolean).join(' ');
  const fullAddress = postalPart
    ? `${fullStreet}, ${postalPart} ${cityPart}`
    : (cityPart ? `${fullStreet}, ${cityPart}` : fullStreet);

  return {
    streetName: streetName || streetPart,
    houseNumber,
    apartmentNumber: apartmentNumber || '',
    postalCode: postalPart,
    city: cityPart,
    fullAddress,
  };
}

/**
 * 🧱 Yhdistää osat viralliseksi osoitteeksi
 */
export function formatAddressFromParts(parts: {
  streetName: string;
  houseNumber: string;
  apartmentNumber?: string;
  postalCode: string;
  city: string;
}): string {
  const street = parts.streetName.trim();
  const house = parts.houseNumber.trim();
  const apt = parts.apartmentNumber?.trim();
  const post = parts.postalCode.trim();
  const city = parts.city.trim();

  if (!street) return '';

  const houseWithApt = [house, apt].filter(Boolean).join(' ');
  const streetFull = houseWithApt ? `${street} ${houseWithApt}` : street;
  const postalPart = [post, city].filter(Boolean).join(' ');

  return postalPart ? `${streetFull}, ${postalPart}` : streetFull;
}

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  helsinki: { lat: 60.1699, lng: 24.9384 },
  espoo: { lat: 60.2055, lng: 24.6559 },
  vantaa: { lat: 60.2934, lng: 25.0378 },
  kauniainen: { lat: 60.2098, lng: 24.7269 },
  kirkkonummi: { lat: 60.1238, lng: 24.4385 },
  kerava: { lat: 60.4034, lng: 25.105 },
  jarvenpaa: { lat: 60.4722, lng: 25.0889 },
  sipoo: { lat: 60.3775, lng: 25.2694 },
  tuusula: { lat: 60.4028, lng: 25.0292 },
  nurmijarvi: { lat: 60.4619, lng: 24.8078 },
  lohja: { lat: 60.25, lng: 24.0667 },
  vihti: { lat: 60.4167, lng: 24.3167 },
  turku: { lat: 60.4518, lng: 22.2666 },
  tampere: { lat: 61.4978, lng: 23.761 },
  tampereen: { lat: 61.4978, lng: 23.761 },
  lahti: { lat: 60.9827, lng: 25.6612 },
  pori: { lat: 61.4851, lng: 21.7974 },
  oulu: { lat: 65.0121, lng: 25.4651 },
  jyvaskyla: { lat: 62.2426, lng: 25.7473 },
  kuopio: { lat: 62.8924, lng: 27.6782 },
};

export function getCityCenterCoordinates(cityOrAddress?: string): { lat: number; lng: number } {
  if (!cityOrAddress) return CITY_COORDINATES.helsinki;
  const clean = cityOrAddress.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o');
  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (clean.includes(cityName)) {
      return coords;
    }
  }
  return CITY_COORDINATES.helsinki;
}

/**
 * Puhdistaa osoitteesta rappu-, kerros- ja huoneistomerkinnät tarkempaa OpenStreetMap/Photon-geokoodausta varten
 */
export function cleanAddressForGeocoding(address: string): string {
  if (!address) return '';
  let clean = address.trim();
  clean = clean.replace(/\b(\d+)\s*krs\b/gi, '');
  clean = clean.replace(/\b(liiketila|porras|rappu|asunto|as\.?|huoneisto|talo)\s*[\w\d-]+\b/gi, '');
  clean = clean.replace(/\b[A-Za-z]\s*\d{1,4}\b/g, ''); // esim. A 12, B 34
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/,\s*,/g, ',');
  return clean;
}

const inMemoryGeoCache = new Map<string, { lat: number; lng: number }>();

/**
 * 🎯 Tarkka osoitegeokoodaus (Photon / Nominatim välimuistilla)
 */
export async function geocodeAddress(
  address: string,
  fallbackCity = 'Espoo'
): Promise<{ lat: number; lng: number }> {
  if (!address || !address.trim()) {
    return getCityCenterCoordinates(fallbackCity);
  }

  const cleaned = cleanAddressForGeocoding(address);
  const cacheKey = cleaned.toLowerCase().trim();

  if (inMemoryGeoCache.has(cacheKey)) {
    return inMemoryGeoCache.get(cacheKey)!;
  }

  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(`pesuni_geo_${cacheKey}`) : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        inMemoryGeoCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {}

  // 1. Photon Geocoder (OSM-pohjainen, nopea ja tarkka Suomessa)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleaned)}&limit=1&lat=60.2&lon=24.8`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          const coords = { lat, lng };
          inMemoryGeoCache.set(cacheKey, coords);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`pesuni_geo_${cacheKey}`, JSON.stringify(coords));
            }
          } catch {}
          return coords;
        }
      }
    }
  } catch (err) {
    console.warn('Photon geocode warning for:', cleaned, err);
  }

  // 2. Nominatim Fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=fi&limit=1&q=${encodeURIComponent(cleaned)}`;
    const res = await fetch(nomUrl, { headers: { 'User-Agent': 'PesuniWeb/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          const coords = { lat, lng };
          inMemoryGeoCache.set(cacheKey, coords);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`pesuni_geo_${cacheKey}`, JSON.stringify(coords));
            }
          } catch {}
          return coords;
        }
      }
    }
  } catch (err) {
    console.warn('Nominatim fallback warning for:', cleaned, err);
  }

  // 3. Fallback kaupungin keskipisteeseen
  const fallback = getCityCenterCoordinates(fallbackCity || address);
  inMemoryGeoCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * 🌐 Hakee osoite-ehdotukset Photon / OpenStreetMap API:sta
 */
export async function searchAddressPhoton(query: string): Promise<PhotonAddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=10&lat=60.2&lon=24.8`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data?.features) return [];

    const results: PhotonAddressSuggestion[] = [];
    const seen = new Set<string>();

    for (const feature of data.features) {
      const p = feature.properties || {};
      const countryCode = (p.countrycode || '').toUpperCase();
      const country = (p.country || '').toLowerCase();

      if (countryCode && countryCode !== 'FI') continue;
      if (country && !['suomi', 'finland'].includes(country)) continue;

      const street = p.street || p.name || '';
      const housenumber = p.housenumber || '';
      const postcode = p.postcode || '';
      const city = p.city || p.town || p.municipality || p.district || '';

      if (!street) continue;

      let formatted = street;
      if (housenumber) formatted += ` ${housenumber}`;
      if (postcode || city) {
        const postalPart = [postcode, city].filter(Boolean).join(' ');
        formatted += `, ${postalPart}`;
      }

      const coords = feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2
        ? { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }
        : undefined;

      if (!seen.has(formatted)) {
        seen.add(formatted);
        results.push({
          id: `${p.osm_id || Math.random()}-${formatted}`,
          formatted,
          street,
          housenumber,
          postcode,
          city,
          detail: [p.district, p.state, p.country || 'Suomi'].filter(Boolean).join(', '),
          coordinates: coords,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Virhe osoitehaussa:', error);
    return [];
  }
}
