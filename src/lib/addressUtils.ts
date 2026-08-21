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

/**
 * 🌐 Hakee osoite-ehdotukset Photon / OpenStreetMap API:sta
 */
export async function searchAddressPhoton(query: string): Promise<PhotonAddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=10&lat=64.0&lon=26.0`;
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
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Virhe osoitehaussa:', error);
    return [];
  }
}
