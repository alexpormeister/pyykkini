import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import { BirthDatePickerModal, formatBirthDateDisplay } from '../../components/profile/BirthDatePickerModal';
import { fetchActiveServiceAreas, matchAddressServiceArea } from '../../lib/serviceAreas';
import { supabase } from '../../lib/supabase';
import { formatPhoneNumberDisplay, formatLocalPhoneInput } from '../../lib/phoneUtils';
import { selectUserProfile, updateProfileFields, UserProfile } from '../../redux/profileSlice';
import { fetchUserProfile } from '../../redux/profileThunks';

const COLORS = {
    primary: '#00C2FF',
    white: '#FFFFFF',
    background: '#F8F9FD',
    dark: '#1A1B32',
    textGray: '#64748B',
    border: '#E2E8F0',
    cardBorder: '#F1F5F9',
    danger: '#EF4444',
    success: '#10B981',
};

const CALLING_CODES: { [key: string]: string } = {
    'FI': '358', 'US': '1', 'SE': '46', 'NO': '47', 'DE': '49',
};

const validateEmail = (email: string) => {
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
};

const getInitialCountryCode = (phone: string | null | undefined): CountryCode => {
    if (!phone) return 'FI';
    for (const [code, prefix] of Object.entries(CALLING_CODES)) {
        if (phone.startsWith(`+${prefix}`)) return code as CountryCode;
    }
    return 'FI';
};

const GENDER_OPTIONS = [
    'Nainen',
    'Mies',
    'Muu',
    'En halua kertoa',
];

// --- CUSTOM STATUS ALERT ---
const StatusAlert = ({ visible, type, message, onClose }: { visible: boolean; type: 'success' | 'error'; message: string; onClose: () => void }) => {
    if (!visible) return null;
    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.alertOverlay}>
                <View style={styles.alertBox}>
                    <View style={[styles.alertIconBg, { backgroundColor: type === 'success' ? '#ECFDF5' : '#FEF2F2' }]}>
                        <Feather name={type === 'success' ? "check-circle" : "alert-circle"} size={36} color={type === 'success' ? COLORS.success : COLORS.danger} />
                    </View>
                    <Text style={styles.alertTitle}>{type === 'success' ? 'Valmista!' : 'Huomio'}</Text>
                    <Text style={styles.alertMessage}>{message}</Text>
                    <TouchableOpacity style={[styles.alertButton, { backgroundColor: type === 'success' ? COLORS.primary : COLORS.danger }]} onPress={onClose}>
                        <Text style={styles.alertButtonText}>Selvä</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default function PersonalInfoScreen() {
    const router = useRouter();
    const { from } = useLocalSearchParams<{ from?: string }>();
    const dispatch = useDispatch();
    const reduxProfile = useSelector(selectUserProfile);
    const profile: Partial<UserProfile> = reduxProfile || {};

    const isDriver = profile.role === 'driver' || from === 'driver';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [alertConfig, setAlertConfig] = useState<{ visible: boolean; type: 'success' | 'error'; message: string }>({
        visible: false, type: 'success', message: ''
    });

    const [modalVisible, setModalVisible] = useState(false);
    const [editingField, setEditingField] = useState<'name' | 'email' | 'phone' | 'address' | 'gender' | null>(null);
    const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);

    const [tempFirstName, setTempFirstName] = useState('');
    const [tempLastName, setTempLastName] = useState('');
    const [tempValue, setTempValue] = useState('');

    const [countryCode, setCountryCode] = useState<CountryCode>('FI');
    const [countryPickerVisible, setCountryPickerVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchUserProfile() as any).finally(() => setLoading(false));
    }, [dispatch]);

    const showAlert = (type: 'success' | 'error', message: string) => {
        setAlertConfig({ visible: true, type, message });
    };

    const handleSaveField = async () => {
        if (!profile || !editingField) return;

        if (editingField === 'email' && !validateEmail(tempValue)) {
            showAlert('error', 'Syötä oikea sähköpostiosoite.');
            return;
        }

        if (editingField === 'address') {
            if (!tempValue.trim()) {
                showAlert('error', 'Syötä tai valitse osoite.');
                return;
            }
            // Vain asiakkaille toimitusalueen tarkistus (kuljettajan kotiosoite voi olla missä vain)
            if (!isDriver) {
                const activeAreas = await fetchActiveServiceAreas();
                const match = matchAddressServiceArea(tempValue.trim(), activeAreas);
                if (!match.isSupported) {
                    showAlert('error', `Emme valitettavasti vielä toimi tällä alueella. Voit valita osoitteen alueilta: ${match.activeCities.join(', ')}.`);
                    return;
                }
            }
        }

        if (editingField === 'name' && (!tempFirstName.trim() || !tempLastName.trim())) {
            showAlert('error', 'Syötä sekä etu- että sukunimi.');
            return;
        }

        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Ei käyttäjää');

            let updates: Partial<UserProfile> = {};
            if (editingField === 'name') {
                updates = { first_name: tempFirstName.trim(), last_name: tempLastName.trim() };
            } else if (editingField === 'phone') {
                const callingCode = CALLING_CODES[countryCode];
                const numberPart = tempValue.replace(/[^0-9]/g, '');
                updates = { phone: `+${callingCode}${numberPart}` };
            } else {
                updates = { [editingField]: tempValue.trim() };
            }

            // Tietokannassa ei ole age-saroketta profiles-taulussa (ikä lasketaan birth_date:sta), joten poistetaan se DB-päivityksestä
            const dbUpdates = { ...updates };
            delete (dbUpdates as any).age;

            const { error } = await supabase
                .from('profiles')
                .update({ updated_at: new Date().toISOString(), ...dbUpdates })
                .eq('user_id', user.id);
            if (error) {
                console.error('Supabase profile update error:', error.message);
                throw error;
            }

            dispatch(updateProfileFields(updates));
            setModalVisible(false);
            showAlert('success', 'Tietosi on nyt päivitetty onnistuneesti.');
        } catch (error: any) {
            showAlert('error', error.message || 'Päivitys epäonnistui.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBirthDate = async (formattedDate: string, age: number) => {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Ei käyttäjää');

            const updates: Partial<UserProfile> = {
                birth_date: formattedDate,
                age: age,
            };

            const dbUpdates = { birth_date: formattedDate };
            const { error } = await supabase
                .from('profiles')
                .update({ updated_at: new Date().toISOString(), ...dbUpdates })
                .eq('user_id', user.id);
            if (error) {
                console.error('Supabase birth_date update error:', error.message);
                throw error;
            }

            dispatch(updateProfileFields(updates));
            setBirthDatePickerVisible(false);
            showAlert('success', 'Syntymäaika tallennettu onnistuneesti.');
        } catch (error: any) {
            showAlert('error', error.message || 'Tallennus epäonnistui.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = () => {
        showAlert('error', 'Tilin poistaminen vaatii yhteydenoton asiakaspalveluun turvallisuussyistä.');
    };

    const openEditModal = (field: 'name' | 'email' | 'phone' | 'address' | 'gender') => {
        setEditingField(field);
        if (field === 'name') {
            setTempFirstName(profile.first_name || '');
            setTempLastName(profile.last_name || '');
        } else if (field === 'phone') {
            const fullPhone = profile.phone || '';
            const initialCountry = getInitialCountryCode(fullPhone);
            setCountryCode(initialCountry);
            const callingCodeStr = `+${CALLING_CODES[initialCountry] || ''}`;
            const numberPart = fullPhone.startsWith(callingCodeStr) ? fullPhone.substring(callingCodeStr.length) : fullPhone;
            setTempValue(formatLocalPhoneInput(numberPart));
        } else {
            setTempValue(String(profile[field] || ''));
        }
        setModalVisible(true);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <StatusAlert
                visible={alertConfig.visible}
                type={alertConfig.type}
                message={alertConfig.message}
                onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
            />

            <BirthDatePickerModal
                visible={birthDatePickerVisible}
                currentBirthDate={profile.birth_date}
                onClose={() => setBirthDatePickerVisible(false)}
                onSave={handleSaveBirthDate}
            />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="chevron-left" size={24} color={COLORS.dark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Yhteystiedot</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* INFO BANNER */}
                <View style={styles.infoBanner}>
                    <View style={styles.infoBannerIcon}>
                        <Feather name="shield" size={18} color="#0284C7" />
                    </View>
                    <Text style={styles.infoBannerText}>
                        Tietosi ovat suojattuja ja niitä käytetään nouto- ja toimituspalvelun mahdollistamiseen.
                    </Text>
                </View>

                {/* 1. YHTEYSTIEDOT */}
                <Text style={styles.sectionHeading}>Yhteystiedot</Text>
                <View style={styles.infoListCard}>
                    <InfoItem
                        icon="user"
                        iconBg="#E0F2FE"
                        iconColor="#0284C7"
                        label="Koko Nimi"
                        value={`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Ei määritelty'}
                        onPress={() => openEditModal('name')}
                    />
                    <InfoItem
                        icon="mail"
                        iconBg="#FEF3C7"
                        iconColor="#D97706"
                        label="Sähköpostiosoite"
                        value={profile.email || 'Ei määritelty'}
                        onPress={() => openEditModal('email')}
                    />
                    <InfoItem
                        icon="phone"
                        iconBg="#F3E8FF"
                        iconColor="#9333EA"
                        label="Puhelinnumero"
                        value={profile.phone ? formatPhoneNumberDisplay(profile.phone) : 'Ei määritelty'}
                        onPress={() => openEditModal('phone')}
                    />
                    <InfoItem
                        icon="map-pin"
                        iconBg="#DCFCE7"
                        iconColor="#16A34A"
                        label="Katuosoite & kaupunki"
                        value={profile.address || 'Ei määritelty'}
                        onPress={() => openEditModal('address')}
                        isLast={true}
                    />
                </View>

                {/* 2. HENKILÖKOHTAISET TIEDOT */}
                <Text style={styles.sectionHeading}>Henkilökohtaiset tiedot</Text>
                <View style={styles.infoListCard}>
                    <InfoItem
                        icon="calendar"
                        iconBg="#E0F7FF"
                        iconColor="#0284C7"
                        label="Syntymäaika & ikä"
                        value={formatBirthDateDisplay(profile.birth_date || (profile.age ? `${profile.age}` : null))}
                        onPress={() => setBirthDatePickerVisible(true)}
                    />
                    <InfoItem
                        icon="user-check"
                        iconBg="#FEF3C7"
                        iconColor="#D97706"
                        label="Sukupuoli"
                        value={profile.gender || 'Ei määritelty'}
                        onPress={() => openEditModal('gender')}
                        isLast={true}
                    />
                </View>

                {/* VAARA-ALUE */}
                <View style={styles.dangerZone}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        activeOpacity={0.7}
                        onPress={handleDeleteAccount}
                    >
                        <Feather name="trash-2" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                        <Text style={styles.deleteButtonText}>Poista käyttäjätili</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* MUOKKAUSMODAALI */}
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingField === 'name' ? 'Muokkaa nimeä' :
                                 editingField === 'email' ? 'Muokkaa sähköpostia' :
                                 editingField === 'phone' ? 'Muokkaa puhelinnumeroa' :
                                 editingField === 'address' ? 'Muokkaa osoitetta' : 'Valitse sukupuoli'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                <Feather name="x" size={20} color={COLORS.dark} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            {editingField === 'address' ? (
                                <View style={{ minHeight: 180, zIndex: 1000 }}>
                                    <Text style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8 }}>
                                        {isDriver ? 'Kirjoita kotiosoitteesi tai valitse ehdotuksista:' : 'Kirjoita osoite tai valitse ehdotuksista:'}
                                    </Text>
                                    <AddressAutocomplete
                                        value={tempValue}
                                        onChangeText={setTempValue}
                                        placeholder="Esim. Mannerheimintie 10, Helsinki"
                                        disableServiceAreaCheck={isDriver}
                                    />
                                </View>
                            ) : editingField === 'name' ? (
                                <View style={{ gap: 12 }}>
                                    <TextInput style={styles.input} value={tempFirstName} onChangeText={setTempFirstName} placeholder="Etunimi" placeholderTextColor="#94A3B8" />
                                    <TextInput style={styles.input} value={tempLastName} onChangeText={setTempLastName} placeholder="Sukunimi" placeholderTextColor="#94A3B8" />
                                </View>
                            ) : editingField === 'gender' ? (
                                <View>
                                    <Text style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 12 }}>
                                        Valitse sukupuoli:
                                    </Text>
                                    <View style={styles.chipsContainer}>
                                        {GENDER_OPTIONS.map((opt) => {
                                            const isSelected = tempValue === opt;
                                            return (
                                                <TouchableOpacity
                                                    key={opt}
                                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                                    onPress={() => setTempValue(opt)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                                        {opt}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    {editingField === 'phone' ? (
                                        <View style={styles.phoneInputContainer}>
                                            <TouchableOpacity onPress={() => setCountryPickerVisible(true)} style={styles.countryCodeButton}>
                                                <CountryPicker withFlag onSelect={({ cca2 }) => setCountryCode(cca2)} visible={countryPickerVisible} onClose={() => setCountryPickerVisible(false)} countryCode={countryCode} />
                                                <Text style={styles.countryCodeText}>+{CALLING_CODES[countryCode]}</Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                style={[styles.input, styles.numberInput]}
                                                value={tempValue}
                                                onChangeText={(text) => setTempValue(formatLocalPhoneInput(text))}
                                                keyboardType='phone-pad'
                                                placeholder="Esim. 12 3456789"
                                                placeholderTextColor="#94A3B8"
                                            />
                                        </View>
                                    ) : (
                                        <TextInput style={styles.input} value={tempValue} onChangeText={setTempValue} autoCapitalize="none" keyboardType={editingField === 'email' ? 'email-address' : 'default'} placeholder="Syötä arvo" placeholderTextColor="#94A3B8" />
                                    )}
                                </View>
                            )}
                        </View>

                        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSaveField} disabled={saving}>
                            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Tallenna muutokset</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const InfoItem = ({ icon, iconBg, iconColor, label, value, onPress, isLast }: any) => (
    <TouchableOpacity
        style={[styles.infoItem, isLast && { borderBottomWidth: 0 }]}
        activeOpacity={0.7}
        onPress={onPress}
    >
        <View style={[styles.itemIconCircle, { backgroundColor: iconBg || '#F1F5F9' }]}>
            <Feather name={icon} size={18} color={iconColor || COLORS.primary} />
        </View>
        <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#CBD5E1" />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.dark,
        letterSpacing: -0.3,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 16,
        padding: 14,
        marginBottom: 20,
    },
    infoBannerIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 13,
        color: '#0369A1',
        lineHeight: 18,
        fontWeight: '500',
    },
    sectionHeading: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
        marginLeft: 4,
    },
    infoListCard: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        paddingHorizontal: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    itemIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textGray,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.dark,
    },
    dangerZone: {
        marginTop: 8,
        alignItems: 'center',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.danger,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.dark,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: {
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.dark,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    countryCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 14,
    },
    countryCodeText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.dark,
        marginLeft: 6,
    },
    numberInput: {
        flex: 1,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chipSelected: {
        backgroundColor: '#E0F7FF',
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textGray,
    },
    chipTextSelected: {
        color: '#0284C7',
        fontWeight: '700',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    alertBox: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    alertIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.dark,
        marginBottom: 8,
    },
    alertMessage: {
        fontSize: 14,
        color: COLORS.textGray,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    alertButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    alertButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '800',
    },
});