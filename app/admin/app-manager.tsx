import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OPERATING_CITIES = [
    { name: 'Espoo', postal: '02100-02980', active: true },
    { name: 'Helsinki', postal: '00100-00990', active: true },
    { name: 'Vantaa', postal: '01200-01770', active: true },
    { name: 'Kauniainen', postal: '02700', active: true },
    { name: 'Kirkkonummi', postal: '02400-02480', active: true },
    { name: 'Lohja', postal: '08100-08800', active: true },
    { name: 'Vihti / Nummela', postal: '03100-03400', active: true },
    { name: 'Sundsberg', postal: '02450', active: true },
    { name: 'Järvenpää', postal: '04400', active: true },
    { name: 'Kerava', postal: '04200', active: true },
    { name: 'Tuusula', postal: '04300', active: true },
    { name: 'Nurmijärvi', postal: '01800-01900', active: true },
    { name: 'Siuntio', postal: '02570-02580', active: true },
    { name: 'Karkkila', postal: '03600-03620', active: true },
];

export default function AdminAppManagerDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'products' | 'drivers' | 'areas'>('products');
    const [products, setProducts] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Kuljettajan lisäys
    const [newDriverEmail, setNewDriverEmail] = useState('');

    const fetchData = useCallback(async () => {
        try {
            // 1. Haetaan tuotteet
            const { data: prodData } = await supabase
                .from('products')
                .select('*')
                .order('sort_order', { ascending: true });

            if (prodData) setProducts(prodData);

            // 2. Haetaan kuljettajat
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('user_id, role, created_at')
                .eq('role', 'driver');

            if (roleData && roleData.length > 0) {
                const userIds = roleData.map(r => r.user_id);
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, first_name, last_name, email, phone')
                    .in('user_id', userIds);

                setDrivers(profiles || []);
            } else {
                setDrivers([]);
            }
        } catch (e) {
            console.warn('Virhe App Managerin datan haussa:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    // Tuotteen aktiivisuuden vaihto
    const toggleProductActive = async (productId: string, currentVal: boolean) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: !currentVal, updated_at: new Date().toISOString() })
                .eq('id', productId);

            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: !currentVal } : p));
        } catch (e: any) {
            Alert.alert('Virhe', e?.message || 'Tuotteen päivitys epäonnistui.');
        } finally {
            setActionLoading(false);
        }
    };

    // Kuljettajaroolin poisto
    const handleRemoveDriverRole = async (userId: string) => {
        Alert.alert(
            'Poista kuljettajarooli',
            'Haluatko varmasti poistaa kuljettajaoikeudet tältä käyttäjältä?',
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Poista',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'driver');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            await fetchData();
                        } catch (e: any) {
                            Alert.alert('Virhe', e?.message || 'Roolin poisto epäonnistui.');
                        }
                    },
                },
            ]
        );
    };

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
                        <Text style={styles.headerTitle}>App Manager Dashboard</Text>
                        <Text style={styles.headerSubtitle}>Sovellushallinta, tuotteet ja toimitusalueet</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={16} color="#0284C7" />
                </TouchableOpacity>
            </View>

            {/* VÄLILEHDET */}
            <View style={styles.tabNav}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'products' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('products')}
                >
                    <Feather name="package" size={16} color={activeTab === 'products' ? '#0284C7' : '#64748B'} />
                    <Text style={[styles.tabBtnText, activeTab === 'products' && styles.tabBtnTextActive]}>
                        Tuotteet ({products.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'drivers' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('drivers')}
                >
                    <Feather name="users" size={16} color={activeTab === 'drivers' ? '#0284C7' : '#64748B'} />
                    <Text style={[styles.tabBtnText, activeTab === 'drivers' && styles.tabBtnTextActive]}>
                        Kuljettajat ({drivers.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'areas' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('areas')}
                >
                    <Feather name="map-pin" size={16} color={activeTab === 'areas' ? '#0284C7' : '#64748B'} />
                    <Text style={[styles.tabBtnText, activeTab === 'areas' && styles.tabBtnTextActive]}>
                        Toimialueet ({OPERATING_CITIES.length})
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00C2FF']} />}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <ActivityIndicator size="large" color="#00C2FF" style={{ paddingVertical: 50 }} />
                ) : activeTab === 'products' ? (
                    /* 📦 TUOTTEET & HINNASTOT */
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Pestävät tuotteet & Hinnasto</Text>
                            <Text style={styles.sectionSub}>Hallitse näkyvyyttä ja perushintoja</Text>
                        </View>

                        {products.map(p => (
                            <View key={p.id} style={styles.productCard}>
                                <View style={styles.productTopRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.productName}>{p.name}</Text>
                                        <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                                    </View>
                                    <Switch
                                        value={!!p.is_active}
                                        onValueChange={() => toggleProductActive(p.id, p.is_active)}
                                        trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
                                        thumbColor={p.is_active ? '#0284C7' : '#94A3B8'}
                                    />
                                </View>

                                <View style={styles.productMetaRow}>
                                    <View style={styles.pricePill}>
                                        <Text style={styles.pricePillLabel}>Hinta:</Text>
                                        <Text style={styles.pricePillVal}>{Number(p.base_price || 0).toFixed(2)} €</Text>
                                    </View>
                                    <View style={styles.pricePill}>
                                        <Text style={styles.pricePillLabel}>Malli:</Text>
                                        <Text style={styles.pricePillVal}>{p.pricing_model || 'FIXED'}</Text>
                                    </View>
                                    <View style={styles.pricePill}>
                                        <Text style={styles.pricePillLabel}>Palkkiojako:</Text>
                                        <Text style={styles.pricePillVal}>{p.driver_fee_value || 85}% / {p.platform_fee_value || 15}%</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : activeTab === 'drivers' ? (
                    /* 🚗 KULJETTAJAROOLIT */
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Aktiiviset kuljettajatunnukset</Text>
                            <Text style={styles.sectionSub}>Käyttäjät joilla on pääsy Driver-sovellukseen</Text>
                        </View>

                        {drivers.length === 0 ? (
                            <Text style={styles.emptyText}>Ei aktiivisia kuljettajarooleja tietokannassa.</Text>
                        ) : (
                            drivers.map(d => (
                                <View key={d.user_id} style={styles.driverCard}>
                                    <View style={styles.driverAvatarCircle}>
                                        <Feather name="user" size={18} color="#0284C7" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.driverNameText}>
                                            {d.first_name || ''} {d.last_name || ''}
                                        </Text>
                                        <Text style={styles.driverEmailText}>{d.email || d.user_id}</Text>
                                        {!!d.phone && <Text style={styles.driverPhoneText}>{d.phone}</Text>}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeRoleBtn}
                                        onPress={() => handleRemoveDriverRole(d.user_id)}
                                    >
                                        <Feather name="trash-2" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    /* 📍 TOIMIALUEET */
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Toiminta- ja kuljetusalueet</Text>
                            <Text style={styles.sectionSub}>Pesunin nouto- ja palautusalueet Uudellamaalla</Text>
                        </View>

                        <View style={styles.areasGrid}>
                            {OPERATING_CITIES.map((c, idx) => (
                                <View key={idx} style={styles.areaCard}>
                                    <View style={styles.areaTop}>
                                        <Feather name="map-pin" size={16} color="#16A34A" />
                                        <Text style={styles.areaName}>{c.name}</Text>
                                    </View>
                                    <Text style={styles.areaPostal}>{c.postal}</Text>
                                    <View style={styles.activeTag}>
                                        <Text style={styles.activeTagText}>Toiminnassa</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

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
    tabNav: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 8,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    tabBtnActive: {
        backgroundColor: '#F0F9FF',
        borderColor: '#0284C7',
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    tabBtnTextActive: {
        color: '#0284C7',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    sectionContainer: {
        gap: 12,
    },
    sectionHeader: {
        marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    sectionSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    productTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    productName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    productDesc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    productMetaRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    pricePill: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 4,
    },
    pricePillLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
    },
    pricePillVal: {
        fontSize: 11,
        color: '#0F172A',
        fontWeight: '800',
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 12,
    },
    driverAvatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverNameText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    driverEmailText: {
        fontSize: 12,
        color: '#64748B',
    },
    driverPhoneText: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: '600',
        marginTop: 2,
    },
    removeRoleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    areasGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    areaCard: {
        width: (SCREEN_WIDTH - 42) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    areaTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    areaName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    areaPostal: {
        fontSize: 11,
        color: '#64748B',
        marginBottom: 8,
    },
    activeTag: {
        alignSelf: 'flex-start',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    activeTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#16A34A',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        paddingVertical: 30,
    },
});
