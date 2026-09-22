import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { performLogout } from '../../lib/authHelper';
import { supabase } from '../../lib/supabase';

const DRIVER_ZONES_KEY = 'pesuni_driver_selected_zones';
const DRIVER_VEHICLE_KEY = 'pesuni_driver_vehicle_info';

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    darkText: '#0F172A',
    grayText: '#64748B',
    lightGray: '#94A3B8',
    border: '#E2E8F0',
    green: '#10B981',
    greenBg: '#ECFDF5',
};

export default function DriverProfileScreen() {
    const router = useRouter();
    const [userEmail, setUserEmail] = useState<string>('');
    const [userName, setUserName] = useState<string>('Kuljettaja');
    const [userPhone, setUserPhone] = useState<string>('');
    const [selectedZonesSubtitle, setSelectedZonesSubtitle] = useState<string>('Pääkaupunkiseutu');
    const [vehicleSubtitle, setVehicleSubtitle] = useState<string>('Pakettiauto (ABC-123)');
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                setUserEmail(session.user.email || '');
                // Haetaan profiilitiedot
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, phone')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                if (profile) {
                    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                    if (fullName) setUserName(fullName);
                    if (profile.phone) setUserPhone(profile.phone);
                }
            }
        });

        // Haetaan valitut toimialueet
        AsyncStorage.getItem(DRIVER_ZONES_KEY).then(data => {
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    const active = Object.keys(parsed).filter(k => parsed[k]);
                    if (active.length > 0) {
                        const formatted = active
                            .map(c => c.charAt(0).toUpperCase() + c.slice(1))
                            .slice(0, 2)
                            .join(', ') + (active.length > 2 ? ` +${active.length - 2}` : '');
                        setSelectedZonesSubtitle(formatted);
                    }
                } catch {}
            }
        });

        // Haetaan tallennettu ajoneuvo
        AsyncStorage.getItem(DRIVER_VEHICLE_KEY).then(data => {
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.typeLabel && parsed.plate) {
                        setVehicleSubtitle(`${parsed.typeLabel} (${parsed.plate})`);
                    } else if (parsed.plate) {
                        setVehicleSubtitle(`Ajoneuvo (${parsed.plate})`);
                    }
                } catch {}
            }
        });
    }, []);

    const openChat = (topic?: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push('/general/chat');
    };

    const handleLogout = () => {
        Alert.alert(
            'Kirjaudu ulos',
            'Haluatko varmasti kirjautua ulos kuljettajatililtä?',
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Kirjaudu ulos',
                    style: 'destructive',
                    onPress: () => performLogout(router),
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profiili</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 🌟 1. KULJETTAJAN PÄÄKORTTI 🌟 */}
                <View style={styles.driverMainCard}>
                    <View style={styles.avatarRow}>
                        <LinearGradient
                            colors={['#00C2FF', '#0284C7']}
                            style={styles.driverAvatar}
                        >
                            <Feather name="user" size={36} color="#FFFFFF" />
                        </LinearGradient>

                        <View style={styles.driverInfo}>
                            <View style={styles.nameRow}>
                                <Text style={styles.driverName}>{userName}</Text>
                                <View style={styles.verifiedBadge}>
                                    <Feather name="check" size={10} color="#FFFFFF" />
                                </View>
                            </View>
                            <Text style={styles.driverEmail}>{userEmail}</Text>
                            {userPhone ? <Text style={styles.driverPhone}>{userPhone}</Text> : null}
                            <View style={styles.badgePill}>
                                <Text style={styles.badgePillText}>Vahvistettu kuljettaja</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 🌟 2. TILASTOT & TULOT 🌟 */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>4</Text>
                        <Text style={styles.statLabel}>Tänään ajettu</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: '#0284C7' }]}>124 €</Text>
                        <Text style={styles.statLabel}>Viikon tulot</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="star" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
                            <Text style={styles.statValue}>4.95</Text>
                        </View>
                        <Text style={styles.statLabel}>Arvio</Text>
                    </View>
                </View>

                {/* 🌟 3. OMAT TIEDOT / YHTEYSTIEDOT 🌟 */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Omat tiedot</Text>
                    <View style={styles.cardGroup}>
                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                router.push({
                                    pathname: '/general/personal-data',
                                    params: { from: 'driver' },
                                });
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                                <Feather name="user" size={18} color="#0284C7" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Yhteystiedot</Text>
                                <Text style={styles.itemSubtitle}>Nimi, puhelin, osoite, ikä & sukupuoli</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 🌟 4. AJONEUVO JA TOIMIALUE 🌟 */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Ajoneuvo & Toimialue</Text>
                    <View style={styles.cardGroup}>
                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                router.push('/driver/vehicle');
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                                <Feather name="truck" size={18} color="#0284C7" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Ajoneuvo</Text>
                                <Text style={styles.itemSubtitle}>{vehicleSubtitle}</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color="#94A3B8" />
                        </TouchableOpacity>

                        <View style={styles.itemSeparator} />

                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                router.push('/driver/operating-area');
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                                <Feather name="map-pin" size={18} color="#10B981" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Toimialue</Text>
                                <Text style={styles.itemSubtitle}>{selectedZonesSubtitle}</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 🌟 4. VIESTINTÄ & TUKI 🌟 */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Viestintä & Tuki</Text>
                    <View style={styles.cardGroup}>
                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                router.push('/driver/conversations');
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                                <Feather name="message-circle" size={18} color="#0284C7" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Keskustelut</Text>
                                <Text style={styles.itemSubtitle}>Avoimet ja suljetut tukipyynnöt</Text>
                            </View>
                            <View style={styles.badgeCount}>
                                <Text style={styles.badgeCountText}>2 avointa</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color="#94A3B8" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>


                    </View>
                </View>

                {/* 🌟 5. ASETUKSET & ULOSKIRJAUTUMINEN 🌟 */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Asetukset</Text>
                    <View style={styles.cardGroup}>
                        <View style={styles.listItem}>
                            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Feather name="bell" size={18} color="#475569" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Keikkailmoitukset</Text>
                                <Text style={styles.itemSubtitle}>Ilmoita uusista vapaista keikoista</Text>
                            </View>
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={(val) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                    setNotificationsEnabled(val);
                                }}
                                trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
                                thumbColor={notificationsEnabled ? '#0284C7' : '#FFFFFF'}
                            />
                        </View>
                    </View>
                </View>

                {/* ULOSKIRJAUTUMINEN */}
                <View style={{ marginTop: 8, marginBottom: 30 }}>
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        onPress={handleLogout}
                        activeOpacity={0.8}
                    >
                        <Feather name="log-out" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                        <Text style={styles.logoutBtnText}>Kirjaudu ulos</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.4,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    driverMainCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverAvatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    driverInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    driverName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        marginRight: 6,
    },
    verifiedBadge: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#0284C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverEmail: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    driverPhone: {
        fontSize: 13,
        color: '#0284C7',
        fontWeight: '600',
        marginTop: 1,
    },
    badgePill: {
        backgroundColor: '#E0F2FE',
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginTop: 6,
    },
    badgePillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#F1F5F9',
        height: '80%',
        alignSelf: 'center',
    },
    section: {
        marginBottom: 22,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        marginLeft: 4,
        marginRight: 4,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    subSectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284C7',
        marginBottom: 6,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    newChatHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    newChatHeaderBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7',
    },
    cardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    itemSeparator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 16,
    },
    badgeCount: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 4,
    },
    badgeCountText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingVertical: 16,
        borderRadius: 18,
    },
    logoutBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#EF4444',
    },
});
