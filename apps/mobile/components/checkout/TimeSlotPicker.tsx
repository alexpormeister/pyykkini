import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    primaryLight: '#E0F7FF',
    primaryBg: '#F0F9FF',
    cardBorder: '#E2E8F0',
    successGreen: '#10B981',
    successBg: '#DCFCE7',
    disabledBg: '#F8FAFC',
    disabledText: '#CBD5E1',
};

const BUFFER_HOURS = 2;
const WASH_CYCLE_HOURS = 24;

export interface TimeSlot {
    id: string;
    time: string;
    startHour: number;
    endHour?: number;
    isAvailable: boolean;
    slotType?: 'both' | 'pickup' | 'delivery';
}

interface TimeSlotPickerProps {
    onSelectionChange: (pickup: any, delivery: any) => void;
    style?: ViewStyle;
}

const DEFAULT_SLOTS: TimeSlot[] = [
    { id: 't1', time: '08:00 - 10:00', startHour: 8, endHour: 10, isAvailable: true, slotType: 'both' },
    { id: 't2', time: '10:00 - 12:00', startHour: 10, endHour: 12, isAvailable: true, slotType: 'both' },
    { id: 't3', time: '12:00 - 14:00', startHour: 12, endHour: 14, isAvailable: true, slotType: 'both' },
    { id: 't4', time: '14:00 - 16:00', startHour: 14, endHour: 16, isAvailable: true, slotType: 'both' },
    { id: 't5', time: '16:00 - 18:00', startHour: 16, endHour: 18, isAvailable: true, slotType: 'both' },
    { id: 't6', time: '18:00 - 20:00', startHour: 18, endHour: 20, isAvailable: true, slotType: 'both' },
];

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({ onSelectionChange, style }) => {
    const [slots, setSlots] = useState<TimeSlot[]>(DEFAULT_SLOTS);

    // Päivät ja valitut slotit (ei oletusvalintaa heti)
    const [selectedPickupDate, setSelectedPickupDate] = useState<Date>(new Date());
    const [selectedPickupSlotId, setSelectedPickupSlotId] = useState<string | null>(null);

    const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<Date | null>(null);
    const [selectedDeliverySlotId, setSelectedDeliverySlotId] = useState<string | null>(null);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const { data, error } = await supabase
                    .from('time_slots')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!error && data && data.length > 0) {
                    const mapped: TimeSlot[] = data.map((item: any) => ({
                        id: item.id,
                        time: item.label || `${String(item.start_hour).padStart(2, '0')}:00 - ${String(item.end_hour).padStart(2, '0')}:00`,
                        startHour: item.start_hour ?? 8,
                        endHour: item.end_hour ?? 10,
                        isAvailable: item.is_active ?? true,
                        slotType: item.slot_type || 'both',
                    }));
                    setSlots(mapped);
                }
            } catch (err) {
                console.warn('Poikkeus time_slots haussa:', err);
            }
        };

        fetchSlots();
    }, []);

    const pickupSlots = useMemo(() => slots.filter(s => s.slotType === 'both' || s.slotType === 'pickup'), [slots]);
    const deliverySlots = useMemo(() => slots.filter(s => s.slotType === 'both' || s.slotType === 'delivery'), [slots]);

    // 7 päivää noudolle
    const pickupDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    }), []);

    // Minimi palautuspäivä laskettuna valitusta noudosta
    const minDeliveryDate = useMemo(() => {
        const d = new Date(selectedPickupDate);
        const slot = pickupSlots.find(s => s.id === selectedPickupSlotId);
        if (slot) {
            d.setHours(slot.startHour);
        }
        d.setHours(d.getHours() + WASH_CYCLE_HOURS);
        return d;
    }, [selectedPickupDate, selectedPickupSlotId, pickupSlots]);

    // 7 päivää toimitukselle alkaen minimitoimituspäivästä
    const deliveryDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(minDeliveryDate);
        d.setDate(d.getDate() + i);
        return d;
    }), [minDeliveryDate]);

    // Kun nouto valitaan tai muuttuu, asetetaan toimituspäivä oletukseksi
    useEffect(() => {
        if (selectedPickupSlotId) {
            if (!selectedDeliveryDate || selectedDeliveryDate < minDeliveryDate) {
                setSelectedDeliveryDate(deliveryDates[0]);
            }
        }
    }, [selectedPickupSlotId, minDeliveryDate, deliveryDates, selectedDeliveryDate]);

    // Ilmoitetaan valinnat yläkomponentille
    useEffect(() => {
        const pickupSlotObj = pickupSlots.find(s => s.id === selectedPickupSlotId);
        const deliverySlotObj = deliverySlots.find(s => s.id === selectedDeliverySlotId);

        const pickup = (selectedPickupSlotId && pickupSlotObj) ? {
            date: selectedPickupDate,
            slot: pickupSlotObj,
        } : null;

        const delivery = (selectedDeliveryDate && selectedDeliverySlotId && deliverySlotObj) ? {
            date: selectedDeliveryDate,
            slot: deliverySlotObj,
        } : null;

        onSelectionChange(pickup, delivery);
    }, [selectedPickupDate, selectedPickupSlotId, selectedDeliveryDate, selectedDeliverySlotId, pickupSlots, deliverySlots, onSelectionChange]);

    const isPickupChosen = Boolean(selectedPickupSlotId);
    const isDeliveryChosen = Boolean(selectedDeliverySlotId);

    const selectedPickupSlot = pickupSlots.find(s => s.id === selectedPickupSlotId);
    const selectedDeliverySlot = deliverySlots.find(s => s.id === selectedDeliverySlotId);

    const renderDateSelector = (dates: Date[], selectedDate: Date | null, onSelect: (d: Date) => void) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateSelectorScroll} contentContainerStyle={{ paddingRight: 10 }}>
            {dates.map((date, index) => {
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const weekdayName = isToday ? 'Tänään' : date.toLocaleDateString('fi-FI', { weekday: 'short' });

                return (
                    <TouchableOpacity
                        key={index}
                        style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            onSelect(date);
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                            {weekdayName}
                        </Text>
                        <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>
                            {date.getDate()}.{date.getMonth() + 1}.
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    const renderSlotSelector = (currentDate: Date | null, availableSlots: TimeSlot[], selectedId: string | null, onSelect: (id: string) => void) => {
        if (!currentDate) return null;
        const now = new Date();
        const isToday = currentDate.toDateString() === now.toDateString();
        const currentHourWithBuffer = now.getHours() + BUFFER_HOURS;

        return (
            <View style={styles.slotsGrid}>
                {availableSlots.map(slot => {
                    const isTimeRestricted = isToday && slot.startHour < currentHourWithBuffer;
                    const isAvailable = slot.isAvailable && !isTimeRestricted;
                    const isSelected = slot.id === selectedId;

                    return (
                        <TouchableOpacity
                            key={slot.id}
                            disabled={!isAvailable}
                            style={[
                                styles.slotButton,
                                isSelected && styles.slotButtonSelected,
                                !isAvailable && styles.slotButtonUnavailable,
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                onSelect(slot.id);
                            }}
                            activeOpacity={0.8}
                        >
                            <Feather
                                name="clock"
                                size={14}
                                color={isSelected ? '#FFFFFF' : isAvailable ? COLORS.primaryDark : '#CBD5E1'}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[
                                styles.slotText,
                                isSelected && styles.slotTextSelected,
                                !isAvailable && styles.slotTextUnavailable
                            ]}>
                                {slot.time}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={[styles.container, style]}>
            {/* 📦 1. NOUTO-AJANKOHTA 📦 */}
            <View style={[styles.sectionCard, isPickupChosen && styles.sectionCardActive]}>
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.iconTitleRow}>
                        <View style={[styles.sectionIconCircle, { backgroundColor: '#E0F7FF' }]}>
                            <Feather name="package" size={18} color={COLORS.primaryDark} />
                        </View>
                        <View>
                            <Text style={styles.sectionTitle}>1. Pyykkien noutoaika</Text>
                            <Text style={styles.sectionSubtitle}>Milloin noudamme pyykkisi?</Text>
                        </View>
                    </View>
                </View>

                {/* Päivämäärävalitsin */}
                <Text style={styles.pickerLabel}>Valitse noutopäivä</Text>
                {renderDateSelector(pickupDates, selectedPickupDate, (date) => {
                    setSelectedPickupDate(date);
                    setSelectedPickupSlotId(null); // Nollataan slotti jos päivä vaihtuu jotta käyttäjä valitsee sopivan
                })}

                {/* Aikavälivalitsin */}
                <Text style={styles.pickerLabel}>Valitse noutoaika</Text>
                {renderSlotSelector(selectedPickupDate, pickupSlots, selectedPickupSlotId, setSelectedPickupSlotId)}
            </View>

            {/* ✨ 2. PALAUTUS-AJANKOHTA ✨ */}
            {!isPickupChosen ? (
                <View style={styles.lockedSectionCard}>
                    <View style={styles.lockIconCircle}>
                        <Feather name="lock" size={18} color="#94A3B8" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.lockedTitle}>2. Puhtaiden palautusaika</Text>
                        <Text style={styles.lockedSubtitle}>
                            Valitse ensin noutoaika yläpuolelta avataksesi toimitusajat.
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={[styles.sectionCard, isDeliveryChosen && styles.sectionCardActive]}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.iconTitleRow}>
                            <View style={[styles.sectionIconCircle, { backgroundColor: '#E0F7FF' }]}>
                                <Feather name="truck" size={18} color={COLORS.primaryDark} />
                            </View>
                            <View>
                                <Text style={styles.sectionTitle}>2. Puhtaiden palautusaika</Text>
                                <Text style={styles.sectionSubtitle}>Milloin toimitamme puhtaat pyykit?</Text>
                            </View>
                        </View>
                    </View>

                    {/* Päivämäärävalitsin */}
                    <Text style={styles.pickerLabel}>Valitse toimituspäivä</Text>
                    {renderDateSelector(deliveryDates, selectedDeliveryDate, (date) => {
                        setSelectedDeliveryDate(date);
                        setSelectedDeliverySlotId(null);
                    })}

                    {/* Aikavälivalitsin */}
                    <Text style={styles.pickerLabel}>Valitse toimitusaika</Text>
                    {renderSlotSelector(selectedDeliveryDate, deliverySlots, selectedDeliverySlotId, setSelectedDeliverySlotId)}
                </View>
            )}

            {/* 📋 YHTEENVETO AIKATAULUSTA 📋 */}
            {isPickupChosen && isDeliveryChosen && (
                <View style={styles.summaryBox}>
                    <View style={styles.summaryHeader}>
                        <Feather name="calendar" size={15} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.summaryTitle}>Valittu aikataulu</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Nouto:</Text>
                        <Text style={styles.summaryValue}>
                            {selectedPickupDate.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {selectedPickupSlot?.time}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Palautus:</Text>
                        <Text style={styles.summaryValue}>
                            {selectedDeliveryDate?.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })} klo {selectedDeliverySlot?.time}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
    },
    sectionCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionCardActive: {
        borderColor: '#BAE6FD',
    },
    lockedSectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    lockIconCircle: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    lockedTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#94A3B8',
        marginBottom: 2,
    },
    lockedSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 1,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.successBg,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    completedBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#16A34A',
        marginLeft: 4,
    },
    pendingBadge: {
        backgroundColor: '#F0F9FF',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    pendingBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
    pickerLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 4,
    },
    dateSelectorScroll: {
        marginBottom: 16,
    },
    dateButton: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginRight: 8,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 68,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    dateButtonSelected: {
        backgroundColor: '#00C2FF',
        borderColor: '#00C2FF',
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    dateText: {
        fontSize: 12,
        color: COLORS.textGray,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    dateNumber: {
        fontSize: 15,
        fontWeight: '900',
        color: COLORS.darkText,
        marginTop: 2,
    },
    dateTextSelected: {
        color: '#FFFFFF',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    slotButton: {
        flexDirection: 'row',
        width: '48.5%',
        paddingVertical: 13,
        paddingHorizontal: 10,
        marginBottom: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    slotButtonSelected: {
        borderColor: '#00C2FF',
        backgroundColor: '#00C2FF',
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    slotButtonUnavailable: {
        backgroundColor: '#F8FAFC',
        borderColor: '#F1F5F9',
        opacity: 0.4,
    },
    slotText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    slotTextSelected: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    slotTextUnavailable: {
        color: '#94A3B8',
    },
    summaryBox: {
        backgroundColor: '#F0F9FF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#BAE6FD',
        marginBottom: 14,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E0F2FE',
        paddingBottom: 6,
    },
    summaryTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primaryDark,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textGray,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.darkText,
    },
});

export default TimeSlotPicker;