import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Platform,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { AddEditTextileModal, SavedTextile } from '../../components/textiles/AddEditTextileModal';
import { supabase } from '../../lib/supabase';
import { addToCart } from '../../redux/cartSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_FILTERS = [
    { id: 'all', name: 'Kaikki' },
    { id: 'Matto', name: 'Matot' },
    { id: 'Puku / Juhlavaate', name: 'Puvut' },
    { id: 'Takki / Untuvatuote', name: 'Takit' },
    { id: 'Kodintekstiili / Verhot', name: 'Kodintekstiilit' },
    { id: 'Muu', name: 'Muut' },
];

export const CATEGORY_ICON_MAP: Record<string, string> = {
    'Matto': 'rug',
    'Puku / Juhlavaate': 'tshirt-crew',
    'Takki / Untuvatuote': 'jacket',
    'Kodintekstiili / Verhot': 'curtains',
    'Muu': 'tag-outline',
};

export const CATEGORY_STYLE_MAP: Record<string, { bg: string; color: string; icon: string }> = {
    'Matto': { bg: '#E0F2FE', color: '#0284C7', icon: 'rug' },
    'Puku / Juhlavaate': { bg: '#F3E8FF', color: '#9333EA', icon: 'tshirt-crew' },
    'Takki / Untuvatuote': { bg: '#FEF3C7', color: '#D97706', icon: 'jacket' },
    'Kodintekstiili / Verhot': { bg: '#DCFCE7', color: '#16A34A', icon: 'curtains' },
    'Muu': { bg: '#F1F5F9', color: '#475569', icon: 'tag-outline' },
};

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return null;
    }
};

export default function SavedTextilesScreen() {
    const router = useRouter();
    const dispatch = useDispatch();

    const [textiles, setTextiles] = useState<SavedTextile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [editingTextile, setEditingTextile] = useState<SavedTextile | null>(null);

    const [products, setProducts] = useState<any[]>([]);

    const fetchTextiles = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                setTextiles([]);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('customer_saved_textiles')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTextiles(data || []);

            // Haetaan myös tuotteet hintojen, linkityksen ja tallennuskonfiguraation mäppäystä varten
            const { data: prodData } = await supabase
                .from('products')
                .select('id, product_id, name, description, image_url, base_price, discount_price, allow_customer_save, saved_textile_config')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            setProducts(prodData || []);
        } catch (err: any) {
            console.error('Error fetching saved textiles:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTextiles();
        }, [fetchTextiles])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTextiles();
    };

    const handleSaveTextile = async (savedItem: SavedTextile) => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('Käyttäjää ei löydy');

        if (savedItem.id) {
            // Päivitä
            const { error } = await supabase
                .from('customer_saved_textiles')
                .update({
                    name: savedItem.name,
                    category: savedItem.category,
                    length_cm: savedItem.length_cm,
                    width_cm: savedItem.width_cm,
                    square_meters: savedItem.square_meters,
                    material: savedItem.material,
                    care_instructions: savedItem.care_instructions,
                    special_notes: savedItem.special_notes,
                    photo_url: savedItem.photo_url,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', savedItem.id);

            if (error) throw error;
        } else {
            // Lisää uusi
            const { error } = await supabase
                .from('customer_saved_textiles')
                .insert([{
                    user_id: user.id,
                    name: savedItem.name,
                    category: savedItem.category,
                    length_cm: savedItem.length_cm,
                    width_cm: savedItem.width_cm,
                    square_meters: savedItem.square_meters,
                    material: savedItem.material,
                    care_instructions: savedItem.care_instructions,
                    special_notes: savedItem.special_notes,
                    photo_url: savedItem.photo_url,
                }]);

            if (error) throw error;
        }

        await fetchTextiles();
    };

    const handleDeleteTextile = (item: SavedTextile) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        Alert.alert(
            'Poista tekstiili',
            `Haluatko varmasti poistaa tekstiilin "${item.name}" tallennetuista?`,
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Poista',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!item.id) return;
                            const { error } = await supabase
                                .from('customer_saved_textiles')
                                .delete()
                                .eq('id', item.id);
                            if (error) throw error;
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            setTextiles(prev => prev.filter(t => t.id !== item.id));
                        } catch (err: any) {
                            Alert.alert('Virhe', err?.message || 'Poisto epäonnistui');
                        }
                    }
                }
            ]
        );
    };

    const handleOrderWash = (item: SavedTextile) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

        // Etsitään sopiva virallinen tuote katalogista
        const matchedProduct = products.find(p =>
            (item.product_id && p.product_id === item.product_id) ||
            p.name.toLowerCase() === item.name.toLowerCase() ||
            (item.category === 'Matto' && (p.product_id === 'mattopesu' || p.name.toLowerCase().includes('matto'))) ||
            (item.category === 'Puku / Juhlavaate' && (p.product_id === 'standard-puku' || p.name.toLowerCase().includes('puku'))) ||
            (item.category === 'Takki / Untuvatuote' && (p.product_id === 'prod_untuvatakki' || p.name.toLowerCase().includes('takki'))) ||
            (item.category === 'Kodintekstiili / Verhot' && (p.product_id === 'verhopesu' || p.name.toLowerCase().includes('verho')))
        );

        // Virallinen tuotenimi (esim. "Mattopesu" tai "Standard Puku"), jotta pesulalle ja kassalle menee oikea tuote
        const officialProductName = matchedProduct?.name || (item.category === 'Matto' ? 'Mattopesu' : item.category);
        const pId = matchedProduct?.product_id || item.product_id || 'mattopesu';
        const price = Number(matchedProduct?.discount_price || matchedProduct?.base_price || (item.category === 'Matto' ? 60 : 45));

        dispatch(addToCart({
            id: pId,
            name: officialProductName,
            price: price,
            quantity: 1,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
            'Tuote lisätty ostoskoriin! 🧺',
            `"${officialProductName}" (${item.name}) on lisätty ostoskoriin. Haluatko siirtyä suoraan kassalle vai jatkaa selaamista?`,
            [
                { text: 'Jatka selaamista', style: 'cancel' },
                {
                    text: 'Siirry kassalle',
                    style: 'default',
                    onPress: () => router.push('/checkout')
                }
            ]
        );
    };

    const filteredTextiles = useMemo(() => {
        return textiles.filter(t => {
            const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
            const matchesSearch = !searchQuery.trim() ||
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.material && t.material.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.special_notes && t.special_notes.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [textiles, selectedCategory, searchQuery]);

    const renderTextileCard = ({ item }: { item: SavedTextile }) => {
        const catStyle = CATEGORY_STYLE_MAP[item.category] || { bg: '#E0F7FF', color: '#00C2FF', icon: 'tag-outline' };
        const formattedWashDate = formatDate(item.last_washed_at);

        // Etsitään linkitetty tuote kuvaa varten
        const matchedProduct = products.find(p =>
            (item.product_id && p.product_id === item.product_id) ||
            p.name.toLowerCase() === item.name.toLowerCase() ||
            (item.category === 'Matto' && (p.product_id === 'mattopesu' || p.name.toLowerCase().includes('matto'))) ||
            (item.category === 'Puku / Juhlavaate' && (p.product_id === 'standard-puku' || p.name.toLowerCase().includes('puku'))) ||
            (item.category === 'Takki / Untuvatuote' && (p.product_id === 'prod_untuvatakki' || p.name.toLowerCase().includes('takki'))) ||
            (item.category === 'Kodintekstiili / Verhot' && (p.product_id === 'verhopesu' || p.name.toLowerCase().includes('verho')))
        );

        const displayImageUrl = item.photo_url || matchedProduct?.image_url;

        return (
            <View style={styles.card}>
                {/* KORTIN YLÄOSA: KUVA/IKONI, NIMI, KATEGORIA, MENU */}
                <View style={styles.cardHeader}>
                    <View style={[styles.cardIconBox, !displayImageUrl && { backgroundColor: catStyle.bg }]}>
                        {displayImageUrl ? (
                            <Image
                                source={{ uri: displayImageUrl }}
                                style={styles.cardThumbnail}
                                contentFit="cover"
                                transition={150}
                            />
                        ) : (
                            <MaterialCommunityIcons name={catStyle.icon as any} size={28} color={catStyle.color} />
                        )}
                    </View>

                    <View style={styles.cardHeaderText}>
                        <View style={styles.titleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                                {item.name}
                            </Text>
                        </View>
                        <View style={styles.categoryBadgeRow}>
                            <View style={styles.catBadge}>
                                <Text style={styles.catBadgeText}>{item.category}</Text>
                            </View>
                            {item.square_meters && (
                                <View style={styles.dimBadge}>
                                    <Text style={styles.dimBadgeText}>{item.length_cm} × {item.width_cm} cm ({item.square_meters} m²)</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* 3-PISTEEN TOIMINNOT */}
                    <TouchableOpacity
                        style={styles.cardMenuBtn}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            Alert.alert(
                                item.name,
                                'Valitse toiminto:',
                                [
                                    {
                                        text: 'Muokkaa tietoja',
                                        onPress: () => {
                                            setEditingTextile(item);
                                            setModalVisible(true);
                                        }
                                    },
                                    {
                                        text: 'Poista tekstiili',
                                        style: 'destructive',
                                        onPress: () => handleDeleteTextile(item)
                                    },
                                    { text: 'Peruuta', style: 'cancel' }
                                ]
                            );
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Feather name="more-vertical" size={18} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* MATERIAALI, VÄRI JA HOITO-OHJEET */}
                {(item.material || item.color || item.care_instructions) && (
                    <View style={styles.tagsContainer}>
                        {item.color && (
                            <View style={[styles.infoPill, { backgroundColor: '#FDF4FF', borderColor: '#F0ABFC' }]}>
                                <MaterialCommunityIcons name="palette-outline" size={12} color="#C026D3" style={{ marginRight: 4 }} />
                                <Text style={[styles.infoPillText, { color: '#C026D3' }]}>{item.color}</Text>
                            </View>
                        )}
                        {item.material && (
                            <View style={styles.infoPill}>
                                <Feather name="tag" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                                <Text style={styles.infoPillText}>{item.material}</Text>
                            </View>
                        )}
                        {item.care_instructions && (
                            <View style={[styles.infoPill, styles.carePill]}>
                                <MaterialCommunityIcons name="information-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                                <Text style={styles.carePillText}>{item.care_instructions}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ERIKOISTOIVEET / TAHRAT */}
                {item.special_notes && (
                    <View style={styles.notesBox}>
                        <Feather name="file-text" size={12} color="#94A3B8" style={{ marginRight: 6, marginTop: 2 }} />
                        <Text style={styles.notesText} numberOfLines={2}>
                            {item.special_notes}
                        </Text>
                    </View>
                )}

                {/* KORTIN ALAOSA: PESUHISTORIA & TILAA PESU -PAINIKE */}
                <View style={styles.cardFooter}>
                    <View style={styles.washHistoryBox}>
                        <MaterialCommunityIcons
                            name={formattedWashDate ? "check-decagram" : "history"}
                            size={16}
                            color={formattedWashDate ? "#059669" : "#94A3B8"}
                            style={{ marginRight: 5 }}
                        />
                        <Text style={[styles.washHistoryText, formattedWashDate && styles.washHistoryTextDone]}>
                            {formattedWashDate ? `Pesty ${formattedWashDate}` : 'Ei vielä pesty'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.orderCtaBtn}
                        activeOpacity={0.82}
                        onPress={() => handleOrderWash(item)}
                    >
                        <Feather name="shopping-bag" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.orderCtaBtnText}>Tilaa pesu</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.navBar}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>

                <View style={styles.navTitleContainer}>
                    <Text style={styles.navTitle}>Omat tekstiilit</Text>
                    <Text style={styles.navSubtitle}>
                        {textiles.length} {textiles.length === 1 ? 'tallennettu tekstiili' : 'tallennettua tekstiiliä'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.addNavBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setEditingTextile(null);
                        setModalVisible(true);
                    }}
                >
                    <Feather name="plus" size={18} color="#FFFFFF" />
                    <Text style={styles.addNavBtnText}>Uusi</Text>
                </TouchableOpacity>
            </View>

            {/* HAKUPALKKI */}
            {textiles.length > 0 && (
                <View style={styles.searchWrap}>
                    <View style={styles.searchBar}>
                        <Feather name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Etsi tekstiilejä tai materiaalia..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Feather name="x" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {/* KATEGORIAPYSÄKIT */}
            {textiles.length > 0 && (
                <View style={styles.categoriesBar}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={CATEGORY_FILTERS}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.categoryListContent}
                        renderItem={({ item }) => {
                            const active = selectedCategory === item.id;
                            return (
                                <TouchableOpacity
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                        setSelectedCategory(item.id);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}

            {/* PÄÄSISÄLTÖ */}
            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#00C2FF" />
                    <Text style={styles.loadingText}>Ladataan tekstiilejäsi...</Text>
                </View>
            ) : filteredTextiles.length > 0 ? (
                <FlatList
                    data={filteredTextiles}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderTextileCard}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#00C2FF']} />
                    }
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBox}>
                        <MaterialCommunityIcons name="hanger" size={48} color="#00C2FF" />
                    </View>
                    <Text style={styles.emptyTitle}>Ei vielä tallennettuja tekstiilejä</Text>
                    <Text style={styles.emptyDescription}>
                        Tallenna mattojesi mitat ja lempivaatteesi, niin tilaat pesun seuraavalla kerralla yhdellä klikkauksella!
                    </Text>

                    <TouchableOpacity
                        style={styles.emptyAddBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            setEditingTextile(null);
                            setModalVisible(true);
                        }}
                    >
                        <Feather name="plus-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.emptyAddBtnText}>Lisää ensimmäinen tekstiili</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* LISÄYS/MUOKKAUSMODAALI */}
            <AddEditTextileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveTextile}
                initialData={editingTextile}
                products={products}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },
    navTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    navSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    addNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C2FF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 4,
    },
    addNavBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    searchWrap: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: '#FFFFFF',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        padding: 0,
    },
    categoriesBar: {
        backgroundColor: '#FFFFFF',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    categoryListContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#475569',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    listContent: {
        padding: 16,
        gap: 14,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardIconBox: {
        width: 54,
        height: 54,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardThumbnail: {
        width: '100%',
        height: '100%',
    },
    cardHeaderText: {
        flex: 1,
        marginLeft: 12,
        marginRight: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    categoryBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    catBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    catBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    dimBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dimBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#059669',
    },
    cardMenuBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    infoPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0284C7',
    },
    carePill: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
    },
    carePillText: {
        fontSize: 11,
        color: '#475569',
    },
    notesBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    notesText: {
        flex: 1,
        fontSize: 12,
        color: '#64748B',
        lineHeight: 16,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    washHistoryBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    washHistoryText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    washHistoryTextDone: {
        color: '#059669',
        fontWeight: '600',
    },
    orderCtaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C2FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    orderCtaBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748B',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        marginTop: 60,
    },
    emptyIconBox: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#E0F7FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C2FF',
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 14,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyAddBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
