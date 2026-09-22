import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HistoryItem from '../../components/orders/HistoryItems';
import OrderReceiptModal from '../../components/orders/OrderReceiptModal';
import { supabase } from '../../lib/supabase';

const COLORS = {
    background: '#F8FAFC',
    darkText: '#0F172A',
    white: '#FFFFFF',
    textGray: '#64748B',
    primary: '#00C2FF',
    cardBorder: '#F1F5F9',
};

interface Order {
    id: string;
    created_at: string;
    payment_amount: number;
    status: string;
    service_name: string;
    address?: string;
    pickup_date?: string;
    pickup_time?: string;
    return_date?: string;
    return_time?: string;
    pickup_weight_kg?: string;
    return_weight_kg?: string;
    payment_status?: string;
    payment_method?: string;
    access_code?: string;
    tracking_status?: string;
    service_fee?: number;
    delivery_fee?: number;
    vat_rate?: number;
    vat_amount?: number;
}

interface GroupedOrders {
    title: string;
    data: Order[];
}

export default function MyOrdersScreen() {
    const router = useRouter();
    const [historyOrders, setHistoryOrders] = useState<GroupedOrders[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const handleOpenReceipt = (order: Order) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedOrder(order);
        setModalVisible(true);
    };

    const formatServiceName = (name: string) => {
        if (!name) return "Pesulapalvelu";
        const items = name.split(', ');
        let firstItem = items[0];

        if (items.length > 1) {
            const maxLength = 18;
            const displayName = firstItem.length > maxLength
                ? firstItem.substring(0, maxLength) + "..."
                : firstItem;
            return `${displayName} + ${items.length - 1} muuta`;
        }
        return firstItem.length > 28 ? firstItem.substring(0, 25) + "..." : firstItem;
    };

    const groupOrdersByMonth = useCallback((orders: Order[]) => {
        const groups: { [key: string]: Order[] } = {};
        orders.forEach(order => {
            const date = new Date(order.created_at);
            const now = new Date();
            let groupTitle = '';

            if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                groupTitle = 'Tässä kuussa';
            } else {
                const monthNames = ["Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu", "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu"];
                groupTitle = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            }

            if (!groups[groupTitle]) groups[groupTitle] = [];
            groups[groupTitle].push(order);
        });

        const groupedArray = Object.keys(groups).map(key => ({
            title: key,
            data: groups[key]
        }));
        setHistoryOrders(groupedArray);
    }, []);

    const formatExactTime = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month}.${year} klo ${hours}:${minutes}`;
    };

    const fetchOrders = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, 
                    created_at, 
                    final_price, 
                    status, 
                    tracking_status,
                    service_name, 
                    address, 
                    pickup_date, 
                    pickup_time, 
                    return_date, 
                    return_time, 
                    pickup_weight_kg, 
                    return_weight_kg,
                    payment_status,
                    payment_method,
                    access_code,
                    service_fee,
                    delivery_fee,
                    vat_rate,
                    vat_amount
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedData: Order[] = data.map(item => ({
                    id: item.id,
                    created_at: item.created_at,
                    payment_amount: parseFloat(item.final_price || '0'),
                    status: item.status || 'pending',
                    tracking_status: item.tracking_status,
                    service_name: item.service_name || 'Pesulapalvelu',
                    address: item.address,
                    pickup_date: item.pickup_date,
                    pickup_time: item.pickup_time,
                    return_date: item.return_date,
                    return_time: item.return_time,
                    pickup_weight_kg: item.pickup_weight_kg,
                    return_weight_kg: item.return_weight_kg,
                    payment_status: item.payment_status,
                    payment_method: item.payment_method,
                    access_code: item.access_code,
                    service_fee: item.service_fee !== undefined && item.service_fee !== null ? parseFloat(item.service_fee) : 2.00,
                    delivery_fee: item.delivery_fee !== undefined && item.delivery_fee !== null ? parseFloat(item.delivery_fee) : 0.00,
                    vat_rate: item.vat_rate !== undefined && item.vat_rate !== null ? parseFloat(item.vat_rate) : 25.5,
                    vat_amount: item.vat_amount !== undefined && item.vat_amount !== null ? parseFloat(item.vat_amount) : undefined,
                }));
                groupOrdersByMonth(mappedData);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [groupOrdersByMonth]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getDate()}. ${["Tammikuuta", "Helmikuuta", "Maaliskuuta", "Huhtikuuta", "Toukokuuta", "Kesäkuuta", "Heinäkuuta", "Elokuuta", "Syyskuuta", "Lokakuuta", "Marraskuuta", "Joulukuuta"][date.getMonth()]}`;
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ostohistoria & Kuitit</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    historyOrders.length > 0 ? (
                        historyOrders.map((group, index) => (
                            <View key={index} style={styles.section}>
                                <Text style={styles.sectionHeader}>{group.title}</Text>
                                {group.data.map((order) => (
                                    <HistoryItem
                                        key={order.id}
                                        store={formatServiceName(order.service_name)}
                                        date={formatDate(order.created_at)}
                                        price={`${(order.payment_amount ?? 0).toFixed(2).replace('.', ',')} €`}
                                        items={formatExactTime(order.created_at)}
                                        isBurger={false}
                                        onOpenReceipt={() => handleOpenReceipt(order)}
                                    />
                                ))}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBox}>
                                <Feather name="shopping-bag" size={36} color="#94A3B8" />
                            </View>
                            <Text style={styles.emptyStateTitle}>Ei aiempia tilauksia</Text>
                            <Text style={styles.emptyStateText}>Tilaamasi pesulapalvelut ja viralliset kuitit kertyvät tänne.</Text>
                        </View>
                    )
                )}
            </ScrollView>

            <OrderReceiptModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                order={selectedOrder}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 14 : 18,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 14 },
    section: { marginBottom: 16 },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginLeft: 4,
    },
    emptyState: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
    emptyIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText, marginBottom: 6 },
    emptyStateText: { fontSize: 14, color: COLORS.textGray, textAlign: 'center', lineHeight: 20 },
});