import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
);

const SubTitle = ({ title }: { title: string }) => (
    <Text style={styles.subTitle}>{title}</Text>
);

const Paragraph = ({ text }: { text: string }) => (
    <Text style={styles.paragraph}>{text}</Text>
);

export default function TermsAndPrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Käyttöehdot ja tietosuoja</Text>
            </View>

            <ScrollView style={styles.scrollView}>

                <SectionTitle title="Käyttöehdot" />
                <Paragraph text={`Päivitetty viimeksi: [LISÄÄ PÄIVÄMÄÄRÄ]`} />

                <SubTitle title="1. Palvelun kuvaus" />
                <Paragraph text="Tähän tulee kuvaus siitä, mitä palvelusi (Pesuni) tekee. Esimerkiksi: 'Pesuni tarjoaa nouto- ja palautuspalvelun pyykinpesulle. Käyttäjä voi tilata pesun sovelluksen kautta, ja palvelu noutaa, pesee, kuivaa, viikkaa ja palauttaa pyykin käyttäjälle.'" />

                <SubTitle title="2. Käyttäjän vastuut" />
                <Paragraph text="Tähän tulee kuvata, mitä käyttäjältä odotetaan. Esimerkiksi: 'Käyttäjä on vastuussa taskujen tyhjentämisestä, oikeiden pesuohjeiden antamisesta (tarvittaessa) ja siitä, että on tavoitettavissa sovittuna nouto- ja palautusaikana.'" />

                <SubTitle title="3. Hinnat ja maksaminen" />
                <Paragraph text="Tähän tulee kuvata, miten hinnoittelu toimii (esim. painon mukaan, kiinteä hinta per koneellinen) ja miten maksut käsitellään (esim. 'Maksu veloitetaan automaattisesti käyttäjän sovellukseen lisäämältä maksukortilta, kun pesu on suoritettu.')" />

                <SubTitle title="4. Vastuunrajoitus (ERITTÄIN TÄRKEÄ)" />
                <Paragraph text="Tämä on lakimiehen kanssa laadittava kohta. Mitä tapahtuu, jos vaate katoaa tai vaurioituu pesussa? Mikä on korvausvastuusi? Esimerkiksi: 'Pesuni noudattaa äärimmäistä huolellisuutta, mutta emme ole vastuussa normaalista kulumisesta, värin haalistumisesta tai aiemmin syntyneistä vaurioista. Korvausvastuumme kadonneesta tai vaurioituneesta vaatteesta rajoittuu [X] euroon per tuote.'" />

                <SectionTitle title="Tietosuojaseloste" />
                <Paragraph text={`Päivitetty viimeksi: [LISÄÄ PÄIVÄMÄÄRÄ]`} />

                <SubTitle title="1. Rekisterinpitäjä" />
                <Paragraph text="Tähän tulee yrityksesi virallinen nimi ja yhteystiedot. Esimerkiksi: 'Pesuni Oy (Y-tunnus: 1234567-8), Osoite, Sähköposti.'" />

                <SubTitle title="2. Mitä tietoja keräämme?" />
                <Paragraph text="Listaa tässä, mitä tietoja keräät. Esimerkiksi: 'Keräämme tietoja, jotka annat rekisteröityessäsi, kuten: Nimi (first_name, last_name), Sähköposti (email), Puhelinnumero (phone), Osoite (address noutoa varten). Keräämme myös maksutietoja (käsitellään Stripen/muun kautta) ja tietoja tilauksistasi.'" />

                <SubTitle title="3. Mihin käytämme tietojasi?" />
                <Paragraph text="Listaa tässä, miksi keräät tietoja (GDPR vaatii). Esimerkiksi: 'Käytämme tietojasi palvelun toimittamiseen (nouto ja palautus osoitteeseesi), maksujen käsittelyyn, asiakaspalveluun ja lain vaatimien velvoitteiden noudattamiseen.'" />

                <SubTitle title="4. Tietojen jakaminen kolmansille osapuolille" />
                <Paragraph text="Kerro, jaatko tietoja muille. Esimerkiksi: 'Emme myy tietojasi. Saatamme jakaa osoite- ja yhteystietosi kuljettajillemme toimitusta varten. Maksutietosi käsitellään maksupalveluntarjoajamme [Esim. Stripe] kautta.'" />

                <SubTitle title="5. Oikeutesi" />
                <Paragraph text="Kerro käyttäjän oikeuksista (GDPR). Esimerkiksi: 'Sinulla on oikeus tarkistaa, korjata tai poistaa sinusta tallentamamme tiedot. Voit tehdä tämän profiilisivusi kautta tai olemalla meihin yhteydessä.'" />

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 15,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 20,
        marginBottom: 10,
    },
    subTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
        marginBottom: 5,
    },
    paragraph: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
});