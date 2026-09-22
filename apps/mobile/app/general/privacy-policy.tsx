import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F8F9FD',
    cardBorder: '#F1F5F9',
    primary: '#00C2FF',
    textGray: '#64748B',
};

const PRIVACY_CONTENT = [
    {
        title: "1. Rekisterinpitäjä & Yhteystiedot",
        icon: "shield",
        iconBg: "#E0F2FE",
        iconColor: "#0284C7",
        content: `**Yritys:** Pesuni Oy\n**Sähköposti (Tietosuoja-asiat):** tuki@pesuni.fi\n\nTämä seloste kuvaa, miten Pesuni-mobiilisovellus käsittelee henkilötietoja EU:n yleisen tietosuoja-asetuksen (GDPR) mukaisesti.`,
    },
    {
        title: "2. Kerättävät Henkilötiedot",
        icon: "user-check",
        iconBg: "#DCFCE7",
        iconColor: "#16A34A",
        content: `**Käyttäjän antamat tiedot:** Nimi, puhelinnumero, sähköposti, nouto- ja toimitusosoite sekä profiiliasetukset. Salasana tallennetaan vahvasti hashattuna.\n\n**Maksutiedot:** Emme tallenna korttinumeroita sovellukseen; maksut hoitaa suojattu maksunvälittäjä.\n\n**Tilaustiedot:** Tilauksen sisältö, nouto- ja palautusajat sekä toimitustilan seuranta.`,
    },
    {
        title: "3. Tietojen Käsittelyn Tarkoitus",
        icon: "check-circle",
        iconBg: "#FEF3C7",
        iconColor: "#D97706",
        content: `**Tarkoitukset:**\n- Pyykkien noutojen ja toimitusten hoitaminen\n- Tilausten ja maksujen käsittely\n- Asiakaspalvelu ja yhteydenpito\n- Sovelluksen kehittäminen ja tietoturvan ylläpito\n\n**Oikeusperuste:** Sopimuksen täytäntöönpano ja asiakassuhteen hoitaminen.`,
    },
    {
        title: "4. Tietojen Säilytys ja Luovutus",
        icon: "database",
        iconBg: "#F3E8FF",
        iconColor: "#9333EA",
        content: `**Säilytysaika:** Tietoja säilytetään aktiivisen asiakassuhteen ajan. Kirjanpitolain mukaiset kuitit säilytetään lain vaatiman ajan (6 vuotta).\n\n**Jakaminen:** Tietoja jaetaan ainoastaan palvelun toteuttamiseen osallistuville (pesulakumppanit, kuljettajat ja maksunvälittäjät). Emme koskaan myy tietojasi kolmansille osapuolille.`,
    },
    {
        title: "5. Sinun Oikeutesi",
        icon: "lock",
        iconBg: "#E0F7FF",
        iconColor: "#0284C7",
        content: `Sinulla on oikeus tarkastaa omat tietosi, pyytää virheellisten tietojen oikaisua tai pyytää tilisi ja tietojesi poistamista ("oikeus tulla unohdetuksi") sovelluksen asetuksista tai ottamalla yhteyttä tukeen.`,
    },
    {
        title: "6. Tietoturva",
        icon: "shield",
        iconBg: "#ECFDF5",
        iconColor: "#059669",
        content: `Kaikki tiedonsiirto laitteesi ja palvelimiemme välillä on suojattu **SSL/TLS-salausprotokollalla**. Tietokannat on suojattu tiukoilla käyttöoikeus- ja pääsynhallintakäytännöillä.`,
    },
];

export default function PrivacyPolicyScreen() {
    const router = useRouter();

    const renderContentWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <Text key={index} style={styles.boldText}>
                        {part.substring(2, part.length - 2)}
                    </Text>
                );
            }
            return part;
        });
    };

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
                <Text style={styles.headerTitle}>Tietosuoja & Ehdot</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* HERO BANNER */}
                <View style={styles.heroBanner}>
                    <View style={styles.heroIconBox}>
                        <Feather name="shield" size={24} color="#0284C7" />
                    </View>
                    <View style={styles.heroTextContainer}>
                        <Text style={styles.heroTitle}>Pesuni Oy Tietosuojaseloste</Text>
                        <Text style={styles.heroSubtitle}>
                            Yksityisyytesi ja tietoturvasi ovat meille ensisijaisen tärkeitä.
                        </Text>
                    </View>
                </View>

                {/* KORTIT */}
                {PRIVACY_CONTENT.map((item, index) => (
                    <View key={index} style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                                <Feather name={item.icon as any} size={18} color={item.iconColor} />
                            </View>
                            <Text style={styles.sectionTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.sectionContent}>
                            {renderContentWithBold(item.content)}
                        </Text>
                    </View>
                ))}

                <View style={styles.contactFooter}>
                    <Text style={styles.contactFooterText}>
                        {renderContentWithBold('Kysyttävää tietosuojasta? Ota yhteyttä: **tuki@pesuni.fi**')}
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
    scrollContent: { padding: 16 },
    heroBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        padding: 16,
        borderRadius: 22,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E0F2FE',
    },
    heroIconBox: {
        width: 44,
        height: 44,
        borderRadius: 15,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    heroTextContainer: { flex: 1 },
    heroTitle: { fontSize: 16, fontWeight: '800', color: '#0369A1', marginBottom: 2 },
    heroSubtitle: { fontSize: 12, color: '#0284C7', lineHeight: 16, fontWeight: '500' },
    sectionCard: {
        backgroundColor: COLORS.white,
        borderRadius: 22,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        paddingBottom: 10,
    },
    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
        flex: 1,
    },
    sectionContent: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
    },
    boldText: {
        fontWeight: '700',
        color: COLORS.darkText,
    },
    contactFooter: {
        backgroundColor: '#F1F5F9',
        padding: 16,
        borderRadius: 18,
        alignItems: 'center',
        marginTop: 8,
    },
    contactFooterText: {
        fontSize: 13,
        color: COLORS.textGray,
        textAlign: 'center',
    },
});