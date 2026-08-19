import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock,
  MapPin,
  Package,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";

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
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  status: string;
  driver_payout: number;
  route_order: number | null;
  batch_id: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Odottaa pesulaa",
  unassigned: "Ei kuskia",
  assigned: "Kuski määritetty",
  in_progress: "Käynnissä",
  completed: "Valmis",
  failed: "Epäonnistui",
};

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Tuntematon" : "Ei kuskia";

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const cityOf = (address?: string | null) => {
  if (!address) return "Muu alue";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const cleaned = tail.replace(/\d{5}/g, "").replace(/finland|suomi/i, "").trim();
  return cleaned || "Muu alue";
};

const taskCity = (t: TaskRow) =>
  cityOf(t.task_type === "pickup" ? t.origin_address : t.destination_address);

export const DispatchTaskBoard = () => {
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [routeDriver, setRouteDriver] = useState("");

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("dispatch_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAll = async () => {
    try {
      const [tasksRes, rolesRes, shiftsRes] = await Promise.all([
        supabase
          .from("delivery_tasks")
          .select("*")
          .order("scheduled_date", { ascending: true })
          .order("route_order", { ascending: true, nullsFirst: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
        supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
      ]);

      setTasks((tasksRes.data || []) as unknown as TaskRow[]);

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

  const openTasks = useMemo(
    () => tasks.filter((t) => !["completed", "failed"].includes(t.status)),
    [tasks]
  );

  const scheduledAt = (t: TaskRow) =>
    new Date(`${t.scheduled_date || "1970-01-01"}T${(t.scheduled_time_slot || "00:00").slice(0, 5)}`).getTime();
  const isLate = (t: TaskRow) => scheduledAt(t) < Date.now() && !["completed", "failed"].includes(t.status);
  const hasAlert = (t: TaskRow) => t.status === "unassigned" && (isLate(t) || scheduledAt(t) - Date.now() < 30 * 60 * 1000);

  const cities = useMemo(() => Array.from(new Set(openTasks.map(taskCity))).sort(), [openTasks]);

  const filtered = useMemo(
    () =>
      openTasks.filter((t) => {
        if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
        if (cityFilter !== "all" && taskCity(t) !== cityFilter) return false;
        if (dateFilter && t.scheduled_date !== dateFilter) return false;
        return true;
      }),
    [openTasks, typeFilter, cityFilter, dateFilter]
  );

  const columns = useMemo(
    () => [
      { key: "pending", label: "Odottaa pesulaa", icon: Package, tasks: filtered.filter((t) => t.status === "pending") },
      { key: "unassigned", label: "Vapaat keikat", icon: AlertTriangle, tasks: filtered.filter((t) => t.status === "unassigned") },
      { key: "assigned", label: "Kuskille liitetty", icon: UserCheck, tasks: filtered.filter((t) => t.status === "assigned") },
      { key: "in_progress", label: "Käynnissä", icon: Truck, tasks: filtered.filter((t) => t.status === "in_progress") },
    ],
    [filtered]
  );

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
      }
      toast({ title: "Keikat liitetty", description: `${ordered.length} tehtävää kuljettajalle ${fullName(driverOf(assignTo))}` });
      setSelected([]);
      setRouteDriver(assignTo);
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
    toast({ title: "Tehtävä vapautettu" });
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

      toast({ title: "Tilaus hylätty", description: "Nouto- ja paluukeikka hylättiin." });
      fetchAll();
    } catch (error) {
      console.error(error);
      toast({ title: "Virhe", description: "Hylkäys epäonnistui", variant: "destructive" });
    }
  };

  const routeTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.driver_id === routeDriver && !["completed", "failed"].includes(t.status))
        .sort((a, b) => (a.route_order || 0) - (b.route_order || 0)),
    [tasks, routeDriver]
  );

  const moveTask = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= routeTasks.length) return;
    const a = routeTasks[index];
    const b = routeTasks[target];
    await Promise.all([
      supabase.from("delivery_tasks").update({ route_order: target + 1 }).eq("id", a.id),
      supabase.from("delivery_tasks").update({ route_order: index + 1 }).eq("id", b.id),
    ]);
    fetchAll();
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Ladataan välitysnäkymää...</div>;
  }

  const kpis = {
    alerts: openTasks.filter(hasAlert).length,
    pickups: openTasks.filter((t) => t.task_type === "pickup").length,
    deliveries: openTasks.filter((t) => t.task_type === "delivery").length,
    driversFree: drivers.filter((d) => d.is_active && !openTasks.some((t) => t.driver_id === d.user_id)).length,
    driversBusy: drivers.filter((d) => openTasks.some((t) => t.driver_id === d.user_id)).length,
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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
          { key: "all", label: "Kaikki" },
          { key: "pickup", label: "Noudot" },
          { key: "delivery", label: "Palautukset" },
        ] as { key: "all" | "pickup" | "delivery"; label: string }[]).map((f) => (
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

      {/* Board */}
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
                <ScrollArea className="max-h-[32rem]">
                  <div className="space-y-2 pr-1">
                    {col.tasks.length === 0 && (
                      <p className="text-[11px] text-muted-foreground py-4 text-center">Ei tehtäviä</p>
                    )}
                    {col.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`rounded-lg border bg-card p-3 space-y-2 ${isLate(task) ? "border-destructive" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            {task.status !== "pending" && (
                              <Checkbox
                                checked={selected.includes(task.id)}
                                onCheckedChange={() => toggleSelect(task.id)}
                                aria-label="Valitse tehtävä"
                              />
                            )}
                            <span className="text-xs font-semibold truncate">{shortId(task.order_id)}</span>
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {task.task_type === "pickup" ? "Nouto" : "Palautus"}
                          </Badge>
                        </div>

                        <div className="text-[11px] space-y-1">
                          <p className="flex items-start gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="truncate">{task.origin_name || "-"}</span>
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground pl-4">
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{task.destination_name || "-"}</span>
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {task.scheduled_date} {task.scheduled_time_slot}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {task.driver_id ? fullName(driverOf(task.driver_id)) : STATUS_LABELS[task.status]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {task.driver_id && (
                            <>
                              <Badge variant="secondary" className="text-[10px]">Reitti #{task.route_order ?? "-"}</Badge>
                              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => unassign(task)}>
                                Vapauta
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-destructive hover:text-destructive ml-auto"
                            onClick={() => rejectOrder(task)}
                          >
                            Hylkää
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Route editor */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex flex-wrap items-center gap-2">
            <Truck className="h-4 w-4" /> Kuljettajan reitti
            <Select value={routeDriver} onValueChange={setRouteDriver}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Valitse kuljettaja" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.user_id} value={d.user_id} className="text-xs">{fullName(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {!routeDriver && <p className="text-xs text-muted-foreground">Valitse kuljettaja järjestääksesi reitin.</p>}
          {routeDriver && routeTasks.length === 0 && (
            <p className="text-xs text-muted-foreground">Ei aktiivisia tehtäviä tälle kuljettajalle.</p>
          )}
          {routeTasks.map((task, idx) => (
            <div key={task.id} className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <Badge variant="secondary" className="shrink-0">{idx + 1}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">
                  {task.task_type === "pickup" ? "Nouto" : "Palautus"} • {shortId(task.order_id)}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {task.origin_address} → {task.destination_address}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                {task.scheduled_time_slot}
              </span>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => moveTask(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => moveTask(idx, 1)}
                  disabled={idx === routeTasks.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
