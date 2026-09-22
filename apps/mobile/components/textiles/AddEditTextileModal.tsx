import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FALLBACK_IMAGE = { uri: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&q=80&w=600' };

export interface SavedTextile {
    id?: string;
    user_id?: string;
    product_id?: string | null;
    name: string;
    category: string;
    length_cm?: number | null;
    width_cm?: number | null;
    square_meters?: number | null;
    material?: string | null;
    color?: string | null;
    care_instructions?: string | null;
    special_notes?: string | null;
    photo_url?: string | null;
    last_washed_at?: string | null;
    total_washes_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ProductItem {
    id: string;
    product_id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    base_price: number;
    discount_price?: number | null;
    allow_customer_save?: boolean;
    saved_textile_config?: {
        requires_dimensions?: boolean;
        allows_material?: boolean;
        allows_color?: boolean;
        allows_photo?: boolean;
        allows_care_instructions?: boolean;
        allows_notes?: boolean;
    };
}

interface AddEditTextileModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (textile: SavedTextile) => Promise<void>;
    initialData?: SavedTextile | null;
    products?: ProductItem[];
}

const MATERIAL_PRESETS = ['100% Villa', 'Puuvilla', 'Silkki', 'Viskoosi', 'Synteettinen / Polyesteri', 'Juutti / Sisal', 'Nahka'];
const COLOR_PRESETS = [
    { name: 'Musta', hex: '#0F172A' },
    { name: 'Valkoinen', hex: '#F8FAFC', border: true },
    { name: 'Harmaa', hex: '#64748B' },
    { name: 'Beige', hex: '#D7C4B7' },
    { name: 'Sininen', hex: '#2563EB' },
    { name: 'Vihreä', hex: '#16A34A' },
    { name: 'Punainen', hex: '#DC2626' },
];

export function AddEditTextileModal({
    visible,
    onClose,
    onSave,
    initialData,
    products = [],
}: AddEditTextileModalProps) {
    const isEditing = !!initialData?.id;

    // Vaiheenhallinta: 1 = Tuotteen valinta, 2 = Tekstiilin tarkennus
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
    const [productSearch, setProductSearch] = useState('');

    // Lomakekentät (Vaihe 2)
    const [name, setName] = useState('');
    const [lengthCm, setLengthCm] = useState('');
    const [widthCm, setWidthCm] = useState('');
    const [material, setMaterial] = useState('');
    const [color, setColor] = useState('');
    const [careInstructions, setCareInstructions] = useState('');
    const [specialNotes, setSpecialNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Suodatetaan vain ne tuotteet, jotka ylläpitäjä on sallinut tallennettaviksi
    const savableProducts = useMemo(() => {
        const list = products.filter(p => p.allow_customer_save !== false);
        if (!productSearch.trim()) return list;
        const q = productSearch.toLowerCase();
        return list.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }, [products, productSearch]);

    // Alustetaan tiedot kun modaali avataan tai initialData vaihtuu
    useEffect(() => {
        if (visible) {
            if (initialData) {
                // Muokkaustila -> hypätään suoraan vaiheeseen 2
                setStep(2);
                setName(initialData.name || '');
                setLengthCm(initialData.length_cm ? String(initialData.length_cm) : '');
                setWidthCm(initialData.width_cm ? String(initialData.width_cm) : '');
                setMaterial(initialData.material || '');
                setColor(initialData.color || '');
                setCareInstructions(initialData.care_instructions || '');
                setSpecialNotes(initialData.special_notes || '');

                const matched = products.find(p => p.product_id === initialData.product_id || p.name === initialData.name);
                setSelectedProduct(matched || null);
            } else {
                // Lisäystila -> aloitetaan vaiheesta 1 (tuotevalinta)
                setStep(1);
                setName('');
                setLengthCm('');
                setWidthCm('');
                setMaterial('');
                setColor('');
                setCareInstructions('');
                setSpecialNotes('');
                setSelectedProduct(null);
                setProductSearch('');
            }
        }
    }, [visible, initialData, products]);

    // Lasketaan automaattinen pinta-ala neliömetreinä
    const calculatedSquareMeters = useMemo(() => {
        const l = parseFloat(lengthCm.replace(',', '.'));
        const w = parseFloat(widthCm.replace(',', '.'));
        if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
            return ((l * w) / 10000).toFixed(2);
        }
        return null;
    }, [lengthCm, widthCm]);

    // Haetaan valitun tuotteen ylläpitäjäkonfiguraatio
    const config = useMemo(() => {
        const base = selectedProduct?.saved_textile_config || {};
        const isRug = selectedProduct?.name?.toLowerCase().includes('matto') ||
                      selectedProduct?.product_id === 'mattopesu' ||
                      initialData?.category === 'Matto';

        return {
            requires_dimensions: base.requires_dimensions ?? isRug,
            allows_material: base.allows_material ?? true,
            allows_color: base.allows_color ?? true,
            allows_care_instructions: base.allows_care_instructions ?? true,
            allows_notes: base.allows_notes ?? true,
        };
    }, [selectedProduct, initialData]);

    const handleSelectProduct = (prod: ProductItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedProduct(prod);
        if (!name.trim()) {
            setName(prod.name);
        }
        setStep(2);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Nimi puuttuu', 'Anna tekstiilille oma kuvaava nimi (esim. "Olohuoneen villamatto").');
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

        try {
            const lNum = lengthCm ? parseFloat(lengthCm.replace(',', '.')) : null;
            const wNum = widthCm ? parseFloat(widthCm.replace(',', '.')) : null;
            const sqM = calculatedSquareMeters ? parseFloat(calculatedSquareMeters) : null;

            // Päätellään kategoria valitusta tuotteesta
            let category = 'Muu';
            const prodName = (selectedProduct?.name || name).toLowerCase();
            if (prodName.includes('matto')) category = 'Matto';
            else if (prodName.includes('puku') || prodName.includes('juhla')) category = 'Puku / Juhlavaate';
            else if (prodName.includes('takki') || prodName.includes('untuva')) category = 'Takki / Untuvatuote';
            else if (prodName.includes('verho') || prodName.includes('peitto') || prodName.includes('lakana') || prodName.includes('tyyny')) category = 'Kodintekstiili / Verhot';

            const payload: SavedTextile = {
                ...(initialData?.id ? { id: initialData.id } : {}),
                name: name.trim(),
                category,
                product_id: selectedProduct?.product_id || initialData?.product_id || null,
                length_cm: !isNaN(lNum as number) ? lNum : null,
                width_cm: !isNaN(wNum as number) ? wNum : null,
                square_meters: sqM,
                material: material.trim() || null,
                color: color.trim() || null,
                care_instructions: careInstructions.trim() || null,
                special_notes: specialNotes.trim() || null,
                photo_url: initialData?.photo_url || null,
            };

            await onSave(payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onClose();
        } catch (err: any) {
            Alert.alert('Virhe', err?.message || 'Tallennus epäonnistui.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.container}
            >
                {/* YLÄPALKKI */}
                <View style={styles.header}>
                    {step === 2 && !isEditing ? (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setStep(1);
                            }}
                            style={styles.backStepBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="arrow-left" size={20} color="#0F172A" />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 36 }} />
                    )}

                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>
                            {isEditing ? 'Muokkaa tekstiiliä' : step === 1 ? 'Valitse tuote' : 'Tekstiilin tiedot'}
                        </Text>
                        {!isEditing && (
                            <Text style={styles.headerSubtitle}>
                                Vaihe {step} / 2
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Feather name="x" size={20} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* VAIHE 1: TUOTTEEN VALINTA */}
                {step === 1 && (
                    <View style={styles.stepOneContainer}>
                        {/* HAKUKENTTÄ */}
                        <View style={styles.searchBarBox}>
                            <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Etsi tuotteista (esim. matto, puku, takki)..."
                                placeholderTextColor="#94A3B8"
                                value={productSearch}
                                onChangeText={setProductSearch}
                                clearButtonMode="while-editing"
                            />
                        </View>

                        <Text style={styles.sectionHeaderTitle}>
                            Minkä tekstiilin haluat tallentaa?
                        </Text>

                        <ScrollView
                            contentContainerStyle={styles.productListGrid}
                            showsVerticalScrollIndicator={false}
                        >
                            {savableProducts.map(prod => {
                                const priceVal = Number(prod.discount_price || prod.base_price || 0);
                                return (
                                    <TouchableOpacity
                                        key={prod.id || prod.product_id}
                                        style={styles.prodCard}
                                        activeOpacity={0.82}
                                        onPress={() => handleSelectProduct(prod)}
                                    >
                                        <Image
                                            source={prod.image_url ? { uri: prod.image_url } : FALLBACK_IMAGE}
                                            style={styles.prodImage}
                                            contentFit="cover"
                                            transition={150}
                                        />
                                        <View style={styles.prodInfo}>
                                            <Text style={styles.prodName} numberOfLines={2}>{prod.name}</Text>
                                            {priceVal > 0 && (
                                                <Text style={styles.prodPrice}>alk. {priceVal.toFixed(2).replace('.', ',')} €</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                            {savableProducts.length === 0 && (
                                <View style={styles.emptySearchBox}>
                                    <MaterialCommunityIcons name="magnify-close" size={40} color="#CBD5E1" />
                                    <Text style={styles.emptySearchText}>Ei hakua vastaavia tuotteita.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* VAIHE 2: TIETOJEN TARKENNUS */}
                {step === 2 && (
                    <View style={styles.body}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* VALITUN TUOTTEEN TIIVISTELMÄ */}
                            {selectedProduct && (
                                <View style={styles.selectedProductBanner}>
                                    <Image
                                        source={selectedProduct.image_url ? { uri: selectedProduct.image_url } : FALLBACK_IMAGE}
                                        style={styles.selectedProdThumb}
                                        contentFit="cover"
                                    />
                                    <View style={styles.selectedProdInfo}>
                                        <Text style={styles.selectedProdName}>{selectedProduct.name}</Text>
                                        <Text style={styles.selectedProdPrice}>
                                            Pesuhinta alk. {Number(selectedProduct.discount_price || selectedProduct.base_price).toFixed(2).replace('.', ',')} €
                                        </Text>
                                    </View>
                                    {!isEditing && (
                                        <TouchableOpacity
                                            style={styles.changeProdBtn}
                                            onPress={() => setStep(1)}
                                        >
                                            <Text style={styles.changeProdBtnText}>Vaihda</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* 1. TEKSTIILIN NIMI */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Tekstiilin oma lempinimi / tunniste *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Esim. Olohuoneen villamatto, Musta juhlapuku..."
                                    placeholderTextColor="#94A3B8"
                                    value={name}
                                    onChangeText={setName}
                                    maxLength={80}
                                />
                                <Text style={styles.helperText}>
                                    Tämä oma nimesi näkyy Omat tekstiilit -listallasi. Tilaukseen ja pesulalle kirjataan aina virallinen tuotenimi ({selectedProduct?.name || 'Tuote'}).
                                </Text>
                            </View>

                            {/* 2. MITAT JA KAMERAMITTAUS (JOS AKTIVOITU TÄLLE TUOTTEELLE) */}
                            {config.requires_dimensions && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text style={styles.sectionLabel}>Mitat (cm) *</Text>
                                        {calculatedSquareMeters && (
                                            <View style={styles.areaBadge}>
                                                <MaterialCommunityIcons name="calculator" size={14} color="#059669" style={{ marginRight: 4 }} />
                                                <Text style={styles.areaBadgeText}>Pinta-ala: {calculatedSquareMeters} m²</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.dimRow}>
                                        <View style={styles.dimCol}>
                                            <Text style={styles.dimLabel}>Pituus (cm)</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. 200"
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="numeric"
                                                value={lengthCm}
                                                onChangeText={setLengthCm}
                                                maxLength={6}
                                            />
                                        </View>
                                        <Text style={styles.dimMultiply}>×</Text>
                                        <View style={styles.dimCol}>
                                            <Text style={styles.dimLabel}>Leveys (cm)</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Esim. 300"
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="numeric"
                                                value={widthCm}
                                                onChangeText={setWidthCm}
                                                maxLength={6}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* 3. VÄRI (JOS SALLITTU) */}
                            {config.allows_color && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Väri</Text>
                                    <View style={styles.presetColorRow}>
                                        {COLOR_PRESETS.map((c, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.colorChip,
                                                    { backgroundColor: c.hex },
                                                    c.border && { borderWidth: 1, borderColor: '#CBD5E1' },
                                                    color.toLowerCase() === c.name.toLowerCase() && styles.colorChipActive,
                                                ]}
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                                    setColor(c.name);
                                                }}
                                            >
                                                {color.toLowerCase() === c.name.toLowerCase() && (
                                                    <Feather
                                                        name="check"
                                                        size={14}
                                                        color={c.name === 'Valkoinen' || c.name === 'Beige' ? '#0F172A' : '#FFFFFF'}
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput
                                        style={[styles.input, { marginTop: 8 }]}
                                        placeholder="Tai kirjoita väri (esim. Tummanharmaa)..."
                                        placeholderTextColor="#94A3B8"
                                        value={color}
                                        onChangeText={setColor}
                                        maxLength={40}
                                    />
                                </View>
                            )}

                            {/* 4. MATERIAALI (JOS SALLITTU) */}
                            {config.allows_material && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Materiaali</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                                        {MATERIAL_PRESETS.map((m, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.presetChip,
                                                    material === m && styles.presetChipActive,
                                                ]}
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                                    setMaterial(m);
                                                }}
                                            >
                                                <Text style={[styles.presetChipText, material === m && styles.presetChipTextActive]}>
                                                    {m}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <TextInput
                                        style={[styles.input, { marginTop: 8 }]}
                                        placeholder="Muu materiaali (esim. 80% Villa, 20% Pellava)..."
                                        placeholderTextColor="#94A3B8"
                                        value={material}
                                        onChangeText={setMaterial}
                                        maxLength={60}
                                    />
                                </View>
                            )}

                            {/* 5. PESUMERKINNÄT (JOS SALLITTU) */}
                            {config.allows_care_instructions && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Pesumerkinnät / Huomiot</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Esim. Vain tasovesipesu, Kemiallinen pesu P, Ei rumpukuivausta..."
                                        placeholderTextColor="#94A3B8"
                                        value={careInstructions}
                                        onChangeText={setCareInstructions}
                                        maxLength={100}
                                    />
                                </View>
                            )}

                            {/* 6. TAHRAT & ERITYISTOIVEET (JOS SALLITTU) */}
                            {config.allows_notes && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Tahrat & Toiveet pesulalle</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Esim. Kahvitahra oikeassa reunassa, toivotaan hajusteetonta pesua..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        numberOfLines={3}
                                        value={specialNotes}
                                        onChangeText={setSpecialNotes}
                                        maxLength={300}
                                    />
                                </View>
                            )}
                        </ScrollView>

                        {/* TALLENNA-PAINIKE */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                                activeOpacity={0.88}
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Feather name="check" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveBtnText}>
                                            {isEditing ? 'Tallenna muutokset' : 'Tallenna tekstiili'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
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
        paddingTop: Platform.OS === 'ios' ? 16 : 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    backStepBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: '600',
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // VAIHE 1 TYYLIT
    stepOneContainer: {
        flex: 1,
        padding: 16,
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 14,
    },
    productListGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingBottom: 24,
    },
    prodCard: {
        width: (SCREEN_WIDTH - 32 - 12) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    prodImage: {
        width: '100%',
        height: 110,
        backgroundColor: '#F1F5F9',
    },
    prodInfo: {
        padding: 10,
    },
    prodName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
        minHeight: 34,
    },
    prodPrice: {
        fontSize: 12,
        fontWeight: '600',
        color: '#00C2FF',
        marginTop: 4,
    },
    emptySearchBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 10,
        width: '100%',
    },
    emptySearchText: {
        fontSize: 14,
        color: '#94A3B8',
    },
    // VAIHE 2 TYYLIT
    body: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    selectedProductBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 14,
        padding: 10,
        marginBottom: 18,
    },
    selectedProdThumb: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#E0F2FE',
    },
    selectedProdInfo: {
        flex: 1,
        marginLeft: 10,
    },
    selectedProdName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    selectedProdPrice: {
        fontSize: 12,
        color: '#0284C7',
        fontWeight: '600',
    },
    changeProdBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    changeProdBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0284C7',
    },
    section: {
        marginBottom: 18,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
    },
    helperText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 4,
        lineHeight: 15,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    dimRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dimCol: {
        flex: 1,
    },
    dimLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
        fontWeight: '500',
    },
    dimMultiply: {
        fontSize: 18,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 20,
    },
    areaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    areaBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#15803D',
    },
    presetColorRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 4,
    },
    colorChip: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorChipActive: {
        transform: [{ scale: 1.15 }],
        borderWidth: 2,
        borderColor: '#00C2FF',
    },
    presetScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    presetChip: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    presetChipActive: {
        backgroundColor: '#00C2FF',
        borderColor: '#00C2FF',
    },
    presetChipText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    presetChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    footer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    saveBtn: {
        backgroundColor: '#00C2FF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
