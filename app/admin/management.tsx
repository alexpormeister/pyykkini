import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPhoneNumberDisplay } from '../../lib/phoneUtils';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// 📌 APUKOMPONENTIT
function MetricCard({
    title,
    value,
    subValue,
    icon,
    color,
    bg,
}: {
    title: string;
    value: string;
    subValue?: string;
    icon: any;
    color: string;
    bg: string;
}) {
    return (
        <View style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: bg }]}>
                <Feather name={icon} size={20} color={color} />
            </View>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricTitle}>{title}</Text>
            {!!subValue && <Text style={styles.metricSub}>{subValue}</Text>}
        </View>
    );
}

function StatusBreakdownBar({
    label,
    count,
    total,
    color,
    bg,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
    bg: string;
}) {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelRow}>
                <View style={[styles.dotIndicator, { backgroundColor: color }]} />
                <Text style={styles.breakdownLabel}>{label}</Text>
                <Text style={styles.breakdownCount}>{count} kpl ({percent} %)</Text>
            </View>
            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

export default function AdminManagementDashboard() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d'>('all');

    const fetchManagementData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, first_name, last_name, phone, address, service_name, status, laundry_status, final_price, price, created_at, driver_id')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (e) {
            console.warn('Virhe hallintadatan haussa:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchManagementData();
    }, [fetchManagementData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await fetchManagementData();
        setRefreshing(false);
    }, [fetchManagementData]);

    // Suodatetaan valitulla aikajaksolla
    const filteredOrders = useMemo(() => {
        if (timeRange === 'all') return orders;
        const now = new Date().getTime();
        const days = timeRange === '7d' ? 7 : 30;
        const limitMs = days * 24 * 60 * 60 * 1000;

        return orders.filter(o => {
            if (!o.created_at) return true;
            const t = new Date(o.created_at).getTime();
            return (now - t) <= limitMs;
        });
    }, [orders, timeRange]);

    // Lasketaan avainluvut
    const metrics = useMemo(() => {
        let totalRevenue = 0;
        let completedCount = 0;
        let washingCount = 0;
        let activeCount = 0;
        let cancelledCount = 0;

        filteredOrders.forEach(o => {
            const p = Number(o.final_price || o.price || 0);
            totalRevenue += isNaN(p) ? 0 : p;

            const st = String(o.status || '').toLowerCase();
            const lst = String(o.laundry_status || '').toLowerCase();

            if (st === 'delivered' || st === 'completed') {
                completedCount++;
            } else if (st === 'cancelled' || st === 'rejected') {
                cancelledCount++;
            } else if (st === 'washing' || lst === 'washing') {
                washingCount++;
                activeCount++;
            } else {
                activeCount++;
            }
        });

        const totalCount = filteredOrders.length;
        const avgOrderValue = totalCount > 0 ? totalRevenue / totalCount : 0;
        const driverPayoutEst = totalRevenue * 0.70; // 70% kuljettajille
        const platformCut = totalRevenue * 0.30; // 30% alustalle

        return {
            totalRevenue,
            avgOrderValue,
            totalCount,
            completedCount,
            washingCount,
            activeCount,
            cancelledCount,
            driverPayoutEst,
            platformCut,
        };
    }, [filteredOrders]);

    return (
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* HEADER */}
            <View style={styles.topHeader}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.replace('/admin' as any)} style={styles.backBtn}>
                        <Feather name="arrow-left" size={20} color="#0F172A" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Hallinta & Talous Dashboard</Text>
                        <Text style={styles.headerSubtitle}>Liiketoiminnan yleiskatsaus ja raportit</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={16} color="#0284C7" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00C2FF']} />}
                showsVerticalScrollIndicator={false}
            >
                {/* AIKAVÄLIVALITSIN */}
                <View style={styles.timeRangeBar}>
                    <TouchableOpacity
                        style={[styles.rangeBtn, timeRange === 'all' && styles.rangeBtnActive]}
                        onPress={() => setTimeRange('all')}
                    >
                        <Text style={[styles.rangeBtnText, timeRange === 'all' && styles.rangeBtnTextActive]}>Kaikki ajat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.rangeBtn, timeRange === '30d' && styles.rangeBtnActive]}
                        onPress={() => setTimeRange('30d')}
                    >
                        <Text style={[styles.rangeBtnText, timeRange === '30d' && styles.rangeBtnTextActive]}>Viimeiset 30 pv</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.rangeBtn, timeRange === '7d' && styles.rangeBtnActive]}
                        onPress={() => setTimeRange('7d')}
                    >
                        <Text style={[styles.rangeBtnText, timeRange === '7d' && styles.rangeBtnTextActive]}>Viimeiset 7 pv</Text>
                    </TouchableOpacity>
                </View>

                {/* 📊 TALOUDEN PÄÄMITTARIT */}
                <View style={styles.metricsGrid}>
                    <MetricCard
                        title="Kokonaismyynti"
                        value={`${metrics.totalRevenue.toFixed(2)} €`}
                        subValue={`${metrics.totalCount} kpl tilauksia`}
                        icon="trending-up"
                        color="#0284C7"
                        bg="#E0F2FE"
                    />
                    <MetricCard
                        title="Keskiostos (AOV)"
                        value={`${metrics.avgOrderValue.toFixed(2)} €`}
                        subValue="per tilaus"
                        icon="shopping-cart"
                        color="#16A34A"
                        bg="#DCFCE7"
                    />
                    <MetricCard
                        title="Alustan Komissio"
                        value={`${metrics.platformCut.toFixed(2)} €`}
                        subValue="arvioitu tuotto (30%)"
                        icon="pie-chart"
                        color="#9333EA"
                        bg="#F3E8FF"
                    />
                    <MetricCard
                        title="Kuljettajakorvaukset"
                        value={`${metrics.driverPayoutEst.toFixed(2)} €`}
                        subValue="ajopalkkiot (70%)"
                        icon="truck"
                        color="#D97706"
                        bg="#FEF3C7"
                    />
                </View>

                {/* 📈 TILAUSTEN TILAJAKAUMA */}
                <View style={styles.cardSection}>
                    <View style={styles.sectionTitleRow}>
                        <Feather name="bar-chart" size={18} color="#0F172A" />
                        <Text style={styles.sectionCardTitle}>Tilausten statusjakauma</Text>
                    </View>

                    <StatusBreakdownBar
                        label="Toimitetut & Valmiit"
                        count={metrics.completedCount}
                        total={metrics.totalCount}
                        color="#16A34A"
                        bg="#DCFCE7"
                    />
                    <StatusBreakdownBar
                        label="Pesussa / Käsittelyssä"
                        count={metrics.washingCount}
                        total={metrics.totalCount}
                        color="#2563EB"
                        bg="#EFF6FF"
                    />
                    <StatusBreakdownBar
                        label="Aktiiviset (Jaossa/Noudossa/Palautuksessa)"
                        count={metrics.activeCount}
                        total={metrics.totalCount}
                        color="#D97706"
                        bg="#FEF3C7"
                    />
                    <StatusBreakdownBar
                        label="Peruutetut"
                        count={metrics.cancelledCount}
                        total={metrics.totalCount}
                        color="#EF4444"
                        bg="#FEE2E2"
                    />
                </View>

                {/* 📋 VIIMEISIMMÄT TILAUKSET & MYYNTILISTA */}
                <View style={styles.cardSection}>
                    <View style={styles.sectionTitleRow}>
                        <Feather name="list" size={18} color="#0F172A" />
                        <Text style={styles.sectionCardTitle}>Viimeisimmät myynnit ({filteredOrders.length})</Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="small" color="#00C2FF" style={{ paddingVertical: 20 }} />
                    ) : filteredOrders.length === 0 ? (
                        <Text style={styles.emptyText}>Ei tilauksia valitulla aikavälillä.</Text>
                    ) : (
                        <View style={styles.ordersTable}>
                            {filteredOrders.slice(0, 10).map((ord) => {
                                const rawId = String(ord.id || '').replace(/[^a-zA-Z0-9]/g, '');
                                const shortId = `#${rawId.slice(0, 8).toUpperCase()}`;
                                const custName = `${ord.first_name || ''} ${ord.last_name || ''}`.trim() || 'Asiakas';
                                const priceVal = Number(ord.final_price || ord.price || 0).toFixed(2);

                                return (
                                    <View key={ord.id} style={styles.orderTableRow}>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.tableRowTop}>
                                                <Text style={styles.tableId}>{shortId}</Text>
                                                <Text style={styles.tableDate}>{formatShortDate(ord.created_at)}</Text>
                                            </View>
                                            <Text style={styles.tableName}>{custName}</Text>
                                            <Text style={styles.tableService}>{ord.service_name || 'Tekstiilipesu'}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.tablePrice}>{priceVal} €</Text>
                                            <View style={[styles.miniStatusBadge, ord.status === 'delivered' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#EFF6FF' }]}>
                                                <Text style={[styles.miniStatusText, ord.status === 'delivered' ? { color: '#16A34A' } : { color: '#0284C7' }]}>
                                                    {ord.status === 'delivered' ? 'Valmis' : ord.status || 'Käsittelyssä'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F9FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    timeRangeBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 4,
    },
    rangeBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 12,
    },
    rangeBtnActive: {
        backgroundColor: '#0284C7',
    },
    rangeBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    rangeBtnTextActive: {
        color: '#FFFFFF',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    metricCard: {
        flex: 1,
        minWidth: (SCREEN_WIDTH - 44) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    metricIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    metricValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 2,
    },
    metricTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    metricSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
    },
    cardSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionCardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    breakdownRow: {
        marginBottom: 14,
    },
    breakdownLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    dotIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    breakdownLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        flex: 1,
    },
    breakdownCount: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    progressBarTrack: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        paddingVertical: 20,
    },
    ordersTable: {
        gap: 10,
    },
    orderTableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    tableRowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    tableId: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7',
    },
    tableDate: {
        fontSize: 11,
        color: '#94A3B8',
    },
    tableName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    tableService: {
        fontSize: 12,
        color: '#64748B',
    },
    tablePrice: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 4,
    },
    miniStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    miniStatusText: {
        fontSize: 10,
        fontWeight: '800',
    },
});
