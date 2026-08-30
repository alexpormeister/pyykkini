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
import {
  Calendar,
  Clock,
  Eye,
  FileText,
  Filter,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
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
  const [searchPhone, setSearchPhone] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterLaundry, setFilterLaundry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Date Filter States
  const [dateField, setDateField] = useState<"created_at" | "pickup_date" | "return_date">("created_at");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickDatePreset, setQuickDatePreset] = useState<string>("all");

  // Details Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

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
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
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
      setEndDate(todayStr);
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "last_30_days") {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "last_90_days") {
      const past90 = new Date(now);
      past90.setDate(past90.getDate() - 90);
      setStartDate(past90.toISOString().split("T")[0]);
      setEndDate(todayStr);
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchCustomer("");
    setSearchOrderId("");
    setSearchPhone("");
    setSearchAddress("");
    setFilterDriver("all");
    setFilterLaundry("all");
    setFilterStatus("all");
    setStartDate("");
    setEndDate("");
    setQuickDatePreset("all");
  };

  const hasActiveFilters =
    Boolean(searchCustomer) ||
    Boolean(searchOrderId) ||
    Boolean(searchPhone) ||
    Boolean(searchAddress) ||
    filterDriver !== "all" ||
    filterLaundry !== "all" ||
    filterStatus !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    const custQ = searchCustomer.toLowerCase().trim();
    const idQ = searchOrderId.toLowerCase().trim().replace("#", "");
    const phoneQ = searchPhone.toLowerCase().trim();
    const addrQ = searchAddress.toLowerCase().trim();

    return orders.filter((order) => {
      // 1. Asiakkaan nimi
      if (custQ) {
        const orderCustName = ((order.first_name || "") + " " + (order.last_name || "")).toLowerCase();
        const prof = profileOf(order.user_id);
        const profName = fullName(prof).toLowerCase();
        if (!orderCustName.includes(custQ) && !profName.includes(custQ)) {
          return false;
        }
      }

      // 2. Tilausnumero tai PIN
      if (idQ) {
        const orderId = order.id.toLowerCase();
        const pin = getPickupCode(order.id).toLowerCase();
        const acc = (order.access_code || "").toLowerCase();
        if (!orderId.includes(idQ) && !pin.includes(idQ) && !acc.includes(idQ)) {
          return false;
        }
      }

      // 3. Puhelinnumero
      if (phoneQ) {
        const p1 = (order.phone || "").toLowerCase();
        const p2 = (profileOf(order.user_id)?.phone || "").toLowerCase();
        if (!p1.includes(phoneQ) && !p2.includes(phoneQ)) {
          return false;
        }
      }

      // 4. Osoite
      if (addrQ) {
        const addr = (order.address || "").toLowerCase();
        if (!addr.includes(addrQ)) {
          return false;
        }
      }

      // 5. Kuljettaja
      if (filterDriver !== "all") {
        if (filterDriver === "unassigned" && order.driver_id) return false;
        if (filterDriver !== "unassigned" && order.driver_id !== filterDriver) return false;
      }

      // 6. Pesula
      if (filterLaundry !== "all") {
        if (order.laundry_id !== filterLaundry) return false;
      }

      // 7. Tila
      if (filterStatus !== "all") {
        if ((order.status || "").toLowerCase() !== filterStatus.toLowerCase()) {
          return false;
        }
      }

      // 8. Päivämääräsuodatus
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
    });
  }, [
    orders,
    searchCustomer,
    searchOrderId,
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

  const totalAmount = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + Number(o.payment_amount ?? o.final_price ?? 0), 0);
  }, [filteredOrders]);

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
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground" onClick={resetFilters}>
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
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  placeholder="Esim. Alex tai Matti..."
                  className="h-8 text-xs pr-7"
                />
                {searchCustomer && (
                  <button onClick={() => setSearchCustomer("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Tilausnumero / PIN */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Package className="h-3 w-3 text-sky-500" /> Tilausnumero / PIN
              </Label>
              <div className="relative">
                <Input
                  value={searchOrderId}
                  onChange={(e) => setSearchOrderId(e.target.value)}
                  placeholder="Esim. D80F tai 48291..."
                  className="h-8 text-xs pr-7"
                />
                {searchOrderId && (
                  <button onClick={() => setSearchOrderId("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Puhelinnumero */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3 text-emerald-500" /> Puhelinnumero
              </Label>
              <div className="relative">
                <Input
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="Esim. 0401234567..."
                  className="h-8 text-xs pr-7"
                />
                {searchPhone && (
                  <button onClick={() => setSearchPhone("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Osoite / Kaupunki */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <MapPin className="h-3 w-3 text-amber-500" /> Osoite / Kaupunki
              </Label>
              <div className="relative">
                <Input
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Esim. Mannerheimintie, Lohja..."
                  className="h-8 text-xs pr-7"
                />
                {searchAddress && (
                  <button onClick={() => setSearchAddress("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 5. Kuljettaja */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Truck className="h-3 w-3 text-blue-500" /> Kuljettaja
              </Label>
              <Select value={filterDriver} onValueChange={setFilterDriver}>
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

            {/* 6. Pesula */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <WashingMachine className="h-3 w-3 text-purple-500" /> Pesula
              </Label>
              <Select value={filterLaundry} onValueChange={setFilterLaundry}>
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

            {/* 7. Tilauksen tila */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Filter className="h-3 w-3 text-rose-500" /> Tilauksen tila
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kaikki tilat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Kaikki tilat</SelectItem>
                  <SelectItem value="pending" className="text-xs">🟡 Odottaa (pending)</SelectItem>
                  <SelectItem value="accepted" className="text-xs">🔵 Hyväksytty (accepted)</SelectItem>
                  <SelectItem value="picking_up" className="text-xs">🚚 Noudossa (picking_up)</SelectItem>
                  <SelectItem value="washing" className="text-xs">🟣 Pesussa (washing)</SelectItem>
                  <SelectItem value="returning" className="text-xs">🟢 Palautuksessa (returning)</SelectItem>
                  <SelectItem value="delivered" className="text-xs">✅ Toimitettu (delivered)</SelectItem>
                  <SelectItem value="rejected" className="text-xs">❌ Hylätty (rejected)</SelectItem>
                  <SelectItem value="cancelled" className="text-xs">⚪ Peruutettu (cancelled)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 8. Aikasuodatustyyppi */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-500" /> Päivämääräkohde
              </Label>
              <Select value={dateField} onValueChange={(val: any) => setDateField(val)}>
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
                  }}
                  className="h-7 w-32 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary Bar */}
      <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            Löydetty {filteredOrders.length} tilausta
          </span>
          <Badge variant="secondary" className="font-semibold text-xs">
            Yhteensä {money(totalAmount)}
          </Badge>

          {/* Status Breakdown Pills */}
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
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchCustomer("")} />
              </Badge>
            )}
            {searchOrderId && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                ID/PIN: {searchOrderId}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchOrderId("")} />
              </Badge>
            )}
            {searchPhone && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                Puh: {searchPhone}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchPhone("")} />
              </Badge>
            )}
            {filterStatus !== "all" && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                Tila: {STATUS_MAP[filterStatus]?.label || filterStatus}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterStatus("all")} />
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
                  }}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="text-xs">
                <TableHead className="w-[100px] font-bold">Tunnus & PIN</TableHead>
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
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground text-sm">
                    Ei hakuehtoja vastaavia tilauksia. Kokeile muuttaa suodattimia tai tyhjentää ne.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
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
                      {/* 1. Tunnus & PIN */}
                      <TableCell className="font-mono font-bold whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="text-foreground">{shortId(order.id)}</span>
                          <div className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1 py-0 rounded inline-block">
                            PIN {getPickupCode(order.id)}
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Asiakas */}
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

                      {/* 3. Osoite */}
                      <TableCell className="max-w-[180px] truncate" title={order.address}>
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate">{order.address || "-"}</span>
                        </div>
                      </TableCell>

                      {/* 4. Palvelu */}
                      <TableCell>
                        <span className="font-medium">{order.service_name || "Pesupalvelu"}</span>
                        {order.order_items && order.order_items.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {order.order_items.length} tuotetta
                          </div>
                        )}
                      </TableCell>

                      {/* 5. Nouto / Palautus */}
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

                      {/* 6. Kuljettaja */}
                      <TableCell>
                        {order.driver_id ? (
                          <div className="font-medium text-emerald-700 flex items-center gap-1">
                            <Truck className="h-3 w-3 shrink-0" /> {fullName(drv)}
                          </div>
                        ) : (
                          <span className="text-amber-600 italic">Ei kuskia</span>
                        )}
                      </TableCell>

                      {/* 7. Pesula */}
                      <TableCell>
                        <span className="font-medium">{lnd ? lnd.name : "Ei määritetty"}</span>
                      </TableCell>

                      {/* 8. Summa */}
                      <TableCell className="font-bold whitespace-nowrap">
                        {money(priceVal)}
                      </TableCell>

                      {/* 9. Tila */}
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={"text-[10px] font-bold uppercase " + statusMeta.badgeClass}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>

                      {/* 10. Toiminnot */}
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
      </Card>

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              Kattavat tiedot asiakkaasta, tuotteista, reitistä ja aikaleimoista
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2 text-xs">
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
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setSelectedOrder(null)}>
              Sulje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
