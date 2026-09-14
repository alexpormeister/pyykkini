import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ProfileHeader from '../../components/profile/ProfileHeader';
import SettingsList from "../../components/profile/SettingsList";
import StatsBar from "../../components/profile/StatsBar";
import { performLogout } from '../../lib/authHelper';
import { supabase } from '../../lib/supabase';

const ProfileScreen = () => {
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState(0);
    const [points, setPoints] = useState(0);
    const [orderCount, setOrderCount] = useState(0);
    const [savedTextilesCount, setSavedTextilesCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfileStats = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                setPoints(0);
                setOrderCount(0);
                setSavedTextilesCount(0);
                setUnreadCount(0);
                setIsLoading(false);
                return;
            }

            // 1. Hae pisteet profiilista
            const { data: profileData } = await supabase
                .from('profiles')
                .select('points_balance')
                .eq('user_id', user.id)
                .maybeSingle();

            setPoints(profileData?.points_balance || 0);

            // 2. Laske tilausten määrä
            const { count: countData } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            setOrderCount(countData || 0);

            // 3. Laske tallennettujen tekstiilien määrä
            const { count: textilesCount } = await supabase
                .from('customer_saved_textiles')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            setSavedTextilesCount(textilesCount || 0);

            // 4. Hae lukemattomat viestit (vain AVOIMISTA keskusteluista)
            const { data: openUnreadChats } = await supabase
                .from('support_chats')
                .select('id, is_read, status')
                .eq('user_id', user.id)
                .neq('status', 'closed')
                .eq('is_read', false);

            setUnreadCount(openUnreadChats?.length || 0);

        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Päivitetään tiedot aina kun profiilisivu aktivoituu
    useFocusEffect(
        useCallback(() => {
            fetchProfileStats();
        }, [fetchProfileStats])
    );

    useEffect(() => {
        fetchProfileStats();

        const profileSubscription = supabase
            .channel('profile-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfileStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, () => fetchProfileStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_saved_textiles' }, () => fetchProfileStats())
            .subscribe();

        return () => {
            supabase.removeChannel(profileSubscription);
        };
    }, [fetchProfileStats]);

    const handleEditPress = () => router.push('/general/personal-data');

    const handleLogoutPress = () => {
        Alert.alert(
            'Kirjaudu ulos',
            'Haluatko varmasti kirjautua ulos sovelluksesta?',
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

    const accountSettings = [
        {
            id: 'saved-textiles',
            label: 'Omat tekstiilit',
            icon: 'tshirt',
            iconBg: '#E0F7FF',
            iconColor: '#0284C7',
            badge: savedTextilesCount > 0 ? `${savedTextilesCount} kpl` : undefined,
            onPress: () => router.push('/general/saved-textiles')
        },
        {
            id: '1',
            label: 'Yhteystiedot',
            icon: 'user-alt',
            iconBg: '#E0F2FE',
            iconColor: '#0284C7',
            onPress: () => router.push('/general/personal-data')
        },
        {
            id: '2',
            label: 'Ostohistoria',
            icon: 'shopping-bag',
            iconBg: '#F3E8FF',
            iconColor: '#9333EA',
            onPress: () => router.push('/general/orders')
        },
        {
            id: '3',
            label: 'Kutsu kaveri & tienaa 5 €',
            icon: 'gift',
            iconBg: '#FEF3C7',
            iconColor: '#D97706',
            onPress: () => router.push('/general/referral')
        },
        {
            id: '4',
            label: 'Ilmoitukset',
            icon: 'bell',
            iconBg: '#FCE7F3',
            iconColor: '#DB2777',
            onPress: () => router.push('/general/notifications')
        },
        {
            id: '5',
            label: 'Yleiset asetukset',
            icon: 'cog',
            iconBg: '#F1F5F9',
            iconColor: '#475569',
            onPress: () => router.push('/general')
        },
    ];

    const supportSettings = [
        {
            id: 'admin-dispatch',
            label: 'Ajojärjestely & Keikkataulu',
            icon: 'clipboard-list',
            iconBg: '#E0F2FE',
            iconColor: '#0284C7',
            badge: 'Live',
            onPress: () => router.push('/admin/dispatch' as any)
        },
        {
            id: '6',
            label: 'Keskustelut',
            icon: 'comments',
            iconBg: '#DCFCE7',
            iconColor: '#16A34A',
            badge: unreadCount,
            onPress: () => router.push('/general/chat')
        },
        {
            id: '7',
            label: 'Tietosuojakäytäntö',
            icon: 'shield-alt',
            iconBg: '#F1F5F9',
            iconColor: '#475569',
            onPress: () => router.push('/general/privacy-policy')
        },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#00C2FF" translucent={true} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. YLÄOSA: Taustaliukuväri, otsikko, avatar ja nimi */}
                <ProfileHeader
                    onEditPress={handleEditPress}
                    onLogoutPress={handleLogoutPress}
                />

                {/* 2. STATS-PALKKI: Tilaukset ja Pisteet */}
                <View style={styles.statsWrapper}>
                    <StatsBar
                        orderCount={orderCount}
                        points={points}
                        onOrdersPress={() => router.push('/general/orders')}
                        onPointsPress={() => router.push('/general/referral')}
                    />
                </View>

                {/* 3. ASETUSLISTAT */}
                <View style={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Tili ja toiminnot</Text>
                        <SettingsList items={accountSettings} />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Asiakaspalvelu & Tietosuoja</Text>
                        <SettingsList items={supportSettings} />
                    </View>

                    {/* 4. ULOSKIRJAUTUMINEN */}
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogoutPress}
                        activeOpacity={0.8}
                    >
                        <Feather name="log-out" size={18} color="#EF4444" style={styles.logoutIcon} />
                        <Text style={styles.logoutText}>Kirjaudu ulos</Text>
                    </TouchableOpacity>

                    {/* SOVELLUSVERSIO */}
                    <Text style={styles.versionText}>Versio 1.0.0 (Build 42)</Text>
                </View>
            </ScrollView>
        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 110,
    },
    statsWrapper: {
        marginTop: -30,
        zIndex: 10,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginLeft: 4,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        borderRadius: 18,
        marginTop: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    logoutIcon: {
        marginRight: 8,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 10,
    },
});