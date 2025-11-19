import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Clock, User } from "lucide-react";

interface ChatMessage {
  id: number;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin_message: boolean;
  sender_name?: string;
}

interface SupportChat {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  last_message_at: string;
  user_name?: string;
  messages?: ChatMessage[];
}

export const ChatManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchChats();
    
    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel('chat_messages_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          fetchChats();
          if (selectedChat) {
            fetchChatMessages(selectedChat.id);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchChats = async () => {
    try {
      setLoading(true);
      
      // Fetch all support chats
      const { data: chatsData, error: chatsError } = await supabase
        .from('support_chats')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (chatsError) throw chatsError;

      // Fetch user profiles for chat participants
      const userIds = chatsData?.map(chat => chat.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      // Combine chats with user names
      const chatsWithNames = chatsData?.map(chat => {
        const profile = profilesData?.find(p => p.user_id === chat.user_id);
        return {
          ...chat,
          user_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Tuntematon käyttäjä'
            : 'Tuntematon käyttäjä'
        };
      }) || [];

      setChats(chatsWithNames);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: "Virhe",
        description: "Keskustelujen lataaminen epäonnistui",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (chatId: string) => {
    try {
      // Fetch messages for the selected chat
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Fetch sender profiles
      const senderIds = messagesData?.map(m => m.sender_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', senderIds);

      // Combine messages with sender names
      const messagesWithNames = messagesData?.map(message => {
        const profile = profilesData?.find(p => p.user_id === message.sender_id);
        return {
          ...message,
          sender_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Tuntematon'
            : message.is_admin_message ? 'Admin' : 'Tuntematon'
        };
      }) || [];

      // Update selected chat with messages
      setSelectedChat(prev => prev ? { ...prev, messages: messagesWithNames } : null);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Virhe",
        description: "Viestien lataaminen epäonnistui",
        variant: "destructive",
      });
    }
  };

  const handleSelectChat = async (chat: SupportChat) => {
    setSelectedChat(chat);
    await fetchChatMessages(chat.id);
  };

  const handleSendReply = async () => {
    if (!selectedChat || !replyMessage.trim() || !user) return;

    try {
      setSending(true);

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChat.id,
          sender_id: user.id,
          content: replyMessage.trim(),
          is_admin_message: true
        });

      if (error) throw error;

      // Update last_message_at in support_chats
      await supabase
        .from('support_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedChat.id);

      setReplyMessage("");
      toast({
        title: "Lähetetty",
        description: "Viesti lähetetty onnistuneesti",
      });

      // Refresh messages
      await fetchChatMessages(selectedChat.id);
      await fetchChats();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Virhe",
        description: "Viestin lähettäminen epäonnistui",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="default">Avoin</Badge>;
      case 'closed':
        return <Badge variant="secondary">Suljettu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Ladataan keskusteluja...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Chat List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Keskustelut
          </CardTitle>
          <CardDescription>
            {chats.length} keskustelua
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="space-y-2 p-4">
              {chats.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Ei keskusteluja
                </div>
              ) : (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedChat?.id === chat.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{chat.user_name}</span>
                      </div>
                      {getStatusBadge(chat.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(chat.last_message_at).toLocaleString('fi-FI')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="lg:col-span-2">
        {selectedChat ? (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedChat.user_name}</CardTitle>
                  <CardDescription>
                    Keskustelu aloitettu {new Date(selectedChat.created_at).toLocaleDateString('fi-FI')}
                  </CardDescription>
                </div>
                {getStatusBadge(selectedChat.status)}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100vh-24rem)]">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4 mb-4">
                <div className="space-y-4">
                  {selectedChat.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col ${
                        message.is_admin_message ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.is_admin_message
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {message.sender_name}
                          </span>
                          {message.is_admin_message && (
                            <Badge variant="secondary" className="text-xs">Admin</Badge>
                          )}
                        </div>
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(message.created_at).toLocaleString('fi-FI')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Input */}
              <div className="flex gap-2">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Kirjoita vastaus..."
                  className="flex-1"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || sending}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Valitse keskustelu nähdäksesi viestit
          </div>
        )}
      </Card>
    </div>
  );
};
