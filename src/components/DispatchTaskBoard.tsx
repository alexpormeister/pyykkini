import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DispatchMap, MapTaskItem, MapLaundryItem } from "./DispatchMap";
import {
  Clock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
  Copy,
  Check,
  LayoutGrid,
  List,
  ArrowRight,
  PlusCircle,
  Building2,
  CreditCard,
  FileText,
  AlertCircle,
  Sparkles,
  ShieldCheck
} from "lucide-react";

interface OrderEmbedded {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  tracking_status: string | null;
  laundry_status: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  special_instructions: string | null;
  service_name: string;
  final_price: number;
  price?: number;
  access_code: string | null;
}

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
  pickup_name?: string | null;
  pickup_address?: string | null;
  pickup_phone?: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  scheduled_time_slot: string | null;
  status: string;
  driver_payout: number;
  route_order: number | null;
  batch_id: string | null;
  notes?: string | null;
  orders?: OrderEmbedded | null;
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
  address?: string | null;
  city?: string | null;
  contact_phone?: string | null;
}

interface ProductInfo {
  id: string;
  name: string;
  base_price: number;
}

// 🌐 PURE HELPER FUNCTIONS
function getDriverFullName(p?: Profile | null): string {
  if (!p) return "Ei kuljettajaa (Jaossa)";
  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return name || "Kuljettaja";
}

function shortOrderId(id?: string | null): string {
  if (!id) return "#------";
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, "");
  return `#${clean.slice(0, 8).toUpperCase()}`;
}

function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  } catch {
    return dateStr;
  }
}

function cityFromAddress(address?: string | null): string {
  if (!address) return "Pääkaupunkiseutu";
  const parts = String(address).split(",").map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const cleaned = tail.replace(/\d{5}/g, "").replace(/finland|suomi/i, "").trim();
  return cleaned || "Pääkaupunkiseutu";
}

const TIME_SLOTS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
  "20:00 - 22:00",
];

export const DispatchTaskBoard = () => {
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<LaundryInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [tabFilter, setTabFilter] = useState<"all" | "unassigned" | "pickup" | "washing" | "delivery">("all");
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string | null>(null);

  // Kuljettajan määrityksen modal
  const [assignModalTask, setAssignModalTask] = useState<TaskRow | null>(null);

  // 📝 DISPATCH BOOKING FORM STATE (Uuden tilauksen luonti)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultReturnStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  const [formDateType, setFormDateType] = useState<"today" | "tomorrow" | "custom">("today");
  const [formPickupDate, setFormPickupDate] = useState(todayStr);
  const [formPickupTime, setFormPickupTime] = useState("10:00 - 12:00");
  const [formReturnDate, setFormReturnDate] = useState(defaultReturnStr);
  const [formReturnTime, setFormReturnTime] = useState("16:00 - 18:00");

  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const [formStreet, setFormStreet] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formCity, setFormCity] = useState("Helsinki");
  const [formAccessCode, setFormAccessCode] = useState("");

  const [formServiceType, setFormServiceType] = useState("Pesuni-Kassi (9 kg)");
  const [formLaundryId, setFormLaundryId] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("35.90");
  const [formDeliveryFee, setFormDeliveryFee] = useState("9.90");
  const [formPaymentMethod, setFormPaymentMethod] = useState("invoice");
  const [formSelectedDriverId, setFormSelectedDriverId] = useState<string>("unassigned");
  const [formNotes, setFormNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [tasksRes, rolesRes, shiftsRes, laundriesRes, productsRes] = await Promise.all([
        supabase
          .from("delivery_tasks")
          .select("*, orders(*)")
          .order("scheduled_date", { ascending: true })
          .order("route_order", { ascending: true, nullsFirst: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
        supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
        supabase.from("laundries").select("id, name, address, city, contact_phone").order("name"),
        supabase.from("products").select("id, name, base_price").eq("is_active", true).order("sort_order"),
      ]);

      const taskRows = (tasksRes.data || []) as unknown as TaskRow[];
      setTasks(taskRows);

      const laundryRows = (laundriesRes.data || []) as LaundryInfo[];
      setLaundries(laundryRows);
      if (laundryRows.length > 0 && !formLaundryId) {
        setFormLaundryId(laundryRows[0].id);
      }

      const productRows = (productsRes.data || []) as ProductInfo[];
      setProducts(productRows);

      const driverIds = (rolesRes.data || []).map((r: any) => r.user_id as string);
      const activeIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id as string));

      if (driverIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", driverIds);

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
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.error("Dispatch tasks load error:", error);
      toast({ title: "Virhe", description: "Kuljetustehtävien lataus epäonnistui", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("dispatch_taskboard_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tasks" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_shifts" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🔍 Puhelinnumeron automaattinen tarkistus asiakasprofiileista
  useEffect(() => {
    const checkPhone = async () => {
      const cleanPhone = formPhone.replace(/\s+/g, "").trim();
      if (cleanPhone.length < 6) {
        setMatchedUserId(null);
        return;
      }

      setIsCheckingPhone(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .ilike("phone", `%${cleanPhone}%`)
          .limit(1)
          .maybeSingle();

        if (data?.user_id) {
          setMatchedUserId(data.user_id);
          if (!formFirstName && data.first_name) setFormFirstName(data.first_name);
          if (!formLastName && data.last_name) setFormLastName(data.last_name);
        } else {
          setMatchedUserId(null);
        }
      } catch (err) {
        console.error("Phone lookup error:", err);
      } finally {
        setIsCheckingPhone(false);
      }
    };

    const timer = setTimeout(checkPhone, 400);
    return () => clearTimeout(timer);
  }, [formPhone]);

  // Date selection shortcuts
  const handleDateTypeSelect = (type: "today" | "tomorrow" | "custom") => {
    setFormDateType(type);
    const d = new Date();
    if (type === "tomorrow") {
      d.setDate(d.getDate() + 1);
    }
    const iso = d.toISOString().split("T")[0];
    setFormPickupDate(iso);

    const retD = new Date(d);
    retD.setDate(retD.getDate() + 3);
    setFormReturnDate(retD.toISOString().split("T")[0]);
  };

  // Product selection handler
  const handleProductSelect = (productName: string) => {
    setFormServiceType(productName);
    const p = products.find((prod) => prod.name === productName);
    if (p) {
      setFormBasePrice(p.base_price.toFixed(2));
    }
  };

  const formTotalPrice = useMemo(() => {
    const base = parseFloat(formBasePrice) || 0;
    const del = parseFloat(formDeliveryFee) || 0;
    return (base + del).toFixed(2);
  }, [formBasePrice, formDeliveryFee]);

  // Reset form
  const handleResetForm = () => {
    setFormFirstName("");
    setFormLastName("");
    setFormPhone("");
    setFormEmail("");
    setFormStreet("");
    setFormPostalCode("");
    setFormCity("Helsinki");
    setFormAccessCode("");
    setFormNotes("");
    setMatchedUserId(null);
    setFormSelectedDriverId("unassigned");
    setFormServiceType("Pesuni-Kassi (9 kg)");
    setFormBasePrice("35.90");
    setFormDeliveryFee("9.90");
  };

  // 🚀 LUO TILAUS JA VÄLITÄ KEIKKA
  const handleCreateOrderAndDispatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPhone.trim()) {
      toast({ title: "Puhelinnumero puuttuu", description: "Anna asiakkaan puhelinnumero.", variant: "destructive" });
      return;
    }
    if (!formStreet.trim()) {
      toast({ title: "Osoite puuttuu", description: "Anna nouto-osoite.", variant: "destructive" });
      return;
    }

    setFormSubmitting(true);
    try {
      // 1. Tunnistetaan käyttäjä-ID
      let targetUserId = matchedUserId;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData.user?.id || "00000000-0000-0000-0000-000000000000";
      }

      const fullCustomerName = `${formFirstName.trim()} ${formLastName.trim()}`.trim() || "Asiakas";
      const fullAddress = `${formStreet.trim()}, ${formPostalCode.trim() ? formPostalCode.trim() + " " : ""}${formCity.trim()}`;
      const basePriceNum = parseFloat(formBasePrice) || 0;
      const deliveryFeeNum = parseFloat(formDeliveryFee) || 0;
      const finalPriceNum = parseFloat(formTotalPrice) || basePriceNum + deliveryFeeNum;

      const assignedDriver = formSelectedDriverId !== "unassigned" ? formSelectedDriverId : null;
      const chosenLaundry = laundries.find((l) => l.id === formLaundryId) || laundries[0];
      const laundryAddress = chosenLaundry?.address || "Siltakatu 11, 02770 Espoo";
      const laundryPhone = chosenLaundry?.contact_phone || "+358401422449";
      const laundryName = chosenLaundry?.name || "24Pesula Entresse";

      // 2. Luodaan tilaus orders-tauluun
      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: targetUserId,
          first_name: formFirstName.trim() || "Asiakas",
          last_name: formLastName.trim() || "",
          phone: formPhone.trim(),
          address: fullAddress,
          access_code: formAccessCode.trim() || null,
          pickup_date: formPickupDate,
          pickup_time: formPickupTime,
          pickup_slot: formPickupTime,
          return_date: formReturnDate,
          return_time: formReturnTime,
          delivery_slot: formReturnTime,
          service_name: formServiceType,
          service_type: "standard",
          price: basePriceNum,
          delivery_fee: deliveryFeeNum,
          service_fee: 0,
          final_price: finalPriceNum,
          laundry_id: formLaundryId || null,
          driver_id: assignedDriver,
          status: assignedDriver ? ("accepted" as any) : ("pending" as any),
          tracking_status: assignedDriver ? ("DRIVER_ASSIGNED" as any) : ("ORDER_PLACED" as any),
          payment_status: "pending",
          payment_method: formPaymentMethod,
          special_instructions: formNotes.trim() || null,
          terms_accepted: true,
        })
        .select()
        .single();

      if (orderErr || !newOrder) {
        throw new Error(orderErr?.message || "Tilauksen tallennus epäonnistui");
      }

      // 3. Luodaan delivery_tasks: Nouto & Palautus
      const pickupTask = {
        order_id: newOrder.id,
        task_type: "pickup",
        driver_id: assignedDriver,
        laundry_id: formLaundryId || null,
        origin_name: fullCustomerName,
        origin_address: fullAddress,
        origin_phone: formPhone.trim(),
        destination_name: laundryName,
        destination_address: laundryAddress,
        destination_phone: laundryPhone,
        scheduled_date: formPickupDate,
        scheduled_time_slot: formPickupTime,
        status: assignedDriver ? "assigned" : "unassigned",
        driver_payout: 15.0,
      };

      const deliveryTask = {
        order_id: newOrder.id,
        task_type: "delivery",
        driver_id: null,
        laundry_id: formLaundryId || null,
        origin_name: laundryName,
        origin_address: laundryAddress,
        origin_phone: laundryPhone,
        destination_name: fullCustomerName,
        destination_address: fullAddress,
        destination_phone: formPhone.trim(),
        scheduled_date: formReturnDate,
        scheduled_time_slot: formReturnTime,
        status: "pending",
        driver_payout: 15.0,
      };

      await supabase.from("delivery_tasks").insert([pickupTask, deliveryTask]);

      // 4. Lisätään order_items
      await supabase.from("order_items").insert({
        order_id: newOrder.id,
        service_name: formServiceType,
        service_type: "standard",
        quantity: 1,
        unit_price: basePriceNum,
        total_price: basePriceNum,
        laundry_id: formLaundryId || null,
      });

      toast({
        title: "Keikka luotu onnistuneesti!",
        description: `Tilaus ${shortOrderId(newOrder.id)} välitetty ${assignedDriver ? "kuljettajalle" : "yleiseen jakoon"}.`,
      });

      handleResetForm();
      await fetchAll();
    } catch (err: any) {
      console.error("Order creation error:", err);
      toast({
        title: "Tilauksen luonti epäonnistui",
        description: err.message || "Tarkista tiedot ja kokeile uudelleen.",
        variant: "destructive",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const findDriver = (id?: string | null) => {
    if (!id) return null;
    return drivers.find((d) => d.user_id === id) || null;
  };

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t) return false;
      const taskSt = String(t.status || "").toLowerCase();
      const orderSt = String(t.orders?.status || "").toLowerCase();
      const orderTracking = String(t.orders?.tracking_status || "").toUpperCase();

      if (["completed", "failed", "cancelled"].includes(taskSt)) return false;
      if (["delivered", "completed", "rejected", "cancelled"].includes(orderSt)) return false;
      if (orderTracking === "COMPLETED") return false;

      return true;
    });
  }, [tasks]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    activeTasks.forEach((t) => {
      const addr = t.task_type === "pickup"
        ? (t.pickup_address || t.origin_address || t.orders?.address)
        : (t.delivery_address || t.destination_address || t.orders?.address);
      set.add(cityFromAddress(addr));
    });
    return Array.from(set).sort();
  }, [activeTasks]);

  const filteredTasks = useMemo(() => {
    try {
      const q = String(searchQuery || "").toLowerCase().trim().replace(/^#/, "");

      return activeTasks.filter((t) => {
        if (!t) return false;

        const addr = t.task_type === "pickup"
          ? (t.pickup_address || t.origin_address || t.orders?.address)
          : (t.delivery_address || t.destination_address || t.orders?.address);

        if (cityFilter !== "all" && cityFromAddress(addr) !== cityFilter) {
          return false;
        }

        const taskSt = String(t.status || "").toLowerCase();
        const orderSt = String(t.orders?.status || "").toLowerCase();
        const isLaundry = orderSt === "washing" || taskSt === "washing" || taskSt === "awaiting_laundry";

        if (tabFilter === "unassigned") {
          if (isLaundry || t.driver_id || (taskSt !== "unassigned" && taskSt !== "pending")) return false;
        } else if (tabFilter === "pickup") {
          if (isLaundry || t.task_type !== "pickup") return false;
        } else if (tabFilter === "washing") {
          if (!isLaundry) return false;
        } else if (tabFilter === "delivery") {
          if (isLaundry || t.task_type !== "delivery") return false;
        }

        if (q) {
          const rawOrderId = String(t.order_id || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
          const rawTaskId = String(t.id || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
          const shortIdStr = shortOrderId(t.order_id).toLowerCase();
          const matchId = rawOrderId.includes(q) || rawTaskId.includes(q) || shortIdStr.includes(q);

          const firstName = String(t.orders?.first_name || t.pickup_name || "").toLowerCase();
          const lastName = String(t.orders?.last_name || "").toLowerCase();
          const fullNameStr = `${firstName} ${lastName}`.trim();
          const matchName = firstName.includes(q) || lastName.includes(q) || fullNameStr.includes(q);

          const phoneStr = String(t.pickup_phone || t.delivery_phone || t.orders?.phone || "").toLowerCase().replace(/\s+/g, "");
          const cleanQ = q.replace(/\s+/g, "");
          const matchPhone = phoneStr.includes(cleanQ);

          const fullAddrStr = String(addr || "").toLowerCase();
          const matchAddr = fullAddrStr.includes(q);

          const driver = findDriver(t.driver_id);
          const driverNameStr = getDriverFullName(driver).toLowerCase();
          const matchDriver = driverNameStr.includes(q);

          const serviceNameStr = String(t.orders?.service_name || "").toLowerCase();
          const matchService = serviceNameStr.includes(q);

          if (!matchId && !matchName && !matchPhone && !matchAddr && !matchDriver && !matchService) {
            return false;
          }
        }

        return true;
      });
    } catch (err) {
      console.error("Dispatch filtering error:", err);
      return activeTasks;
    }
  }, [activeTasks, searchQuery, cityFilter, tabFilter, drivers]);

  const stats = useMemo(() => {
    let unassigned = 0;
    let pickingUp = 0;
    let washing = 0;
    let returning = 0;

    activeTasks.forEach((t) => {
      const taskSt = String(t.status || "").toLowerCase();
      const orderSt = String(t.orders?.status || "").toLowerCase();
      const isLaundry = orderSt === "washing" || taskSt === "washing" || taskSt === "awaiting_laundry";

      if (isLaundry) {
        washing++;
      } else if (!t.driver_id || taskSt === "unassigned" || taskSt === "pending") {
        unassigned++;
      } else if (t.task_type === "pickup") {
        pickingUp++;
      } else if (t.task_type === "delivery") {
        returning++;
      }
    });

    return {
      total: activeTasks.length,
      unassigned,
      pickingUp,
      washing,
      returning,
    };
  }, [activeTasks]);

  // Muunnetaan kartan muotoon
  const mapTasks: MapTaskItem[] = useMemo(() => {
    return filteredTasks.map((t) => {
      const isPickup = t.task_type === "pickup";
      const addr = isPickup
        ? (t.pickup_address || t.origin_address || t.orders?.address || "Helsinki")
        : (t.delivery_address || t.destination_address || t.orders?.address || "Helsinki");

      const custName = isPickup
        ? `${t.orders?.first_name || t.pickup_name || "Asiakas"} ${t.orders?.last_name || ""}`.trim()
        : `${t.orders?.first_name || t.delivery_name || "Asiakas"} ${t.orders?.last_name || ""}`.trim();

      const phone = t.pickup_phone || t.delivery_phone || t.orders?.phone || "";
      const driver = findDriver(t.driver_id);
      const laundry = laundries.find((l) => l.id === t.laundry_id);

      return {
        id: t.id,
        order_id: t.order_id,
        task_type: isPickup ? "pickup" : "delivery",
        status: t.status,
        customerName: custName,
        phone,
        address: addr,
        city: cityFromAddress(addr),
        scheduledTime: t.scheduled_time_slot || t.orders?.pickup_time || "10-12",
        driverName: getDriverFullName(driver),
        driverId: t.driver_id,
        laundryName: laundry?.name || "24Pesula Entresse",
        price: t.orders?.final_price || t.orders?.price || 35.9,
      };
    });
  }, [filteredTasks, drivers, laundries]);

  const handleAssignDriver = async (task: TaskRow, driverId: string | null) => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newStatus = driverId ? "assigned" : "unassigned";

      await supabase
        .from("delivery_tasks")
        .update({
          driver_id: driverId,
          status: newStatus,
          updated_at: nowIso,
        })
        .eq("id", task.id);

      if (task.order_id) {
        await supabase
          .from("orders")
          .update({
            driver_id: driverId,
            status: driverId ? "accepted" : "pending",
            tracking_status: driverId ? "DRIVER_ASSIGNED" : "ORDER_PLACED",
            updated_at: nowIso,
          })
          .eq("id", task.order_id);
      }

      toast({
        title: driverId ? "Kuljettaja määritetty" : "Keikka vapautettu",
        description: driverId
          ? `Keikka liitettiin kuljettajalle ${getDriverFullName(findDriver(driverId))}`
          : "Keikka on nyt avoimessa jaossa.",
      });

      setAssignModalTask(null);
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Toiminto epäonnistui", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* 🧭 YLÄRIVI: DISPATCH OPERAATTORIN PÄÄNÄKYMÄ (2-PALSTAINEN) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ======================================================== */}
        {/* VASEN SARAKE: DISPATCH TILAUSLOMAKE (BOOKING ENTRY)     */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 xl:col-span-6 p-4 rounded-xl border bg-card shadow-sm space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Välittäjän tilausluonti (Dispatch Booking)</h3>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {matchedUserId ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  App-käyttäjä tunnistettu
                </span>
              ) : (
                <span>Puhelin- / Välitystilaus</span>
              )}
            </div>
          </div>

          <form onSubmit={handleCreateOrderAndDispatch} className="space-y-3">
            
            {/* 1. AIKATAULU (DATE & TIME) */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Aikataulu
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={formDateType === "today" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleDateTypeSelect("today")}
                    className="h-6 text-[11px] px-2"
                  >
                    Tänään
                  </Button>
                  <Button
                    type="button"
                    variant={formDateType === "tomorrow" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleDateTypeSelect("tomorrow")}
                    className="h-6 text-[11px] px-2"
                  >
                    Huomenna
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Noutopäivä & aika</Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      type="date"
                      value={formPickupDate}
                      onChange={(e) => {
                        setFormPickupDate(e.target.value);
                        setFormDateType("custom");
                      }}
                      className="h-7 text-xs px-2"
                    />
                    <Select value={formPickupTime} onValueChange={setFormPickupTime}>
                      <SelectTrigger className="h-7 text-[11px] px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot} className="text-xs">
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Palautuspäivä & aika</Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      type="date"
                      value={formReturnDate}
                      onChange={(e) => setFormReturnDate(e.target.value)}
                      className="h-7 text-xs px-2"
                    />
                    <Select value={formReturnTime} onValueChange={setFormReturnTime}>
                      <SelectTrigger className="h-7 text-[11px] px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot} className="text-xs">
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ASIAKASTIEDOT (CUSTOMER DETAILS) */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Asiakastiedot
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Etunimi</Label>
                  <Input
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Matti"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Sukunimi</Label>
                  <Input
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Meikäläinen"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Puhelinnumero *</span>
                    {isCheckingPhone && <span className="text-[9px] text-muted-foreground">Tarkistetaan...</span>}
                  </Label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="040 123 4567"
                    required
                    className="h-7 text-xs mt-0.5 font-medium"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Sähköposti (valinnainen)</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="matti@esimerkki.fi"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* 3. NOUTO-OSOITE (PICKUP ADDRESS) */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Nouto-osoite
              </span>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Label className="text-[10px] text-muted-foreground">Katuosoite & asuntonro *</Label>
                  <Input
                    value={formStreet}
                    onChange={(e) => setFormStreet(e.target.value)}
                    placeholder="Mannerheimintie 10 B 14"
                    required
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div className="col-span-4">
                  <Label className="text-[10px] text-muted-foreground">Rappukoodi / Summeri</Label>
                  <Input
                    value={formAccessCode}
                    onChange={(e) => setFormAccessCode(e.target.value)}
                    placeholder="B 1234"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Postinumero</Label>
                  <Input
                    value={formPostalCode}
                    onChange={(e) => setFormPostalCode(e.target.value)}
                    placeholder="00100"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Kaupunki</Label>
                  <Select value={formCity} onValueChange={setFormCity}>
                    <SelectTrigger className="h-7 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Helsinki">Helsinki</SelectItem>
                      <SelectItem value="Espoo">Espoo</SelectItem>
                      <SelectItem value="Vantaa">Vantaa</SelectItem>
                      <SelectItem value="Kauniainen">Kauniainen</SelectItem>
                      <SelectItem value="Kirkkonummi">Kirkkonummi</SelectItem>
                      <SelectItem value="Kerava">Kerava</SelectItem>
                      <SelectItem value="Järvenpää">Järvenpää</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 4. PALVELU, PESULA & HINNOITTELU */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Palvelu & Pesula
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Palvelu / Tuote</Label>
                  <Select value={formServiceType} onValueChange={handleProductSelect}>
                    <SelectTrigger className="h-7 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.name} className="text-xs">
                          {p.name} ({p.base_price.toFixed(2)} €)
                        </SelectItem>
                      ))}
                      <SelectItem value="Muu erikoispesu">Muu erikoispesu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Kumppanipesula</Label>
                  <Select value={formLaundryId} onValueChange={setFormLaundryId}>
                    <SelectTrigger className="h-7 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {laundries.map((l) => (
                        <SelectItem key={l.id} value={l.id} className="text-xs">
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Pesu (€)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value)}
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Kuljetus (€)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-bold">Yhteensä (€)</Label>
                  <div className="h-7 px-2 flex items-center justify-center font-bold text-xs bg-muted rounded border mt-0.5 text-foreground">
                    {formTotalPrice} €
                  </div>
                </div>
              </div>
            </div>

            {/* 5. KULJETTAJA, MAKSUTAPA & OHJEET */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Kuljettajan määritys</Label>
                  <Select value={formSelectedDriverId} onValueChange={setFormSelectedDriverId}>
                    <SelectTrigger className="h-7 text-xs mt-0.5">
                      <SelectValue placeholder="Valitse jako" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        ⚡ Yleinen jako (Kaikki kuskit)
                      </SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.user_id} value={d.user_id} className="text-xs">
                          {getDriverFullName(d)} {d.is_active ? "🟢" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Maksutapa</Label>
                  <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                    <SelectTrigger className="h-7 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Lasku</SelectItem>
                      <SelectItem value="card">Korttimaksu</SelectItem>
                      <SelectItem value="pay_on_delivery">Maksu toimituksessa</SelectItem>
                      <SelectItem value="app">Sovellusmaksu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground">Ohjeet kuljettajalle (INST)</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Esim. Soita 15 min ennen tuloa, jätä pussi oven taakse..."
                  className="h-7 text-xs mt-0.5"
                />
              </div>
            </div>

            {/* TOIMINTONAPIT */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetForm}
                disabled={formSubmitting}
                className="text-xs h-8 px-3 text-muted-foreground"
              >
                Tyhjennä
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={formSubmitting}
                className="text-xs h-8 px-5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {formSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Välitetään keikkaa...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Luo ja välitä keikka
                  </span>
                )}
              </Button>
            </div>

          </form>
        </div>

        {/* ======================================================== */}
        {/* OIKEA SARAKE: REAALIAIKAINEN KARTTA & TILAANNEKATSAUS    */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col space-y-3">
          
          {/* KARTTAKOMPONENTTI */}
          <div className="h-[430px] rounded-xl overflow-hidden border shadow-sm">
            <DispatchMap
              tasks={mapTasks}
              laundries={laundries}
              selectedTaskId={selectedMapTaskId}
              onSelectTask={(taskId) => setSelectedMapTaskId(taskId)}
              onAssignDriver={(taskId) => {
                const target = tasks.find((t) => t.id === taskId);
                if (target) setAssignModalTask(target);
              }}
            />
          </div>

          {/* REAALIAIKAINEN STATUS TICKER KARTAN ALLA */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setTabFilter(tabFilter === "unassigned" ? "all" : "unassigned")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                tabFilter === "unassigned" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Jaossa / Vapaana</p>
              <h5 className="text-sm font-bold text-amber-600 mt-0.5">{stats.unassigned} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "pickup" ? "all" : "pickup")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                tabFilter === "pickup" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Noudossa</p>
              <h5 className="text-sm font-bold text-blue-600 mt-0.5">{stats.pickingUp} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "washing" ? "all" : "washing")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                tabFilter === "washing" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Pesulassa</p>
              <h5 className="text-sm font-bold text-emerald-600 mt-0.5">{stats.washing} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "delivery" ? "all" : "delivery")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                tabFilter === "delivery" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Palautuksessa</p>
              <h5 className="text-sm font-bold text-purple-600 mt-0.5">{stats.returning} kpl</h5>
            </button>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* ALARIVI: REAALIAIKAINEN KEIKKATAULUKKO (DISPATCH JOBS)  */}
      {/* ======================================================== */}
      <div className="space-y-2.5 pt-2">
        
        {/* HAKU & SUODATTIMET */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl border bg-card">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hae tilausnumerolla, asiakkaalla, osoitteella, puhelimella tai kuskilla..."
              className="pl-8 h-7 text-xs bg-muted/30 border-muted-foreground/20 rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-7 text-xs min-w-[120px] rounded-lg">
                <SelectValue placeholder="Kaikki kaupungit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki alueet</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="h-7 text-xs px-2.5"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Päivitä
            </Button>
          </div>
        </div>

        {/* TAULUKKO */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-2.5">Keikka / ID</th>
                  <th className="p-2.5">Tyyppi</th>
                  <th className="p-2.5">Tila</th>
                  <th className="p-2.5">Asiakas</th>
                  <th className="p-2.5">Osoite</th>
                  <th className="p-2.5">Aikataulu</th>
                  <th className="p-2.5">Kuljettaja</th>
                  <th className="p-2.5">Hinta</th>
                  <th className="p-2.5 text-right">Toiminnot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">
                      Ei aktiivisia keikkoja hakuehdoilla.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const isPickup = task.task_type === "pickup";
                    const customerName = isPickup
                      ? `${task.orders?.first_name || task.pickup_name || "Asiakas"} ${task.orders?.last_name || ""}`.trim()
                      : `${task.orders?.first_name || task.delivery_name || "Asiakas"} ${task.orders?.last_name || ""}`.trim();

                    const phone = task.pickup_phone || task.delivery_phone || task.orders?.phone || "";
                    const address = isPickup
                      ? (task.pickup_address || task.origin_address || task.orders?.address || "-")
                      : (task.delivery_address || task.destination_address || task.orders?.address || "-");

                    const dateStr = task.scheduled_date || (isPickup ? task.orders?.pickup_date : task.orders?.return_date);
                    const timeWindow = task.scheduled_time_slot || (isPickup ? task.orders?.pickup_time : task.orders?.return_time) || "10-12";
                    const price = task.orders?.final_price || task.orders?.price || 0;
                    const driver = findDriver(task.driver_id);

                    const orderSt = String(task.orders?.status || "").toLowerCase();
                    const taskSt = String(task.status || "").toLowerCase();
                    const isLaundry = orderSt === "washing" || taskSt === "washing" || taskSt === "awaiting_laundry";

                    let statusBadge = (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                        {task.status}
                      </span>
                    );

                    if (isLaundry) {
                      statusBadge = (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Pesulassa
                        </span>
                      );
                    } else if (!task.driver_id || taskSt === "unassigned" || taskSt === "pending") {
                      statusBadge = (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Jaossa
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {isPickup ? "Noudossa" : "Palautuksessa"}
                        </span>
                      );
                    }

                    return (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 font-mono text-[11px] font-semibold text-foreground">
                          {shortOrderId(task.order_id)}
                        </td>

                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isPickup ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" : "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                          }`}>
                            {isPickup ? "Nouto" : "Palautus"}
                          </span>
                        </td>

                        <td className="p-2.5">
                          {statusBadge}
                        </td>

                        <td className="p-2.5">
                          <span className="font-medium text-foreground block">{customerName}</span>
                          {phone && <span className="text-[10px] text-muted-foreground">{phone}</span>}
                        </td>

                        <td className="p-2.5 max-w-[200px] truncate text-muted-foreground" title={address}>
                          {address}
                        </td>

                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                          {formatSafeDate(dateStr)} klo {timeWindow}
                        </td>

                        <td className="p-2.5">
                          <span className={driver ? "text-foreground font-medium" : "text-amber-700 dark:text-amber-400 font-semibold"}>
                            {getDriverFullName(driver)}
                          </span>
                        </td>

                        <td className="p-2.5 font-semibold text-foreground whitespace-nowrap">
                          {price.toFixed(2)} €
                        </td>

                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMapTaskId(task.id);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                              title="Näytä kartalla"
                            >
                              <MapPin className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssignModalTask(task)}
                              className="h-6 text-[10px] px-2"
                            >
                              {driver ? "Vaihda" : "Määritä"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🚘 KULJETTAJAN VALINTAMODAALI */}
      {assignModalTask && (
        <Dialog open={!!assignModalTask} onOpenChange={() => setAssignModalTask(null)}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Määritä kuljettaja keikalle</DialogTitle>
              <DialogDescription className="text-xs">
                Valitse kuljettaja tai vapauta keikka yleiseen jakoon.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <button
                onClick={() => handleAssignDriver(assignModalTask, null)}
                disabled={actionLoading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border text-left hover:bg-muted transition-colors text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">Vapauta yleiseen jakoon</p>
                  <p className="text-[11px] text-muted-foreground">Kuka tahansa kuljettaja voi ottaa tämän keikan</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                {drivers.map((d) => {
                  const isCurrent = assignModalTask.driver_id === d.user_id;
                  const dName = getDriverFullName(d);

                  return (
                    <button
                      key={d.user_id}
                      onClick={() => handleAssignDriver(assignModalTask, d.user_id)}
                      disabled={actionLoading}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors text-xs ${
                        isCurrent ? "bg-muted font-semibold" : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <p className="text-foreground">{dName}</p>
                        <p className="text-[11px] text-muted-foreground">{d.phone || "Ei numeroa"}</p>
                      </div>
                      {isCurrent ? (
                        <span className="text-[11px] text-muted-foreground font-semibold">Määritetty</span>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAssignModalTask(null)}>
                Sulje
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
