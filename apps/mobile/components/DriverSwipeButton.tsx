import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_WIDTH = SCREEN_WIDTH - 48;
const BUTTON_HEIGHT = 58;
const THUMB_SIZE = 50;
const SWIPE_RANGE = BUTTON_WIDTH - THUMB_SIZE - 8;

interface DriverSwipeButtonProps {
    onSwipeSuccess: () => void;
    title?: string;
    loading?: boolean;
    disabled?: boolean;
}

export const DriverSwipeButton: React.FC<DriverSwipeButtonProps> = ({
    onSwipeSuccess,
    title = 'Ota keikka',
    loading = false,
    disabled = false,
}) => {
    const translateX = useSharedValue(0);
    const hasTriggered = useSharedValue(false);

    useEffect(() => {
        if (!loading) {
            hasTriggered.value = false;
            translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        }
    }, [loading]);

    const triggerHaptic = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };

    const triggerCallback = () => {
        onSwipeSuccess();
    };

    const panGesture = Gesture.Pan()
        .enabled(!disabled && !loading)
        .activeOffsetX([-5, 5])
        .failOffsetY([-20, 20])
        .onUpdate((event) => {
            if (hasTriggered.value) return;
            translateX.value = Math.max(0, Math.min(event.translationX, SWIPE_RANGE));
        })
        .onEnd(() => {
            if (hasTriggered.value) return;
            // 40% pyyhkäisy riittää hyväksyntään
            if (translateX.value > SWIPE_RANGE * 0.4) {
                hasTriggered.value = true;
                translateX.value = withSpring(SWIPE_RANGE, { damping: 14, stiffness: 130 });
                runOnJS(triggerHaptic)();
                runOnJS(triggerCallback)();
            } else {
                translateX.value = withSpring(0, { damping: 15, stiffness: 130 });
            }
        });

    const animatedHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_RANGE * 0.45], [1, 0], Extrapolate.CLAMP),
        transform: [
            { translateX: interpolate(translateX.value, [0, SWIPE_RANGE], [0, 25], Extrapolate.CLAMP) },
        ],
    }));

    return (
        <View style={[styles.outerWrapper, (disabled || loading) && styles.disabled]}>
            <LinearGradient
                colors={['#00C2FF', '#0284C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientContainer}
            >
                {/* Taustateksti ja ohje */}
                <Animated.View style={[styles.textWrapper, animatedTextStyle]}>
                    <Text style={styles.buttonText}>
                        {loading ? 'Vahvistetaan...' : 'Pyyhkäise ottaaksesi keikan'}
                    </Text>
                </Animated.View>

                {/* Liu'utettava nappi */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.thumb, animatedHandleStyle]}>
                        {loading ? (
                            <ActivityIndicator size="small" color="#0284C7" />
                        ) : (
                            <Feather name="chevrons-right" size={24} color="#0284C7" />
                        )}
                    </Animated.View>
                </GestureDetector>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    outerWrapper: {
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 6,
        alignSelf: 'center',
        marginVertical: 8,
    },
    gradientContainer: {
        flex: 1,
        borderRadius: BUTTON_HEIGHT / 2,
        padding: 4,
        justifyContent: 'center',
        position: 'relative',
    },
    disabled: {
        opacity: 0.6,
    },
    textWrapper: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 36,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
});
