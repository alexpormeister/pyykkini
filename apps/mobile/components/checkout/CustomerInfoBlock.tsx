import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { useSelector } from 'react-redux';
import { AddressAutocomplete, AddressSuggestion } from '../AddressAutocomplete';
import { formatAddressFromParts, parseStructuredAddress } from '../../lib/addressUtils';
import { formatPhoneNumberDisplay } from '../../lib/phoneUtils';
import { selectUserProfile, UserProfile } from "../../redux/profileSlice";

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    lightGray: '#F8FAFC',
    cardBorder: '#F1F5F9',
    successGreen: '#10B981',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    lockedBg: '#F1F5F9',
    lockedBorder: '#E2E8F0',
};

interface CustomerInfoBlockProps {
    pickupAddress?: string;
    onPickupAddressChange?: (newAddress: string) => void;
    deliveryAddress?: string;
    onDeliveryAddressChange?: (newAddress: string) => void;
    pickupInstructions?: string;
    onPickupInstructionsChange?: (instructions: string) => void;
    deliveryInstructions?: string;
    onDeliveryInstructionsChange?: (instructions: string) => void;
    // Yhteensopivuus vanhemmalle koodille
    currentAddress?: string;
    onAddressChange?: (newAddress: string) => void;
    style?: ViewStyle;
}

const CustomerInfoBlock: React.FC<CustomerInfoBlockProps> = ({
    pickupAddress,
    onPickupAddressChange,
    deliveryAddress,
    onDeliveryAddressChange,
    pickupInstructions = '',
    onPickupInstructionsChange,
    deliveryInstructions = '',
    onDeliveryInstructionsChange,
    currentAddress,
    onAddressChange,
    style,
}) => {
    const profile: Partial<UserProfile> | null = useSelector(selectUserProfile) || {};
    const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Ei asetettu';

    const defaultAddress = currentAddress || profile?.address || '';
    const effectivePickup = pickupAddress || defaultAddress;
    const effectiveDelivery = deliveryAddress || effectivePickup;

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'pickup' | 'delivery'>('pickup');

    // Hakukenttä ja strukturoidut osoitetiedot
    const [searchQuery, setSearchQuery] = useState('');
    const [streetName, setStreetName] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [apartmentNumber, setApartmentNumber] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [instructionsText, setInstructionsText] = useState('');

    // Avataan modaali joko nouto- tai toimitusosoitteen muokkaamiseen
    const openAddressEditor = (mode: 'pickup' | 'delivery') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setModalMode(mode);
        const targetAddress = mode === 'pickup' ? effectivePickup : effectiveDelivery;
        const targetInstructions = mode === 'pickup' ? (pickupInstructions || '') : (deliveryInstructions || '');

        const parsed = parseStructuredAddress(targetAddress);
        setSearchQuery(parsed.streetName ? `${parsed.streetName}, ${parsed.city}` : targetAddress);
        setStreetName(parsed.streetName || '');
        setHouseNumber(parsed.houseNumber || '');
        setApartmentNumber(parsed.apartmentNumber || '');
        setPostalCode(parsed.postalCode || '');
        setCity(parsed.city || '');
        setInstructionsText(targetInstructions);
        setIsAddressModalOpen(true);
    };

    const handleSelectSuggestion = (item: AddressSuggestion) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const parsed = parseStructuredAddress(item.formatted);
        setStreetName(item.street || parsed.streetName || '');
        if (item.housenumber) {
            setHouseNumber(item.housenumber);
        } else if (parsed.houseNumber) {
            setHouseNumber(parsed.houseNumber);
        }
        setPostalCode(item.postcode || parsed.postalCode || '');
        setCity(item.city || parsed.city || '');
    };

    const handleSaveAddress = () => {
        if (!streetName.trim()) {
            Alert.alert('Osoite puuttuu', 'Valitse katuosoite yläpuolen osoitehausta.');
            return;
        }
        if (!houseNumber.trim()) {
            Alert.alert('Talonumero puuttuu', 'Syötä talonumero (esim. 5a tai 12).');
            return;
        }
        if (!postalCode.trim() || !city.trim()) {
            Alert.alert('Osoite puuttuu', 'Valitse toimiva osoite ehdotuksista, jotta postinumero ja kaupunki asettuvat.');
            return;
        }

        const formatted = formatAddressFromParts({
            streetName,
            houseNumber,
            apartmentNumber: apartmentNumber.trim() || undefined,
            postalCode,
            city,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        if (modalMode === 'pickup') {
            if (onPickupAddressChange) {
                onPickupAddressChange(formatted);
            }
            if (onAddressChange) {
                onAddressChange(formatted);
            }
            if (onPickupInstructionsChange) {
                onPickupInstructionsChange(instructionsText.trim());
            }
            // Jos toimitusosoite oli täsmälleen sama tai ei vielä erikseen asetettu, päivitetään sekin oletuksena
            if (!deliveryAddress && onDeliveryAddressChange) {
                onDeliveryAddressChange(formatted);
            }
        } else {
            if (onDeliveryAddressChange) {
                onDeliveryAddressChange(formatted);
            }
            if (onDeliveryInstructionsChange) {
                onDeliveryInstructionsChange(instructionsText.trim());
            }
        }

        setIsAddressModalOpen(false);
    };

    return (
        <View style={[styles.card, style]}>
            {/* YLÄPALKKI (Ilman erillistä kynäikonia) */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.title}>Nouto- ja yhteystiedot</Text>
                    <Text style={styles.subtitle}>Tarkista tai muuta tilauksen osoitteet</Text>
                </View>
            </View>

            {/* 1. NOUTO-OSOITE */}
            <TouchableOpacity
                style={styles.infoRow}
                onPress={() => openAddressEditor('pickup')}
                activeOpacity={0.8}
            >
                <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <Feather name="map-pin" size={16} color="#16A34A" />
                </View>
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Nouto-osoite</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                        {effectivePickup || 'Aseta nouto-osoite'}
                    </Text>
                    {pickupInstructions ? (
                        <Text style={styles.instructionsPreview} numberOfLines={1}>
                            Ohje: {pickupInstructions}
                        </Text>
                    ) : null}
                </View>
                <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* 2. TOIMITUSOSOITE */}
            <TouchableOpacity
                style={styles.infoRow}
                onPress={() => openAddressEditor('delivery')}
                activeOpacity={0.8}
            >
                <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                    <Feather name="truck" size={16} color="#0284C7" />
                </View>
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Toimitusosoite</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                        {effectiveDelivery || 'Aseta toimitusosoite'}
                    </Text>
                    {deliveryInstructions ? (
                        <Text style={styles.instructionsPreview} numberOfLines={1}>
                            Ohje: {deliveryInstructions}
                        </Text>
                    ) : null}
                </View>
                <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* 3. YHTEYSHENKILÖ */}
            <View style={styles.infoRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Feather name="user" size={16} color="#475569" />
                </View>
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Tilaaja</Text>
                    <Text style={styles.infoValue}>{fullName}</Text>
                </View>
            </View>

            {/* 4. PUHELIN */}
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="phone" size={16} color="#D97706" />
                </View>
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Puhelinnumero</Text>
                    <Text style={styles.infoValue}>
                        {profile?.phone ? formatPhoneNumberDisplay(profile.phone) : 'Ei puhelinnumeroa'}
                    </Text>
                </View>
            </View>

            {/* 🌟 ÄLYKÄS OSOITTEEN VALINTA & MUOKKAUSMODAALI 🌟 */}
            <Modal
                visible={isAddressModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsAddressModalOpen(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalHeader}>
                        <View style={styles.dragHandle} />
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>
                                {modalMode === 'pickup' ? 'Nouto-osoite' : 'Toimitusosoite'}
                            </Text>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setIsAddressModalOpen(false)}
                                activeOpacity={0.7}
                            >
                                <Feather name="x" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {modalMode === 'pickup'
                                ? 'Hae ja valitse tilauksen nouto-osoite.'
                                : 'Hae ja valitse tilauksen palautus- ja toimitusosoite.'}
                        </Text>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.modalScrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* 1. ÄLYKÄS OSOITEHAKU */}
                        <View style={styles.autocompleteSection}>
                            <Text style={styles.fieldLabel}>
                                Etsi katuosoite <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <AddressAutocomplete
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSelectSuggestion={handleSelectSuggestion}
                                placeholder="Esim. Vantaanmäki tai Mannerheimintie..."
                            />
                        </View>

                        {/* 2. VALITTU KADUNNIMI (LUKITTU / VALITTU) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.fieldLabel}>
                                Valittu kadunnimi <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.lockedInputWrapper}>
                                <Feather
                                    name={modalMode === 'pickup' ? "map-pin" : "truck"}
                                    size={16}
                                    color="#0284C7"
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={[styles.lockedInputText, !streetName && { color: '#94A3B8' }]}>
                                    {streetName || 'Valitse katuosoite yläpuolen hausta'}
                                </Text>
                                <Feather name="lock" size={14} color="#94A3B8" />
                            </View>
                        </View>

                        {/* 3 & 4. TALONUMERO JA ASUNNON NUMERO (KÄYTTÄJÄN MUOKATTAVISSA) */}
                        <View style={styles.rowTwoCols}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.fieldLabel}>
                                    Talonumero <Text style={styles.requiredStar}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Esim. 5a tai 12"
                                    placeholderTextColor="#94A3B8"
                                    value={houseNumber}
                                    onChangeText={setHouseNumber}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <Text style={styles.fieldLabel}>
                                    Asunnon nro <Text style={styles.optionalText}>(valinnainen)</Text>
                                </Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Esim. 7 tai A 12"
                                    placeholderTextColor="#94A3B8"
                                    value={apartmentNumber}
                                    onChangeText={setApartmentNumber}
                                    autoCapitalize="characters"
                                />
                            </View>
                        </View>

                        {/* 5 & 6. POSTINUMERO JA KAUPUNKI (AUTOMAATTISESTI ASETETUT / LUKITUT) */}
                        <View style={styles.rowTwoCols}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.fieldLabel}>Postinumero</Text>
                                <View style={styles.lockedInputWrapper}>
                                    <Text style={[styles.lockedInputText, !postalCode && { color: '#94A3B8' }]}>
                                        {postalCode || 'Automaattinen'}
                                    </Text>
                                    <Feather name="lock" size={14} color="#94A3B8" />
                                </View>
                            </View>

                            <View style={[styles.inputGroup, { flex: 1.3, marginLeft: 8 }]}>
                                <Text style={styles.fieldLabel}>Kaupunki</Text>
                                <View style={styles.lockedInputWrapper}>
                                    <Text style={[styles.lockedInputText, !city && { color: '#94A3B8' }]}>
                                        {city || 'Automaattinen'}
                                    </Text>
                                    <Feather name="lock" size={14} color="#94A3B8" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.lockedNoticeBox}>
                            <Feather name="info" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                            <Text style={styles.lockedNoticeText}>
                                Postinumero ja kaupunki määräytyvät automaattisesti valitsemasi katuosoitteen mukaan.
                            </Text>
                        </View>

                        {/* 7. OHJEET (VALINNAINEN, MAX 50 MERKKIÄ) */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.fieldLabel}>
                                    {modalMode === 'pickup' ? 'Nouto-ohjeet' : 'Toimitusohjeet'}{' '}
                                    <Text style={styles.optionalText}>(valinnainen)</Text>
                                </Text>
                                <Text style={[styles.charCountText, instructionsText.length >= 50 && styles.charCountLimit]}>
                                    {instructionsText.length}/50
                                </Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder={
                                    modalMode === 'pickup'
                                        ? "Esim. Soita ovikelloa / jätä pussi ovelle"
                                        : "Esim. Jätä oven taakse / soita summeria"
                                }
                                placeholderTextColor="#94A3B8"
                                value={instructionsText}
                                onChangeText={(text) => {
                                    if (text.length <= 50) {
                                        setInstructionsText(text);
                                    }
                                }}
                                maxLength={50}
                            />
                        </View>

                        {/* ESIKATSELU */}
                        <View style={styles.previewBox}>
                            <Text style={styles.previewLabel}>
                                {modalMode === 'pickup' ? 'Nouto-osoite tilauksessa:' : 'Toimitusosoite tilauksessa:'}
                            </Text>
                            <Text style={styles.previewText}>
                                {streetName
                                    ? formatAddressFromParts({
                                          streetName,
                                          houseNumber: houseNumber || '',
                                          apartmentNumber: apartmentNumber || undefined,
                                          postalCode: postalCode || '',
                                          city: city || '',
                                      })
                                    : 'Valitse katuosoite yläpuolelta...'}
                            </Text>
                        </View>

                        {/* TALLENNA-NAPPI */}
                        <TouchableOpacity
                            style={[
                                styles.saveAddressBtn,
                                (!streetName || !houseNumber.trim()) && styles.saveAddressBtnDisabled,
                            ]}
                            onPress={handleSaveAddress}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.saveAddressBtnText}>
                                {modalMode === 'pickup' ? 'Käytä nouto-osoitteena' : 'Käytä toimitusosoitteena'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        marginVertical: 8,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        color: COLORS.textGray,
        fontWeight: '700',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.darkText,
        lineHeight: 18,
    },
    instructionsPreview: {
        fontSize: 12,
        color: '#0284C7',
        fontWeight: '600',
        marginTop: 2,
    },

    // MODAALITYYLIT
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        marginBottom: 14,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScrollContent: {
        padding: 20,
    },
    autocompleteSection: {
        marginBottom: 16,
        zIndex: 1000,
    },
    inputGroup: {
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    charCountText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    charCountLimit: {
        color: '#D97706',
        fontWeight: '700',
    },
    rowTwoCols: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    requiredStar: {
        color: '#EF4444',
    },
    optionalText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94A3B8',
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '600',
    },
    lockedInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    lockedInputText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    lockedNoticeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 16,
    },
    lockedNoticeText: {
        flex: 1,
        fontSize: 12,
        color: '#0369A1',
        fontWeight: '500',
        lineHeight: 16,
    },
    previewBox: {
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginTop: 4,
        marginBottom: 20,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0284C7',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    previewText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0369A1',
    },
    saveAddressBtn: {
        backgroundColor: '#00C2FF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    saveAddressBtnDisabled: {
        opacity: 0.5,
    },
    saveAddressBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});

export default CustomerInfoBlock;