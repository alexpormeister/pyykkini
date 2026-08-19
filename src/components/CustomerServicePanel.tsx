import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Send,
  Truck,
  User,
} from "lucide-react";

type Profile = { user_id: string; first_name: string | null; last_name: string | null; phone: string | null };

interface OrderRow {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  service_name: string;
  final_price: number;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  special_instructions: string | null;
  pickup_date: string;
  pickup_time: string;
  created_at: string;
  access_code: string | null;
}

interface Laundry { id: string; name: string; is_active: boolean }
interface DriverInfo extends Profile { is_active: boolean }

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

interface ComplaintRow {
  id: string;
  order_id: string | null;
  user_id: string | null;
  issue_type: string;
  description: string | null;
  image_urls: string[];
  status: string;
  compensation_amount: number;
  coupon_code: string | null;
  created_at: string;
}

const ACTIVE_GROUPS = [
  { key: "pending", label: "Odottaa kuskia", statuses: ["pending"] },
  { key: "pickup", label: "Noudossa", statuses: ["accepted", "picking_up"] },
  { key: "laundry", label: "Pesulassa", statuses: ["washing"] },
  { key: "delivery", label: "Toimituksessa", statuses: ["returning"] },
];

const ISSUE_LABELS: Record<string, string> = {
  missing_item: "Puuttuva tuote",
  damaged_item: "Vaurioitunut tuote",
  delay: "Viivästys",
  other: "Muu",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Avoin",
  in_progress: "Käsittelyssä",
  resolved: "Ratkaistu",
};

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Tuntematon" : "Tuntematon";

const money = (n: number) => `${Number(n || 0).toFixed(2).replace(".", ",")} €`;

type CSSection = "dispatch" | "inbox" | "complaints" | "crm";

export const CustomerServicePanel = ({ section }: { section?: CSSection }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [crmQuery, setCrmQuery] = useState("");
  const [crmSelectedUser, setCrmSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("customer_service_center")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_chats" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, laundriesRes, chatsRes, messagesRes, complaintsRes, rolesRes, shiftsRes] =
        await Promise.all([
          supabase.from("orders").select("*").order("created_at", { ascending: false }),
          supabase.from("laundries").select("id, name, is_active").order("name"),
          supabase.from("support_chats").select("*").order("last_message_at", { ascending: false }),
          supabase.from("chat_messages").select("*").order("created_at", { ascending: true }),
          supabase.from("complaints").select("*").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
        ]);

      const orderRows = (ordersRes.data || []) as unknown as OrderRow[];
      setOrders(orderRows);
      setLaundries((laundriesRes.data || []) as Laundry[]);
      setChats((chatsRes.data || []) as ChatRow[]);
      setMessages((messagesRes.data || []) as MessageRow[]);
      setComplaints(((complaintsRes.data || []) as unknown as ComplaintRow[]));

      const roles: Record<string, string> = {};
      (rolesRes.data || []).forEach((r: any) => {
        if (r.role === "admin" || !roles[r.user_id]) roles[r.user_id] = r.role;
      });
      setRoleMap(roles);

      const ids = new Set<string>();
      orderRows.forEach((o) => {
        ids.add(o.user_id);
        if (o.driver_id) ids.add(o.driver_id);
      });
      (chatsRes.data || []).forEach((c: any) => ids.add(c.user_id));
      Object.keys(roles).forEach((id) => ids.add(id));

      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, phone")
        .in("user_id", Array.from(ids));
      const profileRows = (profileData || []) as Profile[];
      setProfiles(profileRows);

      const activeDriverIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id));
      const driverIds = Object.entries(roles)
        .filter(([, role]) => role === "driver")
        .map(([id]) => id);
      setDrivers(
        driverIds.map((id) => {
          const p = profileRows.find((pr) => pr.user_id === id);
          return {
            user_id: id,
            first_name: p?.first_name || null,
            last_name: p?.last_name || null,
            phone: p?.phone || null,
            is_active: activeDriverIds.has(id),
          };
        })
      );
    } catch (error) {
      console.error("Error loading customer service data:", error);
      toast({ title: "Virhe", description: "Tietojen lataaminen epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const profileOf = (id?: string | null) => profiles.find((p) => p.user_id === id) || null;
  const laundryName = (id?: string | null) => laundries.find((l) => l.id === id)?.name || "Ei valittua pesulaa";
  const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

  const isLate = (order: OrderRow) => {
    const pickup = new Date(`${order.pickup_date}T${order.pickup_time}`);
    return pickup.getTime() < Date.now();
  };
  const isSoon = (order: OrderRow) => {
    const pickup = new Date(`${order.pickup_date}T${order.pickup_time}`).getTime();
    const diff = pickup - Date.now();
    return diff > 0 && diff < 3 * 60 * 60 * 1000;
  };

  const activeOrders = useMemo(
    () => orders.filter((o) => !["delivered", "rejected", "cancelled"].includes(o.status)),
    [orders]
  );

  const alerts = activeOrders.filter((o) => !o.driver_id && (isLate(o) || isSoon(o)));

  const assignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: driverId, status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) {
      toast({ title: "Virhe", description: "Kuljettajan asettaminen epäonnistui", variant: "destructive" });
      return;
    }
    toast({ title: "Kuljettaja asetettu" });
    fetchAll();
  };

  const changeLaundry = async (orderId: string, laundryId: string) => {
    const { error } = await supabase.from("orders").update({ laundry_id: laundryId }).eq("id", orderId);
    if (error) {
      toast({ title: "Virhe", description: "Pesulan vaihto epäonnistui", variant: "destructive" });
      return;
    }
    toast({ title: "Pesula vaihdettu" });
    fetchAll();
  };

  // ---- Inbox helpers ----
  const chatGroups = useMemo(() => {
    const groups: Record<string, ChatRow[]> = { customer: [], driver: [], laundry: [] };
    chats.forEach((c) => {
      const role = roleMap[c.user_id];
      if (role === "driver") groups.driver.push(c);
      else groups.customer.push(c);
    });
    return groups;
  }, [chats, roleMap]);

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;
  const chatMessages = messages.filter((m) => m.chat_id === selectedChatId);
  const latestOrderFor = (userId?: string | null) =>
    orders.find((o) => o.user_id === userId) || null;
  const selectedChatOrder = latestOrderFor(selectedChat?.user_id);

  const openChat = async (chat: ChatRow) => {
    setSelectedChatId(chat.id);
    if (!chat.is_read) {
      await supabase.from("support_chats").update({ is_read: true }).eq("id", chat.id);
      fetchAll();
    }
  };

  const sendReply = async () => {
    if (!selectedChat || !reply.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      chat_id: selectedChat.id,
      sender_id: user.id,
      content: reply.trim(),
      is_admin_message: true,
    });
    setSending(false);
    if (error) {
      toast({ title: "Virhe", description: "Viestin lähetys epäonnistui", variant: "destructive" });
      return;
    }
    setReply("");
    fetchAll();
  };

  // ---- Complaints ----
  const updateComplaint = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("complaints").update(patch as never).eq("id", id);
    if (error) {
      toast({ title: "Virhe", description: "Päivitys epäonnistui", variant: "destructive" });
      return;
    }
    toast({ title: "Tallennettu" });
    fetchAll();
  };

  // ---- CRM ----
  const crmResults = useMemo(() => {
    const q = crmQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return orders
      .filter((o) =>
        [o.id, o.first_name, o.last_name, o.phone, o.address, o.access_code || ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 25);
  }, [crmQuery, orders]);

  const crmUserOrders = orders.filter((o) => o.user_id === crmSelectedUser);
  const crmUserChats = chats.filter((c) => c.user_id === crmSelectedUser);
  const crmUserMessages = messages.filter((m) => crmUserChats.some((c) => c.id === m.chat_id)).slice(-10);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Ladataan asiakaspalvelutietoja...</div>;
  }

  return (
    <Tabs value={section ?? undefined} defaultValue={section ? undefined : "dispatch"} className="space-y-4">
      {!section && (
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 h-auto">
          <TabsTrigger value="dispatch" className="text-xs sm:text-sm">Välitys</TabsTrigger>
          <TabsTrigger value="inbox" className="text-xs sm:text-sm">
            Viestit{chats.filter((c) => !c.is_read).length > 0 ? ` (${chats.filter((c) => !c.is_read).length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="crm" className="text-xs sm:text-sm">Tilaushaku</TabsTrigger>
        </TabsList>
      )}

      {/* --- 1. Dispatch --- */}
      <TabsContent value="dispatch" className="space-y-4 animate-fade-in">
        {alerts.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">{alerts.length} tilausta vaatii huomiota</p>
                <p className="text-muted-foreground">Ei kuljettajaa, ja noutoaika on lähellä tai ohitettu.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ACTIVE_GROUPS.map((group) => {
            const groupOrders = activeOrders.filter((o) => group.statuses.includes(o.status));
            return (
              <Card key={group.key}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{group.label}</span>
                    <Badge variant="secondary">{groupOrders.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {groupOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground">Ei tilauksia</p>
                  )}
                  {groupOrders.map((order) => {
                    const late = !order.driver_id && isLate(order);
                    const soon = !order.driver_id && isSoon(order);
                    return (
                      <div
                        key={order.id}
                        className={`rounded-lg border p-3 space-y-2 ${
                          late
                            ? "border-destructive bg-destructive/5"
                            : soon
                            ? "border-amber-500 bg-amber-500/5"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {order.first_name} {order.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{order.address}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{shortId(order.id)}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(`${order.pickup_date}T${order.pickup_time}`).toLocaleString("fi-FI", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {late && <Badge variant="destructive" className="text-[10px]">Myöhässä</Badge>}
                          {soon && <Badge className="text-[10px] bg-amber-500 text-white">Kiireellinen</Badge>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Select
                            value={order.driver_id || ""}
                            onValueChange={(v) => assignDriver(order.id, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Aseta kuljettaja" />
                            </SelectTrigger>
                            <SelectContent>
                              {drivers.map((d) => (
                                <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                                  {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={order.laundry_id || ""}
                            onValueChange={(v) => changeLaundry(order.id, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Valitse pesula" />
                            </SelectTrigger>
                            <SelectContent>
                              {laundries.map((l) => (
                                <SelectItem key={l.id} value={l.id} className="text-xs">
                                  {l.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      {/* --- 2. Inbox --- */}
      <TabsContent value="inbox" className="animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Keskustelut
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[26rem]">
                <div className="p-4 space-y-4">
                  {[
                    { key: "customer", label: "Asiakasviestit" },
                    { key: "driver", label: "Kuljettajaviestit" },
                    { key: "laundry", label: "Pesulaviestit" },
                  ].map((section) => (
                    <div key={section.key} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {section.label}
                      </p>
                      {chatGroups[section.key].length === 0 && (
                        <p className="text-xs text-muted-foreground">Ei keskusteluja</p>
                      )}
                      {chatGroups[section.key].map((chat) => {
                        const order = latestOrderFor(chat.user_id);
                        return (
                          <button
                            key={chat.id}
                            onClick={() => openChat(chat)}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              selectedChatId === chat.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {fullName(profileOf(chat.user_id))}
                              </span>
                              {!chat.is_read && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Uusi</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {order ? shortId(order.id) : "Ei tilausta"} ·{" "}
                              {new Date(chat.last_message_at).toLocaleDateString("fi-FI")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedChat ? (
              <>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base">{fullName(profileOf(selectedChat.user_id))}</CardTitle>
                  {selectedChatOrder ? (
                    <CardDescription className="text-xs space-y-0.5">
                      <span className="block">
                        {shortId(selectedChatOrder.id)} · {selectedChatOrder.address}
                      </span>
                      <span className="block">
                        Pesula: {laundryName(selectedChatOrder.laundry_id)} · Kuski:{" "}
                        {selectedChatOrder.driver_id ? fullName(profileOf(selectedChatOrder.driver_id)) : "Ei kuskia"}
                      </span>
                    </CardDescription>
                  ) : (
                    <CardDescription className="text-xs">Ei liitettyä tilausta</CardDescription>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="p-4 flex flex-col h-[22rem]">
                  <ScrollArea className="flex-1 pr-3 mb-3">
                    <div className="space-y-3">
                      {chatMessages.map((m) => (
                        <div key={m.id} className={`flex ${m.is_admin_message ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-lg p-3 text-sm ${
                              m.is_admin_message ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            <p>{m.content}</p>
                            <p className="text-[10px] opacity-70 mt-1">
                              {new Date(m.created_at).toLocaleString("fi-FI", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Kirjoita vastaus..."
                      rows={2}
                      className="flex-1 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <Button onClick={sendReply} disabled={!reply.trim() || sending} className="self-end">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-[26rem] text-sm text-muted-foreground">
                Valitse keskustelu
              </div>
            )}
          </Card>
        </div>
      </TabsContent>


      {/* --- 4. CRM --- */}
      <TabsContent value="crm" className="animate-fade-in space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={crmQuery}
            onChange={(e) => setCrmQuery(e.target.value)}
            placeholder="Hae tilausnumerolla, nimellä, puhelimella tai osoitteella"
            className="pl-10"
          />
        </div>

        {crmQuery.trim().length >= 2 && (
          <Card>
            <CardContent className="p-2">
              {crmResults.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Ei tuloksia</p>
              ) : (
                crmResults.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setCrmSelectedUser(o.user_id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {o.first_name} {o.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{shortId(o.id)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.address} · {o.phone}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {crmSelectedUser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Asiakas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <p className="font-medium">{fullName(profileOf(crmSelectedUser))}</p>
                <p className="text-muted-foreground text-xs">{profileOf(crmSelectedUser)?.phone || "Ei puhelinta"}</p>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Tilauksia {crmUserOrders.length} kpl · Yhteensä{" "}
                  {money(crmUserOrders.reduce((s, o) => s + Number(o.final_price || 0), 0))}
                </p>
                {crmUserOrders.some((o) => o.special_instructions) && (
                  <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
                    <p className="font-medium">Lisätiedot / ovikoodit</p>
                    {Array.from(
                      new Set(crmUserOrders.map((o) => o.special_instructions).filter(Boolean) as string[])
                    ).map((note) => (
                      <p key={note} className="text-muted-foreground">{note}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Tilaushistoria
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ScrollArea className="h-52 pr-3">
                  <div className="space-y-2">
                    {crmUserOrders.map((o) => (
                      <div key={o.id} className="rounded-lg border p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{shortId(o.id)}</span>
                          <span>{money(o.final_price)}</span>
                        </div>
                        <p className="text-muted-foreground truncate">{o.service_name}</p>
                        <p className="text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("fi-FI")} · {o.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Aiemmat viestit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {crmUserMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ei viestejä</p>
                ) : (
                  crmUserMessages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-medium">{m.is_admin_message ? "Tuki" : "Asiakas"}: </span>
                      <span className="text-muted-foreground">{m.content}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default CustomerServicePanel;