import { Feather, FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SettingItem = {
    id: string;
    label: string;
    icon: string;
    iconBg?: string;
    iconColor?: string;
    onPress: () => void;
    badge?: number | string | null;
};

interface SettingsListProps {
    title?: string;
    items: SettingItem[];
}

const SettingsList: React.FC<SettingsListProps> = ({ title, items }) => {
    return (
        <View style={styles.container}>
            {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
            <View style={styles.listCard}>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.itemRow,
                                isLast && styles.lastItemRow
                            ]}
                            activeOpacity={0.7}
                            onPress={item.onPress}
                        >
                            <View style={[styles.iconBox, { backgroundColor: item.iconBg || '#F0F9FF' }]}>
                                <FontAwesome5
                                    name={item.icon}
                                    size={16}
                                    color={item.iconColor || '#0284C7'}
                                />
                            </View>

                            <Text style={styles.itemText}>{item.label}</Text>

                            {/* BADGE */}
                            {Boolean(item.badge !== undefined && item.badge !== null && item.badge !== '' && item.badge !== 0) && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{item.badge}</Text>
                                </View>
                            )}

                            <Feather name="chevron-right" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        marginTop: 14,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginLeft: 4,
    },
    listCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    lastItemRow: {
        borderBottomWidth: 0,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    itemText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1B32',
    },
    unreadBadge: {
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 8,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
});

export default SettingsList;