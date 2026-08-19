import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, ChevronDown, ChevronUp, Package, Scale, Truck } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";

interface CompletedTask {
  id: string;
  order_id: string;
  task_type: string;
  completed_at: string | null;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  driver_payout: number;
  pickup_weight_kg: number | null;
  return_weight_kg: number | null;
  items: string[] | null;
}

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

export const DriverCompletedTasks = () => {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_driver_completed_tasks" as never);
    if (error) console.error("Completed tasks error:", error);
    setTasks(((data || []) as unknown as CompletedTask[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("driver_completed_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchTasks())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Ladataan keikkoja...</p>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-1">
          <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Ei suoritettuja keikkoja</p>
          <p className="text-sm text-muted-foreground">Suoritetut keikat listautuvat tänne.</p>
        </CardContent>
      </Card>
    );
  }

  const total = tasks.reduce((sum, t) => sum + Number(t.driver_payout || 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Suoritetut keikat</p>
          <p className="text-sm font-semibold">{tasks.length} kpl</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Palkkiot yhteensä</p>
          <p className="text-lg font-bold">{total.toFixed(2)} €</p>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const isPickup = task.task_type === "pickup";
          const open = openId === task.id;
          const done = task.completed_at ? format(new Date(task.completed_at), "d.M.yyyy HH:mm", { locale: fi }) : "—";
          const weight = isPickup ? task.pickup_weight_kg : task.return_weight_kg;
          return (
            <Card key={task.id} className="overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setOpenId(open ? null : task.id)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{shortId(task.order_id)}</p>
                    <p className="text-xs text-muted-foreground">{done}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-bold">{Number(task.driver_payout).toFixed(2)} €</span>
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </button>

              {open && (
                <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t">
                  <div className="flex items-center gap-2 pt-3">
                    {isPickup ? <Truck className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                    <span className="text-sm font-medium">{isPickup ? "Menokeikka" : "Paluukeikka"}</span>
                  </div>

                  {(task.items?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {task.items!.map((item, i) => (
                        <Badge key={i} variant="secondary" className="font-normal">{item}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Sovittu aika</p>
                      <p className="font-medium">
                        {task.scheduled_date || "—"} {task.scheduled_time_slot || ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Suoritettu</p>
                      <p className="font-medium">{done}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Palkkiosi</p>
                      <p className="font-medium">{Number(task.driver_payout).toFixed(2)} €</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Scale className="h-3 w-3" /> Kirjattu paino
                      </p>
                      <p className="font-medium">{weight != null ? `${Number(weight).toFixed(1)} kg` : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
