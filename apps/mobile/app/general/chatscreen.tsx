import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#1A1B32',
    background: '#F0F4F8',
    cardBorder: '#E2E8F0',
    primary: '#00C2FF',
    userMessageBg: '#00C2FF',
    adminMessageBg: '#FFFFFF',
    textGray: '#64748B',
};

interface Message {
    id: number | string;
    chat_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_admin_message: boolean;
}

interface ChatStatus {
    id: string;
    status: 'open' | 'closed';
    is_read: boolean;
}

// 💡 YLEISET KYSYMYKSET JA AUTOMAATTISET VASTAUKSET
const FAQ_OPTIONS = [
    {
        id: 'faq_pickup',
        icon: 'truck-delivery',
        title: 'Miten nouto toimii?',
        question: 'Miten pyykkien nouto ja kotiinkuljetus toimii?',
        answer: '🚚 Noudamme pyykkisi suoraan kotioveltasi valitsemanasi ajankohtana ja palautamme ne puhtaina ja viikattuina takaisin. Kuljettaja ilmoittaa saapumisesta aina ennen noutoa!',
    },
    {
        id: 'faq_time',
        icon: 'clock-fast',
        title: 'Pesun toimitusaika?',
        question: 'Mikä on pesulan normaali toimitusaika?',
        answer: '⏱️ Normaali toimitusaika on 24-48 tuntia palvelusta riippuen (esim. peruspyykki vs. erikoispesut). Näet tarkan nouto- ja palautusajan tilauksestasi.',
    },
    {
        id: 'faq_pricing',
        icon: 'tag-outline',
        title: 'Alennukset & Hinnat?',
        question: 'Miten alennushinnat ja Pesupisteet toimivat?',
        answer: '🏷️ Tuotteiden alennukset huomioidaan suoraan tilausta tehdessä. Voit myös käyttää kertyneitä Pesupisteitäsi maksun yhteydessä saaden suoraa alennusta!',
    },
    {
        id: 'faq_human',
        icon: 'headset',
        title: 'Puhu ihmisen kanssa',
        question: 'Haluaisin keskustella asiakaspalvelijan kanssa.',
        answer: '👋 Totta kai! Kirjoita alle tarkempi kysymyksesi tai asiasi, ja asiakaspalvelijamme vastaa sinulle tähän chattiin mahdollisimman pian.',
    },
];

const ChatScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatId, setChatId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const realtimeChannel = useRef<RealtimeChannel | null>(null);
    const flatListRef = useRef<FlatList<Message>>(null);

    const markAsRead = async (id: string) => {
        await supabase.from('support_chats').update({ is_read: true }).eq('id', id);
    };

    const setupRealtime = useCallback((id: string) => {
        if (realtimeChannel.current) {
            supabase.removeChannel(realtimeChannel.current);
        }

        realtimeChannel.current = supabase
            .channel(`chat:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `chat_id=eq.${id}`,
            }, (payload) => {
                const newMsg = payload.new as Message;

                setMessages((prev) => {
                    if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
                    return [...prev, newMsg];
                });

                if (newMsg.is_admin_message) {
                    markAsRead(id);
                }
            })
            .subscribe();
    }, []);

    useEffect(() => {
        const fetchChat = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                setIsAuthenticated(false);
                router.replace('/auth/login');
                return;
            }
            setIsAuthenticated(true);
            setCurrentUserId(user.id);

            const externalChatId = params.chatId as string | undefined;

            if (!externalChatId) {
                setChatId(null);
                setChatStatus(null);
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('support_chats')
                .select('*')
                .eq('id', externalChatId)
                .single();

            if (data && !error) {
                setChatId(data.id);
                setChatStatus(data);
                markAsRead(data.id);

                const { data: msgs } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('chat_id', data.id)
                    .order('created_at', { ascending: true });

                if (msgs) setMessages(msgs as Message[]);
                setupRealtime(data.id);
            }
            setIsLoading(false);
        };

        fetchChat();

        return () => {
            if (realtimeChannel.current) {
                supabase.removeChannel(realtimeChannel.current);
            }
        };
    }, [params.chatId, router, setupRealtime]);

    // Viestin lähetyslogiikka
    const sendMessageText = async (text: string, isAdmin: boolean = false) => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        let activeChatId = chatId;

        // Jos chatia ei ole, luodaan uusi
        if (!activeChatId) {
            const { data: newChat, error } = await supabase
                .from('support_chats')
                .insert({ user_id: user.id, status: 'open', is_read: true })
                .select()
                .single();

            if (error || !newChat) {
                Alert.alert('Virhe', 'Keskustelun aloitus epäonnistui.');
                return;
            }

            activeChatId = String(newChat.id);
            setChatId(activeChatId);
            setChatStatus(newChat);
            setupRealtime(activeChatId);
        }

        if (!activeChatId) return;

        const { data: sentMsg, error } = await supabase
            .from('chat_messages')
            .insert({
                chat_id: activeChatId,
                sender_id: user.id,
                content: text,
                is_admin_message: isAdmin,
            })
            .select()
            .single();

        if (error) {
            console.error(error);
        } else if (sentMsg) {
            setMessages(prev => {
                if (prev.some(m => String(m.id) === String(sentMsg.id))) return prev;
                return [...prev, sentMsg as Message];
            });
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        const text = newMessage.trim();
        setNewMessage('');
        await sendMessageText(text, false);
    };

    // Pika-UKK kysymyksen klikkaus: lähettää kysymyksen ja luo automaattisen vastauksen
    const handleFAQClick = async (faq: typeof FAQ_OPTIONS[0]) => {
        // 1. Lähetetään käyttäjän kysymys
        await sendMessageText(faq.question, false);

        // 2. Lähetetään automaattinen bot-vastaus
        setTimeout(async () => {
            await sendMessageText(faq.answer, true);
        }, 500);
    };

    const handleCloseChat = () => {
        if (!chatId) return;

        Alert.alert(
            'Sulje keskustelu?',
            'Haluatko varmasti merkitä tämän keskustelun päättyneeksi? Se siirtyy "Suljetut"-arkistoon.',
            [
                { text: 'Peruuta', style: 'cancel' },
                {
                    text: 'Sulje keskustelu',
                    style: 'destructive',
                    onPress: async () => {
                        await supabase
                            .from('support_chats')
                            .update({ status: 'closed', is_read: true })
                            .eq('id', chatId);

                        setChatStatus(prev => prev ? ({ ...prev, status: 'closed', is_read: true }) : null);
                    },
                },
            ]
        );
    };

    const handleReopenChat = async () => {
        if (!chatId) return;
        await supabase
            .from('support_chats')
            .update({ status: 'open', is_read: true })
            .eq('id', chatId);

        setChatStatus(prev => prev ? ({ ...prev, status: 'open', is_read: true }) : null);
    };

    const isChatClosed = chatStatus?.status === 'closed';
    const isSendDisabled = isChatClosed || !isAuthenticated || !newMessage.trim();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="chevron-left" size={24} color={COLORS.darkText} />
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Keskustelut</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isChatClosed ? '#94A3B8' : '#10B981' }]} />
                        <Text style={styles.statusText}>
                            {isChatClosed ? 'Suljettu keskustelu' : 'Paikalla & Vastaamme heti'}
                        </Text>
                    </View>
                </View>

                {chatId ? (
                    <TouchableOpacity
                        style={isChatClosed ? styles.reopenHeaderBtn : styles.closeHeaderBtn}
                        onPress={isChatClosed ? handleReopenChat : handleCloseChat}
                        activeOpacity={0.7}
                    >
                        <Feather
                            name={isChatClosed ? "refresh-cw" : "check-circle"}
                            size={14}
                            color={isChatClosed ? "#0284C7" : "#EF4444"}
                            style={{ marginRight: 4 }}
                        />
                        <Text style={isChatClosed ? styles.reopenHeaderText : styles.closeHeaderText}>
                            {isChatClosed ? 'Avaa' : 'Sulje'}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            {/* 💬 CHAT TAUSTA KORISTEILLA 💬 */}
            <View style={styles.chatBackgroundWrapper}>
                {/* Taustan vesikuplat / pehmeät ympyrät */}
                <View style={styles.bgBubble1} pointerEvents="none" />
                <View style={styles.bgBubble2} pointerEvents="none" />
                <View style={styles.bgBubble3} pointerEvents="none" />

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id.toString()}
                        ListHeaderComponent={
                            <View style={styles.faqSection}>
                                {/* BOTIN TERVETULOTOIVOTUS */}
                                <View style={styles.welcomeCard}>
                                    <View style={styles.welcomeAvatar}>
                                        <MaterialCommunityIcons name="robot-happy" size={24} color="#00C2FF" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.welcomeTitle}>Hei! Miten voimme auttaa?</Text>
                                        <Text style={styles.welcomeDesc}>
                                            Valitse alta pika-aihe tai kirjoita kysymyksesi suoraan asiakaspalvelullemme.
                                        </Text>
                                    </View>
                                </View>

                                {/* PIKAKYSYMYKSET */}
                                <Text style={styles.faqHeading}>Yleisimmät kysymykset</Text>
                                <View style={styles.faqGrid}>
                                    {FAQ_OPTIONS.map((faq) => (
                                        <TouchableOpacity
                                            key={faq.id}
                                            style={styles.faqChip}
                                            activeOpacity={0.75}
                                            onPress={() => handleFAQClick(faq)}
                                        >
                                            <MaterialCommunityIcons name={faq.icon as any} size={18} color="#0284C7" style={{ marginRight: 8 }} />
                                            <Text style={styles.faqChipText}>{faq.title}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isUser = !item.is_admin_message;
                            return (
                                <View style={isUser ? styles.userContainer : styles.adminContainer}>
                                    <View style={isUser ? styles.userMessage : styles.adminMessage}>
                                        {!isUser && (
                                            <View style={styles.adminLabelRow}>
                                                <MaterialCommunityIcons name="face-agent" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                                                <Text style={styles.adminLabelText}>Pesuni Asiakaspalvelu</Text>
                                            </View>
                                        )}
                                        <Text style={isUser ? styles.userMessageText : styles.adminMessageText}>
                                            {item.content}
                                        </Text>
                                        <Text style={isUser ? styles.userTimestamp : styles.adminTimestamp}>
                                            {new Date(item.created_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                            );
                        }}
                        style={styles.messagesList}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    />
                )}
            </View>

            {/* 🔒 SULJETUN KESKUSTELUN INFO & UUDELLEENAVAUSPALKKI 🔒 */}
            {isChatClosed && (
                <View style={styles.closedBanner}>
                    <View style={styles.closedBannerLeft}>
                        <Feather name="archive" size={16} color="#64748B" style={{ marginRight: 8 }} />
                        <Text style={styles.closedBannerText}>Keskustelu on suljettu</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.reopenActionBtn}
                        onPress={handleReopenChat}
                        activeOpacity={0.8}
                    >
                        <Feather name="refresh-cw" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.reopenActionBtnText}>Avaa uudelleen</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ⌨️ ALAPALKKI: NOSTETTU SAFE AREA INSETSIN MUKAAN ⌨️ */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom + 6, 16) }]}>
                    <TextInput
                        style={[styles.textInput, isChatClosed && styles.textInputDisabled]}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder={isChatClosed ? "Avaa keskustelu lähettääksesi viestin" : "Kirjoita viesti asiakaspalvelulle..."}
                        placeholderTextColor="#94A3B8"
                        editable={!isChatClosed}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={isSendDisabled}
                        activeOpacity={0.8}
                    >
                        <Feather name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 12 : 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        zIndex: 10,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: { alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
    statusText: { fontSize: 11, color: COLORS.textGray, fontWeight: '600' },
    chatBackgroundWrapper: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#F1F5F9',
    },
    bgBubble1: {
        position: 'absolute',
        top: 40,
        left: -30,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(0, 194, 255, 0.05)',
    },
    bgBubble2: {
        position: 'absolute',
        top: 250,
        right: -40,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(92, 209, 255, 0.06)',
    },
    bgBubble3: {
        position: 'absolute',
        bottom: 80,
        left: 20,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(0, 153, 255, 0.04)',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messagesList: { flex: 1 },
    messagesContent: { padding: 16, paddingBottom: 24 },
    faqSection: {
        marginBottom: 18,
    },
    welcomeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    welcomeAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    welcomeTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 2,
    },
    welcomeDesc: {
        fontSize: 12,
        color: COLORS.textGray,
        lineHeight: 17,
    },
    faqHeading: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginLeft: 4,
    },
    faqGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    faqChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    faqChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    userContainer: { alignItems: 'flex-end', marginVertical: 5 },
    adminContainer: { alignItems: 'flex-start', marginVertical: 5 },
    userMessage: {
        backgroundColor: COLORS.userMessageBg,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderBottomRightRadius: 4,
        maxWidth: '82%',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    adminMessage: {
        backgroundColor: COLORS.adminMessageBg,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        maxWidth: '84%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    adminLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    adminLabelText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
    },
    userMessageText: { fontSize: 15, color: '#FFFFFF', lineHeight: 21, fontWeight: '500' },
    adminMessageText: { fontSize: 15, color: COLORS.darkText, lineHeight: 21 },
    userTimestamp: { fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', alignSelf: 'flex-end', marginTop: 4 },
    adminTimestamp: { fontSize: 10, color: COLORS.textGray, alignSelf: 'flex-end', marginTop: 4 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 8,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        maxHeight: 100,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        color: COLORS.darkText,
    },
    sendButton: {
        backgroundColor: COLORS.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    sendButtonDisabled: { backgroundColor: '#E2E8F0', elevation: 0 },
    closeHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    closeHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#EF4444',
    },
    reopenHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    reopenHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7',
    },
    closedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    closedBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closedBannerText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    reopenActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    reopenActionBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284C7',
    },
    textInputDisabled: {
        backgroundColor: '#F1F5F9',
        color: '#94A3B8',
    },
});

export default ChatScreen;