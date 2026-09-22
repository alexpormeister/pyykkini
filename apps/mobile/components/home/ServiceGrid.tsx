import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    FlatList,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { addToCart } from '../../redux/cartSlice';
import HeroBanner from './HeroBanner';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const FALLBACK_IMAGE = require('../../assets/images/3dglossy-logo.png');

const FILTER_DATA = [
    { name: 'Kaikki Pesut', shortName: 'Kaikki', icon: 'apps' },
    { name: 'Arjen pyykit', shortName: 'Pyykit', icon: 'tshirt-crew' },
    { name: 'Kodintekstiilit', shortName: 'Koti', icon: 'home-variant' },
    { name: 'Mattopesu', shortName: 'Matot', icon: 'rug' },
    { name: 'Kengät & Erikoispesut', shortName: 'Erikoispesut', icon: 'shoe-sneaker' },
];

const CATEGORY_ICONS: Record<string, string> = {
    'Arjen pyykit': 'tshirt-crew',
    'Kodintekstiilit': 'home-variant',
    'Mattopesu': 'rug',
    'Kengät & Erikoispesut': 'shoe-sneaker',
};

const COLORS = {
    primary: '#00c2ff',
    primaryLight: '#E0F7FF',
    success: '#10B981',
    background: '#F8F9FD',
    white: '#FFFFFF',
    textDark: '#0F172A',
    textGray: '#64748B',
    border: '#E2E8F0',
    cardBorder: '#EEF2F6',
};

// --- YKSITTÄINEN 2-SARAKKEEN TUOTEKORTTI ---
const ProductGridCard: React.FC<{ product: any; onOpenDetail: (p: any) => void }> = ({ product, onOpenDetail }) => {
    const dispatch = useDispatch();
    const [isAdded, setIsAdded] = useState(false);

    const hasDiscount = Boolean(
        product.discount_price &&
        Number(product.discount_price) > 0 &&
        Number(product.discount_price) < Number(product.base_price)
    );
    const effectivePrice = hasDiscount ? Number(product.discount_price) : Number(product.base_price);
    const discountPercent = hasDiscount
        ? Math.round(((Number(product.base_price) - Number(product.discount_price)) / Number(product.base_price)) * 100)
        : 0;

    const handleQuickAdd = (e: any) => {
        e.stopPropagation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        dispatch(addToCart({
            id: product.product_id,
            name: product.name,
            price: effectivePrice,
            quantity: 1,
        }));

        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 1400);
    };

    const displayBadge = product.badge_text || (hasDiscount ? `🔥 -${discountPercent}%` : (product.is_featured ? '⭐ Suosittu' : null));

    return (
        <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.88}
            onPress={() => onOpenDetail(product)}
        >
            {/* TUOTEKUVA JA BADGE */}
            <View style={styles.imageContainer}>
                <Image
                    source={product.image_url ? { uri: product.image_url } : FALLBACK_IMAGE}
                    style={styles.gridImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={150}
                    placeholder={FALLBACK_IMAGE}
                />

                {displayBadge && (
                    <View style={[styles.badgePill, hasDiscount && styles.discountBadgePill]}>
                        <Text style={styles.badgeText}>{displayBadge}</Text>
                    </View>
                )}
            </View>

            {/* TUOTETIEDOT */}
            <View style={styles.cardBody}>
                <Text style={styles.productTitle} numberOfLines={2}>
                    {product.name}
                </Text>

                {product.description ? (
                    <Text style={styles.productSnippet} numberOfLines={1}>
                        {product.description}
                    </Text>
                ) : null}

                {/* HINTA JA LISÄÄ KORIIN -NAPPI */}
                <View style={styles.cardFooter}>
                    <View style={{ flex: 1, marginRight: 6, justifyContent: 'center' }}>
                        <Text style={styles.priceLabel}>Hinta</Text>
                        <View style={{ flexDirection: 'column' }}>
                            {hasDiscount && (
                                <Text style={styles.originalPriceText}>
                                    {Number(product.base_price).toFixed(2).replace('.', ',')} €
                                </Text>
                            )}
                            <Text style={[styles.productPrice, hasDiscount && styles.discountPriceText]}>
                                {effectivePrice.toFixed(2).replace('.', ',')} €
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.cardAddButton, isAdded && styles.cardAddButtonSuccess]}
                        activeOpacity={0.75}
                        onPress={handleQuickAdd}
                    >
                        <Feather name={isAdded ? "check" : "shopping-bag"} size={13} color={COLORS.white} style={{ marginRight: 4 }} />
                        <Text style={styles.cardAddButtonText}>{isAdded ? "Lisätty!" : "Lisää"}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// --- PÄÄKOMPONENTTI ---
const ServiceGrid = forwardRef<FlatList, { ListHeaderComponent?: React.ReactNode }>(({ ListHeaderComponent }, ref) => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState<boolean>(true);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('Kaikki Pesut');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [modalQuantity, setModalQuantity] = useState(1);
    const [modalAdded, setModalAdded] = useState(false);

    const internalRef = useRef<FlatList>(null);
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const isClosing = useRef(false);

    useImperativeHandle(ref, () => ({
        scrollToOffset: (params: { offset: number; animated?: boolean }) => {
            internalRef.current?.scrollToOffset(params);
        },
    }) as any);

    const fetchCategoriesAndProducts = async () => {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('categories')
                .select(`id, name, category_id, sort_order, products (*)`)
                .order('sort_order');

            if (fetchError) {
                setErrorMsg(fetchError.message);
            } else if (data) {
                const cleaned = data.map(c => ({
                    ...c,
                    products: (c.products || []).filter((p: any) => p.is_active !== false)
                }));
                setCategories(cleaned);

                // ⚡ SALAMANNOPEA ESILATAUS: Esiladataan kaikki kuvat heti muistiin & levylle ⚡
                const allImageUrls = cleaned.flatMap(c => (c.products || []).map((p: any) => p.image_url).filter(Boolean));
                if (allImageUrls.length > 0) {
                    Image.prefetch(allImageUrls);
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategoriesAndProducts();

        const channelName = `service-grid-realtime-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => {
                    fetchCategoriesAndProducts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const openProductDetail = (prod: any) => {
        setModalQuantity(1);
        setModalAdded(false);
        isClosing.current = false;
        setSelectedProduct(prod);

        panY.setValue(SCREEN_HEIGHT);
        Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false, // JS-ajuri mahdollistaa reaaliaikaisen sormenseurannan
            bounciness: 4,
            speed: 16,
        }).start();
    };

    const closeSheet = useCallback(() => {
        if (isClosing.current) return;
        isClosing.current = true;
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(() => {
            setSelectedProduct(null);
            isClosing.current = false;
        });
    }, [panY]);

    // 🔥 PAN RESPONDER: Seuraa sormea 1:1 reaaliajassa swipe-alas eleessä 🔥
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                // Sallitaan kosketuksen rekisteröinti heti vetovyöhykkeeltä
                onStartShouldSetPanResponder: () => true,
                onStartShouldSetPanResponderCapture: () => false,
                onMoveShouldSetPanResponder: (_, g) => g.dy > 2 && Math.abs(g.dy) > Math.abs(g.dx),
                onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 2 && Math.abs(g.dy) > Math.abs(g.dx),
                onPanResponderGrant: () => {
                    panY.stopAnimation();
                    panY.setOffset((panY as any)._value || 0);
                    panY.setValue(0);
                },
                onPanResponderMove: (_, g) => {
                    // Kortti liikkuu vain alaspäin (dy > 0)
                    if (g.dy > 0) {
                        panY.setValue(g.dy);
                    }
                },
                onPanResponderRelease: (_, g) => {
                    panY.flattenOffset();
                    // Jos vedetty alas yli 60px tai nopea pyyhkäisy, suljetaan kortti
                    if (g.dy > 60 || g.vy > 0.3) {
                        closeSheet();
                    } else {
                        // Muussa tapauksessa palautetaan jousella ylös
                        Animated.spring(panY, {
                            toValue: 0,
                            useNativeDriver: false,
                            bounciness: 4,
                            speed: 16,
                        }).start();
                    }
                },
                onPanResponderTerminate: () => {
                    panY.flattenOffset();
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: false,
                        bounciness: 4,
                        speed: 16,
                    }).start();
                },
            }),
        [closeSheet, panY]
    );

    const modalHasDiscount = Boolean(
        selectedProduct?.discount_price &&
        Number(selectedProduct.discount_price) > 0 &&
        Number(selectedProduct.discount_price) < Number(selectedProduct.base_price)
    );
    const modalEffectivePrice = modalHasDiscount
        ? Number(selectedProduct.discount_price)
        : Number(selectedProduct?.base_price || 0);

    // Haetaan tuotteen aito kategoria (esim. "Arjen pyykit" tai "Kodintekstiilit")
    const productCategoryName = useMemo(() => {
        if (!selectedProduct) return null;
        const matched = categories.find(c => (c.products || []).some((p: any) => p.product_id === selectedProduct.product_id));
        return matched?.name || selectedProduct.category_name || null;
    }, [selectedProduct, categories]);

    const handleModalAdd = () => {
        if (!selectedProduct || modalAdded) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        dispatch(addToCart({
            id: selectedProduct.product_id,
            name: selectedProduct.name,
            price: modalEffectivePrice,
            quantity: modalQuantity,
        }));

        setModalAdded(true);
        setTimeout(() => {
            setModalAdded(false);
            closeSheet();
        }, 800);
    };

    const displayedSections = useMemo(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const matchedProducts: any[] = [];

            categories.forEach(c => {
                (c.products || []).forEach((p: any) => {
                    const nameMatch = (p.name || '').toLowerCase().includes(query);
                    const descMatch = (p.description || '').toLowerCase().includes(query);
                    if ((nameMatch || descMatch) && !matchedProducts.some(m => m.product_id === p.product_id)) {
                        matchedProducts.push(p);
                    }
                });
            });

            return [{
                id: 'search-results',
                name: `Hakutulokset ("${searchQuery}")`,
                icon: 'magnify',
                products: matchedProducts,
            }];
        }

        if (selectedFilter !== 'Kaikki Pesut') {
            const filtered = categories.filter(c => c.name === selectedFilter);
            return filtered.filter(c => (c.products || []).length > 0);
        }

        return categories.filter(c => (c.products || []).length > 0);
    }, [categories, selectedFilter, searchQuery]);

    if (loading && categories.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const backdropOpacity = panY.interpolate({
        inputRange: [0, SCREEN_HEIGHT * 0.7],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <FlatList
                ref={internalRef}
                data={displayedSections}
                keyExtractor={(item) => item.id || item.name}
                renderItem={({ item: section }) => (
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionIconCircle}>
                                <MaterialCommunityIcons
                                    name={(CATEGORY_ICONS[section.name] || 'tshirt-crew') as any}
                                    size={18}
                                    color={COLORS.primary}
                                />
                            </View>
                            <Text style={styles.sectionTitle}>{section.name}</Text>
                        </View>

                        <View style={styles.gridContainer}>
                            {section.products.map((product: any) => (
                                <ProductGridCard
                                    key={product.product_id}
                                    product={product}
                                    onOpenDetail={openProductDetail}
                                />
                            ))}
                        </View>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        {ListHeaderComponent}

                        <HeroBanner onOpenDetail={openProductDetail} />

                        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                        {/* 🔍 HAKUKENTTÄ 🔍 */}
                        <View style={styles.searchWrapper}>
                            <View style={styles.searchBar}>
                                <Feather name="search" size={18} color={COLORS.textGray} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Hae pesupalvelua (esim. puku, matto)..."
                                    placeholderTextColor={COLORS.textGray}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    clearButtonMode="while-editing"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                                        <Feather name="x" size={16} color={COLORS.textGray} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* KATEGORIA-IKONIT */}
                        <View style={styles.filterWrapper}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterScroll}
                            >
                                {FILTER_DATA.map((item) => {
                                    const isActive = item.name === selectedFilter && !searchQuery;
                                    return (
                                        <TouchableOpacity
                                            key={item.name}
                                            activeOpacity={0.8}
                                            style={[styles.filterItem, isActive && styles.activeFilterItem]}
                                            onPress={() => {
                                                setSearchQuery('');
                                                setSelectedFilter(item.name);
                                            }}
                                        >
                                            <View style={[styles.iconBox, isActive && styles.activeIconBox]}>
                                                <MaterialCommunityIcons
                                                    name={item.icon as any}
                                                    size={24}
                                                    color={isActive ? COLORS.white : COLORS.primary}
                                                />
                                            </View>
                                            <Text
                                                style={[styles.filterLabel, isActive && styles.activeFilterLabel]}
                                                numberOfLines={1}
                                            >
                                                {item.shortName || item.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="search" size={40} color={COLORS.textGray} />
                        <Text style={styles.emptyText}>
                            {searchQuery ? `Ei hakutuloksia hakusanalla "${searchQuery}".` : 'Ei tuotteita saatavilla.'}
                        </Text>
                    </View>
                }
                ListFooterComponent={<View style={{ height: 100 }} />}
            />

            {/* --- DETAIL BOTTOM SHEET (NATIVELY OVERLAYS BOTTOM NAV BAR USING REACT NATIVE MODAL) --- */}
            <Modal
                visible={Boolean(selectedProduct)}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={closeSheet}
            >
                <View style={styles.modalRootOverlay} pointerEvents="box-none">
                    {/* TAUSTAN TUMMENNUS */}
                    <Animated.View style={[styles.modalOverlay, { opacity: backdropOpacity }]}>
                        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSheet} />
                    </Animated.View>

                    {/* MODAALIKORTTI (Reaaliaikainen sormea seuraava swipe alas) */}
                    <Animated.View
                        style={[
                            styles.modalContent,
                            { transform: [{ translateY: panY }] }
                        ]}
                    >
                        {/* HERO-KUVA JA YLÄOSA (SWIPATTAVA ELEVYÖHYKE) */}
                        <View style={styles.modalImageContainer} {...panResponder.panHandlers}>
                            <Image
                                source={selectedProduct?.image_url ? { uri: selectedProduct.image_url } : FALLBACK_IMAGE}
                                style={styles.modalImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={150}
                                placeholder={FALLBACK_IMAGE}
                                pointerEvents="none"
                            />

                            {/* Yläliukuväri suojaamaan nappeja (pointerEvents none sallii vedon suoraan läpi) */}
                            <LinearGradient
                                colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.05)', 'transparent']}
                                style={styles.imageGradientOverlay}
                                pointerEvents="none"
                            />

                            {/* Huomaamaton vetokahva kuvan päällä */}
                            <View style={styles.floatingPullBarWrapper} pointerEvents="none">
                                <View style={styles.floatingPullBar} />
                            </View>

                            {/* Kelluva lasimainen sulkunappi: sulkee kortin alas liukuen */}
                            <TouchableOpacity
                                style={styles.floatingCloseBtn}
                                onPress={closeSheet}
                                activeOpacity={0.7}
                            >
                                <Feather name="x" size={18} color="#0F172A" />
                            </TouchableOpacity>

                            {/* Kelluva alennusbadge kuvan päällä */}
                            {(selectedProduct?.badge_text || modalHasDiscount) && (
                                <View style={styles.floatingImageBadge} pointerEvents="none">
                                    <Text style={styles.floatingImageBadgeText}>
                                        {selectedProduct?.badge_text || `🔥 SÄÄSTÄ ${Math.round(((Number(selectedProduct?.base_price || 0) - Number(selectedProduct?.discount_price || 0)) / Number(selectedProduct?.base_price || 1)) * 100)} %`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* SISÄLLÖN SKROLLAUS (flex: 1 pitää footerin aina näkyvillä alhaalla) */}
                        <ScrollView
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 24 }}
                        >
                            <View style={styles.modalTextContainer}>
                                {/* Kategoria-tagi (aito kategoria, esim. Arjen pyykit) */}
                                {productCategoryName ? (
                                    <View style={styles.categoryBadgeRow}>
                                        <View style={styles.categoryBadge}>
                                            <MaterialCommunityIcons
                                                name={(CATEGORY_ICONS[productCategoryName] || 'tshirt-crew') as any}
                                                size={13}
                                                color="#0284C7"
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text style={styles.categoryBadgeText}>{productCategoryName}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                {/* Otsikko ja Hinta */}
                                <View style={styles.modalHeaderRow}>
                                    <Text style={styles.modalTitle}>{selectedProduct?.name}</Text>
                                    <View style={styles.priceColumn}>
                                        {modalHasDiscount && (
                                            <Text style={styles.modalOriginalPrice}>
                                                {Number(selectedProduct?.base_price || 0).toFixed(2).replace('.', ',')} €
                                            </Text>
                                        )}
                                        <Text style={[styles.modalPrice, modalHasDiscount && styles.modalDiscountPrice]}>
                                            {modalEffectivePrice.toFixed(2).replace('.', ',')} €
                                        </Text>
                                    </View>
                                </View>

                                {/* 🌟 3 LAATUTAKUUSIRUA 🌟 */}
                                <View style={styles.perksRow}>
                                    <View style={styles.perkChip}>
                                        <Feather name="truck" size={13} color="#0284C7" />
                                        <Text style={styles.perkText}>Kotiinkuljetus</Text>
                                    </View>
                                    <View style={styles.perkChip}>
                                        <Feather name="shield" size={13} color="#10B981" />
                                        <Text style={styles.perkText}>Laatutakuu</Text>
                                    </View>
                                    <View style={styles.perkChip}>
                                        <Feather name="check" size={13} color="#D97706" />
                                        <Text style={styles.perkText}>Ammattipesu</Text>
                                    </View>
                                </View>

                                {/* 📄 KUVAUSKORTTI 📄 */}
                                <View style={styles.descriptionCard}>
                                    <View style={styles.descHeader}>
                                        <Feather name="info" size={14} color="#64748B" style={{ marginRight: 6 }} />
                                        <Text style={styles.modalDescriptionTitle}>Palvelun kuvaus</Text>
                                    </View>
                                    <Text style={styles.modalDescriptionText}>
                                        {selectedProduct?.description || 'Ammattimainen, hellävarainen ja korkealaatuinen pesupalvelu suoraan kotiovellesi noudettuna ja toimitettuna.'}
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* 🛒 KIINTEÄ ALAPALKKI JA MÄÄRÄVALITSIN (AINA NÄKYVISSÄ JA SELKEÄ) 🛒 */}
                        <View style={styles.modalFooter}>
                            <View style={styles.footerContentRow}>
                                {/* Määrälaskuri */}
                                <View style={styles.stepperContainer}>
                                    <TouchableOpacity
                                        style={styles.stepperBtn}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                            setModalQuantity(prev => Math.max(1, prev - 1));
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name="minus" size={15} color="#0F172A" />
                                    </TouchableOpacity>

                                    <Text style={styles.stepperValue}>{modalQuantity}</Text>

                                    <TouchableOpacity
                                        style={styles.stepperBtn}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                            setModalQuantity(prev => prev + 1);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name="plus" size={15} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                {/* Lisää koriin -pääpainike (tiivis, moderni ja selkeä) */}
                                <TouchableOpacity
                                    style={[styles.modalAddButton, modalAdded && styles.addedButton]}
                                    onPress={handleModalAdd}
                                    disabled={modalAdded}
                                    activeOpacity={0.88}
                                >
                                    <View style={styles.buttonContent}>
                                        <Feather name={modalAdded ? "check" : "shopping-bag"} size={17} color={COLORS.white} />
                                        <Text style={styles.modalAddButtonText} numberOfLines={1}>
                                            {modalAdded
                                                ? "Lisätty!"
                                                : `Lisää • ${(modalEffectivePrice * modalQuantity).toFixed(2).replace('.', ',')} €`}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
});

ServiceGrid.displayName = 'ServiceGrid';

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
    listContent: { paddingBottom: 20 },
    sectionContainer: {
        marginTop: 18,
        paddingHorizontal: 12,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textDark,
        letterSpacing: 0.2,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    filterWrapper: { paddingVertical: 12, marginTop: 4 },
    filterScroll: { paddingHorizontal: 16, gap: 14 },
    filterItem: {
        alignItems: 'center',
        minWidth: 74,
        paddingHorizontal: 2,
    },
    activeFilterItem: {
        transform: [{ scale: 1.03 }],
    },
    iconBox: {
        width: 54,
        height: 54,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    activeIconBox: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 4,
    },
    filterLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textDark,
        textAlign: 'center',
        marginTop: 6,
        letterSpacing: -0.2,
    },
    activeFilterLabel: {
        color: COLORS.primary,
        fontWeight: '800',
    },
    searchWrapper: {
        paddingHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textDark,
        paddingVertical: 0,
    },
    gridCard: {
        width: (SCREEN_WIDTH - 36) / 2,
        backgroundColor: COLORS.white,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        height: 120,
        position: 'relative',
        backgroundColor: '#F1F5F9',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    badgePill: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 194, 255, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        zIndex: 3,
    },
    discountBadgePill: {
        backgroundColor: '#FF3B30',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    cardBody: {
        padding: 12,
        justifyContent: 'space-between',
        flex: 1,
    },
    productTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textDark,
        lineHeight: 18,
        minHeight: 36,
        marginBottom: 2,
    },
    productSnippet: {
        fontSize: 11,
        color: COLORS.textGray,
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 6,
        gap: 4,
    },
    priceLabel: {
        fontSize: 10,
        color: COLORS.textGray,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    productPrice: {
        fontSize: 15,
        fontWeight: '900',
        color: COLORS.primary,
    },
    originalPriceText: {
        fontSize: 11,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
        fontWeight: '600',
    },
    discountPriceText: {
        color: '#E11D48',
    },
    cardAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    cardAddButtonSuccess: {
        backgroundColor: COLORS.success,
    },
    cardAddButtonText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '800',
    },
    modalRootOverlay: {
        flex: 1,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
    },
    modalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: SCREEN_HEIGHT * 0.88,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 30,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    modalImageContainer: {
        width: '100%',
        height: 270,
        position: 'relative',
        backgroundColor: '#0F172A',
    },
    modalImage: {
        width: '100%',
        height: '100%',
    },
    imageGradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 90,
    },
    floatingPullBarWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 25,
    },
    floatingPullBar: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    floatingCloseBtn: {
        position: 'absolute',
        top: 14,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 30,
    },
    floatingImageBadge: {
        position: 'absolute',
        bottom: 14,
        left: 16,
        backgroundColor: '#FF3B30',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 20,
    },
    floatingImageBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    modalTextContainer: {
        padding: 20,
        paddingTop: 18,
    },
    categoryBadgeRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.textDark,
        letterSpacing: -0.4,
        flex: 1,
        paddingRight: 10,
    },
    priceColumn: {
        alignItems: 'flex-end',
    },
    modalPrice: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0284C7',
        letterSpacing: -0.5,
    },
    modalOriginalPrice: {
        fontSize: 14,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
        fontWeight: '600',
        marginBottom: 2,
    },
    modalDiscountPrice: {
        color: '#E11D48',
    },
    perksRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 18,
    },
    perkChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 9,
        paddingHorizontal: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 5,
    },
    perkText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    descriptionCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    descHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalDescriptionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textGray,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    modalDescriptionText: {
        fontSize: 14,
        lineHeight: 22,
        color: '#334155',
        fontWeight: '500',
    },
    modalFooter: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
    },
    footerContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 3,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    stepperBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    stepperValue: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textDark,
        minWidth: 24,
        textAlign: 'center',
        marginHorizontal: 3,
    },
    modalAddButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    addedButton: {
        backgroundColor: COLORS.success,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    modalAddButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
    emptyText: { color: COLORS.textGray, marginTop: 10, fontSize: 14 },
    errorText: { color: '#E85D5D', textAlign: 'center', margin: 10 }
});

export default ServiceGrid;