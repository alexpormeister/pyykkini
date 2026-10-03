import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Building2,
  Car,
  CheckCircle2,
  Download,
  Euro,
  FileText,
  Loader2,
  Receipt,
  Search,
  Wallet,
  Filter,
  Briefcase,
  Clock,
  X,
  Truck,
  TrendingUp,
} from "lucide-react";

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
  tracking_status?: string | null;
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
  origin_name?: string | null;
  destination_name?: string | null;
  origin_address?: string | null;
  destination_address?: string | null;
  pickup_weight_kg?: number | string | null;
}

interface Group {
  key: string;
  name: string;
  ordersCount: number;
  tasksCount?: number;
  gross: number;
  commission: number;
  net: number;
  orderIds: string[];
  tasks?: DriverTaskRow[];
}

const eur = (v: number) =>
  new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number.isFinite(v) ? v : 0);

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

const fmtDateTime = (v: string | null) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    return d.toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
};

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
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Common Search & Filters
  const [search, setSearch] = useState("");

  // Overview / Search Tab specific filters
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchStatus, setSearchStatus] = useState<"all" | "pending" | "paid">("all");
  const [searchPayeeType, setSearchPayeeType] = useState<"all" | "laundry" | "driver" | "platform">("all");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [laundries, setLaundries] = useState<Record<string, string>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [driverTasks, setDriverTasks] = useState<DriverTaskRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [detail, setDetail] = useState<{ title: string; type: "laundry" | "driver"; group: Group } | null>(null);

  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, laundriesRes, profilesRes, settlementsRes, tasksRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, driver_id, laundry_id, status, tracking_status, final_price, created_at, first_name, last_name")
          .not("status", "in", '("cancelled","rejected")')
          .order("created_at", { ascending: false }),
        supabase.from("laundries").select("id, name"),
        supabase.from("profiles").select("user_id, first_name, last_name, email"),
        supabase.from("settlements").select("*").order("paid_at", { ascending: false }),
        supabase
          .from("delivery_tasks")
          .select("id, order_id, driver_id, task_type, driver_payout, status, completed_at, origin_name, destination_name, origin_address, destination_address, pickup_weight_kg")
          .eq("status", "completed")
          .not("driver_id", "is", null)
          .order("completed_at", { ascending: false }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      const orderRows = (ordersRes.data || []) as OrderRow[];
      setOrders(orderRows);

      if (orderRows.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("id, order_id, product_name, service_name, quantity, total_price, laundry_id, laundry_price, platform_fee, driver_payout")
          .in("order_id", orderRows.map((o) => o.id));
        if (!itemError) {
          setItems((itemData || []) as OrderItemRow[]);
        }
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
      console.error("Error loading settlement data:", error);
      toast({ title: "Virhe", description: error.message || "Tietojen lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("settlement_management_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

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
      const key = order.laundry_id || "unassigned";
      const name = laundries[key] || (key === "unassigned" ? "Ei pesulaa määritetty" : "Pesula");
      const g = (map[key] ||= { key, name, ordersCount: 0, gross: 0, commission: 0, net: 0, orderIds: [] });

      if (orderItems.length > 0) {
        orderItems.forEach((it) => {
          g.gross += Number(it.total_price || 0);
          g.commission += Number(it.platform_fee || 0);
          g.net += Number(it.laundry_price || 0);
        });
      } else {
        const fPrice = Number(order.final_price || 0);
        g.gross += fPrice;
        g.commission += fPrice * 0.3;
        g.net += fPrice * 0.7;
      }

      if (!g.orderIds.includes(order.id)) {
        g.orderIds.push(order.id);
        g.ordersCount += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.net - a.net);
  }, [periodOrders, itemsByOrder, laundries, settledOrderIds]);

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

  const driverGroups = useMemo<Group[]>(() => {
    const map: Record<string, { name: string; tasks: DriverTaskRow[]; orderIds: Set<string>; net: number; gross: number }> = {};

    periodDriverTasks.forEach((t) => {
      if (!t.driver_id) return;
      const dName = drivers[t.driver_id] || "Kuljettaja";
      const entry = (map[t.driver_id] ||= {
        name: dName,
        tasks: [],
        orderIds: new Set<string>(),
        net: 0,
        gross: 0,
      });

      entry.tasks.push(t);
      entry.orderIds.add(t.order_id);
      entry.net += Number(t.driver_payout || 0);

      const ord = orders.find((o) => o.id === t.order_id);
      if (ord) {
        entry.gross += Number(ord.final_price || 0) / 2;
      }
    });

    return Object.entries(map)
      .map(([key, data]) => ({
        key,
        name: data.name,
        ordersCount: data.tasks.length,
        tasksCount: data.tasks.length,
        gross: data.gross,
        commission: 0,
        net: Number(data.net.toFixed(2)),
        orderIds: Array.from(data.orderIds),
        tasks: data.tasks,
      }))
      .sort((a, b) => b.net - a.net);
  }, [periodDriverTasks, drivers, orders]);

  const platformRevenue = useMemo(() => {
    return periodOrders.reduce((sum, order) => {
      const orderItems = itemsByOrder[order.id] || [];
      return sum + orderItems.reduce((s, it) => s + Number(it.platform_fee || 0), 0);
    }, 0);
  }, [periodOrders, itemsByOrder]);

  const totalLaundryPending = laundryGroups.reduce((s, g) => s + g.net, 0);
  const totalDriverPending = driverGroups.reduce((s, g) => s + g.net, 0);

  // Financial Transaction overview for "Etusivu & Haku" and "Alusta"
  const financialTransactions = useMemo(() => {
    return periodOrders.map((order) => {
      const orderItems = itemsByOrder[order.id] || [];
      const gross = Number(order.final_price || 0);
      const lndKey = order.laundry_id || "unassigned";
      const laundryName = laundries[lndKey] || (lndKey === "unassigned" ? "Ei pesulaa" : "Pesula");

      let laundryNet = 0;
      let platformFee = 0;

      if (orderItems.length > 0) {
        orderItems.forEach((it) => {
          laundryNet += Number(it.laundry_price || 0);
          platformFee += Number(it.platform_fee || 0);
        });
      } else {
        laundryNet = gross * 0.7;
        platformFee = gross * 0.3;
      }

      const tasks = driverTasks.filter((t) => t.order_id === order.id);
      const driverNet = tasks.reduce((sum, t) => sum + Number(t.driver_payout || 0), 0);

      const isLaundryPaid = settledOrderIds.laundry.has(order.id);
      const isDriverPaid = tasks.length > 0 && tasks.every((t) => settledOrderIds.driver.has(`${t.driver_id}|${t.order_id}`));

      const customerName = [order.first_name, order.last_name].filter(Boolean).join(" ") || "Asiakas";

      return {
        order,
        orderId: order.id,
        shortId: "#" + order.id.slice(0, 8).toUpperCase(),
        created_at: order.created_at,
        customerName,
        laundryName,
        gross,
        laundryNet,
        isLaundryPaid,
        driverTasks: tasks,
        driverNet,
        isDriverPaid,
        platformFee,
        platformNet: Math.max(0, gross - laundryNet - driverNet),
      };
    });
  }, [periodOrders, itemsByOrder, laundries, driverTasks, settledOrderIds]);

  // Filtered Financial Transactions for Etusivu & Haku tab
  const filteredFinancials = useMemo(() => {
    const qOrder = searchOrderId.toLowerCase().trim().replace("#", "");
    const qText = search.toLowerCase().trim();

    return financialTransactions.filter((tx) => {
      // 1. Tilausnumerohaku
      if (qOrder && !tx.orderId.toLowerCase().includes(qOrder)) {
        return false;
      }

      // 2. Yleinen hakukenttä (Asiakas, Pesula, Kuljettaja)
      if (qText) {
        const driversList = tx.driverTasks
          .map((t) => (drivers[t.driver_id] || "").toLowerCase())
          .join(" ");
        const matchCust = tx.customerName.toLowerCase().includes(qText);
        const matchLnd = tx.laundryName.toLowerCase().includes(qText);
        const matchDrv = driversList.includes(qText);
        const matchId = tx.shortId.toLowerCase().includes(qText);

        if (!matchCust && !matchLnd && !matchDrv && !matchId) {
          return false;
        }
      }

      // 3. Tilityksen tila suodatus
      if (searchStatus === "pending") {
        if (tx.isLaundryPaid && (tx.driverTasks.length === 0 || tx.isDriverPaid)) return false;
      } else if (searchStatus === "paid") {
        if (!tx.isLaundryPaid || (tx.driverTasks.length > 0 && !tx.isDriverPaid)) return false;
      }

      // 4. Saajan tyyppi
      if (searchPayeeType === "laundry") {
        if (tx.laundryNet <= 0) return false;
      } else if (searchPayeeType === "driver") {
        if (tx.driverTasks.length === 0) return false;
      }

      return true;
    });
  }, [financialTransactions, searchOrderId, search, searchStatus, searchPayeeType, drivers]);

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
    if (detail.type === "driver") {
      let tasks = detail.group.tasks || [];
      if (tasks.length === 0 && detail.group.orderIds.length > 0) {
        tasks = driverTasks.filter((t) => detail.group.orderIds.includes(t.order_id));
      }
      if (tasks.length === 0 && detail.group.orderIds.length > 0) {
        return detail.group.orderIds.map((orderId) => {
          const order = orders.find((o) => o.id === orderId);
          return {
            orderId,
            task: {
              id: orderId,
              order_id: orderId,
              driver_id: detail.group.key,
              task_type: "delivery",
              driver_payout: detail.group.net / (detail.group.orderIds.length || 1),
              completed_at: order?.created_at || null,
              origin_name: "Nouto",
              destination_name: "Palautus",
            } as DriverTaskRow,
            order,
            orderItems: [],
            tasks: [],
          };
        });
      }
      return tasks.map((t) => {
        const order = orders.find((o) => o.id === t.order_id);
        return {
          orderId: t.order_id,
          task: t,
          order,
          orderItems: [],
          tasks: [t],
        };
      });
    }

    return detail.group.orderIds.map((orderId) => {
      const order = orders.find((o) => o.id === orderId);
      const orderItems = (itemsByOrder[orderId] || []).filter(
        (it) => (it.laundry_id || order?.laundry_id || "unassigned") === detail.group.key || detail.group.key === "history" || !detail.group.key
      );
      return { orderId, order, orderItems, tasks: [], task: null as any };
    });
  }, [detail, orders, itemsByOrder, driverTasks]);

  const handleShowSettlementDetail = (s: SettlementRow) => {
    const orderIds = Array.isArray(s.order_ids) ? s.order_ids : [];

    if (s.payee_type === "driver") {
      const matchedTasks = driverTasks.filter((t) => {
        if (s.payee_id && t.driver_id === s.payee_id) {
          return orderIds.length === 0 || orderIds.includes(t.order_id);
        }
        return orderIds.includes(t.order_id);
      });

      const grp: Group = {
        key: s.payee_id || s.id,
        name: s.payee_name,
        ordersCount: s.orders_count || (matchedTasks.length > 0 ? matchedTasks.length : orderIds.length),
        tasksCount: matchedTasks.length,
        gross: Number(s.gross_amount || s.net_amount),
        commission: Number(s.platform_commission || 0),
        net: Number(s.net_amount),
        orderIds: orderIds.length > 0 ? orderIds : Array.from(new Set(matchedTasks.map((t) => t.order_id))),
        tasks: matchedTasks,
      };

      setDetail({
        title: `${s.payee_name} – Tilityserittely (${fmtDate(s.paid_at)})`,
        type: "driver",
        group: grp,
      });
    } else {
      const grp: Group = {
        key: s.payee_id || "history",
        name: s.payee_name,
        ordersCount: s.orders_count || orderIds.length,
        gross: Number(s.gross_amount || s.net_amount),
        commission: Number(s.platform_commission || 0),
        net: Number(s.net_amount),
        orderIds: orderIds,
      };

      setDetail({
        title: `${s.payee_name} – Tilityserittely (${fmtDate(s.paid_at)})`,
        type: "laundry",
        group: grp,
      });
    }
  };

  const downloadCsv = (type: "laundry" | "driver", group: Group) => {
    const header =
      type === "laundry"
        ? ["Tilaus", "Päivämäärä", "Tuote", "Määrä", "Asiakasmyynti", "Alustan komissio", "Pesulan osuus"]
        : ["Tilaus", "Tehtävätyyppi", "Lähtöpaikka", "Määränpää", "Suoritettu", "Kuljettajan palkkio"];
    const lines: string[][] = [header];

    if (type === "laundry") {
      group.orderIds.forEach((orderId) => {
        const order = orders.find((o) => o.id === orderId);
        const orderItems = itemsByOrder[orderId] || [];
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
      });
    } else {
      (group.tasks || []).forEach((t) => {
        lines.push([
          t.order_id ? t.order_id.slice(0, 8) : "-",
          t.task_type === "pickup" ? "Noutokeikka (Meno)" : "Palautuskeikka (Paluu)",
          t.origin_name || t.origin_address || "Lähtöpaikka",
          t.destination_name || t.destination_address || "Määränpää",
          fmtDateTime(t.completed_at),
          String(Number(t.driver_payout || 0).toFixed(2)),
        ]);
      });
    }

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

    let rows = "";
    if (type === "laundry") {
      rows = group.orderIds
        .map((orderId) => {
          const order = orders.find((o) => o.id === orderId);
          const orderItems = itemsByOrder[orderId] || [];
          const value = orderItems
            .filter((it) => (it.laundry_id || order?.laundry_id || "unassigned") === group.key)
            .reduce((s, it) => s + Number(it.laundry_price || 0), 0);
          return `<tr><td>#${orderId.slice(0, 8)}</td><td>${fmtDate(order?.created_at ?? null)}</td><td style="text-align:right">${eur(value)}</td></tr>`;
        })
        .join("");
    } else {
      rows = (group.tasks || [])
        .map((t) => {
          const typeLabel = t.task_type === "pickup" ? "Noutokeikka" : "Palautuskeikka";
          return `<tr><td>#${t.order_id ? t.order_id.slice(0, 8) : "-"} (${typeLabel})</td><td>${fmtDateTime(t.completed_at)}</td><td style="text-align:right">${eur(Number(t.driver_payout || 0))}</td></tr>`;
        })
        .join("");
    }

    win.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>Tilityserittely – ${group.name}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}tfoot td{font-weight:700}</style>
      </head><body><h1>Tilityserittely – ${group.name}</h1>
      <p>${type === "laundry" ? "Pesulan tilitys" : "Kuljettajan palkkio"} · ${type === "driver" ? `Suoritetut keikat: ${group.ordersCount}` : `Tilauksia: ${group.ordersCount}`}</p>
      <table><thead><tr><th>${type === "driver" ? "Keikka" : "Tilaus"}</th><th>Päivämäärä</th><th style="text-align:right">Summa</th></tr></thead>
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
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Maksuliikenne
          </h2>
          <p className="text-sm text-muted-foreground">Maksuliikenteen haku, alustan tuotot, pesuloiden tilitykset ja kuljettajien palkkiot</p>
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

      {/* Main Metric Cards */}
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

      {/* Primary Tab Navigation */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
            🏠 Etusivu & Haku
          </TabsTrigger>
          <TabsTrigger value="laundries" className="text-xs sm:text-sm py-2">
            🧺 Pesulat
          </TabsTrigger>
          <TabsTrigger value="drivers" className="text-xs sm:text-sm py-2">
            🚚 Kuljettajat
          </TabsTrigger>
          <TabsTrigger value="platform" className="text-xs sm:text-sm py-2">
            💼 Alusta
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2">
            📜 Historia
          </TabsTrigger>
        </TabsList>

        {/* 1. ETUSIVU & HAKU TAB */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Maksuliikenteen Haku & Yhteenveto
              </CardTitle>
              <CardDescription>
                Hae tilausnumerolla, asiakkaalla, pesulalla tai kuljettajalla nähdäksesi kaikki maksutapahtumat ja tilitystilat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Specialized Search Form */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border">
                {/* 1. Tilausnumero */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3 w-3 text-blue-500" /> Tilausnumero
                  </label>
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="esim. #8B26BDE5"
                    value={searchOrderId}
                    onChange={(e) => setSearchOrderId(e.target.value)}
                  />
                </div>

                {/* 2. Tekstihaku (Asiakas / Pesula / Kuski) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Search className="h-3 w-3 text-purple-500" /> Hakusana / Saaja
                  </label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Asiakas, pesula tai kuski"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* 3. Tilityksen tila */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3 text-emerald-500" /> Tilityksen tila
                  </label>
                  <Select value={searchStatus} onValueChange={(val: any) => setSearchStatus(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Kaikki tilat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Kaikki tilat</SelectItem>
                      <SelectItem value="pending" className="text-xs text-amber-600 font-semibold">🟡 Odottaa tilitystä</SelectItem>
                      <SelectItem value="paid" className="text-xs text-emerald-600 font-semibold">🟢 Tilitetty / Maksettu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Saajan tyyppi */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-indigo-500" /> Kohde / Tyyppi
                  </label>
                  <Select value={searchPayeeType} onValueChange={(val: any) => setSearchPayeeType(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Kaikki kohteet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Kaikki kohteet</SelectItem>
                      <SelectItem value="laundry" className="text-xs">🧺 Pesulat</SelectItem>
                      <SelectItem value="driver" className="text-xs">🚚 Kuljettajat</SelectItem>
                      <SelectItem value="platform" className="text-xs">💼 Alusta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reset Filters button if active */}
              {(searchOrderId || search || searchStatus !== "all" || searchPayeeType !== "all") && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setSearchOrderId("");
                      setSearch("");
                      setSearchStatus("all");
                      setSearchPayeeType("all");
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> Tyhjennä hakuehdot
                  </Button>
                </div>
              )}

              {/* Transactions Table */}
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold">Tilaus</TableHead>
                      <TableHead className="font-bold">Asiakas</TableHead>
                      <TableHead className="font-bold">Pesulan tilitys</TableHead>
                      <TableHead className="font-bold">Kuljettajien tilitys</TableHead>
                      <TableHead className="text-right font-bold">Alustan komissio</TableHead>
                      <TableHead className="text-right font-bold">Koko hinta</TableHead>
                      <TableHead className="text-right font-bold">Toiminnot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinancials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                          Ei hakutuloksia vastaavia maksutapahtumia.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFinancials.map((tx) => (
                        <TableRow key={tx.orderId} className="text-xs hover:bg-muted/40">
                          {/* Tilaus ID & Pvm */}
                          <TableCell className="whitespace-nowrap">
                            <div className="font-mono font-bold text-foreground">{tx.shortId}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtDate(tx.created_at)}</div>
                          </TableCell>

                          {/* Asiakas */}
                          <TableCell className="font-medium whitespace-nowrap">
                            {tx.customerName}
                          </TableCell>

                          {/* Pesula & Tila */}
                          <TableCell className="whitespace-nowrap">
                            <div className="font-semibold text-foreground">{tx.laundryName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-bold text-emerald-700">{eur(tx.laundryNet)}</span>
                              {tx.isLaundryPaid ? (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                                  ✓ Maksettu
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">
                                  Odottaa
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Kuljettajat & Palkkiot */}
                          <TableCell className="whitespace-nowrap">
                            {tx.driverTasks.length > 0 ? (
                              <div className="space-y-1">
                                <div className="font-semibold text-foreground">{eur(tx.driverNet)}</div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <span>{tx.driverTasks.length} keikkaa</span>
                                  {tx.isDriverPaid ? (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                                      ✓ Maksettu
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">
                                      Odottaa
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Ei keikkoja</span>
                            )}
                          </TableCell>

                          {/* Alustan tuotto */}
                          <TableCell className="text-right font-semibold whitespace-nowrap text-blue-700 dark:text-blue-400">
                            {eur(tx.platformFee)}
                          </TableCell>

                          {/* Koko summa */}
                          <TableCell className="text-right font-bold whitespace-nowrap text-foreground">
                            {eur(tx.gross)}
                          </TableCell>

                          {/* Toiminnot */}
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                const laundryGrp: Group = {
                                  key: tx.order.laundry_id || "unassigned",
                                  name: tx.laundryName,
                                  ordersCount: 1,
                                  gross: tx.gross,
                                  commission: tx.platformFee,
                                  net: tx.laundryNet,
                                  orderIds: [tx.orderId],
                                };
                                setDetail({
                                  title: `Tilaus ${tx.shortId} – Maksutiedot`,
                                  type: "laundry",
                                  group: laundryGrp,
                                });
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1 text-primary" /> Erittely
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. PESULAT TAB */}
        <TabsContent value="laundries">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Pesuloiden tilitykset
              </CardTitle>
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

        {/* 3. KULJETTAJAT TAB */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Kuljettajien palkkiot
              </CardTitle>
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

        {/* 4. ALUSTA TAB */}
        <TabsContent value="platform">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Alustan Tuotot & Komissiot
              </CardTitle>
              <CardDescription>
                Yhteenveto alustan keräämistä komissioista, palvelumaksuista ja nettotuotoista.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <span className="text-xs text-muted-foreground">Kokonaismyynti (Brutto)</span>
                  <p className="text-lg font-bold text-foreground">
                    {eur(periodOrders.reduce((sum, o) => sum + Number(o.final_price || 0), 0))}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold">Alustan komissiot yhteensä</span>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{eur(platformRevenue)}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Valmiita tilauksia jaksolla</span>
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{periodOrders.length} kpl</p>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="text-xs">
                      <TableHead className="font-bold">Tilaus</TableHead>
                      <TableHead className="font-bold">Asiakas</TableHead>
                      <TableHead className="text-right font-bold">Koko hinta</TableHead>
                      <TableHead className="text-right font-bold">Pesulan osuus</TableHead>
                      <TableHead className="text-right font-bold">Kuljettajien palkkiot</TableHead>
                      <TableHead className="text-right font-bold">Alustan kate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                          Ei alustan tuottoja valitulla aikavälillä.
                        </TableCell>
                      </TableRow>
                    ) : (
                      financialTransactions.map((tx) => (
                        <TableRow key={tx.orderId} className="text-xs hover:bg-muted/40">
                          <TableCell className="font-mono font-bold whitespace-nowrap">
                            {tx.shortId}
                            <span className="block text-[10px] font-normal text-muted-foreground">{fmtDate(tx.created_at)}</span>
                          </TableCell>
                          <TableCell className="font-medium">{tx.customerName}</TableCell>
                          <TableCell className="text-right font-semibold">{eur(tx.gross)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{eur(tx.laundryNet)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{eur(tx.driverNet)}</TableCell>
                          <TableCell className="text-right font-bold text-blue-700 dark:text-blue-400">
                            {eur(tx.platformFee)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. HISTORIA TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Tilityshistoria
              </CardTitle>
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
                    <TableHead className="text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShowSettlementDetail(s)}
                              className="h-8 text-xs font-medium"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1 text-primary" />
                              Näytä erittely
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
      </Tabs>

      {/* Detail Sheet Modal */}
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
            {detail?.type === "driver" ? (
              detailRows.map(({ task }) => (
                <div key={task.id} className="rounded-xl border bg-card p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={task.task_type === "pickup" ? "default" : "secondary"} className="text-xs font-semibold">
                        {task.task_type === "pickup" ? "🚚 Noutokeikka" : "🔄 Palautuskeikka"}
                      </Badge>
                      <span className="font-semibold text-sm">#{task.order_id ? task.order_id.slice(0, 8).toUpperCase() : "-"}</span>
                    </div>
                    <span className="font-bold text-primary text-base">+{Number(task.driver_payout || 0).toFixed(2)} €</span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Reitti:</span>
                      <span className="font-medium text-foreground">
                        {task.origin_name || "Lähtö"} ➔ {task.destination_name || "Määränpää"}
                      </span>
                    </div>
                    {task.completed_at && (
                      <div className="flex items-center justify-between">
                        <span>Suoritettu:</span>
                        <span className="text-foreground font-medium">{fmtDateTime(task.completed_at)}</span>
                      </div>
                    )}
                    {task.pickup_weight_kg && (
                      <div className="flex items-center justify-between">
                        <span>Pyykin paino:</span>
                        <span className="text-foreground">{task.pickup_weight_kg} kg</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              detailRows.map(({ orderId, order, orderItems }) => (
                <div key={orderId} className="rounded-xl border bg-card p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">#{orderId.slice(0, 8).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(order?.created_at ?? null)}</span>
                  </div>
                  {order && (
                    <div className="text-xs text-muted-foreground">
                      Asiakas: <strong className="text-foreground">{[order.first_name, order.last_name].filter(Boolean).join(" ") || "Asiakas"}</strong>
                    </div>
                  )}
                  <div className="space-y-1 pt-1 border-t">
                    {orderItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs">
                        <span className="text-foreground">
                          {it.product_name || it.service_name} × {it.quantity}
                        </span>
                        <span className="font-semibold text-primary">+{Number(it.laundry_price || 0).toFixed(2)} €</span>
                      </div>
                    ))}
                    {orderItems.length === 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tilauksen pesuosuus (70%)</span>
                        <span className="font-semibold text-primary">+{((Number(order?.final_price || 0)) * 0.7).toFixed(2)} €</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {detailRows.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Ei suoritettuja tapahtumia</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
