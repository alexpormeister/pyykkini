import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchActiveServiceAreas, matchAddressServiceArea } from '../../lib/serviceAreas';
import { calculateOrderPricing, useSystemSettings } from '../../lib/systemSettings';
import {
    CartItem,
    decrementQuantity,
    incrementQuantity,
    removeFromCart,
    selectCartItems,
    selectCartTotalPrice,
} from '../../redux/cartSlice';
import { selectUserProfile } from '../../redux/profileSlice';

const COLORS = {
    primary: '#00C2FF',
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    cardBorder: 'rgba(255, 255, 255, 0.8)',
    red: '#EF4444',
    green: '#10B981',
};

interface CartListProps {
    style?: ViewStyle;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
}

const CartList: React.FC<CartListProps> = ({
    style,
    ListHeaderComponent,
    ListEmptyComponent
}) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const cartItems = useSelector(selectCartItems);
    const rawTotalPrice = useSelector(selectCartTotalPrice);
    const userProfile = useSelector(selectUserProfile);
    const settings = useSystemSettings();
    const [serviceAreas, setServiceAreas] = React.useState<any[]>([]);

    React.useEffect(() => {
        fetchActiveServiceAreas().then(setServiceAreas);
    }, []);

    const serviceAreaMatch = React.useMemo(() => {
        return matchAddressServiceArea(userProfile?.address, serviceAreas);
    }, [userProfile?.address, serviceAreas]);

    const deliveryFee = serviceAreaMatch.deliveryFee || 0;

    const pricing = calculateOrderPricing({
        itemsTotal: rawTotalPrice,
        serviceFee: settings.service_fee,
        deliveryFee: deliveryFee,
        vatRate: settings.vat_rate,
    });

    const handleCheckoutAction = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

        if (!userProfile?.address) {
            Alert.alert(
                "Toimitusosoite puuttuu",
                "Määritä toimitusosoitteesi ennen kassalle siirtymistä.",
                [
                    { text: "Peruuta", style: "cancel" },
                    { text: "Aseta osoite", onPress: () => router.push('/general/personal-data') }
                ]
            );
            return;
        }

        try {
            const activeAreas = await fetchActiveServiceAreas();
            const match = matchAddressServiceArea(userProfile?.address, activeAreas);

            if (!match.isSupported && activeAreas.length > 0) {
                Alert.alert(
                    "Toimitusalueen ulkopuolella",
                    `Emme vielä valitettavasti toimi osoitteesi alueella (${userProfile.address}). Toimimme alueilla: ${match.activeCities.join(', ')}.`,
                    [
                        { text: "Sulje", style: "cancel" },
                        { text: "Päivitä osoite", onPress: () => router.push('/general/personal-data') }
                    ]
                );
                return;
            }
        } catch (e) {
            console.warn("Aluetarkistus ohitettu:", e);
        }

        router.push("/checkout");
    };

    const renderItem = ({ item }: { item: CartItem }) => (
        <View style={styles.cartItem}>
            <View style={styles.itemDetails}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)} €</Text>
                    <Text style={styles.itemSinglePrice}>({item.price.toFixed(2)} € / kpl)</Text>
                </View>
            </View>

            <View style={styles.quantityContainer}>
                <TouchableOpacity
                    style={styles.qtyButton}
                    activeOpacity={0.7}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        if (item.quantity === 1) {
                            dispatch(removeFromCart(item.id));
                        } else {
                            dispatch(decrementQuantity(item.id));
                        }
                    }}
                >
                    <Feather
                        name={item.quantity === 1 ? "trash-2" : "minus"}
                        size={15}
                        color={item.quantity === 1 ? COLORS.red : COLORS.darkText}
                    />
                </TouchableOpacity>

                <Text style={styles.qtyText}>{item.quantity}</Text>

                <TouchableOpacity
                    style={styles.qtyButton}
                    activeOpacity={0.7}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        dispatch(incrementQuantity(item.id));
                    }}
                >
                    <Feather name="plus" size={15} color={COLORS.darkText} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <LinearGradient
            colors={['#E0F2FE', '#F0F9FF', '#FFFFFF']}
            locations={[0, 0.35, 1]}
            style={[styles.container, style]}
        >
            <View style={styles.listContent}>
                {React.isValidElement(ListHeaderComponent) ? ListHeaderComponent : (ListHeaderComponent ? React.createElement(ListHeaderComponent as any) : null)}
                {cartItems.length === 0 && (React.isValidElement(ListEmptyComponent) ? ListEmptyComponent : (ListEmptyComponent ? React.createElement(ListEmptyComponent as any) : null))}
                {cartItems.map((item) => (
                    <React.Fragment key={item.id.toString()}>
                        {renderItem({ item })}
                    </React.Fragment>
                ))}
            </View>

            {cartItems.length > 0 && (
                <View style={styles.footer}>
                    {/* HINTAERITTELY */}
                    <View style={styles.priceBreakdownBox}>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Tuotteet</Text>
                            <Text style={styles.breakdownValue}>{pricing.itemsTotal.toFixed(2)} €</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Toimitusmaksu</Text>
                            <Text style={[styles.breakdownValue, pricing.deliveryFee === 0 && styles.freeText]}>
                                {pricing.deliveryFee > 0 ? `${pricing.deliveryFee.toFixed(2)} €` : 'Ilmainen'}
                            </Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Palvelumaksu</Text>
                            <Text style={styles.breakdownValue}>{pricing.serviceFee.toFixed(2)} €</Text>
                        </View>
                    </View>

                    <View style={styles.totalRow}>
                        <View>
                            <Text style={styles.totalLabel}>Yhteensä</Text>
                            <Text style={styles.vatText}>
                                (josta ALV {pricing.vatRate.toString().replace('.', ',')}%: {pricing.vatAmount.toFixed(2)} €)
                            </Text>
                        </View>
                        <Text style={styles.totalPriceText}>{pricing.finalTotal.toFixed(2)} €</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.checkoutButton}
                        onPress={handleCheckoutAction}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.checkoutButtonText}>Siirry kassalle</Text>
                        <Feather name="arrow-right" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
        flexGrow: 1,
    },
    cartItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    itemDetails: {
        flex: 1,
        paddingRight: 12,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.darkText,
        marginBottom: 4,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0284C7',
        marginRight: 6,
    },
    itemSinglePrice: {
        fontSize: 12,
        color: COLORS.textGray,
        fontWeight: '500',
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 3,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    qtyButton: {
        width: 32,
        height: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    qtyText: {
        fontSize: 14,
        fontWeight: '800',
        marginHorizontal: 12,
        color: COLORS.darkText,
        minWidth: 16,
        textAlign: 'center',
    },
    footer: {
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        borderRadius: 24,
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'ios' ? 108 : 96,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
    },
    priceBreakdownBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    breakdownLabel: {
        fontSize: 13,
        color: COLORS.textGray,
        fontWeight: '500',
    },
    breakdownValue: {
        fontSize: 13,
        color: COLORS.darkText,
        fontWeight: '700',
    },
    freeText: {
        color: COLORS.green,
        fontWeight: '700',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    totalLabel: {
        fontSize: 15,
        color: COLORS.darkText,
        fontWeight: '700',
    },
    vatText: {
        fontSize: 11,
        color: COLORS.textGray,
        marginTop: 2,
    },
    totalPriceText: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.darkText,
        letterSpacing: -0.5,
    },
    checkoutButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        height: 54,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 4,
    },
    checkoutButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
});

export default CartList;