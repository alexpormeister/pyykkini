import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0A1B32',
    textGray: '#6B7280',
    primary: '#00c2ff',
    lightGray: '#F8F9FD',
    borderColor: '#EFEFEF',
};

const TERMS_CONTENT = {
    effectiveDate: 'Voimassa: 20. Marraskuu 2025',
    sections: [
        {
            title: '1. Palvelun kuvaus ja käyttö',
            content: 'Palvelu tarjoaa tilauspohjaisia pesu- ja noutopalveluita sopimuksen mukaisesti. Käyttäjä sitoutuu antamaan tarkat nouto- ja toimitusosoitetiedot. Palvelu varaa oikeuden muuttaa palveluiden sisältöä ja hintoja ilmoittamalla siitä etukäteen.',
        },
        {
            title: '2. Tilaukset ja Maksut',
            content: 'Kaikki tilaukset ovat sitovia, kun tilaus on vahvistettu ja maksu on hyväksytty. Maksut käsitellään ulkoisten maksupalveluiden (esim. Stripe/MobilePay) kautta. Käyttöehdot on hyväksyttävä ennen maksun suorittamista.',
        },
        {
            title: '3. Nouto- ja Toimitusajat',
            content: 'Palvelu pyrkii noutamaan ja toimittamaan tuotteet valitun aikaikkunan mukaisesti, mutta pidättää oikeuden viivästyksiin olosuhteiden muuttuessa (esim. ruuhka tai sääolosuhteet).',
        },
        {
            title: '4. Peruutusoikeus ja Hyvitykset',
            content: 'Peruutukset on tehtävä viimeistään 12 tuntia ennen vahvistettua noutoaikaa. Myöhästyneistä peruutuksista tai käyttämättömistä palveluista voidaan periä peruutusmaksu. Palautukset käsitellään tapauskohtaisesti.',
        },
        {
            title: '5. Vastuunrajoitus',
            content: 'Palvelun tarjoaja ei vastaa epäsuorista tai satunnaisista vahingoista. Vahingonkorvausvastuu rajoittuu aina tilauksen arvoon.',
        },
    ],
};

export default function TermsScreen() {
    const router = useRouter();

    const handleGoBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Käyttöehdot</Text>

                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.dateText}>{TERMS_CONTENT.effectiveDate}</Text>

                {TERMS_CONTENT.sections.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionContent}>{section.content}</Text>
                    </View>
                ))}

                <Text style={styles.footerText}>
                    Käyttämällä palveluamme hyväksyt yllä mainitut ehdot.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 15,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderColor,
    },
    backButton: {
        padding: 5,
        width: 40, // Varmistaa keskityksen
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.darkText,
        flexGrow: 1,
        textAlign: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    dateText: {
        fontSize: 14,
        color: COLORS.textGray,
        marginBottom: 25,
        textAlign: 'center',
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
        paddingBottom: 4,
    },
    sectionContent: {
        fontSize: 15,
        color: COLORS.textGray,
        lineHeight: 22,
    },
    footerText: {
        fontSize: 14,
        color: COLORS.darkText,
        marginTop: 10,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: '600',
    }
});