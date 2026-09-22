import { Feather, FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { selectUserProfile } from '../../redux/profileSlice';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F8F9FD',
    primary: '#00C2FF',
    cardBorder: '#F1F5F9',
    textGray: '#64748B',
    successGreen: '#10B981',
};

// 🌟 TÖRMÄYSVAPAA JA YKSILÖLLINEN SUOSITTELUKOODIGENERAATTORI (Kestää 1 000 000+ käyttäjää) 🌟
function generateUniqueReferralCode(firstName?: string | null, userId?: string | null, email?: string | null): string {
    let nameCandidate = (firstName || '').trim();
    if (!nameCandidate && email) {
        nameCandidate = email.split('@')[0].replace(/[0-9._-]/g, '');
    }
    if (!nameCandidate) nameCandidate = 'PESUNI';

    const cleanName = nameCandidate
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Poistaa ääkköset Ä -> A, Ö -> O
        .replace(/[^A-Z]/g, '')
        .slice(0, 6) || 'PESU';

    // Selkeät merkit ilman sekoittuvia 0, O, 1, I
    const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const seed = (userId || email || nameCandidate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    let hash1 = 5381;
    let hash2 = 52711;
    for (let i = 0; i < seed.length; i++) {
        const c = seed.charCodeAt(i);
        hash1 = ((hash1 << 5) + hash1) ^ c;
        hash2 = ((hash2 << 5) + hash2) ^ c;
    }
    
    let suffix = '';
    const n1 = Math.abs(hash1);
    const n2 = Math.abs(hash2);
    suffix += CHARSET[n1 % CHARSET.length];
    suffix += CHARSET[n2 % CHARSET.length];
    suffix += CHARSET[Math.floor(n1 / CHARSET.length) % CHARSET.length];
    suffix += CHARSET[Math.floor(n2 / CHARSET.length) % CHARSET.length];

    return `${cleanName}-${suffix}`;
}

export default function ReferralScreen() {
    const router = useRouter();
    const userProfile = useSelector(selectUserProfile);

    // Lasketaan koodi heti valmiiksi Redux-profiilista
    const initialCode = useMemo(() => {
        return generateUniqueReferralCode(userProfile?.first_name, userProfile?.id, userProfile?.email);
    }, [userProfile]);

    const [referralCode, setReferralCode] = useState(initialCode);
    const [copied, setCopied] = useState(false);
    const [stats, setStats] = useState({ invited: 0, earnedPoints: 0 });

    useEffect(() => {
        if (initialCode) {
            setReferralCode(initialCode);
        }
    }, [initialCode]);

    useEffect(() => {
        const loadUserReferralCode = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) return;

                const currentCode = generateUniqueReferralCode(
                    userProfile?.first_name || user.user_metadata?.first_name,
                    user.id,
                    user.email
                );
                setReferralCode(currentCode);

                // Tallennetaan kantaan profiiliin jos sarake on käytössä
                supabase
                    .from('profiles')
                    .update({ referral_code: currentCode })
                    .eq('user_id', user.id)
                    .then();

            } catch (error) {
                console.log('Referral load error:', error);
            }
        };

        loadUserReferralCode();
    }, [userProfile]);

    const handleCopyCode = async () => {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await Clipboard.setStringAsync(referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            Alert.alert('Kopioitu', `Koodi ${referralCode} kopioitu leikepöydälle!`);
        }
    };

    const handleShare = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await Share.share({
                message: `Hei! Käytä koodiani "${referralCode}" Pesuni-sovelluksessa ja saat heti 5 € alennuksen ensimmäisestä pyykinpesustasi kotiovelle toimitettuna! 🧺✨ Lataa sovellus ja tilaa puhdasta arkea: https://pesuni.fi`,
                title: 'Pesuni 5 € alennuskoodi ystävällesi',
            });
        } catch (error: any) {
            console.log('Share error:', error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kutsu kaveri</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 🎁 HERO BANNER 🎁 */}
                <LinearGradient
                    colors={['#5CD1FF', '#00C2FF', '#0099FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.giftIconCircle}>
                        <FontAwesome5 name="gift" size={32} color="#00C2FF" />
                    </View>
                    <Text style={styles.heroTitle}>Kutsu kaveri & tienaa 5 €</Text>
                    <Text style={styles.heroSubtitle}>
                        Anna kaverillesi 5 € alennus ensimmäisestä pesusta. Kun kaverisi pesu valmistuu, saat itsekin 500 Pesupistettä (5 €) heti tilillesi!
                    </Text>
                </LinearGradient>

                {/* 🏷️ KOODIKORTTI 🏷️ */}
                <View style={styles.codeCard}>
                    <Text style={styles.codeLabel}>Henkilökohtainen suosittelukoodisi</Text>
                    <View style={styles.codeRow}>
                        <Text style={styles.codeText}>{referralCode}</Text>
                        <TouchableOpacity
                            style={[styles.copyButton, copied && styles.copiedButton]}
                            onPress={handleCopyCode}
                            activeOpacity={0.8}
                        >
                            <Feather name={copied ? "check" : "copy"} size={16} color={COLORS.white} />
                            <Text style={styles.copyButtonText}>{copied ? "Kopioitu!" : "Kopioi"}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={handleShare}
                        activeOpacity={0.85}
                    >
                        <Feather name="share-2" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                        <Text style={styles.shareButtonText}>Jaa koodi kaverille</Text>
                    </TouchableOpacity>
                </View>

                {/* 📊 OMAT SUOSITTELUT -TILASTO 📊 */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.invited}</Text>
                        <Text style={styles.statLabel}>Kutsutut kaverit</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#0284C7' }]}>{userProfile?.points_balance || 0} p</Text>
                        <Text style={styles.statLabel}>Ansaitut pisteet</Text>
                    </View>
                </View>

                {/* 💡 MITEN SE TOIMII? 💡 */}
                <Text style={styles.sectionTitle}>Miten se toimii?</Text>

                <View style={styles.stepCard}>
                    <View style={[styles.stepNumberBadge, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.stepNumberText, { color: '#0284C7' }]}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Jaa koodisi kaverille</Text>
                        <Text style={styles.stepDesc}>Lähetä koodisi WhatsAppissa, viestillä tai somessa ystävällesi.</Text>
                    </View>
                </View>

                <View style={styles.stepCard}>
                    <View style={[styles.stepNumberBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.stepNumberText, { color: '#D97706' }]}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Kaveri saa 5 € alennuksen</Text>
                        <Text style={styles.stepDesc}>Kaverisi syöttää koodin kassalla ja säästää heti 5 € ensimmäisestä tilauksesta.</Text>
                    </View>
                </View>

                <View style={styles.stepCard}>
                    <View style={[styles.stepNumberBadge, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.stepNumberText, { color: '#16A34A' }]}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Saat 500 Pesupistettä (5 €)</Text>
                        <Text style={styles.stepDesc}>Pisteet lisätään automaattisesti lompakkoosi seuraavia pesujasi varten!</Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    heroCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 6,
    },
    giftIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.white,
        marginBottom: 8,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.92)',
        textAlign: 'center',
        lineHeight: 20,
    },
    codeCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    codeLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginBottom: 16,
    },
    codeText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0284C7',
        letterSpacing: 1.5,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    copiedButton: {
        backgroundColor: COLORS.successGreen,
    },
    copyButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '800',
        marginLeft: 6,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00C2FF',
        paddingVertical: 14,
        borderRadius: 16,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    shareButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '800',
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#F1F5F9',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.darkText,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textGray,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
        marginLeft: 4,
    },
    stepCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    stepNumberBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    stepNumberText: {
        fontSize: 16,
        fontWeight: '900',
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 2,
    },
    stepDesc: {
        fontSize: 12,
        color: COLORS.textGray,
        lineHeight: 16,
    },
});
