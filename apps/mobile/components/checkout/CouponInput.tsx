import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    lightGray: '#F8FAFC',
    cardBorder: '#F1F5F9',
    success: '#10B981',
    error: '#EF4444',
};

interface Coupon {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    usage_limit: number | null;
    usage_count: number;
    valid_from: string | null;
    valid_until: string | null;
}

interface CouponInputProps {
    onCouponApplied: (coupon: Coupon | null) => void;
    currentTotal: number;
    style?: ViewStyle;
}

const CouponInput: React.FC<CouponInputProps> = ({ onCouponApplied, style }) => {
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [validationMessage, setValidationMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) {
            setValidationMessage({ message: "Syötä kuponkikoodi.", type: 'info' });
            return;
        }

        setIsLoading(true);
        setValidationMessage(null);
        setAppliedCoupon(null);
        onCouponApplied(null);

        try {
            // 1. Haetaan kuponki
            const { data: couponData, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', couponCode.trim().toUpperCase())
                .single();

            if (error || !couponData) {
                // 🔍 TARKISTETAAN ONKO KYSEESSÄ KAVERIN SUOSITTELUKOODI (REFERRAL) 🔍
                const { data: referrerProfile } = await supabase
                    .from('profiles')
                    .select('user_id, first_name')
                    .eq('referral_code', couponCode.trim().toUpperCase())
                    .single();

                if (referrerProfile) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    const referralCoupon: Coupon = {
                        id: `ref_${referrerProfile.user_id}`,
                        code: couponCode.trim().toUpperCase(),
                        discount_type: 'fixed',
                        discount_value: 5,
                        usage_limit: null,
                        usage_count: 0,
                        valid_from: null,
                        valid_until: null,
                    };
                    setAppliedCoupon(referralCoupon);
                    onCouponApplied(referralCoupon);
                    setValidationMessage({
                        message: `Kaverikoodi aktivoitu! 5,00 € alennus myönnetty.`,
                        type: 'success'
                    });
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                setValidationMessage({ message: "Koodia ei löytynyt.", type: 'error' });
                return;
            }

            const coupon = couponData as Coupon;
            const now = new Date();

            // 2. TARKISTUKSET
            if (coupon.valid_from) {
                const validFrom = new Date(coupon.valid_from);
                if (now < validFrom) {
                    setValidationMessage({ message: "Kuponki ei ole vielä voimassa.", type: 'error' });
                    return;
                }
            }

            if (coupon.valid_until) {
                const validUntil = new Date(coupon.valid_until);
                validUntil.setHours(23, 59, 59, 999);
                if (now > validUntil) {
                    setValidationMessage({ message: "Kuponki on vanhentunut.", type: 'error' });
                    return;
                }
            }

            if (coupon.usage_limit !== null && coupon.usage_limit > 0) {
                if (coupon.usage_count >= coupon.usage_limit) {
                    setValidationMessage({ message: "Kupongin käyttömäärä on täynnä.", type: 'error' });
                    return;
                }
            }

            const discountDisplay = coupon.discount_type === 'percentage'
                ? `${coupon.discount_value}%`
                : `${coupon.discount_value.toFixed(2)} €`;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setAppliedCoupon(coupon);
            onCouponApplied(coupon);
            setValidationMessage({
                message: `Kuponki "${coupon.code}" aktivoitu! Alennus: ${discountDisplay}.`,
                type: 'success'
            });

        } catch (err) {
            setValidationMessage({ message: "Tarkistuksessa tapahtui virhe.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setValidationMessage(null);
        onCouponApplied(null);
    };

    const isApplied = !!appliedCoupon;

    return (
        <View style={[styles.card, style]}>
            <Text style={styles.title}>Alennus- tai suosittelukoodi</Text>

            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, isApplied && styles.inputDisabled]}
                    placeholder="Syötä koodi..."
                    placeholderTextColor="#94A3B8"
                    value={couponCode}
                    onChangeText={setCouponCode}
                    editable={!isApplied && !isLoading}
                    autoCapitalize="characters"
                />

                <TouchableOpacity
                    style={[styles.button, isApplied ? styles.clearButton : styles.applyButton]}
                    onPress={isApplied ? handleClearCoupon : handleApplyCoupon}
                    disabled={isLoading || (!couponCode && !isApplied)}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.buttonText}>
                            {isApplied ? 'Poista' : 'Käytä'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {validationMessage && (
                <View style={[styles.messageContainer, validationMessage.type === 'success' ? styles.messageSuccess : styles.messageError]}>
                    <Feather
                        name={validationMessage.type === 'success' ? "check-circle" : "alert-circle"}
                        size={14}
                        color={validationMessage.type === 'success' ? COLORS.success : COLORS.error}
                    />
                    <Text style={[styles.messageText, { color: validationMessage.type === 'success' ? COLORS.success : COLORS.error }]}>
                        {validationMessage.message}
                    </Text>
                </View>
            )}
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
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.lightGray,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.darkText,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 8,
    },
    inputDisabled: {
        opacity: 0.65,
        backgroundColor: '#F1F5F9',
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButton: {
        backgroundColor: COLORS.primary,
    },
    clearButton: {
        backgroundColor: '#F1F5F9',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '800',
    },
    messageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        padding: 8,
        borderRadius: 10,
    },
    messageSuccess: {
        backgroundColor: '#ECFDF5',
    },
    messageError: {
        backgroundColor: '#FEF2F2',
    },
    messageText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
});

export default CouponInput;