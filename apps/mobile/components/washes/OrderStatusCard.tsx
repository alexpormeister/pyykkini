import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import {
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getPickupCode, formatTimeWindow } from '../../lib/addressUtils';

interface OrderStatusCardProps {
    order: any;
    onDismiss?: () => void;
}

const getStatusConfig = (order: any) => {
    const status = (order?.status || '').toLowerCase();
    const tracking = (order?.tracking_status || '').toUpperCase();
    const laundryStatus = (order?.laundry_status || '').toLowerCase();
    const driverId = order?.driver_id;

    const deliveryTasks = Array.isArray(order?.delivery_tasks) ? order.delivery_tasks : [];
    const pickupTask = deliveryTasks.find((t: any) => t.task_type === 'pickup');
    const returnTask = deliveryTasks.find((t: any) => t.task_type === 'delivery');

    // 0. Hylätty / peruutettu
    if (status === 'rejected' || status === 'cancelled' || tracking === 'CANCELLED' || laundryStatus === 'rejected') {
        return {
            title: 'Tilaus peruutettu',
            subtitle: 'Tilausta ei veloiteta',
            step: 0,
            color: '#EF4444',
            badgeBg: '#FEF2F2',
            badgeText: 'PERUUTETTU',
            icon: 'x-circle',
            image: require("../../assets/images/3dglossy-logo.png"),
            isCancelled: true,
        };
    }

    // 10. Pyykit toimitettu / Valmis
    if (status === 'delivered' || tracking === 'COMPLETED' || tracking === 'DELIVERED' || returnTask?.status === 'completed') {
        return {
            title: 'Pyykit toimitettu',
            subtitle: 'Toimitettu onnistuneesti perille',
            step: 5,
            color: '#10B981',
            badgeBg: '#ECFDF5',
            badgeText: 'TOIMITETTU',
            icon: 'check-circle',
            image: require("../../assets/images/3dglossy-logo.png"),
            isCancelled: false,
        };
    }

    // 9. Palautus: Kuljettaja saapunut asiakkaan luo
    if ((tracking === 'ARRIVED_DELIVERY' || status === 'arrived_delivery' || returnTask?.status === 'arrived_delivery') && status !== 'picking_up' && status !== 'pending' && status !== 'accepted') {
        return {
            title: 'Kuljettaja saapunut',
            subtitle: 'Kuljettaja on saapunut toimitusosoitteeseen',
            step: 4,
            color: '#0284C7',
            badgeBg: '#E0F2FE',
            badgeText: 'SAAPUNUT PERILLE',
            icon: 'map-pin',
            image: require("../../assets/images/pesuni-car.png"),
            isCancelled: false,
        };
    }

    // 8. Palautetaan / Kuljetuksessa kotiin
    if ((status === 'returning' || tracking === 'RETURNING' || tracking === 'OUT_FOR_DELIVERY' || (returnTask?.status === 'in_progress' && pickupTask?.status === 'completed')) && status !== 'picking_up' && status !== 'pending' && status !== 'accepted') {
        return {
            title: 'Pyykit palautuksessa',
            subtitle: `Arvioitu toimitus klo ${formatTimeWindow(order.return_time) || '18:00 - 18:30'}`,
            step: 4,
            color: '#0284C7',
            badgeBg: '#E0F2FE',
            badgeText: 'KULJETUKSESSA KOTIIN',
            icon: 'truck',
            image: require("../../assets/images/pesuni-car.png"),
            isCancelled: false,
        };
    }

    // 7. Pesu valmis (valmistellaan palautukseen)
    if (tracking === 'WASH_COMPLETED' || laundryStatus === 'ready') {
        return {
            title: 'Pesu valmis',
            subtitle: 'Pyykit valmistellaan palautuskuljetukseen',
            step: 3,
            color: '#6366F1',
            badgeBg: '#EEF2FF',
            badgeText: 'VALMISTELLAAN',
            icon: 'check-circle',
            image: require("../../assets/images/pesuni-washing.png"),
            isCancelled: false,
        };
    }

    // 6. Pesussa
    if (status === 'washing' || tracking === 'WASHING' || tracking === 'PACKAGING' || laundryStatus === 'washing') {
        return {
            title: 'Pyykit pesussa',
            subtitle: 'Pyykkejänne pestään huolellisesti pesulassa',
            step: 3,
            color: '#6366F1',
            badgeBg: '#EEF2FF',
            badgeText: 'PESULASSA',
            icon: 'droplet',
            image: require("../../assets/images/pesuni-washing.png"),
            isCancelled: false,
        };
    }

    // 5. Kuljetetaan pesulaan / Noudettu
    if (status === 'in_transit_to_laundry' || tracking === 'IN_TRANSIT_TO_LAUNDRY' || tracking === 'PICKED_UP' || (pickupTask?.status === 'completed' && status !== 'washing')) {
        return {
            title: 'Kuljetetaan pesulaan',
            subtitle: 'Pyykit on noudettu ja matkalla pesulaan',
            step: 2,
            color: '#F59E0B',
            badgeBg: '#FEF3C7',
            badgeText: 'MATKALLA PESULAAN',
            icon: 'truck',
            image: require("../../assets/images/pesuni-car.png"),
            isCancelled: false,
        };
    }

    // 4. Nouto: Kuljettaja saapunut nouto-osoitteeseen
    if (tracking === 'ARRIVED_PICKUP' || status === 'arrived_pickup' || pickupTask?.status === 'arrived_pickup') {
        return {
            title: 'Kuljettaja saapunut',
            subtitle: 'Kuljettaja on nouto-osoitteessa',
            step: 2,
            color: '#0284C7',
            badgeBg: '#E0F2FE',
            badgeText: 'NOUTOPAIKALLA',
            icon: 'map-pin',
            image: require("../../assets/images/pesuni-car.png"),
            isCancelled: false,
        };
    }

    // 3. Noutamassa (kuljettaja matkalla noutamaan)
    if (status === 'picking_up' || tracking === 'PICKING_UP' || tracking === 'EN_ROUTE_PICKUP' || pickupTask?.status === 'in_progress') {
        return {
            title: 'Noutamassa',
            subtitle: 'Kuljettaja on matkalla noutamaan pyykkejä',
            step: 2,
            color: '#0284C7',
            badgeBg: '#E0F2FE',
            badgeText: 'NOUTAMASSA',
            icon: 'navigation',
            image: require("../../assets/images/pesuni-car.png"),
            isCancelled: false,
        };
    }

    // 2. Kuljettaja löytynyt (menotilaukseen löytynyt kuljettaja)
    if (driverId || status === 'assigned' || tracking === 'DRIVER_ASSIGNED' || tracking === 'CONFIRMED' || pickupTask?.status === 'assigned') {
        return {
            title: 'Kuljettaja löytynyt',
            subtitle: `Noutoaika sovittu klo ${formatTimeWindow(order.pickup_time) || '10:00 - 10:30'}`,
            step: 1,
            color: '#10B981',
            badgeBg: '#ECFDF5',
            badgeText: 'KULJETTAJA VAHVISTETTU',
            icon: 'user-check',
            image: require("../../assets/images/3dglossy-logo.png"),
            isCancelled: false,
        };
    }

    // 1. Tilaus vastaanotettu (Oletus, ennen kuljettajan löytymistä)
    return {
        title: 'Tilaus vastaanotettu',
        subtitle: 'Etsitään lähintä vapaata kuljettajaa',
        step: 1,
        color: '#00C2FF',
        badgeBg: '#E0F7FF',
        badgeText: 'VASTAANOTETTU',
        icon: 'clock',
        image: require("../../assets/images/3dglossy-logo.png"),
        isCancelled: false,
    };
};

const STEPS = [
    { num: 1, name: 'Tilattu' },
    { num: 2, name: 'Nouto' },
    { num: 3, name: 'Pesussa' },
    { num: 4, name: 'Palautus' },
    { num: 5, name: 'Toimitettu' },
];

export default function OrderStatusCard({ order, onDismiss }: OrderStatusCardProps) {
    const config = getStatusConfig(order);
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
    const [driverInfo, setDriverInfo] = useState<{
        name: string;
        phone?: string;
    } | null>(null);

    // Kuljettajan tietojen haku
    useEffect(() => {
        let isMounted = true;
        const currentDriverId = order.driver_id || (Array.isArray(order?.delivery_tasks) && order.delivery_tasks.find((t: any) => t.driver_id)?.driver_id);

        if (currentDriverId) {
            (async () => {
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('first_name, last_name, phone')
                        .eq('user_id', currentDriverId)
                        .maybeSingle();

                    if (isMounted && data) {
                        const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Pesuni-kuljettaja';
                        setDriverInfo({
                            name,
                            phone: data.phone || undefined,
                        });
                    }
                } catch (e) {}
            })();
        } else {
            setDriverInfo(null);
        }
        return () => {
            isMounted = false;
        };
    }, [order.driver_id, order.delivery_tasks]);

    const finalPrice = parseFloat(order.final_price || order.price || '0').toFixed(2);
    const itemsList = order.order_items || [];
    const itemsCount = itemsList.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const pickupCode = getPickupCode(order);

    const handleCallDriver = () => {
        if (driverInfo?.phone) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            const cleaned = driverInfo.phone.replace(/\s+/g, '');
            Linking.openURL(`tel:${cleaned}`).catch(() => {});
        }
    };

    return (
        <View style={styles.card}>
            {/* 🌟 1. YLÄOSA: STATUS-BADGE JA MASCOT 🌟 */}
            <View style={styles.headerRow}>
                <View style={[styles.statusBadge, { backgroundColor: config.badgeBg }]}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={[styles.statusBadgeText, { color: config.color }]}>
                        {config.badgeText}
                    </Text>
                </View>

                <Image source={config.image} style={styles.mascotImage} resizeMode="contain" />
            </View>

            {/* 🌟 2. ISO & ROHKEA OTSIKKO 🌟 */}
            <View style={styles.titleSection}>
                <Text style={styles.mainTitle}>{config.title}</Text>
                <Text style={styles.subtitle}>{config.subtitle}</Text>
            </View>

            {/* 🌟 3. MODERNIT EDISTYMISPALKIT 🌟 */}
            {!config.isCancelled && (
                <View style={styles.progressRow}>
                    {STEPS.map((s) => {
                        const isActive = s.num <= config.step;
                        const isCurrent = s.num === config.step;
                        return (
                            <View key={s.num} style={styles.progressSegmentWrapper}>
                                <View
                                    style={[
                                        styles.progressBarSegment,
                                        isActive && { backgroundColor: config.color },
                                        isCurrent && styles.progressBarCurrent,
                                    ]}
                                />
                                <Text
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    style={[
                                        styles.stepNameText,
                                        isActive && { color: '#0F172A', fontWeight: '800' },
                                    ]}
                                >
                                    {s.name}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* 🌟 4. TYYLIKÄS NOUTO- JA PALAUTUSINFO 🌟 */}
            <View style={styles.timesBox}>
                <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>NOUTO</Text>
                    <Text style={styles.timeMainText}>{order.pickup_date || 'Sovittu päivä'}</Text>
                    {order.pickup_time && (
                        <Text style={styles.timeSubText}>klo {formatTimeWindow(order.pickup_time)}</Text>
                    )}
                </View>

                <View style={styles.timeDivider} />

                <View style={styles.timeItem}>
                    <Text style={styles.timeLabel}>PALAUTUS</Text>
                    <Text style={styles.timeMainText}>{order.return_date || 'Sovittu päivä'}</Text>
                    {order.return_time && (
                        <Text style={styles.timeSubText}>klo {formatTimeWindow(order.return_time)}</Text>
                    )}
                </View>
            </View>

            {/* 🛡️ 5. KULJETTAJAN NOUTOKOODI (TURVATARKISTUS OVELLA) 🛡️ */}
            {!config.isCancelled && config.step <= 2 && (
                <View style={styles.pickupCodeBanner}>
                    <View style={styles.pickupCodeHeader}>
                        <View style={styles.pickupCodeIconCircle}>
                            <Feather name="shield" size={16} color="#0284C7" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.pickupCodeTitle}>Kuljettajan noutokoodi</Text>
                            <Text style={styles.pickupCodeSubtitle}>Tarkista kuljettaja ovella</Text>
                        </View>
                        <View style={styles.pickupCodePill}>
                            <Text style={styles.pickupCodeNumber}>{pickupCode}</Text>
                        </View>
                    </View>
                    <Text style={styles.pickupCodeExplainText}>
                        Kuljettajallasi on tämä sama 5-numeroinen koodi. Voit kysyä koodin kuljettajalta ovella varmistaaksesi luotettavan noudon.
                    </Text>
                </View>
            )}

            {/* 📸 5b. NOUTOVARMISTUS (PAINO TAI OTETUT KUVAT) 📸 */}
            {((order.pickup_photos && order.pickup_photos.length > 0) || order.pickup_weight_kg) && (
                <View style={styles.verificationBanner}>
                    <View style={styles.verificationHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="check-circle" size={15} color="#10B981" style={{ marginRight: 6 }} />
                            <Text style={styles.verificationTitle}>Noutotarkistus suoritettu</Text>
                        </View>
                        {order.pickup_weight_kg ? (
                            <View style={styles.verificationWeightPill}>
                                <Text style={styles.verificationWeightText}>{order.pickup_weight_kg} kg</Text>
                            </View>
                        ) : null}
                    </View>

                    {order.pickup_photos && order.pickup_photos.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={styles.verificationPhotosLabel}>Kuljettajan ottamat tuotekuvat noudossa:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                {order.pickup_photos.map((photoUri: string, idx: number) => (
                                    <Image
                                        key={idx}
                                        source={{ uri: photoUri }}
                                        style={styles.customerPhotoThumb}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* 🌟 6. MINIMALISTISET PILL-NAPIT (TUOTTEET & KULJETTAJA) 🌟 */}
            <View style={styles.buttonsRow}>
                {/* TUOTTEET-NAPPI */}
                <TouchableOpacity
                    style={styles.pillButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setIsItemsModalOpen(true);
                    }}
                    activeOpacity={0.75}
                >
                    <Feather name="package" size={15} color="#00C2FF" style={{ marginRight: 6 }} />
                    <Text style={styles.pillButtonText}>
                        {itemsCount > 0 ? `${itemsCount} tuotetta • ${finalPrice} €` : `Tilaus • ${finalPrice} €`}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                {/* KULJETTAJA-NAPPI */}
                <TouchableOpacity
                    style={[styles.pillButton, driverInfo && styles.pillButtonActiveDriver]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setIsDriverModalOpen(true);
                    }}
                    activeOpacity={0.75}
                >
                    <Feather
                        name="truck"
                        size={15}
                        color={driverInfo ? '#10B981' : '#64748B'}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.pillButtonText, driverInfo && { color: '#0F172A' }]}>
                        {driverInfo ? driverInfo.name : 'Kuljettaja'}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
            </View>

            {/* PERUUTETTU-KUITTAUSNAPPI */}
            {config.isCancelled && onDismiss && (
                <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={onDismiss}
                    activeOpacity={0.8}
                >
                    <Text style={styles.dismissBtnText}>Poista tilaus näkyvistä</Text>
                </TouchableOpacity>
            )}

            {/* 📦 TUOTTEET MODAALI 📦 */}
            <Modal visible={isItemsModalOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tilatut tuotteet</Text>
                            <TouchableOpacity
                                onPress={() => setIsItemsModalOpen(false)}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalItemsList}>
                            {itemsList.length > 0 ? (
                                itemsList.map((item: any, idx: number) => (
                                    <View key={item.id || idx} style={styles.modalItemRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalItemName}>
                                                {item.service_name || item.name || 'Pyykkipalvelu'}
                                            </Text>
                                            <Text style={styles.modalItemQty}>Määrä: {item.quantity || 1} kpl</Text>
                                        </View>
                                        <Text style={styles.modalItemPrice}>
                                            {(parseFloat(item.total_price || item.unit_price || '0')).toFixed(2)} €
                                        </Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyItemsNote}>
                                    {order.service_name || 'Pesulapalvelut'}
                                </Text>
                            )}
                        </View>

                        <View style={styles.modalFooter}>
                            <Text style={styles.modalTotalLabel}>Yhteensä:</Text>
                            <Text style={styles.modalTotalPrice}>{finalPrice} €</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🚚 KULJETTAJA MODAALI 🚚 */}
            <Modal visible={isDriverModalOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kuljettajan tiedot</Text>
                            <TouchableOpacity
                                onPress={() => setIsDriverModalOpen(false)}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {driverInfo ? (
                            <View style={styles.driverModalContent}>
                                <View style={styles.driverBigAvatar}>
                                    <Feather name="truck" size={32} color="#00C2FF" />
                                </View>
                                <Text style={styles.driverBigName}>{driverInfo.name}</Text>
                                <Text style={styles.driverBigRole}>Vahvistettu Pesuni-kuljettaja</Text>

                                <View style={styles.driverPinRow}>
                                    <Feather name="shield" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                                    <Text style={styles.driverPinLabel}>Noutokoodi ovella:</Text>
                                    <Text style={styles.driverPinValue}>{pickupCode}</Text>
                                </View>

                                {driverInfo.phone ? (
                                    <TouchableOpacity
                                        style={styles.driverCallBtn}
                                        onPress={handleCallDriver}
                                        activeOpacity={0.85}
                                    >
                                        <Feather name="phone" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.driverCallBtnText}>Soita kuljettajalle</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.noPhoneText}>Kuljettaja on yhteydessä saapuessaan.</Text>
                                )}
                            </View>
                        ) : (
                            <View style={styles.noDriverBox}>
                                <Feather name="clock" size={32} color="#F59E0B" style={{ marginBottom: 12 }} />
                                <Text style={styles.noDriverTitle}>Kuljettajaa etsitään</Text>
                                <Text style={styles.noDriverDesc}>
                                    Kuljettaja kiinnitetään tilaukseen ennen noutoaikaa. Saat ilmoituksen heti kun kuljettaja on matkalla.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    mascotImage: {
        width: 38,
        height: 38,
    },
    titleSection: {
        marginBottom: 16,
    },
    mainTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    progressSegmentWrapper: {
        flex: 1,
        marginHorizontal: 2,
    },
    progressBarSegment: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        marginBottom: 4,
    },
    progressBarCurrent: {
        height: 5,
    },
    stepNameText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#94A3B8',
        textAlign: 'center',
    },
    timesBox: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    timeItem: {
        flex: 1,
        alignItems: 'center',
    },
    timeLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    timeMainText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    timeSubText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 1,
    },
    timeDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 2,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    pillButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillButtonActiveDriver: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    pillButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    dismissBtn: {
        marginTop: 12,
        paddingVertical: 10,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        alignItems: 'center',
    },
    dismissBtnText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 12,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalItemsList: {
        marginBottom: 16,
    },
    modalItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    modalItemName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    modalItemQty: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    modalItemPrice: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    emptyItemsNote: {
        fontSize: 14,
        color: '#64748B',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 10,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1.5,
        borderTopColor: '#F1F5F9',
    },
    modalTotalLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalTotalPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0284C7',
    },
    driverModalContent: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    driverBigAvatar: {
        width: 64,
        height: 64,
        borderRadius: 24,
        backgroundColor: '#E0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    driverBigName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    driverBigRole: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10B981',
        marginBottom: 18,
    },
    driverCallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C2FF',
        paddingVertical: 13,
        paddingHorizontal: 24,
        borderRadius: 16,
        shadowColor: "#00C2FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    driverCallBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    noPhoneText: {
        fontSize: 12,
        color: '#64748B',
        fontStyle: 'italic',
    },
    noDriverBox: {
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    noDriverTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    noDriverDesc: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
    },
    pickupCodeBanner: {
        backgroundColor: '#F0F9FF',
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#BAE6FD',
    },
    pickupCodeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    pickupCodeIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    pickupCodeTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    pickupCodeSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0284C7',
    },
    pickupCodePill: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
    },
    pickupCodeNumber: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 2,
    },
    pickupCodeExplainText: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 17,
        fontWeight: '500',
    },
    driverPinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    driverPinLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        marginRight: 6,
    },
    driverPinValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0284C7',
        letterSpacing: 1.5,
    },

    // 🌟 NOUTOVARMISTUS-BANNER (PAINO & KUVAT) 🌟
    verificationBanner: {
        backgroundColor: '#F0FDF4',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    verificationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    verificationTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#15803D',
    },
    verificationWeightPill: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },
    verificationWeightText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#15803D',
    },
    verificationPhotosLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
    },
    customerPhotoThumb: {
        width: 60,
        height: 60,
        borderRadius: 10,
        marginRight: 8,
        backgroundColor: '#E2E8F0',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
});