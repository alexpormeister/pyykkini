import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    dark: '#0F172A',
    textGray: '#64748B',
    lightGray: '#94A3B8',
    border: '#E2E8F0',
    cardBorder: '#F1F5F9',
    white: '#FFFFFF',
    selectedBg: '#E0F7FF',
    todayBg: '#F8FAFC',
};

const MONTH_NAMES = [
    'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
    'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'
];

const WEEKDAY_NAMES = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

export function calculateAge(birthDateStr?: string | null): number | null {
    if (!birthDateStr || birthDateStr.trim() === '') return null;
    let d: Date;
    if (birthDateStr.includes('.')) {
        const parts = birthDateStr.split('.').map(Number);
        if (parts.length === 3) {
            d = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            return null;
        }
    } else if (birthDateStr.includes('-')) {
        const parts = birthDateStr.split('-').map(Number);
        if (parts.length === 3) {
            d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            return null;
        }
    } else {
        d = new Date(birthDateStr);
    }
    if (isNaN(d.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
}

export function formatBirthDateDisplay(birthDateStr?: string | null): string {
    if (!birthDateStr || birthDateStr.trim() === '') return 'Ei määritelty';
    let day = 1, month = 1, year = 2000;
    if (birthDateStr.includes('.')) {
        const parts = birthDateStr.split('.').map(Number);
        if (parts.length >= 3) {
            day = parts[0];
            month = parts[1];
            year = parts[2];
        }
    } else if (birthDateStr.includes('-')) {
        const parts = birthDateStr.split('-').map(Number);
        if (parts.length >= 3) {
            year = parts[0];
            month = parts[1];
            day = parts[2];
        }
    }

    const age = calculateAge(`${day}.${month}.${year}`);
    const formatted = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    return age !== null ? `${formatted} (${age} vuotta)` : formatted;
}

interface BirthDatePickerModalProps {
    visible: boolean;
    currentBirthDate?: string | null;
    onClose: () => void;
    onSave: (formattedDate: string, age: number) => void;
}

export const BirthDatePickerModal: React.FC<BirthDatePickerModalProps> = ({
    visible,
    currentBirthDate,
    onClose,
    onSave,
}) => {
    const today = new Date();
    const currentYear = today.getFullYear();

    const [selectedYear, setSelectedYear] = useState<number>(1998);
    const [selectedMonth, setSelectedMonth] = useState<number>(5); // 0-indexed (Kesäkuu)
    const [selectedDay, setSelectedDay] = useState<number>(15);
    const [viewMode, setViewMode] = useState<'calendar' | 'years' | 'months'>('calendar');

    useEffect(() => {
        if (visible) {
            setViewMode('calendar');
            if (currentBirthDate && currentBirthDate.trim() !== '') {
                if (currentBirthDate.includes('.')) {
                    const parts = currentBirthDate.split('.').map(Number);
                    if (parts.length >= 3) {
                        setSelectedDay(parts[0] || 1);
                        setSelectedMonth((parts[1] || 1) - 1);
                        setSelectedYear(parts[2] || 1998);
                    }
                } else if (currentBirthDate.includes('-')) {
                    const parts = currentBirthDate.split('-').map(Number);
                    if (parts.length >= 3) {
                        setSelectedYear(parts[0] || 1998);
                        setSelectedMonth((parts[1] || 1) - 1);
                        setSelectedDay(parts[2] || 1);
                    }
                }
            } else {
                setSelectedYear(1998);
                setSelectedMonth(5);
                setSelectedDay(15);
            }
        }
    }, [visible, currentBirthDate]);

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Kuukauden ensimmäisen päivän viikonpäivä (0 = Maanantai, ..., 6 = Sunnuntai)
    const firstDayIndex = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7;

    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
        calendarCells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        calendarCells.push(d);
    }

    const prevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear((y) => y - 1);
        } else {
            setSelectedMonth((m) => m - 1);
        }
    };

    const nextMonth = () => {
        if (selectedYear === currentYear && selectedMonth >= today.getMonth()) {
            return;
        }
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear((y) => y + 1);
        } else {
            setSelectedMonth((m) => m + 1);
        }
    };

    // Vuosilista 1930 - Nykyhetki
    const yearsList: number[] = [];
    for (let y = currentYear; y >= 1930; y--) {
        yearsList.push(y);
    }

    const handleSave = () => {
        const safeDay = Math.min(selectedDay, daysInMonth);
        const dateStr = `${String(safeDay).padStart(2, '0')}.${String(selectedMonth + 1).padStart(2, '0')}.${selectedYear}`;
        const age = calculateAge(dateStr) || 0;
        onSave(dateStr, age);
    };

    const previewAge = calculateAge(`${selectedDay}.${selectedMonth + 1}.${selectedYear}`);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* MODAL HEADER */}
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Syntymäaika</Text>
                            <Text style={styles.modalSubtitle}>Valitse syntymäpäiväsi kalenterista</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                            <Feather name="x" size={20} color={COLORS.dark} />
                        </TouchableOpacity>
                    </View>

                    {/* MONTH & YEAR PICKER HEADER */}
                    <View style={styles.monthYearNav}>
                        <TouchableOpacity
                            style={styles.navArrow}
                            onPress={prevMonth}
                            activeOpacity={0.7}
                        >
                            <Feather name="chevron-left" size={20} color={COLORS.dark} />
                        </TouchableOpacity>

                        <View style={styles.navSelectors}>
                            <TouchableOpacity
                                style={[styles.selectorPill, viewMode === 'months' && styles.selectorPillActive]}
                                onPress={() => setViewMode(viewMode === 'months' ? 'calendar' : 'months')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.selectorPillText, viewMode === 'months' && styles.selectorPillTextActive]}>
                                    {MONTH_NAMES[selectedMonth]}
                                </Text>
                                <Feather name="chevron-down" size={14} color={viewMode === 'months' ? '#0284C7' : COLORS.dark} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.selectorPill, viewMode === 'years' && styles.selectorPillActive]}
                                onPress={() => setViewMode(viewMode === 'years' ? 'calendar' : 'years')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.selectorPillText, viewMode === 'years' && styles.selectorPillTextActive]}>
                                    {selectedYear}
                                </Text>
                                <Feather name="chevron-down" size={14} color={viewMode === 'years' ? '#0284C7' : COLORS.dark} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.navArrow,
                                selectedYear === currentYear && selectedMonth >= today.getMonth() && styles.navArrowDisabled
                            ]}
                            onPress={nextMonth}
                            disabled={selectedYear === currentYear && selectedMonth >= today.getMonth()}
                            activeOpacity={0.7}
                        >
                            <Feather name="chevron-right" size={20} color={selectedYear === currentYear && selectedMonth >= today.getMonth() ? '#CBD5E1' : COLORS.dark} />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENT ACCORDING TO VIEW MODE */}
                    {viewMode === 'calendar' && (
                        <View style={styles.calendarContainer}>
                            {/* WEEKDAYS HEADER */}
                            <View style={styles.weekdaysRow}>
                                {WEEKDAY_NAMES.map((w, idx) => (
                                    <Text key={idx} style={styles.weekdayLabel}>
                                        {w}
                                    </Text>
                                ))}
                            </View>

                            {/* DAYS GRID */}
                            <View style={styles.daysGrid}>
                                {calendarCells.map((day, index) => {
                                    if (day === null) {
                                        return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                                    }

                                    const isSelected = day === selectedDay;
                                    const isFuture =
                                        selectedYear === currentYear &&
                                        selectedMonth === today.getMonth() &&
                                        day > today.getDate();

                                    return (
                                        <TouchableOpacity
                                            key={`day-${day}`}
                                            style={[
                                                styles.dayCell,
                                                isSelected && styles.dayCellSelected,
                                                isFuture && styles.dayCellDisabled,
                                            ]}
                                            onPress={() => {
                                                if (!isFuture) {
                                                    setSelectedDay(day);
                                                }
                                            }}
                                            disabled={isFuture}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayText,
                                                    isSelected && styles.dayTextSelected,
                                                    isFuture && styles.dayTextDisabled,
                                                ]}
                                            >
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {viewMode === 'months' && (
                        <View style={styles.selectionGrid}>
                            {MONTH_NAMES.map((mName, idx) => {
                                const isSelected = idx === selectedMonth;
                                return (
                                    <TouchableOpacity
                                        key={mName}
                                        style={[styles.gridOption, isSelected && styles.gridOptionSelected]}
                                        onPress={() => {
                                            setSelectedMonth(idx);
                                            setViewMode('calendar');
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.gridOptionText, isSelected && styles.gridOptionTextSelected]}>
                                            {mName}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {viewMode === 'years' && (
                        <ScrollView style={styles.yearsScroll} showsVerticalScrollIndicator={false}>
                            <View style={styles.selectionGrid}>
                                {yearsList.map((y) => {
                                    const isSelected = y === selectedYear;
                                    return (
                                        <TouchableOpacity
                                            key={y}
                                            style={[styles.gridOption, isSelected && styles.gridOptionSelected]}
                                            onPress={() => {
                                                setSelectedYear(y);
                                                setViewMode('calendar');
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.gridOptionText, isSelected && styles.gridOptionTextSelected]}>
                                                {y}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}

                    {/* SELECTION PREVIEW */}
                    <View style={styles.previewBox}>
                        <Feather name="check-circle" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                        <Text style={styles.previewText}>
                            Valittu: <Text style={styles.previewTextBold}>{String(selectedDay).padStart(2, '0')}.{String(selectedMonth + 1).padStart(2, '0')}.{selectedYear}</Text>
                            {previewAge !== null ? ` (${previewAge} vuotta)` : ''}
                        </Text>
                    </View>

                    {/* SAVE BUTTON */}
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.saveButtonText}>Tallenna syntymäaika</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.dark,
        letterSpacing: -0.3,
    },
    modalSubtitle: {
        fontSize: 13,
        color: COLORS.textGray,
        marginTop: 2,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthYearNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    navArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    navArrowDisabled: {
        opacity: 0.3,
    },
    navSelectors: {
        flexDirection: 'row',
        gap: 8,
    },
    selectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    selectorPillActive: {
        backgroundColor: '#E0F7FF',
        borderColor: COLORS.primary,
    },
    selectorPillText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.dark,
    },
    selectorPillTextActive: {
        color: '#0284C7',
    },
    calendarContainer: {
        marginBottom: 16,
    },
    weekdaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    weekdayLabel: {
        width: 40,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.lightGray,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayCellEmpty: {
        width: '14.28%',
        height: 42,
    },
    dayCell: {
        width: '14.28%',
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 21,
    },
    dayCellSelected: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    dayCellDisabled: {
        opacity: 0.25,
    },
    dayText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.dark,
    },
    dayTextSelected: {
        color: COLORS.white,
        fontWeight: '800',
    },
    dayTextDisabled: {
        color: COLORS.lightGray,
    },
    selectionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    yearsScroll: {
        maxHeight: 220,
        marginBottom: 16,
    },
    gridOption: {
        width: '31%',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 4,
    },
    gridOptionSelected: {
        backgroundColor: '#E0F7FF',
        borderColor: COLORS.primary,
    },
    gridOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
    },
    gridOptionTextSelected: {
        color: '#0284C7',
        fontWeight: '800',
    },
    previewBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginBottom: 16,
    },
    previewText: {
        fontSize: 14,
        color: '#0369A1',
        fontWeight: '500',
    },
    previewTextBold: {
        fontWeight: '800',
        color: '#0284C7',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
});
