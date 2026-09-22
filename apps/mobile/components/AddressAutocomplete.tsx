import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    fetchActiveServiceAreas,
    matchAddressServiceArea,
    ServiceArea,
    ServiceAreaMatchResult,
} from '../lib/serviceAreas';

export interface AddressSuggestion {
    id: string;
    formatted: string;
    street: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    detail?: string;
    isSupported: boolean;
}

interface AddressAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    onServiceAreaChecked?: (result: ServiceAreaMatchResult) => void;
    onSelectSuggestion?: (item: AddressSuggestion) => void;
    placeholder?: string;
    disableServiceAreaCheck?: boolean;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChangeText,
    onServiceAreaChecked,
    onSelectSuggestion,
    placeholder = 'Kirjoita osoite (esim. Arvelantie)...',
    disableServiceAreaCheck = false,
}) => {
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [matchStatus, setMatchStatus] = useState<ServiceAreaMatchResult | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ladataan aktiiviset palvelualueet
    useEffect(() => {
        fetchActiveServiceAreas().then((areas) => {
            setServiceAreas(areas);
        });
    }, []);

    // Tarkistetaan syötetty osoite
    useEffect(() => {
        if (!value || value.trim().length < 3 || serviceAreas.length === 0) {
            setMatchStatus(null);
            return;
        }

        const match = matchAddressServiceArea(value, serviceAreas);
        setMatchStatus(match);
        if (onServiceAreaChecked) {
            onServiceAreaChecked(match);
        }
    }, [value, serviceAreas, onServiceAreaChecked]);

    const searchAddress = async (query: string) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            setLoading(false);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            // Photon API tukee sijaintipainotusta (Suomi: lat ~64, lon ~26)
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=12&lat=64.0&lon=26.0`;
            const response = await fetch(url);
            if (!response.ok) {
                setSuggestions([]);
                return;
            }

            const data = await response.json();
            if (!data || !data.features) {
                setSuggestions([]);
                return;
            }

            const items: AddressSuggestion[] = [];
            const seen = new Set<string>();

            for (const feature of data.features) {
                const p = feature.properties || {};
                const countryCode = (p.countrycode || '').toUpperCase();
                const country = (p.country || '').toLowerCase();

                if (countryCode && countryCode !== 'FI') continue;
                if (country && !['suomi', 'finland'].includes(country)) continue;

                const street = p.street || p.name || '';
                const housenumber = p.housenumber || '';
                const postcode = p.postcode || '';
                const city = p.city || p.town || p.municipality || p.district || '';

                if (!street) continue;

                let formatted = street;
                if (housenumber) formatted += ` ${housenumber}`;
                if (postcode || city) {
                    const postalPart = [postcode, city].filter(Boolean).join(' ');
                    formatted += `, ${postalPart}`;
                }

                if (!seen.has(formatted)) {
                    seen.add(formatted);
                    const isSupported = matchAddressServiceArea(formatted, serviceAreas).isSupported;
                    
                    // Asiakkaalle vain toimitusalueen osoitteet, kuljettajalle kaikki osoitteet
                    if (disableServiceAreaCheck || isSupported) {
                        items.push({
                            id: `${p.osm_id || Math.random()}-${formatted}`,
                            formatted,
                            street,
                            housenumber,
                            postcode,
                            city,
                            detail: [p.district, p.state, p.country || 'Suomi'].filter(Boolean).join(', '),
                            isSupported: isSupported,
                        });
                    }
                }
            }

            setSuggestions(items);
        } catch (error) {
            console.error('Virhe osoitehaussa:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleTextChange = (text: string) => {
        onChangeText(text);
        setShowSuggestions(true);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            searchAddress(text);
        }, 300);
    };

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    const handleSelectSuggestion = (item: AddressSuggestion) => {
        onChangeText(item.formatted);
        if (onSelectSuggestion) {
            onSelectSuggestion(item);
        }
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleClear = () => {
        onChangeText('');
        setSuggestions([]);
        setShowSuggestions(false);
        setMatchStatus(null);
        setHasSearched(false);
    };

    const activeCityNames = serviceAreas.map(a => a.city).join(', ');

    return (
        <View style={styles.container}>
            <View style={styles.inputWrapper}>
                <Feather name="map-pin" size={18} color="#00c2ff" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={handleTextChange}
                    placeholder={placeholder}
                    placeholderTextColor="#999999"
                    autoCapitalize="words"
                    autoCorrect={false}
                    onFocus={() => {
                        if (suggestions.length > 0 || hasSearched) setShowSuggestions(true);
                    }}
                />
                {loading && (
                    <ActivityIndicator size="small" color="#00c2ff" style={styles.rightIcon} />
                )}
                {!loading && value.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.rightIcon}>
                        <Feather name="x" size={18} color="#888888" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Palvelualue-varoitus syötetylle osoitteelle (vain jos osoite EI ole toimitusalueella) */}
            {!disableServiceAreaCheck && matchStatus && !matchStatus.isSupported && !showSuggestions && (
                <View
                    style={[
                        styles.statusBadgeContainer,
                        styles.unsupportedBadge,
                    ]}
                >
                    <Feather
                        name="alert-triangle"
                        size={14}
                        color="#DC2626"
                    />
                    <Text
                        style={[
                            styles.statusBadgeText,
                            { color: "#991B1B" },
                        ]}
                    >
                        Emme vielä toimi tällä alueella. Toiminta-alueemme: {matchStatus.activeCities.join(', ')}
                    </Text>
                </View>
            )}

            {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                    {suggestions.length > 0 ? (
                        <FlatList
                            data={suggestions}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            style={styles.suggestionsList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <View style={styles.suggestionIconBg}>
                                        <Feather name="check" size={14} color="#10B981" />
                                    </View>
                                    <View style={styles.suggestionTextContainer}>
                                        <Text style={styles.suggestionTitle}>{item.formatted}</Text>
                                        {item.detail ? (
                                            <Text style={styles.suggestionSubtitle}>{item.detail}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.areaTag}>
                                        <Text style={styles.areaTagText}>Toimitus saatavilla</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    ) : hasSearched && !loading ? (
                        <View style={styles.noResultsBox}>
                            <Feather name="alert-circle" size={24} color="#F59E0B" style={{ marginBottom: 6 }} />
                            <Text style={styles.noResultsTitle}>Ei toimitusta tälle alueelle</Text>
                            <Text style={styles.noResultsSubtitle}>
                                Toimitamme tällä hetkellä vain alueilla:{'\n'}
                                <Text style={{ fontWeight: 'bold' }}>{activeCityNames || 'Helsinki, Espoo, Vantaa, Kauniainen, Kirkkonummi'}</Text>
                            </Text>
                        </View>
                    ) : null}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 100,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: '#333333',
    },
    rightIcon: {
        padding: 6,
    },
    statusBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    supportedBadge: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    unsupportedBadge: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
        lineHeight: 16,
    },
    suggestionsContainer: {
        marginTop: 6,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        maxHeight: 240,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden',
    },
    suggestionsList: {
        maxHeight: 240,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    suggestionIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    suggestionTextContainer: {
        flex: 1,
    },
    suggestionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
    },
    suggestionSubtitle: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    areaTag: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 6,
    },
    areaTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
    },
    noResultsBox: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noResultsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    noResultsSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default AddressAutocomplete;
