import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  content: string;
  created_at: string;
  is_admin_message: boolean | null;
}

export const SupportChatWidget = ({ title = "Chat ylläpidon kanssa" }: { title?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Find or create the user's support chat
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data } = await supabase
        .from("support_chats")
        .select("id, is_read")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setChatId(data[0].id);
        setUnread(!data[0].is_read);
      }
    };
    init();
  }, [user]);

  // Load messages + realtime
  useEffect(() => {
    if (!chatId) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, content, created_at, is_admin_message")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
    };
    load();

    const channel = supabase
      .channel(`support-chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          if (msg.is_admin_message) setUnread(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      let id = chatId;
      if (!id) {
        const { data, error } = await supabase
          .from("support_chats")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setChatId(id);
      }

      const { error: msgError } = await supabase.from("chat_messages").insert({
        chat_id: id,
        sender_id: user.id,
        content: text.trim(),
        is_admin_message: false,
      });
      if (msgError) throw msgError;
      setText("");
    } catch {
      toast({ title: "Virhe", description: "Viestin lähetys epäonnistui", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-elegant p-0"
          aria-label="Avaa chat ylläpidon kanssa"
        >
          <MessageSquare className="h-6 w-6" />
          {unread && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      )}

      {open && (
        <Card className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-96 shadow-elegant">
          <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {title}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOpen(false)} aria-label="Sulje chat">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <div className="p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Lähetä viesti ylläpidolle – vastaamme heti kun ehdimme.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.is_admin_message
                        ? "bg-muted text-foreground"
                        : "ml-auto bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {new Date(m.created_at).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2 border-t p-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Kirjoita viesti..."
                className="h-9 text-sm"
              />
              <Button size="sm" onClick={send} disabled={sending || !text.trim()} className="h-9 px-3">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
