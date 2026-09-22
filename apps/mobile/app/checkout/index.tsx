import { Feather } from '@expo/vector-icons';
import { PlatformPay, usePlatformPay, useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchActiveServiceAreas, matchAddressServiceArea, ServiceArea } from '../../lib/serviceAreas';
import { supabase } from '../../lib/supabase';
import { calculateOrderPricing, useSystemSettings } from '../../lib/systemSettings';
import { normalizePhoneNumberData } from '../../lib/phoneUtils';
import { Logger } from '@pesuni/shared';

// --- REDUX IMPORTS ---
import { clearCart, selectCartItems } from '../../redux/cartSlice';
import { selectUserProfile, UserProfile } from '../../redux/profileSlice';

// --- KOMPONENTTI IMPORTS ---
import CouponInput from '../../components/checkout/CouponInput';
import CustomerInfoBlock from '../../components/checkout/CustomerInfoBlock';
import OrderSummaryCard from '../../components/checkout/OrderSummaryCard';
import PaymentSelection from '../../components/checkout/PaymentSelection';
import PointsUsage from '../../components/checkout/PointsUsage';
import SwipeButton from '../../components/checkout/SwipeButton';
import TermsCheckbox from '../../components/checkout/TermsCheckbox';
import TimeSlotPicker from '../../components/checkout/TimeSlotPicker';

// --- TYYPIT ---
interface Coupon { id: string; discount_type: 'percentage' | 'fixed'; discount_value: number; code?: string; }

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    background: '#F8FAFC',
    cardBorder: '#F1F5F9',
    successGreen: '#10B981',
    warningBackground: '#FEF3C7',
    warningBorder: '#FDE68A',
    warningText: '#92400E',
};

const STEPS = [
    { number: 1, title: 'Tiedot' },
    { number: 2, title: 'Aika' },
    { number: 3, title: 'Maksu' },
];

export default function CheckoutScreen() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const { isPlatformPaySupported, confirmPlatformPayPayment } = usePlatformPay();

    const cartItems = useSelector(selectCartItems);
    const userProfile: UserProfile | null = useSelector(selectUserProfile) as (UserProfile | null);

    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [currentStep, setCurrentStep] = useState(1);
    const MAX_STEPS = 3;

    const [pickupSlot, setPickupSlot] = useState<any | null>(null);
    const [deliverySlot, setDeliverySlot] = useState<any | null>(null);

    const [specialInstructions, setSpecialInstructions] = useState('');
    const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('stripe');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [saveToMyTextiles, setSaveToMyTextiles] = useState(true);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [pointsDiscount, setPointsDiscount] = useState(0);
    const [pointsToUse, setPointsToUse] = useState(0);
    const [customPickupAddress, setCustomPickupAddress] = useState<string | null>(null);
    const [customDeliveryAddress, setCustomDeliveryAddress] = useState<string | null>(null);
    const [pickupInstructions, setPickupInstructions] = useState<string>('');
    const [deliveryInstructions, setDeliveryInstructions] = useState<string>('');

    const effectivePickupAddress = customPickupAddress || userProfile?.address || '';
    const effectiveDeliveryAddress = customDeliveryAddress || effectivePickupAddress;

    useEffect(() => {
        fetchActiveServiceAreas().then(setServiceAreas);
    }, []);

    const serviceAreaMatch = useMemo(() => {
        return matchAddressServiceArea(effectivePickupAddress, serviceAreas);
    }, [effectivePickupAddress, serviceAreas]);

    const deliveryFee = serviceAreaMatch.deliveryFee || 0;
    const isAddressInServiceArea = serviceAreaMatch.isSupported;

    const handleTimeSlotChange = useCallback((pickup: any, delivery: any) => {
        setPickupSlot(pickup);
        setDeliverySlot(delivery);
    }, []);

    useEffect(() => {
        if (isSuccess) {
            const timer = setTimeout(() => {
                router.replace('/washes');
            }, 4500);
            return () => clearTimeout(timer);
        }
    }, [isSuccess, router]);

    const settings = useSystemSettings();
    const serviceFee = settings.service_fee;
    const vatRate = settings.vat_rate;

    const pricing = useMemo(() => {
        const initialSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let couponDiscount = 0;

        if (appliedCoupon) {
            if (appliedCoupon.discount_type === 'percentage') {
                couponDiscount = (initialSubtotal * appliedCoupon.discount_value) / 100;
            } else if (appliedCoupon.discount_type === 'fixed') {
                couponDiscount = appliedCoupon.discount_value;
            }
        }

        return calculateOrderPricing({
            itemsTotal: initialSubtotal,
            serviceFee: settings.service_fee,
            deliveryFee: deliveryFee,
            vatRate: settings.vat_rate,
            couponDiscount: couponDiscount,
            pointsDiscount: pointsDiscount,
        });
    }, [cartItems, appliedCoupon, pointsDiscount, deliveryFee, settings]);

    const subtotal = pricing.itemsTotal;
    const finalTotal = pricing.finalTotal;
    const vatAmount = pricing.vatAmount;

    // 🔥 ÄLYKÄS MAKSUKÄSITTELIJÄ 🔥
    const processPaymentAndOrder = async () => {
        if (!termsAccepted) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            Alert.alert("Hyväksy ehdot", "Ole hyvä ja hyväksy palveluehdot ennen maksun suorittamista.");
            return;
        }

        setIsProcessing(true);
        try {
            const tempOrderId = Math.random().toString(36).substring(7);

            // 1. Haetaan payment intent backendiltä
            const { data, error: funcError } = await supabase.functions.invoke('create-payment-sheet', {
                body: { order_id: tempOrderId, amount: finalTotal }
            });

            if (funcError) {
                console.error("DEBUG - Funktio virhe:", funcError);
                Alert.alert("Yhteysvirhe", "Maksupalveluun ei saatu yhteyttä. Tarkista verkkoyhteys.");
                throw new Error(`Maksuasetusten haku epäonnistui: ${funcError.message}`);
            }

            if (!data || !data.paymentIntent) {
                Alert.alert("Virhe", "Maksutiedot puuttuvat.");
                throw new Error("Maksutiedot puuttuvat");
            }

            // 🍏 JOS KÄYTTÄJÄ VALITSI APPLE PAY / GOOGLE PAY: AVATAAN SUORAAN NATIIVI WALLET 🍏
            if (selectedPaymentMethod === 'apple_google_pay') {
                try {
                    const hasWalletSupport = await isPlatformPaySupported();
                    if (hasWalletSupport) {
                        const { error: platformPayError } = await confirmPlatformPayPayment(data.paymentIntent, {
                            applePay: {
                                cartItems: [
                                    {
                                        label: 'Pesuni Oy',
                                        amount: finalTotal.toFixed(2),
                                        paymentType: PlatformPay.PaymentType.Immediate,
                                    },
                                ],
                                merchantCountryCode: 'FI',
                                currencyCode: 'EUR',
                            },
                            googlePay: {
                                testEnv: true,
                                merchantCountryCode: 'FI',
                                currencyCode: 'EUR',
                            },
                        });

                        if (platformPayError) {
                            if (platformPayError.code === 'Canceled') {
                                setIsProcessing(false);
                                return;
                            }
                            console.warn("PlatformPay siirtyy varamenetelmään:", platformPayError.message);
                        } else {
                            // Maksu onnistui natiivilla Apple/Google Paylla!
                            await handlePlaceOrder('platform_pay');
                            return;
                        }
                    }
                } catch (walletErr) {
                    console.log("Wallet tarkistus:", walletErr);
                }
            }

            // 💳 STRIPE MULTI-PAYMENT SHEET (Korttimaksu, Klarna, Verkkopankki) 💳
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: "Pesuni Oy",
                customerId: data.customer,
                customerEphemeralKeySecret: data.ephemeralKey,
                paymentIntentClientSecret: data.paymentIntent,
                allowsDelayedPaymentMethods: true,
                returnURL: 'pesuni://stripe-redirect',
                applePay: {
                    merchantCountryCode: 'FI',
                },
                googlePay: {
                    merchantCountryCode: 'FI',
                    testEnv: true,
                },
                defaultBillingDetails: {
                    name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Asiakas',
                    phone: userProfile?.phone || undefined,
                }
            });

            if (initError) throw initError;

            const { error: presentError } = await presentPaymentSheet();

            if (presentError) {
                if (presentError.code === 'Canceled') {
                    setIsProcessing(false);
                    return;
                }
                throw presentError;
            }

            // Maksu onnistui -> tallennetaan tilaus
            await handlePlaceOrder(selectedPaymentMethod);

        } catch (error: any) {
            setIsProcessing(false);
            Alert.alert("Maksutapahtuma", error.message || "Maksun käsittely epäonnistui");
        }
    };

    const handlePlaceOrder = async (methodId: string) => {
        const pickupText = pickupSlot?.slot?.time || "08:00 - 10:00";
        const deliveryText = deliverySlot?.slot?.time || pickupText;

        const formatTimeOnly = (text: string) => {
            const m = text.match(/\d{2}:\d{2}/);
            return m ? `${m[0]}:00` : "08:00:00";
        };

        const createFullIso = (dateObj: Date, tStr: string) => {
            const m = tStr.match(/\d{2}:\d{2}/);
            const t = m ? m[0] : "12:00";
            const [h, min] = t.split(':');
            const d = new Date(dateObj || new Date());
            d.setHours(parseInt(h), parseInt(min), 0, 0);
            return d.toISOString();
        };

        const formatDateOnly = (date: Date) => {
            return new Date(date || new Date()).toISOString().split('T')[0];
        };

        const pickupTimeOnly = formatTimeOnly(pickupText);
        const returnTimeOnly = formatTimeOnly(deliveryText);
        const pickupDateStr = formatDateOnly(pickupSlot?.date || new Date());
        const returnDateStr = formatDateOnly(deliverySlot?.date || pickupSlot?.date || new Date());
        const pickupFull = createFullIso(pickupSlot?.date || new Date(), pickupText);
        const deliveryFull = createFullIso(deliverySlot?.date || pickupSlot?.date || new Date(), deliveryText);

        const allServicesNames = cartItems.map(item => item.name).join(', ');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user || !userProfile) throw new Error("Käyttäjää ei löydy");

            const instructionLines: string[] = [];
            if (effectiveDeliveryAddress && effectiveDeliveryAddress !== effectivePickupAddress) {
                instructionLines.push(`Toimitusosoite: ${effectiveDeliveryAddress}`);
            }
            if (pickupInstructions) {
                instructionLines.push(`Nouto-ohje: ${pickupInstructions}`);
            }
            if (deliveryInstructions) {
                instructionLines.push(`Toimitusohje: ${deliveryInstructions}`);
            }
            if (specialInstructions) {
                instructionLines.push(`Muut ohjeet: ${specialInstructions}`);
            }
            const combinedInstructions = instructionLines.join('\n');

            const baseOrderPayload: Record<string, any> = {
                user_id: user.id,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name || '',
                phone: normalizePhoneNumberData(userProfile.phone),
                address: effectivePickupAddress,
                price: subtotal,
                final_price: finalTotal,
                payment_amount: finalTotal,
                service_fee: serviceFee,
                delivery_fee: deliveryFee,
                vat_rate: vatRate,
                vat_amount: vatAmount,
                service_type: 'multiple',
                service_name: allServicesNames || 'Pesupalvelu',
                pickup_date: pickupDateStr,
                return_date: returnDateStr,
                pickup_time: pickupTimeOnly,
                return_time: returnTimeOnly,
                pickup_option: pickupSlot?.slot?.id === 'asap' ? 'asap' : 'choose_time',
                return_option: 'choose_time',
                pickup_slot: pickupFull,
                delivery_slot: deliveryFull,
                tracking_status: 'pending',
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                access_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                terms_accepted: true,
                special_instructions: combinedInstructions,
            };

            // Edge Function Call for creating the order safely
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-order', {
                body: {
                    baseOrderPayload,
                    cartItems,
                    saveToMyTextiles,
                    pointsToUse,
                    userId: user.id
                }
            });

            if (edgeError || edgeData?.error) {
                throw new Error(edgeError?.message || edgeData?.error || "Tilauksen luonti epäonnistui");
            }

            setIsProcessing(false);
            setIsSuccess(true);
            dispatch(clearCart());

        } catch (error: any) {
            Logger.error("Checkout order creation failed", error);
            Alert.alert("Virhe", "Maksu vahvistettiin, mutta tilausta ei voitu tallentaa kokonaan. Ota yhteys tukeen.");
            setIsProcessing(false);
        }
    };

    const handleNext = () => {
        if (currentStep === 1) {
            if (cartItems.length === 0) {
                Alert.alert("Ostoskori on tyhjä", "Lisää ensin pestäviä tuotteita ostoskoriin.");
                return;
            }
            if (!userProfile?.address) {
                Alert.alert(
                    "Toimitusosoite puuttuu",
                    "Aseta toimitusosoite ennen kuin jatkat eteenpäin.",
                    [
                        { text: "Peruuta", style: "cancel" },
                        { text: "Aseta osoite", onPress: () => router.push('/general/personal-data') }
                    ]
                );
                return;
            }
            if (!isAddressInServiceArea && serviceAreas.length > 0) {
                Alert.alert(
                    "Toimitusalueen ulkopuolella",
                    `Osoitteesi ei kuulu toimitusalueeseemme (${serviceAreaMatch.activeCities.join(', ')}). Vaihda osoite klikkaamalla Muokkaa.`,
                    [
                        { text: "Sulje", style: "cancel" },
                        { text: "Vaihda osoite", onPress: () => router.push('/general/personal-data') }
                    ]
                );
                return;
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setCurrentStep(2);
            return;
        }

        if (currentStep === 2) {
            if (!pickupSlot?.slot || !deliverySlot?.slot) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                Alert.alert("Valitse ajat", "Ole hyvä ja valitse sekä nouto- että palautusajankohta jatkaaksesi.");
                return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setCurrentStep(3);
            return;
        }
    };

    if (isProcessing) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.statusText}>Vahvistetaan maksua...</Text>
                <Text style={styles.statusSubtext}>Hetki pieni, suojataan yhteyttä</Text>
            </View>
        );
    }

    if (isSuccess) {
        return (
            <View style={styles.centeredContainer}>
                <View style={styles.successIconCircle}>
                    <Feather name="check" size={42} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Kiitos tilauksesta! 🎉</Text>
                <Text style={styles.successSubtitle}>
                    Pyykkitilauksesi on vastaanotettu ja maksettu onnistuneesti. Kuljettaja saapuu noutamaan pyykit oveltasi!
                </Text>
                <TouchableOpacity
                    style={styles.manualButton}
                    onPress={() => router.replace('/washes')}
                    activeOpacity={0.85}
                >
                    <Text style={styles.manualButtonText}>Siirry tilauksen seurantaan</Text>
                    <Feather name="arrow-right" size={16} color={COLORS.white} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.fullScreen} edges={['top']}>
                <StatusBar barStyle="dark-content" />

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                    </TouchableOpacity>

                    {/* 🌟 3-VAIHEINEN MINIMALISTINEN STEP-INDICAATTORI 🌟 */}
                    <View style={styles.stepsIndicator}>
                        {STEPS.map((s) => {
                            const isActive = s.number === currentStep;
                            const isCompleted = s.number < currentStep;
                            return (
                                <View key={s.number} style={styles.stepPillWrapper}>
                                    <View style={[
                                        styles.stepPill,
                                        isActive && styles.stepPillActive,
                                        isCompleted && styles.stepPillCompleted,
                                    ]}>
                                        <Text style={[
                                            styles.stepPillNumber,
                                            isActive && styles.stepPillNumberActive,
                                            isCompleted && styles.stepPillNumberCompleted,
                                        ]}>
                                            {isCompleted ? '✓' : s.number}
                                        </Text>
                                        <Text style={[
                                            styles.stepPillTitle,
                                            isActive && styles.stepPillTitleActive,
                                            isCompleted && styles.stepPillTitleCompleted,
                                        ]}>
                                            {s.title}
                                        </Text>
                                    </View>
                                    {s.number < 3 && <View style={[styles.stepConnector, isCompleted && styles.stepConnectorActive]} />}
                                </View>
                            );
                        })}
                    </View>

                    <View style={{ width: 38 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {currentStep === 1 && (
                        <View style={styles.stepContainer}>
                            <OrderSummaryCard
                                style={{ marginHorizontal: 16 }}
                                deliveryFee={deliveryFee}
                                serviceFee={serviceFee}
                                vatRate={vatRate}
                            />
                            <CustomerInfoBlock
                                pickupAddress={effectivePickupAddress}
                                onPickupAddressChange={setCustomPickupAddress}
                                deliveryAddress={effectiveDeliveryAddress}
                                onDeliveryAddressChange={setCustomDeliveryAddress}
                                pickupInstructions={pickupInstructions}
                                onPickupInstructionsChange={setPickupInstructions}
                                deliveryInstructions={deliveryInstructions}
                                onDeliveryInstructionsChange={setDeliveryInstructions}
                            />

                            {effectivePickupAddress && !isAddressInServiceArea && serviceAreas.length > 0 && (
                                <View style={styles.warningCard}>
                                    <Feather name="alert-triangle" size={18} color={COLORS.warningText} />
                                    <View style={styles.warningContent}>
                                        <Text style={styles.warningTitle}>Toimitusalueen ulkopuolella</Text>
                                        <Text style={styles.warningSubtitle}>
                                            Nouto-osoitteesi ei kuulu tällä hetkellä toimitusalueeseemme ({serviceAreaMatch.activeCities.join(', ')}). Vaihda osoite klikkaamalla nouto-osoitetta.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {currentStep === 2 && (
                        <View style={styles.stepContainer}>
                            <TimeSlotPicker onSelectionChange={handleTimeSlotChange} />
                        </View>
                    )}

                    {currentStep === 3 && (
                        <View style={styles.stepContainer}>
                            {/* 1. MAKSUTAPA */}
                            <PaymentSelection
                                selectedMethod={selectedPaymentMethod}
                                onMethodSelect={setSelectedPaymentMethod}
                            />

                            {/* 2. ALENNUSKOODI & KAVERIKOODI */}
                            <CouponInput
                                onCouponApplied={setAppliedCoupon}
                                currentTotal={finalTotal}
                            />

                            {/* 3. PESUPISTEIDEN KÄYTTÖ */}
                            <PointsUsage
                                onPointsApplied={(discount, points) => {
                                    setPointsDiscount(discount);
                                    setPointsToUse(points);
                                }}
                            />

                            {/* 4. TILAUS- JA HINTAYHTEENVETO */}
                            <OrderSummaryCard
                                deliveryFee={deliveryFee}
                                serviceFee={serviceFee}
                                vatRate={vatRate}
                                couponDiscount={pricing.couponDiscount}
                                pointsDiscount={pointsDiscount}
                                appliedCouponCode={appliedCoupon?.code}
                                title="Maksun yhteenveto"
                                collapsibleItems={true}
                            />

                            {/* 5. TALLENNA OMIIN TEKSTIILIIN */}
                            <TouchableOpacity
                                style={styles.saveTextilesToggleRow}
                                activeOpacity={0.8}
                                onPress={() => setSaveToMyTextiles(!saveToMyTextiles)}
                            >
                                <View style={[styles.saveTextilesCheckbox, saveToMyTextiles && styles.saveTextilesCheckboxActive]}>
                                    {saveToMyTextiles && <Feather name="check" size={13} color="#FFFFFF" />}
                                </View>
                                <View style={styles.saveTextilesTextCol}>
                                    <Text style={styles.saveTextilesTitle}>Tallenna tekstiilit Omiin tekstiileihin</Text>
                                    <Text style={styles.saveTextilesSubtitle}>
                                        Tallenna tilauksen kohteet profiiliisi, niin tilaat pesun ensi kerralla yhdellä klikkauksella.
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* 6. PALVELUEHTOJEN HYVÄKSYNTÄ */}
                            <TermsCheckbox
                                onToggle={setTermsAccepted}
                                isAccepted={termsAccepted}
                            />
                        </View>
                    )}
                    <View style={{ height: 30 }} />
                </ScrollView>

                {/* 🌟 ALAPALKKI: NOSTETTU REILUSTI YLÖS PYYHKÄISYN HELPOTTAMISEKSI 🌟 */}
                <View style={styles.footer}>
                    {currentStep < MAX_STEPS ? (
                        <TouchableOpacity
                            onPress={handleNext}
                            style={styles.primaryButton}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryButtonText}>Seuraava vaihe</Text>
                            <Feather name="arrow-right" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    ) : (
                        <SwipeButton
                            title={`Pyyhkäise ja Maksa ${finalTotal.toFixed(2)} €`}
                            onSwipeSuccess={processPaymentAndOrder}
                            disabled={!termsAccepted}
                        />
                    )}
                </View>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 12 : 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepPillWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
    },
    stepPillActive: {
        backgroundColor: '#E0F2FE',
    },
    stepPillCompleted: {
        backgroundColor: '#DCFCE7',
    },
    stepPillNumber: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textGray,
        marginRight: 4,
    },
    stepPillNumberActive: {
        color: '#0284C7',
    },
    stepPillNumberCompleted: {
        color: '#16A34A',
    },
    stepPillTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textGray,
    },
    stepPillTitleActive: {
        color: '#0284C7',
        fontWeight: '800',
    },
    stepPillTitleCompleted: {
        color: '#16A34A',
    },
    stepConnector: {
        width: 10,
        height: 2,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 3,
    },
    stepConnectorActive: {
        backgroundColor: '#86EFAC',
    },
    scrollContent: { paddingVertical: 8 },
    stepContainer: { paddingTop: 2 },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 36,
    },
    statusText: {
        marginTop: 18,
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    statusSubtext: {
        fontSize: 13,
        color: COLORS.textGray,
        marginTop: 4,
    },
    successIconCircle: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#DCFCE7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.darkText,
        marginBottom: 8,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 14,
        color: COLORS.textGray,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 28,
    },
    manualButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 15,
        paddingHorizontal: 26,
        borderRadius: 18,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 4,
    },
    manualButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '800',
    },
    footer: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 44 : 30,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        alignItems: 'center',
    },
    primaryButton: {
        width: '100%',
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.warningBackground,
        borderWidth: 1,
        borderColor: COLORS.warningBorder,
        borderRadius: 16,
        padding: 14,
        marginHorizontal: 16,
        marginTop: 10,
    },
    warningContent: {
        marginLeft: 10,
        flex: 1,
    },
    warningTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.warningText,
        marginBottom: 2,
    },
    warningSubtitle: {
        fontSize: 12,
        color: COLORS.warningText,
        lineHeight: 17,
    },
    saveTextilesToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 16,
        padding: 14,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
    },
    saveTextilesCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#94A3B8',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    saveTextilesCheckboxActive: {
        backgroundColor: '#00C2FF',
        borderColor: '#00C2FF',
    },
    saveTextilesTextCol: {
        flex: 1,
    },
    saveTextilesTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    saveTextilesSubtitle: {
        fontSize: 11,
        color: '#475569',
        marginTop: 2,
        lineHeight: 15,
    },
});