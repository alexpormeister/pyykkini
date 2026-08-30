import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertTriangle,
  ArrowRight,
  Clock,
  Edit,
  MapPin,
  Package,
  Trash2,
  Truck,
  UserCheck,
  Users,
  WashingMachine,
  Phone,
  User,
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Odottaa pesulaa/kuskia",
  unassigned: "Ei kuskia",
  assigned: "Kuski määritetty",
  in_progress: "Käynnissä",
  awaiting_laundry: "Pesulassa",
  washing: "Pesulassa",
  completed: "Valmis",
  failed: "Epäonnistui",
  cancelled: "Peruutettu",
};

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Tuntematon" : "Ei kuskia";

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

  const [typeFilter, setTypeFilter] = useState<"all" | "pickup" | "delivery" | "laundry">("all");
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

  const fetchAll = async () => {
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
    }
  };

  // Vain aktiiviset tehtävät (valmiit, toimitettu, hylätyt ja peruutetut poistuvat välityssivulta)
  const openTasks = useMemo(() => {
    return tasks.filter((t) => {
      const taskSt = (t.status || "").toLowerCase();
      const orderSt = (t.orders?.status || "").toLowerCase();
      const orderTracking = (t.orders?.tracking_status || "").toUpperCase();

      // Poistetaan jos tehtävä tai tilaus on valmis, toimitettu, hylätty tai peruutettu
      if (["completed", "failed", "cancelled"].includes(taskSt)) return false;
      if (["delivered", "completed", "rejected", "cancelled"].includes(orderSt)) return false;
      if (orderTracking === "COMPLETED") return false;

      return true;
    });
  }, [tasks]);

  const scheduledAt = (t: TaskRow) =>
    new Date(`${t.scheduled_date || "1970-01-01"}T${(t.scheduled_time || t.scheduled_time_slot || "00:00").slice(0, 5)}`).getTime();
  const isLate = (t: TaskRow) => scheduledAt(t) < Date.now() && !["completed", "failed"].includes(t.status);
  const hasAlert = (t: TaskRow) => t.status === "unassigned" && (isLate(t) || scheduledAt(t) - Date.now() < 30 * 60 * 1000);

  const cities = useMemo(() => Array.from(new Set(openTasks.map(taskCity))).sort(), [openTasks]);

  const filtered = useMemo(() => {
    return openTasks.filter((t) => {
      const orderSt = (t.orders?.status || "").toLowerCase();
      const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";

      if (typeFilter === "pickup" && (t.task_type !== "pickup" || isLaundry)) return false;
      if (typeFilter === "delivery" && (t.task_type !== "delivery" || isLaundry)) return false;
      if (typeFilter === "laundry" && !isLaundry) return false;

      if (cityFilter !== "all" && taskCity(t) !== cityFilter) return false;
      if (dateFilter && t.scheduled_date !== dateFilter) return false;
      return true;
    });
  }, [openTasks, typeFilter, cityFilter, dateFilter]);

  // 4 aktiivista välityssaraketta
  const columns = useMemo(() => {
    return [
      {
        key: "unassigned",
        label: "Vapaana / Odottaa kuskia",
        icon: AlertTriangle,
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && (!t.driver_id || t.status === "unassigned" || t.status === "pending");
        }),
      },
      {
        key: "pickup_active",
        label: "Kuskilla (Nouto)",
        icon: Package,
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "pickup" && t.driver_id && ["assigned", "in_progress", "picking_up"].includes(t.status);
        }),
      },
      {
        key: "laundry",
        label: "Pesulassa",
        icon: WashingMachine,
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const orderTracking = (t.orders?.tracking_status || "").toUpperCase();
          return orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry" || ["WASHING", "PACKAGING"].includes(orderTracking);
        }),
      },
      {
        key: "delivery_active",
        label: "Kuskilla (Palautus)",
        icon: Truck,
        tasks: filtered.filter((t) => {
          const orderSt = (t.orders?.status || "").toLowerCase();
          const isLaundry = orderSt === "washing" || t.status === "washing" || t.status === "awaiting_laundry";
          return !isLaundry && t.task_type === "delivery" && t.driver_id && ["assigned", "in_progress", "returning"].includes(t.status);
        }),
      },
    ];
  }, [filtered]);

  const driverOf = (id: string | null) => drivers.find((d) => d.user_id === id) || null;

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
      toast({ title: "Keikat liitetty", description: `${ordered.length} tehtävää kuljettajalle ${fullName(driverOf(assignTo))}` });
      setSelected([]);
      fetchAll();
    } catch (error) {
      console.error(error);
      toast({ title: "Virhe", description: "Keikkojen liittäminen epäonnistui", variant: "destructive" });
    } finally {
      setAssigning(false);
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
    toast({ title: "Tehtävä vapautettu", description: "Keikka on nyt vapaasti kenen tahansa otettavissa." });
    fetchAll();
  };

  const rejectOrder = async (task: TaskRow) => {
    try {
      const { error: taskError } = await supabase
        .from("delivery_tasks")
        .update({ status: "cancelled", driver_id: null, route_order: null, batch_id: null })
        .eq("order_id", task.order_id);
      if (taskError) throw taskError;

      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "rejected", rejected_at: new Date().toISOString() })
        .eq("id", task.order_id);
      if (orderError) throw orderError;

      toast({ title: "Tilaus hylätty", description: "Tilaus ja sen keikat on hylätty ja poistettu aktiivisista." });
      fetchAll();
    } catch (error) {
      console.error(error);
      toast({
        title: "Virhe",
        description: (error as { message?: string })?.message || "Hylkäys epäonnistui",
        variant: "destructive",
      });
    }
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

      toast({ title: "Muutokset tallennettu! ✨", description: "Tilauksen ja tehtävän tiedot on päivitetty onnistuneesti." });
      setEditingTask(null);
      fetchAll();
    } catch (error: any) {
      console.error("Save edit error:", error);
      toast({ title: "Tallennus epäonnistui", description: error.message || "Tarkista tiedot ja yritä uudelleen.", variant: "destructive" });
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

      // Poistetaan ensin tehtävät
      await supabase.from("delivery_tasks").delete().eq("order_id", orderId);
      await supabase.from("delivery_tasks").delete().eq("id", deletingTask.id);

      // Poistetaan tilaus
      if (deletingTask.order_id) {
        await supabase.from("orders").delete().eq("id", deletingTask.order_id);
      }

      toast({ title: "Tilaus poistettu 🗑️", description: "Tilaus ja sen tehtävät poistettiin kokonaan järjestelmästä." });
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
    return <div className="p-8 text-center text-muted-foreground">Ladataan välitysnäkymää...</div>;
  }

  const kpis = {
    alerts: openTasks.filter(hasAlert).length,
    pickups: openTasks.filter((t) => t.task_type === "pickup").length,
    laundry: openTasks.filter((t) => (t.orders?.status || "").toLowerCase() === "washing" || t.status === "washing").length,
    deliveries: openTasks.filter((t) => t.task_type === "delivery").length,
    driversFree: drivers.filter((d) => d.is_active && !openTasks.some((t) => t.driver_id === d.user_id)).length,
    driversBusy: drivers.filter((d) => openTasks.some((t) => t.driver_id === d.user_id)).length,
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className={`rounded-xl border p-3 ${kpis.alerts > 0 ? "border-destructive bg-destructive/5" : "bg-card"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className={`h-3.5 w-3.5 ${kpis.alerts > 0 ? "text-destructive" : ""}`} /> Kriittiset
          </div>
          <p className={`text-2xl font-bold ${kpis.alerts > 0 ? "text-destructive" : ""}`}>{kpis.alerts}</p>
          <p className="text-[11px] text-muted-foreground">Ilman kuskia &amp; kiireellinen</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Noutokeikat
          </div>
          <p className="text-2xl font-bold">{kpis.pickups}</p>
          <p className="text-[11px] text-muted-foreground">Asiakas → pesula</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <WashingMachine className="h-3.5 w-3.5 text-purple-600" /> Pesulassa
          </div>
          <p className="text-2xl font-bold text-purple-600">{kpis.laundry}</p>
          <p className="text-[11px] text-muted-foreground">Pyykit pesussa</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" /> Palautuskeikat
          </div>
          <p className="text-2xl font-bold">{kpis.deliveries}</p>
          <p className="text-[11px] text-muted-foreground">Pesula → asiakas</p>
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
          { key: "all", label: "Kaikki aktiiviset" },
          { key: "pickup", label: "Noudot" },
          { key: "laundry", label: "Pesulassa" },
          { key: "delivery", label: "Palautukset" },
        ] as { key: "all" | "pickup" | "delivery" | "laundry"; label: string }[]).map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={typeFilter === f.key ? "default" : "outline"}
            onClick={() => setTypeFilter(f.key)}
            className="h-8 text-xs"
          >
            {f.label}
          </Button>
        ))}
        <Select value={cityFilter} onValueChange={setCityFilter}>
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
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-8 w-40 text-xs" />
        {dateFilter && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDateFilter("")}>
            Tyhjennä pvm
          </Button>
        )}
      </div>

      {/* Batch bar */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <Badge variant={selected.length ? "default" : "secondary"}>{selected.length} valittu</Badge>
        <Select value={assignTo} onValueChange={setAssignTo}>
          <SelectTrigger className="h-9 w-56 text-xs">
            <SelectValue placeholder="Valitse kuljettaja" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                {fullName(d)} {d.is_active ? "• vuorossa" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!assignTo || selected.length === 0 || assigning} onClick={assignBatch}>
          <UserCheck className="h-4 w-4 mr-1.5" /> Liitä kuljettajalle
        </Button>
        {selected.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Tyhjennä valinta
          </Button>
        )}
      </div>

      {/* Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {columns.map((col) => {
          const Icon = col.icon;
          return (
            <Card key={col.key} className="bg-muted/30">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{col.label}</span>
                  </span>
                  <Badge variant={col.key === "unassigned" && col.tasks.length > 0 ? "destructive" : "secondary"}>
                    {col.tasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ScrollArea className="max-h-[34rem]">
                  <div className="space-y-2 pr-1">
                    {col.tasks.length === 0 && (
                      <p className="text-[11px] text-muted-foreground py-4 text-center">Ei aktiivisia tehtäviä</p>
                    )}
                    {col.tasks.map((task) => {
                      const originAddr = task.pickup_address || task.origin_address || task.orders?.address || "-";
                      const destAddr = task.delivery_address || task.destination_address || "Pesuni Pesulakeskus";
                      const custName = task.pickup_name || task.origin_name || (task.orders ? `${task.orders.first_name || ""} ${task.orders.last_name || ""}`.trim() : "Asiakas");
                      const phone = task.pickup_phone || task.orders?.phone;

                      return (
                        <div
                          key={task.id}
                          className={`rounded-lg border bg-card p-3 space-y-2.5 shadow-sm ${isLate(task) ? "border-destructive/60 bg-destructive/5" : "hover:border-primary/40"}`}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                checked={selected.includes(task.id)}
                                onCheckedChange={() => toggleSelect(task.id)}
                                aria-label="Valitse tehtävä"
                              />
                              <span className="text-xs font-bold truncate">{shortId(task.order_id || task.id)}</span>
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                PIN: {getPickupCode(task.order_id || task.id)}
                              </span>
                            </span>
                            <Badge variant={task.task_type === "pickup" ? "default" : "outline"} className="text-[10px]">
                              {task.task_type === "pickup" ? "Nouto" : "Palautus"}
                            </Badge>
                          </div>

                          {/* Customer & Address Details */}
                          <div className="text-[11px] space-y-1 bg-muted/40 p-2 rounded-md">
                            <div className="flex items-center justify-between font-medium">
                              <span className="flex items-center gap-1 truncate text-foreground">
                                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                {custName}
                              </span>
                              {phone && (
                                <a href={`tel:${phone}`} className="flex items-center gap-1 text-primary hover:underline text-[10px]">
                                  <Phone className="h-2.5 w-2.5" /> {phone}
                                </a>
                              )}
                            </div>
                            <p className="flex items-start gap-1 text-muted-foreground pt-0.5">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                              <span className="truncate">{originAddr}</span>
                            </p>
                            <p className="flex items-center gap-1 text-muted-foreground pl-4">
                              <ArrowRight className="h-3 w-3 shrink-0 text-emerald-500" />
                              <span className="truncate">{destAddr}</span>
                            </p>
                            <p className="flex items-center gap-1 text-muted-foreground pt-0.5">
                              <Clock className="h-3 w-3 shrink-0 text-sky-500" />
                              {task.scheduled_date} {task.scheduled_time || task.scheduled_time_slot || "10:00"}
                            </p>
                          </div>

                          {/* Driver / Payout Info */}
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-muted-foreground truncate font-medium">
                              {task.driver_id ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" /> {fullName(driverOf(task.driver_id))}
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">⚠️ {STATUS_LABELS[task.status] || "Ei kuljettajaa"}</span>
                              )}
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {Number(task.driver_payout || 19).toFixed(2)} €
                            </Badge>
                          </div>

                          {/* Weight Handover info if any */}
                          {handover[task.order_id]?.pickup_weight_kg != null && (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700">
                                Paino: {Number(handover[task.order_id]?.pickup_weight_kg).toFixed(1)} kg
                              </Badge>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] flex items-center gap-1 hover:bg-primary/10 hover:text-primary"
                              onClick={() => openEditModal(task)}
                            >
                              <Edit className="h-3 w-3" /> Muokkaa
                            </Button>

                            {task.driver_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] hover:bg-amber-50 text-amber-700"
                                onClick={() => unassign(task)}
                              >
                                Vapauta
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 ml-auto"
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
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Task / Order Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-primary" /> Muokkaa tilausta ja keikkaa {editingTask ? shortId(editingTask.order_id || editingTask.id) : ""}
            </DialogTitle>
            <DialogDescription>
              Voit muuttaa kuljettajaa, pesulaa, tilaa, osoitteita ja aikataulua. Muutokset päivittyvät järjestelmään reaaliajassa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Kuljettaja ja Pesula */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kuljettaja</Label>
                <Select value={editForm.driver_id} onValueChange={(val) => setEditForm(prev => ({ ...prev, driver_id: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Valitse kuljettaja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs font-semibold text-amber-600">Ei kuljettajaa (vapaa keikka)</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                        {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Pesula</Label>
                <Select value={editForm.laundry_id} onValueChange={(val) => setEditForm(prev => ({ ...prev, laundry_id: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Valitse pesula" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-muted-foreground">Automaattinen / Ei määritetty</SelectItem>
                    {laundries.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tila ja Tyyppi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tehtävän tila</Label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm(prev => ({ ...prev, status: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Valitse tila" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-xs">🟡 Vapaana (unassigned)</SelectItem>
                    <SelectItem value="assigned" className="text-xs">🔵 Kuskille liitetty (assigned)</SelectItem>
                    <SelectItem value="in_progress" className="text-xs">🚚 Ajo käynnissä (in_progress)</SelectItem>
                    <SelectItem value="washing" className="text-xs">🟣 Pesulassa pesussa (washing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Keikan tyyppi</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Päivämäärä</Label>
                <Input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kellonaika / Aika</Label>
                <Input
                  value={editForm.scheduled_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="10:00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kuljettajan palkkio (€)</Label>
                <Input
                  type="number"
                  value={editForm.driver_payout}
                  onChange={(e) => setEditForm(prev => ({ ...prev, driver_payout: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Asiakkaan tiedot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs">Etunimi</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sukunimi</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Puhelin</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Osoitteet */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lähtöosoite (Noutopaikka)</Label>
                <Input
                  value={editForm.origin_address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, origin_address: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Katuosoite, Postinumero Kaupunki"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Määränpääosoite (Toimituspaikka)</Label>
                <Input
                  value={editForm.destination_address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, destination_address: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Pesula tai asiakkaan osoite"
                />
              </div>
            </div>

            {/* Muistiinpanot */}
            <div className="space-y-1.5">
              <Label className="text-xs">Erityisohjeet / Lisätiedot</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-xs"
                placeholder="Ovikoodi, lisäohjeet kuljettajalle jne..."
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
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Haluatko varmasti poistaa tilauksen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tämä toiminto poistaa tilauksen <strong>{deletingTask ? shortId(deletingTask.order_id || deletingTask.id) : ""}</strong> ja kaikki sen nouto- ja palautustehtävät kokonaan järjestelmästä.
              Tilaus poistuu välittömästi sekä Välityksestä että Pesulasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleDeleteOrder}
            >
              {isDeleting ? "Poistetaan..." : "Kyllä, poista tilaus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
