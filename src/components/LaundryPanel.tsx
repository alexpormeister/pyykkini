import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Truck, WashingMachine, PackageCheck, Camera, Search, FileText, Download,
  Euro, Clock, Loader2, CheckCircle2, Inbox, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  service_name: string;
  product_name: string | null;
  quantity: number;
  laundry_price: number | null;
  total_price: number;
}

interface LaundryOrder {
  id: string;
  service_name: string;
  special_instructions: string | null;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  status: string | null;
  tracking_status: string | null;
  laundry_status: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

interface Settlement {
  id: string;
  orders_count: number;
  gross_amount: number;
  platform_commission: number;
  net_amount: number;
  period_start: string | null;
  period_end: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  order_ids: string[] | null;
}

interface Contract {
  id: string;
  title: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  payment_terms: string | null;
  notes: string | null;
  file_url: string | null;
}

const eur = (n: number) => `${(n || 0).toFixed(2).replace(".", ",")} €`;

const orderRef = (o: LaundryOrder) => o.id.slice(0, 8).toUpperCase();

const fmtDateTime = (date: string, time: string) => {
  const d = new Date(`${date}T${time}`);
  return d.toLocaleString("fi-FI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const LaundryPanel = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";

  const [laundries, setLaundries] = useState<{ id: string; name: string }[]>([]);
  const [laundryId, setLaundryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [prices, setPrices] = useState<{ product_id: string; price: number; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [noteOrder, setNoteOrder] = useState<LaundryOrder | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolve which laundry to show
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      if (isAdmin) {
        const { data } = await supabase.from("laundries").select("id, name").order("name");
        setLaundries(data || []);
        setLaundryId((prev) => prev || data?.[0]?.id || null);
      } else {
        const { data } = await supabase
          .from("laundry_users")
          .select("laundry_id, laundries(id, name)")
          .eq("user_id", user.id);
        const rows = (data || []).map((r) => r.laundries).filter(Boolean) as { id: string; name: string }[];
        setLaundries(rows);
        setLaundryId(rows[0]?.id || null);
      }
      setLoading(false);
    };
    init();
  }, [user, isAdmin]);

  const fetchData = useCallback(async () => {
    if (!laundryId) return;
    setLoading(true);
    const itemsSelect =
      "id, service_name, special_instructions, pickup_date, pickup_time, return_date, return_time, status, tracking_status, laundry_status, final_price, created_at, updated_at, order_items(id, service_type, service_name, product_name, quantity, laundry_price, total_price)";
    const [o, unclaimed, s, c, p] = await Promise.all([
      supabase
        .from("orders")
        .select(itemsSelect)
        .eq("laundry_id", laundryId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(itemsSelect)
        .is("laundry_id", null)
        .eq("laundry_status", "pending")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("settlements")
        .select("*")
        .eq("payee_type", "laundry")
        .eq("payee_id", laundryId)
        .order("created_at", { ascending: false }),
      supabase.from("laundry_contracts").select("*").eq("laundry_id", laundryId).order("created_at", { ascending: false }),
      supabase
        .from("product_laundry_prices")
        .select("product_id, price, products(name)")
        .eq("laundry_id", laundryId)
        .eq("is_active", true),
    ]);
    const rawOrders = [...(unclaimed.data || []), ...(o.data || [])];
    const uniqueOrders = Array.from(new Map(rawOrders.map((item) => [item.id, item])).values());
    setOrders(uniqueOrders as unknown as LaundryOrder[]);
    setSettlements((s.data || []) as Settlement[]);
    setContracts((c.data || []) as Contract[]);
    setPrices(
      ((p.data || []) as unknown as { product_id: string; price: number; products?: { name?: string } | null }[]).map(
        (row) => ({
          product_id: row.product_id,
          price: row.price,
          name: row.products?.name || row.product_id,
        })
      )
    );
    setLoading(false);
  }, [laundryId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`laundry_panel_realtime_${laundryId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, laundryId]);

  const track = (o: LaundryOrder) => (o.tracking_status || "PENDING").toUpperCase();
  const lStatus = (o: LaundryOrder) => (o.laundry_status || "pending").toLowerCase();
  const isCancelledOrRejected = (o: LaundryOrder) => o.status === "cancelled" || o.status === "rejected";
  const isAcceptedByLaundry = (o: LaundryOrder) => ["accepted", "washing"].includes(lStatus(o));

  // 1. Hyväksyttävänä (Odottaa pesulan hyväksyntää)
  const awaiting = orders.filter((o) => lStatus(o) === "pending" && !isCancelledOrRejected(o));

  // 2. Saapuvat (Pesula hyväksynyt, pyykit noudettavana asiakkaalta)
  const incoming = orders.filter(
    (o) =>
      isAcceptedByLaundry(o) &&
      (track(o) === "PENDING" || track(o) === "pending") &&
      o.status !== "washing" &&
      !isCancelledOrRejected(o),
  );

  // 3. Käsittelyssä (Pyykit noudettu / pesulassa käsittelyssä)
  const inProgress = orders.filter(
    (o) =>
      isAcceptedByLaundry(o) &&
      (["PICKED_UP", "WASHING"].includes(track(o)) || o.status === "washing" || lStatus(o) === "washing") &&
      !["PACKAGING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "COMPLETED"].includes(track(o)) &&
      o.status !== "delivered" &&
      !isCancelledOrRejected(o),
  );

  // 4. Valmiit (Pesty & pakattu, odottaa kuljettajan palautuskuljetusta)
  const ready = orders.filter(
    (o) =>
      isAcceptedByLaundry(o) &&
      ["PACKAGING", "READY_FOR_DELIVERY"].includes(track(o)) &&
      !["OUT_FOR_DELIVERY", "COMPLETED"].includes(track(o)) &&
      o.status !== "delivered" &&
      !isCancelledOrRejected(o),
  );

  // 5. Historia / Toimituksessa & Valmiit
  const history = orders.filter((o) => ["OUT_FOR_DELIVERY", "COMPLETED"].includes(track(o)) || o.status === "delivered");

  const decide = async (order: LaundryOrder, decision: "accepted" | "rejected") => {
    if (!laundryId) return;
    const { data, error } = await supabase.rpc("laundry_decide_order" as never, {
      p_order_id: order.id,
      p_laundry_id: laundryId,
      p_decision: decision,
    } as never);
    if (error) {
      toast({ title: "Päivitys epäonnistui", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { success?: boolean; reason?: string } | null;
    if (result && result.success === false) {
      toast({
        title: result.reason === "already_claimed" ? "Toinen pesula ehti ensin" : "Tilaus on jo käsitelty",
        variant: "destructive",
      });
      fetchData();
      return;
    }
    toast({
      title: decision === "accepted" ? "Tilaus hyväksytty" : "Tilaus hylätty",
      description:
        decision === "accepted"
          ? "Noutokeikka on nyt kuljettajien saatavilla."
          : "Tilaus peruttiin eikä se välity kuljettajille.",
    });
    fetchData();
  };

  const setStatus = async (order: LaundryOrder, status: "WASHING" | "PACKAGING") => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({ tracking_status: status as never, updated_at: nowIso })
      .eq("id", order.id);
    if (error) {
      toast({ title: "Päivitys epäonnistui", description: error.message, variant: "destructive" });
      return;
    }
    if (status === "PACKAGING") {
      await supabase
        .from("delivery_tasks")
        .update({ status: "unassigned", updated_at: nowIso })
        .eq("order_id", order.id)
        .eq("task_type", "delivery");
    }
    toast({
      title: status === "PACKAGING" ? "Merkitty valmiiksi ✅" : "Vastaanotettu käsittelyyn 🧺",
      description: status === "PACKAGING" ? "Tilaus siirretty Valmiit-sarakkeeseen ja palautusajo aktivoitu kuljettajille." : "Tilaus on nyt käsittelyssä.",
    });
    fetchData();
  };




  const saveNote = async () => {
    if (!noteOrder || !laundryId || !user) return;
    if (!noteText.trim() && !noteFile) {
      toast({ title: "Lisää huomio tai kuva", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const urls: string[] = [];
      if (noteFile) {
        const path = `${laundryId}/${noteOrder.id}/${Date.now()}-${noteFile.name}`;
        const { error: upErr } = await supabase.storage.from("laundry-uploads").upload(path, noteFile);
        if (upErr) throw upErr;
        urls.push(path);
      }
      const { error } = await supabase.from("laundry_order_notes").insert({
        order_id: noteOrder.id,
        laundry_id: laundryId,
        created_by: user.id,
        note: noteText.trim() || null,
        image_urls: urls,
      });
      if (error) throw error;
      toast({ title: "Huomio tallennettu" });
      setNoteOrder(null);
      setNoteText("");
      setNoteFile(null);
    } catch (e) {
      toast({ title: "Tallennus epäonnistui", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const laundryTotal = (o: LaundryOrder) => {
    // 1. Jos order_items löytyy, lasketaan tuotekohtaisesti
    if (o.order_items && o.order_items.length > 0) {
      return o.order_items.reduce((sum, it) => {
        if (it.laundry_price != null && Number(it.laundry_price) > 0) {
          return sum + Number(it.laundry_price);
        }
        // Etsitään pesulan oma hinta product_laundry_prices -listasta
        const itName = (it.product_name || it.service_name || o.service_name || "").toLowerCase().trim();
        const itType = ((it as any).service_type || "").toLowerCase().trim();

        const own = prices.find((p) => {
          const pid = (p.product_id || "").toLowerCase().trim();
          const pname = (p.name || "").toLowerCase().trim();
          return (
            pid === itType ||
            pid === itName ||
            pname === itName ||
            (itName && pname && (itName.includes(pname) || pname.includes(itName)))
          );
        });

        if (own?.price != null && Number(own.price) > 0) {
          return sum + Number(own.price) * (it.quantity || 1);
        }
        return sum + (Number(it.total_price || 0) * 0.7);
      }, 0);
    }

    // 2. Jos order_items on tyhjä, etsitään tilauksen pääpalvelun (service_name) perusteella
    const servName = (o.service_name || "").toLowerCase().trim();
    const own = prices.find((p) => {
      const pid = (p.product_id || "").toLowerCase().trim();
      const pname = (p.name || "").toLowerCase().trim();
      return (
        pid === servName ||
        pname === servName ||
        (servName && pname && (servName.includes(pname) || pname.includes(servName)))
      );
    });
    if (own?.price != null && Number(own.price) > 0) {
      return Number(own.price);
    }
    return 0;
  };

  const pendingPayout = useMemo(
    () => settlements.filter((s) => s.status !== "paid").reduce((a, s) => a + Number(s.net_amount || 0), 0),
    [settlements],
  );

  // Tilaukset, jotka on toimitettu mutta joita ei ole vielä sisällytetty mihinkään tilityserään
  const settledOrderIds = useMemo(() => {
    const set = new Set<string>();
    settlements.forEach((s) => (s.order_ids || []).forEach((id) => set.add(id)));
    return set;
  }, [settlements]);

  const upcomingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (o.status === "delivered" || (o.tracking_status || "").toUpperCase() === "COMPLETED") &&
          !settledOrderIds.has(o.id),
      ),
    [orders, settledOrderIds],
  );

  const upcomingPayout = useMemo(
    () => upcomingOrders.reduce((sum, o) => sum + laundryTotal(o), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcomingOrders, prices],
  );

  const paidTotal = useMemo(
    () => settlements.filter((s) => s.status === "paid").reduce((a, s) => a + Number(s.net_amount || 0), 0),
    [settlements],
  );

  const paidThisMonth = useMemo(() => {
    const now = new Date();
    return settlements
      .filter((s) => {
        if (s.status !== "paid" || !s.paid_at) return false;
        const d = new Date(s.paid_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((a, s) => a + Number(s.net_amount || 0), 0);
  }, [settlements]);

  const downloadCsv = (s: Settlement) => {
    const rows = [
      ["Tilityserä", s.id],
      ["Jakso", `${s.period_start || ""} - ${s.period_end || ""}`],
      ["Tilauksia", String(s.orders_count)],
      ["Brutto", String(s.gross_amount)],
      ["Komissio", String(s.platform_commission)],
      ["Netto", String(s.net_amount)],
      ["Tila", s.status],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tilitys-${s.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openContractFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("laundry-uploads").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Tiedostoa ei voitu avata", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const filteredHistory = history.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      orderRef(o).toLowerCase().includes(q) ||
      o.service_name.toLowerCase().includes(q) ||
      new Date(o.created_at).toLocaleDateString("fi-FI").includes(q)
    );
  });

  const OrderCard = ({
    order,
    action,
    actionLabel,
    actionIcon,
    actionDisabled,
    extra,
  }: {
    order: LaundryOrder;
    action?: () => void;
    actionLabel?: string;
    actionIcon?: React.ReactNode;
    actionDisabled?: boolean;
    extra?: React.ReactNode;
  }) => {
    const totalEarnings = laundryTotal(order);

    return (
      <Card className="border-2 shadow-xs hover:border-primary/40 transition-all">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-foreground">#{orderRef(order)}</div>
              <p className="text-xs text-muted-foreground font-medium">{order.service_name}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {eur(totalEarnings)}
              </div>
            </div>
          </div>

          {/* Saapumisaika ja Arvioitu paluun noutoaika */}
          <div className="bg-muted/40 p-2.5 rounded-lg space-y-1.5 text-xs border border-border/40">
            <div className="flex items-center justify-between text-muted-foreground gap-1">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                Saapumisaika pesulalle:
              </span>
              <span className="font-semibold text-foreground">
                {fmtDateTime(order.pickup_date, order.pickup_time)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground gap-1 border-t border-border/40 pt-1.5">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Arvioitu noutoaika (paluu):
              </span>
              <span className="font-semibold text-foreground">
                {fmtDateTime(order.return_date, order.return_time)}
              </span>
            </div>
          </div>

          {/* Tuotteet */}
          <div className="flex flex-wrap gap-1.5">
            {order.order_items && order.order_items.length > 0 ? (
              order.order_items.map((it) => (
                <Badge key={it.id} variant="secondary" className="max-w-full truncate py-1 text-xs">
                  {(it.product_name || it.service_name || order.service_name)} × {it.quantity}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary" className="py-1 text-xs">
                {order.service_name} × 1
              </Badge>
            )}
          </div>

          {order.special_instructions && (
            <p className="break-words rounded-lg bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 p-2.5 text-xs">
              <strong>Ohje:</strong> {order.special_instructions}
            </p>
          )}

          {extra}

          {action && (
            <Button
              size="lg"
              className="h-11 w-full text-sm font-semibold shadow-xs"
              onClick={action}
              disabled={actionDisabled}
            >
              {actionIcon}
              <span className="truncate">{actionLabel}</span>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const Column = ({
    title,
    icon,
    items,
    action,
    actionLabel,
    actionIcon,
    renderCard,
  }: {
    title: string;
    icon: React.ReactNode;
    items: LaundryOrder[];
    action?: (o: LaundryOrder) => void;
    actionLabel?: string;
    actionIcon?: React.ReactNode;
    renderCard?: (o: LaundryOrder) => React.ReactNode;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ei tilauksia
        </div>
      ) : renderCard ? (
        items.map((o) => <div key={o.id}>{renderCard(o)}</div>)
      ) : (
        items.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            action={action ? () => action(o) : undefined}
            actionLabel={actionLabel}
            actionIcon={actionIcon}
          />
        ))
      )}
    </div>
  );

  if (loading && !orders.length && !laundryId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!laundryId) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <WashingMachine className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Pesulaa ei ole liitetty tunnukseesi</h2>
            <p className="text-muted-foreground">Ota yhteys ylläpitoon pesulan liittämiseksi.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
      {laundries.length > 1 && (
        <div className="mb-4 max-w-xs">
          <Select value={laundryId} onValueChange={setLaundryId}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {laundries.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="queue">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="queue" className="h-12 text-base">Työjono</TabsTrigger>
          <TabsTrigger value="money" className="h-12 text-base">Rahaliikenne</TabsTrigger>
          <TabsTrigger value="history" className="h-12 text-base">Tilaushistoria</TabsTrigger>
          <TabsTrigger value="contracts" className="h-12 text-base">Sopimukset</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <Column
              title="Hyväksyttävänä"
              icon={<Inbox className="h-5 w-5 text-primary" />}
              items={awaiting}
              action={(o) => decide(o, "accepted")}
              actionLabel="Hyväksy tilaus"
              actionIcon={<CheckCircle2 className="mr-2 h-5 w-5" />}
            />
            <Column
              title="Saapuvat"
              icon={<Truck className="h-5 w-5 text-primary" />}
              items={incoming}
              action={(o) => setStatus(o, "WASHING")}
              actionLabel="Vastaanota pesulaan"
              actionIcon={<WashingMachine className="mr-2 h-5 w-5" />}
              renderCard={(o) => (
                <OrderCard
                  order={o}
                  action={() => setStatus(o, "WASHING")}
                  actionLabel="Vastaanota pesulaan"
                  actionIcon={<WashingMachine className="mr-2 h-5 w-5" />}
                  extra={
                    <p className="rounded-lg bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-500/20 p-2.5 text-xs">
                      🚚 Kuljettaja noutamassa asiakkaalta – siirtyy automaattisesti käsittelyyn, kun nouto on toimitettu pesulalle.
                    </p>
                  }
                />
              )}
            />
            <Column
              title="Käsittelyssä"
              icon={<WashingMachine className="h-5 w-5 text-primary" />}
              items={inProgress}
              action={(o) => setStatus(o, "PACKAGING")}
              actionLabel="Merkitse valmiiksi"
              actionIcon={<PackageCheck className="mr-2 h-5 w-5" />}
            />
            <Column
              title="Valmiit"
              icon={<PackageCheck className="h-5 w-5 text-primary" />}
              items={ready}
              renderCard={(o) => (
                <OrderCard
                  order={o}
                  extra={
                    <p className="rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20 p-2.5 text-xs">
                      ✅ Pyykit valmiina – palautusajo on aktivoitu kuljettajille.
                    </p>
                  }
                />
              )}
            />
          </div>
        </TabsContent>

        <TabsContent value="money" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tulossa tilitykseen</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tilaus</TableHead>
                    <TableHead>Toimitettu</TableHead>
                    <TableHead className="text-right">Osuutesi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Ei tilitettävää tällä hetkellä
                      </TableCell>
                    </TableRow>
                  )}
                  {upcomingOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{orderRef(o)}</TableCell>
                      <TableCell>{new Date(o.updated_at || o.created_at).toLocaleDateString("fi-FI")}</TableCell>
                      <TableCell className="text-right font-semibold">{eur(laundryTotal(o))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-3 text-base font-semibold">Tilityserät</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jakso</TableHead>
                    <TableHead>Tilauksia</TableHead>
                    <TableHead>Netto</TableHead>
                    <TableHead>Tila</TableHead>
                    <TableHead className="text-right">Erittely</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Ei tilityseriä
                      </TableCell>
                    </TableRow>
                  )}
                  {settlements.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.period_start || "-"} – {s.period_end || "-"}</TableCell>
                      <TableCell>{s.orders_count}</TableCell>
                      <TableCell className="font-semibold">{eur(Number(s.net_amount))}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "paid" ? "default" : "secondary"}>
                          {s.status === "paid" ? "Maksettu" : "Odottaa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => downloadCsv(s)}>
                          <Download className="mr-2 h-4 w-4" />
                          Lataa erittely
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 pl-9"
              placeholder="Hae tilausnumerolla tai päivämäärällä"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            {filteredHistory.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                Ei valmistuneita tilauksia
              </div>
            )}
            {filteredHistory.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">#{orderRef(o)}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("fi-FI")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {o.order_items.map((it) => (
                      <Badge key={it.id} variant="secondary">
                        {(it.product_name || it.service_name)} × {it.quantity}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm font-semibold">{eur(laundryTotal(o))}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4 space-y-4">
          {contracts.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Ei sopimuksia
            </div>
          )}
          {contracts.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {c.title}
                  </span>
                  <Badge variant={c.status === "active" ? "default" : "secondary"}>
                    {c.status === "active" ? "Voimassa" : c.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  Voimassa {c.valid_from || "-"} – {c.valid_until || "toistaiseksi"}
                </div>
                {c.payment_terms && <div>Maksuehto: {c.payment_terms}</div>}
                {c.notes && <p className="text-muted-foreground">{c.notes}</p>}
                {c.file_url && (
                  <Button variant="outline" size="sm" onClick={() => openContractFile(c.file_url!)}>
                    <Download className="mr-2 h-4 w-4" />
                    Lataa sopimus
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sovitut tuotehinnat</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tuote</TableHead>
                    <TableHead className="text-right">Hinta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        Ei hinnastoa
                      </TableCell>
                    </TableRow>
                  )}
                  {prices.map((p) => (
                    <TableRow key={p.product_id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right font-semibold">{eur(Number(p.price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!noteOrder} onOpenChange={(o) => !o && setNoteOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Poikkeamahuomio {noteOrder ? `#${orderRef(noteOrder)}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Esim. tahra ei lähtenyt, tuote vaurioitunut"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              className="h-12"
              onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOrder(null)}>Peruuta</Button>
            <Button onClick={saveNote} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tallenna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
