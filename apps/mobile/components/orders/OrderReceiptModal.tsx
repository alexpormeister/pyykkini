import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ReceiptModalProps {
    visible: boolean;
    onClose: () => void;
    order: any;
}

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    cardBorder: '#F1F5F9',
    green: '#10B981',
};

const OrderReceiptModal = ({ visible, onClose, order }: ReceiptModalProps) => {
    if (!order) return null;

    const totalAmount = parseFloat(order.payment_amount || order.final_price || order.price || '0');
    const vatRate = typeof order.vat_rate === 'number' ? order.vat_rate : parseFloat(order.vat_rate || '25.5');
    const serviceFee = typeof order.service_fee === 'number' ? order.service_fee : parseFloat(order.service_fee || '2.00');
    const deliveryFee = typeof order.delivery_fee === 'number' ? order.delivery_fee : parseFloat(order.delivery_fee || '0.00');

    // Lasketaan ALV ja veroton osuus
    const vatMultiplier = 1 + (vatRate / 100);
    const totalVat = order.vat_amount !== undefined && order.vat_amount !== null
        ? parseFloat(order.vat_amount)
        : totalAmount > 0 ? totalAmount - (totalAmount / vatMultiplier) : 0;
    const netAmount = totalAmount - totalVat;

    const receiptDate = order.created_at
        ? new Date(order.created_at).toLocaleDateString('fi-FI')
        : new Date().toLocaleDateString('fi-FI');

    const itemCount = order.service_name?.split(',').length || 1;
    const itemsPrice = Math.max(0, totalAmount - serviceFee - deliveryFee);

    const createPDF = async () => {
        const vatRateFormatted = vatRate.toString().replace('.', ',');

        const htmlContent = `
        <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 30px; line-height: 1.6; color: #1E293B; }
                    .header-container { display: flex; justify-content: space-between; border-bottom: 2px solid #00c2ff; padding-bottom: 15px; }
                    .company-info { font-size: 11px; text-align: right; color: #475569; }
                    .receipt-title { font-size: 24px; font-weight: bold; color: #0F172A; margin: 0; }
                    .section { margin-top: 25px; }
                    .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #64748B; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
                    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
                    .total-box { margin-top: 20px; background: #F8FAFC; padding: 18px; border-radius: 12px; border: 1px solid #E2E8F0; }
                    .total-row { display: flex; justify-content: space-between; font-size: 17px; font-weight: bold; color: #0F172A; }
                    .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div>
                        <div class="receipt-title">KUITTI / RECEIPT</div>
                        <div style="font-size: 12px; margin-top: 5px; color: #64748B;">Tilausnro: #${order.id?.substring(0, 8).toUpperCase()}</div>
                        <div style="font-size: 12px; color: #64748B;">Päivämäärä: ${receiptDate}</div>
                    </div>
                    <div class="company-info">
                        <strong style="color: #0F172A; font-size: 13px;">Pesuni Oy</strong><br/>
                        Y-tunnus: 3245678-9<br/>
                        Nuijamiestentie 5, 00400 Helsinki<br/>
                        asiakaspalvelu@pesuni.fi
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Palvelun erittely</div>
                    <div class="info-row">
                        <span>${order.service_name} (Määrä: ${itemCount} kpl)</span>
                        <span>${itemsPrice.toFixed(2)} €</span>
                    </div>
                    <div class="info-row">
                        <span>Kotiinkuljetus</span>
                        <span>${deliveryFee > 0 ? `${deliveryFee.toFixed(2)} €` : 'Ilmainen'}</span>
                    </div>
                    <div class="info-row">
                        <span>Palvelumaksu</span>
                        <span>${serviceFee.toFixed(2)} €</span>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Logistiikka & Toimitus</div>
                    <div class="info-row"><span>Noutopäivä:</span> <span>${order.pickup_date || '---'} ${order.pickup_time ? `klo ${order.pickup_time}` : ''}</span></div>
                    <div class="info-row"><span>Palautuspäivä:</span> <span>${order.return_date || '---'} ${order.return_time ? `klo ${order.return_time}` : ''}</span></div>
                    ${order.address ? `<div class="info-row"><span>Toimitusosoite:</span> <span>${order.address}</span></div>` : ''}
                </div>

                <div class="total-box">
                    <div class="info-row"><span>Veroton hinta (netto):</span> <span>${netAmount.toFixed(2)} €</span></div>
                    <div class="info-row"><span>ALV (${vatRateFormatted}%):</span> <span>${totalVat.toFixed(2)} €</span></div>
                    <div class="info-row"><span>Maksutapa:</span> <span>${order.payment_method === 'stripe_mobile_payment' || order.payment_method === 'stripe' ? 'Verkkomaksu / Kortti' : 'Mobiilimaksu'}</span></div>
                    <div class="total-row" style="margin-top: 12px; border-top: 1px solid #CBD5E1; padding-top: 10px;">
                        <span>YHTEENSÄ:</span> 
                        <span>${totalAmount.toFixed(2)} €</span>
                    </div>
                </div>

                <div class="footer">
                    Pesuni Oy - Kiitos tilauksestasi!<br/>
                    Tämä on virallinen tosite. Säilytäthän kuitin mahdollista reklamaatiota varten.
                </div>
            </body>
        </html>
    `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: `Pesuni_Kuitti_${order.id?.substring(0, 8)}`
            });
        } catch {
            Alert.alert("Virhe", "PDF:n luonti epäonnistui");
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
                    <View style={styles.modalContent}>
                        {/* Vetopalkki */}
                        <View style={styles.pullBar} />

                        {/* HEADER */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerTitle}>Ostokuitti</Text>
                                <Text style={styles.headerSubtitle}>Tilaus #{order.id?.substring(0, 8).toUpperCase()}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeIconButton} activeOpacity={0.7}>
                                <Feather name="x" size={20} color={COLORS.darkText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                            {/* YRITYSINFO */}
                            <View style={styles.companyCard}>
                                <View>
                                    <Text style={styles.companyName}>Pesuni Oy</Text>
                                    <Text style={styles.companyDetail}>Y-tunnus: 3245678-9</Text>
                                    <Text style={styles.companyDetail}>asiakaspalvelu@pesuni.fi</Text>
                                </View>
                                <View style={styles.printerIconCircle}>
                                    <Feather name="printer" size={22} color="#0284C7" />
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Kuitin pvm</Text>
                                <Text style={styles.infoValue}>{receiptDate}</Text>
                            </View>

                            <View style={styles.dottedDivider} />

                            {/* TILAUSERITTELY */}
                            <Text style={styles.sectionTitle}>Tilauserittely</Text>
                            <View style={styles.itemRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.rowText}>{order.service_name}</Text>
                                    <Text style={styles.itemCountText}>Määrä: {itemCount} kpl</Text>
                                </View>
                                <Text style={styles.priceText}>{itemsPrice.toFixed(2)} €</Text>
                            </View>

                            {/* ERITTELY (Toimitus ja palvelumaksu) */}
                            <View style={styles.feesBox}>
                                <View style={styles.feeRow}>
                                    <View style={styles.feeLabelRow}>
                                        <Feather name="truck" size={13} color="#64748B" style={{ marginRight: 6 }} />
                                        <Text style={styles.feeLabel}>Kotiinkuljetus</Text>
                                    </View>
                                    <Text style={[styles.feeValue, deliveryFee === 0 && styles.freeText]}>
                                        {deliveryFee > 0 ? `${deliveryFee.toFixed(2)} €` : 'Ilmainen'}
                                    </Text>
                                </View>

                                <View style={styles.feeRow}>
                                    <View style={styles.feeLabelRow}>
                                        <Feather name="shield" size={13} color="#64748B" style={{ marginRight: 6 }} />
                                        <Text style={styles.feeLabel}>Palvelumaksu</Text>
                                    </View>
                                    <Text style={styles.feeValue}>{serviceFee.toFixed(2)} €</Text>
                                </View>
                            </View>

                            {/* LOGISTIIKKA */}
                            <View style={styles.logisticsSection}>
                                <View style={styles.logDetail}>
                                    <Feather name="arrow-up-circle" size={14} color="#0284C7" />
                                    <Text style={styles.logText}>Nouto: {order.pickup_date || '---'}</Text>
                                </View>
                                <View style={styles.logDetail}>
                                    <Feather name="arrow-down-circle" size={14} color="#10B981" />
                                    <Text style={styles.logText}>Palautus: {order.return_date || '---'}</Text>
                                </View>
                            </View>

                            {/* MAKSU JA ALV */}
                            <View style={styles.paymentBox}>
                                <View style={styles.paymentRow}>
                                    <Text style={styles.paymentLabel}>Maksutapa</Text>
                                    <Text style={styles.paymentValue}>
                                        {order.payment_method === 'stripe_mobile_payment' || order.payment_method === 'stripe' ? 'Korttimaksu / Verkko' : 'Mobiilimaksu'}
                                    </Text>
                                </View>
                                <View style={styles.paymentRow}>
                                    <Text style={styles.paymentLabel}>Veroton hinta (netto)</Text>
                                    <Text style={styles.paymentValue}>{netAmount.toFixed(2)} €</Text>
                                </View>
                                <View style={styles.paymentRow}>
                                    <Text style={styles.paymentLabel}>ALV ({vatRate.toString().replace('.', ',')}%)</Text>
                                    <Text style={styles.paymentValue}>{totalVat.toFixed(2)} €</Text>
                                </View>
                                <View style={[styles.paymentRow, styles.paymentRowTotal]}>
                                    <Text style={styles.totalLabel}>Yhteensä</Text>
                                    <Text style={styles.totalValue}>{totalAmount.toFixed(2)} €</Text>
                                </View>
                            </View>

                            {/* PDF LATAUS */}
                            <TouchableOpacity style={styles.pdfButton} onPress={createPDF} activeOpacity={0.85}>
                                <Feather name="file-text" size={18} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.pdfButtonText}>Lataa virallinen PDF-kuitti</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '92%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 20,
    },
    pullBar: {
        width: 36,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.darkText,
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 2,
        fontWeight: '600',
    },
    closeIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    companyCard: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    companyName: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    companyDetail: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 2,
    },
    printerIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    itemRow: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    rowText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    itemCountText: {
        fontSize: 12,
        color: '#0284C7',
        fontWeight: '700',
        marginTop: 2,
    },
    priceText: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.darkText,
    },
    feesBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    feeLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    feeLabel: {
        fontSize: 13,
        color: COLORS.textGray,
        fontWeight: '500',
    },
    feeValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    freeText: {
        color: COLORS.green,
        fontWeight: '700',
    },
    logisticsSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 18,
        paddingHorizontal: 4,
    },
    logDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    logText: {
        fontSize: 12,
        color: COLORS.textGray,
        fontWeight: '600',
    },
    paymentBox: {
        backgroundColor: '#F8FAFC',
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    paymentRowTotal: {
        marginTop: 10,
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
        paddingTop: 10,
        marginBottom: 0,
    },
    paymentLabel: {
        fontSize: 13,
        color: COLORS.textGray,
        fontWeight: '500',
    },
    paymentValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0284C7',
    },
    pdfButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 4,
    },
    pdfButtonText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 15,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        paddingHorizontal: 2,
    },
    infoLabel: {
        fontSize: 12,
        color: COLORS.textGray,
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.darkText,
    },
    dottedDivider: {
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        marginVertical: 14,
    },
});

export default OrderReceiptModal;