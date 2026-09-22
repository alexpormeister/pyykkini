import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const DRIVER_ZONES_KEY = 'pesuni_driver_selected_zones';

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    darkText: '#0F172A',
    grayText: '#64748B',
    lightGray: '#94A3B8',
    border: '#E2E8F0',
    green: '#10B981',
};

interface DynamicZone {
    id: string;
    city: string;
    selected: boolean;
}

// Oletuspalvelualueet varalle, jos tietokantataulu on tyhjä
const DEFAULT_FALLBACK_ZONES: DynamicZone[] = [
    { id: 'helsinki', city: 'Helsinki', selected: true },
    { id: 'espoo', city: 'Espoo', selected: true },
    { id: 'vantaa', city: 'Vantaa', selected: true },
    { id: 'kauniainen', city: 'Kauniainen', selected: true },
];

export default function DriverOperatingAreaScreen() {
    const router = useRouter();
    const [zones, setZones] = useState<DynamicZone[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [savedNotice, setSavedNotice] = useState<boolean>(false);

    // Haetaan ylläpitäjän selaimella aktivoimat toimialueet Supabasesta
    const fetchAdminActiveZones = useCallback(async () => {
        try {
            // Haetaan kuljettajan aiemmin tallentamat valinnat
            const savedJson = await AsyncStorage.getItem(DRIVER_ZONES_KEY);
            const savedSelections: Record<string, boolean> = savedJson ? JSON.parse(savedJson) : {};

            // Haetaan Supabasesta vain rivit joissa is_active = true
            const { data, error } = await supabase
                .from('service_areas')
                .select('id, city, is_active')
                .eq('is_active', true);

            if (!error && data && data.length > 0) {
                // Poistetaan kaksoiskappaleet kaupungin nimen perusteella
                const uniqueMap = new Map<string, DynamicZone>();

                data.forEach((item: any) => {
                    const cityName = item.city ? item.city.trim() : 'Palvelualue';
                    const cityKey = cityName.toLowerCase();

                    if (!uniqueMap.has(cityKey)) {
                        const isSelected = savedSelections[cityKey] !== undefined
                            ? savedSelections[cityKey]
                            : true; // Oletuksena aktiivinen jos uusi alue

                        uniqueMap.set(cityKey, {
                            id: item.id || cityKey,
                            city: cityName,
                            selected: isSelected,
                        });
                    }
                });

                setZones(Array.from(uniqueMap.values()));
            } else {
                // Jos tietokannassa ei vielä ole service_areas -rivejä, käytetään oletusalueita
                const merged = DEFAULT_FALLBACK_ZONES.map(z => ({
                    ...z,
                    selected: savedSelections[z.id] !== undefined ? savedSelections[z.id] : z.selected,
                }));
                setZones(merged);
            }
        } catch {
            setZones(DEFAULT_FALLBACK_ZONES);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAdminActiveZones();

        // Kuunnellaan reaaliajassa, jos ylläpitäjä muuttaa alueita selaimessa
        const channel = supabase
            .channel('service_areas_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'service_areas' },
                () => {
                    fetchAdminActiveZones();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAdminActiveZones]);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.replace('/driver/profile' as any);
    };

    const toggleZone = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setZones(prev =>
            prev.map(z => (z.id === id ? { ...z, selected: !z.selected } : z))
        );
    };

    const handleSave = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setSavedNotice(true);

        try {
            const selections: Record<string, boolean> = {};
            zones.forEach(z => {
                selections[z.id.toLowerCase()] = z.selected;
                selections[z.city.toLowerCase()] = z.selected;
            });
            await AsyncStorage.setItem(DRIVER_ZONES_KEY, JSON.stringify(selections));
        } catch {}

        setTimeout(() => {
            setSavedNotice(false);
            router.replace('/driver/profile' as any);
        }, 400);
    };

    const selectedCount = zones.filter(z => z.selected).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Toimialue</Text>

                <View style={{ width: 32 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchAdminActiveZones();
                            }}
                            tintColor={COLORS.primary}
                        />
                    }
                >
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>
                            Toimialueet ({selectedCount}/{zones.length})
                        </Text>
                    </View>

                    {/* SIMPPELI & MINIMALISTINEN KORTTIRYHMÄ */}
                    <View style={styles.cardGroup}>
                        {zones.map((zone, index) => (
                            <React.Fragment key={zone.id}>
                                <TouchableOpacity
                                    style={styles.zoneRow}
                                    onPress={() => toggleZone(zone.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.zoneRowLeft}>
                                        <View style={[
                                            styles.zoneIcon,
                                            zone.selected ? { backgroundColor: '#E0F2FE' } : { backgroundColor: '#F1F5F9' }
                                        ]}>
                                            <Feather
                                                name="map-pin"
                                                size={18}
                                                color={zone.selected ? '#0284C7' : '#94A3B8'}
                                            />
                                        </View>
                                        <Text style={[styles.zoneTitle, zone.selected && styles.zoneTitleSelected]}>
                                            {zone.city}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={zone.selected}
                                        onValueChange={() => toggleZone(zone.id)}
                                        trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
                                        thumbColor={zone.selected ? '#0284C7' : '#FFFFFF'}
                                    />
                                </TouchableOpacity>
                                {index < zones.length - 1 && <View style={styles.separator} />}
                            </React.Fragment>
                        ))}
                    </View>

                    {/* TALLENNA PAINIKE */}
                    <View style={{ marginBottom: 30 }}>
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            activeOpacity={0.8}
                        >
                            <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.saveBtnText}>
                                {savedNotice ? 'Tallennettu!' : 'Tallenna toimialueet'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
        paddingTop: 20,
        paddingBottom: 40,
    },
    sectionHeaderRow: {
        marginBottom: 10,
        marginLeft: 4,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    cardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        marginBottom: 24,
    },
    zoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    zoneRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    zoneIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    zoneTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    zoneTitleSelected: {
        fontWeight: '800',
        color: '#0F172A',
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 68,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 16,
        borderRadius: 18,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
