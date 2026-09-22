import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { selectCartItems } from '../../redux/cartSlice';

import CartList from "../../components/washes/CartList";
import EmptyWashes from "../../components/washes/EmptyWashes";
import OrderStatusCard from "../../components/washes/OrderStatusCard";

const DISMISSED_ORDERS_KEY = 'pesuni_dismissed_orders';

const getDismissedOrders = async (): Promise<string[]> => {
    try {
        const stored = await AsyncStorage.getItem(DISMISSED_ORDERS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveDismissedOrder = async (orderId: string) => {
    try {
        const existing = await getDismissedOrders();
        if (!existing.includes(orderId)) {
            const updated = [...existing, orderId];
            await AsyncStorage.setItem(DISMISSED_ORDERS_KEY, JSON.stringify(updated));
        }
    } catch (e) {
        console.error('Virhe kuittauksen tallennuksessa:', e);
    }
};

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    background: '#F8FAFC',
    cardBorder: '#F1F5F9',
    primary: '#00C2FF',
};

export default function WashesScreen() {
    const router = useRouter();
    const cartItems = useSelector(selectCartItems);
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchUserActiveOrders = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                setActiveOrders([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const dismissed = await getDismissedOrders();

            // Haetaan tilaukset, niiden tuoterivit ja toimitustehtävät
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*), delivery_tasks(*)')
                .eq('user_id', user.id)
                .neq('status', 'delivered')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const filtered = (data || []).filter(order => {
                const isCancelled = order.status === 'rejected' || order.status === 'cancelled';
                if (isCancelled && dismissed.includes(order.id)) {
                    return false;
                }
                return true;
            });

            setActiveOrders(filtered);
        } catch (error) {
            console.error("Virhe tilauksien haussa:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchUserActiveOrders();
        }, [fetchUserActiveOrders])
    );

    useEffect(() => {
        let subscription: any;

        fetchUserActiveOrders();

        const setupRealtime = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            subscription = supabase
                .channel(`user-orders-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: `user_id=eq.${user.id}`,
                    },
                    async (payload) => {
                        if (payload.eventType === 'UPDATE') {
                            if (payload.new.status === 'delivered') {
                                setActiveOrders(prev => prev.filter(o => o.id !== payload.new.id));
                            } else {
                                const currentDismissed = await getDismissedOrders();
                                const isCancelled = payload.new.status === 'rejected' || payload.new.status === 'cancelled';
                                if (isCancelled && currentDismissed.includes(payload.new.id)) {
                                    setActiveOrders(prev => prev.filter(o => o.id !== payload.new.id));
                                } else {
                                    fetchUserActiveOrders();
                                }
                            }
                        } else if (payload.eventType === 'INSERT') {
                            fetchUserActiveOrders();
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'delivery_tasks',
                    },
                    () => {
                        fetchUserActiveOrders();
                    }
                )
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, [fetchUserActiveOrders]);

    const handleDismissOrder = async (orderId: string) => {
        await saveDismissedOrder(orderId);
        setActiveOrders(prev => prev.filter(order => order.id !== orderId));
    };

    const hasActiveOrders = activeOrders.length > 0;
    const hasCartItems = cartItems.length > 0;

    if (!loading && !hasActiveOrders && !hasCartItems) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchUserActiveOrders();
                            }}
                            tintColor={COLORS.primary}
                        />
                    }
                >
                    <EmptyWashes
                        onStartShopping={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.replace('/?action=scrollToMenu');
                        }}
                    />
                </ScrollView>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* AKTIIVISEN TILAUSMÄÄRÄN BADGE (JOS ON TILAUS) */}
            {hasActiveOrders && (
                <View style={styles.header}>
                    <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>
                            {activeOrders.length} aktiivinen tilaus
                        </Text>
                    </View>
                </View>
            )}

            {loading && !refreshing && activeOrders.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchUserActiveOrders();
                            }}
                            tintColor={COLORS.primary}
                        />
                    }
                >
                    {/* 1. AKTIIVISET TILAUKSET SEURANNASSA */}
                    {hasActiveOrders && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Tilauksen tila</Text>
                            {activeOrders.map((order) => (
                                <OrderStatusCard
                                    key={order.id}
                                    order={order}
                                    onDismiss={() => handleDismissOrder(order.id)}
                                />
                            ))}
                        </View>
                    )}

                    {/* 2. OSTOSKORI */}
                    {hasCartItems && (
                        <View style={styles.section}>
                            <CartList />
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.darkText,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textGray,
        marginTop: 2,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F7FF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        marginRight: 6,
    },
    activeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 12,
        marginLeft: 4,
    },
});