import { Feather } from '@expo/vector-icons';
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

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handlePasswordReset() {
        if (!email) {
            Alert.alert('Syötä sähköpostiosoite');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'pesuni://reset-password',
        });

        if (error) {
            Alert.alert('Virhe', error.message);
        } else {
            Alert.alert(
                'Salasanan palautus lähetetty',
                'Tarkista sähköpostisi jatkaaksesi salasanan palauttamista.'
            );
            router.replace('/auth/login');
        }
        setLoading(false);
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <LinearGradient
                colors={['#5CD1FF', '#00C2FF', '#0099FF']}
                style={StyleSheet.absoluteFill}
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
                        <View style={styles.iconCircle}>
                            <Feather name="lock" size={38} color="#00C2FF" />
                        </View>
                        <Text style={styles.boldTitle}>Unohtuiko</Text>
                        <Text style={styles.normalTitle}>Salasana?</Text>
                        <Text style={styles.subtitle}>
                            Ei hätää, lähetämme sinulle ohjeet{'\n'}salasanan palauttamiseen.
                        </Text>
                    </View>
                </SafeAreaView>

                {/* VALKOINEN KORTTI - NOSTETTU YLEMMÄS JA TÄYTTÄÄ KOKO POHJAN ILMAN SINISTÄ VUOTOA */}
                <View style={styles.whiteCard}>
                    <SafeAreaView edges={['bottom']} style={styles.cardInner}>
                        <View style={styles.inputContainer}>
                            <Feather name="mail" size={20} color="#6b7280" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Kirjoita sähköpostiosoitteesi"
                                placeholderTextColor="#6b7280"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={handlePasswordReset}
                            disabled={loading}
                        >
                            <Text style={styles.resetButtonText}>
                                {loading ? 'Lähetetään...' : 'Palauta Salasana'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.replace('/auth/login')}
                        >
                            <Feather name="arrow-left" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                            <Text style={styles.signInLink}>Takaisin kirjautumiseen</Text>
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
    lineContainer: {
        ...StyleSheet.absoluteFill,
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
    topArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
    },
    topContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        width: '100%',
        marginTop: 10,
    },
    iconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    boldTitle: {
        fontWeight: 'bold',
        fontSize: 32,
        color: 'white',
        textAlign: 'center',
        alignSelf: 'center',
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
    },
    normalTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
        textAlign: 'center',
        alignSelf: 'center',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 15,
        color: 'white',
        textAlign: 'center',
        alignSelf: 'center',
        lineHeight: 22,
        textShadowColor: 'rgba(0, 40, 95, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    whiteCard: {
        backgroundColor: 'white',
        borderTopLeftRadius: 42,
        borderTopRightRadius: 42,
        paddingHorizontal: 30,
        paddingTop: 40,
        paddingBottom: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
        width: '100%',
    },
    cardInner: {
        width: '100%',
        alignItems: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 16 : 13,
        marginBottom: 20,
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
    resetButton: {
        backgroundColor: '#00C2FF',
        paddingVertical: 16,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },
    resetButtonText: {
        color: 'white',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    signInLink: {
        color: '#0284C7',
        fontSize: 15,
        fontWeight: '700',
    },
});