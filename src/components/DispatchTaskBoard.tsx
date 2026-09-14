import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
  Copy,
  Check,
  LayoutGrid,
  List,
  ArrowRight
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

// 🌐 PURE HELPER FUNCTIONS
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

  const kanbanColumns = useMemo(() => {
    return [
      {
        key: "unassigned",
        label: "Jaossa",
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
        count: stats.washing,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          return orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
        }),
      },
      {
        key: "delivery",
        label: "Palautuksessa",
        count: stats.returning,
        tasks: filteredTasks.filter((t) => {
          const orderSt = String(t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "delivery" && t.driver_id && ["assigned", "in_progress", "returning"].includes(t.status);
        }),
      },
    ];
  }, [filteredTasks, stats]);

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Kopioitu leikepöydälle", description: text });
  };

  const handleAssignDriver = async (task: TaskRow, driverId: string | null) => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newStatus = driverId ? "assigned" : "unassigned";

      await supabase
        .from("delivery_tasks")
        .update({
          driver_id: driverId,
          status: newStatus,
          updated_at: nowIso,
        })
        .eq("id", task.id);

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
        title: driverId ? "Kuljettaja määritetty" : "Keikka vapautettu",
        description: driverId
          ? `Keikka liitettiin kuljettajalle ${getDriverFullName(findDriver(driverId))}`
          : "Keikka on nyt vapaana.",
      });

      setAssignModalTask(null);
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Toiminto epäonnistui", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* KPI-RIVI (MINIMALISTINEN) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border bg-card">
          <p className="text-xs text-muted-foreground">Jaossa / Vapaana</p>
          <h4 className="text-lg font-bold text-foreground mt-0.5">{stats.unassigned} kpl</h4>
        </div>

        <div className="p-3.5 rounded-xl border bg-card">
          <p className="text-xs text-muted-foreground">Noudossa</p>
          <h4 className="text-lg font-bold text-foreground mt-0.5">{stats.pickingUp} kpl</h4>
        </div>

        <div className="p-3.5 rounded-xl border bg-card">
          <p className="text-xs text-muted-foreground">Pesulassa</p>
          <h4 className="text-lg font-bold text-foreground mt-0.5">{stats.washing} kpl</h4>
        </div>

        <div className="p-3.5 rounded-xl border bg-card">
          <p className="text-xs text-muted-foreground">Palautuksessa</p>
          <h4 className="text-lg font-bold text-foreground mt-0.5">{stats.returning} kpl</h4>
        </div>
      </div>

      {/* HAKU & TOIMINTOPALKKI */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 rounded-xl border bg-card">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hae tilausnumerolla, nimellä, puhelimella, osoitteella tai kuskilla..."
            className="pl-8 h-8 text-xs bg-muted/30 border-muted-foreground/20 rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="h-8 text-xs min-w-[130px] rounded-lg">
              <SelectValue placeholder="Kaikki alueet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki alueet</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center p-0.5 bg-muted rounded-lg border">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-7 px-2 text-xs"
            >
              <LayoutGrid className="h-3 w-3 mr-1" />
              Taulu
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7 px-2 text-xs"
            >
              <List className="h-3 w-3 mr-1" />
              Lista
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="h-8 px-2.5 rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KEIKAT / PÄÄNÄKYMÄ */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-2"></div>
          <p className="text-xs text-muted-foreground">Ladataan keikkoja...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center bg-card">
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Ei keikkoja tällä suodatuksella.</p>
        </div>
      ) : viewMode === "kanban" ? (
        /* KANBAN NÄKYMÄ */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
          {kanbanColumns.map((col) => (
            <div key={col.key} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
              </div>

              <div className="space-y-2">
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
                    <div key={task.id} className="p-3.5 rounded-xl border bg-card space-y-2.5 text-xs hover:border-muted-foreground/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => copyId(task.order_id || task.id)}
                          className="font-mono font-bold hover:underline flex items-center gap-1 text-foreground"
                        >
                          {shortOrderId(task.order_id || task.id)}
                          {copiedId === (task.order_id || task.id) ? (
                            <Check className="h-3 w-3 text-foreground" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>

                        <span className="text-[11px] text-muted-foreground font-medium">
                          {isPickup ? "Nouto" : "Palautus"}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-foreground font-semibold">{customerName}</span>
                          <span className="text-foreground font-bold">{priceStr} €</span>
                        </div>

                        {phone && (
                          <a
                            href={`tel:${phone.replace(/\s+/g, "")}`}
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            {phone}
                          </a>
                        )}
                      </div>

                      <div className="space-y-1 pt-1.5 border-t text-[11px] text-muted-foreground">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-1 hover:text-foreground line-clamp-1"
                        >
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>{address || "Osoite puuttuu"}</span>
                        </a>

                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatSafeDate(dateStr)} klo {timeWindow}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between gap-2">
                        <span className={`text-[11px] truncate ${driver ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {getDriverFullName(driver)}
                        </span>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssignModalTask(task)}
                          className="h-7 text-[11px] px-2 rounded-md shrink-0"
                        >
                          {driver ? "Vaihda" : "Määritä"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LISTA NÄKYMÄ */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-semibold text-[11px]">
                  <th className="p-3">Tilaus</th>
                  <th className="p-3">Tyyppi</th>
                  <th className="p-3">Asiakas</th>
                  <th className="p-3">Osoite</th>
                  <th className="p-3">Aika</th>
                  <th className="p-3">Kuljettaja</th>
                  <th className="p-3">Summa</th>
                  <th className="p-3 text-right">Toiminto</th>
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
                    <tr key={task.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-semibold">
                        <button onClick={() => copyId(task.order_id || task.id)} className="hover:underline flex items-center gap-1">
                          {shortOrderId(task.order_id || task.id)}
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {isPickup ? "Nouto" : "Palautus"}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-foreground">{customerName}</span>
                        {phone && <span className="block text-[11px] text-muted-foreground">{phone}</span>}
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                        {address}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {formatSafeDate(dateStr)} klo {timeWindow}
                      </td>
                      <td className="p-3">
                        <span className={driver ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {getDriverFullName(driver)}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {priceStr} €
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAssignModalTask(task)}
                          className="h-7 text-[11px] px-2"
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
        </div>
      )}

      {/* KULJETTAJAN VALINTAMODAALI */}
      {assignModalTask && (
        <Dialog open={!!assignModalTask} onOpenChange={() => setAssignModalTask(null)}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Määritä kuljettaja</DialogTitle>
              <DialogDescription className="text-xs">
                Valitse kuljettaja tai vapauta keikka yleiseen jakoon.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <button
                onClick={() => handleAssignDriver(assignModalTask, null)}
                disabled={actionLoading}
                className="w-full flex items-center justify-between p-3 rounded-lg border text-left hover:bg-muted transition-colors text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">Vapauta yleiseen jakoon</p>
                  <p className="text-[11px] text-muted-foreground">Kuka tahansa kuljettaja voi ottaa tämän keikan</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                {drivers.map((d) => {
                  const isCurrent = assignModalTask.driver_id === d.user_id;
                  const dName = getDriverFullName(d);

                  return (
                    <button
                      key={d.user_id}
                      onClick={() => handleAssignDriver(assignModalTask, d.user_id)}
                      disabled={actionLoading}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors text-xs ${
                        isCurrent ? "bg-muted font-semibold" : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <p className="text-foreground">{dName}</p>
                        <p className="text-[11px] text-muted-foreground">{d.phone || "Ei numeroa"}</p>
                      </div>
                      {isCurrent ? (
                        <span className="text-[11px] text-muted-foreground font-semibold">Määritetty</span>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAssignModalTask(null)}>
                Sulje
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
