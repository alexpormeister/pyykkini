import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    cardBorder: '#F1F5F9',
    success: '#10B981',
};

interface PaymentSelectionProps {
    originalTotal?: number;
    finalTotal?: number;
    style?: ViewStyle;
    selectedMethod?: string;
    onMethodSelect?: (method: string) => void;
}

const PAYMENT_METHODS = [
    {
        id: 'apple_google_pay',
        name: Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay',
        subtitle: 'Nopea ja turvallinen maksu',
        popular: true,
    },
    {
        id: 'card',
        name: 'Maksukortti',
        subtitle: 'Visa, Mastercard, American Express',
    },
    {
        id: 'mobilepay',
        name: 'MobilePay & Verkkopankki',
        subtitle: 'Suomalaiset pankit ja MobilePay',
    },
    {
        id: 'klarna',
        name: 'Klarna',
        subtitle: 'Maksa 30 pv kuluessa tai pilko eriin',
    },
];

const PaymentSelection: React.FC<PaymentSelectionProps> = ({
    style,
    selectedMethod = 'apple_google_pay',
    onMethodSelect,
}) => {
    const [selected, setSelected] = useState(selectedMethod);

    const handleSelect = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelected(id);
        if (onMethodSelect) {
            onMethodSelect(id);
        }
    };

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                    <Feather name="credit-card" size={15} color={COLORS.primaryDark} />
                </View>
                <View>
                    <Text style={styles.title}>Valitse maksutapa</Text>
                    <Text style={styles.subtitle}>Turvalliset ja suojatut maksutavat</Text>
                </View>
            </View>

            {/* MAKSUTAVAT */}
            <View style={styles.methodsList}>
                {PAYMENT_METHODS.map((method) => {
                    const isSelected = selected === method.id;
                    return (
                        <TouchableOpacity
                            key={method.id}
                            style={[styles.methodCard, isSelected && styles.methodCardActive]}
                            onPress={() => handleSelect(method.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.methodLeft}>
                                <View style={[styles.methodIconBox, isSelected && styles.methodIconBoxActive]}>
                                    {method.id === 'apple_google_pay' ? (
                                        <FontAwesome5
                                            name={Platform.OS === 'ios' ? 'apple-pay' : 'google-pay'}
                                            size={20}
                                            color={isSelected ? COLORS.primaryDark : '#0F172A'}
                                        />
                                    ) : method.id === 'klarna' ? (
                                        <Text style={[styles.klarnaText, isSelected && styles.klarnaTextActive]}>K.</Text>
                                    ) : method.id === 'mobilepay' ? (
                                        <MaterialCommunityIcons
                                            name="cellphone"
                                            size={18}
                                            color={isSelected ? COLORS.primaryDark : '#64748B'}
                                        />
                                    ) : (
                                        <Feather
                                            name="credit-card"
                                            size={16}
                                            color={isSelected ? COLORS.primaryDark : '#64748B'}
                                        />
                                    )}
                                </View>

                                <View style={styles.methodInfo}>
                                    <View style={styles.methodTitleRow}>
                                        <Text style={[styles.methodName, isSelected && styles.methodNameActive]}>
                                            {method.name}
                                        </Text>
                                        {method.popular && (
                                            <View style={styles.popularBadge}>
                                                <Text style={styles.popularBadgeText}>Suosittu</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
                                </View>
                            </View>

                            <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                                {isSelected && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.secureBadge}>
                <Feather name="shield" size={13} color="#10B981" />
                <Text style={styles.secureText}>Suojattu ja salattu Stripe-maksu</Text>
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
        alignItems: 'center',
        marginBottom: 14,
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
    subtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 1,
    },
    methodsList: {
        marginBottom: 10,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginBottom: 8,
    },
    methodCardActive: {
        backgroundColor: '#F0F9FF',
        borderColor: '#00C2FF',
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 1,
    },
    methodLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    methodIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    methodIconBoxActive: {
        borderColor: '#BAE6FD',
        backgroundColor: '#FFFFFF',
    },
    klarnaText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
    },
    klarnaTextActive: {
        color: '#0284C7',
    },
    methodInfo: {
        flex: 1,
    },
    methodTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    methodName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    methodNameActive: {
        color: '#0284C7',
        fontWeight: '800',
    },
    popularBadge: {
        backgroundColor: '#E0F7FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 6,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0284C7',
    },
    methodSubtitle: {
        fontSize: 11,
        color: COLORS.textGray,
        marginTop: 1,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    radioCircleActive: {
        borderColor: '#00C2FF',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00C2FF',
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        gap: 6,
    },
    secureText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
});

export default PaymentSelection;