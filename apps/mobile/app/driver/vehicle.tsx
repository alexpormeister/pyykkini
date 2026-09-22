import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const DRIVER_VEHICLE_KEY = 'pesuni_driver_vehicle_info';

// 1. AJONEUVOTYYPIT (3 vaihtoehtoa)
const VEHICLE_TYPES = [
    { id: 'van', label: 'Pakettiauto', icon: 'truck' },
    { id: 'estate', label: 'Farmari', icon: 'box' },
    { id: 'car', label: 'Henkilöauto', icon: 'navigation' },
];

// 2. KÄYTTÖVOIMAT (5 vaihtoehtoa)
const FUEL_TYPES = [
    { id: 'electric', label: 'Sähkö', icon: 'zap' },
    { id: 'hybrid', label: 'Hybridi', icon: 'cpu' },
    { id: 'petrol', label: 'Bensiini', icon: 'droplet' },
    { id: 'diesel', label: 'Diesel', icon: 'disc' },
    { id: 'gas', label: 'Kaasu', icon: 'wind' },
];

// 3. STANDARDOIDUT AJONEUVOVÄRIT
const VEHICLE_COLORS = [
    { id: 'white', label: 'Valkoinen', hex: '#FFFFFF', border: '#CBD5E1' },
    { id: 'black', label: 'Musta', hex: '#0F172A', border: '#0F172A' },
    { id: 'silver', label: 'Hopea / Harmaa', hex: '#94A3B8', border: '#94A3B8' },
    { id: 'blue', label: 'Sininen', hex: '#0284C7', border: '#0284C7' },
    { id: 'red', label: 'Punainen', hex: '#EF4444', border: '#EF4444' },
    { id: 'yellow', label: 'Keltainen', hex: '#EAB308', border: '#EAB308' },
    { id: 'green', label: 'Vihreä', hex: '#10B981', border: '#10B981' },
    { id: 'brown', label: 'Ruskea', hex: '#78350F', border: '#78350F' },
    { id: 'orange', label: 'Oranssi', hex: '#F97316', border: '#F97316' },
    { id: 'other', label: 'Muu väri', hex: '#64748B', border: '#64748B' },
];

// 4. STANDARDOITU SUOMEN MERKKI- JA MALLIKANTA (Nopea paikalliskanta)
export const CAR_DATABASE: Record<string, string[]> = {
    'Mercedes-Benz': [
        'Vito', 'Sprinter', 'Citan', 'eVito', 'eSprinter', 'EQV',
        'C-sarja', 'E-sarja', 'EQB', 'EQE', 'EQS', 'GLC', 'GLE', 'A-sarja', 'B-sarja', 'CLA'
    ],
    'Volkswagen': [
        'Transporter', 'Caddy', 'Crafter', 'ID. Buzz', 'ID. Buzz Cargo',
        'Golf', 'Passat', 'ID.3', 'ID.4', 'ID.7', 'Tiguan', 'Polo', 'Touran'
    ],
    'Ford': [
        'Transit', 'Transit Custom', 'Transit Connect', 'Transit Courier', 'E-Transit',
        'Focus', 'Mondeo', 'Kuga', 'Puma', 'Mustang Mach-E'
    ],
    'Toyota': [
        'Proace', 'Proace City', 'Proace Electric', 'Proace Max',
        'Corolla', 'Yaris', 'RAV4', 'Camry', 'Avensis', 'Prius', 'bZ4X', 'Hilux'
    ],
    'Volvo': [
        'V60', 'V90', 'XC40', 'XC60', 'XC90', 'EX30', 'EX40', 'EX90', 'V40', 'V70'
    ],
    'Skoda': [
        'Octavia', 'Superb', 'Enyaq', 'Kodiaq', 'Karoq', 'Fabia', 'Scala', 'Kamiq'
    ],
    'Peugeot': [
        'Partner', 'Expert', 'Boxer', 'e-Expert', 'e-Partner', 'e-Boxer',
        '208', '308', '508', '2008', '3008', '5008'
    ],
    'Renault': [
        'Trafic', 'Master', 'Kangoo', 'Kangoo E-Tech', 'Trafic E-Tech', 'Master E-Tech',
        'Megane', 'Clio', 'Captur', 'Austral', 'Scenic'
    ],
    'Citroën': [
        'Berlingo', 'Jumpy', 'Jumper', 'ë-Berlingo', 'ë-Jumpy', 'ë-Jumper',
        'C3', 'C4', 'C5 Aircross'
    ],
    'Opel': [
        'Vivaro', 'Movano', 'Combo', 'Vivaro-e', 'Combo-e', 'Movano-e',
        'Astra', 'Corsa', 'Insignia', 'Grandland', 'Mokka'
    ],
    'BMW': [
        '1-sarja', '3-sarja', '5-sarja', 'i4', 'i5', 'iX', 'iX1', 'iX3', 'X1', 'X3', 'X5', '2-sarja'
    ],
    'Audi': [
        'A4', 'A6', 'A3', 'Q4 e-tron', 'Q6 e-tron', 'Q8 e-tron', 'Q3', 'Q5', 'A5'
    ],
    'Tesla': [
        'Model Y', 'Model 3', 'Model X', 'Model S'
    ],
    'Nissan': [
        'Townstar', 'Primastar', 'Interstar', 'Townstar EV', 'Leaf', 'Ariya', 'Qashqai', 'X-Trail'
    ],
    'Kia': [
        'Ceed', 'ProCeed', 'EV6', 'EV9', 'Niro', 'Sportage', 'Sorento', 'Rio'
    ],
    'Hyundai': [
        'Staria', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Tucson', 'Santa Fe', 'i30', 'i20'
    ],
    'BYD': [
        'Atto 3', 'Dolphin', 'Seal', 'Tang', 'Han', 'ETP3 Pakettiauto'
    ],
    'Maxus': [
        'e-Deliver 3', 'e-Deliver 9', 'e-Deliver 7', 'T90 EV', 'Euniq 5', 'Euniq 6', 'Mifa 9'
    ],
    'Polestar': [
        'Polestar 2', 'Polestar 3', 'Polestar 4'
    ],
    'Cupra': [
        'Born', 'Formentor', 'Leon', 'Tavascan', 'Ateca'
    ],
    'Fiat': [
        'Ducato', 'Scudo', 'Doblò', 'E-Ducato', 'E-Scudo', 'E-Doblò', '500', 'Tipo', 'Panda'
    ],
    'Iveco': [
        'Daily', 'eDaily'
    ],
    'MAN': [
        'TGE', 'eTGE'
    ],
};

const ALL_MAKES = Object.keys(CAR_DATABASE);

export default function DriverVehicleScreen() {
    const router = useRouter();
    const [vehicleType, setVehicleType] = useState<string>('van');
    const [fuelType, setFuelType] = useState<string>('diesel');
    const [plateNumber, setPlateNumber] = useState<string>('ABC-123');
    const [make, setMake] = useState<string>('Mercedes-Benz');
    const [model, setModel] = useState<string>('Vito');
    const [color, setColor] = useState<string>('Valkoinen');
    const [savedNotice, setSavedNotice] = useState<boolean>(false);

    // Online-haun tila
    const [onlineModels, setOnlineModels] = useState<string[]>([]);
    const [isFetchingOnline, setIsFetchingOnline] = useState<boolean>(false);

    // Modaalien tilat
    const [makeModalVisible, setMakeModalVisible] = useState<boolean>(false);
    const [modelModalVisible, setModelModalVisible] = useState<boolean>(false);
    const [colorModalVisible, setColorModalVisible] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        AsyncStorage.getItem(DRIVER_VEHICLE_KEY).then((data) => {
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type) setVehicleType(parsed.type);
                    if (parsed.fuelType) setFuelType(parsed.fuelType);
                    if (parsed.plate) setPlateNumber(parsed.plate);
                    if (parsed.make) setMake(parsed.make);
                    if (parsed.model) setModel(parsed.model);
                    if (parsed.color) setColor(parsed.color);
                } catch {}
            }
        });
    }, []);

    // 🌐 HAETAAN REAALIAJASSA GLOBAALISTA ONLINE-KANNASTA (NHTSA vPIC API)
    useEffect(() => {
        if (!make) return;
        let isMounted = true;
        setIsFetchingOnline(true);

        const fetchOnlineVehicleModels = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const cleanMake = make.split(' ')[0].replace('-', '');
                const res = await fetch(
                    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(cleanMake)}?format=json`,
                    { signal: controller.signal }
                );
                clearTimeout(timeoutId);

                if (res.ok) {
                    const json = await res.json();
                    if (json.Results && Array.isArray(json.Results) && json.Results.length > 0) {
                        const fetchedNames = Array.from(
                            new Set(json.Results.map((r: any) => String(r.Model_Name || '').trim()))
                        ).filter(Boolean) as string[];

                        if (isMounted && fetchedNames.length > 0) {
                            setOnlineModels(fetchedNames);
                        }
                    }
                }
            } catch {
                // Käytetään paikalliskantaa
            } finally {
                if (isMounted) setIsFetchingOnline(false);
            }
        };

        fetchOnlineVehicleModels();

        return () => {
            isMounted = false;
        };
    }, [make]);

    // Suodatetut merkit haun mukaan
    const filteredMakes = useMemo(() => {
        if (!searchQuery.trim()) return ALL_MAKES;
        const q = searchQuery.toLowerCase().trim();
        return ALL_MAKES.filter(m => m.toLowerCase().includes(q));
    }, [searchQuery]);

    // Yhdistetyt mallit
    const filteredModels = useMemo(() => {
        const localModelsForMake = CAR_DATABASE[make] || [];
        const combined = Array.from(new Set([...localModelsForMake, ...onlineModels]));

        if (!searchQuery.trim()) return combined;
        const q = searchQuery.toLowerCase().trim();
        return combined.filter(m => m.toLowerCase().includes(q));
    }, [make, onlineModels, searchQuery]);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.replace('/driver/profile' as any);
    };

    const handleSelectMake = (selectedMake: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setMake(selectedMake);
        const firstModel = CAR_DATABASE[selectedMake]?.[0] || '';
        setModel(firstModel);
        setMakeModalVisible(false);
        setSearchQuery('');
    };

    const handleSelectModel = (selectedModel: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setModel(selectedModel);
        setModelModalVisible(false);
        setSearchQuery('');
    };

    const handleSelectColor = (selectedColor: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setColor(selectedColor);
        setColorModalVisible(false);
    };

    const handleSave = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setSavedNotice(true);

        const typeLabel = VEHICLE_TYPES.find(v => v.id === vehicleType)?.label || 'Pakettiauto';
        const fuelLabel = FUEL_TYPES.find(f => f.id === fuelType)?.label || 'Diesel';
        const fullMakeModel = `${make} ${model}`.trim();

        try {
            const dataToSave = {
                type: vehicleType,
                typeLabel,
                fuelType,
                fuelLabel,
                plate: plateNumber.trim().toUpperCase(),
                make,
                model,
                makeModel: fullMakeModel,
                color,
            };
            await AsyncStorage.setItem(DRIVER_VEHICLE_KEY, JSON.stringify(dataToSave));
        } catch {}

        setTimeout(() => {
            setSavedNotice(false);
            router.replace('/driver/profile' as any);
        }, 400);
    };

    const currentColorObj = VEHICLE_COLORS.find(c => c.label === color) || VEHICLE_COLORS[0];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* YLÄPALKKI */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Ajoneuvo</Text>

                <View style={{ width: 32 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. AJONEUVOTYYPPI (3 vaihtoehtoa) */}
                    <Text style={styles.sectionHeader}>Ajoneuvotyyppi</Text>
                    <View style={styles.pillRow}>
                        {VEHICLE_TYPES.map((v) => {
                            const isSelected = vehicleType === v.id;
                            return (
                                <TouchableOpacity
                                    key={v.id}
                                    style={[
                                        styles.typePill,
                                        isSelected && styles.typePillSelected,
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                        setVehicleType(v.id);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Feather
                                        name={v.icon as any}
                                        size={16}
                                        color={isSelected ? '#0284C7' : '#64748B'}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={[
                                        styles.typePillLabel,
                                        isSelected && styles.typePillLabelSelected,
                                    ]}>
                                        {v.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* 2. KÄYTTÖVOIMA (5 vaihtoehtoa) */}
                    <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Käyttövoima</Text>
                    <View style={styles.fuelGrid}>
                        {FUEL_TYPES.map((f) => {
                            const isSelected = fuelType === f.id;
                            return (
                                <TouchableOpacity
                                    key={f.id}
                                    style={[
                                        styles.fuelPill,
                                        isSelected && styles.fuelPillSelected,
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                        setFuelType(f.id);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Feather
                                        name={f.icon as any}
                                        size={15}
                                        color={isSelected ? '#0284C7' : '#64748B'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[
                                        styles.fuelPillLabel,
                                        isSelected && styles.fuelPillLabelSelected,
                                    ]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* 3. MERKKI, MALLI, VÄRI & REKISTERINUMERO (KAIKKI STANDARDOITU) */}
                    <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Tiedot & Rekisterinumero</Text>
                    <View style={styles.cardGroup}>
                        {/* MERKKI (AVAA VALINTA-MODALIN) */}
                        <TouchableOpacity
                            style={styles.pickerRow}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setSearchQuery('');
                                setMakeModalVisible(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Merkki</Text>
                                <Text style={styles.pickerValueText}>{make}</Text>
                            </View>
                            <View style={styles.pickerRightAction}>
                                <Text style={styles.changeActionText}>Valitse</Text>
                                <Feather name="chevron-down" size={16} color="#0284C7" style={{ marginLeft: 4 }} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* MALLI (AVAA VALINTA-MODALIN ONLINE-KANNALLA) */}
                        <TouchableOpacity
                            style={styles.pickerRow}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setSearchQuery('');
                                setModelModalVisible(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.inputLabel}>Malli ({make})</Text>
                                    {isFetchingOnline && (
                                        <ActivityIndicator size="small" color="#0284C7" style={{ marginLeft: 6 }} />
                                    )}
                                </View>
                                <Text style={styles.pickerValueText}>{model}</Text>
                            </View>
                            <View style={styles.pickerRightAction}>
                                <Text style={styles.changeActionText}>Valitse</Text>
                                <Feather name="chevron-down" size={16} color="#0284C7" style={{ marginLeft: 4 }} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* VÄRI (AVAA VÄRIVALINTA-MODALIN) */}
                        <TouchableOpacity
                            style={styles.pickerRow}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setColorModalVisible(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Ajoneuvon väri</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <View style={[
                                        styles.colorDot,
                                        { backgroundColor: currentColorObj.hex, borderColor: currentColorObj.border }
                                    ]} />
                                    <Text style={styles.pickerValueText}>{color}</Text>
                                </View>
                            </View>
                            <View style={styles.pickerRightAction}>
                                <Text style={styles.changeActionText}>Valitse</Text>
                                <Feather name="chevron-down" size={16} color="#0284C7" style={{ marginLeft: 4 }} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* REKISTERINUMERO */}
                        <View style={styles.inputRow}>
                            <Text style={styles.inputLabel}>Rekisterinumero</Text>
                            <TextInput
                                style={styles.textInput}
                                value={plateNumber}
                                onChangeText={setPlateNumber}
                                placeholder="esim. ABC-123"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="characters"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    {/* TALLENNA PAINIKE */}
                    <View style={{ marginTop: 24, marginBottom: 30 }}>
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            activeOpacity={0.8}
                        >
                            <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.saveBtnText}>
                                {savedNotice ? 'Tallennettu!' : 'Tallenna ajoneuvo'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* 🌟 MERKKIVALINTA MODAL 🌟 */}
            <Modal
                visible={makeModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setMakeModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Valitse ajoneuvon merkki</Text>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setMakeModalVisible(false)}
                        >
                            <Feather name="x" size={20} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* HAKUKENTTÄ */}
                    <View style={styles.searchBarContainer}>
                        <Feather name="search" size={18} color="#64748B" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.searchTextInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Kirjoita merkki (esim. Mercedes, Toyota)..."
                            placeholderTextColor="#94A3B8"
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Feather name="x-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <FlatList
                        data={filteredMakes}
                        keyExtractor={(item) => item}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                        renderItem={({ item }) => {
                            const isSelected = item === make;
                            return (
                                <TouchableOpacity
                                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                                    onPress={() => handleSelectMake(item)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                                        {item}
                                    </Text>
                                    {isSelected && (
                                        <Feather name="check" size={18} color="#0284C7" />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>

            {/* 🌟 MALLIVALINTA MODAL 🌟 */}
            <Modal
                visible={modelModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModelModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Valitse malli</Text>
                            <Text style={styles.modalSubtitle}>Merkki: {make}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setModelModalVisible(false)}
                        >
                            <Feather name="x" size={20} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* HAKUKENTTÄ */}
                    <View style={styles.searchBarContainer}>
                        <Feather name="search" size={18} color="#64748B" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.searchTextInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={`Kirjoita malli (esim. Vito, EQB)...`}
                            placeholderTextColor="#94A3B8"
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Feather name="x-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <FlatList
                        data={filteredModels}
                        keyExtractor={(item) => item}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                        renderItem={({ item }) => {
                            const isSelected = item === model;
                            return (
                                <TouchableOpacity
                                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                                    onPress={() => handleSelectModel(item)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                                        {item}
                                    </Text>
                                    {isSelected && (
                                        <Feather name="check" size={18} color="#0284C7" />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>

            {/* 🌟 VÄRIVALINTA MODAL (STANDARDOIDUT VÄRIT) 🌟 */}
            <Modal
                visible={colorModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setColorModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Valitse ajoneuvon väri</Text>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setColorModalVisible(false)}
                        >
                            <Feather name="x" size={20} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={VEHICLE_COLORS}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
                        renderItem={({ item }) => {
                            const isSelected = item.label === color;
                            return (
                                <TouchableOpacity
                                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                                    onPress={() => handleSelectColor(item.label)}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[
                                            styles.colorDotModal,
                                            { backgroundColor: item.hex, borderColor: item.border }
                                        ]} />
                                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                                            {item.label}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <Feather name="check" size={18} color="#0284C7" />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
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
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    scrollContent: {
        padding: 16,
        paddingTop: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
        marginLeft: 4,
    },
    pillRow: {
        flexDirection: 'row',
        gap: 8,
    },
    typePill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    typePillSelected: {
        borderColor: '#BAE6FD',
        backgroundColor: '#F0F9FF',
    },
    typePillLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    typePillLabelSelected: {
        fontWeight: '800',
        color: '#0284C7',
    },
    fuelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    fuelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    fuelPillSelected: {
        borderColor: '#BAE6FD',
        backgroundColor: '#F0F9FF',
    },
    fuelPillLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    fuelPillLabelSelected: {
        fontWeight: '800',
        color: '#0284C7',
    },
    cardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    pickerValueText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    colorDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        marginRight: 8,
    },
    colorDotModal: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        marginRight: 14,
    },
    pickerRightAction: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    changeActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7',
    },
    inputRow: {
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 4,
    },
    textInput: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        padding: 0,
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 16,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        paddingVertical: 16,
        borderRadius: 18,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        margin: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchTextInput: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '600',
        padding: 0,
    },
    modalItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 14,
        borderRadius: 14,
        marginBottom: 4,
    },
    modalItemRowSelected: {
        backgroundColor: '#F0F9FF',
    },
    modalItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    },
    modalItemTextSelected: {
        fontWeight: '800',
        color: '#0284C7',
    },
});
