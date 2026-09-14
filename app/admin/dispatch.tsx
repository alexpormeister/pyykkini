import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatTimeWindow } from '../../lib/addressUtils';
import { formatPhoneNumberDisplay } from '../../lib/phoneUtils';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DriverUser {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
}

interface OrderItemRow {
    id: string;
    service_name: string;
    product_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    driver_payout?: number;
    laundry_price?: number;
}

interface TaskRow {
    id: string;
    order_id: string;
    task_type: 'pickup' | 'delivery';
    status: string;
    driver_id: string | null;
    driver_payout?: number;
    scheduled_date?: string;
    scheduled_time?: string;
    pickup_address?: string;
    delivery_address?: string;
}

interface FullOrder {
    id: string;
    service_name: string;
    final_price: number | string;
    price?: number | string;
    status: string;
    laundry_status: string;
    tracking_status: string;
    pickup_date: string;
    pickup_time: string;
    return_date: string;
    return_time: string;
    address: string;
    phone: string;
    first_name: string;
    last_name: string;
    special_instructions?: string;
    driver_id: string | null;
    created_at: string;
    tasks: TaskRow[];
    items: OrderItemRow[];
}

// 🌐 PURE HELPER FUNCTIONS
function formatShortDate(isoStr?: any): string {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return String(isoStr);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        return `${day}.${month}.`;
    } catch {
        return String(isoStr || '-');
    }
}

function getDriverDisplayName(driverId: string | null | undefined, driverList?: DriverUser[]): string | null {
    if (!driverId) return null;
    if (!driverList || !Array.isArray(driverList)) return 'Kuljettaja määritetty';
    const found = driverList.find(d => d && d.id === driverId);
    if (!found) return 'Kuljettaja määritetty';
    const name = `${found.first_name || ''} ${found.last_name || ''}`.trim();
    return name || found.email || 'Kuljettaja';
}

// 📌 APUKOMPONENTIT (MÄÄRITELTY ENNEN PÄÄKOMPONENTTIA TDZ-VIRHEIDEN ESTÄMISEKSI)
function StatCard({ label, value, icon, color, bg, highlight }: any) {
    return (
        <View style={[styles.statCard, highlight && { borderColor: color, borderWidth: 1.5 }]}>
            <View style={[styles.statIconCircle, { backgroundColor: bg }]}>
                <Feather name={icon} size={18} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        </View>
    );
}

function FilterTab({ label, active, badgeColor, onPress }: any) {
    return (
        <TouchableOpacity
            style={[styles.filterTab, active && styles.filterTabActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {badgeColor && <View style={[styles.tabBadgeDot, { backgroundColor: badgeColor }]} />}
            <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function StatusPill({ status }: { status: string }) {
    const s = String(status || '').toLowerCase();
    let bg = '#F1F5F9';
    let text = '#64748B';
    let label = status || 'Odottaa';

    if (s === 'unassigned') {
        bg = '#FEF3C7'; text = '#D97706'; label = 'Jaossa';
    } else if (s === 'assigned' || s === 'in_progress') {
        bg = '#E0F2FE'; text = '#0284C7'; label = 'Määrätty';
    } else if (s === 'picking_up' || s === 'accepted') {
        bg = '#EFF6FF'; text = '#2563EB'; label = 'Noudossa';
    } else if (s === 'washing') {
        bg = '#F3E8FF'; text = '#9333EA'; label = 'Pesussa';
    } else if (s === 'returning') {
        bg = '#FEF9C3'; text = '#CA8A04'; label = 'Palautuksessa';
    } else if (s === 'delivered' || s === 'completed') {
        bg = '#DCFCE7'; text = '#16A34A'; label = 'Toimitettu';
    } else if (s === 'cancelled' || s === 'rejected') {
        bg = '#FEE2E2'; text = '#DC2626'; label = 'Peruutettu';
    }

    return (
        <View style={[styles.statusPillBox, { backgroundColor: bg }]}>
            <Text style={[styles.statusPillText, { color: text }]}>{label}</Text>
        </View>
    );
}

export default function AdminDispatchScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [drivers, setDrivers] = useState<DriverUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    // Modals
    const [selectedOrder, setSelectedOrder] = useState<FullOrder | null>(null);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [assignTarget, setAssignTarget] = useState<{ order: FullOrder; taskType: 'pickup' | 'delivery' | 'both' } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 1. Haetaan kuljettajalista
    const fetchDrivers = useCallback(async () => {
        try {
            const { data: roleData, error: rErr } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'driver');

            if (rErr || !roleData || roleData.length === 0) return;

            const driverUserIds = roleData.map(r => r.user_id);
            const { data: profileData } = await supabase
                .from('profiles')
                .select('user_id, first_name, last_name, phone, email')
                .in('user_id', driverUserIds);

            if (profileData) {
                const formatted: DriverUser[] = profileData.map(p => ({
                    id: p.user_id,
                    email: p.email || '',
                    first_name: p.first_name,
                    last_name: p.last_name,
                    phone: p.phone,
                }));
                setDrivers(formatted);
            }
        } catch (e) {
            console.warn('Virhe kuljettajalistan haussa:', e);
        }
    }, []);

    // 2. Haetaan kaikki tilaukset, tehtävät ja tuoterivit
    const fetchAllOrders = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*), delivery_tasks(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted: FullOrder[] = (data || []).map((o: any) => ({
                id: o.id,
                service_name: o.service_name || 'Tekstiilipesu',
                final_price: o.final_price || o.price || 0,
                status: o.status || 'pending',
                laundry_status: o.laundry_status || 'pending',
                tracking_status: o.tracking_status || 'pending',
                pickup_date: o.pickup_date,
                pickup_time: o.pickup_time,
                return_date: o.return_date,
                return_time: o.return_time,
                address: o.address || '',
                phone: o.phone || '',
                first_name: o.first_name || '',
                last_name: o.last_name || '',
                special_instructions: o.special_instructions || '',
                driver_id: o.driver_id || null,
                created_at: o.created_at,
                tasks: (o.delivery_tasks || []) as TaskRow[],
                items: (o.order_items || []) as OrderItemRow[],
            }));

            setOrders(formatted);
        } catch (e: any) {
            console.error('Virhe tilausten haussa:', e?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await Promise.all([fetchAllOrders(), fetchDrivers()]);
        setRefreshing(false);
    }, [fetchAllOrders, fetchDrivers]);

    useEffect(() => {
        fetchAllOrders();
        fetchDrivers();

        // Realtime tilaukset & tehtävät
        const channel = supabase
            .channel('admin_dispatch_live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchAllOrders();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tasks' }, () => {
                fetchAllOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAllOrders, fetchDrivers]);

    // Kopioi ID
    const copyToClipboard = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            setCopiedId(text);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            setCopiedId(text);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    // Avaa puhelu
    const callCustomer = (phone?: string) => {
        if (!phone) return;
        const cleanDigits = String(phone).replace(/\s+/g, '');
        Linking.openURL(`tel:${cleanDigits}`).catch(() => {});
    };

    // Avaa kartta
    const openMap = (address?: string) => {
        if (!address) return;
        const encoded = encodeURIComponent(address);
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`).catch(() => {});
    };

    // 🎯 TOIMINNOT: MÄÄRITÄ KULJETTAJA
    const handleAssignDriver = async (driverId: string | null) => {
        if (!assignTarget) return;
        setActionLoading(true);
        try {
            const { order, taskType } = assignTarget;
            const nowIso = new Date().toISOString();

            // 1. Päivitetään delivery_tasks
            const relevantTasks = (order.tasks || []).filter(t => taskType === 'both' || t.task_type === taskType);
            for (const task of relevantTasks) {
                const newStatus = driverId ? (task.status === 'pending' ? 'unassigned' : 'assigned') : 'unassigned';
                await supabase
                    .from('delivery_tasks')
                    .update({
                        driver_id: driverId,
                        status: newStatus,
                        updated_at: nowIso,
                    })
                    .eq('id', task.id);
            }

            // 2. Päivitetään orders
            await supabase
                .from('orders')
                .update({
                    driver_id: driverId,
                    updated_at: nowIso,
                })
                .eq('id', order.id);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setAssignModalVisible(false);
            setAssignTarget(null);
            await fetchAllOrders();
        } catch (err: any) {
            Alert.alert('Virhe', err?.message || 'Kuljettajan asettaminen epäonnistui.');
        } finally {
            setActionLoading(false);
        }
    };

    // 🎯 TOIMINNOT: PIKA-TILAN PÄIVITYS
    const handleUpdateOrderStatus = async (orderId: string, newStatus: string, newLaundryStatus?: string) => {
        setActionLoading(true);
        try {
            const nowIso = new Date().toISOString();
            const payload: any = { status: newStatus, updated_at: nowIso };
            if (newLaundryStatus) payload.laundry_status = newLaundryStatus;
            if (newStatus === 'delivered') payload.tracking_status = 'COMPLETED';
            if (newStatus === 'returning') payload.tracking_status = 'OUT_FOR_DELIVERY';
            if (newStatus === 'washing') payload.tracking_status = 'WASHING';

            await supabase.from('orders').update(payload).eq('id', orderId);

            if (newStatus === 'delivered') {
                await supabase
                    .from('delivery_tasks')
                    .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
                    .eq('order_id', orderId);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await fetchAllOrders();
        } catch (e: any) {
            Alert.alert('Virhe', e?.message || 'Tilan päivitys epäonnistui.');
        } finally {
            setActionLoading(false);
        }
    };

    // 📊 TILASTOT (KPI)
    const stats = useMemo(() => {
        let unassigned = 0;
        let washing = 0;
        let returning = 0;
        let delivered = 0;

        (orders || []).forEach(o => {
            if (!o) return;
            const st = String(o.status || '').toLowerCase();
            const lst = String(o.laundry_status || '').toLowerCase();
            const trk = String(o.tracking_status || '').toUpperCase();
            const hasUnassignedTask = (o.tasks || []).some(t => t && (t.status === 'unassigned' || !t.driver_id));

            if (hasUnassignedTask && st !== 'delivered' && st !== 'cancelled' && st !== 'rejected') {
                unassigned++;
            }
            if (st === 'washing' || lst === 'washing') {
                washing++;
            }
            if (st === 'returning' || trk === 'OUT_FOR_DELIVERY') {
                returning++;
            }
            if (st === 'delivered' || trk === 'COMPLETED') {
                delivered++;
            }
        });

        return { total: (orders || []).length, unassigned, washing, returning, delivered };
    }, [orders]);

    // 🔍 SUODATETTU LISTA
    const filteredOrders = useMemo(() => {
        try {
            return (orders || []).filter(o => {
                if (!o) return false;

                // Tila-suodatus
                const st = String(o.status || '').toLowerCase();
                const lst = String(o.laundry_status || '').toLowerCase();
                const trk = String(o.tracking_status || '').toUpperCase();
                const isUnassigned = (o.tasks || []).some(t => t && (t.status === 'unassigned' || !t.driver_id));

                if (statusFilter === 'unassigned' && (!isUnassigned || st === 'delivered' || st === 'cancelled' || st === 'rejected')) return false;
                if (statusFilter === 'picking_up' && st !== 'picking_up' && st !== 'accepted') return false;
                if (statusFilter === 'washing' && st !== 'washing' && lst !== 'washing') return false;
                if (statusFilter === 'returning' && st !== 'returning') return false;
                if (statusFilter === 'delivered' && st !== 'delivered' && trk !== 'COMPLETED') return false;
                if (statusFilter === 'cancelled' && st !== 'cancelled' && st !== 'rejected') return false;

                // Tekstihaku
                const q = String(searchQuery || '').trim().toLowerCase().replace(/^#/, '');
                if (q.length > 0) {
                    const rawId = String(o.id || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
                    const shortId = `#${rawId.slice(0, 8)}`;
                    const fullId = String(o.id || '').toLowerCase();
                    const matchId = rawId.includes(q) || shortId.toLowerCase().includes(q) || fullId.includes(q);
                    
                    const firstName = String(o.first_name || '').toLowerCase();
                    const lastName = String(o.last_name || '').toLowerCase();
                    const fullName = `${firstName} ${lastName}`.trim();
                    const matchName = firstName.includes(q) || lastName.includes(q) || fullName.includes(q);
                    
                    const rawPhone = String(o.phone || '');
                    const cleanPhone = rawPhone.toLowerCase().replace(/\s+/g, '');
                    const cleanQ = q.replace(/\s+/g, '');
                    const matchPhone = cleanPhone.includes(cleanQ) || rawPhone.toLowerCase().includes(q);
                    
                    const matchAddress = String(o.address || '').toLowerCase().includes(q);
                    const matchService = String(o.service_name || '').toLowerCase().includes(q);
                    const driverName = String(getDriverDisplayName(o.driver_id, drivers) || '').toLowerCase();
                    const matchDriver = driverName.includes(q);

                    if (!matchId && !matchName && !matchPhone && !matchAddress && !matchService && !matchDriver) {
                        return false;
                    }
                }

                return true;
            });
        } catch (err) {
            console.error('Error filtering orders:', err);
            return orders || [];
        }
    }, [orders, statusFilter, searchQuery, drivers]);

    return (
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI / HEADER */}
            <View style={styles.topHeader}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
                        <Feather name="arrow-left" size={20} color="#0F172A" />
                    </TouchableOpacity>
                    <View>
                        <View style={styles.titleRow}>
                            <Text style={styles.headerTitle}>Pesuni Ajojärjestely & Keikkataulu</Text>
                            <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        </View>
                        <Text style={styles.headerSubtitle}>Reaaliaikainen keikkojen hallinta ja välitys</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={18} color="#0284C7" />
                    <Text style={styles.refreshBtnText}>Päivitä</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00C2FF']} />}
                showsVerticalScrollIndicator={false}
            >
                {/* 📊 KPI-TILASTOKORTIT */}
                <View style={styles.statsRow}>
                    <StatCard label="Tilaukset" value={stats.total} icon="layers" color="#0284C7" bg="#E0F2FE" />
                    <StatCard label="Jaossa / Vapaat" value={stats.unassigned} icon="alert-circle" color="#D97706" bg="#FEF3C7" highlight={stats.unassigned > 0} />
                    <StatCard label="Pesulassa" value={stats.washing} icon="refresh-cw" color="#2563EB" bg="#EFF6FF" />
                    <StatCard label="Palautuksessa" value={stats.returning} icon="truck" color="#9333EA" bg="#F3E8FF" />
                    <StatCard label="Toimitetut" value={stats.delivered} icon="check-circle" color="#16A34A" bg="#DCFCE7" />
                </View>

                {/* 🔍 HAKU & FILTTERIT */}
                <View style={styles.filterSection}>
                    <View style={styles.searchBar}>
                        <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Etsi tilausnumerolla, nimellä, puhelimella, osoitteella tai kuljettajalla..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Feather name="x" size={16} color="#64748B" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* STATUS-TABSIT */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
                        <FilterTab label={`Kaikki (${orders.length})`} active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
                        <FilterTab label={`Jaossa (${stats.unassigned})`} active={statusFilter === 'unassigned'} badgeColor="#F59E0B" onPress={() => setStatusFilter('unassigned')} />
                        <FilterTab label="Noudossa" active={statusFilter === 'picking_up'} onPress={() => setStatusFilter('picking_up')} />
                        <FilterTab label={`Pesussa (${stats.washing})`} active={statusFilter === 'washing'} onPress={() => setStatusFilter('washing')} />
                        <FilterTab label={`Palautuksessa (${stats.returning})`} active={statusFilter === 'returning'} onPress={() => setStatusFilter('returning')} />
                        <FilterTab label={`Toimitetut (${stats.delivered})`} active={statusFilter === 'delivered'} onPress={() => setStatusFilter('delivered')} />
                        <FilterTab label="Peruutetut" active={statusFilter === 'cancelled'} onPress={() => setStatusFilter('cancelled')} />
                    </ScrollView>
                </View>

                {/* 📋 KEIKKATAULUKKO / KORTTILISTA */}
                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#00C2FF" />
                        <Text style={styles.loadingText}>Ladataan keikkadataa...</Text>
                    </View>
                ) : filteredOrders.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Feather name="inbox" size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
                        <Text style={styles.emptyTitle}>Ei tilauksia tällä suodatuksella</Text>
                        <Text style={styles.emptySubtitle}>Kokeile vaihtaa hakusanaa tai tila-suodatinta.</Text>
                    </View>
                ) : (
                    <View style={styles.ordersGrid}>
                        {filteredOrders.map((order) => {
                            const rawId = String(order.id || '').replace(/[^a-zA-Z0-9]/g, '');
                            const shortId = `#${rawId.slice(0, 8).toUpperCase()}`;
                            const driverName = getDriverDisplayName(order.driver_id, drivers);
                            const customerName = `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Asiakas';
                            const orderPriceStr = (Number(order.final_price || order.price || 0) || 0).toFixed(2);

                            return (
                                <View key={order.id} style={styles.orderCard}>
                                    {/* KORTIN YLÄOSA: ID & TILA */}
                                    <View style={styles.cardTopRow}>
                                        <TouchableOpacity
                                            style={styles.idBadge}
                                            onPress={() => copyToClipboard(order.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.idText}>{shortId}</Text>
                                            <Feather name={copiedId === order.id ? "check" : "copy"} size={13} color="#0284C7" style={{ marginLeft: 5 }} />
                                        </TouchableOpacity>

                                        <View style={styles.statusPillsRow}>
                                            <StatusPill status={order.status} />
                                            {order.laundry_status === 'washing' && (
                                                <View style={[styles.miniPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                                                    <Text style={[styles.miniPillText, { color: '#1D4ED8' }]}>Pesussa</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* ASIAKAS & YHTEYSTIEDOT */}
                                    <View style={styles.cardCustomerSection}>
                                        <View style={styles.custHeaderRow}>
                                            <Text style={styles.custName}>{customerName}</Text>
                                            <Text style={styles.orderPrice}>{orderPriceStr} €</Text>
                                        </View>

                                        {/* PUHELIN */}
                                        <TouchableOpacity
                                            style={styles.infoRow}
                                            onPress={() => callCustomer(order.phone)}
                                            activeOpacity={0.7}
                                        >
                                            <Feather name="phone" size={14} color="#0284C7" style={styles.infoIcon} />
                                            <Text style={styles.phoneLinkText}>
                                                {order.phone ? formatPhoneNumberDisplay(order.phone) : 'Ei numeroa'}
                                            </Text>
                                            <Feather name="external-link" size={12} color="#0284C7" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>

                                        {/* OSOITE */}
                                        <TouchableOpacity
                                            style={styles.infoRow}
                                            onPress={() => openMap(order.address)}
                                            activeOpacity={0.7}
                                        >
                                            <Feather name="map-pin" size={14} color="#16A34A" style={styles.infoIcon} />
                                            <Text style={styles.addressLinkText} numberOfLines={2}>
                                                {order.address || 'Osoite puuttuu'}
                                            </Text>
                                            <Feather name="external-link" size={12} color="#16A34A" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>

                                        {/* LISÄOHJEET */}
                                        {!!order.special_instructions && (
                                            <View style={styles.notesBox}>
                                                <Feather name="info" size={13} color="#D97706" style={{ marginRight: 5 }} />
                                                <Text style={styles.notesText} numberOfLines={2}>
                                                    {order.special_instructions}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* AIKATAULU & TEKSTIILIT */}
                                    <View style={styles.cardScheduleSection}>
                                        <View style={styles.scheduleItem}>
                                            <Text style={styles.scheduleLabel}>NOUTO:</Text>
                                            <Text style={styles.scheduleValue}>
                                                {formatShortDate(order.pickup_date)} klo {formatTimeWindow(order.pickup_time) || '18:00'}
                                            </Text>
                                        </View>
                                        <View style={styles.scheduleDivider} />
                                        <View style={styles.scheduleItem}>
                                            <Text style={styles.scheduleLabel}>PALAUTUS:</Text>
                                            <Text style={styles.scheduleValue}>
                                                {formatShortDate(order.return_date)} klo {formatTimeWindow(order.return_time) || '16:00'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* KULJETTAJAN HALLINTA & VÄLITYSPANEELI */}
                                    <View style={styles.cardDriverSection}>
                                        <View style={styles.driverInfoRow}>
                                            <Text style={styles.driverSectionTitle}>MÄÄRÄTTY KULJETTAJA:</Text>
                                            {driverName ? (
                                                <View style={styles.driverAssignedBadge}>
                                                    <Feather name="user-check" size={13} color="#16A34A" style={{ marginRight: 4 }} />
                                                    <Text style={styles.driverAssignedText}>{driverName}</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.driverUnassignedBadge}>
                                                    <Feather name="alert-circle" size={13} color="#D97706" style={{ marginRight: 4 }} />
                                                    <Text style={styles.driverUnassignedText}>Ei kuljettajaa (Jaossa)</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* DISPATCH TOIMINTOPAINIKKEET */}
                                        <View style={styles.dispatchActionsRow}>
                                            <TouchableOpacity
                                                style={styles.assignDriverBtn}
                                                onPress={() => {
                                                    setAssignTarget({ order, taskType: 'both' });
                                                    setAssignModalVisible(true);
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="user-plus" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                                <Text style={styles.assignDriverBtnText}>
                                                    {driverName ? 'Vaihda kuljettaja' : 'Määritä kuljettaja'}
                                                </Text>
                                            </TouchableOpacity>

                                            {driverName && (
                                                <TouchableOpacity
                                                    style={styles.unassignBtn}
                                                    onPress={() => {
                                                        setAssignTarget({ order, taskType: 'both' });
                                                        handleAssignDriver(null);
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Feather name="x-circle" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                                    <Text style={styles.unassignBtnText}>Vapauta jakoon</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={styles.detailsBtn}
                                                onPress={() => setSelectedOrder(order)}
                                                activeOpacity={0.7}
                                            >
                                                <Feather name="eye" size={14} color="#0284C7" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 🚘 KULJETTAJAN VALINTAMODAALI */}
            <Modal
                visible={assignModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAssignModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Määritä kuljettaja keikalle</Text>
                                <Text style={styles.modalSub}>
                                    Valitse kuljettaja tai vapauta keikka yleiseen jakoon
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.closeIconBtn}>
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {actionLoading ? (
                            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#00C2FF" />
                                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Tallennetaan keikan välitystä...</Text>
                            </View>
                        ) : (
                            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                                {/* VAPAUTA JAKOON VAIHTOEHTO */}
                                <TouchableOpacity
                                    style={[styles.driverSelectCard, { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}
                                    onPress={() => handleAssignDriver(null)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.driverIconBg, { backgroundColor: '#FEF3C7' }]}>
                                        <Feather name="users" size={20} color="#D97706" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.driverCardTitle, { color: '#B45309' }]}>Vapauta yleiseen jakoon</Text>
                                        <Text style={styles.driverCardSub}>Kuka tahansa kuljettaja voi ottaa keikan</Text>
                                    </View>
                                    <Feather name="chevron-right" size={18} color="#D97706" />
                                </TouchableOpacity>

                                {/* KULJETTAJAT */}
                                {drivers.map(d => {
                                    const dName = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email;
                                    const isCurrent = assignTarget?.order.driver_id === d.id;

                                    return (
                                        <TouchableOpacity
                                            key={d.id}
                                            style={[styles.driverSelectCard, isCurrent && styles.driverSelectCardActive]}
                                            onPress={() => handleAssignDriver(d.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.driverIconBg, isCurrent && { backgroundColor: '#DCFCE7' }]}>
                                                <Feather name="user" size={20} color={isCurrent ? '#16A34A' : '#0284C7'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.driverCardTitle}>{dName}</Text>
                                                <Text style={styles.driverCardSub}>{d.phone ? formatPhoneNumberDisplay(d.phone) : d.email}</Text>
                                            </View>
                                            {isCurrent ? (
                                                <View style={styles.currentDriverTag}>
                                                    <Text style={styles.currentDriverTagText}>Määritetty</Text>
                                                </View>
                                            ) : (
                                                <Feather name="arrow-right" size={18} color="#94A3B8" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* 🔍 TILAUSKOHTAINEN DETALJIMODAALI */}
            {selectedOrder && (
                <Modal
                    visible={!!selectedOrder}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setSelectedOrder(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalCard, { maxWidth: 640 }]}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Tilauksen erittely</Text>
                                    <Text style={styles.modalSub}>ID: {selectedOrder.id}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeIconBtn}>
                                    <Feather name="x" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                                {/* ASIAKASTIEDOT */}
                                <Text style={styles.detailSectionTitle}>Asiakas & Yhteystiedot</Text>
                                <View style={styles.detailBox}>
                                    <Text style={styles.detailTextBold}>{selectedOrder.first_name} {selectedOrder.last_name}</Text>
                                    <Text style={styles.detailText}>Puhelin: {formatPhoneNumberDisplay(selectedOrder.phone)}</Text>
                                    <Text style={styles.detailText}>Osoite: {selectedOrder.address}</Text>
                                    {!!selectedOrder.special_instructions && (
                                        <Text style={[styles.detailText, { color: '#D97706', marginTop: 4 }]}>
                                            Ohjeet: {selectedOrder.special_instructions}
                                        </Text>
                                    )}
                                </View>

                                {/* TUOTTEET & HINNAT */}
                                <Text style={styles.detailSectionTitle}>Pestävät tuotteet & Hintaerittely</Text>
                                <View style={styles.detailBox}>
                                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                        selectedOrder.items.map((item, idx) => (
                                            <View key={item.id || idx} style={styles.itemRow}>
                                                <Text style={styles.itemNameText}>{item.service_name || item.product_name} x {item.quantity}</Text>
                                                <Text style={styles.itemPriceText}>{Number(item.total_price || 0).toFixed(2)} €</Text>
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.itemRow}>
                                            <Text style={styles.itemNameText}>{selectedOrder.service_name}</Text>
                                            <Text style={styles.itemPriceText}>{Number(selectedOrder.final_price || selectedOrder.price || 0).toFixed(2)} €</Text>
                                        </View>
                                    )}
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalText}>Kokonaissumma:</Text>
                                        <Text style={styles.totalPriceText}>{Number(selectedOrder.final_price || selectedOrder.price || 0).toFixed(2)} €</Text>
                                    </View>
                                </View>

                                {/* AJOTEHTÄVÄT (TASKS) */}
                                <Text style={styles.detailSectionTitle}>Ajotehtävät (Delivery Tasks)</Text>
                                {selectedOrder.tasks && selectedOrder.tasks.length > 0 ? (
                                    selectedOrder.tasks.map(t => (
                                        <View key={t.id} style={styles.taskCard}>
                                            <View style={styles.taskHeader}>
                                                <Text style={styles.taskTypeTitle}>
                                                    {t.task_type === 'pickup' ? '📦 Noutokeikka' : '🚗 Palautuskeikka'}
                                                </Text>
                                                <StatusPill status={t.status} />
                                            </View>
                                            <Text style={styles.detailText}>
                                                Kuljettaja: {getDriverDisplayName(t.driver_id, drivers) || 'Ei määrätty'}
                                            </Text>
                                            <Text style={styles.detailText}>
                                                Aikaleima: {t.scheduled_date} ({t.scheduled_time || 'Oletus'})
                                            </Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>Ei erillisiä ajotehtäviä luotuna.</Text>
                                )}

                                {/* PIKATOIMINNOT TILAN MUUTTAMISEEN */}
                                <Text style={styles.detailSectionTitle}>Pikatoiminnot ylläpitäjälle</Text>
                                <View style={styles.quickActionButtonsRow}>
                                    <TouchableOpacity
                                        style={[styles.quickActionBtn, { backgroundColor: '#0284C7' }]}
                                        onPress={() => handleUpdateOrderStatus(selectedOrder.id, 'washing', 'accepted')}
                                        disabled={actionLoading}
                                    >
                                        <Text style={styles.quickActionBtnText}>Hyväksy pesuun</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickActionBtn, { backgroundColor: '#9333EA' }]}
                                        onPress={() => handleUpdateOrderStatus(selectedOrder.id, 'returning')}
                                        disabled={actionLoading}
                                    >
                                        <Text style={styles.quickActionBtnText}>Aloita palautus</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickActionBtn, { backgroundColor: '#16A34A' }]}
                                        onPress={() => handleUpdateOrderStatus(selectedOrder.id, 'delivered')}
                                        disabled={actionLoading}
                                    >
                                        <Text style={styles.quickActionBtnText}>Merkitse valmiiksi</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669',
        letterSpacing: 0.5,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        gap: 6,
    },
    refreshBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284C7',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 110,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    statIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    filterSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
    },
    tabsScroll: {
        flexGrow: 0,
    },
    tabsContainer: {
        gap: 8,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterTabActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7',
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    filterTabTextActive: {
        color: '#FFFFFF',
    },
    tabBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    loadingBox: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
    },
    ordersGrid: {
        gap: 14,
    },
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        marginBottom: 12,
    },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    idText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0284C7',
    },
    statusPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusPillBox: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    miniPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    miniPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardCustomerSection: {
        marginBottom: 12,
    },
    custHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    custName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    orderPrice: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0284C7',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    infoIcon: {
        marginRight: 6,
        width: 16,
    },
    phoneLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0284C7',
    },
    addressLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
    },
    notesBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
    },
    notesText: {
        fontSize: 12,
        color: '#92400E',
        fontWeight: '600',
        flex: 1,
    },
    cardScheduleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    scheduleItem: {
        flex: 1,
    },
    scheduleLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        marginBottom: 2,
    },
    scheduleValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    scheduleDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 10,
    },
    cardDriverSection: {
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 12,
    },
    driverInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    driverSectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.3,
    },
    driverAssignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },
    driverAssignedText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#16A34A',
    },
    driverUnassignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },
    driverUnassignedText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D97706',
    },
    dispatchActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    assignDriverBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 10,
        borderRadius: 12,
    },
    assignDriverBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    unassignBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    unassignBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#EF4444',
    },
    detailsBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#F0F9FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    closeIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverSelectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
        gap: 12,
    },
    driverSelectCardActive: {
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
    },
    driverIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverCardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    driverCardSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    currentDriverTag: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    currentDriverTagText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#16A34A',
    },
    detailSectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 14,
        marginBottom: 8,
    },
    detailBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 6,
    },
    detailTextBold: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    detailText: {
        fontSize: 13,
        color: '#334155',
        marginBottom: 2,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemNameText: {
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '600',
    },
    itemPriceText: {
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '700',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginTop: 4,
    },
    totalText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    totalPriceText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0284C7',
    },
    taskCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    taskTypeTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    quickActionButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
        marginBottom: 12,
    },
    quickActionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
