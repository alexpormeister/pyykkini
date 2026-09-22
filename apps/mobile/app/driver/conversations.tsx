import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    primary: '#00C2FF',
    primaryDark: '#0284C7',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    darkText: '#0F172A',
    grayText: '#64748B',
    lightGray: '#94A3B8',
    border: '#E2E8F0',
    green: '#10B981',
};

interface ConversationItem {
    id: string;
    title: string;
    snippet: string;
    time: string;
    unreadCount?: number;
    status: 'open' | 'closed';
    category: string;
}

const OPEN_CONVERSATIONS: ConversationItem[] = [
    {
        id: '1',
        title: 'Pesuni Ajojärjestely & Tuki',
        snippet: 'Moi Timo! Seuraava nouto on valmis Koskelontiellä...',
        time: '10:14',
        unreadCount: 1,
        status: 'open',
        category: 'Ajo-ohjeet',
    },
    {
        id: '2',
        title: 'Asiakasnouto: Koskelontie 15',
        snippet: 'Ovikoodi on 1234, ovi aukeaa automaattisesti.',
        time: '09:40',
        status: 'open',
        category: 'Noutotieto',
    },
];

const CLOSED_CONVERSATIONS: ConversationItem[] = [
    {
        id: '3',
        title: 'Palkkiot & Keikkakorvaukset',
        snippet: 'Korvaus lisätty tilillesi. Kiitos ilmoituksesta!',
        time: 'Eilen 16:30',
        status: 'closed',
        category: 'Palkkiot',
    },
    {
        id: '4',
        title: 'Osoitteen tarkennus (Vihti)',
        snippet: 'Asiakas tavoitettu puhelimitse, paketti noudettu.',
        time: '18.8.2026',
        status: 'closed',
        category: 'Noudot',
    },
    {
        id: '5',
        title: 'Ajoneuvon huoltoilmoitus',
        snippet: 'Huolto kuitattu ja merkitty ajopäiväkirjaan.',
        time: '12.8.2026',
        status: 'closed',
        category: 'Kalusto',
    },
];

export default function DriverConversationsScreen() {
    const router = useRouter();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const [pageIndex, setPageIndex] = useState<number>(0);

    const openChat = (conv?: ConversationItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push('/general/chat');
    };

    // Navigoi AINA suoraan takaisin Profiili-sivulle
    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.replace('/driver/profile' as any);
    };

    const handleTabPress = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setPageIndex(index);
        scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const handleScrollEnd = (e: any) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / SCREEN_WIDTH);
        if ((newIndex === 0 || newIndex === 1) && newIndex !== pageIndex) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setPageIndex(newIndex);
        }
    };

    const renderList = (items: ConversationItem[], type: 'open' | 'closed') => (
        <ScrollView
            key={type}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {items.length > 0 ? (
                items.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.chatCard}
                        onPress={() => openChat(item)}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.chatAvatar,
                            item.status === 'open' ? { backgroundColor: '#E0F2FE' } : { backgroundColor: '#F1F5F9' }
                        ]}>
                            <Feather
                                name={item.status === 'open' ? 'message-circle' : 'archive'}
                                size={20}
                                color={item.status === 'open' ? '#0284C7' : '#64748B'}
                            />
                        </View>

                        <View style={styles.chatInfo}>
                            <View style={styles.chatHeaderRow}>
                                <Text style={[
                                    styles.chatTitle,
                                    item.status === 'closed' && styles.chatTitleClosed
                                ]} numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <Text style={styles.chatTime}>{item.time}</Text>
                            </View>

                            <Text style={styles.chatSnippet} numberOfLines={2}>
                                {item.snippet}
                            </Text>

                            <View style={styles.chatBottomRow}>
                                {item.status === 'open' ? (
                                    <View style={styles.activeTag}>
                                        <View style={styles.activeDot} />
                                        <Text style={styles.activeTagText}>Avoin keskustelu</Text>
                                    </View>
                                ) : (
                                    <View style={styles.closedTag}>
                                        <Feather name="check" size={12} color="#64748B" style={{ marginRight: 4 }} />
                                        <Text style={styles.closedTagText}>Ratkaistu & Suljettu</Text>
                                    </View>
                                )}

                                {item.unreadCount ? (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        <Feather name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyContainer}>
                    <LinearGradient
                        colors={['#BAE6FD', '#E0F2FE', '#F8FAFC']}
                        style={styles.emptyCircle}
                    >
                        <Feather name="message-square" size={36} color="#0284C7" />
                    </LinearGradient>
                    <Text style={styles.emptyTitle}>
                        {type === 'open' ? 'Ei avoimia keskusteluja' : 'Ei suljettuja keskusteluja'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        Voit aloittaa uuden keskustelun yläreunan viestipainikkeesta.
                    </Text>
                </View>
            )}
        </ScrollView>
    );

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

                <Text style={styles.headerTitle}>Keskustelut</Text>

                <TouchableOpacity
                    style={styles.newChatBtn}
                    onPress={() => openChat()}
                    activeOpacity={0.7}
                >
                    <Feather name="edit" size={18} color="#0284C7" />
                </TouchableOpacity>
            </View>

            {/* ALAVÄLILEHDET: AVOIMET | SULJETUT */}
            <View style={styles.tabBarContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, pageIndex === 0 && styles.tabButtonActive]}
                    onPress={() => handleTabPress(0)}
                    activeOpacity={0.8}
                >
                    <View style={styles.tabLabelRow}>
                        <Text style={[styles.tabText, pageIndex === 0 && styles.tabTextActive]}>
                            Avoimet
                        </Text>
                        <View style={[styles.tabBadge, pageIndex === 0 && styles.tabBadgeActive]}>
                            <Text style={[styles.tabBadgeText, pageIndex === 0 && styles.tabBadgeTextActive]}>
                                {OPEN_CONVERSATIONS.length}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, pageIndex === 1 && styles.tabButtonActive]}
                    onPress={() => handleTabPress(1)}
                    activeOpacity={0.8}
                >
                    <View style={styles.tabLabelRow}>
                        <Text style={[styles.tabText, pageIndex === 1 && styles.tabTextActive]}>
                            Suljetut
                        </Text>
                        <View style={[styles.tabBadge, pageIndex === 1 && styles.tabBadgeActive]}>
                            <Text style={[styles.tabBadgeText, pageIndex === 1 && styles.tabBadgeTextActive]}>
                                {CLOSED_CONVERSATIONS.length}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {/* SISÄLTÖ: HORISONTAALINEN SWIPE (AVOIMET <-> SULJETUT) */}
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScrollEnd}
                style={styles.pagerScrollView}
            >
                {renderList(OPEN_CONVERSATIONS, 'open')}
                {renderList(CLOSED_CONVERSATIONS, 'closed')}
            </ScrollView>
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
    newChatBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
    },
    tabButtonActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#0284C7',
    },
    tabLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#0284C7',
        fontWeight: '800',
    },
    tabBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    tabBadgeActive: {
        backgroundColor: '#E0F2FE',
    },
    tabBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    tabBadgeTextActive: {
        color: '#0284C7',
    },
    pagerScrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    chatAvatar: {
        width: 46,
        height: 46,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    chatInfo: {
        flex: 1,
    },
    chatHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    chatTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        flex: 1,
        marginRight: 8,
    },
    chatTitleClosed: {
        color: '#475569',
        fontWeight: '700',
    },
    chatTime: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    chatSnippet: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 6,
        lineHeight: 18,
    },
    chatBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 5,
    },
    activeTagText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#10B981',
    },
    closedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    closedTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    unreadBadge: {
        backgroundColor: '#0284C7',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
});
