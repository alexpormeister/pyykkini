import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F8F9FD',
    cardBorder: '#F1F5F9',
    primary: '#00C2FF',
    unreadRed: '#EF4444',
    textGray: '#64748B',
};

interface ChatThreadExtended {
    id: string;
    user_id: string;
    created_at: string;
    last_message_at: string;
    status: 'open' | 'closed';
    is_read: boolean;
    last_sender_id: string | null;
}

const UserMessagesScreen = () => {
    const router = useRouter();
    const [threads, setThreads] = useState<ChatThreadExtended[]>([]);
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;
        setUserId(currentUserId);

        if (!currentUserId) {
            router.replace('/auth/login');
            return;
        }

        const { data: threadData, error: threadError } = await supabase
            .from('support_chats')
            .select('*')
            .eq('user_id', currentUserId)
            .order('last_message_at', { ascending: false });

        if (threadError) {
            console.error('Virhe chatien haussa:', threadError);
            setIsLoading(false);
            return;
        }

        if (threadData) {
            const enrichedThreads = await Promise.all(
                threadData.map(async (thread) => {
                    const { data: lastMsg } = await supabase
                        .from('chat_messages')
                        .select('sender_id')
                        .eq('chat_id', thread.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    return {
                        ...thread,
                        last_sender_id: lastMsg?.sender_id || null,
                    };
                })
            );
            setThreads(enrichedThreads);
        }
        setIsLoading(false);
    }, [router]);

    // Päivitetään keskustelulista aina kun näkymä aktivoituu
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    useEffect(() => {
        fetchData();

        if (!userId) return;

        const channel = supabase
            .channel('user-chat-list-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_chats', filter: `user_id=eq.${userId}` },
                () => fetchData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, userId]);

    // Suodatetaan avoimet ja suljetut keskustelut
    const openThreads = threads.filter(t => t.status !== 'closed');
    const closedThreads = threads.filter(t => t.status === 'closed');
    const displayedThreads = activeTab === 'open' ? openThreads : closedThreads;

    const renderThreadItem = ({ item }: { item: ChatThreadExtended }) => {
        const isClosed = item.status === 'closed';
        const showBadge = !item.is_read && item.last_sender_id !== userId && !isClosed;

        return (
            <TouchableOpacity
                style={[styles.threadItem, isClosed && styles.threadItemClosed]}
                activeOpacity={0.75}
                onPress={() => router.push({
                    pathname: '/general/chatscreen',
                    params: { chatId: item.id },
                })}
            >
                <View style={styles.iconContainer}>
                    <View style={[styles.messageIconCircle, showBadge && styles.activeIconCircle]}>
                        <Feather
                            name={isClosed ? "archive" : "message-circle"}
                            size={22}
                            color={showBadge ? '#0284C7' : isClosed ? '#94A3B8' : '#64748B'}
                        />
                    </View>
                    {showBadge && (
                        <View style={styles.unreadDot}>
                            <Text style={styles.unreadDotText}>1</Text>
                        </View>
                    )}
                </View>

                <View style={styles.threadDetails}>
                    <View style={styles.threadHeaderRow}>
                        <View style={styles.titleWithStatus}>
                            <Text style={[styles.threadTitle, isClosed && styles.textClosed]}>
                                {isClosed ? 'Suljettu keskustelu' : 'Asiakastuki & Neuvonta'}
                            </Text>
                            {isClosed && (
                                <View style={styles.closedTag}>
                                    <Text style={styles.closedTagText}>Suljettu</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.threadDate}>
                            {new Date(item.last_message_at).toLocaleDateString('fi-FI')}
                        </Text>
                    </View>
                    <Text
                        style={[styles.lastMessagePreview, showBadge && styles.unreadPreviewText]}
                        numberOfLines={1}
                    >
                        {showBadge
                            ? '🔥 Uusi vastaus asiakaspalvelulta!'
                            : isClosed
                            ? 'Keskustelu on päättynyt ja arkistoitu'
                            : 'Klikkaa avataksesi keskustelun'}
                    </Text>
                </View>

                <Feather name="chevron-right" size={18} color="#CBD5E1" />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Keskustelut</Text>
                <TouchableOpacity
                    onPress={() => router.push('/general/chatscreen')}
                    style={styles.newChatButton}
                    activeOpacity={0.75}
                >
                    <Feather name="plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* 🎛️ TABIVALITSIN: AVOIMET VS. SULJETUT 🎛️ */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'open' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('open')}
                    activeOpacity={0.8}
                >
                    <Feather
                        name="message-circle"
                        size={15}
                        color={activeTab === 'open' ? COLORS.primary : COLORS.textGray}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'open' && styles.tabTextActive]}>
                        Avoimet ({openThreads.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'closed' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('closed')}
                    activeOpacity={0.8}
                >
                    <Feather
                        name="archive"
                        size={15}
                        color={activeTab === 'closed' ? COLORS.primary : COLORS.textGray}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'closed' && styles.tabTextActive]}>
                        Suljetut ({closedThreads.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={displayedThreads}
                    renderItem={renderThreadItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBox}>
                                <Feather
                                    name={activeTab === 'open' ? "message-square" : "archive"}
                                    size={36}
                                    color="#94A3B8"
                                />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'open' ? 'Ei avoimia keskusteluja' : 'Ei suljettuja keskusteluja'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {activeTab === 'open'
                                    ? 'Tarvitsetko apua tilaukseen tai pesuohjeisiin liittyen? Asiakaspalvelumme auttaa mielellään!'
                                    : 'Kaikki päättämäsi keskustelut arkistoidaan tänne, jotta voit lukea niitä myöhemmin.'}
                            </Text>
                            {activeTab === 'open' && (
                                <TouchableOpacity
                                    style={styles.startChatBtn}
                                    activeOpacity={0.85}
                                    onPress={() => router.push('/general/chatscreen')}
                                >
                                    <Feather name="send" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.startChatBtnText}>Aloita uusi keskustelu</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 14 : 18,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
    newChatButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 4,
        marginHorizontal: 16,
        marginTop: 14,
        marginBottom: 8,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textGray,
    },
    tabTextActive: {
        color: COLORS.darkText,
        fontWeight: '800',
    },
    listContent: { padding: 16 },
    threadItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 22,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    threadItemClosed: {
        opacity: 0.85,
        backgroundColor: '#FCFDFF',
    },
    iconContainer: { position: 'relative', marginRight: 14 },
    messageIconCircle: {
        width: 46,
        height: 46,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeIconCircle: {
        backgroundColor: '#E0F2FE',
    },
    unreadDot: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: COLORS.unreadRed,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.white,
        zIndex: 1,
    },
    unreadDotText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
    threadDetails: { flex: 1, marginRight: 8 },
    threadHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    titleWithStatus: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
    threadTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
    closedTag: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        marginLeft: 6,
    },
    closedTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    threadDate: { fontSize: 11, color: COLORS.textGray, fontWeight: '500' },
    lastMessagePreview: { fontSize: 13, color: COLORS.textGray },
    unreadPreviewText: { color: '#0284C7', fontWeight: '700' },
    textClosed: { color: '#475569' },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
    emptyIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText, marginBottom: 8 },
    emptyText: { fontSize: 14, color: COLORS.textGray, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
    startChatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 18,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    startChatBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

export default UserMessagesScreen;