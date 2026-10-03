import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SystemSettings {
    service_fee: number;
    vat_rate: number;
    delivery_fee: number;
    min_order_amount: number;
    min_order_fee: number;
    driver_wait_time_minutes: number;
    no_show_fee: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
    service_fee: 2.00,
    vat_rate: 25.5,
    delivery_fee: 0.00,
    min_order_amount: 30.00,
    min_order_fee: 7.00,
    driver_wait_time_minutes: 5,
    no_show_fee: 7.90,
};

let cachedSettings: SystemSettings = { ...DEFAULT_SETTINGS };
let hasFetched = false;

/**
 * Hakee järjestelmäasetukset (palvelumaksu, ALV, toimitusmaksu, minimisumma & lisämaksu) Supabasesta.
 */
export async function fetchSystemSettings(): Promise<SystemSettings> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        if (!error && data) {
            cachedSettings = {
                service_fee: typeof data.service_fee === 'number' ? data.service_fee : parseFloat(data.service_fee || '2.00'),
                vat_rate: typeof data.vat_rate === 'number' ? data.vat_rate : parseFloat(data.vat_rate || '25.5'),
                delivery_fee: typeof data.delivery_fee === 'number' ? data.delivery_fee : parseFloat(data.delivery_fee || '0.00'),
                min_order_amount: typeof data.min_order_amount === 'number' ? data.min_order_amount : parseFloat(data.min_order_amount || '0.00'),
                min_order_fee: typeof (data as any).min_order_fee === 'number' ? (data as any).min_order_fee : parseFloat((data as any).min_order_fee || '0.00'),
                driver_wait_time_minutes: typeof (data as any).driver_wait_time_minutes === 'number' ? (data as any).driver_wait_time_minutes : parseInt((data as any).driver_wait_time_minutes || '5', 10),
                no_show_fee: typeof (data as any).no_show_fee === 'number' ? (data as any).no_show_fee : parseFloat((data as any).no_show_fee || '7.90'),
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
        const channelName = `app_settings_realtime_${Math.random().toString(36).substring(7)}`;
        const subscription = supabase
            .channel(channelName)
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
                            min_order_fee: parseFloat(payload.new.min_order_fee || '0.00'),
                            driver_wait_time_minutes: parseInt(payload.new.driver_wait_time_minutes || '5', 10),
                            no_show_fee: parseFloat(payload.new.no_show_fee || '7.90'),
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
 * total = itemsTotal + deliveryFee + serviceFee + smallOrderFee - discounts
 * vatAmount = total - (total / (1 + (vatRate / 100)))
 */
export function calculateOrderPricing({
    itemsTotal,
    serviceFee,
    deliveryFee = 0,
    vatRate = 25.5,
    minOrderAmount = 0,
    minOrderFee = 0,
    couponDiscount = 0,
    pointsDiscount = 0,
}: {
    itemsTotal: number;
    serviceFee: number;
    deliveryFee?: number;
    vatRate?: number;
    minOrderAmount?: number;
    minOrderFee?: number;
    couponDiscount?: number;
    pointsDiscount?: number;
}) {
    const minAmount = minOrderAmount || 0;
    const isMinThresholdMet = minAmount <= 0 || itemsTotal >= minAmount;
    const smallOrderFee = (!isMinThresholdMet && itemsTotal > 0 && minOrderFee > 0) ? minOrderFee : 0;
    const minOrderShortfall = isMinThresholdMet ? 0 : Math.max(0, minAmount - itemsTotal);

    const totalBeforeDiscounts = Math.max(0, itemsTotal + deliveryFee + serviceFee + smallOrderFee);
    const finalTotal = Math.max(0, totalBeforeDiscounts - couponDiscount - pointsDiscount);
    const vatMultiplier = 1 + (vatRate / 100);
    const vatAmount = finalTotal > 0 ? finalTotal - (finalTotal / vatMultiplier) : 0;
    const netAmount = finalTotal - vatAmount;

    return {
        itemsTotal,
        serviceFee,
        deliveryFee,
        vatRate,
        minOrderAmount: minAmount,
        minOrderFee,
        smallOrderFee,
        isMinThresholdMet,
        minOrderShortfall,
        couponDiscount,
        pointsDiscount,
        totalBeforeDiscounts,
        finalTotal,
        vatAmount,
        netAmount,
    };
}
