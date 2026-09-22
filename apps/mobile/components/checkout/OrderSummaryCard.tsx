import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';
import { calculateOrderPricing, useSystemSettings } from '../../lib/systemSettings';
import { selectCartItems } from '../../redux/cartSlice';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    lightGray: '#F8FAFC',
    cardBorder: '#F1F5F9',
    successGreen: '#10B981',
};

interface CartItem {
    id: string | number;
    name: string;
    price: number;
    quantity: number;
}

interface OrderSummaryCardProps {
    style?: ViewStyle;
    deliveryFee?: number;
    serviceFee?: number;
    vatRate?: number;
    couponDiscount?: number;
    pointsDiscount?: number;
    appliedCouponCode?: string;
    title?: string;
    collapsibleItems?: boolean;
}

const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
    style,
    deliveryFee,
    serviceFee,
    vatRate,
    couponDiscount = 0,
    pointsDiscount = 0,
    appliedCouponCode,
    title = 'Yhteenveto',
    collapsibleItems = false,
}) => {
    const cartItems: CartItem[] = useSelector(selectCartItems) as CartItem[];
    const settings = useSystemSettings();
    const [isItemsExpanded, setIsItemsExpanded] = useState(!collapsibleItems);

    const activeServiceFee = serviceFee !== undefined ? serviceFee : settings.service_fee;
    const activeDeliveryFee = deliveryFee !== undefined ? deliveryFee : settings.delivery_fee;
    const activeVatRate = vatRate !== undefined ? vatRate : settings.vat_rate;

    const { itemsTotal, finalTotal, vatAmount } = useMemo(() => {
        const sub = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const pricing = calculateOrderPricing({
            itemsTotal: sub,
            serviceFee: activeServiceFee,
            deliveryFee: activeDeliveryFee,
            vatRate: activeVatRate,
            couponDiscount: couponDiscount,
            pointsDiscount: pointsDiscount,
        });
        return {
            itemsTotal: sub,
            finalTotal: pricing.finalTotal,
            vatAmount: pricing.vatAmount,
        };
    }, [cartItems, activeServiceFee, activeDeliveryFee, activeVatRate, couponDiscount, pointsDiscount]);

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <View style={styles.titleRow}>
                    <View style={styles.iconCircle}>
                        <Feather name="file-text" size={15} color={COLORS.primaryDark} />
                    </View>
                    <Text style={styles.title}>{title}</Text>
                </View>
                {collapsibleItems ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setIsItemsExpanded(!isItemsExpanded)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.expandButtonText}>
                            {cartItems.length} kpl {isItemsExpanded ? '▲' : '▼'}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.itemBadge}>
                        <Text style={styles.itemBadgeText}>{cartItems.length} kpl</Text>
                    </View>
                )}
            </View>

            {/* TUOTELISTAUS */}
            {isItemsExpanded && (
                <View style={styles.itemListContainer}>
                    {cartItems.map((item) => (
                        <View key={String(item.id)} style={styles.itemRow}>
                            <View style={styles.itemBullet} />
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.itemQuantity}>{item.quantity} x {item.price.toFixed(2)} €</Text>
                            <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)} €</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.divider} />

            {/* HINTAJAKAUMA */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Pyykkipalvelut</Text>
                    <Text style={styles.summaryValue}>{itemsTotal.toFixed(2)} €</Text>
                </View>

                <View style={styles.summaryRow}>
                    <View style={styles.deliveryLabelRow}>
                        <Feather name="truck" size={13} color={COLORS.textGray} style={{ marginRight: 6 }} />
                        <Text style={styles.summaryLabel}>Kuljetuslisä</Text>
                    </View>
                    <Text style={[styles.summaryValue, activeDeliveryFee === 0 && styles.freeDeliveryText]}>
                        {activeDeliveryFee > 0 ? `${activeDeliveryFee.toFixed(2)} €` : 'Ilmainen'}
                    </Text>
                </View>

                <View style={styles.summaryRow}>
                    <View style={styles.deliveryLabelRow}>
                        <Feather name="shield" size={13} color={COLORS.textGray} style={{ marginRight: 6 }} />
                        <Text style={styles.summaryLabel}>Palvelumaksu</Text>
                    </View>
                    <Text style={styles.summaryValue}>{activeServiceFee.toFixed(2)} €</Text>
                </View>

                {/* ALENNUKSET */}
                {couponDiscount > 0 && (
                    <View style={styles.summaryRow}>
                        <View style={styles.deliveryLabelRow}>
                            <Feather name="tag" size={13} color="#10B981" style={{ marginRight: 6 }} />
                            <Text style={[styles.summaryLabel, { color: '#047857', fontWeight: '700' }]}>
                                Alennuskoodi {appliedCouponCode ? `(${appliedCouponCode})` : ''}
                            </Text>
                        </View>
                        <Text style={[styles.summaryValue, { color: '#10B981', fontWeight: '800' }]}>
                            -{couponDiscount.toFixed(2)} €
                        </Text>
                    </View>
                )}

                {pointsDiscount > 0 && (
                    <View style={styles.summaryRow}>
                        <View style={styles.deliveryLabelRow}>
                            <Feather name="star" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
                            <Text style={[styles.summaryLabel, { color: '#B45309', fontWeight: '700' }]}>
                                Pesupisteet
                            </Text>
                        </View>
                        <Text style={[styles.summaryValue, { color: '#D97706', fontWeight: '800' }]}>
                            -{pointsDiscount.toFixed(2)} €
                        </Text>
                    </View>
                )}

                <View style={styles.summaryRowTotal}>
                    <View>
                        <Text style={styles.summaryTotalLabel}>Maksettava yhteensä</Text>
                        <Text style={styles.vatSubtext}>
                            (josta ALV {activeVatRate.toString().replace('.', ',')}%: {vatAmount.toFixed(2)} €)
                        </Text>
                    </View>
                    <Text style={styles.summaryTotalValue}>{finalTotal.toFixed(2)} €</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        marginVertical: 8,
        marginHorizontal: 16,
        borderWidth: 1.5,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#E0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    itemBadge: {
        backgroundColor: '#F0F9FF',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    itemBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
    },
    expandButton: {
        backgroundColor: '#F8FAFC',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    expandButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textGray,
    },
    itemListContainer: {
        marginTop: 4,
        marginBottom: 6,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    itemBullet: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#00C2FF',
        marginRight: 8,
    },
    itemName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.darkText,
    },
    itemQuantity: {
        fontSize: 12,
        color: COLORS.textGray,
        marginRight: 12,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    summaryContainer: {
        gap: 6,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    deliveryLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 13,
        color: COLORS.textGray,
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    freeDeliveryText: {
        color: COLORS.successGreen,
        fontWeight: '800',
    },
    summaryRowTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 12,
        borderTopWidth: 1.5,
        borderTopColor: '#F1F5F9',
    },
    summaryTotalLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    vatSubtext: {
        fontSize: 11,
        color: COLORS.textGray,
        marginTop: 2,
    },
    summaryTotalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0284C7',
    },
});

export default OrderSummaryCard;