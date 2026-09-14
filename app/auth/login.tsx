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
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
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

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.container}
                >
                    <View style={styles.blueContent}>
                        <View style={styles.topContent}>
                            <Image
                                source={require('../../assets/images/3dglossy-logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>PESUNI</Text>
                            <Text style={styles.subtitle}>PUHDASTA ARKEA</Text>
                        </View>
                        <View style={styles.inputArea}>
                            <View style={styles.inputContainer}>
                                <Feather name="user" size={20} color="#6b7280" style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email or Phone"
                                    placeholderTextColor="#6b7280"
                                    value={email}
                                    onChangeText={(text: string) => setEmail(text)}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Feather name="lock" size={20} color="#6b7280" style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#6b7280"
                                    value={password}
                                    onChangeText={(text: string) => setPassword(text)}
                                    autoCapitalize="none"
                                    secureTextEntry
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.whiteCard}>
                        <TouchableOpacity onPress={() => router.push('/auth/forgotPassword')}>
                            <Text style={styles.forgotPassword}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={() => signInWithEmail()}
                            disabled={loading}
                        >
                            <Text style={styles.loginButtonText}>{loading ? 'Loading...' : 'Login'}</Text>
                        </TouchableOpacity>

                        <Text style={styles.orText}>or continue with</Text>

                        <View style={styles.socialLoginContainer}>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => signInWithProvider('google')}
                                disabled={loading}
                            >
                                <FontAwesome name="google" size={24} color="#DB4437" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => signInWithProvider('apple')}
                                disabled={loading}
                            >
                                <FontAwesome name="apple" size={24} color="#000000" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => signInWithProvider('facebook')}
                                disabled={loading}
                            >
                                <FontAwesome name="facebook" size={24} color="#4267B2" />
                            </TouchableOpacity>
                        </View>


                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => router.push("../auth/signup")}
                            disabled={loading}
                        >
                            <Text style={styles.createButtonText}>Create an account</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#00C2FF',
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
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
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    blueContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
    },
    topContent: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logo: {
        width: 140,
        height: 140,
        marginBottom: 8,
    },
    title: {
        fontSize: 44,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: 'Montserrat',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowRadius: 1,
        textShadowOffset: { width: 0, height: 3 },
    },
    subtitle: {
        fontSize: 15,
        color: 'white',
        letterSpacing: 1.5,
        marginBottom: 20,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    inputArea: {
        width: '100%',
        maxWidth: 360,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 30,
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#333',
        fontSize: 16,
    },
    whiteCard: {
        backgroundColor: 'white',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: 30,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    forgotPassword: {
        color: '#6b7280',
        fontSize: 14,
        marginBottom: 20,
    },
    loginButton: {
        backgroundColor: '#FFC700',
        paddingVertical: 16,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: "#E09A00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    loginButtonText: {
        color: '#1A1B32',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    orText: {
        color: '#9ca3af',
        fontSize: 14,
        marginVertical: 15,
    },
    createButton: {
        backgroundColor: 'white',
        paddingVertical: 15,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d1d5db',
        marginTop: 15,
    },
    createButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: 'bold',
    },

    socialLoginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    socialButton: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 25,
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
});