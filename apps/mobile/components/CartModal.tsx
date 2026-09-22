import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchActiveServiceAreas, matchAddressServiceArea } from '../lib/serviceAreas';
import { calculateOrderPricing, useSystemSettings } from '../lib/systemSettings';
import {
    CartItem,
    decrementQuantity,
    incrementQuantity,
    removeFromCart,
    selectCartItems,
    selectCartTotalPrice,
} from '../redux/cartSlice';
import { selectUserProfile } from '../redux/profileSlice';

const COLORS = {
    primary: '#00C2FF',
    primaryLight: '#E0F2FE',
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    background: '#F8FAFC',
    cardBorder: '#F1F5F9',
    red: '#EF4444',
    green: '#10B981',
};

interface CartModalProps {
    isVisible: boolean;
    onClose: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isVisible, onClose }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const cartItems = useSelector(selectCartItems);
    const rawTotalPrice = useSelector(selectCartTotalPrice);
    const userProfile = useSelector(selectUserProfile);
    const settings = useSystemSettings();

    const [serviceAreas, setServiceAreas] = useState<any[]>([]);

    useEffect(() => {
        if (isVisible) {
            fetchActiveServiceAreas().then(setServiceAreas);
        }
    }, [isVisible]);

    const serviceAreaMatch = useMemo(() => {
        return matchAddressServiceArea(userProfile?.address, serviceAreas);
    }, [userProfile?.address, serviceAreas]);

    const deliveryFee = serviceAreaMatch.deliveryFee || 0;

    const pricing = calculateOrderPricing({
        itemsTotal: rawTotalPrice,
        serviceFee: settings.service_fee,
        deliveryFee: deliveryFee,
        vatRate: settings.vat_rate,
    });

    const handleCheckout = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const activeAreas = await fetchActiveServiceAreas();
        const match = matchAddressServiceArea(userProfile?.address, activeAreas);

        if (!userProfile?.address) {
            Alert.alert(
                "Toimitusosoite puuttuu",
                "Määritä toimitusosoitteesi ennen kassalle siirtymistä.",
                [
                    { text: "Peruuta", style: "cancel" },
                    { text: "Aseta osoite", onPress: () => { onClose(); router.push('/general/personal-data'); } }
                ]
            );
            return;
        }

        if (!match.isSupported) {
            Alert.alert(
                "Toimitusalueen ulkopuolella",
                `Emme vielä valitettavasti toimi osoitteesi alueella (${userProfile.address}). Toimimme alueilla: ${match.activeCities.join(', ')}.`,
                [
                    { text: "Sulje", style: "cancel" },
                    { text: "Päivitä osoite", onPress: () => { onClose(); router.push('/general/personal-data'); } }
                ]
            );
            return;
        }

        onClose();
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
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
                    <View style={styles.modalContent}>
                        <View style={styles.pullBar} />

                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerTitle}>Ostoskori</Text>
                                <Text style={styles.headerSubtitle}>
                                    {cartItems.length} {cartItems.length === 1 ? 'tuote valittuna' : 'tuotetta valittuna'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                                <Feather name="x" size={20} color={COLORS.darkText} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={cartItems}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <View style={styles.emptyIconCircle}>
                                        <Feather name="shopping-bag" size={36} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.emptyTitle}>Ostoskorisi on tyhjä</Text>
                                    <Text style={styles.emptyDesc}>Valitse puhtaita palveluita ja lisää ne koriin.</Text>
                                    <TouchableOpacity style={styles.continueShoppingButton} onPress={onClose} activeOpacity={0.8}>
                                        <Text style={styles.continueShoppingText}>Selaa palveluita</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        />

                        {cartItems.length > 0 && (
                            <View style={styles.footer}>
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
                                    onPress={handleCheckout}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.checkoutButtonText}>Siirry kassalle</Text>
                                    <Feather name="arrow-right" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 20,
    },
    pullBar: {
        width: 36,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.darkText,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: COLORS.textGray,
        marginTop: 2,
        fontWeight: '500',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
        paddingBottom: 16,
    },
    cartItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
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
        backgroundColor: '#F8FAFC',
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
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingBottom: Platform.OS === 'ios' ? 28 : 20,
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
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.darkText,
        letterSpacing: -0.5,
    },
    checkoutButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        height: 56,
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 6,
    },
    emptyDesc: {
        fontSize: 13,
        color: COLORS.textGray,
        textAlign: 'center',
        marginBottom: 20,
    },
    continueShoppingButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
    },
    continueShoppingText: {
        color: '#0284C7',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default CartModal;