import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BottomNavBarProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
    const isOrdersActive = activeTab === 'orders';
    const isHomeActive = activeTab === 'home';
    const isProfileActive = activeTab === 'profile';

    return (
        <View style={styles.container}>
            {/* VASEN: KOTI */}
            <TouchableOpacity
                style={styles.navButton}
                activeOpacity={0.7}
                onPress={() => onTabChange('home')}
            >
                <MaterialCommunityIcons
                    name={isHomeActive ? 'home' : 'home-outline'}
                    size={24}
                    color={isHomeActive ? '#00C2FF' : '#94A3B8'}
                />
                <Text style={[styles.navLabel, isHomeActive && styles.activeNavLabel]}>
                    Koti
                </Text>
            </TouchableOpacity>

            {/* KESKELLÄ: KOHOTETTU PYÖREÄ PALLO (PYYKIT / TILAUKSET) */}
            <View style={styles.centerButtonWrapper}>
                <TouchableOpacity
                    style={styles.centerButtonTouch}
                    activeOpacity={0.85}
                    onPress={() => onTabChange('orders')}
                >
                    {isOrdersActive ? (
                        /* 🔥 AKTIIVINEN TILA: Hehkuva sininen gradienttipallo 🔥 */
                        <LinearGradient
                            colors={['#5CD1FF', '#00C2FF', '#0099FF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.centerCircle, styles.activeCenterCircle]}
                        >
                            <MaterialCommunityIcons
                                name="washing-machine"
                                size={28}
                                color="#FFFFFF"
                            />
                        </LinearGradient>
                    ) : (
                        /* ⚪ EI-AKTIIVINEN TILA: Valkoinen pehmeä pallo harmaalla ikonilla ⚪ */
                        <View style={[styles.centerCircle, styles.inactiveCenterCircle]}>
                            <MaterialCommunityIcons
                                name="washing-machine"
                                size={26}
                                color="#64748B"
                            />
                        </View>
                    )}

                    <Text style={[styles.centerNavLabel, isOrdersActive && styles.activeCenterNavLabel]}>
                        Pyykit
                    </Text>
                </TouchableOpacity>
            </View>

            {/* OIKEA: PROFIILI */}
            <TouchableOpacity
                style={styles.navButton}
                activeOpacity={0.7}
                onPress={() => onTabChange('profile')}
            >
                <MaterialCommunityIcons
                    name={isProfileActive ? 'account' : 'account-outline'}
                    size={24}
                    color={isProfileActive ? '#00C2FF' : '#94A3B8'}
                />
                <Text style={[styles.navLabel, isProfileActive && styles.activeNavLabel]}>
                    Profiili
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        backgroundColor: '#FFFFFF',
        height: Platform.OS === 'ios' ? 88 : 72,
        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 12,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    navButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    navLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 3,
    },
    activeNavLabel: {
        color: '#00C2FF',
        fontWeight: '800',
    },
    centerButtonWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButtonTouch: {
        position: 'relative',
        top: -16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3.5,
        borderColor: '#FFFFFF',
    },
    activeCenterCircle: {
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 9,
        transform: [{ scale: 1.04 }],
    },
    inactiveCenterCircle: {
        backgroundColor: '#F8FAFC',
        borderColor: '#FFFFFF',
        borderWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 4,
    },
    centerNavLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 3,
    },
    activeCenterNavLabel: {
        color: '#00C2FF',
        fontWeight: '800',
    },
});

export default BottomNavBar;