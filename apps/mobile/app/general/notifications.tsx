import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'pesuni_notification_preferences';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F8F9FD',
    cardBorder: '#F1F5F9',
    textGray: '#64748B',
    primary: '#00C2FF',
    successGreen: '#10B981',
};

const NOTIFICATION_SETTINGS = [
    {
        title: "Tilaukset & Toimitus",
        data: [
            {
                id: 'order_status',
                label: 'Tilauksen tilan päivitykset',
                desc: 'Saat ilmoituksen kun pyykkisi on noudettu, pesty tai valmis.',
                icon: 'package',
                iconBg: '#E0F2FE',
                iconColor: '#0284C7',
                testTitle: 'Pyykit pesty ja valmiina! ✨',
                testBody: 'Tilauksesi #1049 on viikattu ja valmiina toimitettavaksi.',
            },
            {
                id: 'delivery_update',
                label: 'Toimituksen arvioitu saapuminen',
                desc: 'Reaaliaikaiset tiedot kuljettajan saapumisesta ovesi taakse.',
                icon: 'truck',
                iconBg: '#DCFCE7',
                iconColor: '#16A34A',
                testTitle: 'Kuljettaja on matkalla! 🚚',
                testBody: 'Kuljettaja Markus saapuu ovesi taakse arviolta 8 minuutin kuluttua.',
            },
        ]
    },
    {
        title: "Edut & Tiedotteet",
        data: [
            {
                id: 'marketing_offers',
                label: 'Erikoisalennukset & Kampanjat',
                desc: 'Saat tiedon sesonkialennuksista ja kampanjakoodeista.',
                icon: 'tag',
                iconBg: '#FEF3C7',
                iconColor: '#D97706',
                testTitle: 'Viikonloppuetu: -20% ALE! 🔥',
                testBody: 'Käytä koodia VIIKONLOPPU20 ja säästä kaikista peitoista.',
            },
            {
                id: 'app_news',
                label: 'Pesuni uutiset ja vinkit',
                desc: 'Pyykinhoitovinkkejä ja tietoa uusista pesupalveluista.',
                icon: 'info',
                iconBg: '#F3E8FF',
                iconColor: '#9333EA',
                testTitle: 'Uutta Pesunissa 🌿',
                testBody: 'Ekopesu on nyt saatavilla kaikille untuvatuotteille!',
            },
            {
                id: 'reminders',
                label: 'Piste- ja hyvitysmuistutukset',
                desc: 'Muistutus kertyneistä Pesupisteistä ennen niiden vanhentumista.',
                icon: 'gift',
                iconBg: '#FCE7F3',
                iconColor: '#DB2777',
                testTitle: 'Sinulla on 750 käyttämätöntä pistettä! 🎁',
                testBody: 'Käytä pisteesi seuraavassa tilauksessasi ja säästä 7,50 €.',
            },
        ]
    },
];

interface ToggleItemProps {
    item: any;
    isEnabled: boolean;
    onToggle: (id: string, value: boolean) => void;
    isLast?: boolean;
}

const NotificationToggleItem: React.FC<ToggleItemProps> = ({ item, isEnabled, onToggle, isLast }) => (
    <View style={[styles.settingsItem, isLast && styles.settingsItemLast]}>
        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
            <Feather name={item.icon} size={18} color={item.iconColor} />
        </View>

        <View style={styles.itemTextContainer}>
            <Text style={styles.settingsItemTitle}>{item.label}</Text>
            <Text style={styles.settingsItemSubtitle}>{item.desc}</Text>
        </View>

        <Switch
            trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
            thumbColor={COLORS.white}
            ios_backgroundColor="#E2E8F0"
            onValueChange={(value) => onToggle(item.id, value)}
            value={isEnabled}
        />
    </View>
);

export default function NotificationSettingsScreen() {
    const router = useRouter();

    const [settingsState, setSettingsState] = useState({
        order_status: true,
        delivery_update: true,
        marketing_offers: true,
        app_news: false,
        reminders: true,
    });

    // 🔔 TESTI-ILMOITUSBANNERI 🔔
    const [bannerVisible, setBannerVisible] = useState(false);
    const [bannerData, setBannerData] = useState({ title: '', body: '' });
    const bannerTranslateY = useRef(new Animated.Value(-300)).current;
    const bannerOpacity = useRef(new Animated.Value(0)).current;
    const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setSettingsState(JSON.parse(stored));
                }

                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('notification_settings')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (profile?.notification_settings) {
                        setSettingsState(prev => ({
                            ...prev,
                            ...profile.notification_settings,
                        }));
                    }
                }
            } catch (e) {
                console.log('Notification load error:', e);
            }
        };

        loadPreferences();
    }, []);

    const handleToggle = async (id: string, value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        const updated = {
            ...settingsState,
            [id]: value,
        };
        setSettingsState(updated);

        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ notification_settings: updated })
                    .eq('user_id', user.id);
            }
        } catch (e) {
            console.log('Notification save error:', e);
        }
    };

    const dismissBanner = () => {
        if (activeAnimationRef.current) {
            activeAnimationRef.current.stop();
        }

        Animated.parallel([
            Animated.timing(bannerTranslateY, {
                toValue: -300,
                duration: 250,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(bannerOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setBannerVisible(false);
        });
    };

    const triggerNotificationPreview = (title: string, body: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setBannerData({ title, body });
        setBannerVisible(true);

        if (activeAnimationRef.current) {
            activeAnimationRef.current.stop();
        }

        bannerTranslateY.setValue(-300);
        bannerOpacity.setValue(0);

        const anim = Animated.sequence([
            Animated.parallel([
                Animated.timing(bannerTranslateY, {
                    toValue: 0,
                    duration: 350,
                    easing: Easing.out(Easing.back(1.2)),
                    useNativeDriver: true,
                }),
                Animated.timing(bannerOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]),
            Animated.delay(3500),
            Animated.parallel([
                Animated.timing(bannerTranslateY, {
                    toValue: -300,
                    duration: 300,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(bannerOpacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]),
        ]);

        activeAnimationRef.current = anim;
        anim.start(() => {
            setBannerVisible(false);
        });
    };

    const handleOpenPhoneSettings = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await Linking.openSettings();
        } catch (error) {
            console.log('Open settings error:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* 🚀 TESTI-ILMOITUSBANNERI (100% PIILOSSA KUN EI AKTIIVINEN) 🚀 */}
            <Animated.View
                style={[
                    styles.notificationBanner,
                    {
                        opacity: bannerOpacity,
                        transform: [{ translateY: bannerTranslateY }],
                    },
                ]}
                pointerEvents={bannerVisible ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={styles.bannerInner}
                    onPress={dismissBanner}
                    activeOpacity={0.9}
                >
                    <View style={styles.bannerIconBox}>
                        <Feather name="bell" size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.bannerTextWrapper}>
                        <View style={styles.bannerHeaderRow}>
                            <Text style={styles.bannerAppTag}>PESUNI ILMOITUS</Text>
                            <Text style={styles.bannerTimeTag}>Nyt</Text>
                        </View>
                        <Text style={styles.bannerTitle}>{bannerData.title}</Text>
                        <Text style={styles.bannerBody}>{bannerData.body}</Text>
                    </View>
                    <TouchableOpacity onPress={dismissBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="x" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Animated.View>

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ilmoitukset</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 📱 PUHELIMEN JÄRJESTELMÄASETUSTEN AVAUSKORTTI 📱 */}
                <View style={styles.systemCard}>
                    <View style={styles.systemLeft}>
                        <View style={styles.systemIconBox}>
                            <Feather name="settings" size={20} color="#0284C7" />
                        </View>
                        <View style={styles.systemTextWrapper}>
                            <Text style={styles.systemTitle}>Laitteen ilmoitusasetukset</Text>
                            <Text style={styles.systemSubtitle}>
                                Hallitse ilmoituslupia, ääniä ja bannerityyliä suoraan puhelimesi asetuksista.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.openSettingsBtn}
                        onPress={handleOpenPhoneSettings}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.openSettingsBtnText}>Avaa asetukset</Text>
                        <Feather name="external-link" size={14} color="#0284C7" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>

                {/* 🌟 TESTAA ILMOITUSTA PIKAKORTTI 🌟 */}
                <View style={styles.testCard}>
                    <View style={styles.testLeft}>
                        <View style={styles.testIconCircle}>
                            <Feather name="zap" size={18} color="#D97706" />
                        </View>
                        <View>
                            <Text style={styles.testCardTitle}>Kokeile ilmoitusta</Text>
                            <Text style={styles.testCardSubtitle}>Katso miltä toimitusilmoitus näyttää</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={() => triggerNotificationPreview('Kuljettaja on matkalla! 🚚', 'Kuljettaja Markus saapuu noutamaan pyykkisi 8 minuutin kuluttua.')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.testButtonText}>Testaa</Text>
                    </TouchableOpacity>
                </View>

                {NOTIFICATION_SETTINGS.map((section) => (
                    <View key={section.title} style={styles.settingsGroup}>
                        <Text style={styles.groupTitle}>{section.title}</Text>

                        <View style={styles.settingsCard}>
                            {section.data.map((setting, settingIndex) => (
                                <NotificationToggleItem
                                    key={setting.id}
                                    item={setting}
                                    isEnabled={settingsState[setting.id as keyof typeof settingsState]}
                                    onToggle={handleToggle}
                                    isLast={settingIndex === section.data.length - 1}
                                />
                            ))}
                        </View>
                    </View>
                ))}
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
    notificationBanner: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 20,
        left: 16,
        right: 16,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 14,
        zIndex: 999999,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
    },
    bannerInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bannerIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#00C2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    bannerTextWrapper: {
        flex: 1,
        marginRight: 10,
    },
    bannerHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    bannerAppTag: {
        fontSize: 10,
        fontWeight: '800',
        color: '#38BDF8',
        letterSpacing: 0.6,
    },
    bannerTimeTag: {
        fontSize: 10,
        color: '#94A3B8',
    },
    bannerTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 1,
    },
    bannerBody: {
        fontSize: 12,
        color: '#CBD5E1',
        lineHeight: 16,
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
    systemCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E0F2FE',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
    },
    systemLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    systemIconBox: {
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    systemTextWrapper: {
        flex: 1,
    },
    systemTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 3,
    },
    systemSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        lineHeight: 17,
    },
    openSettingsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        paddingVertical: 10,
        borderRadius: 12,
    },
    openSettingsBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0284C7',
    },
    testCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    testLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    testIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    testCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    testCardSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 1,
    },
    testButton: {
        backgroundColor: '#0284C7',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    testButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '800',
    },
    settingsGroup: {
        marginBottom: 20,
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textGray,
        marginBottom: 10,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    settingsCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    settingsItemLast: {
        borderBottomWidth: 0,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    itemTextContainer: {
        flex: 1,
        marginRight: 10,
    },
    settingsItemTitle: {
        fontSize: 15,
        color: COLORS.darkText,
        fontWeight: '700',
        marginBottom: 2,
    },
    settingsItemSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        lineHeight: 16,
    },
});