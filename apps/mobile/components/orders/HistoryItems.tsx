import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HistoryItemProps {
    store: string;
    date: string;
    price: string;
    items: string;
    isBurger?: boolean;
    onOpenReceipt?: () => void;
}

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    greenBg: '#DCFCE7',
    greenText: '#16A34A',
    accentBlue: '#0284C7',
    divider: '#F1F5F9',
    cardBorder: '#F1F5F9',
};

const HistoryItem = ({ store, date, price, items, isBurger, onOpenReceipt }: HistoryItemProps) => {
    return (
        <View style={styles.historyCard}>
            <View style={styles.mainContainer}>
                {/* VASEN PUOLI: IKONI JA PALVELUN NIMI */}
                <View style={styles.leftSection}>
                    <View style={[styles.iconCircle, isBurger && { backgroundColor: '#F1F5F9' }]}>
                        {isBurger ? (
                            <Feather name="package" size={18} color="#64748B" />
                        ) : (
                            <Feather name="check-circle" size={18} color={COLORS.greenText} />
                        )}
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={styles.storeName} numberOfLines={2}>
                            {store}
                        </Text>
                        <Text style={styles.dateText}>{date}</Text>
                    </View>
                </View>

                {/* OIKEA PUOLI: HINTA */}
                <View style={styles.priceSection}>
                    <Text style={styles.priceText}>{price}</Text>
                </View>
            </View>

            {/* ALAVIIVA JA LISÄTIEDOT */}
            <View style={styles.divider} />

            <View style={styles.historyFooter}>
                <View style={styles.timeBadge}>
                    <Feather name="clock" size={12} color="#64748B" style={{ marginRight: 5 }} />
                    <Text style={styles.itemCount}>{items}</Text>
                </View>

                <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.receiptButton}
                    onPress={onOpenReceipt}
                >
                    <Text style={styles.linkText}>Avaa kuitti</Text>
                    <Feather name="arrow-up-right" size={13} color={COLORS.accentBlue} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    historyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    mainContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.greenBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        marginLeft: 12,
        flex: 1,
    },
    storeName: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
        lineHeight: 20,
        marginBottom: 2,
    },
    dateText: {
        color: COLORS.textGray,
        fontSize: 12,
        fontWeight: '500',
    },
    priceSection: {
        marginLeft: 8,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    priceText: {
        fontSize: 17,
        fontWeight: '900',
        color: COLORS.darkText,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 4,
    },
    historyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    itemCount: {
        color: COLORS.textGray,
        fontSize: 11,
        fontWeight: '600',
    },
    receiptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    linkText: {
        color: COLORS.accentBlue,
        fontWeight: '800',
        fontSize: 12,
    },
});

export default HistoryItem;