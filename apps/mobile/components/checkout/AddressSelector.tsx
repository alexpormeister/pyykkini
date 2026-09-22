import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';
import { selectUserProfile, UserProfile } from '../../redux/profileSlice'; // Oletetaan tuonti profileSlice.ts:stä

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0A1B32',
    textGray: '#6B7280',
    primary: '#00c2ff', // Korostusväri
    lightGray: '#F8F9FD',
    borderColor: '#EFEFEF',
    success: '#4CAF50', // Esimerkiksi vahvistetulle osoitteelle
    redAccent: '#FF4500', // Puuttuvan osoitteen korostus
};

interface AddressSelectorProps {
    onEditAddress: () => void; // Funktio, joka avaa osoitteenmuokkausnäkymän
    style?: ViewStyle;
}

const AddressSelector: React.FC<AddressSelectorProps> = ({ onEditAddress, style }) => {
    // Hakee profiilin tiedot Reduxista
    // Tässä käytetään AddressSelectoria vastaamaan alkuperäistä CustomerInfoBlockin osoiteosiota.
    // Oletan, että selectUserProfile palauttaa UserProfile-objektin.
    const profile: Partial<UserProfile> | null = useSelector(selectUserProfile) || {};

    // Nouto-osoite (osoite on pakollinen tilauksen tekemiseksi)
    const currentAddress = profile?.address;

    const isAddressSet = !!currentAddress;

    return (
        <View style={[styles.card, style]}>
            <Text style={styles.title}>Nouto ja toimitusosoite</Text>

            {/* 1. Osoitteen Tila */}
            <View style={styles.addressDisplayContainer}>
                <View style={styles.addressTextWrapper}>
                    <Text style={styles.sectionTitle}>Nouto-osoite *</Text>
                    <Text style={[styles.addressValue, !isAddressSet && styles.addressMissing]}>
                        {currentAddress || 'OSOITETTA EI OLE ASETETTU'}
                    </Text>
                </View>

                {/* 2. Muokkaa/Vahvista-nappi */}
                <TouchableOpacity style={styles.editButton} onPress={onEditAddress}>
                    <Text style={styles.editButtonText}>Muokkaa</Text>
                    <Feather name="chevron-right" size={16} color={COLORS.white} style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            </View>

            {/* 🛑 POISTETTU: Koordinaatit ja karttaosuus kokonaan 🛑 */}

        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 20,
        marginVertical: 10,
        marginHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 5,
    },

    // --- Osoite Näyttö ---
    addressDisplayContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 0, // Muutettu 0:ksi, koska mapSection poistettiin
        borderBottomWidth: 0, // Muutettu 0:ksi
        borderBottomColor: COLORS.borderColor,
        paddingBottom: 0, // Muutettu 0:ksi
    },
    addressTextWrapper: {
        flex: 1,
        marginRight: 10,
    },
    addressValue: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.darkText,
        lineHeight: 22,
    },
    addressMissing: {
        color: COLORS.redAccent,
        fontWeight: 'bold',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'center',
        height: 36, // Varmistetaan, että nappi on tarpeeksi korkea
    },
    editButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: 'bold',
    },

    // --- POISTETTU Kartta/Koordinaatti tyylit (mapSection, mapDetail, mapButton, mapButtonText, mapIcon)
    // TÄRKEÄÄ: Poista nämä tyylit styles.create-objektista, jos ne ovat olemassa erikseen!
});

export default AddressSelector;