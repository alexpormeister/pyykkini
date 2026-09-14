import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRetypePassword, setShowRetypePassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
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
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                }
            }
        });

        if (error) {
            Alert.alert('Rekisteröinti epäonnistui', error.message);
        } else if (data.session || data.user) {
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                            <Feather name="arrow-left" size={24} color="#1E293B" />
                        </TouchableOpacity>

                        {/* 3-OSAINEN MODERN PROGRESS BAR */}
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressSegment, step >= 1 && styles.progressSegmentActive]} />
                            <View style={[styles.progressSegment, step >= 2 && styles.progressSegmentActive]} />
                            <View style={[styles.progressSegment, step >= 3 && styles.progressSegmentActive]} />
                        </View>

                        <Text style={styles.stepCounterText}>{step}/3</Text>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardContainer}
                    >
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {/* VAIHE 1: NIMET */}
                            {step === 1 && (
                                <View style={styles.stepWrapper}>
                                    <View style={styles.iconCircle}>
                                        <Feather name="user-check" size={28} color="#00C2FF" />
                                    </View>
                                    <Text style={styles.headerTitle}>Mikä on nimesi?</Text>
                                    <Text style={styles.headerSubtitle}>
                                        Aloitetaan luomalla sinulle henkilökohtainen Pesuni-profiili.
                                    </Text>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Etunimi</Text>
                                        <View style={[
                                            styles.inputBox,
                                            focusedInput === 'firstName' && styles.inputBoxFocused
                                        ]}>
                                            <Feather name="user" size={20} color={focusedInput === 'firstName' ? '#00C2FF' : '#94A3B8'} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. Matti"
                                                placeholderTextColor="#94A3B8"
                                                value={firstName}
                                                onChangeText={setFirstName}
                                                autoCapitalize="words"
                                                onFocus={() => setFocusedInput('firstName')}
                                                onBlur={() => setFocusedInput(null)}
                                                returnKeyType="next"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Sukunimi</Text>
                                        <View style={[
                                            styles.inputBox,
                                            focusedInput === 'lastName' && styles.inputBoxFocused
                                        ]}>
                                            <Feather name="user" size={20} color={focusedInput === 'lastName' ? '#00C2FF' : '#94A3B8'} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. Meikäläinen"
                                                placeholderTextColor="#94A3B8"
                                                value={lastName}
                                                onChangeText={setLastName}
                                                autoCapitalize="words"
                                                onFocus={() => setFocusedInput('lastName')}
                                                onBlur={() => setFocusedInput(null)}
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

                            {/* VAIHE 2: SÄHKÖPOSTI */}
                            {step === 2 && (
                                <View style={styles.stepWrapper}>
                                    <View style={styles.iconCircle}>
                                        <Feather name="mail" size={28} color="#00C2FF" />
                                    </View>
                                    <Text style={styles.headerTitle}>Sähköpostiosoitteesi</Text>
                                    <Text style={styles.headerSubtitle}>
                                        Mihin sähköpostiin lähetämme tilausvahvistukset, kuitit ja noutotiedot?
                                    </Text>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Sähköposti</Text>
                                        <View style={[
                                            styles.inputBox,
                                            focusedInput === 'email' && styles.inputBoxFocused
                                        ]}>
                                            <MaterialCommunityIcons
                                                name="email-outline"
                                                size={20}
                                                color={focusedInput === 'email' ? '#00C2FF' : '#94A3B8'}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="matti.meikalainen@email.com"
                                                placeholderTextColor="#94A3B8"
                                                value={email}
                                                onChangeText={setEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                onFocus={() => setFocusedInput('email')}
                                                onBlur={() => setFocusedInput(null)}
                                                returnKeyType="done"
                                                onSubmitEditing={handleNextStep2}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.infoBox}>
                                        <Feather name="shield" size={18} color="#0284C7" style={{ marginRight: 10, marginTop: 1 }} />
                                        <Text style={styles.infoText}>
                                            Emme koskaan jaa tietojasi kolmansille osapuolille tai lähetä roskapostia.
                                        </Text>
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
                                    <View style={styles.iconCircle}>
                                        <Feather name="lock" size={28} color="#00C2FF" />
                                    </View>
                                    <Text style={styles.headerTitle}>Luo salasana</Text>
                                    <Text style={styles.headerSubtitle}>
                                        Valitse vähintään 6-merkkinen turvallinen salasana tilisi suojaamiseksi.
                                    </Text>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Salasana</Text>
                                        <View style={[
                                            styles.inputBox,
                                            focusedInput === 'password' && styles.inputBoxFocused
                                        ]}>
                                            <Feather name="lock" size={20} color={focusedInput === 'password' ? '#00C2FF' : '#94A3B8'} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Vähintään 6 merkkiä"
                                                placeholderTextColor="#94A3B8"
                                                value={password}
                                                onChangeText={setPassword}
                                                autoCapitalize="none"
                                                secureTextEntry={!showPassword}
                                                onFocus={() => setFocusedInput('password')}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Vahvista salasana</Text>
                                        <View style={[
                                            styles.inputBox,
                                            focusedInput === 'retypePassword' && styles.inputBoxFocused
                                        ]}>
                                            <Feather name="lock" size={20} color={focusedInput === 'retypePassword' ? '#00C2FF' : '#94A3B8'} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Kirjoita salasana uudelleen"
                                                placeholderTextColor="#94A3B8"
                                                value={retypePassword}
                                                onChangeText={setRetypePassword}
                                                autoCapitalize="none"
                                                secureTextEntry={!showRetypePassword}
                                                onFocus={() => setFocusedInput('retypePassword')}
                                                onBlur={() => setFocusedInput(null)}
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
        </TouchableWithoutFeedback>
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
        paddingTop: Platform.OS === 'android' ? 12 : 6,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: 14,
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
        paddingTop: 28,
        paddingBottom: 24,
        justifyContent: 'space-between',
    },
    stepWrapper: {
        width: '100%',
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E0F7FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#64748B',
        lineHeight: 22,
        marginBottom: 28,
    },
    inputGroup: {
        marginBottom: 18,
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
        paddingVertical: Platform.OS === 'ios' ? 15 : 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    inputBoxFocused: {
        borderColor: '#00C2FF',
        backgroundColor: '#FFFFFF',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginBottom: 20,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#0369A1',
        lineHeight: 18,
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
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 8,
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
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#E09A00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 8,
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
        marginTop: 12,
    },
    signInLink: {
        color: '#64748B',
        fontSize: 14,
    },
});