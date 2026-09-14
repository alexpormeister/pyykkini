import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Checkbox } from 'expo-checkbox';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
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
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
                <LinearGradient
                    colors={['#5CD1FF', '#00C2FF', '#0099FF']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                {/* 🌊 KORISTEELLISET AALTO- JA VIRTAUSVIIVAT 🌊 */}
                <View style={styles.lineContainer} pointerEvents="none">
                    <View style={styles.arcOuter} />
                    <View style={styles.arcMiddle} />
                    <View style={styles.arcInner} />
                    <View style={styles.diagonalLine1} />
                    <View style={styles.diagonalLine2} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.container}
                >
                    {/* YLÄOSA: ASKELMITTARI JA OTSIKKO */}
                    <SafeAreaView edges={['top']} style={[styles.topArea, isKeyboardVisible && styles.topAreaKeyboard]}>
                        <View style={styles.headerNav}>
                            <TouchableOpacity
                                onPress={handlePreviousStep}
                                style={styles.backButton}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Feather name="arrow-left" size={24} color="white" />
                            </TouchableOpacity>

                            {/* STEP PROGRESS INDICATOR */}
                            <View style={styles.stepperContainer}>
                                <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
                                    <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
                                </View>
                                <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                                <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
                                    <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
                                </View>
                                <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
                                <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
                                    <Text style={[styles.stepDotText, step >= 3 && styles.stepDotTextActive]}>3</Text>
                                </View>
                            </View>

                            <View style={{ width: 40 }} />
                        </View>

                        {/* Kun näppäimistö on auki, pidetään otsikko siistinä ja kompaktina ilman ahtautta */}
                        <View style={[styles.topContainer, isKeyboardVisible && styles.topContainerCompact]}>
                            {step === 1 && (
                                <>
                                    {!isKeyboardVisible && <Text style={styles.stepBadge}>VAIHE 1 / 3</Text>}
                                    <Text style={[styles.title, isKeyboardVisible && styles.titleCompact]}>Mikä on nimesi?</Text>
                                    {!isKeyboardVisible && (
                                        <Text style={styles.subtitle}>Aloitetaan luomalla henkilökohtainen profiilisi</Text>
                                    )}
                                </>
                            )}
                            {step === 2 && (
                                <>
                                    {!isKeyboardVisible && <Text style={styles.stepBadge}>VAIHE 2 / 3</Text>}
                                    <Text style={[styles.title, isKeyboardVisible && styles.titleCompact]}>Sähköpostiosoite</Text>
                                    {!isKeyboardVisible && (
                                        <Text style={styles.subtitle}>Mihin lähetämme tilausvahvistukset ja kuitit?</Text>
                                    )}
                                </>
                            )}
                            {step === 3 && (
                                <>
                                    {!isKeyboardVisible && <Text style={styles.stepBadge}>VAIHE 3 / 3</Text>}
                                    <Text style={[styles.title, isKeyboardVisible && styles.titleCompact]}>Luo salasana</Text>
                                    {!isKeyboardVisible && (
                                        <Text style={styles.subtitle}>Valitse vähintään 6-merkkinen turvallinen salasana</Text>
                                    )}
                                </>
                            )}
                        </View>
                    </SafeAreaView>

                    {/* VALKOINEN KORTTI - TÄYTTÄÄ KOKO POHJAN ILMAN SINISTÄ VUOTOA */}
                    <View style={styles.whiteCard}>
                        <SafeAreaView edges={['bottom']} style={styles.cardInner}>
                            {/* VAIHE 1: NIMET */}
                            {step === 1 && (
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Etunimi</Text>
                                        <View style={styles.inputContainer}>
                                            <Feather name="user" size={20} color="#6b7280" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. Matti"
                                                placeholderTextColor="#9ca3af"
                                                value={firstName}
                                                onChangeText={setFirstName}
                                                autoCapitalize="words"
                                                autoFocus={false}
                                                returnKeyType="next"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Sukunimi</Text>
                                        <View style={styles.inputContainer}>
                                            <Feather name="user" size={20} color="#6b7280" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. Meikäläinen"
                                                placeholderTextColor="#9ca3af"
                                                value={lastName}
                                                onChangeText={setLastName}
                                                autoCapitalize="words"
                                                autoFocus={false}
                                                returnKeyType="done"
                                                onSubmitEditing={handleNextStep1}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.nextButton}
                                        onPress={handleNextStep1}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.nextButtonText}>Jatka</Text>
                                        <Feather name="arrow-right" size={20} color="white" style={styles.btnArrow} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* VAIHE 2: SÄHKÖPOSTI */}
                            {step === 2 && (
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Sähköpostiosoite</Text>
                                        <View style={styles.inputContainer}>
                                            <MaterialCommunityIcons name="email-fast-outline" size={20} color="#6b7280" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="matti.meikalainen@email.com"
                                                placeholderTextColor="#9ca3af"
                                                value={email}
                                                onChangeText={setEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                autoFocus={false}
                                                returnKeyType="done"
                                                onSubmitEditing={handleNextStep2}
                                            />
                                        </View>
                                    </View>

                                    {!isKeyboardVisible && (
                                        <View style={styles.infoBox}>
                                            <Feather name="info" size={18} color="#0284C7" style={{ marginRight: 10, marginTop: 2 }} />
                                            <Text style={styles.infoText}>
                                                Käytämme sähköpostiasi kirjautumiseen ja nouto- sekä toimitusilmoitusten lähettämiseen.
                                            </Text>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={styles.nextButton}
                                        onPress={handleNextStep2}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.nextButtonText}>Jatka</Text>
                                        <Feather name="arrow-right" size={20} color="white" style={styles.btnArrow} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* VAIHE 3: SALASANA & EHDOT */}
                            {step === 3 && (
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Salasana</Text>
                                        <View style={styles.inputContainer}>
                                            <Feather name="lock" size={20} color="#6b7280" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Vähintään 6 merkkiä"
                                                placeholderTextColor="#9ca3af"
                                                value={password}
                                                onChangeText={setPassword}
                                                autoCapitalize="none"
                                                secureTextEntry={!showPassword}
                                                autoFocus={false}
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#9ca3af" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Vahvista salasana</Text>
                                        <View style={styles.inputContainer}>
                                            <Feather name="lock" size={20} color="#6b7280" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Kirjoita salasana uudelleen"
                                                placeholderTextColor="#9ca3af"
                                                value={retypePassword}
                                                onChangeText={setRetypePassword}
                                                autoCapitalize="none"
                                                secureTextEntry={!showRetypePassword}
                                                autoFocus={false}
                                            />
                                            <TouchableOpacity onPress={() => setShowRetypePassword(!showRetypePassword)}>
                                                <Feather name={showRetypePassword ? "eye" : "eye-off"} size={18} color="#9ca3af" />
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
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.signupButtonText}>
                                            {loading ? 'Luodaan tiliä...' : 'Luo Pesuni-tili'}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {!isKeyboardVisible && (
                                <TouchableOpacity
                                    onPress={() => router.replace('/auth/login')}
                                    style={styles.signInRow}
                                >
                                    <Text style={styles.signInLink}>
                                        Onko sinulla jo tili? <Text style={styles.linkTextBold}>Kirjaudu sisään</Text>
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </SafeAreaView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#00C2FF',
    },
    lineContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    arcOuter: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 320,
        height: 320,
        borderRadius: 160,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    arcMiddle: {
        position: 'absolute',
        top: -40,
        right: -20,
        width: 240,
        height: 240,
        borderRadius: 120,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    arcInner: {
        position: 'absolute',
        top: 0,
        right: 20,
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderStyle: 'dashed',
    },
    diagonalLine1: {
        position: 'absolute',
        top: 90,
        left: -50,
        width: 280,
        height: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        transform: [{ rotate: '-22deg' }],
    },
    diagonalLine2: {
        position: 'absolute',
        top: 125,
        left: -30,
        width: 220,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        transform: [{ rotate: '-22deg' }],
    },
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    topArea: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 12 : 24,
    },
    topAreaKeyboard: {
        flex: 0,
        justifyContent: 'flex-start',
        paddingTop: Platform.OS === 'ios' ? 8 : 16,
        paddingBottom: 8,
    },
    headerNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotActive: {
        backgroundColor: 'white',
    },
    stepDotText: {
        fontSize: 12,
        fontWeight: '800',
        color: 'white',
    },
    stepDotTextActive: {
        color: '#0099FF',
    },
    stepLine: {
        width: 28,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        marginHorizontal: 4,
        borderRadius: 2,
    },
    stepLineActive: {
        backgroundColor: 'white',
    },
    topContainer: {
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    topContainerCompact: {
        marginBottom: 4,
    },
    stepBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.85)',
        letterSpacing: 1.5,
        marginBottom: 6,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.25)',
        textShadowRadius: 1,
        textShadowOffset: { width: 0, height: 2 },
    },
    titleCompact: {
        fontSize: 20,
        marginBottom: 0,
    },
    subtitle: {
        fontSize: 14,
        color: 'white',
        marginTop: 6,
        textAlign: 'center',
        opacity: 0.95,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    whiteCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    cardInner: {
        width: '100%',
        paddingHorizontal: 28,
        paddingTop: 30,
        paddingBottom: Platform.OS === 'ios' ? 24 : 28,
        alignItems: 'center',
    },
    inputGroup: {
        width: '100%',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 6,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 25,
        paddingHorizontal: 18,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        width: '100%',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#111827',
        fontSize: 16,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F0F9FF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginBottom: 20,
        width: '100%',
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
        width: '100%',
        marginTop: 4,
        marginBottom: 22,
    },
    checkbox: {
        marginRight: 10,
        borderRadius: 5,
    },
    checkboxTextContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        flex: 1,
    },
    checkboxText: {
        color: '#6b7280',
        fontSize: 13,
    },
    linkText: {
        color: '#0284C7',
        fontWeight: '700',
        fontSize: 13,
    },
    linkTextBold: {
        color: '#0284C7',
        fontWeight: '800',
    },
    nextButton: {
        flexDirection: 'row',
        backgroundColor: '#00C2FF',
        paddingVertical: 16,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
        marginTop: 6,
    },
    nextButtonText: {
        color: 'white',
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
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#E09A00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
        marginTop: 6,
    },
    signupButtonText: {
        color: '#1A1B32',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    signInRow: {
        marginTop: 20,
    },
    signInLink: {
        color: '#6b7280',
        fontSize: 14,
    },
});