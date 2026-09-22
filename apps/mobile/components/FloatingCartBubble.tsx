import { Feather } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
    Animated,
    Dimensions,
    PanResponder,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { selectCartItems } from '../redux/cartSlice';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Vakiot
const BUBBLE_SIZE = 60;
const SNAP_PADDING = 15;
const TAP_THRESHOLD = 5;

interface FloatingCartBubbleProps {
    onPress: () => void;
}

const FloatingCartBubble: React.FC<FloatingCartBubbleProps> = ({ onPress }) => {
    const insets = useSafeAreaInsets();
    const cartItems = useSelector(selectCartItems);
    const itemCount = cartItems.length;

    // Määritetään turvalliset rajat
    const SAFE_BOTTOM = SCREEN_HEIGHT - insets.bottom - BUBBLE_SIZE - SNAP_PADDING;
    const SAFE_TOP = insets.top + SNAP_PADDING;
    const SAFE_RIGHT = SCREEN_WIDTH - BUBBLE_SIZE - SNAP_PADDING;
    const SAFE_LEFT = SNAP_PADDING;

    // Alustetaan pallo turvalliseen paikkaan (oikea alareuna navigoinnin yläpuolella)
    const pan = useRef(new Animated.ValueXY({
        x: SAFE_RIGHT,
        y: SAFE_BOTTOM - 100 // Hieman irti aivan alareunasta oletuksena
    })).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: (pan.x as any)._value,
                    y: (pan.y as any)._value
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
                useNativeDriver: false,
            }),
            onPanResponderRelease: (evt, gestureState) => {
                pan.flattenOffset();

                const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);

                // Klikkaus-tunnistus
                if (distance < TAP_THRESHOLD) {
                    onPress();
                    return;
                }

                const currentX = (pan.x as any)._value;
                const currentY = (pan.y as any)._value;

                // Lasketaan mihin reunaan pallo "snappaa"
                let targetX = currentX < SCREEN_WIDTH / 2 ? SAFE_LEFT : SAFE_RIGHT;

                // Varmistetaan ettei pallo jää pystysuunnassa suoja-alueiden ulkopuolelle
                let targetY = Math.min(Math.max(currentY, SAFE_TOP), SAFE_BOTTOM);

                Animated.spring(pan, {
                    toValue: { x: targetX, y: targetY },
                    useNativeDriver: false,
                    damping: 20,
                    stiffness: 150,
                }).start();
            },
        })
    ).current;

    if (itemCount === 0) return null;

    return (
        <Animated.View
            style={[
                styles.bubbleContainer,
                {
                    transform: pan.getTranslateTransform(),
                },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={styles.bubble}>
                <Feather name="shopping-cart" size={24} color={COLORS.white} />

                {itemCount > 0 && (
                    <View style={styles.itemCountBubble}>
                        <Text style={styles.itemCountText}>{itemCount}</Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

// --- TYYLIT ---
const COLORS = {
    white: '#FFFFFF',
    primary: '#00c2ff',
    textDark: '#222222',
};

const styles = StyleSheet.create({
    bubbleContainer: {
        position: 'absolute',
        zIndex: 9999,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        // Alkuperäinen sijoittelu on top/left 0, koska transform hoitaa loput
        top: 0,
        left: 0,
    },
    bubble: {
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_SIZE / 2,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    itemCountBubble: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderRadius: 10,
        minWidth: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    itemCountText: {
        color: COLORS.textDark,
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default FloatingCartBubble;