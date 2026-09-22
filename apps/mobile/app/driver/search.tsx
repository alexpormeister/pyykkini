import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { parseStructuredAddress, formatTimeWindow } from '../../lib/addressUtils';
import { DriverSwipeButton } from '../../components/DriverSwipeButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    datePillBg: '#0284C7',
    tagBg: '#F0F9FF',
    tagText: '#0284C7',
    background: '#FFFFFF',
    darkText: '#0F172A',
    grayText: '#64748B',
    lightGray: '#94A3B8',
    divider: '#F8FAFC',
};

// 📍 SUOMEN KAUPUNKIEN JA ALUEIDEN KOORDINAATISTO KARTALLE JA ETÄISYYSKASKENNALLE
const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
    'Vihti': { latitude: 60.4172, longitude: 24.3211 },
    'Lohja': { latitude: 60.2500, longitude: 24.0667 },
    'Espoo': { latitude: 60.2055, longitude: 24.6559 },
    'Helsinki': { latitude: 60.1699, longitude: 24.9384 },
    'Vantaa': { latitude: 60.2934, longitude: 25.0378 },
    'Kauniainen': { latitude: 60.2096, longitude: 24.7276 },
    'Kirkkonummi': { latitude: 60.1238, longitude: 24.4385 },
    'Sundsberg': { latitude: 60.1550, longitude: 24.5320 },
    'Järvenpää': { latitude: 60.4739, longitude: 25.0894 },
    'Kerava': { latitude: 60.4034, longitude: 25.1050 },
    'Tuusula': { latitude: 60.4031, longitude: 25.0294 },
    'Nurmijärvi': { latitude: 60.4606, longitude: 24.8078 },
    'Siuntio': { latitude: 60.1389, longitude: 24.2278 },
    'Karkkila': { latitude: 60.5333, longitude: 24.2167 },
    'Tampere': { latitude: 61.4978, longitude: 23.7610 },
    'Turku': { latitude: 60.4518, longitude: 22.2666 },
};

/**
 * 📏 HAVERSINE-KAAVA & TIEKERROIN:
 * Laskee maantieteellisen etäisyyden ja arvioidun ajoajan osoitteiden välillä.
 */
function calculateRouteDistanceAndDuration(
    pickupCity: string,
    deliveryCity: string
): { distanceKm: number; durationMin: number } {
    const start = CITY_COORDINATES[pickupCity] || CITY_COORDINATES['Vihti'];
    const end = CITY_COORDINATES[deliveryCity] || CITY_COORDINATES['Lohja'];

    const R = 6371; // Maapallon säde km
    const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
    const dLon = ((end.longitude - start.longitude) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((start.latitude * Math.PI) / 180) *
            Math.cos((end.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directKm = R * c;

    // Tieverkoston kiertokerroin Suomessa (~1.25x linnuntie)
    const roadDistanceKm = Math.max(1, Math.round(directKm * 1.25));

    // Keskinopeus (~55 km/h taajama/maantieyhdistelmä) + 4 min pysähdysvara
    const calculatedMinutes = Math.max(8, Math.round((roadDistanceKm / 55) * 60) + 4);

    return {
        distanceKm: roadDistanceKm,
        durationMin: calculatedMinutes,
    };
}

function calculateArrivalTime(startTimeRange: string, durationMinutes: number): string {
    try {
        const startPart = startTimeRange.split('-')[0].trim();
        const [hStr, mStr] = startPart.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (!isNaN(h) && !isNaN(m)) {
            const totalStartMinutes = h * 60 + m;
            const totalEndMinutes = totalStartMinutes + durationMinutes;
            const endH = Math.floor(totalEndMinutes / 60) % 24;
            const endM = totalEndMinutes % 60;
            const endH2 = Math.floor((totalEndMinutes + 30) / 60) % 24;
            const endM2 = (totalEndMinutes + 30) % 60;
            const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
            return `${pad(endH)}:${pad(endM)} - ${pad(endH2)}:${pad(endM2)}`;
        }
    } catch {}
    return startTimeRange;
}

interface GigItem {
    id: string;
    orderId: string;
    taskType: 'pickup' | 'delivery';
    dateKey: string;
    pickupTime: string;
    pickupStreet: string;
    pickupCity: string;
    deliveryTime: string;
    deliveryStreet: string;
    deliveryCity: string;
    payout: number;
    tier: string;
    distanceKm: number;
    estimatedMinutes: number;
    notes?: string;
    rawTask?: any;
}

export default function DriverSearchScreen() {
    const router = useRouter();
    const [gigs, setGigs] = useState<GigItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [selectedGig, setSelectedGig] = useState<GigItem | null>(null);
    const [isClaiming, setIsClaiming] = useState<boolean>(false);

    const parseAddress = (fullAddress?: string) => {
        if (!fullAddress || fullAddress.trim() === '') {
            return { street: 'Pesuni Pesulakeskus', city: 'Lohja' };
        }
        const clean = fullAddress.trim();
        const parts = clean.split(',').map(p => p.trim()).filter(Boolean);

        if (parts.length >= 2) {
            const street = parts[0];
            const cityPart = parts[1].replace(/^[0-9\s-]+/, '').trim();
            return { street, city: cityPart || parts[1] };
        }

        const knownCities = [
            'Helsinki', 'Espoo', 'Vantaa', 'Lohja', 'Vihti', 'Kauniainen',
            'Kirkkonummi', 'Sundsberg', 'Järvenpää', 'Kerava', 'Tuusula',
            'Nurmijärvi', 'Siuntio', 'Karkkila', 'Tampere', 'Turku', 'Lempäälä'
        ];
        for (const kc of knownCities) {
            if (clean.toLowerCase().includes(kc.toLowerCase())) {
                const street = clean.replace(new RegExp(`\\b${kc}\\b`, 'i'), '').replace(/[0-9]{5}/, '').trim();
                return { street: street || clean, city: kc };
            }
        }

        return { street: clean, city: 'Pääkaupunkiseutu' };
    };

    const formatCleanTime = (tStr?: string, defaultFallback: string = '10:00 - 10:30') => {
        if (!tStr) return defaultFallback;
        return formatTimeWindow(tStr) || defaultFallback;
    };

    const formatDatePill = (dateStr?: string) => {
        if (!dateStr) return 'Tänään';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const days = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
            const dayName = days[date.getDay()];
            const day = date.getDate();
            const month = date.getMonth() + 1;
            return `${dayName} ${day}.${month}.`;
        } catch {
            return dateStr;
        }
    };

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

    // Haetaan vapaat keikat
    const fetchGigs = useCallback(async () => {
        try {
            // Haetaan pesulan oikeat tiedot tietokannasta
            const { data: laundryData } = await supabase
                .from('laundries')
                .select('*')
                .limit(1)
                .maybeSingle();

            const parsedLaundry = parseStructuredAddress(laundryData?.address);
            const laundryName = laundryData?.name || 'Pesuni Pesulakeskus';
            const laundryCity = laundryData?.city || parsedLaundry.city || 'Espoo';

            // 1. Haetaan delivery_tasks yhdessä orders-taulun kanssa (vain pesulan hyväksymät vapaat keikat)
            const { data: taskData, error: taskError } = await supabase
                .from('delivery_tasks')
                .select('*, orders(*)')
                .eq('status', 'unassigned')
                .is('driver_id', null)
                .order('scheduled_date', { ascending: true });

            const validTasks = (taskData || []).filter((t: any) => {
                const ordStatus = (t.orders?.status || '').toLowerCase();
                const laundryStatus = (t.orders?.laundry_status || '').toLowerCase();
                if (ordStatus === 'cancelled' || ordStatus === 'rejected') return false;
                // Keikka tulee kuljettajille jakoon VASTA JA AINOASTAAN kun pesula on hyväksynyt tilauksen
                if (laundryStatus !== 'accepted') return false;
                return true;
            });

            if (!taskError && validTasks.length > 0) {
                const formatted: GigItem[] = validTasks.map((t: any) => {
                    const isPickup = t.task_type === 'pickup';
                    const orderDate = isPickup ? t.orders?.pickup_date : t.orders?.return_date;
                    const dateKey = formatDatePill(t.scheduled_date || orderDate);

                    // Asiakkaan osoite ja kadunnimi
                    const customerRawAddress = isPickup 
                        ? (t.pickup_address || t.orders?.address || t.address) 
                        : (t.delivery_address || t.orders?.address || t.address);
                    const parsedCustomer = parseStructuredAddress(customerRawAddress);
                    const customerStreet = parsedCustomer.streetName || parsedCustomer.streetOnly || 'Asiakasosoite';
                    const customerCity = parsedCustomer.city || 'Espoo';

                    // Lähtö ja määränpää (hyväksyneen pesulan nimi & osoite):
                    const activeLaundryName = isPickup ? (t.destination_name || 'Pesula') : (t.origin_name || 'Pesula');
                    const pStreet = isPickup ? customerStreet : activeLaundryName;
                    const pCity = isPickup ? customerCity : 'Espoo';
                    const dStreet = isPickup ? activeLaundryName : customerStreet;
                    const dCity = isPickup ? 'Espoo' : customerCity;

                    const { distanceKm, durationMin } = calculateRouteDistanceAndDuration(pCity, dCity);
                    const rawId = String(t.order_id || t.id).replace(/[^a-zA-Z0-9]/g, '');
                    const formattedOrderId = `#${rawId.slice(0, 8).toUpperCase()}`;

                    // Asiakkaan valitsema kellonaika
                    const rawTime = isPickup
                        ? (t.scheduled_time || t.orders?.pickup_time || t.orders?.pickup_slot)
                        : (t.scheduled_time || t.orders?.return_time || t.orders?.delivery_slot);
                    const startTimeRaw = formatCleanTime(rawTime, isPickup ? '10:00' : '18:00');
                    const arrivalTimeRaw = calculateArrivalTime(startTimeRaw, durationMin);

                    return {
                        id: String(t.id),
                        orderId: formattedOrderId,
                        taskType: t.task_type,
                        dateKey,
                        pickupTime: `${dateKey} ${startTimeRaw}`,
                        pickupStreet: pStreet,
                        pickupCity: pCity,
                        deliveryTime: `${dateKey} ${arrivalTimeRaw}`,
                        deliveryStreet: dStreet,
                        deliveryCity: dCity,
                        tier: isPickup ? 'Haku' : 'Palautus',
                        distanceKm,
                        estimatedMinutes: durationMin,
                        payout: Number(t.driver_payout) || 19,
                        notes: t.notes || t.orders?.special_instructions,
                        rawTask: t,
                    };
                });

                setGigs(formatted);
                return;
            }

            // Jos ei ole pesulan hyväksymiä vapaita keikkoja, lista on tyhjä
            setGigs([]);
        } catch {
            setGigs([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchGigs();

        const taskChannel = supabase
            .channel('realtime_driver_search_feed_v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tasks' }, () => {
                fetchGigs();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchGigs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, [fetchGigs]);

    // Kuljettaja ottaa keikan
    const handleConfirmClaimGig = async (gig: GigItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setIsClaiming(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            let currentUserId = session?.user?.id;
            if (!currentUserId) {
                const { data: { user } } = await supabase.auth.getUser();
                currentUserId = user?.id;
            }

            if (!currentUserId) {
                Alert.alert('Kirjaudu sisään', 'Kirjaudu sisään ottaaksesi keikan.');
                setIsClaiming(false);
                return;
            }

            const rawId = gig.id;
            const orderId = gig.rawTask?.order_id || (gig.rawTask?.id ? String(gig.rawTask.id) : gig.id);
            const isPickupTask = gig.taskType === 'pickup';
            const nowIso = new Date().toISOString();

            // 1. Kokeillaan ensin RPC-funktiota
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('driver_claim_task', {
                p_task_id: rawId,
            });

            if (!rpcErr && rpcRes && rpcRes.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setSelectedGig(null);
                Alert.alert('Keikka vastaanotettu! 🎉', 'Keikka on nyt sinulla ja löytyy Omat ajot -sivulta.');
                await fetchGigs();
                return;
            }

            // 2. Päivitetään VAIN JA AINOASTAAN tämä yksi kyseinen task (id = rawId)
            const { data: updatedTasks, error: taskUpdateErr } = await supabase
                .from('delivery_tasks')
                .update({ driver_id: currentUserId, status: 'assigned', updated_at: nowIso })
                .eq('id', rawId)
                .select();

            // 3. Päivitetään orders vain jos kyseessä on noutokeikka
            if (isPickupTask && orderId) {
                await supabase
                    .from('orders')
                    .update({ driver_id: currentUserId, updated_at: nowIso })
                    .eq('id', orderId);
            }

            if (taskUpdateErr) {
                throw new Error(taskUpdateErr?.message || 'Keikan tallentaminen tietokantaan epäonnistui.');
            }

            // Jos delivery_tasks -riviä ei ollut vielä olemassa tälle tilaukselle, luodaan se
            if (!updatedTasks || updatedTasks.length === 0) {
                await supabase.from('delivery_tasks').insert({
                    order_id: orderId,
                    driver_id: currentUserId,
                    task_type: gig.taskType || 'pickup',
                    status: 'assigned',
                    pickup_address: gig.pickupStreet + (gig.pickupCity ? `, ${gig.pickupCity}` : ''),
                    delivery_address: gig.deliveryStreet + (gig.deliveryCity ? `, ${gig.deliveryCity}` : ''),
                    scheduled_date: gig.rawTask?.pickup_date || gig.rawTask?.scheduled_date || nowIso.split('T')[0],
                    scheduled_time: gig.rawTask?.pickup_time || gig.rawTask?.scheduled_time || '10:00',
                    driver_payout: gig.payout || 19,
                });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setSelectedGig(null);
            Alert.alert(
                'Keikka vastaanotettu! 🎉',
                'Keikka on nyt sinulla ja löytyy Omat ajot -sivulta.',
                [
                    {
                        text: 'Siirry Omat ajot -sivulle',
                        onPress: () => router.navigate('/driver' as any),
                    },
                    {
                        text: 'Jatka etsimistä',
                        style: 'cancel',
                    },
                ]
            );
            await fetchGigs();
        } catch (err: any) {
            console.error('[CLAIM_GIG] ERROR:', err);
            Alert.alert('Virhe', err?.message || 'Keikan ottaminen epäonnistui.');
        } finally {
            setIsClaiming(false);
        }
    };

    const renderGigRow = (item: GigItem, index: number, allItems: GigItem[]) => {
        const isFirstOfDate = index === 0 || allItems[index - 1].dateKey !== item.dateKey;

        return (
            <View key={item.id}>
                {isFirstOfDate && (
                    <View style={styles.datePillWrapper}>
                        <View style={styles.datePill}>
                            <Text style={styles.datePillText}>{item.dateKey}</Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.gigCard}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setSelectedGig(item);
                    }}
                    activeOpacity={0.7}
                >
                    {/* RIVI 1: AJAT */}
                    <View style={styles.rowBetween}>
                        <Text style={styles.timeText}>{item.pickupTime}</Text>
                        <Text style={[styles.timeText, styles.textRight]}>{item.deliveryTime}</Text>
                    </View>

                    {/* RIVI 2: KADUT */}
                    <View style={[styles.rowBetween, { marginTop: 4 }]}>
                        <Text style={styles.streetText}>{item.pickupStreet}</Text>
                        <Text style={[styles.streetText, styles.textRight]}>{item.deliveryStreet}</Text>
                    </View>

                    {/* RIVI 3: KAUPUNGIT */}
                    <View style={[styles.rowBetween, { marginTop: 2 }]}>
                        <Text style={styles.cityText}>{item.pickupCity}</Text>
                        <Text style={[styles.cityText, styles.textRight]}>{item.deliveryCity}</Text>
                    </View>

                    {/* RIVI 4: TAGIT & HINTA */}
                    <View style={[styles.rowBetween, { marginTop: 10, alignItems: 'center' }]}>
                        <View style={styles.tagsContainer}>
                            {/* HAKU VAI PALAUTUS PILLERI */}
                            <View style={[
                                styles.pillTag,
                                item.taskType === 'delivery' ? styles.deliveryPillTag : styles.pickupPillTag
                            ]}>
                                <Text style={[
                                    styles.pillTagText,
                                    item.taskType === 'delivery' ? styles.deliveryPillText : styles.pickupPillText
                                ]}>
                                    {item.taskType === 'delivery' ? 'Palautus' : 'Haku'}
                                </Text>
                            </View>
                            <View style={styles.pillTag}>
                                <Text style={styles.pillTagText}>{item.distanceKm} km</Text>
                            </View>
                        </View>
                        <Text style={styles.payoutText}>{item.payout} €</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.itemDivider} />
            </View>
        );
    };

    // Kartan koordinaatit valitulle keikalle
    const startCoord = selectedGig
        ? CITY_COORDINATES[selectedGig.pickupCity] || { latitude: 60.4172, longitude: 24.3211 }
        : { latitude: 60.4172, longitude: 24.3211 };

    const endCoord = selectedGig
        ? CITY_COORDINATES[selectedGig.deliveryCity] || { latitude: 60.2500, longitude: 24.0667 }
        : { latitude: 60.2500, longitude: 24.0667 };

    const mapCenter = {
        latitude: (startCoord.latitude + endCoord.latitude) / 2,
        longitude: (startCoord.longitude + endCoord.longitude) / 2,
        latitudeDelta: Math.max(0.25, Math.abs(startCoord.latitude - endCoord.latitude) * 1.8),
        longitudeDelta: Math.max(0.35, Math.abs(startCoord.longitude - endCoord.longitude) * 1.8),
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerCircleBtn}
                    onPress={() => router.push('/driver/profile')}
                    activeOpacity={0.7}
                >
                    <Feather name="user" size={20} color="#0284C7" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    ({gigs.length}) Vapaat keikat
                </Text>

                <TouchableOpacity
                    style={styles.headerCircleBtn}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        Alert.alert('Suodata keikkoja', 'Voit rajata keikkoja toimialueittain profiilista.');
                    }}
                    activeOpacity={0.7}
                >
                    <Feather name="filter" size={18} color="#0284C7" />
                    <View style={styles.filterNotificationDot} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primaryDark} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    alwaysBounceVertical={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setRefreshing(true);
                                fetchGigs();
                            }}
                            tintColor={COLORS.primaryDark}
                            colors={[COLORS.primaryDark]}
                            progressBackgroundColor="#FFFFFF"
                        />
                    }
                >
                    {gigs.length > 0 ? (
                        gigs.map((item, idx) => renderGigRow(item, idx, gigs))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <LinearGradient
                                colors={['#BAE6FD', '#E0F2FE', '#F8FAFC']}
                                style={styles.emptyCircle}
                            >
                                <Feather name="check-circle" size={36} color="#0284C7" />
                            </LinearGradient>
                            <Text style={styles.emptyTitle}>Ei vapaita keikkoja</Text>
                            <Text style={styles.emptySubtitle}>
                                Uudet keikat ilmestyvät heti, kun pesula hyväksyy tilauksen.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* 🌟 🌟 🌟 INTERAKTIIVINEN KARTTAMODAL 🌟 🌟 🌟 */}
            <Modal
                visible={selectedGig !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedGig(null)}
            >
                {selectedGig && (
                    <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
                        {/* 1. MODAL YLÄPALKKI */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalDragHandle} />
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalRouteTitle}>
                                    {selectedGig.pickupCity} → {selectedGig.deliveryCity}
                                </Text>
                                <TouchableOpacity
                                    style={styles.modalCloseCircle}
                                    onPress={() => setSelectedGig(null)}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="x" size={18} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* 2. 🗺️ TOIMIVA INTERAKTIIVINEN KARTTA (REACT-NATIVE-MAPS) 🗺️ */}
                            <View style={styles.mapCard}>
                                <MapView
                                    style={styles.mapView}
                                    initialRegion={mapCenter}
                                    showsCompass={false}
                                    showsUserLocation={false}
                                    scrollEnabled={true}
                                    zoomEnabled={true}
                                >
                                    {/* Lähtöpisteen merkki */}
                                    <Marker
                                        coordinate={startCoord}
                                        title={`Lähtö: ${selectedGig.pickupCity}`}
                                        description={selectedGig.pickupStreet}
                                        pinColor="#0284C7"
                                    />

                                    {/* Määränpään merkki */}
                                    <Marker
                                        coordinate={endCoord}
                                        title={`Määränpää: ${selectedGig.deliveryCity}`}
                                        description={selectedGig.deliveryStreet}
                                        pinColor="#10B981"
                                    />

                                    {/* Reittiviiva kohteiden välillä */}
                                    <Polyline
                                        coordinates={[startCoord, endCoord]}
                                        strokeColor="#0284C7"
                                        strokeWidth={4}
                                        lineDashPattern={[0]}
                                    />
                                </MapView>

                                {/* 3. STAT-PALKKI KARTAN ALLA */}
                                <View style={styles.mapStatsRow}>
                                    <View style={styles.mapStatCol}>
                                        <Text style={styles.mapStatLabel}>Arvioitu kesto</Text>
                                        <Text style={styles.mapStatValue}>~ {selectedGig.estimatedMinutes} min</Text>
                                    </View>
                                    <View style={styles.mapStatCol}>
                                        <Text style={styles.mapStatLabel}>Ajo</Text>
                                        <Text style={styles.mapStatValue}>{selectedGig.distanceKm} km</Text>
                                    </View>
                                    <View style={[styles.mapStatCol, { borderRightWidth: 0 }]}>
                                        <Text style={styles.mapStatLabel}>Palkkiosi</Text>
                                        <Text style={styles.mapStatValueHighlight}>{selectedGig.payout} €</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 4. SIJAINTI / ETÄISYYS LÄHTÖÖN */}
                            <View style={styles.locationProximityRow}>
                                <View style={styles.timelineDottedTrack}>
                                    <View style={styles.trackDot} />
                                    <View style={styles.trackDot} />
                                    <View style={styles.trackDot} />
                                </View>
                                <View style={{ flex: 1, paddingLeft: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="navigation" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                                        <Text style={styles.proximityDistance}>~ {selectedGig.distanceKm} km</Text>
                                    </View>
                                    <Text style={styles.proximityAddress}>{selectedGig.pickupStreet}, {selectedGig.pickupCity}</Text>
                                </View>
                            </View>

                            {/* 5. REITIN AIKAJANA */}
                            <View style={styles.timelineSection}>
                                <View style={styles.timelineLeftTime}>
                                    <Text style={styles.timelineDateText}>{selectedGig.dateKey}</Text>
                                    <Text style={styles.timelineTimeText}>
                                        {selectedGig.pickupTime.split(' ').slice(1).join(' ') || selectedGig.pickupTime}
                                    </Text>
                                </View>

                                <View style={styles.timelineBarContainer}>
                                    <View style={styles.timelineBarTop} />
                                    <View style={styles.timelineBarMiddle} />
                                </View>

                                <View style={styles.timelineRightContent}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="truck" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                                        <Text style={styles.timelineDepartureHeader}>Lähtö: {selectedGig.pickupTime}</Text>
                                    </View>
                                    <Text style={styles.timelineVehicleDesc}>
                                        {selectedGig.taskType === 'delivery' ? 'Palautuskuljetus pesulalta asiakkaalle' : 'Pyykin nouto asiakkaalta pesulaan'}
                                    </Text>

                                    {/* Lähtökatu klikattava */}
                                    <TouchableOpacity
                                        style={styles.clickableAddressRow}
                                        onPress={() => openNavigation(`${selectedGig.pickupStreet}, ${selectedGig.pickupCity}`)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.clickableAddressText}>
                                            {selectedGig.pickupStreet}, {selectedGig.pickupCity}
                                        </Text>
                                        <Feather name="arrow-up-right" size={15} color="#0284C7" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                    <Text style={styles.travelDurationText}>~ {selectedGig.estimatedMinutes} min, {selectedGig.distanceKm} km</Text>

                                    {/* Määränpääkatu klikattava */}
                                    <TouchableOpacity
                                        style={[styles.clickableAddressRow, { marginTop: 12 }]}
                                        onPress={() => openNavigation(`${selectedGig.deliveryStreet}, ${selectedGig.deliveryCity}`)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.clickableAddressText}>
                                            {selectedGig.deliveryStreet}, {selectedGig.deliveryCity}
                                        </Text>
                                        <Feather name="arrow-up-right" size={15} color="#0284C7" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>

                                    <View style={styles.arrivalBadge}>
                                        <Feather name="flag" size={13} color="#10B981" style={{ marginRight: 6 }} />
                                        <Text style={styles.arrivalBadgeText}>Perillä {selectedGig.deliveryTime}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 6. KEIKAN YHTEENVETO & TIEDOT */}
                            <View style={styles.metaInfoSection}>
                                <View style={styles.rowBetween}>
                                    <View>
                                        <Text style={styles.metaLabel}>Keikka-id</Text>
                                        <Text style={styles.metaValueUnderline}>{selectedGig.orderId}</Text>
                                    </View>
                                    <View style={[
                                        styles.pillTag,
                                        selectedGig.taskType === 'delivery' ? styles.deliveryPillTag : styles.pickupPillTag
                                    ]}>
                                        <Text style={[
                                            styles.pillTagText,
                                            selectedGig.taskType === 'delivery' ? styles.deliveryPillText : styles.pickupPillText
                                        ]}>
                                            {selectedGig.taskType === 'delivery' ? 'Palautuskeikka' : 'Hakukeikka'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.metaLabel}>Tehtävä</Text>
                                    <Text style={styles.metaValueBold}>
                                        {selectedGig.taskType === 'delivery'
                                            ? 'Pyykin toimitus pesulalta asiakkaalle'
                                            : 'Pyykin nouto asiakkaalta pesulaan'}
                                    </Text>
                                </View>

                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.metaLabel}>Asiakkaan osoite</Text>
                                    <Text style={styles.metaValueBold}>
                                        {selectedGig.taskType === 'pickup'
                                            ? `${selectedGig.pickupStreet}, ${selectedGig.pickupCity}`
                                            : `${selectedGig.deliveryStreet}, ${selectedGig.deliveryCity}`}
                                    </Text>
                                </View>
                            </View>

                            {/* 7. PALKKIOERITTELY KORTTI */}
                            <View style={styles.payoutCard}>
                                <View style={styles.payoutCardRow}>
                                    <Text style={styles.payoutCardLabel}>Peruspalkkio</Text>
                                    <Text style={styles.payoutCardValue}>{selectedGig.payout} €</Text>
                                </View>
                                <View style={styles.payoutDivider} />
                                <View style={styles.payoutCardRow}>
                                    <Text style={styles.payoutTotalLabel}>Yhteensä</Text>
                                    <Text style={styles.payoutTotalValue}>{selectedGig.payout} €</Text>
                                </View>
                            </View>

                            {/* 8. SLIDE-TO-ACCEPT / OTA KEIKKA */}
                            <View style={{ marginVertical: 12, alignItems: 'center' }}>
                                <DriverSwipeButton
                                    onSwipeSuccess={() => handleConfirmClaimGig(selectedGig)}
                                    loading={isClaiming}
                                    title="Ota keikka"
                                />
                            </View>

                            {/* 9. PIKATOIMINTONAPIT (4 IKONIA) */}
                            <View style={styles.quickActionsRow}>
                                <TouchableOpacity
                                    style={styles.quickActionCircle}
                                    onPress={() => Alert.alert('Kopioitu', `Keikka-id ${selectedGig.orderId} kopioitu leikepöydälle.`)}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="copy" size={18} color="#0284C7" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickActionCircle}
                                    onPress={() => Alert.alert('Kalenteri', 'Keikka lisätty kalenteriisi.')}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="calendar" size={18} color="#0284C7" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickActionCircle}
                                    onPress={() => Alert.alert('Muistutus', 'Muistutus asetettu 30 min ennen noutoa.')}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="calendar-alert" size={20} color="#0284C7" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickActionCircle}
                                    onPress={() => {
                                        setSelectedGig(null);
                                        router.push('/general/chat');
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="message-square" size={18} color="#0284C7" />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
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
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    headerCircleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
    },
    filterNotificationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        position: 'absolute',
        top: 10,
        right: 10,
    },
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 40,
        flexGrow: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    datePillWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 14,
    },
    datePill: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 36,
        paddingVertical: 10,
        borderRadius: 24,
    },
    datePillText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 15,
        letterSpacing: 0.2,
    },
    gigCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    textRight: {
        textAlign: 'right',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    streetText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    cityText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    tagsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    pillTag: {
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    pillTagText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284C7',
    },
    pickupPillTag: {
        backgroundColor: '#E0F2FE',
    },
    pickupPillText: {
        color: '#0284C7',
    },
    deliveryPillTag: {
        backgroundColor: '#DCFCE7',
    },
    deliveryPillText: {
        color: '#16A34A',
    },
    payoutText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'right',
    },
    itemDivider: {
        height: 1,
        backgroundColor: '#F8FAFC',
        marginHorizontal: 16,
        marginVertical: 6,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 30,
    },
    emptyCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },

    // MODAL
    modalSafeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    modalDragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        marginBottom: 12,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    modalRouteTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0284C7',
    },
    modalCloseCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScrollContent: {
        paddingBottom: 50,
    },
    mapCard: {
        marginHorizontal: 16,
        marginTop: 14,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    mapView: {
        width: '100%',
        height: 200,
    },
    mapStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    mapStatCol: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    mapStatLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 2,
    },
    mapStatValue: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
    },
    mapStatValueHighlight: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0284C7',
    },
    locationProximityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 20,
    },
    timelineDottedTrack: {
        alignItems: 'center',
        gap: 4,
    },
    trackDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#94A3B8',
    },
    proximityDistance: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0284C7',
    },
    proximityAddress: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 1,
    },
    timelineSection: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 18,
    },
    timelineLeftTime: {
        width: 70,
        alignItems: 'flex-start',
    },
    timelineDateText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    timelineTimeText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    timelineBarContainer: {
        width: 6,
        marginHorizontal: 8,
        alignItems: 'center',
    },
    timelineBarTop: {
        width: 4,
        height: 30,
        backgroundColor: '#BAE6FD',
        borderRadius: 2,
    },
    timelineBarMiddle: {
        width: 4,
        flex: 1,
        backgroundColor: '#0284C7',
        borderRadius: 2,
    },
    timelineRightContent: {
        flex: 1,
        paddingLeft: 6,
    },
    timelineDepartureHeader: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    timelineVehicleDesc: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 8,
        marginTop: 2,
    },
    clickableAddressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    clickableAddressText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0284C7',
        textDecorationLine: 'underline',
    },
    travelDurationText: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
    },
    arrivalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 12,
    },
    arrivalBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#10B981',
    },
    metaInfoSection: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    metaLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 2,
    },
    metaValueUnderline: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        textDecorationLine: 'underline',
    },
    payoutCard: {
        backgroundColor: '#F8FAFC',
        marginHorizontal: 20,
        marginTop: 18,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    payoutCardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    payoutCardLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    payoutCardValue: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    payoutDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 10,
    },
    payoutTotalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0284C7',
    },
    payoutTotalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0284C7',
    },
    sliderContainer: {
        paddingHorizontal: 20,
        marginTop: 24,
        alignItems: 'center',
    },
    sliderTrack: {
        width: '100%',
        height: 58,
        borderRadius: 29,
        backgroundColor: '#E0F2FE',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        position: 'relative',
    },
    sliderThumb: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#0284C7',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    sliderTrackText: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '800',
        color: '#0284C7',
    },
    sliderHintText: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 8,
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 24,
    },
    quickActionCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    metaValueBold: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginTop: 2,
    },
});
