import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// Määritellään vaihtoehdot ja otetaan ensimmäinen oletukseksi
const AVATAR_OPTIONS = [
    { id: '1', url: 'https://mgdvyfvcdivwzjxgrggv.supabase.co/storage/v1/object/public/Avatar/default-basket.png' },
    { id: '2', url: 'https://mgdvyfvcdivwzjxgrggv.supabase.co/storage/v1/object/public/Avatar/girl-basket.png' },
    { id: '3', url: 'https://mgdvyfvcdivwzjxgrggv.supabase.co/storage/v1/object/public/Avatar/vacation-basket.png' },
    { id: '4', url: 'https://mgdvyfvcdivwzjxgrggv.supabase.co/storage/v1/object/public/Avatar/alien-basket.png' },
    { id: '5', url: 'https://mgdvyfvcdivwzjxgrggv.supabase.co/storage/v1/object/public/Avatar/superman-basket.png' },
];

const FALLBACK_AVATAR = AVATAR_OPTIONS[0].url;

interface ProfileHeaderProps {
    profileImageUrl?: string;
    onEditPress?: () => void;
    onLogoutPress?: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onLogoutPress }) => {
    const insets = useSafeAreaInsets();
    const [firstName, setFirstName] = useState<string | null>(null);
    const [lastName, setLastName] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Lasketaan dynaaminen turva-alue niin, että otsikko ja napit eivät koskaan mene piiloon
    const topPadding = Math.max(insets.top + 12, 50);

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                setFirstName(null);
                setLastName(null);
                setAvatarUrl(null);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('user_id', user.id)
                .maybeSingle();

            if (data) {
                setFirstName(data.first_name);
                setLastName(data.last_name);
                setAvatarUrl(data.avatar_url);
            }
        } catch (err) {
            console.error('Odottamaton virhe profiilia haettaessa:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const updateAvatar = async (url: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: url })
                .eq('user_id', user.id);

            if (error) throw error;

            setAvatarUrl(url);
            setModalVisible(false);
        } catch (err) {
            Alert.alert("Virhe", "Kuvan tallennus epäonnistui.");
            console.error(err);
        }
    };

    const imageSource = { uri: avatarUrl || FALLBACK_AVATAR };
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Pesuni Käyttäjä';

    return (
        <LinearGradient
            colors={['#5CD1FF', '#00C2FF', '#0099FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerGradient, { paddingTop: topPadding }]}
        >
            {/* 🌊 KORISTEELLISET AALTO- JA VIRTAUSVIIVAT 🌊 */}
            <View style={styles.lineContainer} pointerEvents="none">
                <View style={styles.arcOuter} />
                <View style={styles.arcMiddle} />
                <View style={styles.diagonalLine1} />
            </View>

            {/* YLÄPALKKI: OTSIKKO JA ULOSKIRJAUTUMINEN */}
            <View style={styles.topBar}>
                <Text style={styles.headerTitle}>Oma Profiili</Text>
                <TouchableOpacity
                    style={styles.logoutButton}
                    activeOpacity={0.8}
                    onPress={onLogoutPress}
                >
                    <Feather name="log-out" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.logoutText}>Kirjaudu ulos</Text>
                </TouchableOpacity>
            </View>

            {/* KESKELLÄ: AVATAR JA KÄYTTÄJÄN TIEDOT */}
            <View style={styles.profileSection}>
                <View style={styles.avatarWrapper}>
                    <Image source={imageSource} style={styles.avatarImage} />
                    <TouchableOpacity
                        style={styles.editBadge}
                        activeOpacity={0.85}
                        onPress={() => setModalVisible(true)}
                    >
                        <FontAwesome5 name="pencil-alt" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.nameText}>{loading ? 'Ladataan...' : fullName}</Text>

                <View style={styles.memberBadge}>
                    <Feather name="check-circle" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={styles.memberBadgeText}>Pesuni Asiakas</Text>
                </View>
            </View>

            {/* AVATAR-VALINTAMODAALI */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Valitse maskottiprofiili</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={AVATAR_OPTIONS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.avatarList}
                            renderItem={({ item }) => {
                                const isSelected = (avatarUrl || FALLBACK_AVATAR) === item.url;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.avatarOptionWrapper,
                                            isSelected && styles.selectedAvatar
                                        ]}
                                        onPress={() => updateAvatar(item.url)}
                                        activeOpacity={0.8}
                                    >
                                        <Image source={{ uri: item.url }} style={styles.avatarOptionImage} />
                                        {isSelected && (
                                            <View style={styles.checkBadge}>
                                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    headerGradient: {
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    lineContainer: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
    },
    arcOuter: {
        position: 'absolute',
        top: -60,
        right: -40,
        width: 280,
        height: 280,
        borderRadius: 140,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    arcMiddle: {
        position: 'absolute',
        top: -20,
        right: 0,
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    diagonalLine1: {
        position: 'absolute',
        bottom: 20,
        left: -30,
        width: 260,
        height: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        transform: [{ rotate: '-22deg' }],
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 3,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    logoutText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    profileSection: {
        alignItems: 'center',
        marginTop: 6,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarImage: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        backgroundColor: '#E0F7FF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    editBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#00C2FF',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    nameText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
    },
    memberBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    memberBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        width: width * 0.88,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 15,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1A1B32',
    },
    avatarList: {
        paddingVertical: 10,
        gap: 12,
    },
    avatarOptionWrapper: {
        borderRadius: 40,
        padding: 3,
        borderWidth: 2.5,
        borderColor: 'transparent',
    },
    selectedAvatar: {
        borderColor: '#00C2FF',
    },
    avatarOptionImage: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#F1F5F9',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#00C2FF',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});

export default ProfileHeader;