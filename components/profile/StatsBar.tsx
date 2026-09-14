import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface StatsBarProps {
    points?: number;
    orders?: number;
    orderCount?: number;
    onOrdersPress?: () => void;
    onPointsPress?: () => void;
}

const StatsBar: React.FC<StatsBarProps> = ({
    points = 0,
    orders,
    orderCount,
    onOrdersPress,
    onPointsPress,
}) => {
    const totalOrders = orders ?? orderCount ?? 0;
    // Lasketaan pisteiden arvo euroina (100p = 2€ -> kerroin 0.02)
    const euroValue = (points * 0.02).toFixed(2).replace('.', ',');

    return (
        <View style={styles.container}>
            {/* LAATTA 1: PESUPISTEET */}
            <TouchableOpacity
                style={styles.statCard}
                onPress={onPointsPress}
                activeOpacity={onPointsPress ? 0.7 : 1}
                disabled={!onPointsPress}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="star-face" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.cardHeaderTitle}>Pesupisteet</Text>
                </View>
                <Text style={styles.statNumber}>
                    {points} <Text style={styles.unitText}>p</Text>
                </Text>
                <View style={styles.valuePill}>
                    <Feather name="gift" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                    <Text style={styles.euroValue}>{euroValue} € alennusta</Text>
                </View>
            </TouchableOpacity>

            {/* LAATTA 2: TILAUKSET */}
            <TouchableOpacity
                style={styles.statCard}
                onPress={onOrdersPress}
                activeOpacity={onOrdersPress ? 0.7 : 1}
                disabled={!onOrdersPress}
            >
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                        <MaterialCommunityIcons name="washing-machine" size={20} color="#0284C7" />
                    </View>
                    <Text style={styles.cardHeaderTitle}>Tilaukset</Text>
                </View>
                <Text style={styles.statNumber}>
                    {totalOrders} <Text style={styles.unitText}>kpl</Text>
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 16,
        gap: 12,
        marginTop: 14,
        marginBottom: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        justifyContent: 'space-between',
        minHeight: 115,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    cardHeaderTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1A1B32',
        marginBottom: 8,
    },
    unitText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#94A3B8',
    },
    valuePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    euroValue: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0284C7',
    },
});

export default StatsBar;