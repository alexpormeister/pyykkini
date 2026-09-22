/**
 * 📍 Osoitteiden jäsennys- ja muotoiluapu (Pesuni Address Utils)
 * Tukee muotoa: [Kadunnimi] + [Numero] + [Asunnonnumero (valinnainen)] + [Postinumero] + [Kaupunki]
 * Esim: "Arvelantie 5a 7, 02770 Espoo" -> { streetName: 'Arvelantie', houseNumber: '5a', apartmentNumber: '7', postalCode: '02770', city: 'Espoo' }
 */

export interface StructuredAddress {
    streetName: string;
    houseNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
    fullAddress: string;
    streetOnly: string;
    streetWithCity: string;
}

const KNOWN_CITIES = [
    'Helsinki', 'Espoo', 'Vantaa', 'Lohja', 'Vihti', 'Kauniainen',
    'Kirkkonummi', 'Sundsberg', 'Järvenpää', 'Kerava', 'Tuusula',
    'Nurmijärvi', 'Siuntio', 'Karkkila', 'Tampere', 'Turku', 'Lempäälä',
    'Oulu', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori', 'Kouvola', 'Joensuu',
    'Lappeenranta', 'Hämeenlinna', 'Vaasa', 'Seinäjoki', 'Rovaniemi', 'Mikkeli',
    'Kotka', 'Salo', 'Porvoo', 'Kokkola', 'Hyvinkää', 'Järvenpää', 'Rauma'
];

/**
 * 🔍 Purkaa merkkijonomuotoisen osoitteen sen rakenneosiin
 */
export function parseStructuredAddress(addressStr?: string): StructuredAddress {
    if (!addressStr || addressStr.trim() === '') {
        return {
            streetName: 'Noutopiste',
            houseNumber: '',
            postalCode: '02770',
            city: 'Espoo',
            fullAddress: 'Noutopiste, Espoo',
            streetOnly: 'Noutopiste',
            streetWithCity: 'Noutopiste, Espoo',
        };
    }

    const clean = addressStr.trim();
    let streetPart = '';
    let postalPart = '';
    let cityPart = '';

    // 1. Jos osoitteessa on pilkku (esim. "Arvelantie 5a 7, 02770 Espoo")
    if (clean.includes(',')) {
        const parts = clean.split(',').map(p => p.trim());
        streetPart = parts[0] || '';
        const secondPart = parts.slice(1).join(' ').trim();

        // Etsitään 5-numeroinen postinumero toisesta osasta
        const postalMatch = secondPart.match(/\b\d{5}\b/);
        if (postalMatch) {
            postalPart = postalMatch[0];
            cityPart = secondPart.replace(postalMatch[0], '').trim();
        } else {
            cityPart = secondPart;
        }
    } else {
        // 2. Osoite ilman pilkkua (esim. "Arvelantie 5a 7 02770 Espoo")
        const postalMatch = clean.match(/\b\d{5}\b/);
        if (postalMatch) {
            postalPart = postalMatch[0];
            const beforePostal = clean.substring(0, postalMatch.index).trim();
            const afterPostal = clean.substring((postalMatch.index || 0) + postalMatch[0].length).trim();
            streetPart = beforePostal;
            cityPart = afterPostal;
        } else {
            // Etsitään tunnettu kaupunki
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
                cityPart = 'Pääkaupunkiseutu';
            }
        }
    }

    // Siistitään kaupunki
    cityPart = cityPart.replace(/^[0-9\s-]+/, '').trim();
    if (!cityPart) {
        cityPart = 'Espoo';
    }

    // 3. Puretaan katuosa: [Kadunnimi] + [Numero] + [Asunnonnumero]
    // Esim: "Arvelantie 5a 7" -> streetName: "Arvelantie", houseNumber: "5a", apartmentNumber: "7"
    // Esim: "Mannerheimintie 10" -> streetName: "Mannerheimintie", houseNumber: "10"
    // Esim: "Koskelontie 15 A 4" -> streetName: "Koskelontie", houseNumber: "15", apartmentNumber: "A 4"
    const streetTokens = streetPart.split(/\s+/).filter(Boolean);
    let streetName = streetPart;
    let houseNumber = '';
    let apartmentNumber: string | undefined = undefined;

    if (streetTokens.length >= 2) {
        // Etsitään ensimmäinen token, joka alkaa numerolla (talonumero)
        const numberIndex = streetTokens.findIndex(t => /^\d/.test(t));
        if (numberIndex > 0) {
            streetName = streetTokens.slice(0, numberIndex).join(' ');
            houseNumber = streetTokens[numberIndex];
            const remaining = streetTokens.slice(numberIndex + 1);
            if (remaining.length > 0) {
                apartmentNumber = remaining.join(' ');
            }
        } else if (numberIndex === 0) {
            // Jos ensimmäinenkin oli numero (harvinainen)
            houseNumber = streetTokens[0];
            streetName = streetTokens.slice(1).join(' ');
        }
    }

    const streetOnly = streetName || streetPart;
    const fullStreet = [streetName, houseNumber, apartmentNumber].filter(Boolean).join(' ');
    const fullAddress = postalPart 
        ? `${fullStreet}, ${postalPart} ${cityPart}` 
        : `${fullStreet}, ${cityPart}`;
    const streetWithCity = `${streetOnly}, ${cityPart}`;

    return {
        streetName: streetOnly,
        houseNumber,
        apartmentNumber,
        postalCode: postalPart || '02770',
        city: cityPart,
        fullAddress,
        streetOnly,
        streetWithCity,
    };
}

/**
 * 🧱 Yhdistää erilliset kentät viralliseksi osoitemuodoksi
 */
export function formatAddressFromParts(parts: {
    streetName: string;
    houseNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
}): string {
    const streetPart = [
        parts.streetName.trim(),
        parts.houseNumber.trim(),
        parts.apartmentNumber?.trim(),
    ].filter(Boolean).join(' ');

    const postalCityPart = [parts.postalCode.trim(), parts.city.trim()].filter(Boolean).join(' ');

    return postalCityPart ? `${streetPart}, ${postalCityPart}` : streetPart;
}

/**
 * 🛡️ Palauttaa tilauksen 5-numeroisen turvakoodin / noutokoodin (esim. "48291")
 * Asiakas ja kuljettaja voivat tällä todentaa toisensa ovella.
 */
export function getPickupCode(order?: { pickup_code?: string; access_code?: string; id?: string; order_id?: string }): string {
    if (!order) return '48291';

    // 1. Jos tilauksella on jo valmis 5-numeroinen pickup_code
    if (order.pickup_code && /^\d{5}$/.test(String(order.pickup_code).trim())) {
        return String(order.pickup_code).trim();
    }

    // 2. Deterministinen 5-numeroinen koodi order.id:stä tai access_code:sta
    const seed = String(order.access_code || order.order_id || order.id || '12345').trim();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    const pin = (Math.abs(hash) % 90000) + 10000;
    return String(pin);
}

/**
 * ⏰ Muotoilee kellonajan siistiksi aikaväliksi ilman sekunteja (esim. "16:00 - 16:30")
 */
export function formatTimeWindow(timeStr?: string | null): string {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const cleaned = timeStr.trim();
    if (!cleaned) return '';

    // Jos syötteessä on jo aikaväli (esim. "16:00 - 18:00" tai "16:00:00 - 18:00:00")
    if (cleaned.includes('-')) {
        return cleaned
            .split('-')
            .map(part => {
                const p = part.trim();
                const m = p.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
                if (m) {
                    const hh = m[1].padStart(2, '0');
                    const mm = m[2];
                    return `${hh}:${mm}`;
                }
                return p;
            })
            .join(' - ');
    }

    // Yksittäinen kellonaika (esim. "16:00:00" tai "16:00" tai "16.00")
    const match = cleaned.replace('.', ':').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);

        let endH = h;
        let endM = m + 30;
        if (endM >= 60) {
            endH = (endH + Math.floor(endM / 60)) % 24;
            endM = endM % 60;
        }

        const startFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endFormatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return `${startFormatted} - ${endFormatted}`;
    }

    return cleaned;
}
