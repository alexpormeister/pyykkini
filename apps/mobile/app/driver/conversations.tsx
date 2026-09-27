import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

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

interface RealConversationItem {
    id: string;
    title: string;
    snippet: string;
    time: string;
    unreadCount?: number;
    status: 'open' | 'closed';
    category: string;
}

export default function DriverConversationsScreen() {
    const router = useRouter();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const [pageIndex, setPageIndex] = useState<number>(0);

    const [openConversations, setOpenConversations] = useState<RealConversationItem[]>([]);
    const [closedConversations, setClosedConversations] = useState<RealConversationItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchRealConversations = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id;

            if (!currentUserId) {
                setLoading(false);
                return;
            }

            // Haetaan käyttäjän reaaliaikaiset support_chats -keskustelut
            const { data: threads } = await supabase
                .from('support_chats')
                .select('*')
                .eq('user_id', currentUserId)
                .order('last_message_at', { ascending: false });

            if (threads && threads.length > 0) {
                const enriched: RealConversationItem[] = await Promise.all(
                    threads.map(async (thread: any) => {
                        const { data: lastMsg } = await supabase
                            .from('chat_messages')
                            .select('content, created_at, sender_id')
                            .eq('chat_id', thread.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        let formattedTime = 'Tänään';
                        if (thread.last_message_at) {
                            try {
                                const dateObj = new Date(thread.last_message_at);
                                formattedTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
                            } catch {}
                        }

                        return {
                            id: thread.id,
                            title: 'Pesuni Ajojärjestely & Tuki',
                            snippet: lastMsg?.content || 'Ei viestejä vielä.',
                            time: formattedTime,
                            unreadCount: !thread.is_read && lastMsg?.sender_id !== currentUserId ? 1 : undefined,
                            status: thread.status === 'closed' ? 'closed' : 'open',
                            category: 'Kuljettajatuki',
                        };
                    })
                );

                setOpenConversations(enriched.filter(c => c.status === 'open'));
                setClosedConversations(enriched.filter(c => c.status === 'closed'));
            } else {
                setOpenConversations([]);
                setClosedConversations([]);
            }
        } catch (err) {
            console.error('Virhe keskusteluiden haussa:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchRealConversations();
        }, [fetchRealConversations])
    );

    const openChatScreen = (chatId?: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (chatId) {
            router.push({
                pathname: '/general/chatscreen',
                params: { chatId },
            });
        } else {
            router.push('/general/chatscreen');
        }
    };

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

    const renderList = (items: RealConversationItem[], type: 'open' | 'closed') => (
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
                        onPress={() => openChatScreen(item.id)}
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
                    onPress={() => openChatScreen()}
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
                                {openConversations.length}
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
                                {closedConversations.length}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primaryDark} />
                </View>
            ) : (
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScrollEnd}
                    style={styles.pagerScrollView}
                >
                    {renderList(openConversations, 'open')}
                    {renderList(closedConversations, 'closed')}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        padding: 8,
        backgroundColor: '#F0F9FF',
        borderRadius: 20,
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingHorizontal: 16,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: '#00C2FF',
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
        color: '#00C2FF',
        fontWeight: '700',
    },
    tabBadge: {
        marginLeft: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
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
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    chatAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    chatInfo: {
        flex: 1,
    },
    chatHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        flex: 1,
        marginRight: 8,
    },
    chatTitleClosed: {
        color: '#64748B',
    },
    chatTime: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    chatSnippet: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 8,
    },
    chatBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activeTag: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    activeTagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0284C7',
    },
    closedTag: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closedTagText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748B',
    },
    unreadBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
});
