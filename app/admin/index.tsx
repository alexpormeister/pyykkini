import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 📌 APUKOMPONENTTI: DASHBOARD-KORTTI
function DashboardCard({
    title,
    badge,
    badgeColor = '#0284C7',
    badgeBg = '#E0F2FE',
    subtitle,
    features,
    icon,
    iconColor,
    iconBg,
    buttonText,
    onPress,
    gradientColors,
}: {
    title: string;
    badge?: string;
    badgeColor?: string;
    badgeBg?: string;
    subtitle: string;
    features: string[];
    icon: any;
    iconColor: string;
    iconBg: string;
    buttonText: string;
    onPress: () => void;
    gradientColors?: string[];
}) {
    return (
        <TouchableOpacity
            style={styles.dashCard}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onPress();
            }}
            activeOpacity={0.88}
        >
            <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBox, { backgroundColor: iconBg }]}>
                    <Feather name={icon} size={24} color={iconColor} />
                </View>
                {badge && (
                    <View style={[styles.badgeBox, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
                    </View>
                )}
            </View>

            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>

            {/* OMINAISUUSLISTA */}
            <View style={styles.featuresList}>
                {features.map((feat, idx) => (
                    <View key={idx} style={styles.featureItem}>
                        <Feather name="check" size={13} color="#10B981" style={{ marginRight: 6, marginTop: 2 }} />
                        <Text style={styles.featureText}>{feat}</Text>
                    </View>
                ))}
            </View>

            {/* TOIMINTONAPPI */}
            <View style={[styles.cardActionBtn, { backgroundColor: iconColor }]}>
                <Text style={styles.cardActionBtnText}>{buttonText}</Text>
                <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
        </TouchableOpacity>
    );
}

// 📌 APUKOMPONENTTI: KPI-NOPEUSLUKU
function QuickKpiBox({ label, value, icon, color, bg }: any) {
    return (
        <View style={styles.kpiBox}>
            <View style={[styles.kpiIconCircle, { backgroundColor: bg }]}>
                <Feather name={icon} size={15} color={color} />
            </View>
            <View>
                <Text style={styles.kpiValue}>{value}</Text>
                <Text style={styles.kpiLabel}>{label}</Text>
            </View>
        </View>
    );
}

export default function AdminHubScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Yhteenvetotiedot
    const [stats, setStats] = useState({
        totalOrders: 0,
        activeOrders: 0,
        totalRevenue: 0,
        driverCount: 0,
        unassignedTasks: 0,
    });

    const fetchSummaryStats = useCallback(async () => {
        try {
            // 1. Haetaan tilaukset
            const { data: ordersData } = await supabase
                .from('orders')
                .select('id, status, final_price, price');

            // 2. Haetaan kuljettajat
            const { data: driverRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'driver');

            // 3. Haetaan jakamattomat tehtävät
            const { data: tasksData } = await supabase
                .from('delivery_tasks')
                .select('id, status, driver_id')
                .or('status.eq.unassigned,driver_id.is.null');

            let totalRev = 0;
            let active = 0;
            const total = ordersData?.length || 0;

            (ordersData || []).forEach(o => {
                const p = Number(o.final_price || o.price || 0);
                totalRev += isNaN(p) ? 0 : p;
                const st = String(o.status || '').toLowerCase();
                if (st !== 'delivered' && st !== 'cancelled' && st !== 'rejected') {
                    active++;
                }
            });

            setStats({
                totalOrders: total,
                activeOrders: active,
                totalRevenue: totalRev,
                driverCount: driverRoles?.length || 0,
                unassignedTasks: tasksData?.length || 0,
            });
        } catch (e) {
            console.warn('Virhe yhteenvetotilastojen haussa:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchSummaryStats();
    }, [fetchSummaryStats]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await fetchSummaryStats();
        setRefreshing(false);
    }, [fetchSummaryStats]);

    return (
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.topHeader}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
                        <Feather name="arrow-left" size={20} color="#0F172A" />
                    </TouchableOpacity>
                    <View>
                        <View style={styles.titleRow}>
                            <Text style={styles.headerTitle}>Pesuni Ylläpitoportaali</Text>
                            <View style={styles.adminBadge}>
                                <Feather name="shield" size={11} color="#0284C7" />
                                <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                        </View>
                        <Text style={styles.headerSubtitle}>Valitse hallintapaneeli tai työkalu</Text>
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
                {/* 📊 YLEISET KPI-LUVUT */}
                <View style={styles.kpiContainer}>
                    <QuickKpiBox
                        label="Kokonaismyynti"
                        value={`${stats.totalRevenue.toFixed(0)} €`}
                        icon="dollar-sign"
                        color="#0284C7"
                        bg="#E0F2FE"
                    />
                    <QuickKpiBox
                        label="Aktiiviset tilaukset"
                        value={stats.activeOrders}
                        icon="package"
                        color="#9333EA"
                        bg="#F3E8FF"
                    />
                    <QuickKpiBox
                        label="Kuljettajat"
                        value={stats.driverCount}
                        icon="users"
                        color="#16A34A"
                        bg="#DCFCE7"
                    />
                </View>

                <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionHeading}>Hallintatyökalut</Text>
                    <Text style={styles.sectionSub}>3 erillistä hallintanäkymää</Text>
                </View>

                {/* 🏢 1. HALLINTA DASHBOARD (MANAGEMENT & TALOUS) */}
                <DashboardCard
                    title="Hallinta Dashboard"
                    badge="Talous & Raportit"
                    badgeColor="#0284C7"
                    badgeBg="#E0F2FE"
                    subtitle="Liiketoiminnan yleisnäkymä, myyntiluvut, tilaushistoria, keskiostos ja talousraportit."
                    features={[
                        'Reaaliaikaiset myynti- ja liikevaihtoluvut',
                        'Tilausmäärien ja tilaustilastojen analyysi',
                        'Kuljettajien palkkio- ja suorituserittely',
                        'Top-asiakkaat ja tilaushistoriaraportti'
                    ]}
                    icon="bar-chart-2"
                    iconColor="#0284C7"
                    iconBg="#E0F2FE"
                    buttonText="Avaa Hallinta Dashboard"
                    onPress={() => router.push('/admin/management' as any)}
                />

                {/* 🎧 2. ASIAKASPALVELU & VÄLITYS DASHBOARD */}
                <DashboardCard
                    title="Asiakaspalvelu & Välitys"
                    badge={stats.unassignedTasks > 0 ? `${stats.unassignedTasks} keikkaa jaossa` : 'Live Keikkataulu'}
                    badgeColor={stats.unassignedTasks > 0 ? '#D97706' : '#16A34A'}
                    badgeBg={stats.unassignedTasks > 0 ? '#FEF3C7' : '#DCFCE7'}
                    subtitle="Tilausten live-seuranta, keikkojen välitys kuljettajille, asiakasyhteydet ja nopea haku."
                    features={[
                        'Reaaliaikainen keikkataulukko ja tilapäivitykset',
                        'Kuljettajien määritys ja keikkojen jakaminen',
                        'Asiakkaan suorasoitto ja osoitteen karttahaku',
                        'Välitön tilaus- ja puhelinnumerohaku'
                    ]}
                    icon="headphones"
                    iconColor="#059669"
                    iconBg="#DCFCE7"
                    buttonText="Avaa Asiakaspalvelu & Keikkataulu"
                    onPress={() => router.push('/admin/dispatch' as any)}
                />

                {/* ⚙️ 3. APP MANAGER DASHBOARD */}
                <DashboardCard
                    title="App Manager Dashboard"
                    badge="Asetukset & Tuotteet"
                    badgeColor="#7C3AED"
                    badgeBg="#F3E8FF"
                    subtitle="Pestävät tuotteet ja hinnastot, toimitusalueet, kuljettajaroolit ja sovelluksen asetukset."
                    features={[
                        'Palvelutuotteiden ja hintojen hallinta',
                        'Toimialueiden ja postinumeroiden määritys',
                        'Käyttäjäroolien ja kuljettajatunnusten hallinta',
                        'Yleiset sovelluksen ja palvelun asetukset'
                    ]}
                    icon="sliders"
                    iconColor="#7C3AED"
                    iconBg="#F3E8FF"
                    buttonText="Avaa App Manager"
                    onPress={() => router.push('/admin/app-manager' as any)}
                />

                <View style={styles.quickLinksSection}>
                    <Text style={styles.quickLinksTitle}>Pikalinkit sovellukseen</Text>
                    <View style={styles.quickButtonsGrid}>
                        <TouchableOpacity
                            style={styles.quickNavBtn}
                            onPress={() => router.replace('/(tabs)')}
                            activeOpacity={0.7}
                        >
                            <Feather name="home" size={16} color="#0284C7" />
                            <Text style={styles.quickNavBtnText}>Asiakassovellus</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickNavBtn}
                            onPress={() => router.replace('/driver')}
                            activeOpacity={0.7}
                        >
                            <Feather name="truck" size={16} color="#16A34A" />
                            <Text style={styles.quickNavBtnText}>Kuljettajasovellus</Text>
                        </TouchableOpacity>
                    </View>
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
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    adminBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0284C7',
        letterSpacing: 0.5,
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
    kpiContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    kpiBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    kpiIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiValue: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    kpiLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 1,
    },
    sectionHeadingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        marginTop: 4,
    },
    sectionHeading: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    sectionSub: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    dashCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeBox: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    cardTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 14,
    },
    featuresList: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        gap: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600',
        flex: 1,
    },
    cardActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 4,
    },
    cardActionBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    quickLinksSection: {
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    quickLinksTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    quickButtonsGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    quickNavBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    quickNavBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
});
