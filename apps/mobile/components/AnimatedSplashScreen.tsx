import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    Platform,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    onAnimationComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
    onAnimationComplete,
}) => {
    // 🎬 MINIMALISTISET ANIMAATIOARVOT 🎬
    const logoScale = useRef(new Animated.Value(0.7)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;

    const textOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(15)).current;

    const tagOpacity = useRef(new Animated.Value(0)).current;
    const tagTranslateY = useRef(new Animated.Value(10)).current;

    const progressX = useRef(new Animated.Value(0)).current;

    const containerOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});

        // 2. Käynnistetään puhtaat animaatiot
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 6,
                tension: 35,
                useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 500,
                delay: 250,
                useNativeDriver: true,
            }),
            Animated.timing(textTranslateY, {
                toValue: 0,
                duration: 500,
                delay: 250,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(tagOpacity, {
                toValue: 1,
                duration: 550,
                delay: 400,
                useNativeDriver: true,
            }),
            Animated.timing(tagTranslateY, {
                toValue: 0,
                duration: 550,
                delay: 400,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(progressX, {
                toValue: 1,
                duration: 1800,
                delay: 200,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();

        // 🌟 TAKUUAJOITUS (2.5s katseluaika) 🌟
        const timer = setTimeout(() => {
            Animated.timing(containerOpacity, {
                toValue: 0,
                duration: 450,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }).start(() => {
                onAnimationComplete();
            });
        }, 2500);

        return () => {
            clearTimeout(timer);
        };
    }, [
        containerOpacity,
        logoOpacity,
        logoScale,
        onAnimationComplete,
        progressX,
        tagOpacity,
        tagTranslateY,
        textOpacity,
        textTranslateY,
    ]);

    const progressTranslate = progressX.interpolate({
        inputRange: [0, 1],
        outputRange: [-120, 0],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: containerOpacity },
            ]}
        >
            <View style={styles.centerBox}>
                {/* 🏷️ MINIMALISTINEN LOGOKORTTI 🏷️ */}
                <Animated.View
                    style={[
                        styles.logoCard,
                        {
                            opacity: logoOpacity,
                            transform: [{ scale: logoScale }],
                        },
                    ]}
                >
                    <Image
                        source={require('../assets/images/icon.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* 🔤 BRÄNDINIMI 🔤 */}
                <Animated.View
                    style={[
                        styles.textWrapper,
                        {
                            opacity: textOpacity,
                            transform: [{ translateY: textTranslateY }],
                        },
                    ]}
                >
                    <Text style={styles.brandName}>Pesuni</Text>
                </Animated.View>

                {/* ✨ SLOGAN ✨ */}
                <Animated.View
                    style={[
                        styles.taglineWrapper,
                        {
                            opacity: tagOpacity,
                            transform: [{ translateY: tagTranslateY }],
                        },
                    ]}
                >
                    <Text style={styles.taglineText}>Puhdasta helposti kotiovellesi</Text>
                </Animated.View>

                {/* ➖ MINIMALISTINEN LATAUSPALKKI ➖ */}
                <View style={styles.progressTrack}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            {
                                transform: [{ translateX: progressTranslate }],
                            },
                        ]}
                    />
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    centerBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCard: {
        width: 135,
        height: 135,
        borderRadius: 38,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 8,
    },
    logoImage: {
        width: 100,
        height: 100,
    },
    textWrapper: {
        marginTop: 24,
        alignItems: 'center',
    },
    brandName: {
        fontSize: 34,
        fontWeight: '900',
        color: '#1A1B32',
        letterSpacing: 0.3,
        ...Platform.select({
            ios: {
                fontFamily: 'System',
            },
        }),
    },
    taglineWrapper: {
        marginTop: 6,
        alignItems: 'center',
    },
    taglineText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        letterSpacing: 0.2,
    },
    progressTrack: {
        width: 120,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: '#F1F5F9',
        marginTop: 30,
        overflow: 'hidden',
    },
    progressBar: {
        width: 120,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: '#00C2FF',
    },
});

export default AnimatedSplashScreen;
