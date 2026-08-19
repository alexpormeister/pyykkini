import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Car, CheckCircle2, Download, Euro, FileText, Loader2, Receipt, Search, Wallet } from "lucide-react";

type PeriodKey = "this_month" | "last_month" | "custom" | "all";

interface OrderItemRow {
  id: string;
  order_id: string;
  product_name: string | null;
  service_name: string;
  quantity: number;
  total_price: number;
  laundry_id: string | null;
  laundry_price: number | null;
  platform_fee: number | null;
  driver_payout: number | null;
}

interface OrderRow {
  id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  final_price: number;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
}

interface SettlementRow {
  id: string;
  payee_type: string;
  payee_id: string | null;
  payee_name: string;
  orders_count: number;
  gross_amount: number;
  platform_commission: number;
  net_amount: number;
  order_ids: string[];
  paid_at: string | null;
  paid_by_name: string | null;
  status: string;
}

interface DriverTaskRow {
  id: string;
  order_id: string;
  driver_id: string;
  task_type: string;
  driver_payout: number | null;
  completed_at: string | null;
}

interface Group {
  key: string;
  name: string;
  ordersCount: number;
  gross: number;
  commission: number;
  net: number;
  orderIds: string[];
}

const eur = (v: number) =>
  new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number.isFinite(v) ? v : 0);

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

function getPeriodRange(period: PeriodKey, from: string, to: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (period === "this_month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (period === "last_month") {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  if (period === "custom") {
    return {
      start: from ? new Date(`${from}T00:00:00`) : null,
      end: to ? new Date(`${to}T23:59:59`) : null,
    };
  }
  return { start: null, end: null };
}

export const SettlementManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [laundries, setLaundries] = useState<Record<string, string>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [driverTasks, setDriverTasks] = useState<DriverTaskRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [detail, setDetail] = useState<{ title: string; type: "laundry" | "driver"; group: Group } | null>(null);

  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, laundriesRes, profilesRes, settlementsRes, tasksRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, driver_id, laundry_id, status, final_price, created_at, first_name, last_name")
          .eq("status", "delivered")
          .order("created_at", { ascending: false }),
        supabase.from("laundries").select("id, name"),
        supabase.from("profiles").select("user_id, first_name, last_name, email"),
        supabase.from("settlements").select("*").order("paid_at", { ascending: false }),
        supabase
          .from("delivery_tasks")
          .select("id, order_id, driver_id, task_type, driver_payout, completed_at")
          .eq("status", "completed")
          .not("driver_id", "is", null),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      const orderRows = (ordersRes.data || []) as OrderRow[];
      setOrders(orderRows);

      if (orderRows.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("id, order_id, product_name, service_name, quantity, total_price, laundry_id, laundry_price, platform_fee, driver_payout")
          .in("order_id", orderRows.map((o) => o.id));
        if (itemError) throw itemError;
        setItems((itemData || []) as OrderItemRow[]);
      } else {
        setItems([]);
      }

      setLaundries(Object.fromEntries((laundriesRes.data || []).map((l: any) => [l.id, l.name])));
      setDrivers(
        Object.fromEntries(
          (profilesRes.data || []).map((p: any) => [
            p.user_id,
            [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Kuljettaja",
          ])
        )
      );
      setSettlements((settlementsRes.data || []) as SettlementRow[]);
      setDriverTasks((tasksRes.data || []) as DriverTaskRow[]);
    } catch (error: any) {
      toast({ title: "Virhe", description: error.message || "Tietojen lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settledOrderIds = useMemo(() => {
    const laundrySet = new Set<string>();
    const driverSet = new Set<string>();
    settlements.forEach((s) => {
      (s.order_ids || []).forEach((id) =>
        s.payee_type === "laundry" ? laundrySet.add(id) : driverSet.add(`${s.payee_id || "unknown"}|${id}`)
      );
    });
    return { laundry: laundrySet, driver: driverSet };
  }, [settlements]);

  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = new Date(o.created_at);
      if (range.start && d < range.start) return false;
      if (range.end && d > range.end) return false;
      return true;
    });
  }, [orders, range]);

  const itemsByOrder = useMemo(() => {
    const map: Record<string, OrderItemRow[]> = {};
    items.forEach((it) => {
      (map[it.order_id] ||= []).push(it);
    });
    return map;
  }, [items]);

  const laundryGroups = useMemo<Group[]>(() => {
    const map: Record<string, Group> = {};
    periodOrders.forEach((order) => {
      if (settledOrderIds.laundry.has(order.id)) return;
      const orderItems = itemsByOrder[order.id] || [];
      orderItems.forEach((it) => {
        const key = it.laundry_id || order.laundry_id || "unassigned";
        const name = laundries[key] || "Ei pesulaa määritetty";
        const g = (map[key] ||= { key, name, ordersCount: 0, gross: 0, commission: 0, net: 0, orderIds: [] });
        g.gross += Number(it.total_price || 0);
        g.commission += Number(it.platform_fee || 0);
        g.net += Number(it.laundry_price || 0);
        if (!g.orderIds.includes(order.id)) {
          g.orderIds.push(order.id);
          g.ordersCount += 1;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.net - a.net);
  }, [periodOrders, itemsByOrder, laundries, settledOrderIds]);

  // Kuljettajan palkkiot lasketaan suoritetuista keikoista (nouto ja palautus erikseen)
  const periodDriverTasks = useMemo(() => {
    return driverTasks.filter((t) => {
      if (settledOrderIds.driver.has(`${t.driver_id}|${t.order_id}`)) return false;
      const stamp = t.completed_at ? new Date(t.completed_at) : null;
      if (!stamp) return true;
      if (range.start && stamp < range.start) return false;
      if (range.end && stamp > range.end) return false;
      return true;
    });
  }, [driverTasks, range, settledOrderIds]);

  // driver -> order -> palkkio
  const driverOrderPayouts = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    periodDriverTasks.forEach((t) => {
      const byOrder = (map[t.driver_id] ||= {});
      byOrder[t.order_id] = (byOrder[t.order_id] || 0) + Number(t.driver_payout || 0);
    });
    return map;
  }, [periodDriverTasks]);

  const driverGroups = useMemo<Group[]>(() => {
    return Object.entries(driverOrderPayouts)
      .map(([key, byOrder]) => {
        const orderIds = Object.keys(byOrder);
        const net = orderIds.reduce((s, id) => s + byOrder[id], 0);
        const gross = orderIds.reduce((s, id) => {
          const order = orders.find((o) => o.id === id);
          return s + Number(order?.final_price || 0);
        }, 0);
        return {
          key,
          name: drivers[key] || "Kuljettaja",
          ordersCount: orderIds.length,
          gross,
          commission: 0,
          net,
          orderIds,
        } as Group;
      })
      .sort((a, b) => b.net - a.net);
  }, [driverOrderPayouts, drivers, orders]);

  const platformRevenue = useMemo(() => {
    return periodOrders.reduce((sum, order) => {
      const orderItems = itemsByOrder[order.id] || [];
      return sum + orderItems.reduce((s, it) => s + Number(it.platform_fee || 0), 0);
    }, 0);
  }, [periodOrders, itemsByOrder]);

  const totalLaundryPending = laundryGroups.reduce((s, g) => s + g.net, 0);
  const totalDriverPending = driverGroups.reduce((s, g) => s + g.net, 0);

  const filterByName = <T extends { name: string }>(rows: T[]) =>
    rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  const markPaid = async (type: "laundry" | "driver", group: Group) => {
    setSaving(`${type}-${group.key}`);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const admin = userData?.user;
      const { error } = await supabase.from("settlements").insert({
        payee_type: type,
        payee_id: group.key === "unassigned" ? null : group.key,
        payee_name: group.name,
        orders_count: group.ordersCount,
        gross_amount: Number(group.gross.toFixed(2)),
        platform_commission: Number(group.commission.toFixed(2)),
        net_amount: Number(group.net.toFixed(2)),
        order_ids: group.orderIds,
        period_start: range.start ? range.start.toISOString().slice(0, 10) : null,
        period_end: range.end ? range.end.toISOString().slice(0, 10) : null,
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: admin?.id ?? null,
        paid_by_name: admin?.email ?? null,
      });
      if (error) throw error;
      toast({ title: "Merkitty maksetuksi", description: `${group.name}: ${eur(group.net)}` });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Virhe", description: error.message || "Tallennus epäonnistui", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const detailRows = useMemo(() => {
    if (!detail) return [];
    return detail.group.orderIds.map((orderId) => {
      const order = orders.find((o) => o.id === orderId);
      const orderItems = (itemsByOrder[orderId] || []).filter(
        (it) => detail.type === "driver" || (it.laundry_id || order?.laundry_id || "unassigned") === detail.group.key
      );
      return { order, orderItems };
    });
  }, [detail, orders, itemsByOrder]);

  const downloadCsv = (type: "laundry" | "driver", group: Group) => {
    const header =
      type === "laundry"
        ? ["Tilaus", "Päivämäärä", "Tuote", "Määrä", "Asiakasmyynti", "Alustan komissio", "Pesulan osuus"]
        : ["Tilaus", "Päivämäärä", "Asiakas", "Tilauksen summa", "Kuljettajan palkkio"];
    const lines: string[][] = [header];
    group.orderIds.forEach((orderId) => {
      const order = orders.find((o) => o.id === orderId);
      const orderItems = itemsByOrder[orderId] || [];
      if (type === "laundry") {
        orderItems
          .filter((it) => (it.laundry_id || order?.laundry_id || "unassigned") === group.key)
          .forEach((it) => {
            lines.push([
              orderId.slice(0, 8),
              fmtDate(order?.created_at ?? null),
              it.product_name || it.service_name,
              String(it.quantity),
              String(Number(it.total_price || 0).toFixed(2)),
              String(Number(it.platform_fee || 0).toFixed(2)),
              String(Number(it.laundry_price || 0).toFixed(2)),
            ]);
          });
      } else {
        const payout = orderItems.reduce((s, it) => s + Number(it.driver_payout || 0), 0);
        lines.push([
          orderId.slice(0, 8),
          fmtDate(order?.created_at ?? null),
          [order?.first_name, order?.last_name].filter(Boolean).join(" "),
          String(Number(order?.final_price || 0).toFixed(2)),
          String(payout.toFixed(2)),
        ]);
      }
    });
    const csv = lines.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tilitys-${group.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV ladattu", description: group.name });
  };

  const downloadPdf = (type: "laundry" | "driver", group: Group) => {
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast({ title: "Ponnahdusikkuna estetty", description: "Salli ponnahdusikkunat ladataksesi PDF:n", variant: "destructive" });
      return;
    }
    const rows = group.orderIds
      .map((orderId) => {
        const order = orders.find((o) => o.id === orderId);
        const orderItems = itemsByOrder[orderId] || [];
        const payout = orderItems.reduce((s, it) => s + Number(it.driver_payout || 0), 0);
        const value =
          type === "laundry"
            ? orderItems
                .filter((it) => (it.laundry_id || order?.laundry_id || "unassigned") === group.key)
                .reduce((s, it) => s + Number(it.laundry_price || 0), 0)
            : payout;
        return `<tr><td>#${orderId.slice(0, 8)}</td><td>${fmtDate(order?.created_at ?? null)}</td><td style="text-align:right">${eur(value)}</td></tr>`;
      })
      .join("");
    win.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>Tilityserittely – ${group.name}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}tfoot td{font-weight:700}</style>
      </head><body><h1>Tilityserittely – ${group.name}</h1>
      <p>${type === "laundry" ? "Pesulan tilitys" : "Kuljettajan palkkio"} · Tilauksia: ${group.ordersCount}</p>
      <table><thead><tr><th>Tilaus</th><th>Päivämäärä</th><th style="text-align:right">Summa</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Tilitettävä yhteensä</td><td style="text-align:right">${eur(group.net)}</td></tr></tfoot></table>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  };

  const summaryCards = [
    {
      label: "Pesuloille tilitettävänä",
      value: totalLaundryPending,
      icon: Building2,
      hint: `${laundryGroups.length} pesulaa odottaa maksua`,
    },
    {
      label: "Kuljettajille tilitettävänä",
      value: totalDriverPending,
      icon: Car,
      hint: `${driverGroups.length} kuljettajaa odottaa maksua`,
    },
    {
      label: "Alustan tuotot",
      value: platformRevenue,
      icon: Wallet,
      hint: `${periodOrders.length} valmista tilausta jaksolla`,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Maksuliikenne
          </h2>
          <p className="text-sm text-muted-foreground">Pesuloiden tilitykset, kuljettajien palkkiot ja alustan tuotot</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Aikaväli" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Tämä kuukausi</SelectItem>
              <SelectItem value="last_month">Viime kuukausi</SelectItem>
              <SelectItem value="custom">Oma aikaväli</SelectItem>
              <SelectItem value="all">Kaikki</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <div className="flex gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-bold">{eur(card.value)}</p>
                <p className="text-xs text-muted-foreground truncate">{card.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Etsi pesulaa tai kuljettajaa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="laundries" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="laundries">Pesulat</TabsTrigger>
          <TabsTrigger value="drivers">Kuljettajat</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        <TabsContent value="laundries">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pesuloiden tilitykset</CardTitle>
              <CardDescription>Valmiiden tilausten pesulaosuudet odottavat tilitystä</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pesula</TableHead>
                    <TableHead className="text-right">Tilaukset</TableHead>
                    <TableHead className="text-right">Asiakasmyynti</TableHead>
                    <TableHead className="text-right">Alustan komissio</TableHead>
                    <TableHead className="text-right">Tilitettävä netto</TableHead>
                    <TableHead>Tila</TableHead>
                    <TableHead className="text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterByName(laundryGroups).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Ei tilitettävää valitulla aikavälillä
                      </TableCell>
                    </TableRow>
                  )}
                  {filterByName(laundryGroups).map((g) => (
                    <TableRow key={g.key}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-right">{g.ordersCount}</TableCell>
                      <TableCell className="text-right">{eur(g.gross)}</TableCell>
                      <TableCell className="text-right">{eur(g.commission)}</TableCell>
                      <TableCell className="text-right font-semibold">{eur(g.net)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Odottaa tilitystä</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" onClick={() => markPaid("laundry", g)} disabled={saving === `laundry-${g.key}`}>
                            {saving === `laundry-${g.key}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span className="ml-1">Merkitse maksetuksi</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDetail({ title: g.name, type: "laundry", group: g })}>
                            Näytä erittely
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadCsv("laundry", g)}>
                            <Download className="h-4 w-4 mr-1" /> CSV
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf("laundry", g)}>
                            <FileText className="h-4 w-4 mr-1" /> PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kuljettajien palkkiot</CardTitle>
              <CardDescription>Suoritetuista keikoista maksettavat palkkiot</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kuljettaja</TableHead>
                    <TableHead className="text-right">Suoritetut keikat</TableHead>
                    <TableHead className="text-right">Maksettava palkkio</TableHead>
                    <TableHead>Tila</TableHead>
                    <TableHead className="text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterByName(driverGroups).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        Ei maksettavia palkkioita valitulla aikavälillä
                      </TableCell>
                    </TableRow>
                  )}
                  {filterByName(driverGroups).map((g) => (
                    <TableRow key={g.key}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-right">{g.ordersCount}</TableCell>
                      <TableCell className="text-right font-semibold">{eur(g.net)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Odottaa maksua</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" onClick={() => markPaid("driver", g)} disabled={saving === `driver-${g.key}`}>
                            {saving === `driver-${g.key}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span className="ml-1">Merkitse maksetuksi</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDetail({ title: g.name, type: "driver", group: g })}>
                            Näytä keikkaerittely
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadCsv("driver", g)}>
                            <Download className="h-4 w-4 mr-1" /> CSV
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tilityshistoria</CardTitle>
              <CardDescription>Kaikki maksetuksi merkityt tilityserät</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Päivämäärä</TableHead>
                    <TableHead>Saaja</TableHead>
                    <TableHead>Tyyppi</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Kuittaaja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        Ei tilityshistoriaa
                      </TableCell>
                    </TableRow>
                  )}
                  {settlements
                    .filter((s) => s.payee_name.toLowerCase().includes(search.trim().toLowerCase()))
                    .map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{fmtDate(s.paid_at)}</TableCell>
                        <TableCell className="font-medium">{s.payee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.payee_type === "laundry" ? "Pesula" : "Kuski"}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{eur(Number(s.net_amount))}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.paid_by_name || "-"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.title}</SheetTitle>
            <SheetDescription>
              {detail?.type === "laundry" ? "Pesulan tilityserittely" : "Kuljettajan keikkaerittely"} ·{" "}
              {detail ? eur(detail.group.net) : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {detailRows.map(({ order, orderItems }) => (
              <div key={order?.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">#{order?.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{fmtDate(order?.created_at ?? null)}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {orderItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {it.product_name || it.service_name} × {it.quantity}
                      </span>
                      <span className="font-medium flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        {detail?.type === "laundry"
                          ? Number(it.laundry_price || 0).toFixed(2)
                          : Number(it.driver_payout || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {orderItems.length === 0 && <p className="text-xs text-muted-foreground">Ei tuoterivejä</p>}
                </div>
              </div>
            ))}
            {detailRows.length === 0 && <p className="text-sm text-muted-foreground">Ei tilauksia</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
