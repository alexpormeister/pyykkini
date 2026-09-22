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
import { DispatchTaskBoard } from "@/components/DispatchTaskBoard";
import { OrderSearchPanel } from "@/components/OrderSearchPanel";
import { SupportChatInbox } from "@/components/SupportChatInbox";
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
        <DispatchTaskBoard />
      </TabsContent>

      {/* --- 2. Inbox / Viestit --- */}
      <TabsContent value="inbox" className="animate-fade-in space-y-4">
        <SupportChatInbox />
      </TabsContent>


      {/* --- 3. CRM / Tilaushaku --- */}
      <TabsContent value="crm" className="animate-fade-in space-y-4">
        <OrderSearchPanel />
      </TabsContent>
    </Tabs>
  );
};

export default CustomerServicePanel;