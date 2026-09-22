import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface TrustBadge {
    id: string;
    title: string;
    icon_name: string;
    sort_order: number;
    is_active: boolean;
}

const DEFAULT_BADGES: TrustBadge[] = [
    { id: '1', title: 'Nouto ovelta', icon_name: 'truck', sort_order: 1, is_active: true },
    { id: '2', title: 'Valmista 24–48h', icon_name: 'clock', sort_order: 2, is_active: true },
    { id: '3', title: '100% Laatutakuu', icon_name: 'shield', sort_order: 3, is_active: true },
];

const mapIconName = (name: string): any => {
    switch (name?.toLowerCase()) {
        case 'truck':
            return 'truck';
        case 'clock':
            return 'clock';
        case 'shield-check':
        case 'shield':
            return 'shield';
        case 'star':
            return 'star';
        case 'heart':
            return 'heart';
        case 'award':
            return 'award';
        default:
            return 'check-circle';
    }
};

const TrustBadgeBar: React.FC = () => {
    const [badges, setBadges] = useState<TrustBadge[]>(DEFAULT_BADGES);

    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_trust_badges')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (error) {
                    console.warn('Virhe trust_badges haussa:', error);
                    return;
                }

                if (data && data.length > 0) {
                    setBadges(data);
                }
            } catch (err) {
                console.warn('Poikkeus trust_badges haussa:', err);
            }
        };

        fetchBadges();

        const channel = supabase
            .channel('app-trust-badges-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_trust_badges' },
                () => {
                    fetchBadges();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <View style={styles.container}>
            {badges.map((badge, index) => (
                <View key={badge.id || index} style={styles.item}>
                    <View style={styles.iconCircle}>
                        <Feather name={mapIconName(badge.icon_name)} size={14} color="#0284C7" />
                    </View>
                    <Text style={styles.title} numberOfLines={1}>{badge.title}</Text>
                </View>
            ))}
        </View>
    );
};

export default TrustBadgeBar;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#E0F2FE',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    iconCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0369A1',
        letterSpacing: 0.2,
    },
});
