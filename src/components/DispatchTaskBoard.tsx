import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Clock,
  Edit,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  User,
  UserCheck,
  WashingMachine,
  X,
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

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Tuntematon" : "Ei kuljettajaa";

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const getPickupCode = (id?: string) => {
  if (!id) return "48291";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return String((Math.abs(hash) % 90000) + 10000);
};

const cityOf = (address?: string | null) => {
  if (!address) return "Muu alue";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const cleaned = tail.replace(/\d{5}/g, "").replace(/finland|suomi/i, "").trim();
  return cleaned || "Muu alue";
};

const taskCity = (t: TaskRow) => {
  const addr = t.task_type === "pickup" 
    ? (t.pickup_address || t.origin_address || t.orders?.address) 
    : (t.delivery_address || t.destination_address || t.orders?.address);
  return cityOf(addr);
};

export const DispatchTaskBoard = () => {
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<LaundryInfo[]>([]);
  const [handover, setHandover] = useState<Record<string, { pickup_weight_kg: number | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Edit modal state
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [editForm, setEditForm] = useState({
    driver_id: "",
    laundry_id: "",
    status: "unassigned",
    task_type: "pickup",
    scheduled_date: "",
    scheduled_time: "10:00",
    origin_name: "",
    origin_address: "",
    destination_name: "",
    destination_address: "",
    driver_payout: 19,
    notes: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [deletingTask, setDeletingTask] = useState<TaskRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("dispatch_task_board_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => {
        fetchAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      const orderIds = Array.from(new Set(taskRows.map((t) => t.order_id)));
      if (orderIds.length > 0) {
        const { data: infoRows } = await supabase.rpc("get_orders_handover_info" as never, {
          p_order_ids: orderIds,
        } as never);
        const map: Record<string, { pickup_weight_kg: number | null }> = {};
        for (const row of (infoRows || []) as any[]) {
          map[row.order_id] = { pickup_weight_kg: row.pickup_weight_kg };
        }
        setHandover(map);
      }

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
      console.error("Dispatch tasks load error:", error);
      toast({ title: "Virhe", description: "Kuljetustehtävien lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Vain aktiiviset tehtävät
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => {
      const taskSt = (t.status || "").toLowerCase();
      const orderSt = (t.orders?.status || "").toLowerCase();
      const orderTracking = (t.orders?.tracking_status || "").toUpperCase();

      if (["completed", "failed", "cancelled"].includes(taskSt)) return false;
      if (["delivered", "completed", "rejected", "cancelled"].includes(orderSt)) return false;
      if (orderTracking === "COMPLETED") return false;

      return true;
    });
  }, [tasks]);

  const scheduledAt = (t: TaskRow) =>
    new Date(`${t.scheduled_date || "1970-01-01"}T${(t.scheduled_time || t.scheduled_time_slot || "00:00").slice(0, 5)}`).getTime();

  const cities = useMemo(() => Array.from(new Set(activeTasks.map(taskCity))).sort(), [activeTasks]);

  // Suodatettu lista
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return activeTasks.filter((t) => {
      if (cityFilter !== "all" && taskCity(t) !== cityFilter) return false;
      if (dateFilter && t.scheduled_date !== dateFilter) return false;

      if (q) {
        const id = (t.order_id || t.id).toLowerCase();
        const pin = getPickupCode(t.order_id || t.id);
        const name = (t.pickup_name || t.origin_name || `${t.orders?.first_name || ""} ${t.orders?.last_name || ""}`).toLowerCase();
        const phone = (t.pickup_phone || t.orders?.phone || "").toLowerCase();
        const addr = (t.pickup_address || t.origin_address || t.orders?.address || "").toLowerCase();
        const dest = (t.delivery_address || t.destination_address || "").toLowerCase();
        const drv = fullName(driverOf(t.driver_id)).toLowerCase();

        const match =
          id.includes(q) ||
          pin.includes(q) ||
          name.includes(q) ||
          phone.includes(q) ||
          addr.includes(q) ||
          dest.includes(q) ||
          drv.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [activeTasks, searchQuery, cityFilter, dateFilter, drivers]);

  const driverOf = (id: string | null) => drivers.find((d) => d.user_id === id) || null;
  const laundryOf = (id: string | null) => laundries.find((l) => l.id === id) || null;

  // 4 aktiivista saraketta
  const columns = useMemo(() => {
    return [
      {
        key: "unassigned",
        label: "Vapaana",
        sublabel: "Odottaa kuljettajaa",
        color: "amber",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
        headerClass: "border-t-2 border-amber-500",
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && (!t.driver_id || t.status === "unassigned" || t.status === "pending");
        }),
      },
      {
        key: "pickup_active",
        label: "Noudossa",
        sublabel: "Kuljettaja noutamassa",
        color: "blue",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
        headerClass: "border-t-2 border-blue-500",
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "pickup" && t.driver_id && ["assigned", "in_progress", "picking_up"].includes(t.status);
        }),
      },
      {
        key: "laundry",
        label: "Pesulassa",
        sublabel: "Pyykit käsittelyssä",
        color: "purple",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
        headerClass: "border-t-2 border-purple-500",
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const orderTracking = (t.orders?.tracking_status || "").toUpperCase();
          return orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry" || ["WASHING", "PACKAGING"].includes(orderTracking);
        }),
      },
      {
        key: "delivery_active",
        label: "Toimituksessa",
        sublabel: "Kuljettaja toimittamassa",
        color: "emerald",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
        headerClass: "border-t-2 border-emerald-500",
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "delivery" && t.driver_id && ["assigned", "in_progress", "returning"].includes(t.status);
        }),
      },
    ];
  }, [filtered]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const assignBatch = async () => {
    if (!assignTo || selected.length === 0) return;
    setAssigning(true);
    try {
      const batchId = crypto.randomUUID();
      const existing = tasks.filter((t) => t.driver_id === assignTo && !["completed", "failed"].includes(t.status));
      let next = existing.reduce((max, t) => Math.max(max, t.route_order || 0), 0);

      const ordered = selected
        .map((id) => tasks.find((t) => t.id === id)!)
        .filter(Boolean)
        .sort((a, b) => scheduledAt(a) - scheduledAt(b));

      for (const task of ordered) {
        next += 1;
        const { error } = await supabase
          .from("delivery_tasks")
          .update({ driver_id: assignTo, status: "assigned", batch_id: batchId, route_order: next })
          .eq("id", task.id);
        if (error) throw error;

        if (task.order_id) {
          await supabase
            .from("orders")
            .update({ driver_id: assignTo, status: "accepted", updated_at: new Date().toISOString() })
            .eq("id", task.order_id);
        }
      }
      toast({ title: "Kuljettaja liitetty", description: `${ordered.length} keikkaa liitettiin kuljettajalle ${fullName(driverOf(assignTo))}` });
      setSelected([]);
      setAssignTo("");
      fetchAll();
    } catch (error) {
      console.error(error);
      toast({ title: "Virhe", description: "Keikkojen liittäminen epäonnistui", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const quickAssignDriver = async (task: TaskRow, driverId: string) => {
    try {
      const driverVal = driverId === "none" ? null : driverId;
      const newStatus = driverVal ? "assigned" : "unassigned";

      const { error: taskErr } = await supabase
        .from("delivery_tasks")
        .update({ driver_id: driverVal, status: newStatus })
        .eq("id", task.id);
      if (taskErr) throw taskErr;

      if (task.order_id) {
        await supabase
          .from("orders")
          .update({ driver_id: driverVal, status: driverVal ? "accepted" : "pending", updated_at: new Date().toISOString() })
          .eq("id", task.order_id);
      }

      toast({
        title: driverVal ? "Kuljettaja asetettu" : "Keikka vapautettu",
        description: driverVal ? `Keikka liitetty kuljettajalle ${fullName(driverOf(driverVal))}` : "Keikka on nyt vapaa.",
      });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Kuljettajan asetus epäonnistui", variant: "destructive" });
    }
  };

  const unassign = async (task: TaskRow) => {
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ driver_id: null, status: "unassigned", route_order: null, batch_id: null })
      .eq("id", task.id);
    if (error) return toast({ title: "Virhe", description: "Vapautus epäonnistui", variant: "destructive" });

    if (task.order_id) {
      await supabase
        .from("orders")
        .update({ driver_id: null, status: "pending", updated_at: new Date().toISOString() })
        .eq("id", task.order_id);
    }
    toast({ title: "Keikka vapautettu", description: "Keikka on nyt vapaasti kuljettajien otettavissa." });
    fetchAll();
  };

  // Muokkausdialogin avaus
  const openEditModal = (task: TaskRow) => {
    setEditingTask(task);
    setEditForm({
      driver_id: task.driver_id || "none",
      laundry_id: task.laundry_id || task.orders?.laundry_id || "none",
      status: task.status || "unassigned",
      task_type: task.task_type || "pickup",
      scheduled_date: task.scheduled_date || task.orders?.pickup_date || new Date().toISOString().split("T")[0],
      scheduled_time: (task.scheduled_time || task.scheduled_time_slot || task.orders?.pickup_time || "10:00").slice(0, 5),
      origin_name: task.origin_name || task.pickup_name || (task.orders ? `${task.orders.first_name || ""} ${task.orders.last_name || ""}`.trim() : ""),
      origin_address: task.pickup_address || task.origin_address || task.orders?.address || "",
      destination_name: task.destination_name || task.delivery_name || "Pesuni Pesulakeskus",
      destination_address: task.delivery_address || task.destination_address || "Lohjanharjuntie 15, Lohja",
      driver_payout: Number(task.driver_payout) || 19,
      notes: task.notes || task.orders?.special_instructions || "",
      first_name: task.orders?.first_name || "",
      last_name: task.orders?.last_name || "",
      phone: task.orders?.phone || task.pickup_phone || "",
    });
  };

  // Tallenna muokkaukset
  const handleSaveEdit = async () => {
    if (!editingTask) return;
    setSavingEdit(true);
    try {
      const nowIso = new Date().toISOString();
      const driverIdValue = editForm.driver_id && editForm.driver_id !== "none" ? editForm.driver_id : null;
      const laundryIdValue = editForm.laundry_id && editForm.laundry_id !== "none" ? editForm.laundry_id : null;

      // 1. Päivitä delivery_tasks
      const { error: taskError } = await supabase
        .from("delivery_tasks")
        .update({
          driver_id: driverIdValue,
          laundry_id: laundryIdValue,
          status: editForm.status,
          task_type: editForm.task_type,
          scheduled_date: editForm.scheduled_date || null,
          scheduled_time: editForm.scheduled_time,
          scheduled_time_slot: editForm.scheduled_time,
          origin_name: editForm.origin_name,
          origin_address: editForm.origin_address,
          destination_name: editForm.destination_name,
          destination_address: editForm.destination_address,
          pickup_address: editForm.origin_address,
          delivery_address: editForm.destination_address,
          driver_payout: editForm.driver_payout,
          notes: editForm.notes,
          updated_at: nowIso,
        })
        .eq("id", editingTask.id);

      if (taskError) throw taskError;

      // 2. Päivitä orders
      if (editingTask.order_id) {
        const orderStatus = editForm.status === "washing"
          ? "washing"
          : driverIdValue
            ? (editForm.status === "in_progress" ? "picking_up" : "accepted")
            : "pending";

        await supabase
          .from("orders")
          .update({
            driver_id: driverIdValue,
            laundry_id: laundryIdValue,
            status: orderStatus,
            first_name: editForm.first_name || undefined,
            last_name: editForm.last_name || undefined,
            phone: editForm.phone || undefined,
            address: editForm.origin_address || undefined,
            special_instructions: editForm.notes || undefined,
            updated_at: nowIso,
          })
          .eq("id", editingTask.order_id);
      }

      toast({ title: "Muutokset tallennettu! ✨", description: "Tilauksen tiedot on päivitetty." });
      setEditingTask(null);
      fetchAll();
    } catch (error: any) {
      console.error("Save edit error:", error);
      toast({ title: "Tallennus epäonnistui", description: error.message || "Tarkista tiedot.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  // Poistotoiminto
  const handleDeleteOrder = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      const orderId = deletingTask.order_id || deletingTask.id;

      await supabase.from("delivery_tasks").delete().eq("order_id", orderId);
      await supabase.from("delivery_tasks").delete().eq("id", deletingTask.id);

      if (deletingTask.order_id) {
        await supabase.from("orders").delete().eq("id", deletingTask.order_id);
      }

      toast({ title: "Tilaus poistettu 🗑️", description: "Tilaus poistettiin kokonaan järjestelmästä." });
      setDeletingTask(null);
      fetchAll();
    } catch (error: any) {
      console.error("Delete order error:", error);
      toast({ title: "Poisto epäonnistui", description: error.message || "Virhe poistettaessa tilausta.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ladataan välityskeskusta...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Dispatch Control Bar */}
      <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Title & Count Badge */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            🚦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground">Välityskeskus</h2>
              <Badge variant="secondary" className="text-xs px-2 py-0 font-semibold">
                {activeTasks.length} aktiivista
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Hallitse ja ylläpidä aktiivisia tilauksia ja keikkoja</p>
          </div>
        </div>

        {/* Right: Quick Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 md:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Hae tilausta, asiakasta, osoitetta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs w-full md:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Alue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Kaikki alueet</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          {dateFilter && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDateFilter("")}>
              Tyhjennä pvm
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            title="Päivitä näkymä"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Batch Assign Bar (when 1+ tasks selected) */}
      {selected.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 px-3 flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs font-semibold">
              {selected.length} keikkaa valittu
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">Valitse kuljettaja ja paina Liitä:</span>
          </div>

          <div className="flex items-center gap-2">
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger className="h-8 w-48 text-xs bg-background">
                <SelectValue placeholder="Valitse kuljettaja..." />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                    {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!assignTo || assigning}
              onClick={assignBatch}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              {assigning ? "Liitetään..." : "Liitä"}
            </Button>

            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setSelected([])}>
              Peruuta
            </Button>
          </div>
        </div>
      )}

      {/* 4 Dispatch Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
        {columns.map((col) => (
          <div key={col.key} className={`bg-card border rounded-xl shadow-sm flex flex-col overflow-hidden ${col.headerClass}`}>
            {/* Column Header */}
            <div className="p-3 bg-muted/40 border-b flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{col.label}</h3>
                  <Badge variant="outline" className={`text-[11px] font-bold px-1.5 py-0 ${col.badgeClass}`}>
                    {col.tasks.length}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{col.sublabel}</p>
              </div>
            </div>

            {/* Task Cards */}
            <div className="p-2 space-y-2 min-h-[140px] max-h-[70vh] overflow-y-auto">
              {col.tasks.length === 0 && (
                <div className="py-8 text-center text-muted-foreground/60 text-xs italic">
                  Ei tilauksia tässä tilassa
                </div>
              )}

              {col.tasks.map((task) => {
                const originAddr = task.pickup_address || task.origin_address || task.orders?.address || "Asiakkaan osoite";
                const destAddr = task.delivery_address || task.destination_address || "Pesula";
                const custName = task.pickup_name || task.origin_name || (task.orders ? `${task.orders.first_name || ""} ${task.orders.last_name || ""}`.trim() : "Asiakas");
                const phone = task.pickup_phone || task.orders?.phone;
                const assignedDriver = driverOf(task.driver_id);
                const assignedLaundry = laundryOf(task.laundry_id || task.orders?.laundry_id || null);

                return (
                  <div
                    key={task.id}
                    className="bg-background border rounded-lg p-3 space-y-2.5 shadow-xs hover:border-primary/50 transition-all"
                  >
                    {/* Top Row: Select, Order ID, PIN, Type Badge */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Checkbox
                          checked={selected.includes(task.id)}
                          onCheckedChange={() => toggleSelect(task.id)}
                          aria-label="Valitse"
                        />
                        <span className="text-xs font-bold text-foreground truncate">
                          {shortId(task.order_id || task.id)}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1 py-0 rounded">
                          PIN {getPickupCode(task.order_id || task.id)}
                        </span>
                      </div>

                      <Badge
                        variant={task.task_type === "pickup" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 uppercase font-semibold shrink-0"
                      >
                        {task.task_type === "pickup" ? "Nouto" : "Palautus"}
                      </Badge>
                    </div>

                    {/* Customer & Phone */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-foreground truncate flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        {custName}
                      </span>
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
                        >
                          <Phone className="h-2.5 w-2.5" />
                          {phone}
                        </a>
                      )}
                    </div>

                    {/* Route Addresses */}
                    <div className="text-[11px] space-y-1 bg-muted/40 p-2 rounded">
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1 text-foreground/90 font-medium">{originAddr}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-muted-foreground pl-4">
                        <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{destAddr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-border/40">
                        <Clock className="h-3 w-3 text-sky-500 shrink-0" />
                        <span>{task.scheduled_date} klo {task.scheduled_time || task.scheduled_time_slot || "10:00"}</span>
                      </div>
                    </div>

                    {/* Driver & Laundry Row */}
                    <div className="space-y-1 text-xs">
                      {/* Driver */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-muted-foreground">Kuljettaja:</span>
                        {task.driver_id ? (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 truncate">
                            <UserCheck className="h-3 w-3 shrink-0" />
                            {fullName(assignedDriver)}
                          </span>
                        ) : (
                          <Select
                            value="none"
                            onValueChange={(val) => quickAssignDriver(task, val)}
                          >
                            <SelectTrigger className="h-6 text-[11px] w-32 px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50/50">
                              <SelectValue placeholder="Liitä kuljettaja" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled className="text-xs">Valitse kuljettaja</SelectItem>
                              {drivers.map((d) => (
                                <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                                  {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Laundry Info if applicable */}
                      {assignedLaundry && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Pesula:</span>
                          <span className="font-medium text-foreground truncate">{assignedLaundry.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Special Instructions callout */}
                    {(task.notes || task.orders?.special_instructions) && (
                      <div className="text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-300 p-1.5 rounded border border-amber-500/20">
                        <strong>Ohje:</strong> {task.notes || task.orders?.special_instructions}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center gap-1 pt-1.5 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px] flex items-center gap-1"
                        onClick={() => openEditModal(task)}
                      >
                        <Edit className="h-2.5 w-2.5" /> Muokkaa
                      </Button>

                      {task.driver_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                          onClick={() => unassign(task)}
                        >
                          Vapauta
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 ml-auto"
                        onClick={() => setDeletingTask(task)}
                        title="Poista tilaus"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Order & Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Edit className="h-4 w-4 text-primary" />
              Muokkaa tilausta {editingTask ? shortId(editingTask.order_id || editingTask.id) : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Muokkaa kuljettajaa, tilaa, aikataulua ja osoitteita. Muutokset tallentuvat heti.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Kuljettaja ja Pesula */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Kuljettaja</Label>
                <Select value={editForm.driver_id} onValueChange={(val) => setEditForm(prev => ({ ...prev, driver_id: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Valitse kuljettaja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-amber-600 font-medium">Ei kuljettajaa (Vapaa)</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                        {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Pesula</Label>
                <Select value={editForm.laundry_id} onValueChange={(val) => setEditForm(prev => ({ ...prev, laundry_id: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Valitse pesula" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-muted-foreground">Automaattinen</SelectItem>
                    {laundries.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tila ja Tyyppi */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Tehtävän tila</Label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm(prev => ({ ...prev, status: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-xs">🟡 Vapaana (unassigned)</SelectItem>
                    <SelectItem value="assigned" className="text-xs">🔵 Kuskille liitetty (assigned)</SelectItem>
                    <SelectItem value="in_progress" className="text-xs">🚚 Ajo käynnissä (in_progress)</SelectItem>
                    <SelectItem value="washing" className="text-xs">🟣 Pesulassa (washing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Keikan tyyppi</Label>
                <Select value={editForm.task_type} onValueChange={(val) => setEditForm(prev => ({ ...prev, task_type: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup" className="text-xs">Nouto (Asiakas ➜ Pesula)</SelectItem>
                    <SelectItem value="delivery" className="text-xs">Palautus (Pesula ➜ Asiakas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Aikataulu & Palkkio */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Päivämäärä</Label>
                <Input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Kellonaika</Label>
                <Input
                  value={editForm.scheduled_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="10:00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Palkkio (€)</Label>
                <Input
                  type="number"
                  value={editForm.driver_payout}
                  onChange={(e) => setEditForm(prev => ({ ...prev, driver_payout: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Asiakkaan tiedot */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t">
              <div className="space-y-1">
                <Label className="text-[11px]">Etunimi</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Sukunimi</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Puhelin</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Osoitteet */}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Lähtöosoite</Label>
                <Input
                  value={editForm.origin_address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, origin_address: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Määränpääosoite</Label>
                <Input
                  value={editForm.destination_address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, destination_address: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Muistiinpanot */}
            <div className="space-y-1">
              <Label className="text-[11px]">Erityisohjeet / Muistiinpanot</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-xs"
                placeholder="Ovikoodit, lisäohjeet..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditingTask(null)}>
              Peruuta
            </Button>
            <Button size="sm" disabled={savingEdit} onClick={handleSaveEdit}>
              {savingEdit ? "Tallennetaan..." : "Tallenna muutokset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 text-sm">
              <Trash2 className="h-4 w-4" /> Haluatko varmasti poistaa tilauksen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tämä toiminto poistaa tilauksen <strong>{deletingTask ? shortId(deletingTask.order_id || deletingTask.id) : ""}</strong> ja sen keikat pysyvästi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleDeleteOrder}
            >
              {isDeleting ? "Poistetaan..." : "Kyllä, poista"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
