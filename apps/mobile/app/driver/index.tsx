import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getPickupCode, parseStructuredAddress, formatTimeWindow } from '../../lib/addressUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    activeTab: '#0284C7',
    background: '#FFFFFF',
    cardBg: '#FFFFFF',
    darkText: '#0F172A',
    grayText: '#64748B',
    lightGray: '#94A3B8',
    border: '#E2E8F0',
    green: '#10B981',
};

type TabType = 'today' | 'upcoming' | 'completed';

const TABS: { id: TabType; title: string }[] = [
    { id: 'today', title: 'Tänään' },
    { id: 'upcoming', title: 'Tulossa' },
    { id: 'completed', title: 'Suoritettu' },
];

export interface DriverDrive {
    id: string;
    orderId: string;
    taskType: 'pickup' | 'delivery';
    status: 'assigned' | 'picking_up' | 'arrived_pickup' | 'in_transit_to_laundry' | 'in_progress' | 'returning' | 'arrived_delivery' | 'completed' | 'pending';
    customerName?: string;
    customerPhone?: string;
    accessCode?: string;
    pickupPin: string;
    // Nouto
    pickupCity: string;
    pickupAddress: string;
    pickupLocationName: string;
    pickupScheduled: string;
    pickupStartedAt?: string;
    // Palautus
    deliveryCity: string;
    deliveryAddress: string;
    deliveryLocationName: string;
    deliveryScheduled: string;
    deliveryCompletedAt?: string;
    // Tiedot
    payout: number;
    pickupWeightKg?: number;
    pickupPhotos?: string[];
    verificationType?: 'weight' | 'photo' | 'both';
    notes?: string;
    dateCategory: 'today' | 'upcoming' | 'completed';
    estimatedMinutes?: number;
    distanceKm?: number;
    // Pesulan lisätiedot
    laundryName?: string;
    laundryPhone?: string;
    laundryAddress?: string;
    isLaundryReady?: boolean;
    completedAtRaw?: string | null;
    rawDate?: string | null;
}

/**
 * 🔒 Muotoilee asiakkaan nimen yksityisyyttä suojaavaan muotoon: "Etunimi S."
 */
const formatCustomerName = (fullName?: string, firstName?: string, lastName?: string) => {
    if (firstName && firstName.trim() !== '') {
        const first = firstName.trim();
        const lastInitial = (lastName && lastName.trim() !== '') ? `${lastName.trim().charAt(0).toUpperCase()}.` : '';
        return lastInitial ? `${first} ${lastInitial}` : first;
    }
    if (!fullName || fullName.trim() === '' || fullName.toLowerCase() === 'asiakas') {
        return 'Asiakas';
    }
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0];
    }
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first} ${lastInitial}.`;
};

export default function DriverDrivesScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [pageIndex, setPageIndex] = useState(0);

    const [drives, setDrives] = useState<DriverDrive[]>([]);
    const [completedPage, setCompletedPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Keikan tarkastelumodaali
    const [selectedDrive, setSelectedDrive] = useState<DriverDrive | null>(null);

    // Accordion-tilat (avattavat osiot, oletuksena suljettu)
    const [isCustomerInfoExpanded, setIsCustomerInfoExpanded] = useState<boolean>(false);
    const [isLaundryInfoExpanded, setIsLaundryInfoExpanded] = useState<boolean>(false);

    // Noudon tarkistus-modal (Punnitus & Valokuvaus)
    const [weightModalVisible, setWeightModalVisible] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [weightInput, setWeightInput] = useState<string>('4.5');
    const [pickupPhotos, setPickupPhotos] = useState<string[]>([]);
    const [selectedDriveVerificationType, setSelectedDriveVerificationType] = useState<'weight' | 'photo' | 'both'>('weight');
    const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);

    const openNavigation = (address: string) => {
        if (!address) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const encoded = encodeURIComponent(address);
        const url = Platform.OS === 'ios'
            ? `maps://?daddr=${encoded}`
            : `geo:0,0?q=${encoded}`;

        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
        });
    };

    const formatDateString = (dateStr?: string, timeStr?: string) => {
        if (!dateStr) return 'Tänään';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const days = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
            const dayName = days[date.getDay()];
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const timeFormatted = timeStr ? ` klo ${formatTimeWindow(timeStr)}` : '';
            return `${dayName} ${day}.${month}.${year}${timeFormatted}`;
        } catch {
            return dateStr;
        }
    };

    const getCoordinatesForCity = (city: string) => {
        const c = (city || '').toLowerCase();
        if (c.includes('espoo') || c.includes('entresse')) return { latitude: 60.2055, longitude: 24.6559 };
        if (c.includes('lohja')) return { latitude: 60.2500, longitude: 24.0667 };
        if (c.includes('vantaa')) return { latitude: 60.2934, longitude: 25.0378 };
        if (c.includes('kauniainen')) return { latitude: 60.2098, longitude: 24.7269 };
        if (c.includes('kirkkonummi')) return { latitude: 60.1238, longitude: 24.4385 };
        if (c.includes('helsinki')) return { latitude: 60.1699, longitude: 24.9384 };
        return { latitude: 60.1699, longitude: 24.9384 };
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    };

    // Haetaan kuljettajan oikeat keikat Supabasesta
    const fetchDrives = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let currentUserId = session?.user?.id;
            if (!currentUserId) {
                const { data: { user } } = await supabase.auth.getUser();
                currentUserId = user?.id;
            }

            if (!currentUserId) {
                setDrives([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const today = new Date();
            const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const normalizeDateStr = (d?: string) => {
                if (!d) return todayDateStr;
                const clean = String(d).trim();
                if (clean.includes('T')) return clean.split('T')[0];
                return clean.slice(0, 10);
            };

            // Haetaan aktiivisen pesulan osoitetiedot tietokannasta
            const { data: laundryData } = await supabase
                .from('laundries')
                .select('*')
                .limit(1)
                .maybeSingle();

            const parsedLaundry = parseStructuredAddress(laundryData?.address);
            const laundryName = laundryData?.name || '24Pesula Entresse';
            const laundryPhone = laundryData?.phone || '040 123 4567';
            const laundryAddress = laundryData?.address || 'Siltakatu 11, 02770 Espoo';
            const laundryCity = laundryData?.city || parsedLaundry.city || 'Espoo';
            const laundryFullDisplay = `${laundryName}, ${laundryAddress}`;

            // 1. Haetaan delivery_tasks -taulusta
            const { data: taskData } = await supabase
                .from('delivery_tasks')
                .select('*, orders(*)')
                .eq('driver_id', currentUserId)
                .order('scheduled_date', { ascending: true });

            // 2. Haetaan orders -taulusta (suorat tilaukset)
            const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .eq('driver_id', currentUserId)
                .order('created_at', { ascending: false });

            const allDrives: DriverDrive[] = [];
            const seenOrderIds = new Set<string>();

            if (taskData && taskData.length > 0) {
                taskData.forEach((t: any) => {
                    const ordObj = Array.isArray(t.orders) ? (t.orders[0] || {}) : (t.orders || {});
                    const orderStatus = (ordObj.status || '').toLowerCase();
                    const taskStatusRaw = (t.status || '').toLowerCase();

                    // Hylättyjä tai peruutettuja keikkoja ei koskaan näytetä kuljettajan aktiivisissa ajoissa
                    if (taskStatusRaw === 'cancelled' || orderStatus === 'rejected' || orderStatus === 'cancelled') {
                        return;
                    }

                    const isPickup = t.task_type === 'pickup';
                    const rawTaskDate = isPickup ? (t.scheduled_date || ordObj.pickup_date) : (t.scheduled_date || ordObj.return_date);
                    const taskDateOnly = normalizeDateStr(rawTaskDate);

                    const orderTracking = (ordObj.tracking_status || '').toUpperCase();
                    const ordActualPickup = ordObj.actual_pickup_time;
                    const ordActualReturn = ordObj.actual_return_time;
                    const isCompleted = t.status === 'completed' || t.status === 'delivered' || orderStatus === 'delivered' || orderTracking === 'COMPLETED' || (isPickup && orderStatus === 'washing');

                    let taskStatus = t.status || 'assigned';
                    if (isPickup) {
                        if (t.status === 'completed' || t.status === 'delivered' || orderStatus === 'washing') {
                            taskStatus = 'completed';
                        } else if (orderTracking === 'PICKED_UP' || t.pickup_weight_kg || (t.pickup_photos && t.pickup_photos.length > 0)) {
                            taskStatus = 'in_transit_to_laundry';
                        } else if (orderStatus === 'picking_up' && (ordActualPickup || t.status === 'arrived_pickup')) {
                            taskStatus = 'arrived_pickup';
                        } else if (orderStatus === 'picking_up' || t.status === 'in_progress') {
                            taskStatus = 'picking_up';
                        } else {
                            taskStatus = 'assigned';
                        }
                    } else {
                        // Palautus/Delivery-tehtävä
                        if (t.status === 'completed' || t.status === 'delivered' || orderStatus === 'delivered' || orderTracking === 'COMPLETED') {
                            taskStatus = 'completed';
                        } else if ((orderStatus === 'returning' || orderTracking === 'OUT_FOR_DELIVERY') && (ordActualReturn || t.status === 'arrived_delivery')) {
                            taskStatus = 'arrived_delivery';
                        } else if (orderStatus === 'returning' || orderTracking === 'OUT_FOR_DELIVERY' || t.status === 'in_progress') {
                            taskStatus = 'in_progress';
                        } else {
                            // Ei ole vielä toimitusvaiheessa (nouto/pesu kesken)
                            taskStatus = 'assigned';
                        }
                    }

                    // 🏠 Asiakkaan KOKO virallinen osoite (katu + talo + rappu + postinumero + kaupunki)
                    const customerRawAddress = isPickup
                        ? (t.pickup_address || ordObj.address || t.address)
                        : (t.delivery_address || ordObj.address || t.address);
                    
                    const parsedCustomer = parseStructuredAddress(customerRawAddress);
                    const customerFullAddress = (parsedCustomer.fullAddress && parsedCustomer.fullAddress !== 'Noutopiste, Espoo')
                        ? parsedCustomer.fullAddress
                        : (customerRawAddress || ordObj.address || 'Osoite ei saatavilla');
                    
                    const customerCity = parsedCustomer.city || 'Espoo';
                    const isDone = taskStatus === 'completed' || isCompleted;

                    // 🔒 Yksityisyyssuoja: Suoritetun keikan jälkeen asiakkaan osoitteesta näkyy vain kaupunki
                    const customerDisplayAddress = isDone ? customerCity : customerFullAddress;

                    const pStreet = isPickup ? customerDisplayAddress : laundryFullDisplay;
                    const pCity = isPickup ? customerCity : laundryCity;
                    const dStreet = isPickup ? laundryFullDisplay : customerDisplayAddress;
                    const dCity = isPickup ? laundryCity : customerCity;

                    let dateCategory: 'today' | 'upcoming' | 'completed' = 'today';
                    if (isDone) {
                        dateCategory = 'completed';
                    } else if (taskDateOnly > todayDateStr) {
                        dateCategory = 'upcoming';
                    } else {
                        dateCategory = 'today';
                    }

                    const cStart = getCoordinatesForCity(pCity);
                    const cEnd = getCoordinatesForCity(dCity);
                    const distKm = Math.max(3.2, calculateDistance(cStart.latitude, cStart.longitude, cEnd.latitude, cEnd.longitude));
                    const estMin = Math.max(12, Math.round(distKm * 2.6));

                    const orderIdStr = String(t.order_id || t.id);
                    seenOrderIds.add(orderIdStr);
                    if (t.order_id) seenOrderIds.add(String(t.order_id));

                    // 👤 Asiakkaan nimi muodossa: "Etunimi S."
                    const rawCustName = t.customer_name || t.pickup_name || (ordObj ? `${ordObj.first_name || ''} ${ordObj.last_name || ''}`.trim() : '');
                    const custName = formatCustomerName(rawCustName, ordObj.first_name, ordObj.last_name);
                    const custPhone = isDone ? undefined : (t.pickup_phone || t.delivery_phone || ordObj.phone);
                    const pin = getPickupCode(ordObj || t);

                    // 🔍 Tarkistustyypin määritys (Kilomittaus vs. Valokuvaus vs. Molemmat)
                    const rawServiceName = (ordObj.service_name || t.service_name || '').toLowerCase();
                    const rawVerifType = ordObj.verification_type || t.verification_type;
                    let verifType: 'weight' | 'photo' | 'both' = 'weight';
                    if (rawVerifType === 'photo' || rawVerifType === 'both' || rawVerifType === 'weight') {
                        verifType = rawVerifType;
                    } else {
                        const isPhotoItem = rawServiceName.includes('matto') || rawServiceName.includes('takki') || rawServiceName.includes('puku') || rawServiceName.includes('kenkä') || rawServiceName.includes('erikois');
                        const isWeightItem = rawServiceName.includes('kilo') || rawServiceName.includes('pyykki') || rawServiceName.includes('lakan') || rawServiceName.includes('arki');
                        if (isPhotoItem && isWeightItem) {
                            verifType = 'both';
                        } else if (isPhotoItem) {
                            verifType = 'photo';
                        } else {
                            verifType = 'weight';
                        }
                    }
                    const photos = t.pickup_photos || ordObj.pickup_photos || [];

                    allDrives.push({
                        id: String(t.id),
                        orderId: orderIdStr,
                        taskType: t.task_type,
                        status: taskStatus as any,
                        customerName: isDone ? undefined : custName,
                        customerPhone: custPhone,
                        accessCode: isDone ? undefined : ordObj.access_code,
                        pickupPin: isDone ? '' : pin,
                        pickupCity: pCity,
                        pickupAddress: pStreet,
                        pickupLocationName: isPickup ? (isDone ? 'Asiakasnouto' : `Asiakasnouto (${custName})`) : laundryName,
                        pickupScheduled: formatDateString(t.scheduled_date || ordObj.pickup_date, t.scheduled_time || ordObj.pickup_time),
                        pickupStartedAt: t.started_at ? `Aloitit ajon ${formatDateString(t.started_at)}` : undefined,
                        deliveryCity: dCity,
                        deliveryAddress: dStreet,
                        deliveryLocationName: !isPickup ? (isDone ? 'Asiakastoimitus' : `Asiakastoimitus (${custName})`) : laundryName,
                        deliveryScheduled: formatDateString(t.scheduled_date || ordObj.return_date, t.scheduled_time || ordObj.return_time),
                        deliveryCompletedAt: t.completed_at ? `Valmis ${formatDateString(t.completed_at)}` : undefined,
                        payout: Number(t.driver_payout) || 24,
                        pickupWeightKg: t.pickup_weight_kg ? Number(t.pickup_weight_kg) : undefined,
                        pickupPhotos: photos,
                        verificationType: verifType,
                        notes: isDone ? undefined : (t.notes || ordObj.special_instructions),
                        dateCategory,
                        distanceKm: distKm,
                        estimatedMinutes: estMin,
                        laundryName,
                        laundryPhone,
                        laundryAddress: laundryFullDisplay,
                        isLaundryReady: isPickup || ['PACKAGING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(orderTracking) || ordObj.status === 'returning' || ordObj.status === 'ready_for_delivery',
                        completedAtRaw: t.completed_at || t.updated_at || ordObj.actual_return_time || ordObj.actual_pickup_time || ordObj.updated_at || ordObj.created_at,
                        rawDate: t.scheduled_date || ordObj.pickup_date || ordObj.created_at,
                    });
                });
            }

            if (orderData && orderData.length > 0) {
                orderData.forEach((o: any) => {
                    const orderIdStr = String(o.id);
                    if (seenOrderIds.has(orderIdStr)) return;

                    const orderStatus = (o.status || '').toLowerCase();
                    if (orderStatus === 'rejected' || orderStatus === 'cancelled') {
                        return;
                    }

                    const parsedCustomer = parseStructuredAddress(o.address);
                    const customerFullAddress = (parsedCustomer.fullAddress && parsedCustomer.fullAddress !== 'Noutopiste, Espoo')
                        ? parsedCustomer.fullAddress
                        : (o.address || 'Osoite ei saatavilla');
                    const customerCity = parsedCustomer.city || 'Espoo';

                    const orderTracking = (o.tracking_status || '').toUpperCase();
                    const isCompleted = orderStatus === 'delivered' || orderStatus === 'completed' || orderTracking === 'COMPLETED' || orderStatus === 'washing';
                    const isDeliveryType = orderStatus === 'returning' || orderTracking === 'OUT_FOR_DELIVERY' || orderTracking === 'PACKAGING';
                    const orderDateOnly = normalizeDateStr(isDeliveryType ? (o.return_date || o.pickup_date) : o.pickup_date);

                    let taskStatus = 'assigned';
                    if (isCompleted) {
                        taskStatus = 'completed';
                    } else if (orderStatus === 'picking_up' && o.actual_pickup_time) {
                        taskStatus = 'arrived_pickup';
                    } else if (orderStatus === 'picking_up') {
                        taskStatus = 'picking_up';
                    } else if (orderTracking === 'PICKED_UP' || o.pickup_weight_kg || (o.pickup_photos && o.pickup_photos.length > 0)) {
                        taskStatus = 'in_transit_to_laundry';
                    } else if ((orderStatus === 'returning' || orderTracking === 'OUT_FOR_DELIVERY') && o.actual_return_time) {
                        taskStatus = 'arrived_delivery';
                    } else if (orderStatus === 'returning' || orderTracking === 'OUT_FOR_DELIVERY') {
                        taskStatus = 'in_progress';
                    } else {
                        taskStatus = 'assigned';
                    }

                    const isDone = taskStatus === 'completed' || isCompleted;
                    const customerDisplayAddress = isDone ? customerCity : customerFullAddress;

                    let dateCategory: 'today' | 'upcoming' | 'completed' = 'today';
                    if (isDone) {
                        dateCategory = 'completed';
                    } else if (orderDateOnly > todayDateStr) {
                        dateCategory = 'upcoming';
                    } else {
                        dateCategory = 'today';
                    }

                    const cStart = getCoordinatesForCity(customerCity);
                    const cEnd = getCoordinatesForCity(laundryCity);
                    const distKm = Math.max(3.5, calculateDistance(cStart.latitude, cStart.longitude, cEnd.latitude, cEnd.longitude));
                    const estMin = Math.max(14, Math.round(distKm * 2.6));
                    const custName = formatCustomerName(undefined, o.first_name, o.last_name);
                    const pin = getPickupCode(o);

                    const rawServiceName = (o.service_name || '').toLowerCase();
                    const rawVerifType = o.verification_type;
                    let verifType: 'weight' | 'photo' | 'both' = 'weight';
                    if (rawVerifType === 'photo' || rawVerifType === 'both' || rawVerifType === 'weight') {
                        verifType = rawVerifType;
                    } else {
                        const isPhotoItem = rawServiceName.includes('matto') || rawServiceName.includes('takki') || rawServiceName.includes('puku') || rawServiceName.includes('kenkä') || rawServiceName.includes('erikois');
                        const isWeightItem = rawServiceName.includes('kilo') || rawServiceName.includes('pyykki') || rawServiceName.includes('lakan') || rawServiceName.includes('arki');
                        if (isPhotoItem && isWeightItem) {
                            verifType = 'both';
                        } else if (isPhotoItem) {
                            verifType = 'photo';
                        } else {
                            verifType = 'weight';
                        }
                    }
                    const photos = o.pickup_photos || [];

                    allDrives.push({
                        id: String(o.id),
                        orderId: orderIdStr,
                        taskType: 'pickup',
                        status: taskStatus as any,
                        customerName: isDone ? undefined : custName,
                        customerPhone: isDone ? undefined : o.phone,
                        accessCode: isDone ? undefined : o.access_code,
                        pickupPin: isDone ? '' : pin,
                        pickupCity: customerCity,
                        pickupAddress: customerDisplayAddress,
                        pickupLocationName: isDone ? 'Asiakasnouto' : `Asiakasnouto (${custName})`,
                        pickupScheduled: formatDateString(o.pickup_date, o.pickup_time),
                        deliveryCity: laundryCity,
                        deliveryAddress: laundryFullDisplay,
                        deliveryLocationName: laundryName,
                        deliveryScheduled: formatDateString(o.return_date, o.return_time),
                        payout: Math.round((Number(o.price) || 50) * 0.4 / 2) || 24,
                        pickupWeightKg: o.pickup_weight_kg ? Number(o.pickup_weight_kg) : undefined,
                        pickupPhotos: photos,
                        verificationType: verifType,
                        notes: isDone ? undefined : o.special_instructions,
                        dateCategory,
                        distanceKm: distKm,
                        estimatedMinutes: estMin,
                        laundryName,
                        laundryPhone,
                        laundryAddress: laundryFullDisplay,
                        completedAtRaw: o.actual_return_time || o.actual_pickup_time || o.updated_at || o.created_at,
                        rawDate: o.pickup_date || o.created_at,
                    });
                });
            }

            setDrives(allDrives);
        } catch {
            setDrives([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDrives();

        const channel = supabase
            .channel('driver_drives_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tasks' }, () => {
                fetchDrives();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchDrives();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDrives]);

    // Päivitetään ajot aina kun käyttäjä palaa tälle ruudulle
    useFocusEffect(
        useCallback(() => {
            fetchDrives();
        }, [fetchDrives])
    );

    // Päivitetään avoinna oleva modaali aina kun drives-tilanne muuttuu (ainoastaan tehtävän omalla ID:llä!)
    useEffect(() => {
        if (selectedDrive) {
            const fresh = drives.find(d => d.id === selectedDrive.id);
            if (fresh) {
                setSelectedDrive(fresh);
            }
        }
    }, [drives]);

    // 1. ALOITA NOUTO / ALOITA PALAUTUS
    const handleStartDrive = async (drive: DriverDrive) => {
        if (drive.taskType === 'delivery' && !drive.isLaundryReady) {
            Alert.alert('Pyykit pesulassa', 'Pyykit ovat vielä pesulassa käsittelyssä. Voit aloittaa palautuksen heti kun pesula merkitsee ne valmiiksi.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const isPickup = drive.taskType === 'pickup';
        const newStatus = isPickup ? 'picking_up' : 'in_progress';
        const targetOrderId = drive.orderId || drive.id;

        // Optimistinen päivitys heti
        setDrives(prev => prev.map(d => {
            if (d.id === drive.id) {
                return { ...d, status: newStatus as any };
            }
            return d;
        }));
        if (selectedDrive && selectedDrive.id === drive.id) {
            setSelectedDrive(prev => prev ? { ...prev, status: newStatus as any } : null);
        }

        try {
            const nowIso = new Date().toISOString();
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id;

            // 1. Päivitä VAIN tämä kyseinen task
            await supabase
                .from('delivery_tasks')
                .update({
                    status: 'in_progress',
                    updated_at: nowIso,
                    driver_id: currentUserId,
                })
                .eq('id', drive.id)
                .select();

            // 2. Päivitä orders
            if (targetOrderId) {
                const ordPayload: any = {
                    status: isPickup ? 'picking_up' : 'returning',
                    driver_id: currentUserId,
                    updated_at: nowIso,
                };
                if (!isPickup) {
                    ordPayload.tracking_status = 'OUT_FOR_DELIVERY';
                }

                await supabase
                    .from('orders')
                    .update(ordPayload)
                    .eq('id', targetOrderId)
                    .select();
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await fetchDrives();
        } catch (err: any) {
            console.error('[DRIVE_START] ERROR:', err);
            Alert.alert('Virhe', err?.message || 'Ajon aloitus epäonnistui.');
            await fetchDrives();
        }
    };

    // 2. KULJETTAJA SAAPUNUT KOHTEESEEN (OVIKEIKKA)
    const handleMarkArrived = async (drive: DriverDrive) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const isPickup = drive.taskType === 'pickup';
        const newStatus = isPickup ? 'arrived_pickup' : 'arrived_delivery';
        const targetOrderId = drive.orderId || drive.id;

        // Optimistinen päivitys
        setDrives(prev => prev.map(d => {
            if (d.id === drive.id) {
                return { ...d, status: newStatus as any };
            }
            return d;
        }));
        if (selectedDrive && selectedDrive.id === drive.id) {
            setSelectedDrive(prev => prev ? { ...prev, status: newStatus as any } : null);
        }

        try {
            const nowIso = new Date().toISOString();
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id;

            if (drive.id) {
                await supabase
                    .from('delivery_tasks')
                    .update({ status: 'in_progress', updated_at: nowIso, driver_id: currentUserId })
                    .eq('id', drive.id)
                    .select();
            }

            if (targetOrderId) {
                const ordPayload: any = {
                    driver_id: currentUserId,
                    updated_at: nowIso,
                };
                if (isPickup) {
                    ordPayload.status = 'picking_up';
                    ordPayload.actual_pickup_time = nowIso;
                } else {
                    ordPayload.status = 'returning';
                    ordPayload.tracking_status = 'OUT_FOR_DELIVERY';
                    ordPayload.actual_return_time = nowIso;
                }

                await supabase
                    .from('orders')
                    .update(ordPayload)
                    .eq('id', targetOrderId)
                    .select();
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await fetchDrives();
        } catch (err: any) {
            console.error('[DRIVE_ARRIVED] ERROR:', err);
            Alert.alert('Virhe', err?.message || 'Saapumisen kirjaus epäonnistui.');
            await fetchDrives();
        }
    };

    // 3. NOUDON TARKISTUS (PUNNITUS & VALOKUVAUS & PESULAAN KULJETUS)
    const handleWeightChange = (text: string) => {
        // Korvataan pilkku pisteellä
        let cleaned = text.replace(',', '.');
        // Sallitaan vain numerot ja yksi piste
        cleaned = cleaned.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = `${parts[0]}.${parts[1]}`;
        }
        // Korkeintaan 1 desimaali (esim. 5.9)
        if (parts[1] && parts[1].length > 1) {
            cleaned = `${parts[0]}.${parts[1].slice(0, 1)}`;
        }
        // Ei yli 50 kg
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 50) {
            cleaned = '50';
        }
        setWeightInput(cleaned);
    };

    const handleOpenPickupVerification = (drive: DriverDrive) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedTaskId(drive.id);
        setWeightInput(drive.pickupWeightKg ? String(drive.pickupWeightKg) : '4.5');
        setPickupPhotos(drive.pickupPhotos || []);
        setSelectedDriveVerificationType(drive.verificationType || 'weight');
        setWeightModalVisible(true);
    };

    const handleTakePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Kameran käyttöoikeus', 'Salli kameran käyttö sovelluksen asetuksista ottaaksesi kuvan tuotteesta.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setPickupPhotos(prev => [...prev, result.assets[0].uri]);
            }
        } catch (err: any) {
            console.error('Camera error:', err);
        }
    };

    const handlePickGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                quality: 0.7,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                const newUris = result.assets.map(a => a.uri);
                setPickupPhotos(prev => [...prev, ...newUris]);
            }
        } catch (err: any) {
            console.error('Gallery error:', err);
        }
    };

    const handleRemovePhoto = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setPickupPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirmPickupVerification = async () => {
        if (!selectedTaskId) return;
        Keyboard.dismiss();

        const currentDrive = drives.find(d => d.id === selectedTaskId);
        const targetOrderId = currentDrive?.orderId || selectedTaskId;
        const vType = selectedDriveVerificationType || currentDrive?.verificationType || 'weight';

        const requiresWeight = vType === 'weight' || vType === 'both';
        const requiresPhoto = vType === 'photo' || vType === 'both';

        let validWeight: number | undefined = undefined;
        if (requiresWeight) {
            const weight = parseFloat(weightInput.replace(',', '.'));
            if (isNaN(weight) || weight <= 0) {
                Alert.alert('Virheellinen paino', 'Syötä pyykin paino kiloina (esim. 4.5).');
                return;
            }
            if (weight > 50) {
                Alert.alert('Liian suuri paino', 'Yksittäisen pyykin maksimipaino on 50 kg.');
                return;
            }
            validWeight = Math.round(weight * 10) / 10;
        }

        if (requiresPhoto && pickupPhotos.length === 0) {
            Alert.alert('Kuvat puuttuvat', 'Ota vähintään yksi valokuva tuotteesta (esim. matosta) ennen noudon kuittausta.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsSubmittingWeight(true);

        console.log('[DRIVE_VERIFY_CONFIRM] Confirming pickup verification:', {
            taskId: selectedTaskId,
            targetOrderId,
            verificationType: vType,
            weightKg: validWeight,
            photosCount: pickupPhotos.length,
        });

        // Optimistinen päivitys
        setDrives(prev => prev.map(d => {
            if (d.id === selectedTaskId) {
                return {
                    ...d,
                    status: 'in_transit_to_laundry' as any,
                    pickupWeightKg: validWeight,
                    pickupPhotos: pickupPhotos,
                };
            }
            return d;
        }));
        if (selectedDrive && selectedDrive.id === selectedTaskId) {
            setSelectedDrive(prev => prev ? {
                ...prev,
                status: 'in_transit_to_laundry' as any,
                pickupWeightKg: validWeight,
                pickupPhotos: pickupPhotos,
            } : null);
        }

        try {
            const nowIso = new Date().toISOString();

            // Ladataan kuvat Supabase Storageen
            const uploadedPhotoUrls: string[] = [];
            for (let i = 0; i < pickupPhotos.length; i++) {
                const uri = pickupPhotos[i];
                if (uri.startsWith('http://') || uri.startsWith('https://')) {
                    uploadedPhotoUrls.push(uri);
                } else {
                    try {
                        const response = await fetch(uri);
                        const blob = await response.blob();
                        const arrayBuffer = await new Response(blob).arrayBuffer();
                        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
                        const fileName = `${targetOrderId}/${Date.now()}_${i}.${ext}`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('order-pickup-photos')
                            .upload(fileName, arrayBuffer, {
                                contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
                                upsert: true,
                            });

                        if (!uploadError && uploadData) {
                            const { data: pubData } = supabase.storage
                                .from('order-pickup-photos')
                                .getPublicUrl(fileName);
                            uploadedPhotoUrls.push(pubData?.publicUrl || uri);
                        } else {
                            uploadedPhotoUrls.push(uri);
                        }
                    } catch (e) {
                        uploadedPhotoUrls.push(uri);
                    }
                }
            }

            const taskUpdatePayload: Record<string, any> = {
                status: 'in_progress',
                updated_at: nowIso,
            };
            if (validWeight !== undefined) taskUpdatePayload.pickup_weight_kg = validWeight;
            if (uploadedPhotoUrls.length > 0) taskUpdatePayload.pickup_photos = uploadedPhotoUrls;

            if (selectedTaskId) {
                await supabase
                    .from('delivery_tasks')
                    .update(taskUpdatePayload)
                    .eq('id', selectedTaskId)
                    .select();
            }

            const orderUpdatePayload: Record<string, any> = {
                status: 'washing',
                tracking_status: 'PICKED_UP',
                updated_at: nowIso,
            };
            if (validWeight !== undefined) orderUpdatePayload.pickup_weight_kg = validWeight;
            if (uploadedPhotoUrls.length > 0) orderUpdatePayload.pickup_photos = uploadedPhotoUrls;

            if (targetOrderId) {
                await supabase
                    .from('orders')
                    .update(orderUpdatePayload)
                    .eq('id', targetOrderId)
                    .select();
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setWeightModalVisible(false);
            await fetchDrives();
        } catch (err: any) {
            console.error('[DRIVE_VERIFY_CONFIRM] ERROR:', err);
            Alert.alert('Virhe', err?.message || 'Noudon kuittaus epäonnistui.');
            await fetchDrives();
        } finally {
            setIsSubmittingWeight(false);
        }
    };

    // 4. LUOVUTETTU PESULALLE (Pyykit pesussa)
    const handleDeliveredToLaundry = async (drive: DriverDrive) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        Alert.alert(
            'Luovutus pesulalle',
            'Oletko luovuttanut pyykit pesulaan pestäväksi?',
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Kyllä, luovutettu',
                    style: 'default',
                    onPress: async () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        const targetOrderId = drive.orderId || drive.id;

                        // Optimistinen päivitys
                        setDrives(prev => prev.map(d => {
                            if (d.id === drive.id) {
                                return { ...d, status: 'completed' as any, dateCategory: 'completed' as any };
                            }
                            return d;
                        }));
                        if (selectedDrive && selectedDrive.id === drive.id) {
                            setSelectedDrive(prev => prev ? { ...prev, status: 'completed' as any, dateCategory: 'completed' as any } : null);
                        }

                        try {
                            const nowIso = new Date().toISOString();

                            if (drive.id) {
                                await supabase
                                    .from('delivery_tasks')
                                    .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
                                    .eq('id', drive.id)
                                    .select();
                            }

                            if (targetOrderId) {
                                await supabase
                                    .from('orders')
                                    .update({
                                        status: 'washing',
                                        tracking_status: 'WASHING',
                                        laundry_status: 'accepted',
                                        updated_at: nowIso
                                    })
                                    .eq('id', targetOrderId)
                                    .select();
                            }

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            await fetchDrives();
                        } catch (err: any) {
                            console.error('[DRIVE_LAUNDRY_DELIVERED] ERROR:', err);
                            Alert.alert('Virhe', err?.message || 'Kuittaus epäonnistui.');
                            await fetchDrives();
                        }
                    }
                }
            ]
        );
    };

    // 5. KUITTAA TOIMITETUKSI ASIAKKAALLE
    const handleCompleteDelivery = async (drive: DriverDrive) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        Alert.alert(
            'Kuittaa toimitus suoritetuksi',
            'Oletko luovuttanut puhtaat pyykit asiakkaalle?',
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Kyllä, toimitettu',
                    style: 'default',
                    onPress: async () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        const targetOrderId = drive.orderId || drive.id;

                        // Optimistinen päivitys
                        setDrives(prev => prev.map(d => {
                            if (d.id === drive.id) {
                                return { ...d, status: 'completed' as any, dateCategory: 'completed' as any };
                            }
                            return d;
                        }));
                        if (selectedDrive && selectedDrive.id === drive.id) {
                            setSelectedDrive(prev => prev ? { ...prev, status: 'completed' as any, dateCategory: 'completed' as any } : null);
                        }

                        try {
                            const nowIso = new Date().toISOString();

                            if (drive.id) {
                                await supabase
                                    .from('delivery_tasks')
                                    .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
                                    .eq('id', drive.id)
                                    .select();
                            }

                            if (targetOrderId) {
                                await supabase
                                    .from('orders')
                                    .update({
                                        status: 'delivered',
                                        tracking_status: 'COMPLETED',
                                        actual_return_time: nowIso,
                                        updated_at: nowIso
                                    })
                                    .eq('id', targetOrderId)
                                    .select();
                            }

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            await fetchDrives();
                        } catch (err: any) {
                            console.error('[DRIVE_DELIVERY_COMPLETE] ERROR:', err);
                            Alert.alert('Virhe', err?.message || 'Toimituksen kuittaus epäonnistui.');
                            await fetchDrives();
                        }
                    }
                }
            ]
        );
    };

    const handleTabPress = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setPageIndex(index);
        scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const handleScrollEnd = (e: any) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / SCREEN_WIDTH);
        if (newIndex >= 0 && newIndex < TABS.length && newIndex !== pageIndex) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setPageIndex(newIndex);
        }
    };

    const getStatusBadgeInfo = (drive: DriverDrive) => {
        const isCompleted = drive.status === 'completed';
        const isPickup = drive.taskType === 'pickup';
        const status = drive.status;

        if (isCompleted) {
            return {
                text: 'Suoritettu',
                color: '#059669',
                bg: '#ECFDF5',
                border: '#A7F3D0',
                icon: 'check-circle',
                accentColor: '#10B981',
                typeLabel: isPickup ? 'Noutokeikka' : 'Palautuskeikka'
            };
        }
        if (!isPickup && !isCompleted && !drive.isLaundryReady) {
            return {
                text: 'Pyykit pesulassa (odottaa)',
                color: '#7C3AED',
                bg: '#EDE9FE',
                border: '#DDD6FE',
                icon: 'clock',
                accentColor: '#8B5CF6',
                typeLabel: 'Pyykit pesulassa'
            };
        }
        if (status === 'picking_up') {
            return {
                text: 'Noutamassa asiakkaalta',
                color: '#0284C7',
                bg: '#E0F2FE',
                border: '#BAE6FD',
                icon: 'navigation',
                accentColor: '#00C2FF',
                typeLabel: 'Aktiivinen nouto'
            };
        }
        if (status === 'arrived_pickup') {
            return {
                text: 'Saapunut noutoon (ovella)',
                color: '#D97706',
                bg: '#FEF3C7',
                border: '#FDE68A',
                icon: 'map-pin',
                accentColor: '#F59E0B',
                typeLabel: 'Ovella noutamassa'
            };
        }
        if (status === 'in_transit_to_laundry') {
            return {
                text: 'Kuljetetaan pesulaan',
                color: '#7C3AED',
                bg: '#EDE9FE',
                border: '#DDD6FE',
                icon: 'truck',
                accentColor: '#8B5CF6',
                typeLabel: 'Matkalla pesulaan'
            };
        }
        if (status === 'arrived_delivery') {
            return {
                text: 'Saapunut asiakkaalle (ovella)',
                color: '#D97706',
                bg: '#FEF3C7',
                border: '#FDE68A',
                icon: 'map-pin',
                accentColor: '#F59E0B',
                typeLabel: 'Ovella toimittamassa'
            };
        }
        if (status === 'in_progress' || status === 'returning') {
            return {
                text: isPickup ? 'Nouto käynnissä' : 'Toimitus käynnissä',
                color: '#0284C7',
                bg: '#E0F2FE',
                border: '#BAE6FD',
                icon: 'navigation',
                accentColor: '#00C2FF',
                typeLabel: isPickup ? 'Aktiivinen nouto' : 'Aktiivinen toimitus'
            };
        }
        return {
            text: isPickup ? 'Odottaa noutoa' : 'Odottaa toimitusta',
            color: '#475569',
            bg: '#F1F5F9',
            border: '#E2E8F0',
            icon: 'clock',
            accentColor: '#94A3B8',
            typeLabel: isPickup ? 'Tuleva nouto' : 'Tuleva toimitus'
        };
    };

    // Yksittäisen ajokortin renderöinti listassa (klikkaus avaa tarkemman modaalin)
    const renderDriveCard = (drive: DriverDrive) => {
        const badgeInfo = getStatusBadgeInfo(drive);
        const isCurrentActive = ['picking_up', 'arrived_pickup', 'in_transit_to_laundry', 'in_progress', 'arrived_delivery'].includes(drive.status);

        return (
            <TouchableOpacity
                key={drive.id}
                style={[
                    styles.card,
                    {
                        borderLeftWidth: 6,
                        borderLeftColor: badgeInfo.accentColor,
                    },
                    isCurrentActive && {
                        borderColor: badgeInfo.border,
                        shadowColor: badgeInfo.accentColor,
                        shadowOpacity: 0.16,
                        shadowRadius: 10,
                        elevation: 4,
                    }
                ]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setIsCustomerInfoExpanded(false);
                    setIsLaundryInfoExpanded(false);
                    setSelectedDrive(drive);
                }}
                activeOpacity={0.85}
            >
                {/* 1. YLÄRIVI: STATUS & PALKKIO */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <View style={[styles.statusBadge, { backgroundColor: badgeInfo.bg, borderColor: badgeInfo.border, borderWidth: 1 }]}>
                            <Feather
                                name={badgeInfo.icon as any}
                                size={12}
                                color={badgeInfo.color}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.statusBadgeText, { color: badgeInfo.color }]}>
                                {badgeInfo.text}
                            </Text>
                        </View>
                        {isCurrentActive && (
                            <View style={[styles.activeLivePill, { backgroundColor: badgeInfo.accentColor }]}>
                                <Text style={styles.activeLivePillText}>AKTIIVINEN</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.payoutBadge}>
                        <Text style={styles.payoutValue}>{drive.payout} €</Text>
                    </View>
                </View>

                {/* 2. LÄHTÖPISTE JA MÄÄRÄNPÄÄ (TÄYSI OSOITE JA KOROSTETUT KELLONAJAT) */}
                <View style={styles.routeContainer}>
                    <View style={styles.locationRow}>
                        <View style={styles.dotPickup} />
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationTitle}>{drive.pickupLocationName}</Text>
                            <Text style={styles.addressText}>{drive.pickupAddress}</Text>
                            <View style={styles.timeHighlightBox}>
                                <Feather name="clock" size={12} color="#0284C7" style={{ marginRight: 5 }} />
                                <Text style={styles.timeHighlightText}>{drive.pickupScheduled}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.dottedLineContainer}>
                        <View style={styles.dottedLine} />
                    </View>

                    <View style={styles.locationRow}>
                        <View style={styles.dotDelivery} />
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationTitle}>{drive.deliveryLocationName}</Text>
                            <Text style={styles.addressText}>{drive.deliveryAddress}</Text>
                            <View style={styles.timeHighlightBox}>
                                <Feather name="clock" size={12} color="#10B981" style={{ marginRight: 5 }} />
                                <Text style={[styles.timeHighlightText, { color: '#047857' }]}>{drive.deliveryScheduled}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* PUNNITTU PAINO JOS TALLENNETTU */}
                {drive.pickupWeightKg ? (
                    <View style={styles.weightBadgeRow}>
                        <Feather name="box" size={13} color="#0284C7" style={{ marginRight: 5 }} />
                        <Text style={styles.weightBadgeText}>Pyykin paino: {drive.pickupWeightKg} kg</Text>
                    </View>
                ) : null}

                {/* AVAA TIEDOT -NAPPI / KEHYS */}
                <View style={styles.cardFooter}>
                    <Text style={styles.cardFooterText}>Avaa keikan tiedot ja toiminnot</Text>
                    <Feather name="chevron-right" size={16} color="#0284C7" />
                </View>
            </TouchableOpacity>
        );
    };

    // Yksittäisen välilehden listaussivu
    const renderPage = (tab: { id: TabType; title: string }) => {
        const rawDrives = drives.filter(d => d.dateCategory === tab.id);
        let displayDrives = rawDrives;
        let totalCompletedPages = 1;
        let currentCompletedPage = 1;

        if (tab.id === 'completed') {
            // Uusimmat ylhäällä ja vanhimmat alhaalla
            const sorted = [...rawDrives].sort((a, b) => {
                const timeA = new Date(a.completedAtRaw || a.rawDate || 0).getTime();
                const timeB = new Date(b.completedAtRaw || b.rawDate || 0).getTime();
                return timeB - timeA;
            });

            const COMPLETED_PAGE_SIZE = 5;
            totalCompletedPages = Math.max(1, Math.ceil(sorted.length / COMPLETED_PAGE_SIZE));
            currentCompletedPage = Math.min(completedPage, totalCompletedPages);
            const startIdx = (currentCompletedPage - 1) * COMPLETED_PAGE_SIZE;
            displayDrives = sorted.slice(startIdx, startIdx + COMPLETED_PAGE_SIZE);
        }

        return (
            <ScrollView
                key={tab.id}
                style={{ width: SCREEN_WIDTH }}
                contentContainerStyle={displayDrives.length > 0 ? styles.pageContent : { flexGrow: 1, minHeight: SCREEN_HEIGHT * 0.7 }}
                showsVerticalScrollIndicator={false}
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchDrives();
                        }}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
            >
                {displayDrives.length > 0 ? (
                    <>
                        {displayDrives.map(renderDriveCard)}

                        {tab.id === 'completed' && totalCompletedPages > 1 && (
                            <View style={styles.completedPaginationContainer}>
                                <TouchableOpacity
                                    style={[styles.pageNavBtn, currentCompletedPage <= 1 && styles.pageNavBtnDisabled]}
                                    disabled={currentCompletedPage <= 1}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                        setCompletedPage(prev => Math.max(1, prev - 1));
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="chevron-left" size={16} color={currentCompletedPage <= 1 ? '#94A3B8' : '#0284C7'} style={{ marginRight: 4 }} />
                                    <Text style={[styles.pageNavBtnText, currentCompletedPage <= 1 && styles.pageNavBtnTextDisabled]}>Edellinen</Text>
                                </TouchableOpacity>

                                <View style={styles.pageIndicatorBox}>
                                    <Text style={styles.pageIndicatorText}>
                                        Sivu {currentCompletedPage} / {totalCompletedPages}
                                    </Text>
                                    <Text style={styles.pageTotalCountText}>
                                        ({rawDrives.length} suoritettua)
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.pageNavBtn, currentCompletedPage >= totalCompletedPages && styles.pageNavBtnDisabled]}
                                    disabled={currentCompletedPage >= totalCompletedPages}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                        setCompletedPage(prev => Math.min(totalCompletedPages, prev + 1));
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.pageNavBtnText, currentCompletedPage >= totalCompletedPages && styles.pageNavBtnTextDisabled]}>Seuraava</Text>
                                    <Feather name="chevron-right" size={16} color={currentCompletedPage >= totalCompletedPages ? '#94A3B8' : '#0284C7'} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                ) : (
                    <LinearGradient
                        colors={['#FFFFFF', '#F9FCFF', '#F0F8FE', '#EBF6FE']}
                        start={{ x: 0.1, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={styles.fullEmptyContainer}
                    >
                        {/* 🫧 PEHMEÄT KORISTEPALLEROT KOKO SIVULLE 🫧 */}
                        <View style={[styles.bubble, styles.bubble1]} />
                        <View style={[styles.bubble, styles.bubble2]} />
                        <View style={[styles.bubble, styles.bubble3]} />
                        <View style={[styles.bubble, styles.bubble4]} />
                        <View style={[styles.bubble, styles.bubble5]} />

                        {/* AUTO-IKONI & HEHKUPIIRI */}
                        <View style={styles.imageWrapper}>
                            <LinearGradient
                                colors={['#F0F9FF', '#E0F2FE', '#BAE6FD']}
                                style={styles.imageGlowCircle}
                            >
                                <Image
                                    source={require('../../assets/images/pesuni-car.png')}
                                    style={styles.emptyCarImage}
                                    resizeMode="contain"
                                />
                            </LinearGradient>
                        </View>

                        {/* TEKSTIT */}
                        <Text style={styles.emptyTitle}>
                            {tab.id === 'today'
                                ? 'Ei ajoja tänään'
                                : tab.id === 'upcoming'
                                ? 'Ei tulevia ajoja'
                                : 'Ei suoritettuja ajoja'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {tab.id === 'today' || tab.id === 'upcoming'
                                ? 'Löydät vapaita nouto- ja palautuskeikkoja Etsi-välilehdeltä.'
                                : 'Suoritetut keikkasi kertyvät tähän historiaan.'}
                        </Text>

                        {/* ETSI KEIKKOJA -NAPPI */}
                        {(tab.id === 'today' || tab.id === 'upcoming') && (
                            <TouchableOpacity
                                style={styles.findGigsBtnWrapper}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                                    router.push('/driver/search');
                                }}
                                activeOpacity={0.88}
                            >
                                <LinearGradient
                                    colors={['#00C2FF', '#0284C7']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.findGigsBtnGradient}
                                >
                                    <Text style={styles.findGigsBtnText}>Etsi keikkoja</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </LinearGradient>
                )}
            </ScrollView>
        );
    };

    const modalStartCoord = selectedDrive ? getCoordinatesForCity(selectedDrive.pickupCity) : { latitude: 60.1699, longitude: 24.9384 };
    const modalEndCoord = selectedDrive ? getCoordinatesForCity(selectedDrive.deliveryCity) : { latitude: 60.2055, longitude: 24.6559 };
    const modalBadge = selectedDrive ? getStatusBadgeInfo(selectedDrive) : null;
    const isCompletedDrive = selectedDrive ? (selectedDrive.status === 'completed' || selectedDrive.dateCategory === 'completed') : false;

    // Noutokoodi näkyy VASTA kun pyykki on noudettu asiakkaalta (kuljetuksessa tai toimituksessa)
    const isPickedUpFromCustomer = selectedDrive ? (
        selectedDrive.status === 'in_transit_to_laundry' ||
        selectedDrive.status === 'completed' ||
        selectedDrive.status === 'arrived_delivery' ||
        selectedDrive.status === 'in_progress' && selectedDrive.taskType === 'delivery' ||
        selectedDrive.taskType === 'delivery'
    ) : false;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Omat ajot</Text>
            </View>

            {/* VÄLILEHTIPAKKI (TÄNÄÄN | TULOSSA | SUORITETTU) */}
            <View style={styles.tabBar}>
                {TABS.map((tab, idx) => {
                    const isActive = pageIndex === idx;
                    const count = drives.filter(d => d.dateCategory === tab.id).length;
                    const hasActiveInTab = tab.id === 'today' && drives.some(d => d.dateCategory === 'today' && ['picking_up', 'arrived_pickup', 'in_transit_to_laundry', 'in_progress', 'arrived_delivery'].includes(d.status));

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabButton, isActive && styles.tabButtonActive]}
                            onPress={() => handleTabPress(idx)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.tabLabelRow}>
                                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                    {tab.title}
                                </Text>
                                {count > 0 && (
                                    <View style={[
                                        styles.tabBadge,
                                        isActive && styles.tabBadgeActive,
                                        hasActiveInTab && styles.tabBadgeLive
                                    ]}>
                                        <Text style={[
                                            styles.tabBadgeText,
                                            isActive && styles.tabBadgeTextActive,
                                            hasActiveInTab && styles.tabBadgeTextLive
                                        ]}>
                                            {hasActiveInTab ? `• ${count}` : count}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* HORISONTAALINEN SWIPE PAGER */}
            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScrollEnd}
                    style={styles.pagerScrollView}
                >
                    {TABS.map(renderPage)}
                </ScrollView>
            )}

            {/* 🌟 KEIKAN TARKASTELU- JA TOIMINTOMODAALI (KOKO OSOITE & ASIAKASTIEDOT) 🌟 */}
            <Modal
                visible={!!selectedDrive}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedDrive(null)}
            >
                {selectedDrive && (
                    <SafeAreaView style={styles.modalSheetContainer} edges={['top', 'bottom']}>
                        {/* 1. YLÄPALKKI / SULJE */}
                        <View style={styles.modalHeaderBar}>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setSelectedDrive(null)}
                                activeOpacity={0.7}
                            >
                                <Feather name="x" size={22} color="#0F172A" />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.modalHeaderTitle}>Keikan tiedot</Text>
                                <Text style={styles.modalHeaderSubtitle}>#{String(selectedDrive.orderId || selectedDrive.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}</Text>
                            </View>
                            <View style={[styles.modalStatusPill, { backgroundColor: modalBadge?.bg }]}>
                                <Text style={[styles.modalStatusPillText, { color: modalBadge?.color }]}>
                                    {modalBadge?.text}
                                </Text>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* 2. INTERAKTIIVINEN KARTTAKORTTI */}
                            <View style={styles.modalMapContainer}>
                                <MapView
                                    style={styles.modalMap}
                                    initialRegion={{
                                        latitude: (modalStartCoord.latitude + modalEndCoord.latitude) / 2,
                                        longitude: (modalStartCoord.longitude + modalEndCoord.longitude) / 2,
                                        latitudeDelta: 0.14,
                                        longitudeDelta: 0.14,
                                    }}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                >
                                    <Marker
                                        coordinate={modalStartCoord}
                                        title={`Lähtö: ${selectedDrive.pickupLocationName}`}
                                        description={selectedDrive.pickupAddress}
                                        pinColor="#0284C7"
                                    />
                                    <Marker
                                        coordinate={modalEndCoord}
                                        title={`Määränpää: ${selectedDrive.deliveryLocationName}`}
                                        description={selectedDrive.deliveryAddress}
                                        pinColor="#10B981"
                                    />
                                    <Polyline
                                        coordinates={[modalStartCoord, modalEndCoord]}
                                        strokeColor="#0284C7"
                                        strokeWidth={4}
                                    />
                                </MapView>

                                <View style={styles.modalMapStats}>
                                    <View style={styles.modalMapStatCol}>
                                        <Text style={styles.modalStatLabel}>Arvioitu kesto</Text>
                                        <Text style={styles.modalStatValue}>~ {selectedDrive.estimatedMinutes || 15} min</Text>
                                    </View>
                                    <View style={styles.modalMapStatCol}>
                                        <Text style={styles.modalStatLabel}>Etäisyys</Text>
                                        <Text style={styles.modalStatValue}>{selectedDrive.distanceKm || 4.2} km</Text>
                                    </View>
                                    <View style={[styles.modalMapStatCol, { borderRightWidth: 0 }]}>
                                        <Text style={styles.modalStatLabel}>Palkkio</Text>
                                        <Text style={styles.modalStatValueHighlight}>{selectedDrive.payout} €</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 3. REITIN AIKAJANA JA TÄYDET OSOITTEET */}
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Reitti ja kohteet</Text>

                                {/* LÄHTÖPAIKKA */}
                                <View style={styles.routeItemRow}>
                                    <View style={styles.routeItemDotPickup} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.routeItemLabel}>Lähtöpaikka</Text>
                                        <Text style={styles.routeItemName}>{selectedDrive.pickupLocationName}</Text>
                                        {!isCompletedDrive ? (
                                            <TouchableOpacity
                                                style={styles.routeAddressBtn}
                                                onPress={() => openNavigation(selectedDrive.pickupAddress)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.routeAddressText}>{selectedDrive.pickupAddress}</Text>
                                                <Feather name="navigation" size={14} color="#0284C7" style={{ marginLeft: 6 }} />
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={[styles.routeAddressText, { marginTop: 3 }]}>{selectedDrive.pickupAddress}</Text>
                                        )}
                                        <Text style={styles.routeTimeText}>Aikataulu: {selectedDrive.pickupScheduled}</Text>
                                    </View>
                                </View>

                                <View style={styles.routeSeparator} />

                                {/* MÄÄRÄNPÄÄ */}
                                <View style={styles.routeItemRow}>
                                    <View style={styles.routeItemDotDelivery} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.routeItemLabel}>Määränpää</Text>
                                        <Text style={styles.routeItemName}>{selectedDrive.deliveryLocationName}</Text>
                                        {!isCompletedDrive ? (
                                            <TouchableOpacity
                                                style={styles.routeAddressBtn}
                                                onPress={() => openNavigation(selectedDrive.deliveryAddress)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.routeAddressText}>{selectedDrive.deliveryAddress}</Text>
                                                <Feather name="navigation" size={14} color="#0284C7" style={{ marginLeft: 6 }} />
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={[styles.routeAddressText, { marginTop: 3 }]}>{selectedDrive.deliveryAddress}</Text>
                                        )}
                                        <Text style={styles.routeTimeText}>Aikataulu: {selectedDrive.deliveryScheduled}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 4. 👤 ASIAKASTIEDOT (VAIN KESKEN OLEVAT KEIKAT) */}
                            {!isCompletedDrive && (
                                <View style={styles.detailSection}>
                                    <TouchableOpacity
                                        style={styles.accordionHeader}
                                        onPress={() => {
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setIsCustomerInfoExpanded(prev => !prev);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.accordionTitleRow}>
                                            <View style={[styles.accordionIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                                <Feather name="user" size={16} color="#0284C7" />
                                            </View>
                                            <Text style={styles.accordionTitle}>Asiakastiedot</Text>
                                        </View>
                                        <Feather
                                            name={isCustomerInfoExpanded ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>

                                    {isCustomerInfoExpanded && (
                                        <View style={styles.accordionContent}>
                                            <View style={styles.infoRowBetween}>
                                                <View>
                                                    <Text style={styles.infoLabel}>Asiakkaan nimi</Text>
                                                    <Text style={styles.infoValueBold}>{selectedDrive.customerName || 'Asiakas'}</Text>
                                                </View>
                                                {selectedDrive.customerPhone && (
                                                    <TouchableOpacity
                                                        style={styles.phoneActionBtn}
                                                        onPress={() => Linking.openURL(`tel:${selectedDrive.customerPhone}`)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="phone-call" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                                                        <Text style={styles.phoneActionBtnText}>Soita asiakkaalle</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* ASIAKKAAN LISÄOHJEET JA OVIKOODI */}
                                            {selectedDrive.notes ? (
                                                <View style={styles.extraBox}>
                                                    <Text style={styles.extraBoxLabel}>Asiakkaan lisäohjeet / Ovikoodi</Text>
                                                    <Text style={styles.extraBoxValue}>{selectedDrive.notes}</Text>
                                                </View>
                                            ) : null}

                                            {/* 🛡️ 5-NUMEROINEN NOUTOKOODI OVELLA (TURVAVARMISTUS) */}
                                            <View style={styles.bagCodeSection}>
                                                <View style={styles.bagCodeHeader}>
                                                    <View style={styles.bagCodeIconCircle}>
                                                        <Feather name="shield" size={16} color="#0284C7" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.bagCodeTitle}>Noutokoodi ovella</Text>
                                                        <Text style={styles.bagCodeDesc}>Kerro koodi asiakkaalle, jos hän pyytää varmistusta</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.bagCodeBadgeRow}>
                                                    <Text style={styles.bagCodeHighlight}>{selectedDrive.pickupPin}</Text>
                                                    <TouchableOpacity
                                                        style={styles.bagCodeCopyBtn}
                                                        onPress={() => {
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                                            Alert.alert('Kopioitu', `Noutokoodi ${selectedDrive.pickupPin} kopioitu leikepöydälle.`);
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="copy" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                                                        <Text style={styles.bagCodeCopyText}>Kopioi</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {selectedDrive.pickupWeightKg ? (
                                                <View style={styles.extraBox}>
                                                    <Text style={styles.extraBoxLabel}>Punnittu säkin paino</Text>
                                                    <Text style={styles.extraBoxValue}>{selectedDrive.pickupWeightKg} kg</Text>
                                                </View>
                                            ) : null}

                                            {/* OTETUT TUOTEKUVAT */}
                                            {selectedDrive.pickupPhotos && selectedDrive.pickupPhotos.length > 0 ? (
                                                <View style={styles.extraBox}>
                                                    <Text style={styles.extraBoxLabel}>Noudossa otetut tuotekuvat ({selectedDrive.pickupPhotos.length} kpl)</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                                        {selectedDrive.pickupPhotos.map((photoUri, idx) => (
                                                            <Image
                                                                key={idx}
                                                                source={{ uri: photoUri }}
                                                                style={styles.detailThumbnail}
                                                            />
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            ) : null}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* 5. 🧺 PESULAN TIEDOT (VAIN KESKEN OLEVAT KEIKAT) */}
                            {!isCompletedDrive && (
                                <View style={styles.detailSection}>
                                    <TouchableOpacity
                                        style={styles.accordionHeader}
                                        onPress={() => {
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setIsLaundryInfoExpanded(prev => !prev);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.accordionTitleRow}>
                                            <View style={[styles.accordionIconCircle, { backgroundColor: '#F0FDF4' }]}>
                                                <Feather name="home" size={16} color="#10B981" />
                                            </View>
                                            <Text style={styles.accordionTitle}>Pesulan tiedot</Text>
                                        </View>
                                        <Feather
                                            name={isLaundryInfoExpanded ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>

                                    {isLaundryInfoExpanded && (
                                        <View style={styles.accordionContent}>
                                            <View style={styles.infoRowBetween}>
                                                <View style={{ flex: 1, marginRight: 10 }}>
                                                    <Text style={styles.infoLabel}>Pesulan nimi</Text>
                                                    <Text style={styles.infoValueBold}>{selectedDrive.laundryName || '24Pesula Entresse'}</Text>
                                                </View>
                                                {selectedDrive.laundryPhone && (
                                                    <TouchableOpacity
                                                        style={styles.phoneActionBtn}
                                                        onPress={() => Linking.openURL(`tel:${selectedDrive.laundryPhone}`)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="phone-call" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                                                        <Text style={styles.phoneActionBtnText}>Soita pesulaan</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* 🏷️ PYYKKIPUSSIN KOODI */}
                                            <View style={styles.bagCodeSection}>
                                                <View style={styles.bagCodeHeader}>
                                                    <View style={styles.bagCodeIconCircle}>
                                                        <Feather name="tag" size={16} color="#0284C7" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.bagCodeTitle}>Pyykkipussin koodi</Text>
                                                        <Text style={styles.bagCodeDesc}>Merkitse säkkiin / näytä pesulassa luovutettaessa</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.bagCodeBadgeRow}>
                                                    <Text style={styles.bagCodeHighlight}>{selectedDrive.accessCode || 'XEOUIS'}</Text>
                                                    <TouchableOpacity
                                                        style={styles.bagCodeCopyBtn}
                                                        onPress={() => {
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                                            Alert.alert('Kopioitu', `Pyykkipussin koodi ${selectedDrive.accessCode || 'XEOUIS'} kopioitu leikepöydälle.`);
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="copy" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                                                        <Text style={styles.bagCodeCopyText}>Kopioi</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* 6. PALKKIOERITTELY */}
                            <View style={styles.payoutDetailCard}>
                                <View style={styles.payoutRow}>
                                    <Text style={styles.payoutLabel}>Keikkapalkkio</Text>
                                    <Text style={styles.payoutVal}>{selectedDrive.payout} €</Text>
                                </View>
                                <View style={styles.payoutDivider} />
                                <View style={styles.payoutRow}>
                                    <Text style={styles.payoutTotalLabel}>Yhteensä maksettava</Text>
                                    <Text style={styles.payoutTotalVal}>{selectedDrive.payout} €</Text>
                                </View>
                            </View>

                            {/* 7. TOIMINTOPAINIKE (STATUS TRANSITION) */}
                            <View style={[styles.modalActionWrapper, { marginBottom: 30 }]}>
                                {selectedDrive.status === 'completed' ? (
                                    <View style={styles.completedBadgeBox}>
                                        <Feather name="check-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
                                        <Text style={styles.completedBadgeBoxText}>Keikka suoritettu onnistuneesti 🎉</Text>
                                    </View>
                                ) : selectedDrive.taskType === 'pickup' ? (
                                    // --- NOUTOKEIKAN TILAPAINIKKEET ---
                                    selectedDrive.status === 'assigned' || selectedDrive.status === 'pending' ? (
                                        <TouchableOpacity
                                            style={styles.modalPrimaryBtn}
                                            onPress={() => handleStartDrive(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.modalPrimaryBtnText}>Aloita nouto</Text>
                                        </TouchableOpacity>
                                    ) : selectedDrive.status === 'picking_up' || selectedDrive.status === 'in_progress' ? (
                                        <TouchableOpacity
                                            style={styles.modalPrimaryBtn}
                                            onPress={() => handleMarkArrived(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="map-pin" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.modalPrimaryBtnText}>Olen saapunut noutoon</Text>
                                        </TouchableOpacity>
                                    ) : selectedDrive.status === 'arrived_pickup' ? (
                                        <TouchableOpacity
                                            style={styles.modalSuccessBtn}
                                            onPress={() => handleOpenPickupVerification(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather
                                                name={selectedDrive.verificationType === 'photo' ? "camera" : "box"}
                                                size={18}
                                                color="#FFFFFF"
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={styles.modalPrimaryBtnText}>
                                                {selectedDrive.verificationType === 'photo'
                                                    ? 'Ota tuotekuvat & Kuljeta pesulaan'
                                                    : selectedDrive.verificationType === 'both'
                                                    ? 'Punnitse, Kuvaa & Kuljeta pesulaan'
                                                    : 'Punnitse pyykki & Kuljeta pesulaan'}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : selectedDrive.status === 'in_transit_to_laundry' ? (
                                        <TouchableOpacity
                                            style={styles.modalSuccessBtn}
                                            onPress={() => handleDeliveredToLaundry(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.modalPrimaryBtnText}>Luovutettu pesulalle (Valmis)</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.completedBadgeBox}>
                                            <Feather name="check-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
                                            <Text style={styles.completedBadgeBoxText}>Noutokeikka suoritettu onnistuneesti</Text>
                                        </View>
                                    )
                                ) : (
                                    // --- PALAUTUSKEIKAN TILAPAINIKKEET ---
                                    selectedDrive.status === 'assigned' || selectedDrive.status === 'pending' ? (
                                        !selectedDrive.isLaundryReady ? (
                                            <View style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1.5, borderRadius: 14, padding: 16, alignItems: 'center', width: '100%' }}>
                                                <MaterialCommunityIcons name="washing-machine" size={28} color="#7C3AED" style={{ marginBottom: 6 }} />
                                                <Text style={{ color: '#5B21B6', fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>
                                                    Pyykit ovat vielä pesulassa käsittelyssä
                                                </Text>
                                                <Text style={{ color: '#6D28D9', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 }}>
                                                    Palautuksen voi aloittaa heti, kun pesula on pessyt pyykit ja kuitannut ne valmiiksi noudettavaksi.
                                                </Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.modalPrimaryBtn}
                                                onPress={() => handleStartDrive(selectedDrive)}
                                                activeOpacity={0.85}
                                            >
                                                <Feather name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.modalPrimaryBtnText}>Aloita palautus</Text>
                                            </TouchableOpacity>
                                        )
                                    ) : selectedDrive.status === 'in_progress' || selectedDrive.status === 'returning' ? (
                                        <TouchableOpacity
                                            style={styles.modalPrimaryBtn}
                                            onPress={() => handleMarkArrived(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="map-pin" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.modalPrimaryBtnText}>Olen saapunut asiakkaalle</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.modalSuccessBtn}
                                            onPress={() => handleCompleteDelivery(selectedDrive)}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.modalPrimaryBtnText}>Kuittaa toimitus suoritetuksi</Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>
                        </ScrollView>

                        {/* 🌟 NOUDON TARKISTUS (PUNNITUS & VALOKUVAUS) OVERLAY (KEYBOARD SAFE) 🌟 */}
                        {weightModalVisible && (
                            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                <View style={styles.inlineModalOverlay}>
                                    <KeyboardAvoidingView
                                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                        style={styles.keyboardAvoidingModalWrapper}
                                    >
                                        <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                                            <View style={styles.modalCard}>
                                                {/* IKONI JA OTSIKKO */}
                                                <View style={styles.modalIconCircle}>
                                                    <Feather
                                                        name={selectedDriveVerificationType === 'photo' ? "camera" : "box"}
                                                        size={28}
                                                        color="#0284C7"
                                                    />
                                                </View>
                                                <Text style={styles.modalTitle}>
                                                    {selectedDriveVerificationType === 'photo'
                                                        ? 'Ota tuotekuvat'
                                                        : selectedDriveVerificationType === 'both'
                                                        ? 'Punnitus & Valokuvaus'
                                                        : 'Syötä pyykin paino'}
                                                </Text>
                                                <Text style={styles.modalDesc}>
                                                    {selectedDriveVerificationType === 'photo'
                                                        ? 'Ota selkeät kuvat tuotteista (esim. maton kunto) ennen pesulaan kuljetusta.'
                                                        : selectedDriveVerificationType === 'both'
                                                        ? 'Ota tuotekuvat ja punnitse pyykkisäkki.'
                                                        : 'Punnitse pyykkisäkki (max 50 kg, 1 desimaali).'}
                                                </Text>

                                                {/* VALOKUVAUS-OSIO (JOS PHOTO TAI BOTH) */}
                                                {(selectedDriveVerificationType === 'photo' || selectedDriveVerificationType === 'both') && (
                                                    <View style={styles.photoSectionWrapper}>
                                                        <Text style={styles.inputSectionLabel}>
                                                            Tuotekuvat ({pickupPhotos.length} kpl)
                                                        </Text>
                                                        <View style={styles.photoActionRow}>
                                                            <TouchableOpacity
                                                                style={styles.photoActionBtn}
                                                                onPress={handleTakePhoto}
                                                                activeOpacity={0.75}
                                                            >
                                                                <Feather name="camera" size={16} color="#0284C7" />
                                                                <Text style={styles.photoActionBtnText}>Ota kuva</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.photoActionBtn}
                                                                onPress={handlePickGallery}
                                                                activeOpacity={0.75}
                                                            >
                                                                <Feather name="image" size={16} color="#0284C7" />
                                                                <Text style={styles.photoActionBtnText}>Galleriasta</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        {/* KUVAGRIIDI */}
                                                        {pickupPhotos.length > 0 ? (
                                                            <View style={styles.photosGrid}>
                                                                {pickupPhotos.map((uri, idx) => (
                                                                    <View key={idx} style={styles.photoThumbWrapper}>
                                                                        <Image source={{ uri }} style={styles.photoThumb} />
                                                                        <TouchableOpacity
                                                                            style={styles.photoDeleteBtn}
                                                                            onPress={() => handleRemovePhoto(idx)}
                                                                            activeOpacity={0.75}
                                                                        >
                                                                            <Feather name="x" size={12} color="#FFFFFF" />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        ) : (
                                                            <View style={styles.noPhotosBox}>
                                                                <Feather name="info" size={13} color="#64748B" style={{ marginRight: 4 }} />
                                                                <Text style={styles.noPhotosText}>Ota vähintään 1 kuva tuotteesta</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}

                                                {/* PUNNITUS-OSIO (JOS WEIGHT TAI BOTH) */}
                                                {(selectedDriveVerificationType === 'weight' || selectedDriveVerificationType === 'both') && (
                                                    <View style={styles.weightSectionWrapper}>
                                                        <Text style={styles.inputSectionLabel}>Pyykin paino</Text>
                                                        <View style={styles.weightInputBox}>
                                                            <TextInput
                                                                style={styles.weightInput}
                                                                value={weightInput}
                                                                onChangeText={handleWeightChange}
                                                                keyboardType="decimal-pad"
                                                                returnKeyType="done"
                                                                onSubmitEditing={Keyboard.dismiss}
                                                                selectTextOnFocus
                                                                maxLength={4}
                                                            />
                                                            <Text style={styles.kgUnit}>kg</Text>
                                                        </View>

                                                        {/* Pikavalintanapit */}
                                                        <View style={styles.quickWeightRow}>
                                                            {['3.5', '5.0', '7.5', '10.0'].map(val => (
                                                                <TouchableOpacity
                                                                    key={val}
                                                                    style={[styles.quickWeightBtn, weightInput === val && styles.quickWeightBtnActive]}
                                                                    onPress={() => {
                                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                                                        setWeightInput(val);
                                                                    }}
                                                                >
                                                                    <Text style={[styles.quickWeightBtnText, weightInput === val && styles.quickWeightBtnTextActive]}>
                                                                        {val} kg
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>
                                                )}

                                                <View style={styles.modalButtonsRow}>
                                                    <TouchableOpacity
                                                        style={styles.modalCancelBtn}
                                                        onPress={() => {
                                                            Keyboard.dismiss();
                                                            setWeightModalVisible(false);
                                                        }}
                                                        disabled={isSubmittingWeight}
                                                    >
                                                        <Text style={styles.modalCancelBtnText}>Peruuta</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.modalConfirmBtn}
                                                        onPress={handleConfirmPickupVerification}
                                                        disabled={isSubmittingWeight}
                                                    >
                                                        {isSubmittingWeight ? (
                                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                                        ) : (
                                                            <Text style={styles.modalConfirmBtnText}>Kuittaa nouto</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </TouchableWithoutFeedback>
                                    </KeyboardAvoidingView>
                                </View>
                            </TouchableWithoutFeedback>
                        )}
                    </SafeAreaView>
                )}
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
    },
    tabButtonActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#0284C7',
    },
    tabLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#0284C7',
        fontWeight: '800',
    },
    tabBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 6,
    },
    tabBadgeActive: {
        backgroundColor: '#E0F2FE',
    },
    tabBadgeLive: {
        backgroundColor: '#00C2FF',
    },
    tabBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    tabBadgeTextActive: {
        color: '#0284C7',
    },
    tabBadgeTextLive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    pagerScrollView: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        flexWrap: 'wrap',
        gap: 6,
        marginRight: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    activeLivePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    activeLivePillText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    payoutBadge: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
    payoutValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
    },
    routeContainer: {
        marginBottom: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dotPickup: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#0284C7',
        marginRight: 12,
        marginTop: 4,
    },
    dotDelivery: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        marginRight: 12,
        marginTop: 4,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    addressText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
        marginTop: 1,
    },
    timeHighlightBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    timeHighlightText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0369A1',
    },
    dottedLineContainer: {
        marginLeft: 4,
        height: 16,
        justifyContent: 'center',
    },
    dottedLine: {
        width: 2,
        height: '100%',
        backgroundColor: '#E2E8F0',
    },
    weightBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        marginBottom: 8,
    },
    weightBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284C7',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 10,
        marginTop: 4,
    },
    cardFooterText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284C7',
    },
    emptyPageContent: {
        flexGrow: 1,
    },
    fullEmptyContainer: {
        flex: 1,
        width: '100%',
        minHeight: SCREEN_HEIGHT - 200,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    bubble: {
        position: 'absolute',
        borderRadius: 999,
    },
    bubble1: {
        width: SCREEN_WIDTH * 0.6,
        height: SCREEN_WIDTH * 0.6,
        backgroundColor: 'rgba(56, 189, 248, 0.07)',
        top: -SCREEN_WIDTH * 0.15,
        right: -SCREEN_WIDTH * 0.15,
    },
    bubble2: {
        width: SCREEN_WIDTH * 0.45,
        height: SCREEN_WIDTH * 0.45,
        backgroundColor: 'rgba(2, 132, 199, 0.04)',
        bottom: 20,
        left: -SCREEN_WIDTH * 0.15,
    },
    bubble3: {
        width: 75,
        height: 75,
        backgroundColor: 'rgba(0, 194, 255, 0.08)',
        top: 60,
        left: 20,
    },
    bubble4: {
        width: 45,
        height: 45,
        backgroundColor: 'rgba(14, 165, 233, 0.07)',
        bottom: 100,
        right: 25,
    },
    bubble5: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(186, 230, 253, 0.18)',
        top: '35%',
        right: -30,
    },
    imageWrapper: {
        marginBottom: 20,
        zIndex: 2,
    },
    imageGlowCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 6,
    },
    emptyCarImage: {
        width: 105,
        height: 105,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
        letterSpacing: -0.4,
        textAlign: 'center',
        zIndex: 2,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        maxWidth: 280,
        zIndex: 2,
    },
    findGigsBtnWrapper: {
        width: '100%',
        maxWidth: 240,
        borderRadius: 18,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 2,
    },
    findGigsBtnGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 18,
    },
    findGigsBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 15,
        letterSpacing: 0.2,
    },

    // 🌟 MODALIN TYYLIT 🌟
    modalSheetContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalCloseBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeaderTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalHeaderSubtitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
    },
    modalStatusPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    modalStatusPillText: {
        fontSize: 12,
        fontWeight: '800',
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    modalMapContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
        backgroundColor: '#F8FAFC',
    },
    modalMap: {
        width: '100%',
        height: 160,
    },
    modalMapStats: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingVertical: 10,
    },
    modalMapStatCol: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#F1F5F9',
    },
    modalStatLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
    },
    modalStatValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    modalStatValueHighlight: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0284C7',
        marginTop: 2,
    },
    detailSection: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 14,
    },
    routeItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    routeItemDotPickup: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#0284C7',
        marginRight: 12,
        marginTop: 4,
    },
    routeItemDotDelivery: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        marginRight: 12,
        marginTop: 4,
    },
    routeItemLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    routeItemName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    routeAddressBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    routeAddressText: {
        fontSize: 13,
        color: '#0284C7',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    routeTimeText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 4,
    },
    routeSeparator: {
        height: 16,
        marginLeft: 5,
        borderLeftWidth: 2,
        borderLeftColor: '#CBD5E1',
        marginVertical: 4,
    },

    // 🏷️ Pyykkipussin noutokoodi kortti
    bagCodeSection: {
        backgroundColor: '#F0F9FF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#BAE6FD',
    },
    bagCodeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    bagCodeIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    bagCodeTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0284C7',
    },
    bagCodeDesc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    bagCodeBadgeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    bagCodeHighlight: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0284C7',
        letterSpacing: 3,
    },
    bagCodeCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    bagCodeCopyText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7',
    },

    // 🌟 ACCORDION (AVATTAVAT OSIOT) 🌟
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    accordionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    accordionIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accordionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    accordionContent: {
        paddingTop: 2,
    },

    infoRowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    infoValueBold: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    phoneActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
    },
    phoneActionBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0284C7',
    },
    extraBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    extraBoxLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 3,
    },
    extraBoxValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    pickupPinDriverBox: {
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    pickupPinDriverHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pickupPinDriverIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    pickupPinDriverTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    pickupPinDriverSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    pickupPinDriverPill: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginLeft: 8,
    },
    pickupPinDriverValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1.5,
    },
    payoutDetailCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    payoutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    payoutLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    payoutVal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    payoutDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 10,
    },
    payoutTotalLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    payoutTotalVal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0284C7',
    },
    modalActionWrapper: {
        marginBottom: 16,
    },
    completedBadgeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    completedBadgeBoxText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#10B981',
    },
    modalPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    modalSuccessBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    modalPrimaryBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    quickActionCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // 🌟 PUNNITUSMODAL 🌟
    inlineModalOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 999,
        elevation: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    modalIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    modalDesc: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    weightInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderWidth: 1.5,
        borderColor: '#BAE6FD',
        marginBottom: 24,
        width: '60%',
    },
    weightInput: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0284C7',
        textAlign: 'center',
        padding: 0,
        minWidth: 60,
    },
    kgUnit: {
        fontSize: 18,
        fontWeight: '800',
        color: '#64748B',
        marginLeft: 8,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9',
        paddingVertical: 14,
        borderRadius: 14,
    },
    modalCancelBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    modalConfirmBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 14,
        borderRadius: 14,
    },
    modalConfirmBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    keyboardAvoidingModalWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickWeightRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
        justifyContent: 'center',
    },
    quickWeightBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    quickWeightBtnActive: {
        backgroundColor: '#E0F2FE',
        borderColor: '#0284C7',
    },
    quickWeightBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    quickWeightBtnTextActive: {
        color: '#0284C7',
        fontWeight: '800',
    },

    // 🌟 VALOKUVAUS- JA TARKISTUSTYYLIT 🌟
    photoSectionWrapper: {
        width: '100%',
        marginBottom: 16,
    },
    weightSectionWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    inputSectionLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    photoActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    photoActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F9FF',
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        gap: 6,
    },
    photoActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284C7',
    },
    photosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    photoThumbWrapper: {
        position: 'relative',
        width: 64,
        height: 64,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    photoThumb: {
        width: '100%',
        height: '100%',
    },
    photoDeleteBtn: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noPhotosBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    noPhotosText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    detailThumbnail: {
        width: 68,
        height: 68,
        borderRadius: 12,
        marginRight: 8,
        backgroundColor: '#F1F5F9',
    },
    completedPaginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 10,
        marginBottom: 26,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    pageNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    pageNavBtnDisabled: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        opacity: 0.5,
    },
    pageNavBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284C7',
    },
    pageNavBtnTextDisabled: {
        color: '#94A3B8',
    },
    pageIndicatorBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageIndicatorText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    pageTotalCountText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#64748B',
        marginTop: 1,
    },
});
