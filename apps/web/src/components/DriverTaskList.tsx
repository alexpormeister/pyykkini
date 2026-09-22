import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, CheckCircle, Clock, MapPin, Navigation as NavIcon, Package, Phone, Scale, Truck } from "lucide-react";

interface TaskRow {
  id: string;
  order_id: string;
  task_type: string;
  status: string;
  origin_name: string | null;
  origin_address: string | null;
  origin_phone: string | null;
  destination_name: string | null;
  destination_address: string | null;
  destination_phone: string | null;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  driver_payout: number;
  route_order: number | null;
}

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

interface HandoverInfo {
  pickup_weight_kg: number | null;
  tracking_status: string | null;
}

export const DriverTaskList = ({ driverId }: { driverId: string }) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, HandoverInfo>>({});
  const [weighTask, setWeighTask] = useState<TaskRow | null>(null);
  const [weight, setWeight] = useState("");
  const [weighMode, setWeighMode] = useState<"pickup" | "return">("pickup");
  const readyNotified = useRef<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("delivery_tasks")
      .select("*")
      .eq("driver_id", driverId)
      .in("status", ["assigned", "in_progress"])
      .order("route_order", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("Driver tasks error:", error);
    }
    const rows = (data || []) as unknown as TaskRow[];
    setTasks(rows);

    const orderIds = Array.from(new Set(rows.map((t) => t.order_id)));
    if (orderIds.length > 0) {
      const { data: infoRows } = await supabase.rpc("get_orders_handover_info" as never, {
        p_order_ids: orderIds,
      } as never);
      const map: Record<string, HandoverInfo> = {};
      for (const row of (infoRows || []) as any[]) {
        map[row.order_id] = {
          pickup_weight_kg: row.pickup_weight_kg,
          tracking_status: row.tracking_status,
        };
      }
      setInfo(map);
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("driver_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchTasks())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  // Notify the driver when the laundry has finished an order they are returning
  useEffect(() => {
    for (const task of tasks) {
      if (task.task_type !== "delivery") continue;
      const track = info[task.order_id]?.tracking_status;
      if (track === "PACKAGING" && !readyNotified.current.has(task.id)) {
        readyNotified.current.add(task.id);
        toast({
          title: "Tilaus valmiina noudettavaksi",
          description: `${shortId(task.order_id)} on pesty ja pakattu — voit noutaa sen pesulalta.`,
        });
      }
    }
  }, [tasks, info, toast]);

  const startTask = async (task: TaskRow) => {
    setBusy(task.id);
    const { error } = await supabase.from("delivery_tasks").update({ status: "in_progress" }).eq("id", task.id);
    setBusy(null);
    if (error) return toast({ title: "Virhe", description: "Aloitus epäonnistui", variant: "destructive" });
    toast({ title: "Tehtävä aloitettu" });
    fetchTasks();
  };

  const completeTask = async (task: TaskRow) => {
    setBusy(task.id);
    try {
      if (task.task_type === "pickup") {
        const kg = Number(String(weight).replace(",", "."));
        if (!kg || kg <= 0) {
          toast({
            title: "Punnitse pyykit",
            description: "Kirjaa noutopaino kiloina ennen kuittausta.",
            variant: "destructive",
          });
          return;
        }
        const { data, error } = await supabase.rpc("driver_complete_pickup" as never, {
          p_task_id: task.id,
          p_weight_kg: kg,
        } as never);
        if (error) throw error;
        const result = data as { success?: boolean; reason?: string; code?: string } | null;
        if (!result?.success) {
          toast({
            title: "Punnitse pyykit",
            description: "Noutopaino puuttuu tai on virheellinen.",
            variant: "destructive",
          });
          return;
        }
        setWeighTask(null);
        setWeight("");
        toast({
          title: "Nouto kuitattu",
          description: `Palkkio ${Number(task.driver_payout).toFixed(2)} € • tilaus siirtyi pesulaan käsittelyyn.`,
        });
      } else {
        const kg = Number(String(weight).replace(",", "."));
        if (!kg || kg <= 0) {
          toast({
            title: "Punnitse pyykit",
            description: "Kirjaa palautuspaino kiloina ennen kuittausta.",
            variant: "destructive",
          });
          return;
        }
        const { data, error } = await supabase.rpc("driver_complete_delivery" as never, {
          p_task_id: task.id,
          p_weight_kg: kg,
        } as never);
        if (error) throw error;
        const result = data as { success?: boolean; reason?: string } | null;
        if (!result?.success) {
          const reasons: Record<string, string> = {
            pickup_not_done: "Paluukeikan voi kuitata vasta kun tilaus on noudettu asiakkaalta pesulaan.",
            not_picked_from_laundry: "Merkitse ensin tilaus noudetuksi pesulalta.",
            weight_required: "Kirjaa palautuspaino kiloina.",
          };
          toast({
            title: "Kuittaus ei onnistunut",
            description: reasons[result?.reason || ""] || "Tarkista tilauksen tila ja yritä uudelleen.",
            variant: "destructive",
          });
          return;
        }
        setWeighTask(null);
        setWeight("");
        toast({
          title: "Toimitus kuitattu",
          description: `Palkkio ${Number(task.driver_payout).toFixed(2)} € • tilaus valmis`,
        });
      }
      fetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: "Virhe", description: "Kuittaus epäonnistui", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const pickupFromLaundry = async (task: TaskRow) => {
    setBusy(task.id);
    try {
      const { data, error } = await supabase.rpc("driver_pickup_from_laundry" as never, {
        p_task_id: task.id,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; reason?: string } | null;
      if (!result?.success) {
        toast({
          title: "Tilaus ei ole vielä valmis",
          description: "Pesula ei ole merkinnyt tilausta valmiiksi. Saat ilmoituksen kun se on noudettavissa.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Noudettu pesulalta", description: "Tilaus on nyt matkalla asiakkaalle." });
      fetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: "Virhe", description: "Toiminto epäonnistui", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Ladataan reittiä...</p>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-1">
          <Truck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Ei aktiivisia tehtäviä</p>
          <p className="text-sm text-muted-foreground">Välityskeskus liittää keikat reitillesi.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPayout = tasks.reduce((sum, t) => sum + Number(t.driver_payout || 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Reittisi</p>
          <p className="text-sm font-semibold">{tasks.length} tehtävää</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Palkkio yhteensä</p>
          <p className="text-lg font-bold">{totalPayout.toFixed(2)} €</p>
        </div>
      </div>

      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
        {tasks.map((task, idx) => {
          const isPickup = task.task_type === "pickup";
          const orderInfo = info[task.order_id];
          const track = orderInfo?.tracking_status;
          const onTheWay = !isPickup && (track === "OUT_FOR_DELIVERY" || track === "COMPLETED");
          const laundryReady = !isPickup && (track === "PACKAGING" || onTheWay);
          const navigateToDestination = isPickup ? task.status === "in_progress" : onTheWay;
          return (
            <Card key={task.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0">{task.route_order ?? idx + 1}</Badge>
                    <span className="text-sm font-semibold truncate">
                      {isPickup ? "Nouto asiakkaalta → Pesulaan" : "Nouto pesulasta → Asiakkaalle"}
                    </span>
                  </span>
                  <span className="text-base font-bold shrink-0">{Number(task.driver_payout).toFixed(2)} €</span>
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {task.scheduled_date} • {task.scheduled_time_slot} • {shortId(task.order_id)}
                </p>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {isPickup ? <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" /> : <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Lähtö</p>
                      <p className="text-sm font-medium truncate">{task.origin_name}</p>
                      <p className="text-xs text-muted-foreground">{task.origin_address}</p>
                    </div>
                  </div>
                  <ArrowDown className="h-4 w-4 text-muted-foreground ml-0.5" />
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Kohde</p>
                      <p className="text-sm font-medium truncate">{task.destination_name}</p>
                      <p className="text-xs text-muted-foreground">{task.destination_address}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${(isPickup ? task.origin_phone : task.destination_phone) || ""}`}>
                      <Phone className="h-4 w-4 mr-1.5" /> Soita
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        (navigateToDestination ? task.destination_address : task.origin_address) || ""
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <NavIcon className="h-4 w-4 mr-1.5" /> Navigoi
                    </a>
                  </Button>
                </div>

                {!isPickup && !laundryReady ? (
                  <div className="rounded-lg border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                    Odottaa pesulaa. Saat ilmoituksen kun tilaus on pesty ja valmiina noudettavaksi.
                  </div>
                ) : !isPickup ? (
                  onTheWay ? (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setWeight("");
                        setWeighMode("return");
                        setWeighTask(task);
                      }}
                      disabled={busy === task.id}
                    >
                      <Scale className="h-4 w-4 mr-1.5" /> Punnitse ja kuittaa toimitus
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => pickupFromLaundry(task)} disabled={busy === task.id}>
                      <Package className="h-4 w-4 mr-1.5" /> Noudettu pesulalta
                    </Button>
                  )
                ) : task.status === "assigned" ? (
                  <Button className="w-full" onClick={() => startTask(task)} disabled={busy === task.id}>
                    <Truck className="h-4 w-4 mr-1.5" /> Aloita tehtävä
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setWeight("");
                      setWeighMode("pickup");
                      setWeighTask(task);
                    }}
                    disabled={busy === task.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Punnitse ja kuittaa nouto
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!weighTask} onOpenChange={(open) => !open && setWeighTask(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4" /> {weighMode === "pickup" ? "Punnitse noutopaino" : "Punnitse palautuspaino"}
            </DialogTitle>
            <DialogDescription>
              {weighMode === "pickup"
                ? "Kirjaa pyykkien paino kiloina. Tilaus siirtyy tämän jälkeen pesulalle käsittelyyn."
                : "Kirjaa palautettavien pyykkien paino kiloina. Tilaus merkitään tämän jälkeen suoritetuksi."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pickup-weight">Paino (kg)</Label>
            <Input
              id="pickup-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="esim. 7.5"
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => weighTask && completeTask(weighTask)}
              disabled={!weight || busy === weighTask?.id}
            >
              {weighMode === "pickup" ? "Kuittaa nouto" : "Kuittaa toimitus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
