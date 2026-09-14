import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Clock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  User,
  UserCheck,
  WashingMachine,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Layers,
  LayoutGrid,
  List
} from "lucide-react";

interface OrderEmbedded {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  tracking_status: string | null;
  laundry_status: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  special_instructions: string | null;
  service_name: string;
  final_price: number;
  price?: number;
  access_code: string | null;
}

interface TaskRow {
  id: string;
  order_id: string;
  task_type: string;
  driver_id: string | null;
  laundry_id: string | null;
  origin_name: string | null;
  origin_address: string | null;
  destination_name: string | null;
  destination_address: string | null;
  pickup_name?: string | null;
  pickup_address?: string | null;
  pickup_phone?: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  scheduled_time_slot: string | null;
  status: string;
  driver_payout: number;
  route_order: number | null;
  batch_id: string | null;
  notes?: string | null;
  orders?: OrderEmbedded | null;
}

interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface DriverInfo extends Profile {
  is_active: boolean;
}

interface LaundryInfo {
  id: string;
  name: string;
}

// 🌐 PURE HELPER FUNCTIONS (MÄÄRITELTY ENNEN KOMPONENTTIA TDZ-VIRHEIDEN ESTÄMISEKSI)
function getDriverFullName(p?: Profile | null): string {
  if (!p) return "Ei kuljettajaa (Jaossa)";
  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return name || "Kuljettaja";
}

function shortOrderId(id?: string | null): string {
  if (!id) return "#------";
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, "");
  return `#${clean.slice(0, 8).toUpperCase()}`;
}

function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  } catch {
    return dateStr;
  }
}

function cityFromAddress(address?: string | null): string {
  if (!address) return "Pääkaupunkiseutu";
  const parts = String(address).split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const cleaned = tail.replace(/\d{5}/g, "").replace(/finland|suomi/i, "").trim();
  return cleaned || "Pääkaupunkiseutu";
}

export const DispatchTaskBoard = () => {
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<LaundryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Kuljettajan määrityksen modal
  const [assignModalTask, setAssignModalTask] = useState<TaskRow | null>(null);

  // 1. Data Fetch
  const fetchAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tasksRes, rolesRes, shiftsRes, laundriesRes] = await Promise.all([
        supabase
          .from("delivery_tasks")
          .select("*, orders(*)")
          .order("scheduled_date", { ascending: true })
          .order("route_order", { ascending: true, nullsFirst: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
        supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
        supabase.from("laundries").select("id, name").order("name"),
      ]);

      const taskRows = (tasksRes.data || []) as unknown as TaskRow[];
      setTasks(taskRows);
      setLaundries((laundriesRes.data || []) as LaundryInfo[]);

      const driverIds = (rolesRes.data || []).map((r: any) => r.user_id as string);
      const activeIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id as string));
      
      if (driverIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", driverIds);

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
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.error("Dispatch tasks load error:", error);
      toast({ title: "Virhe", description: "Kuljetustehtävien lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("dispatch_taskboard_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_shifts" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const findDriver = (id?: string | null) => {
    if (!id) return null;
    return drivers.find((d) => d.user_id === id) || null;
  };

  // Vain aktiiviset keikat (ei jo valmistuneet)
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t) return false;
      const taskSt = String(t.status || "").toLowerCase();
      const orderSt = String(t.orders?.status || "").toLowerCase();
      const orderTracking = String(t.orders?.tracking_status || "").toUpperCase();

      if (["completed", "failed", "cancelled"].includes(taskSt)) return false;
      if (["delivered", "completed", "rejected", "cancelled"].includes(orderSt)) return false;
      if (orderTracking === "COMPLETED") return false;

      return true;
    });
  }, [tasks]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    activeTasks.forEach((t) => {
      const addr = t.task_type === "pickup"
        ? (t.pickup_address || t.origin_address || t.orders?.address)
        : (t.delivery_address || t.destination_address || t.orders?.address);
      set.add(cityFromAddress(addr));
    });
    return Array.from(set).sort();
  }, [activeTasks]);

  // 🔍 100% SUOJATTU JA VIRHEETÖN SUODATETTU LISTA
  const filteredTasks = useMemo(() => {
    try {
      const q = String(searchQuery || "").toLowerCase().trim().replace(/^#/, "");

      return activeTasks.filter((t) => {
        if (!t) return false;

        const addr = t.task_type === "pickup"
          ? (t.pickup_address || t.origin_address || t.orders?.address)
          : (t.delivery_address || t.destination_address || t.orders?.address);

        if (cityFilter !== "all" && cityFromAddress(addr) !== cityFilter) {
          return false;
        }

        if (q) {
          const rawOrderId = String(t.order_id || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
          const rawTaskId = String(t.id || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
          const shortIdStr = shortOrderId(t.order_id).toLowerCase();
          const matchId = rawOrderId.includes(q) || rawTaskId.includes(q) || shortIdStr.includes(q);

          const firstName = String(t.orders?.first_name || t.pickup_name || "").toLowerCase();
          const lastName = String(t.orders?.last_name || "").toLowerCase();
          const fullNameStr = `${firstName} ${lastName}`.trim();
          const matchName = firstName.includes(q) || lastName.includes(q) || fullNameStr.includes(q);

          const phoneStr = String(t.pickup_phone || t.delivery_phone || t.orders?.phone || "").toLowerCase().replace(/\s+/g, "");
          const cleanQ = q.replace(/\s+/g, "");
          const matchPhone = phoneStr.includes(cleanQ);

          const fullAddrStr = String(addr || "").toLowerCase();
          const matchAddr = fullAddrStr.includes(q);

          const driver = findDriver(t.driver_id);
          const driverNameStr = getDriverFullName(driver).toLowerCase();
          const matchDriver = driverNameStr.includes(q);

          const serviceNameStr = String(t.orders?.service_name || "").toLowerCase();
          const matchService = serviceNameStr.includes(q);

          if (!matchId && !matchName && !matchPhone && !matchAddr && !matchDriver && !matchService) {
            return false;
          }
        }

        return true;
      });
    } catch (err) {
      console.error("Dispatch filtering error:", err);
      return activeTasks;
    }
  }, [activeTasks, searchQuery, cityFilter, drivers]);

  // KPI-Laskenta
  const stats = useMemo(() => {
    let unassigned = 0;
    let pickingUp = 0;
    let washing = 0;
    let returning = 0;

    filteredTasks.forEach((t) => {
      const taskSt = String(t.status || "").toLowerCase();
      const orderSt = String(t.orders?.status || "").toLowerCase();
      const isLaundry = orderSt === "washing" || taskSt === "washing" || taskSt === "awaiting_laundry";

      if (isLaundry) {
        washing++;
      } else if (!t.driver_id || taskSt === "unassigned" || taskSt === "pending") {
        unassigned++;
      } else if (t.task_type === "pickup") {
        pickingUp++;
      } else if (t.task_type === "delivery") {
        returning++;
      }
    });

    return {
      total: filteredTasks.length,
      unassigned,
      pickingUp,
      washing,
      returning,
    };
  }, [filteredTasks]);

  // 4 KANBAN-SARAKETTA
  const kanbanColumns = useMemo(() => {
    return [
      {
        key: "unassigned",
        label: "Jaossa / Vapaat",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
        headerBorder: "border-t-4 border-amber-500",
        count: stats.unassigned,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && (!t.driver_id || t.status === "unassigned" || t.status === "pending");
        }),
      },
      {
        key: "pickup",
        label: "Noudossa",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
        headerBorder: "border-t-4 border-blue-500",
        count: stats.pickingUp,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "pickup" && t.driver_id && ["assigned", "in_progress", "picking_up", "accepted"].includes(t.status);
        }),
      },
      {
        key: "washing",
        label: "Pesulassa",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
        headerBorder: "border-t-4 border-purple-500",
        count: stats.washing,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          return orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
        }),
      },
      {
        key: "delivery",
        label: "Palautuksessa",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
        headerBorder: "border-t-4 border-emerald-500",
        count: stats.returning,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "delivery" && t.driver_id && ["assigned", "in_progress", "returning"].includes(t.status);
        }),
      },
    ];
  }, [filteredTasks, stats]);

  // Kopioi ID leikepöydälle
  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Kopioitu leikepöydälle", description: text });
  };

  // 🎯 KULJETTAJAN MÄÄRITYS / VAPAUTUS
  const handleAssignDriver = async (task: TaskRow, driverId: string | null) => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newStatus = driverId ? "assigned" : "unassigned";

      // 1. Päivitetään delivery_task
      await supabase
        .from("delivery_tasks")
        .update({
          driver_id: driverId,
          status: newStatus,
          updated_at: nowIso,
        })
        .eq("id", task.id);

      // 2. Päivitetään order
      if (task.order_id) {
        await supabase
          .from("orders")
          .update({
            driver_id: driverId,
            status: driverId ? "accepted" : "pending",
            updated_at: nowIso,
          })
          .eq("id", task.order_id);
      }

      toast({
        title: driverId ? "Kuljettaja määritetty" : "Keikka vapautettu jakoon",
        description: driverId
          ? `Keikka liitettiin kuljettajalle ${getDriverFullName(findDriver(driverId))}`
          : "Keikka on nyt vapaana ja kuka tahansa kuljettaja voi ottaa sen.",
      });

      setAssignModalTask(null);
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Toiminto epäonnistui", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // 🎯 TILAN PÄIVITYS (PIKA)
  const handleUpdateStatus = async (task: TaskRow, newOrderStatus: string, newLaundryStatus?: string) => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: any = { status: newOrderStatus, updated_at: nowIso };
      if (newLaundryStatus) payload.laundry_status = newLaundryStatus;
      if (newOrderStatus === "delivered") payload.tracking_status = "COMPLETED";

      if (task.order_id) {
        await supabase.from("orders").update(payload).eq("id", task.order_id);
      }

      if (newOrderStatus === "delivered") {
        await supabase
          .from("delivery_tasks")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", task.id);
      }

      toast({ title: "Tila päivitetty", description: `Tilauksen tila: ${newOrderStatus}` });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Tilan päivitys epäonnistui", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* 📊 KPI-TILASTOPALKKI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border shadow-sm bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Aktiivisia keikkoja</p>
              <h4 className="text-xl font-black text-foreground mt-0.5">{stats.total}</h4>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center dark:bg-blue-950">
              <Layers className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border shadow-sm bg-card p-3 border-amber-200 dark:border-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Jaossa / Vapaat</p>
              <h4 className="text-xl font-black text-amber-600 mt-0.5">{stats.unassigned}</h4>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-950">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border shadow-sm bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Noudossa</p>
              <h4 className="text-xl font-black text-blue-600 mt-0.5">{stats.pickingUp}</h4>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center dark:bg-blue-950">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border shadow-sm bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Pesulassa</p>
              <h4 className="text-xl font-black text-purple-600 mt-0.5">{stats.washing}</h4>
            </div>
            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center dark:bg-purple-950">
              <WashingMachine className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border shadow-sm bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Palautuksessa</p>
              <h4 className="text-xl font-black text-emerald-600 mt-0.5">{stats.returning}</h4>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center dark:bg-emerald-950">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* 🔍 HAKU & TOIMINTOPALKKI */}
      <Card className="border shadow-sm p-4 bg-card">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Hakukenttä */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Etsi tilausnumerolla, nimellä, puhelimella, osoitteella tai kuskilla..."
              className="pl-9 h-10 text-xs sm:text-sm bg-muted/40 border-muted-foreground/20 rounded-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Kaupunkisuodatin */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-10 text-xs sm:text-sm min-w-[150px] rounded-xl">
                <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <SelectValue placeholder="Kaikki kaupungit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki kaupungit</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Näkymävalitsin (Kanban / Lista) */}
            <div className="flex items-center p-1 bg-muted rounded-xl border">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 px-2.5 text-xs"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Taulu
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 px-2.5 text-xs"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                Lista
              </Button>
            </div>

            {/* Päivitä */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="h-10 px-3 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* 📋 KEIKAT / PÄÄNÄKYMÄ */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm font-medium text-muted-foreground">Ladataan reaaliaikaista keikkadataa...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border border-dashed p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">Ei keikkoja tällä suodatuksella</h3>
          <p className="text-xs text-muted-foreground mt-1">Kokeile vaihtaa hakusanaa tai kaupunkisuodatinta.</p>
        </Card>
      ) : viewMode === "kanban" ? (
        /* 1. KANBAN SARAKENÄKYMÄ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map((col) => (
            <div key={col.key} className="space-y-3">
              {/* Sarakeotsikko */}
              <div className={`bg-card p-3 rounded-2xl border shadow-sm ${col.headerBorder} flex items-center justify-between`}>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{col.label}</h4>
                  <p className="text-[11px] text-muted-foreground">{col.tasks.length} keikkaa</p>
                </div>
                <Badge className={`${col.badgeColor} font-bold text-xs`}>
                  {col.count}
                </Badge>
              </div>

              {/* Sarakkeen keikkakortit */}
              <div className="space-y-3">
                {col.tasks.map((task) => {
                  const driver = findDriver(task.driver_id);
                  const isPickup = task.task_type === "pickup";
                  const customerName = `${task.orders?.first_name || task.pickup_name || ""} ${task.orders?.last_name || ""}`.trim() || "Asiakas";
                  const phone = task.pickup_phone || task.delivery_phone || task.orders?.phone || "";
                  const address = isPickup
                    ? (task.pickup_address || task.origin_address || task.orders?.address || "")
                    : (task.delivery_address || task.destination_address || task.orders?.address || "");
                  const timeWindow = task.scheduled_time_slot || task.scheduled_time || (isPickup ? task.orders?.pickup_time : task.orders?.return_time) || "18:00";
                  const dateStr = task.scheduled_date || (isPickup ? task.orders?.pickup_date : task.orders?.return_date);
                  const priceStr = Number(task.orders?.final_price || task.orders?.price || 0).toFixed(2);

                  return (
                    <Card key={task.id} className="border shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden bg-card">
                      <div className="p-4 space-y-3">
                        {/* Kortin Yläosa */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => copyId(task.order_id || task.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-[11px] font-mono font-bold hover:bg-muted/80 text-primary"
                          >
                            {shortOrderId(task.order_id || task.id)}
                            {copiedId === (task.order_id || task.id) ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>

                          <Badge variant="outline" className={isPickup ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                            {isPickup ? "📦 Nouto" : "🚗 Palautus"}
                          </Badge>
                        </div>

                        {/* Asiakas & Puhelin */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">{customerName}</span>
                            <span className="font-black text-sm text-primary">{priceStr} €</span>
                          </div>

                          {phone && (
                            <a
                              href={`tel:${phone.replace(/\s+/g, "")}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                            >
                              <Phone className="h-3 w-3" />
                              {phone}
                            </a>
                          )}
                        </div>

                        {/* Osoite & Aika */}
                        <div className="space-y-1 bg-muted/30 p-2.5 rounded-xl text-xs">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{address || "Osoite puuttuu"}</span>
                          </a>

                          <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-muted/50">
                            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-foreground">
                              {formatSafeDate(dateStr)} klo {timeWindow}
                            </span>
                          </div>
                        </div>

                        {/* Kuljettaja & Toiminnot */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Kuljettaja</p>
                            <p className={`text-xs font-bold truncate ${driver ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600"}`}>
                              {getDriverFullName(driver)}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant={driver ? "outline" : "default"}
                            onClick={() => setAssignModalTask(task)}
                            className="h-8 text-xs font-semibold px-2.5 rounded-lg shrink-0"
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            {driver ? "Vaihda" : "Määritä"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 2. TAULUKKONÄKYMÄ (LIST VIEW) */
        <Card className="border shadow-sm rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Tilaus</th>
                  <th className="p-3.5">Tyyppi</th>
                  <th className="p-3.5">Asiakas</th>
                  <th className="p-3.5">Osoite & Kaupunki</th>
                  <th className="p-3.5">Aikaikkuna</th>
                  <th className="p-3.5">Kuljettaja</th>
                  <th className="p-3.5">Summa</th>
                  <th className="p-3.5 text-right">Toiminnot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => {
                  const driver = findDriver(task.driver_id);
                  const isPickup = task.task_type === "pickup";
                  const customerName = `${task.orders?.first_name || task.pickup_name || ""} ${task.orders?.last_name || ""}`.trim() || "Asiakas";
                  const phone = task.pickup_phone || task.delivery_phone || task.orders?.phone || "";
                  const address = isPickup
                    ? (task.pickup_address || task.origin_address || task.orders?.address || "")
                    : (task.delivery_address || task.destination_address || task.orders?.address || "");
                  const timeWindow = task.scheduled_time_slot || task.scheduled_time || (isPickup ? task.orders?.pickup_time : task.orders?.return_time) || "18:00";
                  const dateStr = task.scheduled_date || (isPickup ? task.orders?.pickup_date : task.orders?.return_date);
                  const priceStr = Number(task.orders?.final_price || task.orders?.price || 0).toFixed(2);

                  return (
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-primary">
                        <button onClick={() => copyId(task.order_id || task.id)} className="hover:underline flex items-center gap-1">
                          {shortOrderId(task.order_id || task.id)}
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={isPickup ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}>
                          {isPickup ? "Nouto" : "Palautus"}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{customerName}</div>
                        {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`} className="text-[11px] text-blue-600 hover:underline">{phone}</a>}
                      </td>
                      <td className="p-3.5 max-w-[220px]">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline text-muted-foreground hover:text-foreground line-clamp-1"
                        >
                          {address}
                        </a>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-semibold text-foreground">{formatSafeDate(dateStr)}</span> klo {timeWindow}
                      </td>
                      <td className="p-3.5">
                        <span className={`font-semibold ${driver ? "text-emerald-600" : "text-amber-600 font-bold"}`}>
                          {getDriverFullName(driver)}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-foreground">
                        {priceStr} €
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssignModalTask(task)}
                          className="h-8 text-xs font-semibold rounded-lg"
                        >
                          {driver ? "Vaihda" : "Määritä"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 🚘 KULJETTAJAN VALINTAMODAALI */}
      {assignModalTask && (
        <Dialog open={!!assignModalTask} onOpenChange={() => setAssignModalTask(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Määritä kuljettaja keikalle</DialogTitle>
              <DialogDescription className="text-xs">
                Valitse kuljettaja tai vapauta keikka yleiseen jakoon
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              {/* VAPAUTA JAKOON NAPPI */}
              <button
                onClick={() => handleAssignDriver(assignModalTask, null)}
                disabled={actionLoading}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-left transition-colors dark:bg-amber-950/40"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-amber-900 dark:text-amber-200">Vapauta yleiseen jakoon</h5>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">Kuka tahansa kuljettaja voi ottaa tämän keikan</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-700" />
              </button>

              {/* KULJETTAJALISTA */}
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {drivers.map((d) => {
                  const isCurrent = assignModalTask.driver_id === d.user_id;
                  const dName = getDriverFullName(d);

                  return (
                    <button
                      key={d.user_id}
                      onClick={() => handleAssignDriver(assignModalTask, d.user_id)}
                      disabled={actionLoading}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                        isCurrent
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold ${isCurrent ? "bg-emerald-200 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-foreground">{dName}</h5>
                          <p className="text-[11px] text-muted-foreground">{d.phone || "Ei numeroa"}</p>
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge className="bg-emerald-600 text-white font-bold text-xs">Määritetty</Badge>
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setAssignModalTask(null)}>
                Sulje
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
