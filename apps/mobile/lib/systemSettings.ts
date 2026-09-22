import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SystemSettings {
    service_fee: number;
    vat_rate: number;
    delivery_fee: number;
    min_order_amount: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
    service_fee: 2.00,
    vat_rate: 25.5,
    delivery_fee: 0.00,
    min_order_amount: 0.00,
};

let cachedSettings: SystemSettings = { ...DEFAULT_SETTINGS };
let hasFetched = false;

/**
 * Hakee järjestelmäasetukset (palvelumaksu, ALV, toimitusmaksu) Supabasesta.
 * Palauttaa oletusarvot (2.00 € / 25.5 %), jos taulua ei vielä löydy tai yhteys katkeaa.
 */
export async function fetchSystemSettings(): Promise<SystemSettings> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('service_fee, vat_rate, delivery_fee, min_order_amount')
            .eq('id', 'global')
            .single();

        if (!error && data) {
            cachedSettings = {
                service_fee: typeof data.service_fee === 'number' ? data.service_fee : parseFloat(data.service_fee || '2.00'),
                vat_rate: typeof data.vat_rate === 'number' ? data.vat_rate : parseFloat(data.vat_rate || '25.5'),
                delivery_fee: typeof data.delivery_fee === 'number' ? data.delivery_fee : parseFloat(data.delivery_fee || '0.00'),
                min_order_amount: typeof data.min_order_amount === 'number' ? data.min_order_amount : parseFloat(data.min_order_amount || '0.00'),
            };
            hasFetched = true;
            return cachedSettings;
        }
    } catch (e) {
        console.warn('Virhe haettaessa app_settings, käytetään oletusarvoja:', e);
    }
    return cachedSettings;
}

/**
 * React Hook, joka tarjoaa sovelluksen aktiiviset dynaamiset asetukset.
 */
export function useSystemSettings(): SystemSettings {
    const [settings, setSettings] = useState<SystemSettings>(cachedSettings);

    useEffect(() => {
        let isMounted = true;

        fetchSystemSettings().then((res) => {
            if (isMounted) setSettings(res);
        });

        // Kuunnellaan reaaliaikaisia päivityksiä Admin-paneelista
        const subscription = supabase
            .channel('app_settings_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.global' },
                (payload: any) => {
                    if (payload.new && isMounted) {
                        const updated: SystemSettings = {
                            service_fee: parseFloat(payload.new.service_fee || '2.00'),
                            vat_rate: parseFloat(payload.new.vat_rate || '25.5'),
                            delivery_fee: parseFloat(payload.new.delivery_fee || '0.00'),
                            min_order_amount: parseFloat(payload.new.min_order_amount || '0.00'),
                        };
                        cachedSettings = updated;
                        setSettings(updated);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(subscription);
        };
    }, []);

    return settings;
}

/**
 * Laskee tilauksen tarkan hintarakenteen ja veron:
 * total = itemsTotal + deliveryFee + serviceFee - discounts
 * vatAmount = total - (total / (1 + (vatRate / 100)))
 */
export function calculateOrderPricing({
    itemsTotal,
    serviceFee,
    deliveryFee = 0,
    vatRate = 25.5,
    couponDiscount = 0,
    pointsDiscount = 0,
}: {
    itemsTotal: number;
    serviceFee: number;
    deliveryFee?: number;
    vatRate?: number;
    couponDiscount?: number;
    pointsDiscount?: number;
}) {
    const totalBeforeDiscounts = Math.max(0, itemsTotal + deliveryFee + serviceFee);
    const finalTotal = Math.max(0, totalBeforeDiscounts - couponDiscount - pointsDiscount);
    const vatMultiplier = 1 + (vatRate / 100);
    const vatAmount = finalTotal > 0 ? finalTotal - (finalTotal / vatMultiplier) : 0;
    const netAmount = finalTotal - vatAmount;

    return {
        itemsTotal,
        serviceFee,
        deliveryFee,
        vatRate,
        couponDiscount,
        pointsDiscount,
        totalBeforeDiscounts,
        finalTotal,
        vatAmount,
        netAmount,
    };
}
