import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { selectTotalCartItems } from '../../redux/cartSlice';
import { selectUserProfile } from '../../redux/profileSlice';

const COLORS = {
    dark: '#1A1B32',
    primary: '#00C2FF',
    white: '#FFFFFF',
    textGray: '#64748B',
    cardBorder: '#F1F5F9',
};

interface LocationBarProps {
    onCartPress: () => void;
}

const LocationBar: React.FC<LocationBarProps> = ({ onCartPress }) => {
    const router = useRouter();
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);

    const userProfile = useSelector(selectUserProfile);
    const cartCount = useSelector(selectTotalCartItems);

    const displayAddress = userProfile?.address || "Määritä toimitusosoite";

    const toggleDropdown = () => setIsDropdownVisible(!isDropdownVisible);

    const handleEditAddress = () => {
        router.push('/general/personal-data');
        setIsDropdownVisible(false);
    };

    return (
        <View style={styles.floatingContainer}>
            <View style={styles.mainCard}>
                {/* 📍 OSOITEOSIO 📍 */}
                <TouchableOpacity
                    onPress={toggleDropdown}
                    activeOpacity={0.75}
                    style={styles.locationSection}
                >
                    <View style={styles.iconBox}>
                        <FontAwesome5 name="map-marker-alt" size={15} color={COLORS.primary} />
                    </View>

                    <View style={styles.textContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.labelText}>Toimitusosoite</Text>
                            <View style={styles.activeDot} />
                        </View>
                        <View style={styles.addressRow}>
                            <Text style={styles.addressText} numberOfLines={1}>
                                {displayAddress}
                            </Text>
                            <Feather
                                name={isDropdownVisible ? "chevron-up" : "chevron-down"}
                                size={14}
                                color={COLORS.textGray}
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* 🧺 OMAT TEKSTIILIT -PIKAPAINIKE 🧺 */}
                <TouchableOpacity
                    onPress={() => router.push('/general/saved-textiles')}
                    style={styles.textilesButton}
                    activeOpacity={0.8}
                >
                    <FontAwesome5
                        name="tshirt"
                        size={16}
                        color="#0284C7"
                    />
                </TouchableOpacity>

                {/* 🛒 OSTOSKORIPAINIKE 🛒 */}
                <TouchableOpacity
                    onPress={onCartPress}
                    style={[styles.cartButton, cartCount > 0 && styles.activeCartButton]}
                    activeOpacity={0.8}
                >
                    <Feather
                        name="shopping-bag"
                        size={20}
                        color={cartCount > 0 ? '#00C2FF' : COLORS.dark}
                    />
                    {cartCount > 0 && (
                        <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{cartCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* 🔽 DROPDOWN - OSOITTEEN MUOKKAUS & OMAT TEKSTIILIT 🔽 */}
            {isDropdownVisible && (
                <View style={styles.dropdownCard}>
                    <TouchableOpacity
                        style={styles.dropdownActionRow}
                        onPress={handleEditAddress}
                        activeOpacity={0.7}
                    >
                        <View style={styles.dropdownLeft}>
                            <View style={styles.editIconCircle}>
                                <Feather name="edit-2" size={14} color="#0284C7" />
                            </View>
                            <View>
                                <Text style={styles.dropdownTitle}>Vaihda tai muokkaa osoitetta</Text>
                                <Text style={styles.dropdownSubtitle}>Päivitä koti- tai nouto-osoite profiilista</Text>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>

                    <View style={styles.dropdownDivider} />

                    <TouchableOpacity
                        style={styles.dropdownActionRow}
                        onPress={() => {
                            setIsDropdownVisible(false);
                            router.push('/general/saved-textiles');
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.dropdownLeft}>
                            <View style={[styles.editIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                <FontAwesome5 name="tshirt" size={13} color="#0284C7" />
                            </View>
                            <View>
                                <Text style={styles.dropdownTitle}>Omat tallennetut tekstiilit</Text>
                                <Text style={styles.dropdownSubtitle}>Mattojen mitat, puvut ja pikavaraus</Text>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    floatingContainer: {
        marginHorizontal: 16,
        marginTop: -22,
        zIndex: 999,
    },
    mainCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 6,
    },
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    labelText: {
        fontSize: 11,
        color: COLORS.textGray,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginRight: 6,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.dark,
        flexShrink: 1,
    },
    textilesButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    cartButton: {
        width: 44,
        height: 44,
        borderRadius: 15,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    activeCartButton: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    cartBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },
    dropdownCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginTop: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },
    dropdownActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        paddingHorizontal: 6,
    },
    dropdownDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 4,
    },
    dropdownLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    editIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    dropdownTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.dark,
    },
    dropdownSubtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginTop: 1,
    },
});

export default LocationBar;