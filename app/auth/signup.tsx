import { Feather } from '@expo/vector-icons';
import { Checkbox } from 'expo-checkbox';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { normalizePhoneNumberData } from '../../lib/phoneUtils';

export default function SignUpScreen() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRetypePassword, setShowRetypePassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleNextStep1 = () => {
        if (!firstName.trim()) {
            Alert.alert('Syötä etunimesi', 'Ole hyvä ja kirjoita etunimesi jatkaaksesi.');
            return;
        }
        if (!lastName.trim()) {
            Alert.alert('Syötä sukunimesi', 'Ole hyvä ja kirjoita sukunimesi jatkaaksesi.');
            return;
        }
        Keyboard.dismiss();
        setStep(2);
    };

    const handleNextStep2 = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email.trim())) {
            Alert.alert('Tarkista sähköposti', 'Syötä kelvollinen sähköpostiosoite.');
            return;
        }
        const cleanPhone = phone.trim().replace(/\D/g, '');
        if (!phone.trim() || cleanPhone.length < 6) {
            Alert.alert(
                'Syötä puhelinnumero',
                'Ole hyvä ja syötä puhelinnumerosi (esim. 040 123 4567). Tarvitsemme sen noutojen ja toimitusten yhteydenpitoon.'
            );
            return;
        }
        Keyboard.dismiss();
        setStep(3);
    };

    const handlePreviousStep = () => {
        Keyboard.dismiss();
        if (step === 3) setStep(2);
        else if (step === 2) setStep(1);
        else router.back();
    };

    async function signUpWithEmail() {
        if (!password || password.length < 6) {
            Alert.alert('Salasana on liian lyhyt', 'Salasanan tulee olla vähintään 6 merkkiä pitkä.');
            return;
        }
        if (password !== retypePassword) {
            Alert.alert('Salasanat eivät täsmää', 'Tarkista, että molemmat salasanat on kirjoitettu samalla tavalla.');
            return;
        }
        if (!agreeToTerms) {
            Alert.alert('Käyttöehdot', 'Hyväksy palvelun käyttöehdot ja tietosuoja luodaksesi tilin.');
            return;
        }

        setLoading(true);
        const normalizedPhone = normalizePhoneNumberData(phone);

        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    phone: normalizedPhone,
                }
            }
        });

        if (error) {
            Alert.alert('Rekisteröinti epäonnistui', error.message);
        } else {
            if (data?.user?.id) {
                await supabase.from('profiles').update({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    phone: normalizedPhone,
                }).eq('user_id', data.user.id);
            }

            Alert.alert(
                'Tervetuloa Pesuniin! 🎉',
                'Tilisi on luotu onnistuneesti. Tarkista sähköpostisi vahvistaaksesi tilisi.',
                [
                    {
                        text: 'Kirjaudu sisään',
                        onPress: () => router.replace('/auth/login'),
                    }
                ]
            );
        }
        setLoading(false);
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                {/* YLÄREUNAN NAVIGAATIO & EDISTYMISPALKKI */}
                <View style={styles.topNav}>
                    <TouchableOpacity
                        onPress={handlePreviousStep}
                        style={styles.backButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Feather name="arrow-left" size={22} color="#0F172A" />
                    </TouchableOpacity>

                    {/* 3-OSAINEN PROGRESS BAR */}
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressSegment, step >= 1 && styles.progressSegmentActive]} />
                        <View style={[styles.progressSegment, step >= 2 && styles.progressSegmentActive]} />
                        <View style={[styles.progressSegment, step >= 3 && styles.progressSegmentActive]} />
                    </View>

                    <Text style={styles.stepCounterText}>{step}/3</Text>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        automaticallyAdjustKeyboardInsets={true}
                    >
                        {/* VAIHE 1: NIMET */}
                        {step === 1 && (
                            <View style={styles.stepWrapper}>
                                <Text style={styles.stepBadge}>VAIHE 1 / 3</Text>
                                <Text style={styles.headerTitle}>Mikä on nimesi?</Text>
                                <Text style={styles.headerSubtitle}>
                                    Aloitetaan luomalla sinulle henkilökohtainen profiili.
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Etunimi</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Esim. Matti"
                                            placeholderTextColor="#94A3B8"
                                            value={firstName}
                                            onChangeText={setFirstName}
                                            autoCapitalize="words"
                                            returnKeyType="next"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Sukunimi</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Esim. Meikäläinen"
                                            placeholderTextColor="#94A3B8"
                                            value={lastName}
                                            onChangeText={setLastName}
                                            autoCapitalize="words"
                                            returnKeyType="done"
                                            onSubmitEditing={handleNextStep1}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={handleNextStep1}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.primaryButtonText}>Jatka</Text>
                                    <Feather name="arrow-right" size={20} color="white" style={styles.btnArrow} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* VAIHE 2: YHTEYSTIEDOT (SÄHKÖPOSTI & PUHELINNUMERO) */}
                        {step === 2 && (
                            <View style={styles.stepWrapper}>
                                <Text style={styles.stepBadge}>VAIHE 2 / 3</Text>
                                <Text style={styles.headerTitle}>Yhteystiedot</Text>
                                <Text style={styles.headerSubtitle}>
                                    Syötä sähköpostiosoitteesi ja puhelinnumerosi noutojen ja toimitusten sujuvuutta varten.
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Sähköpostiosoite</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="matti.meikalainen@email.com"
                                            placeholderTextColor="#94A3B8"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            returnKeyType="next"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Puhelinnumero</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="040 123 4567"
                                            placeholderTextColor="#94A3B8"
                                            value={phone}
                                            onChangeText={setPhone}
                                            keyboardType="phone-pad"
                                            returnKeyType="done"
                                            onSubmitEditing={handleNextStep2}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={handleNextStep2}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.primaryButtonText}>Jatka</Text>
                                    <Feather name="arrow-right" size={20} color="white" style={styles.btnArrow} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* VAIHE 3: SALASANA & EHDOT */}
                        {step === 3 && (
                            <View style={styles.stepWrapper}>
                                <Text style={styles.stepBadge}>VAIHE 3 / 3</Text>
                                <Text style={styles.headerTitle}>Luo salasana</Text>
                                <Text style={styles.headerSubtitle}>
                                    Valitse vähintään 6-merkkinen turvallinen salasana tilisi suojaamiseksi.
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Salasana</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Vähintään 6 merkkiä"
                                            placeholderTextColor="#94A3B8"
                                            value={password}
                                            onChangeText={setPassword}
                                            autoCapitalize="none"
                                            secureTextEntry={!showPassword}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Vahvista salasana</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Kirjoita salasana uudelleen"
                                            placeholderTextColor="#94A3B8"
                                            value={retypePassword}
                                            onChangeText={setRetypePassword}
                                            autoCapitalize="none"
                                            secureTextEntry={!showRetypePassword}
                                        />
                                        <TouchableOpacity onPress={() => setShowRetypePassword(!showRetypePassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Feather name={showRetypePassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.checkboxContainer}>
                                    <Checkbox
                                        style={styles.checkbox}
                                        value={agreeToTerms}
                                        onValueChange={setAgreeToTerms}
                                        color={agreeToTerms ? '#00C2FF' : undefined}
                                    />
                                    <View style={styles.checkboxTextContainer}>
                                        <Text style={styles.checkboxText}>Hyväksyn palvelun </Text>
                                        <TouchableOpacity onPress={() => router.push('/auth/terms')}>
                                            <Text style={styles.linkText}>Käyttöehdot & Tietosuojan</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.signupButton}
                                    onPress={signUpWithEmail}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.signupButtonText}>
                                        {loading ? 'Luodaan tiliä...' : 'Luo Pesuni-tili'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ALALINKKI: KIRJAUDU SISÄÄN */}
                        <TouchableOpacity
                            onPress={() => router.replace('/auth/login')}
                            style={styles.signInRow}
                        >
                            <Text style={styles.signInLink}>
                                Onko sinulla jo tili? <Text style={styles.linkTextBold}>Kirjaudu sisään</Text>
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 12 : 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    progressTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        maxWidth: 160,
        marginHorizontal: 16,
    },
    progressSegment: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
    },
    progressSegmentActive: {
        backgroundColor: '#00C2FF',
    },
    stepCounterText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        width: 30,
        textAlign: 'right',
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 24,
        justifyContent: 'space-between',
    },
    stepWrapper: {
        width: '100%',
    },
    stepBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: '#00C2FF',
        letterSpacing: 1.5,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.6,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#64748B',
        lineHeight: 22,
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 16 : 13,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 24,
    },
    checkbox: {
        marginRight: 12,
        borderRadius: 6,
        width: 20,
        height: 20,
    },
    checkboxTextContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        flex: 1,
    },
    checkboxText: {
        color: '#64748B',
        fontSize: 13,
    },
    linkText: {
        color: '#00C2FF',
        fontWeight: '700',
        fontSize: 13,
    },
    linkTextBold: {
        color: '#00C2FF',
        fontWeight: '800',
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#00C2FF',
        paddingVertical: 17,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 10,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    btnArrow: {
        marginLeft: 8,
    },
    signupButton: {
        backgroundColor: '#FFC700',
        paddingVertical: 17,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#E09A00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 10,
    },
    signupButtonText: {
        color: '#1A1B32',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    signInRow: {
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 16,
    },
    signInLink: {
        color: '#64748B',
        fontSize: 14,
    },
});