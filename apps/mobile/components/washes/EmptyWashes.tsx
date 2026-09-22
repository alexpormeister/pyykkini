import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EmptyWashes: React.FC<{ onStartShopping?: () => void }> = ({ onStartShopping }) => {
    const router = useRouter();

    const handleSelectWashScroll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (onStartShopping) {
            onStartShopping();
        } else {
            router.push({
                pathname: '/',
                params: { action: 'scrollToMenu' },
            });
        }
    };

    return (
        <LinearGradient
            colors={['#FFFFFF', '#F9FCFF', '#F0F8FE', '#EBF6FE']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.fullScreenContainer}
        >
            {/* 🌟 KOKO RUUDULLE LEVITETYT PEHMEÄT JA RAIKKAAT PALLEROT 🌟 */}
            <View style={[styles.bubble, styles.bubble1]} />
            <View style={[styles.bubble, styles.bubble2]} />
            <View style={[styles.bubble, styles.bubble3]} />
            <View style={[styles.bubble, styles.bubble4]} />
            <View style={[styles.bubble, styles.bubble5]} />
            <View style={[styles.bubble, styles.bubble6]} />
            <View style={[styles.bubble, styles.bubble7]} />

            {/* SAFE AREA & KESKITETTY SISÄLTÖ */}
            <SafeAreaView style={styles.safeAreaContainer} edges={['top', 'bottom']}>
                <View style={styles.centerContent}>
                    {/* 3D KORI-IKONI JA HEHKUPIIRI */}
                    <View style={styles.imageWrapper}>
                        <LinearGradient
                            colors={['#F0F9FF', '#E0F2FE', '#BAE6FD']}
                            style={styles.imageGlowCircle}
                        >
                            <Image
                                source={require("../../assets/images/empty-basket-3d.png")}
                                style={styles.image}
                                resizeMode="contain"
                            />
                        </LinearGradient>
                    </View>

                    {/* TEKSTIT */}
                    <Text style={styles.title}>Korisi on tyhjä</Text>
                    <Text style={styles.subtitle}>
                        Näyttäisi siltä, että et ole vielä lisännyt puhtaita unelmia koriisi.
                    </Text>

                    {/* SELAA PESUJA -NAPPI (ILMAN IKONEITA) */}
                    <TouchableOpacity
                        style={styles.primaryButtonWrapper}
                        onPress={handleSelectWashScroll}
                        activeOpacity={0.88}
                    >
                        <LinearGradient
                            colors={['#00C2FF', '#0284C7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.primaryButtonGradient}
                        >
                            <Text style={styles.primaryButtonText}>Selaa pesuja</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    safeAreaContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Vaaleat ja ilmavat koristepallerot koko näytölle
    bubble: {
        position: 'absolute',
        borderRadius: 999,
    },
    bubble1: {
        width: SCREEN_WIDTH * 0.65,
        height: SCREEN_WIDTH * 0.65,
        backgroundColor: 'rgba(56, 189, 248, 0.07)',
        top: -SCREEN_WIDTH * 0.2,
        right: -SCREEN_WIDTH * 0.15,
    },
    bubble2: {
        width: SCREEN_WIDTH * 0.5,
        height: SCREEN_WIDTH * 0.5,
        backgroundColor: 'rgba(2, 132, 199, 0.04)',
        bottom: -SCREEN_WIDTH * 0.1,
        left: -SCREEN_WIDTH * 0.15,
    },
    bubble3: {
        width: 85,
        height: 85,
        backgroundColor: 'rgba(0, 194, 255, 0.08)',
        top: SCREEN_HEIGHT * 0.12,
        left: 20,
    },
    bubble4: {
        width: 50,
        height: 50,
        backgroundColor: 'rgba(14, 165, 233, 0.07)',
        top: SCREEN_HEIGHT * 0.22,
        right: 32,
    },
    bubble5: {
        width: 130,
        height: 130,
        backgroundColor: 'rgba(186, 230, 253, 0.18)',
        bottom: SCREEN_HEIGHT * 0.2,
        right: -40,
    },
    bubble6: {
        width: 38,
        height: 38,
        backgroundColor: 'rgba(2, 132, 199, 0.06)',
        bottom: SCREEN_HEIGHT * 0.12,
        left: SCREEN_WIDTH * 0.25,
    },
    bubble7: {
        width: 22,
        height: 22,
        backgroundColor: 'rgba(0, 194, 255, 0.1)',
        top: SCREEN_HEIGHT * 0.38,
        left: 36,
    },

    // Keskisisältö
    centerContent: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 28,
        zIndex: 10,
    },
    imageWrapper: {
        marginBottom: 24,
    },
    imageGlowCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 6,
    },
    image: {
        width: 95,
        height: 95,
    },

    // Tekstit
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 10,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        maxWidth: 320,
    },

    // Painike ilman ikoneita
    primaryButtonWrapper: {
        width: '100%',
        maxWidth: 280,
        borderRadius: 22,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryButtonGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 28,
        borderRadius: 22,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 17,
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});

export default EmptyWashes;