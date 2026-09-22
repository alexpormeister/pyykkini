import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
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
const BUTTON_WIDTH = SCREEN_WIDTH - 32;
const SWIPE_RANGE = BUTTON_WIDTH - 66;

interface SwipeButtonProps {
    onSwipeSuccess: () => void;
    title: string;
    disabled?: boolean;
}

export default function SwipeButton({ onSwipeSuccess, title, disabled }: SwipeButtonProps) {
    const translateX = useSharedValue(0);

    const triggerHaptic = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };

    const panGesture = Gesture.Pan()
        .enabled(!disabled)
        .onUpdate((event) => {
            translateX.value = Math.max(0, Math.min(event.translationX, SWIPE_RANGE));
        })
        .onEnd(() => {
            // Helpotettu kynnystä 50%:iin jotta pyyhkäisy on erittäin vaivaton
            if (translateX.value > SWIPE_RANGE * 0.5) {
                translateX.value = withSpring(SWIPE_RANGE, { damping: 14, stiffness: 120 });
                runOnJS(triggerHaptic)();
                runOnJS(onSwipeSuccess)();
            } else {
                translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
            }
        });

    const animatedHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_RANGE * 0.4], [1, 0], Extrapolate.CLAMP),
        transform: [
            { translateX: interpolate(translateX.value, [0, SWIPE_RANGE], [0, 20], Extrapolate.CLAMP) }
        ]
    }));

    return (
        <View style={[styles.container, disabled && styles.disabled]}>
            <Animated.View style={[styles.textContainer, animatedTextStyle]}>
                <Text style={styles.title}>{title}</Text>
            </Animated.View>

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.handle, animatedHandleStyle]}>
                    <Feather name="chevrons-right" size={22} color="white" />
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: BUTTON_WIDTH,
        height: 64,
        backgroundColor: '#F1F5F9',
        borderRadius: 32,
        padding: 5,
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8,
    },
    disabled: {
        opacity: 0.45,
    },
    handle: {
        width: 52,
        height: 52,
        backgroundColor: '#00C2FF',
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    textContainer: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 36,
    },
    title: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});