import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CheckCircle, Clock, MapPin, Package, Truck } from "lucide-react";

interface OpenTask {
  id: string;
  order_id: string;
  task_type: string;
  area: string | null;
  laundry_name: string;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  driver_payout: number;
  pickup_done: boolean;
  pickup_claimed: boolean;
  items: string[];
}

const eur = (n: number) =>
  new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(n) || 0);

const fmtDate = (date: string | null, slot: string | null) => {
  if (!date) return "Aika sovitaan";
  const d = new Date(`${date}T00:00:00`);
  const label = d.toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" });
  return slot ? `${label} klo ${slot}` : label;
};

export const DriverOpenTasks = ({ onClaimed }: { onClaimed?: () => void }) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [askReturn, setAskReturn] = useState<OpenTask | null>(null);
  const [askPickup, setAskPickup] = useState<OpenTask | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_open_delivery_tasks" as never);
    if (error) console.error("Open tasks error:", error);
    setTasks(((data || []) as unknown as OpenTask[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("open_delivery_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchTasks())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const claim = async (task: OpenTask, takeReturn: boolean) => {
    setBusy(task.id);
    const { data, error } = await supabase.rpc("driver_claim_task" as never, {
      p_task_id: task.id,
      p_take_return: takeReturn,
    } as never);
    setBusy(null);
    if (error) {
      toast({ title: "Keikan ottaminen epäonnistui", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { success?: boolean; reason?: string; return_claimed?: boolean } | null;
    if (!result?.success) {
      toast({
        title:
          result?.reason === "pickup_required"
            ? "Menokyyti täytyy ottaa samalla"
            : "Toinen kuljettaja ehti ensin",
        variant: "destructive",
      });
      fetchTasks();
      return;
    }
    toast({
      title: "Keikka on sinun",
      description: result.return_claimed
        ? "Sait sekä meno- että paluukeikan. Löydät ne Reittini-välilehdeltä."
        : "Löydät keikan Reittini-välilehdeltä.",
    });
    fetchTasks();
    onClaimed?.();
  };

  const handleClaimClick = (task: OpenTask) => {
    if (task.task_type === "pickup") {
      const hasOpenReturn = tasks.some((t) => t.order_id === task.order_id && t.task_type === "delivery");
      if (hasOpenReturn) {
        setAskReturn(task);
        return;
      }
    } else {
      const openPickup = tasks.find((t) => t.order_id === task.order_id && t.task_type === "pickup");
      if (openPickup && !task.pickup_claimed) {
        setAskPickup(task);
        return;
      }
    }
    claim(task, false);
  };

  const pairOf = (task: OpenTask, type: string) =>
    tasks.find((t) => t.order_id === task.order_id && t.task_type === type);

  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Ladataan vapaita keikkoja...</p>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-1 p-6 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Ei vapaita keikkoja</p>
          <p className="text-sm text-muted-foreground">Tarkista myöhemmin uudelleen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="-mr-1 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const isPickup = task.task_type === "pickup";
          const blocked = !isPickup && !task.pickup_done;
          return (
            <Card key={task.id} className="overflow-hidden transition-all duration-300 hover:shadow-elegant">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Badge variant={isPickup ? "default" : "secondary"} className="text-[11px]">
                      {isPickup ? "Menokeikka • asiakas → pesula" : "Paluukeikka • pesula → asiakas"}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{task.area || "Alue tarkentuu"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPickup
                        ? "Tarkka katuosoite avautuu hyväksymisen jälkeen"
                        : `Nouto pesulasta: ${task.laundry_name}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold leading-none text-primary">{eur(task.driver_payout)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Palkkiosi</div>
                  </div>
                </div>

                {task.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {task.items.map((item, i) => (
                      <Badge key={i} variant="secondary" className="max-w-full truncate text-xs font-normal">
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {fmtDate(task.scheduled_date, task.scheduled_time_slot)}
                </p>

                {blocked && (
                  <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    Paluukeikan voi kuitata vasta kun menokeikka on kuitattu.
                  </p>
                )}

                <Button className="w-full" onClick={() => handleClaimClick(task)} disabled={busy === task.id}>
                  {isPickup ? <Truck className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Ota keikka vastaan
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!askReturn} onOpenChange={(open) => !open && setAskReturn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Haluatko ajaa myös paluukeikan?</AlertDialogTitle>
            <AlertDialogDescription>
              Voit ottaa saman tilauksen paluukeikan itsellesi nyt. Jos et ota, paluukeikka jää muiden kuljettajien
              tarjolle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              onClick={() => {
                const t = askReturn;
                setAskReturn(null);
                if (t) claim(t, false);
              }}
            >
              Ei, vain menokeikka
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = askReturn;
                setAskReturn(null);
                if (t) claim(t, true);
              }}
            >
              Kyllä, otan molemmat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!askPickup} onOpenChange={(open) => !open && setAskPickup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sitoudutko ajamaan myös menokyydin?</AlertDialogTitle>
            <AlertDialogDescription>
              Paluukeikkaa ei voi ottaa yksin, koska menokeikka on vielä vapaana. Ottamalla molemmat vastaat koko
              tilauksen kuljetuksesta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {askPickup && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              {[pairOf(askPickup, "pickup"), askPickup].map(
                (t, i) =>
                  t && (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{i === 0 ? "Menokeikka" : "Paluukeikka"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(t.scheduled_date, t.scheduled_time_slot)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{t.area || "Alue tarkentuu"}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-primary">{eur(t.driver_payout)}</span>
                    </div>
                  ),
              )}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Yhteensä</span>
                <span className="text-primary">
                  {eur((pairOf(askPickup, "pickup")?.driver_payout || 0) + askPickup.driver_payout)}
                </span>
              </div>
            </div>
          )}
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = askPickup;
                setAskPickup(null);
                if (t) claim(t, true);
              }}
            >
              Kyllä, otan molemmat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
