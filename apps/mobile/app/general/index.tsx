import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F8F9FD',
    cardBorder: '#F1F5F9',
    textGray: '#64748B',
    primary: '#00C2FF',
    danger: '#EF4444',
};

const LANGUAGES = [
    { id: 'fi', label: 'Suomi', flag: '🇫🇮' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'sv', label: 'Svenska', flag: '🇸🇪' },
];

const PAYMENT_METHODS = [
    { id: 'card', label: 'Korttimaksu (Visa / Mastercard)', icon: 'card-outline', color: '#0284C7' },
    { id: 'apple', label: 'Apple Pay', icon: 'logo-apple', color: '#000000' },
    { id: 'google', label: 'Google Pay', icon: 'logo-google', color: '#EA4335' },
    {
        id: 'mobilepay',
        label: 'MobilePay',
        imageUrl: 'https://avatars.githubusercontent.com/u/22961759?s=280&v=4'
    },
];

export default function GeneralSettingsScreen() {
    const router = useRouter();

    const [langModalVisible, setLangModalVisible] = useState(false);
    const [payModalVisible, setPayModalVisible] = useState(false);
    const [termsModalVisible, setTermsModalVisible] = useState(false);

    const [selectedLang, setSelectedLang] = useState('fi');
    const [selectedPayment, setSelectedPayment] = useState('card');

    const performLogout = async () => {
        try {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;
            router.replace('/auth/login');
        } catch (err) {
            console.error('Logout error:', err);
            Alert.alert('Virhe', 'Uloskirjautuminen epäonnistui');
        }
    };

    const handleLogoutConfirmation = () => {
        Alert.alert("Kirjaudu ulos", "Haluatko varmasti kirjautua ulos sovelluksesta?", [
            { text: "Peruuta", style: "cancel" },
            { text: "Kirjaudu ulos", onPress: performLogout, style: "destructive" }
        ]);
    };

    const versionNumber = Constants.expoConfig?.version || '1.0.0';

    const SettingsItem = ({
        icon,
        iconBg,
        iconColor,
        label,
        onPress,
        isLast = false,
        rightElement
    }: {
        icon: string;
        iconBg: string;
        iconColor: string;
        label: string;
        onPress: () => void;
        isLast?: boolean;
        rightElement?: React.ReactNode;
    }) => (
        <TouchableOpacity
            style={[styles.settingsItem, isLast && styles.settingsItemLast]}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                <Feather name={icon as any} size={18} color={iconColor} />
            </View>

            <Text style={styles.settingsItemText}>{label}</Text>

            <View style={styles.rightContainer}>
                {rightElement}
                <Feather name="chevron-right" size={18} color="#CBD5E1" />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.push('/profile')}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Yleiset</Text>
                    <Text style={styles.versionText}>versio {versionNumber}</Text>
                </View>
                <TouchableOpacity
                    onPress={handleLogoutConfirmation}
                    style={styles.logoutButton}
                    activeOpacity={0.7}
                >
                    <FontAwesome5 name="sign-out-alt" size={16} color={COLORS.danger} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionHeading}>Sovellusasetukset</Text>
                <View style={styles.settingsCard}>
                    <SettingsItem
                        icon="globe"
                        iconBg="#E0F2FE"
                        iconColor="#0284C7"
                        label="Kieli"
                        onPress={() => setLangModalVisible(true)}
                        rightElement={
                            <View style={styles.selectedPill}>
                                <Text style={styles.selectedPillText}>
                                    {LANGUAGES.find(l => l.id === selectedLang)?.flag} {LANGUAGES.find(l => l.id === selectedLang)?.label}
                                </Text>
                            </View>
                        }
                    />
                    <SettingsItem
                        icon="credit-card"
                        iconBg="#DCFCE7"
                        iconColor="#16A34A"
                        label="Ensisijainen maksutapa"
                        onPress={() => setPayModalVisible(true)}
                        rightElement={
                            <View style={styles.selectedPill}>
                                <Text style={styles.selectedPillText}>
                                    {PAYMENT_METHODS.find(p => p.id === selectedPayment)?.label.split(' ')[0]}
                                </Text>
                            </View>
                        }
                    />
                    <SettingsItem
                        icon="shopping-bag"
                        iconBg="#F3E8FF"
                        iconColor="#9333EA"
                        label="Ostohistoria & Kuitit"
                        onPress={() => router.push('/general/orders')}
                    />
                    <SettingsItem
                        icon="file-text"
                        iconBg="#FEF3C7"
                        iconColor="#D97706"
                        label="Käyttöehdot & Sopimukset"
                        onPress={() => setTermsModalVisible(true)}
                        isLast={true}
                    />
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* KIELI MODAALI */}
            <Modal animationType="slide" transparent={true} visible={langModalVisible} onRequestClose={() => setLangModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Valitse kieli</Text>
                            <TouchableOpacity onPress={() => setLangModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={COLORS.darkText} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={LANGUAGES}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const isSelected = selectedLang === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                                        activeOpacity={0.7}
                                        onPress={() => { setSelectedLang(item.id); setLangModalVisible(false); }}
                                    >
                                        <View style={styles.modalItemRow}>
                                            <Text style={styles.flagText}>{item.flag}</Text>
                                            <Text style={[styles.modalItemLabel, isSelected && styles.selectedLabel]}>{item.label}</Text>
                                        </View>
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* MAKSUTAPA MODAALI */}
            <Modal animationType="slide" transparent={true} visible={payModalVisible} onRequestClose={() => setPayModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ensisijainen maksutapa</Text>
                            <TouchableOpacity onPress={() => setPayModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={COLORS.darkText} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={PAYMENT_METHODS}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const isSelected = selectedPayment === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                                        activeOpacity={0.7}
                                        onPress={() => { setSelectedPayment(item.id); setPayModalVisible(false); }}
                                    >
                                        <View style={styles.modalItemRow}>
                                            {item.id === 'mobilepay' ? (
                                                <Image source={{ uri: item.imageUrl }} style={styles.paymentImage} />
                                            ) : (
                                                <Ionicons name={item.icon as any} size={22} color={item.color} style={{ marginRight: 14 }} />
                                            )}
                                            <Text style={[styles.modalItemLabel, isSelected && styles.selectedLabel]}>{item.label}</Text>
                                        </View>
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* KÄYTTÖEHDOT MODAALI */}
            <Modal animationType="slide" transparent={true} visible={termsModalVisible} onRequestClose={() => setTermsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '82%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Käyttöehdot</Text>
                            <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={COLORS.darkText} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ paddingVertical: 6 }}>
                            <Text style={styles.termsText}>
                                <Text style={styles.termsSubTitle}>1. Yleistä{"\n"}</Text>
                                Tervetuloa käyttämään Pesuni-palvelua. Käyttämällä tätä sovellusta sitoudut noudattamaan näitä käyttöehtoja.{"\n\n"}

                                <Text style={styles.termsSubTitle}>2. Palvelun kuvaus{"\n"}</Text>
                                Pesuni tarjoaa helpon nouto- ja kotiinkuljetuspesulapalvelun. Pidätämme oikeuden kehittää ja päivittää palvelun sisältöä.{"\n\n"}

                                <Text style={styles.termsSubTitle}>3. Tilaukset ja maksut{"\n"}</Text>
                                Kaikki tilaukset vahvistetaan tilauksen yhteydessä. Maksut veloitetaan valitsemallasi maksutavalla turvallisesti.{"\n\n"}

                                <Text style={styles.termsSubTitle}>4. Peruutusehdot{"\n"}</Text>
                                Voit muuttaa tai peruuttaa noutoajan maksutta ennen kuljettajan lähtöä noutoreitille.{"\n\n"}

                                <Text style={styles.termsSubTitle}>5. Vastuunrajoitus & Laatu{"\n"}</Text>
                                Pesulamme noudattavat tarkkoja alan laatustandardeja ja tekstiilien valmistajan pesuohjeita.{"\n\n"}

                                <Text style={styles.termsSubTitle}>6. Tietosuoja{"\n"}</Text>
                                Käsittelemme tietojasi EU:n GDPR-asetusten mukaisesti luottamuksellisesti.
                            </Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.closeModalButton}
                            onPress={() => setTermsModalVisible(false)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.closeModalButtonText}>Sulje ja palaa</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
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
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
    versionText: { fontSize: 11, color: COLORS.textGray, marginTop: 1, fontWeight: '500' },
    logoutButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: { flex: 1, padding: 16 },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginLeft: 4,
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
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    settingsItemLast: { borderBottomWidth: 0 },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    settingsItemText: { flex: 1, fontSize: 15, color: COLORS.darkText, fontWeight: '700' },
    rightContainer: { flexDirection: 'row', alignItems: 'center' },
    selectedPill: {
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        marginRight: 8,
    },
    selectedPillText: { color: '#0284C7', fontSize: 12, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 36,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.darkText },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginBottom: 6,
    },
    modalItemSelected: {
        backgroundColor: '#F0F9FF',
    },
    modalItemRow: { flexDirection: 'row', alignItems: 'center' },
    flagText: { fontSize: 22, marginRight: 14 },
    modalItemLabel: { fontSize: 15, color: COLORS.darkText, fontWeight: '600' },
    selectedLabel: { fontWeight: '800', color: COLORS.primary },
    paymentImage: {
        width: 26,
        height: 26,
        marginRight: 14,
        borderRadius: 6,
    },
    termsText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
    },
    termsSubTitle: {
        fontWeight: '800',
        fontSize: 15,
        color: COLORS.darkText,
    },
    closeModalButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    closeModalButtonText: {
        color: COLORS.white,
        fontWeight: '800',
        fontSize: 16,
    }
});