import { Feather, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    AppState,
    AppStateStatus,
    Image,
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

AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh()
    } else {
        supabase.auth.stopAutoRefresh()
    }
})

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getUserRole } from '../../lib/authHelper';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithEmail() {
        if (!email.trim() || !password) {
            Alert.alert('Virhe', 'Syötä sähköpostiosoite ja salasana.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) {
                Alert.alert('Kirjautuminen epäonnistui', error.message);
                setLoading(false);
                return;
            }

            if (data?.user) {
                const role = await getUserRole(data.user.id);
                if (role === 'driver') {
                    router.replace('/driver' as any);
                } else {
                    router.replace('/');
                }
            } else {
                router.replace('/');
            }
        } catch (err: any) {
            Alert.alert('Kirjautuminen epäonnistui', err?.message || 'Tarkista yhteys');
        } finally {
            setLoading(false);
        }
    }

    async function signInWithProvider(provider: 'google' | 'apple' | 'facebook') {
        try {
            setLoading(true);

            // 🍏 NATIIVI APPLE SIGN-IN (iOS) 🍏
            if (provider === 'apple' && Platform.OS === 'ios') {
                const isAvailable = await AppleAuthentication.isAvailableAsync();
                if (isAvailable) {
                    const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                    });

                    if (credential.identityToken) {
                        const { data, error } = await supabase.auth.signInWithIdToken({
                            provider: 'apple',
                            token: credential.identityToken,
                        });

                        if (error) throw error;

                        if (data?.user && credential.fullName?.givenName) {
                            await supabase.from('profiles').update({
                                first_name: credential.fullName.givenName,
                                last_name: credential.fullName.familyName || '',
                            }).eq('user_id', data.user.id);
                        }
                        return;
                    }
                }
            }

            // 🌐 GOOGLE / FACEBOOK / WEBBIPOHJAINEN OAUTH 🌐
            const redirectUrl = Linking.createURL('/');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                if (res.type === 'success' && res.url) {
                    const parsedUrl = new URL(res.url);
                    const accessToken = parsedUrl.searchParams.get('access_token') || parsedUrl.hash.match(/access_token=([^&]+)/)?.[1];
                    const refreshToken = parsedUrl.searchParams.get('refresh_token') || parsedUrl.hash.match(/refresh_token=([^&]+)/)?.[1];
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                    }
                }
            }
        } catch (err: any) {
            if (err?.code === 'ERR_REQUEST_CANCELED') {
                // Käyttäjä peruutti kirjautumisen
            } else {
                console.log('OAuth error:', err);
                Alert.alert('Kirjautuminen', err?.message || 'Kirjautuminen epäonnistui. Tarkista yhteys.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            
            {/* 🎨 ELEGANTTI TAUSTAGRADIENTTI 🎨 */}
            <LinearGradient
                colors={['#0369A1', '#0099FF', '#00C2FF', '#5CD1FF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
            />

            {/* 🌊 KORISTEELLISET AALTOVIIVAT JA PEHMEÄT HEHKUT 🌊 */}
            <View style={styles.lineContainer} pointerEvents="none">
                <View style={styles.glowCircle1} />
                <View style={styles.glowCircle2} />
                <View style={styles.arcOuter} />
                <View style={styles.arcMiddle} />
                <View style={styles.arcInner} />
                <View style={styles.diagonalLine1} />
                <View style={styles.diagonalLine2} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    automaticallyAdjustKeyboardInsets={true}
                >
                    {/* YLÄREUNA: HERO / BRÄNDI */}
                    <SafeAreaView edges={['top']} style={styles.heroArea}>
                        <Image
                            source={require('../../assets/images/3dglossy-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>PESUNI</Text>
                        <Text style={styles.subtitle}>PUHDASTA ARKEA</Text>
                    </SafeAreaView>

                    {/* VALKOINEN LOMAKEKORTTI */}
                    <View style={styles.whiteCard}>
                        <View style={styles.cardInner}>
                            <Text style={styles.cardHeaderTitle}>Kirjaudu sisään</Text>
                            <Text style={styles.cardHeaderSubtitle}>Syötä sähköpostiosoitteesi ja salasanasi</Text>

                            {/* SÄHKÖPOSTI */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Sähköpostiosoite</Text>
                                <View style={styles.inputContainer}>
                                    <Feather name="mail" size={19} color="#64748B" style={styles.icon} />
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

                            {/* SALASANA */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.inputLabel}>Salasana</Text>
                                    <TouchableOpacity
                                        onPress={() => router.push('/auth/forgotPassword')}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.forgotPassword}>Unohditko salasanan?</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.inputContainer}>
                                    <Feather name="lock" size={19} color="#64748B" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Kirjoita salasana"
                                        placeholderTextColor="#94A3B8"
                                        value={password}
                                        onChangeText={setPassword}
                                        autoCapitalize="none"
                                        secureTextEntry={!showPassword}
                                        returnKeyType="done"
                                        onSubmitEditing={signInWithEmail}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* KIRJAUDU PAINIKE */}
                            <TouchableOpacity
                                style={styles.loginButton}
                                onPress={signInWithEmail}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? 'Kirjaudutaan...' : 'Kirjaudu sisään'}
                                </Text>
                            </TouchableOpacity>

                            {/* VAIHTOEHTOISET KIRJAUTUMISET */}
                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.orText}>tai jatka palvelulla</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <View style={styles.socialLoginContainer}>
                                <TouchableOpacity
                                    style={styles.socialButton}
                                    onPress={() => signInWithProvider('google')}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                >
                                    <FontAwesome name="google" size={22} color="#DB4437" />
                                </TouchableOpacity>
                                {Platform.OS === 'ios' && (
                                    <TouchableOpacity
                                        style={styles.socialButton}
                                        onPress={() => signInWithProvider('apple')}
                                        disabled={loading}
                                        activeOpacity={0.7}
                                    >
                                        <FontAwesome name="apple" size={24} color="#000000" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.socialButton}
                                    onPress={() => signInWithProvider('facebook')}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                >
                                    <FontAwesome name="facebook" size={22} color="#1877F2" />
                                </TouchableOpacity>
                            </View>

                            {/* REKISTERÖINTI LINKKI */}
                            <TouchableOpacity
                                style={styles.createButton}
                                onPress={() => router.push("/auth/signup")}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.createButtonText}>
                                    Eikö sinulla ole tiliä? <Text style={styles.createButtonBold}>Luo tili</Text>
                                </Text>
                            </TouchableOpacity>

                            <SafeAreaView edges={['bottom']} />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#00C2FF',
    },
    lineContainer: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
    },
    glowCircle1: {
        position: 'absolute',
        top: -60,
        left: -40,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    glowCircle2: {
        position: 'absolute',
        top: 100,
        right: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
        top: 140,
        left: -50,
        width: 280,
        height: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        transform: [{ rotate: '-22deg' }],
    },
    diagonalLine2: {
        position: 'absolute',
        top: 180,
        left: -30,
        width: 220,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        transform: [{ rotate: '-22deg' }],
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    heroArea: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 24 : 12,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    logo: {
        width: 105,
        height: 105,
        marginBottom: 6,
    },
    title: {
        fontSize: 40,
        fontWeight: '900',
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        letterSpacing: 1.2,
        textShadowColor: 'rgba(0, 0, 0, 0.25)',
        textShadowRadius: 3,
        textShadowOffset: { width: 0, height: 2 },
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 2,
        marginTop: 2,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    whiteCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: Platform.OS === 'ios' ? 16 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
        width: '100%',
    },
    cardInner: {
        width: '100%',
    },
    cardHeaderTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.4,
        marginBottom: 4,
    },
    cardHeaderSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 22,
    },
    inputGroup: {
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    forgotPassword: {
        color: '#0284C7',
        fontSize: 13,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 15 : 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
    },
    loginButton: {
        backgroundColor: '#FFC700',
        paddingVertical: 16,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 20,
        shadowColor: "#E09A00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    loginButtonText: {
        color: '#1A1B32',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    orText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
        marginHorizontal: 12,
    },
    socialLoginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        width: '100%',
        marginBottom: 16,
    },
    socialButton: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 20,
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    createButton: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    createButtonText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '500',
    },
    createButtonBold: {
        color: '#0284C7',
        fontWeight: '800',
    },
});