import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    primary: '#00C2FF',
    lightGray: '#F8FAFC',
    cardBorder: '#F1F5F9',
    pointsGold: '#F59E0B',
    textGray: '#64748B',
};

interface PointsUsageProps {
    onPointsApplied: (discount: number, pointsUsed: number) => void;
    style?: ViewStyle;
}

const PointsUsage: React.FC<PointsUsageProps> = ({ onPointsApplied, style }) => {
    const [userPoints, setUserPoints] = useState(0);
    const [pointsToUse, setPointsToUse] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchUserPoints();
    }, []);

    const fetchUserPoints = async () => {
        try {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('points_balance')
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            setUserPoints(data?.points_balance || 0);
        } catch (error) {
            console.error('Points fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePointsChange = (points: number) => {
        const roundedValue = Math.max(0, Math.min(Math.floor(points), userPoints));
        setPointsToUse(roundedValue);

        // 1p = 0.01 €
        const discount = roundedValue * 0.01;
        onPointsApplied(discount, roundedValue);
    };

    const handlePresetPress = (percentage: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const calculatedPoints = Math.round((userPoints * percentage) / 100);
        handlePointsChange(calculatedPoints);
    };

    if (isLoading) {
        return (
            <View style={[styles.card, styles.centered, style]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
        );
    }

    const currentDiscount = (pointsToUse * 0.01).toFixed(2);

    return (
        <View style={[styles.card, style]}>
            <View style={styles.headerRow}>
                <View style={styles.titleWrapper}>
                    <View style={styles.goldCircle}>
                        <MaterialCommunityIcons name="star-four-points" size={16} color={COLORS.pointsGold} />
                    </View>
                    <Text style={styles.title}>Käytä Pesupisteitä</Text>
                </View>
                <View style={styles.balanceBadge}>
                    <Text style={styles.balanceBadgeText}>Saldo: {userPoints} p</Text>
                </View>
            </View>

            <View style={styles.infoRow}>
                <Text style={styles.pointsLabel}>Käytetään: <Text style={styles.bold}>{pointsToUse} p</Text></Text>
                <Text style={styles.discountLabel}>–{currentDiscount} €</Text>
            </View>

            {/* 🌟 SLIDER JOKA HYPPÄÄ NAPAUTUKSESTA MIHIN TAHANSA 🌟 */}
            <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={userPoints || 1}
                step={10}
                value={pointsToUse}
                onValueChange={handlePointsChange}
                tapToSeek={true}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="#E2E8F0"
                thumbTintColor={COLORS.primary}
                disabled={userPoints <= 0}
            />

            {/* PIKAVALINTANAPIT (25%, 50%, 75%, 100%) */}
            {userPoints > 0 && (
                <View style={styles.presetsRow}>
                    <TouchableOpacity
                        style={[styles.presetBtn, pointsToUse === 0 && styles.presetBtnActive]}
                        onPress={() => handlePresetPress(0)}
                    >
                        <Text style={[styles.presetBtnText, pointsToUse === 0 && styles.presetBtnTextActive]}>0%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.presetBtn, pointsToUse === Math.round(userPoints * 0.25) && styles.presetBtnActive]}
                        onPress={() => handlePresetPress(25)}
                    >
                        <Text style={[styles.presetBtnText, pointsToUse === Math.round(userPoints * 0.25) && styles.presetBtnTextActive]}>25%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.presetBtn, pointsToUse === Math.round(userPoints * 0.5) && styles.presetBtnActive]}
                        onPress={() => handlePresetPress(50)}
                    >
                        <Text style={[styles.presetBtnText, pointsToUse === Math.round(userPoints * 0.5) && styles.presetBtnTextActive]}>50%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.presetBtn, pointsToUse === Math.round(userPoints * 0.75) && styles.presetBtnActive]}
                        onPress={() => handlePresetPress(75)}
                    >
                        <Text style={[styles.presetBtnText, pointsToUse === Math.round(userPoints * 0.75) && styles.presetBtnTextActive]}>75%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.presetBtn, pointsToUse === userPoints && styles.presetBtnActive]}
                        onPress={() => handlePresetPress(100)}
                    >
                        <Text style={[styles.presetBtnText, pointsToUse === userPoints && styles.presetBtnTextActive]}>Kaikki</Text>
                    </TouchableOpacity>
                </View>
            )}

            {pointsToUse > 0 && (
                <View style={styles.appliedBadge}>
                    <Text style={styles.appliedText}>✨ {pointsToUse} pistettä käytössä tilauksessa (–{currentDiscount} €)</Text>
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
    centered: { justifyContent: 'center', alignItems: 'center', minHeight: 100 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    titleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    goldCircle: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    title: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
    balanceBadge: {
        backgroundColor: '#F8FAFC',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    balanceBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textGray,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    pointsLabel: { fontSize: 13, color: COLORS.darkText, fontWeight: '600' },
    discountLabel: { fontSize: 16, fontWeight: '900', color: '#0284C7' },
    bold: { fontWeight: '800', color: COLORS.darkText },
    slider: {
        width: '100%',
        height: 40,
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 4,
    },
    presetBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    presetBtnActive: {
        backgroundColor: '#E0F2FE',
        borderColor: '#00C2FF',
    },
    presetBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textGray,
    },
    presetBtnTextActive: {
        color: '#0284C7',
        fontWeight: '800',
    },
    appliedBadge: {
        marginTop: 12,
        backgroundColor: '#F0F9FF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    appliedText: { fontSize: 12, color: '#0284C7', fontWeight: '700' },
});

export default PointsUsage;