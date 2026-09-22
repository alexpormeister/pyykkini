import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface AppBanner {
    id?: string;
    title: string;
    subtitle: string;
    badge_text: string;
    image_url?: string | null;
    product_id?: string | null;
    button_text?: string;
    is_active?: boolean;
    sort_order?: number;
}

interface BannerWithProduct {
    banner: AppBanner;
    product?: any | null;
}

const MascotImage = require('../../assets/images/3dglossy-logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const AUTO_SCROLL_INTERVAL = 4500;

interface HeroBannerProps {
    onOpenDetail: (product: any) => void;
}

const HeroBanner: React.FC<HeroBannerProps> = ({ onOpenDetail }) => {
    const [banners, setBanners] = useState<BannerWithProduct[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const autoScrollTimer = useRef<any>(null);
    const activeIndexRef = useRef(0);

    const startAutoScroll = (totalItems: number) => {
        if (totalItems <= 1) return;
        stopAutoScroll();
        autoScrollTimer.current = setInterval(() => {
            const nextIndex = (activeIndexRef.current + 1) % totalItems;
            activeIndexRef.current = nextIndex;
            setActiveIndex(nextIndex);
            flatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true,
            });
        }, AUTO_SCROLL_INTERVAL);
    };

    const stopAutoScroll = () => {
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
            autoScrollTimer.current = null;
        }
    };

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const { data: bannersData, error } = await supabase
                    .from('app_banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (error || !bannersData || bannersData.length === 0) {
                    setBanners([]);
                    stopAutoScroll();
                    return;
                }

                const productIds = bannersData
                    .map((b) => b.product_id)
                    .filter((id): id is string => Boolean(id));

                let productsMap: Record<string, any> = {};
                if (productIds.length > 0) {
                    const { data: productsData } = await supabase
                        .from('products')
                        .select('product_id, name, base_price, discount_price, description, image_url')
                        .in('product_id', productIds);

                    if (productsData) {
                        productsMap = productsData.reduce((acc, p) => {
                            acc[p.product_id] = p;
                            return acc;
                        }, {} as Record<string, any>);
                    }
                }

                const combined: BannerWithProduct[] = bannersData.map((banner) => ({
                    banner,
                    product: banner.product_id ? productsMap[banner.product_id] || null : null,
                }));

                // Esiladataan bannerikuvat välimuistiin salamannopeaa näyttöä varten
                const imagesToPrefetch = combined
                    .map(b => b.banner.image_url || b.product?.image_url)
                    .filter((url): url is string => Boolean(url));
                if (imagesToPrefetch.length > 0) {
                    Image.prefetch(imagesToPrefetch);
                }

                setBanners(combined);
                activeIndexRef.current = 0;
                setActiveIndex(0);
                startAutoScroll(combined.length);
            } catch (err) {
                console.warn('Virhe HeroBanner karusellin haussa:', err);
                setBanners([]);
            }
        };

        fetchBanners();

        const channel = supabase
            .channel('app-banners-carousel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_banners' },
                () => {
                    fetchBanners();
                }
            )
            .subscribe();

        return () => {
            stopAutoScroll();
            supabase.removeChannel(channel);
        };
    }, []);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollOffset = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollOffset / (CARD_WIDTH + 12));
        if (index >= 0 && index < banners.length && index !== activeIndex) {
            setActiveIndex(index);
            activeIndexRef.current = index;
        }
    };

    if (banners.length === 0) {
        return null;
    }

    const renderBannerItem = ({ item }: { item: BannerWithProduct }) => {
        const { banner, product } = item;
        const bannerImageUri = banner.image_url || product?.image_url;
        const priceText = product?.base_price ? `alk. ${product.base_price} €` : '';

        const handlePress = () => {
            const productToShow = {
                product_id: product?.product_id || banner.product_id || banner.id,
                name: product?.name || banner.title,
                base_price: product?.base_price || 0,
                discount_price: product?.discount_price,
                description: product?.description || banner.subtitle,
                image_url: bannerImageUri,
                badge_text: banner.badge_text,
            };

            if (onOpenDetail) {
                onOpenDetail(productToShow);
            }
        };

        return (
            <TouchableOpacity
                style={styles.cardTouch}
                activeOpacity={0.92}
                onPress={handlePress}
            >
                <LinearGradient
                    colors={['#5CD1FF', '#00C2FF', '#0099FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientCard}
                >
                    <View style={styles.glowCircle1} />
                    <View style={styles.glowCircle2} />

                    <View style={styles.contentLeft}>
                        {banner.badge_text ? (
                            <View style={styles.badgePill}>
                                <Text style={styles.badgeText}>{banner.badge_text}</Text>
                            </View>
                        ) : null}

                        <Text style={styles.title} numberOfLines={2}>
                            {banner.title}
                        </Text>
                        {banner.subtitle ? (
                            <Text style={styles.subtitle} numberOfLines={2}>
                                {banner.subtitle}
                            </Text>
                        ) : null}

                        <View style={styles.actionRow}>
                            {priceText ? <Text style={styles.priceTag}>{priceText}</Text> : null}
                            <View style={styles.viewBadge}>
                                <Text style={styles.viewBadgeText}>Avaa tiedot</Text>
                                <Feather name="chevron-right" size={14} color="#FFFFFF" />
                            </View>
                        </View>
                    </View>

                    <View style={styles.imageWrapper}>
                        <Image
                            source={bannerImageUri ? { uri: bannerImageUri } : MascotImage}
                            style={styles.mascotImage}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                            priority="high"
                            transition={150}
                        />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.wrapper}>
            <FlatList
                ref={flatListRef}
                data={banners}
                keyExtractor={(item) => item.banner.id || item.banner.title}
                renderItem={renderBannerItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                decelerationRate="fast"
                snapToAlignment="start"
                contentContainerStyle={styles.listContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onTouchStart={stopAutoScroll}
                onTouchEnd={() => startAutoScroll(banners.length)}
                onScrollBeginDrag={stopAutoScroll}
                onScrollEndDrag={() => startAutoScroll(banners.length)}
                getItemLayout={(_, index) => ({
                    length: CARD_WIDTH + 12,
                    offset: (CARD_WIDTH + 12) * index,
                    index,
                })}
            />

            {banners.length > 1 && (
                <View style={styles.dotsRow}>
                    {banners.map((_, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                    stopAutoScroll();
                                    setActiveIndex(idx);
                                    activeIndexRef.current = idx;
                                    flatListRef.current?.scrollToIndex({
                                        index: idx,
                                        animated: true,
                                    });
                                    startAutoScroll(banners.length);
                                }}
                                style={[styles.dot, isActive && styles.activeDot]}
                            />
                        );
                    })}
                </View>
            )}
        </View>
    );
};

export default HeroBanner;

const styles = StyleSheet.create({
    wrapper: {
        marginTop: 14,
        marginBottom: 6,
    },
    listContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    cardTouch: {
        width: CARD_WIDTH,
    },
    gradientCard: {
        borderRadius: 24,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 5,
        minHeight: 145,
    },
    glowCircle1: {
        position: 'absolute',
        top: -40,
        right: -20,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    glowCircle2: {
        position: 'absolute',
        bottom: -50,
        left: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    contentLeft: {
        flex: 1,
        paddingRight: 8,
        zIndex: 2,
    },
    badgePill: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 24,
        marginBottom: 4,
        textShadowColor: 'rgba(0, 40, 95, 0.4)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#F0F9FF',
        lineHeight: 16,
        marginBottom: 12,
        textShadowColor: 'rgba(0, 40, 95, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    priceTag: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    viewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    viewBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        marginRight: 2,
        textShadowColor: 'rgba(0, 40, 95, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    imageWrapper: {
        width: 85,
        height: 85,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    mascotImage: {
        width: 85,
        height: 85,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#CBD5E1',
    },
    activeDot: {
        width: 18,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00C2FF',
    },
});
