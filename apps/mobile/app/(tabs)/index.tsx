import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { selectCartItems } from '../../redux/cartSlice';
import { selectUserProfile } from '../../redux/profileSlice';
import { fetchUserProfile } from "../../redux/profileThunks";
import { fetchActiveServiceAreas, matchAddressServiceArea, ServiceArea } from "../../lib/serviceAreas";

import CartModal from "../../components/CartModal";
import FloatingCartBubble from "../../components/FloatingCartBubble";
import HomeHeader from "../../components/home/HomeHeader";
import LocationBar from "../../components/home/LocationBar";
import ServiceGrid from "../../components/home/ServiceGrid";

const SCROLL_OFFSET_ADJUSTMENT = 55;

const performScroll = (ref: any, offset: number) => {
    if (ref.current && offset > 0) {
        const targetOffset = offset - SCROLL_OFFSET_ADJUSTMENT;
        setTimeout(() => {
            ref.current.scrollToOffset({
                offset: Math.max(0, targetOffset),
                animated: true,
            });
        }, 100);
    }
};

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const params = useLocalSearchParams();

    const cartItems = useSelector(selectCartItems);
    const userProfile = useSelector(selectUserProfile);
    const hasItemsInCart = cartItems.length > 0;

    const [isCartVisible, setIsCartVisible] = useState(false);
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [isBannerDismissed, setIsBannerDismissed] = useState(false);
    const serviceGridRef = useRef<any>(null);
    const [headerOffset, setHeaderOffset] = useState(0);

    useEffect(() => {
        dispatch(fetchUserProfile() as any);
        fetchActiveServiceAreas().then(setServiceAreas);
    }, [dispatch]);

    useEffect(() => {
        if (params.action === 'scrollToMenu' && headerOffset > 0) {
            performScroll(serviceGridRef, headerOffset);
            router.setParams({ action: undefined });
        }
    }, [params.action, headerOffset, router]);

    const serviceAreaMatch = useMemo(() => {
        return matchAddressServiceArea(userProfile?.address, serviceAreas);
    }, [userProfile?.address, serviceAreas]);

    // Poimitaan paikkakunta käyttäjän osoitteesta siististi viestiä varten
    const displayAreaName = useMemo(() => {
        if (!userProfile?.address) return '';
        const parts = userProfile.address.split(',').map(s => s.trim());
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            const withoutPostal = lastPart.replace(/^[0-9\s]+/, '');
            return withoutPostal || lastPart;
        }
        return userProfile.address;
    }, [userProfile?.address]);

    const showCoverageNotice = !!userProfile?.address && !serviceAreaMatch.isSupported && !isBannerDismissed;

    const handleStartWash = () => {
        performScroll(serviceGridRef, headerOffset);
    };

    const handleCartPress = () => {
        setIsCartVisible(true);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

            <ServiceGrid
                ref={serviceGridRef}
                ListHeaderComponent={
                    <>
                        <View
                            onLayout={(event) => {
                                setHeaderOffset(event.nativeEvent.layout.height);
                            }}
                        >
                            <HomeHeader
                                onStartPress={handleStartWash}
                                style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }}
                            />

                            <LocationBar
                                onCartPress={handleCartPress}
                            />

                            {/* 🔥 ILMOITUSBANNERI: KUN OSOITE ON TOIMITUSALUEEN ULKOPUOLELLA 🔥 */}
                            {showCoverageNotice && (
                                <View style={styles.coverageBanner}>
                                    <View style={styles.coverageBannerHeader}>
                                        <View style={styles.coverageBannerLeft}>
                                            <Feather name="alert-triangle" size={18} color="#D97706" />
                                            <Text style={styles.coverageBannerTitle}>Toimitusalueen ulkopuolella</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setIsBannerDismissed(true)}
                                            style={styles.coverageDismissBtn}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Feather name="x" size={18} color="#92400E" />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.coverageBannerText}>
                                        Emme vielä valitettavasti toimi {displayAreaName ? `"${displayAreaName}" ` : ''}alueella.
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.coverageActionBtn}
                                        onPress={() => router.push('/general/personal-data')}
                                    >
                                        <Text style={styles.coverageActionBtnText}>Päivitä osoite tästä</Text>
                                        <Feather name="arrow-right" size={14} color="#B45309" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </>
                }
            />

            {hasItemsInCart && (
                <FloatingCartBubble onPress={handleCartPress} />
            )}

            <CartModal
                isVisible={isCartVisible}
                onClose={() => setIsCartVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1B32',
        paddingHorizontal: 25,
        marginTop: 25,
        marginBottom: 20,
        textAlign: "center",
    },
    coverageBanner: {
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 16,
        marginHorizontal: 20,
        marginTop: 15,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    coverageBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    coverageBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coverageBannerTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#92400E',
        marginLeft: 8,
    },
    coverageDismissBtn: {
        padding: 2,
    },
    coverageBannerText: {
        fontSize: 13,
        color: '#78350F',
        lineHeight: 18,
        marginBottom: 10,
    },
    coverageActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    coverageActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#B45309',
    },
});