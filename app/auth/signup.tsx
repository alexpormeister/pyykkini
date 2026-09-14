import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Checkbox } from 'expo-checkbox';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
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

export default function SignUpScreen() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signUpWithEmail() {
        if (password !== retypePassword) {
            Alert.alert("Salasanat eivät täsmää");
            return;
        }
        if (!agreeToTerms) {
            Alert.alert("Hyväksy käyttöehdot jatkaaksesi");
            return;
        }
        if (!firstName || !lastName) {
            Alert.alert("Kirjoita etu- ja sukunimesi");
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });

        if (error) {
            Alert.alert(error.message);
        } else if (data.session) {
            Alert.alert('Rekisteröinti onnistui!', 'Tarkista sähköpostisi vahvistaaksesi tilisi.');
        } else if (data.user) {
            Alert.alert('Rekisteröinti onnistui!', 'Tarkista sähköpostisi vahvistaaksesi tilisi.');
        }
        setLoading(false);
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

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <SafeAreaView edges={['top']} style={styles.topArea}>
                    <View style={styles.topContainer}>
                        <Text style={styles.title}>Rekisteröidy Käyttäjäksi</Text>
                        <Text style={styles.subtitle}>Kohti puhtaampaa arkea</Text>
                    </View>
                </SafeAreaView>

                {/* VALKOINEN KORTTI - TÄYTTÄÄ KOKO POHJAN ILMAN SINISTÄ VUOTOA */}
                <View style={styles.whiteCard}>
                    <SafeAreaView edges={['bottom']} style={styles.cardInner}>
                        <View style={styles.inputContainer}>
                            <Feather name="user" size={20} color="#6b7280" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="First Name"
                                placeholderTextColor="#6b7280"
                                value={firstName}
                                onChangeText={setFirstName}
                                autoCapitalize="words"
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Feather name="user" size={20} color="#6b7280" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Last Name"
                                placeholderTextColor="#6b7280"
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="email-fast-outline" size={20} color="#6b7280" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#6b7280"
                                value={email}
                                onChangeText={setEmail}
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
                                onChangeText={setPassword}
                                autoCapitalize="none"
                                secureTextEntry
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Feather name="lock" size={20} color="#6b7280" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Retype Password"
                                placeholderTextColor="#6b7280"
                                value={retypePassword}
                                onChangeText={setRetypePassword}
                                autoCapitalize="none"
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.checkboxContainer}>
                            <Checkbox
                                style={styles.checkbox}
                                value={agreeToTerms}
                                onValueChange={setAgreeToTerms}
                                color={agreeToTerms ? '#00C2FF' : undefined}
                            />
                            <View style={styles.checkboxTextContainer}>
                                <Text style={styles.checkboxText}>I agree to the </Text>
                                <TouchableOpacity onPress={() => router.push('/auth/terms')}>
                                    <Text style={styles.linkText}>Terms & Privacy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.signupButton}
                            onPress={signUpWithEmail}
                            disabled={loading}
                        >
                            <Text style={styles.signupButtonText}>{loading ? 'Loading...' : 'Sign Up'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                            <Text style={styles.signInLink}>
                                Have an account? <Text style={styles.linkText}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#00C2FF',
    },
    topArea: {
        justifyContent: 'center',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 20,
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
    topContainer: {
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.25)',
        textShadowRadius: 1,
        textShadowOffset: { width: 0, height: 2 },
    },
    subtitle: {
        fontSize: 16,
        color: 'white',
        marginTop: 6,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    whiteCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    cardInner: {
        paddingHorizontal: 30,
        paddingTop: 28,
        paddingBottom: Platform.OS === 'ios' ? 20 : 28,
        alignItems: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        marginBottom: 12,
        width: '100%',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#333',
        fontSize: 16,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginTop: 6,
        marginBottom: 20,
    },
    checkbox: {
        marginRight: 10,
        borderRadius: 5,
    },
    checkboxTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxText: {
        color: '#6b7280',
    },
    linkText: {
        color: '#0284C7',
        fontWeight: 'bold',
    },
    signupButton: {
        backgroundColor: '#00C2FF',
        paddingVertical: 16,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    signupButtonText: {
        color: 'white',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    signInLink: {
        marginTop: 20,
        color: '#6b7280',
    },
});