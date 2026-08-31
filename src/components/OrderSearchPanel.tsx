import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  History,
  Image as ImageIcon,
  KeyRound,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Truck,
  User,
  WashingMachine,
  X,
} from "lucide-react";

interface OrderItem {
  id: string;
  service_name: string;
  product_name: string | null;
  quantity: number;
  total_price: number;
  laundry_price?: number | null;
}

interface OrderLogEntry {
  id: string;
  order_id: string;
  changed_by: string | null;
  change_type: string;
  change_description: string;
  old_value: any;
  new_value: any;
  created_at: string;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
}

interface OrderRecord {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  tracking_status: string | null;
  laundry_status: string | null;
  service_name: string;
  final_price: number;
  payment_amount?: number;
  price?: number;
  delivery_fee?: number;
  service_fee?: number;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  special_instructions: string | null;
  pickup_date: string;
  pickup_time: string;
  return_date: string | null;
  return_time: string | null;
  created_at: string;
  accepted_at?: string | null;
  actual_pickup_time?: string | null;
  actual_return_time?: string | null;
  access_code: string | null;
  order_items?: OrderItem[];
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

const STATUS_MAP: Record<string, { label: string; color: string; badgeClass: string }> = {
  pending: { label: "Odottaa", color: "amber", badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300" },
  accepted: { label: "Hyväksytty", color: "blue", badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300" },
  picking_up: { label: "Noudossa", color: "blue", badgeClass: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300" },
  washing: { label: "Pesussa", color: "purple", badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300" },
  returning: { label: "Palautuksessa", color: "emerald", badgeClass: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300" },
  delivered: { label: "Toimitettu", color: "green", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" },
  completed: { label: "Valmis", color: "green", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "Hylätty", color: "red", badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300" },
  cancelled: { label: "Peruutettu", color: "gray", badgeClass: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300" },
};

const shortId = (id: string) => "#" + id.slice(0, 8).toUpperCase();

const getPickupCode = (id?: string) => {
  if (!id) return "48291";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return String((Math.abs(hash) % 90000) + 10000);
};

const fullName = (p?: Profile | null) =>
  p ? (p.first_name || "") + " " + (p.last_name || "").trim() || "Tuntematon" : "Ei määritetty";

const money = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";

const PAGE_SIZE = 25;

export const OrderSearchPanel = () => {
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<LaundryInfo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchPin, setSearchPin] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterLaundry, setFilterLaundry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Date Filter States: Oletuksena tämän päivän tilaukset
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [dateField, setDateField] = useState<"created_at" | "pickup_date" | "return_date">("created_at");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [quickDatePreset, setQuickDatePreset] = useState<string>("today");

  // Sivutus (25 tilausta kerrallaan)
  const [page, setPage] = useState(1);

  // Details Modal & Event Logs
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"details" | "logs">("details");
  const [orderLogs, setOrderLogs] = useState<OrderLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<string>("all");

  const fetchOrderLogs = useCallback(async (orderId: string) => {
    if (!orderId) return;
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_history")
        .select("*, profiles:changed_by(first_name, last_name, phone)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrderLogs(data as unknown as OrderLogEntry[]);
      }
    } catch (err) {
      console.error("Error fetching order logs:", err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrder?.id) {
      fetchOrderLogs(selectedOrder.id);
      const channel = supabase
        .channel(`order_logs_live_${selectedOrder.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_history" }, () => {
          fetchOrderLogs(selectedOrder.id);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setOrderLogs([]);
      setActiveModalTab("details");
    }
  }, [selectedOrder?.id, fetchOrderLogs]);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [ordersRes, laundriesRes, rolesRes, shiftsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false }),
        supabase.from("laundries").select("id, name").order("name"),
        supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
        supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
      ]);

      const orderRows = (ordersRes.data || []) as unknown as OrderRecord[];
      setOrders(orderRows);
      setLaundries((laundriesRes.data || []) as LaundryInfo[]);

      // Collect user profiles
      const userIds = new Set<string>();
      orderRows.forEach((o) => {
        if (o.user_id) userIds.add(o.user_id);
        if (o.driver_id) userIds.add(o.driver_id);
      });
      (rolesRes.data || []).forEach((r: any) => userIds.add(r.user_id));

      if (userIds.size > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", Array.from(userIds));

        const profRows = (profData || []) as Profile[];
        setProfiles(profRows);

        const activeDriverIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id));
        const driverIds = (rolesRes.data || []).map((r: any) => r.user_id as string);
        setDrivers(
          driverIds.map((id) => {
            const p = profRows.find((pr) => pr.user_id === id);
            return {
              user_id: id,
              first_name: p?.first_name || null,
              last_name: p?.last_name || null,
              phone: p?.phone || null,
              is_active: activeDriverIds.has(id),
            };
          })
        );
      }
    } catch (err: any) {
      console.error("OrderSearch fetch error:", err);
      toast({ title: "Virhe", description: "Tilausten lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("order_search_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const profileOf = (id?: string | null) => profiles.find((p) => p.user_id === id) || null;
  const driverOf = (id?: string | null) => drivers.find((d) => d.user_id === id) || null;
  const laundryOf = (id?: string | null) => laundries.find((l) => l.id === id) || null;

  // Preset Date Filter Handler
  const applyDatePreset = (preset: string) => {
    setQuickDatePreset(preset);
    setPage(1);
    const now = new Date();
    const curTodayStr = now.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(curTodayStr);
      setEndDate(curTodayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(curTodayStr);
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(curTodayStr);
    } else if (preset === "last_30_days") {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(curTodayStr);
    } else if (preset === "last_90_days") {
      const past90 = new Date(now);
      past90.setDate(past90.getDate() - 90);
      setStartDate(past90.toISOString().split("T")[0]);
      setEndDate(curTodayStr);
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchCustomer("");
    setSearchOrderId("");
    setSearchPin("");
    setSearchPhone("");
    setSearchAddress("");
    setFilterDriver("all");
    setFilterLaundry("all");
    setFilterStatus("all");
    setStartDate("");
    setEndDate("");
    setQuickDatePreset("all");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(searchCustomer) ||
    Boolean(searchOrderId) ||
    Boolean(searchPin) ||
    Boolean(searchPhone) ||
    Boolean(searchAddress) ||
    filterDriver !== "all" ||
    filterLaundry !== "all" ||
    filterStatus !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  // Filtered Orders Calculation (Aina uusimmasta vanhimpaan)
  const filteredOrders = useMemo(() => {
    const custQ = searchCustomer.toLowerCase().trim();
    const idQ = searchOrderId.toLowerCase().trim().replace("#", "");
    const pinQ = searchPin.toLowerCase().trim();
    const phoneQ = searchPhone.toLowerCase().trim();
    const addrQ = searchAddress.toLowerCase().trim();

    return orders
      .filter((order) => {
        // 1. Asiakkaan nimi
        if (custQ) {
          const orderCustName = ((order.first_name || "") + " " + (order.last_name || "")).toLowerCase();
          const prof = profileOf(order.user_id);
          const profName = fullName(prof).toLowerCase();
          if (!orderCustName.includes(custQ) && !profName.includes(custQ)) {
            return false;
          }
        }

        // 2. Tilausnumero
        if (idQ) {
          const orderId = order.id.toLowerCase();
          if (!orderId.includes(idQ)) {
            return false;
          }
        }

        // 3. PIN-koodi
        if (pinQ) {
          const pin = getPickupCode(order.id).toLowerCase();
          const acc = (order.access_code || "").toLowerCase();
          if (!pin.includes(pinQ) && !acc.includes(pinQ)) {
            return false;
          }
        }

        // 4. Puhelinnumero
        if (phoneQ) {
          const p1 = (order.phone || "").toLowerCase();
          const p2 = (profileOf(order.user_id)?.phone || "").toLowerCase();
          if (!p1.includes(phoneQ) && !p2.includes(phoneQ)) {
            return false;
          }
        }

        // 5. Osoite
        if (addrQ) {
          const addr = (order.address || "").toLowerCase();
          if (!addr.includes(addrQ)) {
            return false;
          }
        }

        // 6. Kuljettaja
        if (filterDriver !== "all") {
          if (filterDriver === "unassigned" && order.driver_id) return false;
          if (filterDriver !== "unassigned" && order.driver_id !== filterDriver) return false;
        }

        // 7. Pesula
        if (filterLaundry !== "all") {
          if (order.laundry_id !== filterLaundry) return false;
        }

        // 8. Tila
        if (filterStatus !== "all") {
          if ((order.status || "").toLowerCase() !== filterStatus.toLowerCase()) {
            return false;
          }
        }

        // 9. Päivämääräsuodatus
        if (startDate || endDate) {
          let orderDateStr = "";
          if (dateField === "created_at") {
            orderDateStr = order.created_at ? order.created_at.split("T")[0] : "";
          } else if (dateField === "pickup_date") {
            orderDateStr = order.pickup_date || "";
          } else if (dateField === "return_date") {
            orderDateStr = order.return_date || "";
          }

          if (orderDateStr) {
            if (startDate && orderDateStr < startDate) return false;
            if (endDate && orderDateStr > endDate) return false;
          } else if (startDate || endDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [
    orders,
    searchCustomer,
    searchOrderId,
    searchPin,
    searchPhone,
    searchAddress,
    filterDriver,
    filterLaundry,
    filterStatus,
    dateField,
    startDate,
    endDate,
    profiles,
  ]);

  // Sivutuslaskenta (25 tilausta / sivu)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const st = (o.status || "pending").toLowerCase();
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [filteredOrders]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ladataan tilaushakua...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Filter Card */}
      <Card className="shadow-sm border">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              🔍
            </div>
            <div>
              <CardTitle className="text-base font-bold">Monipuolinen Tilaushaku</CardTitle>
              <CardDescription className="text-xs">
                Hae ja suodata tilauksia asiakkaan, päivämäärien, kuskien, osoitteiden ja tilojen mukaan
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Tyhjennä suodattimet
              </Button>
            )}

            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => fetchAll(true)} disabled={refreshing}>
              <RefreshCw className={"h-3.5 w-3.5 mr-1 " + (refreshing ? "animate-spin" : "")} /> Päivitä
            </Button>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-4 space-y-4">
          {/* Main Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Asiakkaan nimi */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <User className="h-3 w-3 text-primary" /> Asiakkaan nimi
              </Label>
              <div className="relative">
                <Input
                  value={searchCustomer}
                  onChange={(e) => {
                    setSearchCustomer(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Esim. Alex tai Matti..."
                  className="h-8 text-xs pr-7"
                />
                {searchCustomer && (
                  <button
                    onClick={() => {
                      setSearchCustomer("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Tilaustunnus */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Package className="h-3 w-3 text-sky-500" /> Tilaustunnus
              </Label>
              <div className="relative">
                <Input
                  value={searchOrderId}
                  onChange={(e) => {
                    setSearchOrderId(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Esim. D80F tai täysi ID..."
                  className="h-8 text-xs pr-7"
                />
                {searchOrderId && (
                  <button
                    onClick={() => {
                      setSearchOrderId("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. PIN-koodi */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-amber-500" /> PIN-koodi
              </Label>
              <div className="relative">
                <Input
                  value={searchPin}
                  onChange={(e) => {
                    setSearchPin(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Esim. 48291..."
                  className="h-8 text-xs pr-7"
                />
                {searchPin && (
                  <button
                    onClick={() => {
                      setSearchPin("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Puhelinnumero */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3 text-emerald-500" /> Puhelinnumero
              </Label>
              <div className="relative">
                <Input
                  value={searchPhone}
                  onChange={(e) => {
                    setSearchPhone(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Esim. 0401234567..."
                  className="h-8 text-xs pr-7"
                />
                {searchPhone && (
                  <button
                    onClick={() => {
                      setSearchPhone("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 5. Osoite / Kaupunki */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <MapPin className="h-3 w-3 text-amber-500" /> Osoite / Kaupunki
              </Label>
              <div className="relative">
                <Input
                  value={searchAddress}
                  onChange={(e) => {
                    setSearchAddress(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Esim. Mannerheimintie, Lohja..."
                  className="h-8 text-xs pr-7"
                />
                {searchAddress && (
                  <button
                    onClick={() => {
                      setSearchAddress("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 6. Kuljettaja */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Truck className="h-3 w-3 text-blue-500" /> Kuljettaja
              </Label>
              <Select
                value={filterDriver}
                onValueChange={(val) => {
                  setFilterDriver(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kaikki kuljettajat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Kaikki kuljettajat</SelectItem>
                  <SelectItem value="unassigned" className="text-xs font-semibold text-amber-600">Ilman kuljettajaa</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                      {fullName(d)} {d.is_active ? "• vuorossa" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 7. Pesula */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <WashingMachine className="h-3 w-3 text-purple-500" /> Pesula
              </Label>
              <Select
                value={filterLaundry}
                onValueChange={(val) => {
                  setFilterLaundry(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kaikki pesulat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Kaikki pesulat</SelectItem>
                  {laundries.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 8. Tilauksen tila (Ilman sulkutekstejä) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Filter className="h-3 w-3 text-rose-500" /> Tilauksen tila
              </Label>
              <Select
                value={filterStatus}
                onValueChange={(val) => {
                  setFilterStatus(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kaikki tilat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Kaikki tilat</SelectItem>
                  <SelectItem value="pending" className="text-xs">🟡 Odottaa</SelectItem>
                  <SelectItem value="accepted" className="text-xs">🔵 Hyväksytty</SelectItem>
                  <SelectItem value="picking_up" className="text-xs">🚚 Noudossa</SelectItem>
                  <SelectItem value="washing" className="text-xs">🟣 Pesussa</SelectItem>
                  <SelectItem value="returning" className="text-xs">🟢 Palautuksessa</SelectItem>
                  <SelectItem value="delivered" className="text-xs">✅ Toimitettu</SelectItem>
                  <SelectItem value="rejected" className="text-xs">❌ Hylätty</SelectItem>
                  <SelectItem value="cancelled" className="text-xs">⚪ Peruutettu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 9. Aikasuodatustyyppi */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-500" /> Päivämääräkohde
              </Label>
              <Select
                value={dateField}
                onValueChange={(val: any) => {
                  setDateField(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at" className="text-xs">Tilauksen luontipvm</SelectItem>
                  <SelectItem value="pickup_date" className="text-xs">Noutopäivä</SelectItem>
                  <SelectItem value="return_date" className="text-xs">Palautuspäivä</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range & Quick Presets Bar */}
          <div className="bg-muted/40 p-3 rounded-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Pikanapit:
              </span>
              {[
                { key: "all", label: "Kaikki" },
                { key: "today", label: "Tänään" },
                { key: "yesterday", label: "Eilen" },
                { key: "this_week", label: "Tämä viikko" },
                { key: "this_month", label: "Tämä kuukausi" },
                { key: "last_30_days", label: "Viimeiset 30 pv" },
                { key: "last_90_days", label: "Viimeiset 90 pv" },
              ].map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={quickDatePreset === p.key ? "default" : "outline"}
                  onClick={() => applyDatePreset(p.key)}
                  className="h-7 px-2 text-[11px]"
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Start Date & End Date Inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Mistä:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setQuickDatePreset("custom");
                    setPage(1);
                  }}
                  className="h-7 w-32 text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Mihin:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setQuickDatePreset("custom");
                    setPage(1);
                  }}
                  className="h-7 w-32 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary Bar (Poistettu yhteissumma käyttäjän pyynnöstä) */}
      <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            Löydetty {filteredOrders.length} tilausta
          </span>
          <span className="text-xs text-muted-foreground">
            (Näytetään sivu {page} / {totalPages} · {PAGE_SIZE} kpl/sivu)
          </span>

          {/* Status Breakdown Pills (Ilman sulkutekstejä) */}
          <div className="flex flex-wrap items-center gap-1 pl-2 border-l">
            {Object.entries(statusCounts).map(([st, cnt]) => {
              const meta = STATUS_MAP[st] || { label: st, badgeClass: "bg-muted text-muted-foreground" };
              return (
                <span
                  key={st}
                  className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + meta.badgeClass}
                >
                  {cnt} {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {searchCustomer && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                Nimi: {searchCustomer}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setSearchCustomer(""); setPage(1); }} />
              </Badge>
            )}
            {searchOrderId && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                ID: {searchOrderId}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setSearchOrderId(""); setPage(1); }} />
              </Badge>
            )}
            {searchPin && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                PIN: {searchPin}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setSearchPin(""); setPage(1); }} />
              </Badge>
            )}
            {searchPhone && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                Puh: {searchPhone}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setSearchPhone(""); setPage(1); }} />
              </Badge>
            )}
            {filterStatus !== "all" && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                Tila: {STATUS_MAP[filterStatus]?.label || filterStatus}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setFilterStatus("all"); setPage(1); }} />
              </Badge>
            )}
            {(startDate || endDate) && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                {(startDate || "...") + " ➜ " + (endDate || "...")}
                <X
                  className="h-2.5 w-2.5 cursor-pointer"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setQuickDatePreset("all");
                    setPage(1);
                  }}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Orders Table: Tilaustunnus ja PIN-koodi erillisinä sarakkeina */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="text-xs">
                <TableHead className="w-[100px] font-bold">Tilaustunnus</TableHead>
                <TableHead className="w-[85px] font-bold">PIN-koodi</TableHead>
                <TableHead className="font-bold">Asiakas</TableHead>
                <TableHead className="font-bold">Osoite</TableHead>
                <TableHead className="font-bold">Palvelu</TableHead>
                <TableHead className="font-bold">Nouto / Palautus</TableHead>
                <TableHead className="font-bold">Kuljettaja</TableHead>
                <TableHead className="font-bold">Pesula</TableHead>
                <TableHead className="font-bold">Summa</TableHead>
                <TableHead className="font-bold">Tila</TableHead>
                <TableHead className="text-right font-bold w-[90px]">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground text-sm">
                    Ei hakuehtoja vastaavia tilauksia. Kokeile muuttaa suodattimia tai tyhjentää ne.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => {
                  const custName = ((order.first_name || "") + " " + (order.last_name || "")).trim() || fullName(profileOf(order.user_id));
                  const drv = driverOf(order.driver_id);
                  const lnd = laundryOf(order.laundry_id);
                  const statusMeta = STATUS_MAP[(order.status || "pending").toLowerCase()] || {
                    label: order.status,
                    badgeClass: "bg-muted text-muted-foreground",
                  };
                  const priceVal = Number(order.payment_amount ?? order.final_price ?? 0);

                  return (
                    <TableRow key={order.id} className="text-xs hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      {/* 1. Tilaustunnus omana sarakkeena */}
                      <TableCell className="font-mono font-bold whitespace-nowrap text-foreground">
                        {shortId(order.id)}
                      </TableCell>

                      {/* 2. PIN-koodi omana sarakkeena */}
                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                          {getPickupCode(order.id)}
                        </span>
                      </TableCell>

                      {/* 3. Asiakas */}
                      <TableCell>
                        <div className="font-semibold text-foreground">{custName}</div>
                        {order.phone && (
                          <a
                            href={"tel:" + order.phone}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-primary hover:underline flex items-center gap-1"
                          >
                            <Phone className="h-2.5 w-2.5" /> {order.phone}
                          </a>
                        )}
                      </TableCell>

                      {/* 4. Osoite */}
                      <TableCell className="max-w-[180px] truncate" title={order.address}>
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate">{order.address || "-"}</span>
                        </div>
                      </TableCell>

                      {/* 5. Palvelu */}
                      <TableCell>
                        <span className="font-medium">{order.service_name || "Pesupalvelu"}</span>
                        {order.order_items && order.order_items.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {order.order_items.length} tuotetta
                          </div>
                        )}
                      </TableCell>

                      {/* 6. Nouto / Palautus */}
                      <TableCell className="whitespace-nowrap">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="font-medium text-foreground">Nouto:</span> {order.pickup_date} klo {order.pickup_time || "10:00"}
                          </div>
                          {order.return_date && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="font-medium text-foreground">Palautus:</span> {order.return_date} klo {order.return_time || "10:00"}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* 7. Kuljettaja */}
                      <TableCell>
                        {order.driver_id ? (
                          <div className="font-medium text-emerald-700 flex items-center gap-1">
                            <Truck className="h-3 w-3 shrink-0" /> {fullName(drv)}
                          </div>
                        ) : (
                          <span className="text-amber-600 italic">Ei kuskia</span>
                        )}
                      </TableCell>

                      {/* 8. Pesula */}
                      <TableCell>
                        <span className="font-medium">{lnd ? lnd.name : "Ei määritetty"}</span>
                      </TableCell>

                      {/* 9. Summa */}
                      <TableCell className="font-bold whitespace-nowrap">
                        {money(priceVal)}
                      </TableCell>

                      {/* 10. Tila (Puhdas suomenkielinen teksti) */}
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={"text-[10px] font-bold uppercase " + statusMeta.badgeClass}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>

                      {/* 11. Toiminnot */}
                      <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs flex items-center gap-1"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-3 w-3" /> Tiedot
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Sivutuskontrollit (25 tilausta / sivu) */}
        {totalPages > 1 && (
          <div className="p-3 bg-muted/30 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Näytetään {(page - 1) * PAGE_SIZE + 1} – {Math.min(page * PAGE_SIZE, filteredOrders.length)} / {filteredOrders.length} tilausta
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Edellinen
              </Button>

              <span className="px-2 font-semibold">
                {page} / {totalPages}
              </span>

              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Seuraava <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Order Details & Event Logs Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-base font-bold">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Tilauksen tiedot {selectedOrder ? shortId(selectedOrder.id) : ""}
              </span>
              {selectedOrder && (
                <Badge variant="outline" className={"text-xs uppercase font-bold " + (STATUS_MAP[(selectedOrder.status || "pending").toLowerCase()]?.badgeClass || "")}>
                  {STATUS_MAP[(selectedOrder.status || "pending").toLowerCase()]?.label || selectedOrder.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kattavat tiedot asiakkaasta, kuljetuksesta, pesulasta ja täydellinen tapahtumaloki
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <Tabs value={activeModalTab} onValueChange={(val: any) => setActiveModalTab(val)} className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 h-9 mb-3 bg-muted/60">
                <TabsTrigger value="details" className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Yleistiedot
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs font-semibold flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Tapahtumaloki ({orderLogs.length})
                </TabsTrigger>
              </TabsList>

              {/* VÄLILEHTI 1: YLEISTIEDOT */}
              <TabsContent value="details" className="space-y-4 py-1 text-xs">
                {/* Asiakastiedot & Reitti */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-muted/40 p-3 rounded-lg space-y-1.5">
                    <h4 className="font-bold text-foreground flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary" /> Asiakkaan tiedot
                    </h4>
                    <p className="font-semibold text-sm">
                      {((selectedOrder.first_name || "") + " " + (selectedOrder.last_name || "")).trim() || fullName(profileOf(selectedOrder.user_id))}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selectedOrder.phone || profileOf(selectedOrder.user_id)?.phone || "-"}
                    </p>
                    <p className="text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" /> {selectedOrder.address || "-"}
                    </p>
                  </div>

                  <div className="bg-muted/40 p-3 rounded-lg space-y-1.5">
                    <h4 className="font-bold text-foreground flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-blue-500" /> Käsittely & Kuljetus
                    </h4>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">Kuljettaja:</strong> {selectedOrder.driver_id ? fullName(driverOf(selectedOrder.driver_id)) : "Ei määritetty"}
                    </p>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">Pesula:</strong> {laundryOf(selectedOrder.laundry_id)?.name || "Ei määritetty"}
                    </p>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">PIN-koodi:</strong>{" "}
                      <span className="font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1 rounded">
                        {getPickupCode(selectedOrder.id)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Aikataulu */}
                <div className="bg-muted/20 border p-3 rounded-lg space-y-1">
                  <h4 className="font-bold text-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sky-500" /> Aikataulu
                  </h4>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground">Noutoaika:</span>
                      <p className="font-semibold">{selectedOrder.pickup_date} klo {selectedOrder.pickup_time || "10:00"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Palautusaika:</span>
                      <p className="font-semibold">{selectedOrder.return_date || "-"} klo {selectedOrder.return_time || "10:00"}</p>
                    </div>
                  </div>
                </div>

                {/* Tuotteet */}
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-foreground flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-purple-500" /> Tilauksen tuotteet ({selectedOrder.order_items.length} kpl)
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/40 text-[11px]">
                          <TableRow>
                            <TableHead>Tuote / Palvelu</TableHead>
                            <TableHead className="text-center w-[60px]">Kpl</TableHead>
                            <TableHead className="text-right w-[80px]">Yhteensä</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {selectedOrder.order_items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.product_name || item.service_name}</TableCell>
                              <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                              <TableCell className="text-right font-semibold">{money(item.total_price)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Hintaerittely */}
                <div className="bg-muted/40 p-3 rounded-lg space-y-1">
                  <h4 className="font-bold text-foreground">Hinnan erittely</h4>
                  <div className="space-y-1 text-[11px]">
                    {selectedOrder.price != null && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tuotteiden välisumma:</span>
                        <span>{money(selectedOrder.price)}</span>
                      </div>
                    )}
                    {selectedOrder.delivery_fee != null && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Toimitusmaksu:</span>
                        <span>{money(selectedOrder.delivery_fee)}</span>
                      </div>
                    )}
                    {selectedOrder.service_fee != null && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Palvelumaksu:</span>
                        <span>{money(selectedOrder.service_fee)}</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-sm text-foreground">
                      <span>Kokonaissumma:</span>
                      <span>{money(Number(selectedOrder.payment_amount ?? selectedOrder.final_price ?? 0))}</span>
                    </div>
                  </div>
                </div>

                {/* Lisätiedot / Erityisohjeet */}
                {selectedOrder.special_instructions && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
                    <h4 className="font-bold text-amber-800 dark:text-amber-300">Erityisohjeet / Lisätiedot:</h4>
                    <p className="text-amber-900 dark:text-amber-200">{selectedOrder.special_instructions}</p>
                  </div>
                )}
              </TabsContent>

              {/* VÄLILEHTI 2: TAPAHTUMALOKI (KAIKKI TAPAHTUMAT JA AIKALEIMAT) */}
              <TabsContent value="logs" className="space-y-3 py-1 text-xs">
                {/* Yläpalkki: Pika-suodattimet ja Päivitä-nappi */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg text-xs border">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                      <Filter className="h-3 w-3" /> Suodata:
                    </span>
                    {[
                      { key: "all", label: "Kaikki" },
                      { key: "driver", label: "🚚 Kuljettaja" },
                      { key: "laundry", label: "🧺 Pesula" },
                      { key: "status", label: "🔄 Tilamuutokset" },
                      { key: "customer", label: "👤 Asiakas" },
                    ].map((f) => (
                      <Button
                        key={f.key}
                        size="sm"
                        variant={logFilter === f.key ? "default" : "outline"}
                        onClick={() => setLogFilter(f.key)}
                        className="h-6 px-2 text-[10px]"
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => selectedOrder && fetchOrderLogs(selectedOrder.id)}
                    disabled={logsLoading}
                    className="h-6 px-2 text-[11px] flex items-center gap-1 self-end sm:self-auto"
                  >
                    <RefreshCw className={`h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} />
                    Päivitä lokit
                  </Button>
                </div>

                {/* Lokilistaus / Aikajana */}
                {logsLoading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    <span>Ladataan tapahtumalokia...</span>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/20">
                    <History className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">Ei tapahtumia tällä suodatuksella</p>
                    <p className="text-[11px] mt-1 text-muted-foreground">Kaikki tilaukseen liittyvät toimenpiteet tallentuvat tänne automaattisesti kellonaikoineen.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {filteredLogs.map((log, idx) => {
                      const actor = getLogActorBadge(log, selectedOrder);
                      return (
                        <div
                          key={log.id || idx}
                          className="p-3 rounded-lg border bg-card text-xs shadow-sm hover:border-primary/40 transition-colors space-y-1.5"
                        >
                          {/* Ylärivi: Tekijäbadge + Aikaleima */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`text-[10px] font-semibold flex items-center px-1.5 py-0.5 ${actor.className}`}>
                                {actor.icon}
                                {actor.label}
                              </Badge>
                              {log.profiles && (
                                <span className="text-[11px] font-medium text-foreground">
                                  {log.profiles.first_name} {log.profiles.last_name}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded">
                              <Clock className="h-3 w-3" />
                              {formatLogTimestamp(log.created_at)}
                            </div>
                          </div>

                          {/* Tapahtuman selite */}
                          <p className="text-xs font-semibold text-foreground pl-0.5">
                            {log.change_description || "Tapahtuma kirjattu"}
                          </p>

                          {/* Valokuvat jos saatavilla */}
                          {log.new_value?.photos && Array.isArray(log.new_value.photos) && log.new_value.photos.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {log.new_value.photos.map((imgUrl: string, imgIdx: number) => (
                                <a
                                  key={imgIdx}
                                  href={imgUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="relative block w-14 h-14 rounded border overflow-hidden bg-muted group hover:ring-2 hover:ring-primary"
                                  title="Avaa täysikokoinen kuva"
                                >
                                  <img src={imgUrl} alt={`Tuotekuva ${imgIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-2 pt-2 border-t">
            <Button size="sm" onClick={() => setSelectedOrder(null)}>
              Sulje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
