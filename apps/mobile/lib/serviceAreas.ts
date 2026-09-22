import { supabase } from './supabase';

export interface ServiceArea {
    id: string;
    city: string;
    postal_code: string | null;
    is_active: boolean;
    delivery_fee: number;
    delivery_days: string[] | null;
    notes: string | null;
}

export interface ServiceAreaMatchResult {
    isSupported: boolean;
    deliveryFee: number;
    matchedCity?: string;
    activeCities: string[];
}

/**
 * Hakee aktiiviset palvelualueet Supabase-tietokannasta
 */
export async function fetchActiveServiceAreas(): Promise<ServiceArea[]> {
    try {
        const { data, error } = await supabase
            .from('service_areas')
            .select('*')
            .eq('is_active', true);

        if (error || !data) {
            console.warn('Virhe palvelualueiden haussa:', error?.message);
            return [];
        }

        return data as ServiceArea[];
    } catch (e) {
        console.error('Palvelualueiden haku epäonnistui:', e);
        return [];
    }
}

/**
 * Tarkistaa, kuuluuko annettu osoite johonkin aktiiviseen palvelualueeseen
 */
export function matchAddressServiceArea(
    address: string | null | undefined,
    activeAreas: ServiceArea[]
): ServiceAreaMatchResult {
    const activeCities = Array.from(new Set(activeAreas.map(a => a.city)));

    if (!address || !address.trim() || activeAreas.length === 0) {
        return {
            isSupported: false,
            deliveryFee: 0,
            activeCities,
        };
    }

    const normalizedAddress = address.toLowerCase();

    for (const area of activeAreas) {
        const cityLower = area.city.trim().toLowerCase();
        if (cityLower && (
            normalizedAddress.includes(cityLower) ||
            normalizedAddress.split(/[\s,]+/).includes(cityLower)
        )) {
            return {
                isSupported: true,
                deliveryFee: Number(area.delivery_fee) || 0,
                matchedCity: area.city,
                activeCities,
            };
        }
    }

    return {
        isSupported: false,
        deliveryFee: 0,
        activeCities,
    };
}
