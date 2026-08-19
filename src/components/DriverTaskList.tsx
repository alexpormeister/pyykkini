import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, CheckCircle, Clock, MapPin, Navigation as NavIcon, Package, Phone, Truck } from "lucide-react";

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

export const DriverTaskList = ({ driverId }: { driverId: string }) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
    setTasks((data || []) as unknown as TaskRow[]);
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("driver_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchTasks())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

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
      const { error } = await supabase
        .from("delivery_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;

      if (task.task_type === "pickup") {
        await supabase
          .from("orders")
          .update({ tracking_status: "PICKED_UP" as never, actual_pickup_time: new Date().toISOString() })
          .eq("id", task.order_id);
        toast({
          title: "Nouto kuitattu",
          description: `Palkkio ${Number(task.driver_payout).toFixed(2)} € • tilaus siirtyi pesulan työjonoon`,
        });
      } else {
        await supabase
          .from("orders")
          .update({
            tracking_status: "COMPLETED" as never,
            status: "delivered" as never,
            actual_return_time: new Date().toISOString(),
          })
          .eq("id", task.order_id);
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
                        (task.status === "in_progress" ? task.destination_address : task.origin_address) || ""
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <NavIcon className="h-4 w-4 mr-1.5" /> Navigoi
                    </a>
                  </Button>
                </div>

                {task.status === "assigned" ? (
                  <Button className="w-full" onClick={() => startTask(task)} disabled={busy === task.id}>
                    <Truck className="h-4 w-4 mr-1.5" /> Aloita tehtävä
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => completeTask(task)} disabled={busy === task.id}>
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    {isPickup ? "Merkitse noudetuksi" : "Merkitse toimitetuksi"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
