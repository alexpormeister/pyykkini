import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Truck,
  User,
  WashingMachine,
  X,
} from "lucide-react";

interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface ChatRow {
  id: string;
  user_id: string;
  status: string;
  is_read: boolean;
  created_at: string;
  last_message_at: string;
}

interface MessageRow {
  id: number;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin_message: boolean | null;
}

interface OrderRow {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  service_name: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  return_date?: string | null;
  return_time?: string | null;
}

interface Laundry {
  id: string;
  name: string;
}

const fullName = (p?: Profile | null) =>
  p ? (p.first_name || "") + " " + (p.last_name || "").trim() || "Tuntematon" : "Tuntematon käyttäjä";

const shortId = (id: string) => "#" + id.slice(0, 8).toUpperCase();

const QUICK_REPLIES = [
  "👋 Hei! Selvitämme asian heti ja palaamme sinulle.",
  "🚚 Kuljettaja on parhaillaan matkalla osoitteeseesi.",
  "🧺 Pyykkisi ovat nyt pesulassa käsittelyssä.",
  "✅ Asia on nyt hoidettu ja kunnossa! Mukavaa päivänjatkoa.",
];

export const SupportChatInbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | "driver">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected chat & reply
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [chatsRes, messagesRes, ordersRes, laundriesRes, rolesRes] = await Promise.all([
        supabase.from("support_chats").select("*").order("last_message_at", { ascending: false }),
        supabase.from("chat_messages").select("*").order("created_at", { ascending: true }),
        supabase.from("orders").select("id, user_id, driver_id, laundry_id, status, service_name, address, pickup_date, pickup_time, return_date, return_time").order("created_at", { ascending: false }),
        supabase.from("laundries").select("id, name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const chatRows = (chatsRes.data || []) as ChatRow[];
      const msgRows = (messagesRes.data || []) as MessageRow[];
      const ordRows = (ordersRes.data || []) as OrderRow[];
      setChats(chatRows);
      setMessages(msgRows);
      setOrders(ordRows);
      setLaundries((laundriesRes.data || []) as Laundry[]);

      const roles: Record<string, string> = {};
      (rolesRes.data || []).forEach((r: any) => {
        if (r.role === "admin" || !roles[r.user_id]) roles[r.user_id] = r.role;
      });
      setRoleMap(roles);

      const userIds = new Set<string>();
      chatRows.forEach((c) => userIds.add(c.user_id));
      ordRows.forEach((o) => {
        userIds.add(o.user_id);
        if (o.driver_id) userIds.add(o.driver_id);
      });

      if (userIds.size > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", Array.from(userIds));
        setProfiles((profData || []) as Profile[]);
      }
    } catch (err: any) {
      console.error("Support chats fetch error:", err);
      toast({ title: "Virhe", description: "Viestien lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("support_inbox_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_chats" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const profileOf = (id?: string | null) => profiles.find((p) => p.user_id === id) || null;
  const laundryName = (id?: string | null) => laundries.find((l) => l.id === id)?.name || "Ei pesulaa";

  const selectedChat = useMemo(() => chats.find((c) => c.id === selectedChatId) || null, [chats, selectedChatId]);
  const chatMessages = useMemo(() => messages.filter((m) => m.chat_id === selectedChatId), [messages, selectedChatId]);
  const latestOrder = useMemo(() => orders.find((o) => o.user_id === selectedChat?.user_id) || null, [orders, selectedChat]);

  // Viimeisin viesti keskustelusta
  const lastMessageOf = (chatId: string) => {
    const msgs = messages.filter((m) => m.chat_id === chatId);
    return msgs[msgs.length - 1] || null;
  };

  // Onko keskustelu avoin (vaatii toimenpidettä)
  const isChatOpen = (chat: ChatRow) => {
    return chat.status !== "closed" && chat.status !== "resolved";
  };

  // Suodatetut keskustelut
  const filteredChats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return chats.filter((chat) => {
      // 1. Tila (Open vs Closed vs All)
      const open = isChatOpen(chat);
      if (statusFilter === "open" && !open) return false;
      if (statusFilter === "closed" && open) return false;

      // 2. Rooli (Customer vs Driver)
      const role = roleMap[chat.user_id] || "customer";
      if (roleFilter === "customer" && role !== "customer") return false;
      if (roleFilter === "driver" && role !== "driver") return false;

      // 3. Hakukenttä (Nimi, puhelin, viesti, tilausID)
      if (q) {
        const prof = profileOf(chat.user_id);
        const name = fullName(prof).toLowerCase();
        const phone = (prof?.phone || "").toLowerCase();
        const ord = orders.find((o) => o.user_id === chat.user_id);
        const ordId = ord ? ord.id.toLowerCase() : "";
        const lastMsg = (lastMessageOf(chat.id)?.content || "").toLowerCase();

        const match = name.includes(q) || phone.includes(q) || ordId.includes(q) || lastMsg.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [chats, statusFilter, roleFilter, searchQuery, roleMap, profiles, orders, messages]);

  // Tilastolaskennat
  const openCount = useMemo(() => chats.filter((c) => isChatOpen(c)).length, [chats]);
  const closedCount = useMemo(() => chats.filter((c) => !isChatOpen(c)).length, [chats]);

  // Avaa keskustelu ja merkitse luetuksi
  const openChat = async (chat: ChatRow) => {
    setSelectedChatId(chat.id);
    if (!chat.is_read) {
      await supabase.from("support_chats").update({ is_read: true }).eq("id", chat.id);
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, is_read: true } : c)));
    }
  };

  // Muuta keskustelun tilaa (Avoin <-> Hoidettu)
  const toggleChatStatus = async (chatId: string, currentStatus: string) => {
    const newStatus = currentStatus === "closed" || currentStatus === "resolved" ? "open" : "closed";
    const { error } = await supabase.from("support_chats").update({ status: newStatus }).eq("id", chatId);
    if (error) {
      toast({ title: "Virhe", description: "Tilan päivitys epäonnistui", variant: "destructive" });
      return;
    }
    toast({
      title: newStatus === "closed" ? "Keskustelu merkitty hoidetuksi ✅" : "Keskustelu avattu uudelleen 🔄",
      description: newStatus === "closed" ? "Asia on kuitattu ratkaistuksi." : "Keskustelu on nyt avoimissa.",
    });
    fetchAll();
  };

  // Lähetä vastaus
  const sendReply = async () => {
    if (!selectedChat || !replyText.trim() || !user) return;
    setSending(true);
    try {
      const nowIso = new Date().toISOString();
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        chat_id: selectedChat.id,
        sender_id: user.id,
        content: replyText.trim(),
        is_admin_message: true,
      });
      if (msgErr) throw msgErr;

      // Päivitä last_message_at ja varmista status = open jos vastataan
      await supabase
        .from("support_chats")
        .update({ last_message_at: nowIso, is_read: true })
        .eq("id", selectedChat.id);

      setReplyText("");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Viestin lähetys epäonnistui", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ladataan asiakaspalveluviestejä...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Filter & Overview Bar */}
      <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Status Category Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={statusFilter === "open" ? "default" : "outline"}
            onClick={() => setStatusFilter("open")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Avoimet / Hoidettavat
            <Badge variant={statusFilter === "open" ? "secondary" : "default"} className="ml-1 text-[11px] px-1.5 py-0">
              {openCount}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "closed" ? "default" : "outline"}
            onClick={() => setStatusFilter("closed")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Hoidetut
            <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0">
              {closedCount}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className="h-8 text-xs font-semibold"
          >
            Kaikki ({chats.length})
          </Button>
        </div>

        {/* Right: Role Filter & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role selector */}
          <div className="flex items-center bg-muted p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setRoleFilter("all")}
              className={"px-2.5 py-1 rounded-md text-xs font-medium transition-all " + (roleFilter === "all" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground")}
            >
              Kaikki
            </button>
            <button
              onClick={() => setRoleFilter("customer")}
              className={"px-2.5 py-1 rounded-md text-xs font-medium transition-all " + (roleFilter === "customer" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground")}
            >
              Asiakkaat
            </button>
            <button
              onClick={() => setRoleFilter("driver")}
              className={"px-2.5 py-1 rounded-md text-xs font-medium transition-all " + (roleFilter === "driver" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground")}
            >
              Kuljettajat
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Etsi nimellä, viestillä..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs w-full sm:w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => fetchAll(true)} disabled={refreshing}>
            <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      {/* Main Split View: Left List (1 col), Right Chat (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Chat Conversations List */}
        <Card className="lg:col-span-1 border shadow-sm flex flex-col h-[650px] overflow-hidden">
          <CardHeader className="p-3 bg-muted/40 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider">
                {statusFilter === "open" ? "Hoidettavat keskustelut" : statusFilter === "closed" ? "Hoidetut keskustelut" : "Kaikki keskustelut"}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {filteredChats.length} kpl
            </Badge>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {filteredChats.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-xs italic space-y-2">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
                    <p>{statusFilter === "open" ? "Ei avoimia hoidettavia viestejä! 🎉" : "Ei keskusteluja valituilla suodattimilla."}</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const prof = profileOf(chat.user_id);
                    const isSelected = selectedChatId === chat.id;
                    const role = roleMap[chat.user_id] || "customer";
                    const lastMsg = lastMessageOf(chat.id);
                    const open = isChatOpen(chat);
                    const ord = orders.find((o) => o.user_id === chat.user_id);

                    const isAwaitingAdmin = lastMsg && !lastMsg.is_admin_message && open;

                    return (
                      <button
                        key={chat.id}
                        onClick={() => openChat(chat)}
                        className={"w-full text-left rounded-lg p-3 transition-all border text-xs space-y-1.5 " +
                          (isSelected
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "hover:bg-muted/60 border-border/60 bg-card")}
                      >
                        {/* Header: Name, Role & Status Badges */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-foreground truncate">
                              {fullName(prof)}
                            </span>
                            <Badge
                              variant="secondary"
                              className={"text-[9px] px-1 py-0 uppercase shrink-0 " +
                                (role === "driver" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground")}
                            >
                              {role === "driver" ? "Kuljettaja" : "Asiakas"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!chat.is_read && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 font-bold">
                                Uusi
                              </Badge>
                            )}
                            {isAwaitingAdmin && (
                              <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500 text-white font-semibold">
                                Vastaa
                              </Badge>
                            )}
                            {!open && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-300">
                                Hoidettu
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Last message preview */}
                        <p className="text-muted-foreground line-clamp-2 text-[11px]">
                          {lastMsg ? (
                            <>
                              <span className="font-semibold text-foreground/80">
                                {lastMsg.is_admin_message ? "Ylläpito: " : (prof?.first_name || "Käyttäjä") + ": "}
                              </span>
                              {lastMsg.content}
                            </>
                          ) : (
                            "Ei viestejä vielä"
                          )}
                        </p>

                        {/* Footer info: Order & timestamp */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>{ord ? shortId(ord.id) : "Ei aktiivista tilausta"}</span>
                          <span>
                            {new Date(chat.last_message_at || chat.created_at).toLocaleDateString("fi-FI", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Active Chat Conversation Panel */}
        <Card className="lg:col-span-2 border shadow-sm flex flex-col h-[650px] overflow-hidden">
          {selectedChat ? (
            <>
              {/* Active Chat Header */}
              <CardHeader className="p-3 bg-muted/40 border-b flex flex-row items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold truncate">
                      {fullName(profileOf(selectedChat.user_id))}
                    </CardTitle>
                    <Badge
                      variant={isChatOpen(selectedChat) ? "default" : "outline"}
                      className={"text-[10px] px-1.5 py-0 font-semibold " +
                        (isChatOpen(selectedChat) ? "bg-amber-500 text-white" : "bg-emerald-50 text-emerald-700 border-emerald-300")}
                    >
                      {isChatOpen(selectedChat) ? "Avoin / Odottaa" : "Hoidettu"}
                    </Badge>
                  </div>

                  {/* Profile & Order subline */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {profileOf(selectedChat.user_id)?.phone && (
                      <a
                        href={"tel:" + profileOf(selectedChat.user_id)?.phone}
                        className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {profileOf(selectedChat.user_id)?.phone}
                      </a>
                    )}

                    {latestOrder && (
                      <span className="text-[11px]">
                        • Tilaus {shortId(latestOrder.id)} ({latestOrder.service_name}) · {latestOrder.address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Header Action: Resolve / Reopen Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant={isChatOpen(selectedChat) ? "default" : "outline"}
                    className={"h-8 text-xs font-semibold " +
                      (isChatOpen(selectedChat) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-amber-700 border-amber-300 hover:bg-amber-50")}
                    onClick={() => toggleChatStatus(selectedChat.id, selectedChat.status)}
                  >
                    {isChatOpen(selectedChat) ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Merkitse hoidetuksi
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Avaa uudelleen
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              {/* Chat Message Stream */}
              <CardContent className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
                <ScrollArea className="flex-1 pr-3 mb-3">
                  <div className="space-y-3">
                    {chatMessages.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8 italic">Ei vielä viestejä tässä keskustelussa.</p>
                    ) : (
                      chatMessages.map((m) => (
                        <div key={m.id} className={"flex " + (m.is_admin_message ? "justify-end" : "justify-start")}>
                          <div
                            className={"max-w-[80%] rounded-xl p-3 text-xs shadow-xs space-y-1 " +
                              (m.is_admin_message
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-muted text-foreground rounded-tl-none border")}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            <p className={"text-[9px] text-right " + (m.is_admin_message ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {new Date(m.created_at).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Quick Reply Presets */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mr-1">
                      <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Pikavastaukset:
                    </span>
                    {QUICK_REPLIES.map((replyTextOption, idx) => (
                      <button
                        key={idx}
                        onClick={() => setReplyText(replyTextOption)}
                        className="text-[10px] bg-muted/60 hover:bg-muted text-foreground/80 px-2 py-0.5 rounded border transition-all truncate max-w-[200px]"
                        title={replyTextOption}
                      >
                        {replyTextOption}
                      </button>
                    ))}
                  </div>

                  {/* Input Form */}
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Kirjoita vastaus asiakkaalle / kuljettajalle... (Enter lähettää)"
                      rows={2}
                      className="flex-1 text-xs resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      size="sm"
                      className="h-10 px-4 text-xs shrink-0"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      {sending ? "..." : "Lähetä"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 space-y-2">
              <Inbox className="h-12 w-12 opacity-30 text-primary" />
              <p className="text-sm font-semibold">Ei valittua keskustelua</p>
              <p className="text-xs max-w-sm">Valitse vasemmalta keskustelu vastataksesi viesteihin tai kuitataksesi asioita hoidetuiksi.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
