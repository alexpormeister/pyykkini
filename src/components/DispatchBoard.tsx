import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  Send,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";

interface OrderRow {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  tracking_status: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  created_at: string;
}

interface ItemRow {
  order_id: string;
  product_name: string | null;
  service_name: string;
  quantity: number;
}

interface Profile { user_id: string; first_name: string | null; last_name: string | null; phone: string | null }
interface DriverInfo extends Profile { is_active: boolean }
interface Laundry { id: string; name: string }
interface MessageRow {
  id: number;
  chat_id: string;
  content: string;
  created_at: string;
  is_admin_message: boolean | null;
}

const COLUMNS = [
  { key: "waiting", label: "Odottaa noutoa", hint: "Ei kuskia", icon: AlertTriangle },
  { key: "pickup", label: "Noudossa", hint: "Kuski matkalla", icon: Truck },
  { key: "laundry", label: "Pesulassa", hint: "Käsittelyssä", icon: Package },
  { key: "waiting_return", label: "Odottaa palautuskuskia", hint: "Valmis pesulassa", icon: Clock },
  { key: "delivery", label: "Toimituksessa", hint: "Matkalla asiakkaalle", icon: Truck },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
type QuickFilter = "all" | "alerts" | "today";

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Tuntematon" : "Tuntematon";

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const cityOf = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const cleaned = tail.replace(/\d{5}/g, "").replace(/finland|suomi/i, "").trim();
  return cleaned || "Muu alue";
};

const areaOf = (address: string) => {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(1).join(", ");
  return parts[0] || "-";
};

const timeWindow = (date: string, time: string) =>
  new Date(`${date}T${time}`).toLocaleString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const DispatchBoard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<QuickFilter>("all");
  const [city, setCity] = useState<string>("all");

  const [scheduleOrder, setScheduleOrder] = useState<OrderRow | null>(null);
  const [schedule, setSchedule] = useState({ pickup_date: "", pickup_time: "", return_date: "", return_time: "" });

  const [chatOrder, setChatOrder] = useState<OrderRow | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageRow[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("dispatch_board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, itemsRes, laundriesRes, rolesRes, shiftsRes] = await Promise.all([
        supabase.from("orders").select("*").order("pickup_date", { ascending: true }),
        supabase.from("order_items").select("order_id, product_name, service_name, quantity"),
        supabase.from("laundries").select("id, name").eq("is_active", true).order("name"),
        supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
        supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
      ]);

      setOrders((ordersRes.data || []) as unknown as OrderRow[]);
      setItems((itemsRes.data || []) as ItemRow[]);
      setLaundries((laundriesRes.data || []) as Laundry[]);

      const driverIds = (rolesRes.data || []).map((r: any) => r.user_id as string);
      const activeIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id as string));
      const { data: profileData } = driverIds.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name, phone").in("user_id", driverIds)
        : { data: [] as Profile[] };
      setDrivers(
        driverIds.map((id) => {
          const p = (profileData as Profile[] | null)?.find((pr) => pr.user_id === id);
          return {
            user_id: id,
            first_name: p?.first_name || null,
            last_name: p?.last_name || null,
            phone: p?.phone || null,
            is_active: activeIds.has(id),
          };
        })
      );
    } catch (error) {
      console.error("Dispatch load error:", error);
      toast({ title: "Virhe", description: "Välitystietojen lataaminen epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = useMemo(
    () => orders.filter((o) => !["delivered", "rejected", "cancelled"].includes(o.status)),
    [orders]
  );

  const pickupAt = (o: OrderRow) => new Date(`${o.pickup_date}T${o.pickup_time}`).getTime();
  const isLate = (o: OrderRow) => pickupAt(o) < Date.now() && !["returning"].includes(o.status);
  const isUrgent = (o: OrderRow) => {
    const diff = pickupAt(o) - Date.now();
    return diff > 0 && diff < 30 * 60 * 1000;
  };
  const hasAlert = (o: OrderRow) => (!o.driver_id && (isLate(o) || isUrgent(o))) || (!!o.driver_id && isLate(o));

  const columnOf = (o: OrderRow): ColumnKey => {
    const t = (o.tracking_status || "").toUpperCase();
    if (!o.driver_id || o.status === "pending") return "waiting";
    if (o.status === "returning" || t === "OUT_FOR_DELIVERY") return "delivery";
    if (t === "PACKAGING") return "waiting_return";
    if (o.status === "washing" || t === "WASHING") return "laundry";
    return "pickup";
  };

  const cities = useMemo(
    () => Array.from(new Set(activeOrders.map((o) => cityOf(o.address)))).sort(),
    [activeOrders]
  );

  const isToday = (o: OrderRow) => o.pickup_date === new Date().toISOString().split("T")[0];

  const filteredOrders = useMemo(
    () =>
      activeOrders.filter((o) => {
        if (city !== "all" && cityOf(o.address) !== city) return false;
        if (filter === "alerts" && !hasAlert(o)) return false;
        if (filter === "today" && !isToday(o)) return false;
        return true;
      }),
    [activeOrders, city, filter]
  );

  const kpis = useMemo(() => {
    const byColumn = (key: ColumnKey) => activeOrders.filter((o) => columnOf(o) === key).length;
    return {
      alerts: activeOrders.filter(hasAlert).length,
      pickup: byColumn("pickup"),
      laundry: byColumn("laundry"),
      delivery: byColumn("delivery"),
      driversFree: drivers.filter((d) => d.is_active && !activeOrders.some((o) => o.driver_id === d.user_id)).length,
      driversBusy: drivers.filter((d) => activeOrders.some((o) => o.driver_id === d.user_id)).length,
    };
  }, [activeOrders, drivers]);

  const itemTags = (orderId: string) =>
    items
      .filter((i) => i.order_id === orderId)
      .slice(0, 4)
      .map((i) => `${i.quantity} × ${i.product_name || i.service_name}`);

  const driverOf = (id: string | null) => drivers.find((d) => d.user_id === id) || null;
  const laundryName = (id: string | null) => laundries.find((l) => l.id === id)?.name || "Pesula puuttuu";

  const assignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: driverId, status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) return toast({ title: "Virhe", description: "Kuskin asetus epäonnistui", variant: "destructive" });
    toast({ title: "Kuski määritetty" });
    fetchAll();
  };

  const changeLaundry = async (orderId: string, laundryId: string) => {
    const { error } = await supabase.from("orders").update({ laundry_id: laundryId }).eq("id", orderId);
    if (error) return toast({ title: "Virhe", description: "Pesulan vaihto epäonnistui", variant: "destructive" });
    toast({ title: "Pesula vaihdettu" });
    fetchAll();
  };

  const openSchedule = (o: OrderRow) => {
    setScheduleOrder(o);
    setSchedule({
      pickup_date: o.pickup_date,
      pickup_time: o.pickup_time?.slice(0, 5) || "",
      return_date: o.return_date,
      return_time: o.return_time?.slice(0, 5) || "",
    });
  };

  const saveSchedule = async () => {
    if (!scheduleOrder) return;
    const { error } = await supabase.from("orders").update(schedule).eq("id", scheduleOrder.id);
    if (error) return toast({ title: "Virhe", description: "Aikataulun tallennus epäonnistui", variant: "destructive" });
    toast({ title: "Aikataulu päivitetty" });
    setScheduleOrder(null);
    fetchAll();
  };

  const openChat = async (o: OrderRow) => {
    setChatOrder(o);
    setChatMessages([]);
    const { data: chats } = await supabase
      .from("support_chats")
      .select("id")
      .eq("user_id", o.user_id)
      .order("last_message_at", { ascending: false })
      .limit(1);
    if (chats && chats.length > 0) {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, chat_id, content, created_at, is_admin_message")
        .eq("chat_id", chats[0].id)
        .order("created_at", { ascending: true });
      setChatMessages((data || []) as MessageRow[]);
    }
  };

  const sendChat = async () => {
    if (!chatOrder || !user || !chatText.trim()) return;
    setChatSending(true);
    try {
      const { data: chats } = await supabase
        .from("support_chats")
        .select("id")
        .eq("user_id", chatOrder.user_id)
        .order("last_message_at", { ascending: false })
        .limit(1);
      let chatId = chats?.[0]?.id as string | undefined;
      if (!chatId) {
        const { data, error } = await supabase
          .from("support_chats")
          .insert({ user_id: chatOrder.user_id })
          .select("id")
          .single();
        if (error) throw error;
        chatId = data.id;
      }
      const { error: msgError } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: chatText.trim(),
        is_admin_message: true,
      });
      if (msgError) throw msgError;
      setChatText("");
      toast({ title: "Viesti lähetetty" });
      openChat(chatOrder);
    } catch {
      toast({ title: "Virhe", description: "Viestin lähetys epäonnistui", variant: "destructive" });
    } finally {
      setChatSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Ladataan välitysnäkymää...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div
          className={`rounded-xl border p-3 ${
            kpis.alerts > 0 ? "border-destructive bg-destructive/5" : "bg-card"
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className={`h-3.5 w-3.5 ${kpis.alerts > 0 ? "text-destructive" : ""}`} />
            Kriittiset
          </div>
          <p className={`text-2xl font-bold ${kpis.alerts > 0 ? "text-destructive" : ""}`}>{kpis.alerts}</p>
          <p className="text-[11px] text-muted-foreground">Ei kuskia &lt; 30 min tai myöhässä</p>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> Noudossa
          </div>
          <p className="text-2xl font-bold">{kpis.pickup}</p>
          <p className="text-[11px] text-muted-foreground">Kuski matkalla</p>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Pesulassa / Toimituksessa
          </div>
          <p className="text-2xl font-bold">
            {kpis.laundry} <span className="text-muted-foreground">/</span> {kpis.delivery}
          </p>
          <p className="text-[11px] text-muted-foreground">Käsittelyssä ja jaossa</p>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Kuskit
          </div>
          <p className="text-2xl font-bold">
            {kpis.driversFree} <span className="text-muted-foreground">/ {kpis.driversBusy}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">Vapaat / työssä</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "all", label: "Kaikki" },
          { key: "alerts", label: "Vain hälytykset" },
          { key: "today", label: "Tänään" },
        ] as { key: QuickFilter; label: string }[]).map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            className="h-8 text-xs"
          >
            {f.label}
          </Button>
        ))}
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Alue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Kaikki alueet</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colOrders = filteredOrders.filter((o) => columnOf(o) === col.key);
          const Icon = col.icon;
          return (
            <Card key={col.key} className="bg-muted/30">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{col.label}</span>
                  </span>
                  <Badge variant={col.key === "waiting" && colOrders.length > 0 ? "destructive" : "secondary"}>
                    {colOrders.length}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">{col.hint}</p>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ScrollArea className="max-h-[32rem]">
                  <div className="space-y-2 pr-1">
                    {colOrders.length === 0 && (
                      <p className="text-[11px] text-muted-foreground py-4 text-center">Ei tilauksia</p>
                    )}
                    {colOrders.map((order) => {
                      const late = isLate(order);
                      const urgent = isUrgent(order);
                      const driver = driverOf(order.driver_id);
                      return (
                        <div
                          key={order.id}
                          className={`rounded-lg border bg-card p-3 space-y-2 ${
                            late ? "border-destructive" : urgent ? "border-amber-500" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold">{shortId(order.id)}</span>
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeWindow(order.pickup_date, order.pickup_time)}
                            </span>
                          </div>

                          {/* Route */}
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[6rem]">{areaOf(order.address)}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[6rem]">{laundryName(order.laundry_id)}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[6rem]">{areaOf(order.address)}</span>
                          </div>

                          {/* Items */}
                          <div className="flex flex-wrap gap-1">
                            {itemTags(order.id).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {/* Driver + warnings */}
                          <div className="flex flex-wrap items-center gap-1">
                            {driver ? (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <UserCheck className="h-3 w-3" />
                                {fullName(driver)}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Ei kuskia</Badge>
                            )}
                            {late && <Badge variant="destructive" className="text-[10px]">Myöhässä</Badge>}
                            {urgent && (
                              <Badge className="text-[10px] bg-amber-500 text-white hover:bg-amber-500">
                                Noutoaika lähestyy
                              </Badge>
                            )}
                          </div>

                          {/* Quick actions */}
                          <div className="space-y-1.5 pt-1">
                            <Select value={order.driver_id || ""} onValueChange={(v) => assignDriver(order.id, v)}>
                              <SelectTrigger className="h-7 text-[11px]">
                                <SelectValue placeholder="Määritä kuski" />
                              </SelectTrigger>
                              <SelectContent>
                                {drivers.length === 0 && (
                                  <SelectItem value="none" disabled className="text-xs">Ei kuskeja</SelectItem>
                                )}
                                {drivers.map((d) => (
                                  <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                                    {fullName(d)}{d.is_active ? " • vuorossa" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={order.laundry_id || ""} onValueChange={(v) => changeLaundry(order.id, v)}>
                              <SelectTrigger className="h-7 text-[11px]">
                                <SelectValue placeholder="Vaihda pesulaa" />
                              </SelectTrigger>
                              <SelectContent>
                                {laundries.length === 0 && (
                                  <SelectItem value="none" disabled className="text-xs">Ei pesuloita</SelectItem>
                                )}
                                {laundries.map((l) => (
                                  <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 flex-1 text-[11px] px-2"
                                onClick={() => openSchedule(order)}
                              >
                                <CalendarClock className="h-3 w-3 mr-1" /> Aika
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 flex-1 text-[11px] px-2"
                                onClick={() => openChat(order)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" /> Chat
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Schedule dialog */}
      <Dialog open={!!scheduleOrder} onOpenChange={(o) => !o && setScheduleOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Siirrä aikataulua</DialogTitle>
            <DialogDescription>
              {scheduleOrder ? `${shortId(scheduleOrder.id)} · ${scheduleOrder.first_name} ${scheduleOrder.last_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Noutopäivä</Label>
              <Input
                type="date"
                value={schedule.pickup_date}
                onChange={(e) => setSchedule({ ...schedule, pickup_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Noutoaika</Label>
              <Input
                type="time"
                value={schedule.pickup_time}
                onChange={(e) => setSchedule({ ...schedule, pickup_time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palautuspäivä</Label>
              <Input
                type="date"
                value={schedule.return_date}
                onChange={(e) => setSchedule({ ...schedule, return_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palautusaika</Label>
              <Input
                type="time"
                value={schedule.return_time}
                onChange={(e) => setSchedule({ ...schedule, return_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleOrder(null)}>Peruuta</Button>
            <Button onClick={saveSchedule}>Tallenna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat dialog */}
      <Dialog open={!!chatOrder} onOpenChange={(o) => !o && setChatOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pikaviesti asiakkaalle</DialogTitle>
            <DialogDescription>
              {chatOrder ? `${shortId(chatOrder.id)} · ${chatOrder.first_name} ${chatOrder.last_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-56 rounded-md border">
            <div className="p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Ei viestejä vielä</p>
              )}
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.is_admin_message ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Kirjoita viesti..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendChat();
                }
              }}
            />
            <Button onClick={sendChat} disabled={chatSending || !chatText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
