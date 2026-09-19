import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DispatchMap, MapTaskItem } from "./DispatchMap";
import { cn } from "@/lib/utils";
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
  Check,
  PlusCircle,
  Building2,
  CreditCard,
  FileText,
  Euro,
  ShieldCheck,
  ChevronsUpDown,
  ChevronDown,
  Trash2,
  Plus,
  ArrowRight,
  Sparkles,
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
  payment_method?: string | null;
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
  product_id?: string;
  name: string;
  base_price: number;
  platform_fee_value?: number | string | null;
  driver_fee_value?: number | string | null;
}

interface LaundryProductPrice {
  product_id: string;
  laundry_id: string;
  price: number;
  is_active: boolean;
}

interface BookingProductItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
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

const CITIES = [
  "Helsinki",
  "Espoo",
  "Vantaa",
  "Kauniainen",
  "Kirkkonummi",
  "Kerava",
  "Järvenpää",
  "Tuusula",
  "Nurmijärvi",
  "Sipoo",
  "Lohja",
  "Vihti",
];

const PAYMENT_METHODS = [
  { value: "invoice", label: "Lasku", icon: <FileText className="h-3.5 w-3.5 text-blue-500" /> },
  { value: "card", label: "Korttimaksu", icon: <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> },
  { value: "cash", label: "Käteinen", icon: <Euro className="h-3.5 w-3.5 text-amber-500" /> },
];

interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

/**
 * 🔍 Yleiskäyttöinen hakukentällinen dropdown-valitsin (Searchable Select / Combobox)
 */
const SearchableSelect: React.FC<{
  options: SearchableOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}> = ({
  options,
  value,
  onChange,
  placeholder = "Valitse...",
  searchPlaceholder = "Hae nimellä tai sanalla...",
  emptyText = "Ei tuloksia",
  className,
  triggerClassName,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <span className="truncate text-left font-medium">
            {selectedOption ? (
              <span className="flex items-center gap-1.5 truncate">
                {selectedOption.icon}
                <span className="truncate">{selectedOption.label}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-0 shadow-xl rounded-xl border bg-popover z-50", className)} align="start">
        <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/20">
          <Search className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-left transition-colors",
                    isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1.5 truncate">
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-muted-foreground truncate">{opt.sublabel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {opt.badge && (
                      <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground font-normal">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const DispatchTaskBoard: React.FC = () => {
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [laundries, setLaundries] = useState<LaundryInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Taulukon suodattimet
  const [tabFilter, setTabFilter] = useState<"all" | "unassigned" | "pickup" | "washing" | "delivery">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");

  // Modaalit
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string | null>(null);
  const [assignModalTask, setAssignModalTask] = useState<TaskRow | null>(null);
  const [assignLaundryModalTask, setAssignLaundryModalTask] = useState<TaskRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 📝 TILAUSLOMAKKEEN TILA
  const [formDateType, setFormDateType] = useState<"today" | "tomorrow" | "custom">("today");
  const [formPickupDate, setFormPickupDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formPickupTime, setFormPickupTime] = useState("10:00 - 12:00");
  const [formReturnDate, setFormReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [formReturnTime, setFormReturnTime] = useState("18:00 - 20:00");

  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formCity, setFormCity] = useState("Helsinki");
  const [formAccessCode, setFormAccessCode] = useState("");
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Monituotteet
  const [formProducts, setFormProducts] = useState<BookingProductItem[]>([
    { id: "1", name: "Pesuni-Kassi (9 kg)", quantity: 1, unit_price: 35.90, product_id: "prod_kassi_9kg" }
  ]);

  const [formLaundryId, setFormLaundryId] = useState<string>("");
  const [formDeliveryFee, setFormDeliveryFee] = useState("9.90");
  const [formServiceFee, setFormServiceFee] = useState("2.00");
  const [formMinThreshold, setFormMinThreshold] = useState("0");
  const [formPaymentMethod, setFormPaymentMethod] = useState("invoice");
  const [formSelectedDriverId, setFormSelectedDriverId] = useState<string>("unassigned");
  const [formNotes, setFormNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Dynamiset pesulakohtaiset tuotehinnat ja haitarin tila (oletuksena kiinni)
  const [laundryPrices, setLaundryPrices] = useState<LaundryProductPrice[]>([]);
  const [isPriceBreakdownOpen, setIsPriceBreakdownOpen] = useState(false);

  useEffect(() => {
    if (!formLaundryId) {
      setLaundryPrices([]);
      return;
    }
    const loadLaundryPrices = async () => {
      try {
        const { data, error } = await supabase
          .from("product_laundry_prices")
          .select("product_id, laundry_id, price, is_active")
          .eq("laundry_id", formLaundryId);

        if (!error && data) {
          setLaundryPrices(data as LaundryProductPrice[]);
        }
      } catch (err) {
        console.error("Error loading laundry prices:", err);
      }
    };
    loadLaundryPrices();
  }, [formLaundryId]);

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
        supabase.from("products").select("id, product_id, name, base_price, platform_fee_value, driver_fee_value").eq("is_active", true).order("sort_order"),
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
          .select("user_id, first_name, last_name, address")
          .ilike("phone", `%${cleanPhone}%`)
          .limit(1)
          .maybeSingle();

        if (data?.user_id) {
          setMatchedUserId(data.user_id);
          if (!formFirstName && data.first_name) setFormFirstName(data.first_name);
          if (!formLastName && data.last_name) setFormLastName(data.last_name);
          if (!formStreet && data.address) {
            const parts = data.address.split(",");
            if (parts.length >= 1) setFormStreet(parts[0].trim());
          }
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

  // Päivämäärävalinnat
  const handleDateTypeSelect = (type: "today" | "tomorrow" | "custom") => {
    setFormDateType(type);
    const d = new Date();
    if (type === "tomorrow") {
      d.setDate(d.getDate() + 1);
    }
    const iso = d.toISOString().split("T")[0];
    setFormPickupDate(iso);

    const retD = new Date(d);
    retD.setDate(retD.getDate() + 2);
    setFormReturnDate(retD.toISOString().split("T")[0]);
  };

  // 🧺 Tuoterivien hallinta
  const handleAddProductRow = () => {
    const defaultProd = products[0] || { name: "Pesuni-Kassi (9 kg)", base_price: 35.90, product_id: "prod_kassi_9kg" };
    setFormProducts((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        name: defaultProd.name,
        quantity: 1,
        unit_price: Number(defaultProd.base_price) || 0,
        product_id: defaultProd.product_id || defaultProd.id,
      },
    ]);
  };

  const handleRemoveProductRow = (rowId: string) => {
    if (formProducts.length <= 1) {
      toast({ title: "Huomio", description: "Tilauksella on oltava vähintään yksi tuote." });
      return;
    }
    setFormProducts((prev) => prev.filter((p) => p.id !== rowId));
  };

  const handleProductChange = (rowId: string, productName: string) => {
    const found = products.find((p) => p.name === productName);
    setFormProducts((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          return {
            ...item,
            name: productName,
            unit_price: found ? Number(found.base_price) : item.unit_price,
            product_id: found?.product_id || found?.id,
          };
        }
        return item;
      })
    );
  };

  const handleQuantityChange = (rowId: string, delta: number) => {
    setFormProducts((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleUnitPriceChange = (rowId: string, newPriceStr: string) => {
    const priceNum = parseFloat(newPriceStr) || 0;
    setFormProducts((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          return { ...item, unit_price: priceNum };
        }
        return item;
      })
    );
  };

  // Kokonaishintalaskenta ja palkkiojako
  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const formSubtotal = useMemo(() => {
    return formProducts.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  }, [formProducts]);

  const formMinOrderSurcharge = useMemo(() => {
    const minThreshold = parseFloat(formMinThreshold) || 0;
    if (minThreshold > 0 && formSubtotal > 0 && formSubtotal < minThreshold) {
      return Math.max(0, minThreshold - formSubtotal);
    }
    return 0;
  }, [formSubtotal, formMinThreshold]);

  const formTotalPrice = useMemo(() => {
    const del = parseFloat(formDeliveryFee) || 0;
    const srv = parseFloat(formServiceFee) || 0;
    return (formSubtotal + del + srv + formMinOrderSurcharge).toFixed(2);
  }, [formSubtotal, formDeliveryFee, formServiceFee, formMinOrderSurcharge]);

  const formLaundryItemPrices = useMemo(() => {
    let laundryTotal = 0;
    formProducts.forEach((fp) => {
      const targetProdId = fp.product_id || fp.id;
      const prodObj = products.find(
        (p) => p.product_id === targetProdId || p.id === targetProdId || p.name === fp.name
      );
      const actualProdId = prodObj?.product_id || prodObj?.id || targetProdId;
      const lp = laundryPrices.find((r) => r.product_id === actualProdId && r.is_active);

      if (lp && typeof lp.price === "number") {
        laundryTotal += lp.price * fp.quantity;
      } else {
        laundryTotal += fp.unit_price * 0.7 * fp.quantity;
      }
    });

    return Math.round(laundryTotal * 100) / 100;
  }, [formProducts, laundryPrices, products]);

  const formPriceSplit = useMemo(() => {
    const delFee = parseFloat(formDeliveryFee) || 0;
    const srvFee = parseFloat(formServiceFee) || 0;
    const laundry = formLaundryItemPrices;

    let platformMarginShare = 0;
    let driverMarginShare = 0;

    formProducts.forEach((fp) => {
      const targetProdId = fp.product_id || fp.id;
      const prodObj = products.find(
        (p) => p.product_id === targetProdId || p.id === targetProdId || p.name === fp.name
      );
      const actualProdId = prodObj?.product_id || prodObj?.id || targetProdId;
      const lp = laundryPrices.find((r) => r.product_id === actualProdId && r.is_active);
      const itemLaundryPrice = (lp && typeof lp.price === "number") ? lp.price : fp.unit_price * 0.7;

      const itemMargin = Math.max(0, fp.unit_price - itemLaundryPrice);

      const pFeePct = prodObj?.platform_fee_value != null && !isNaN(Number(prodObj.platform_fee_value))
        ? Number(prodObj.platform_fee_value)
        : 15;
      const dFeePct = prodObj?.driver_fee_value != null && !isNaN(Number(prodObj.driver_fee_value))
        ? Number(prodObj.driver_fee_value)
        : (100 - pFeePct);

      const itemPlatformShare = (itemMargin * (pFeePct / 100)) * fp.quantity;
      const itemDriverShare = (itemMargin * (dFeePct / 100)) * fp.quantity;

      platformMarginShare += itemPlatformShare;
      driverMarginShare += itemDriverShare;
    });

    const platform = Math.round((platformMarginShare + srvFee + formMinOrderSurcharge) * 100) / 100;
    const driverTotal = Math.round((driverMarginShare + delFee) * 100) / 100;
    const pickupDriver = Math.round((driverTotal / 2) * 100) / 100;
    const deliveryDriver = Math.round((driverTotal / 2) * 100) / 100;
    const totalNum = parseFloat(formTotalPrice) || 0;
    const vatRate = 25.5;
    const vatAmount = totalNum - totalNum / (1 + vatRate / 100);
    const netAmount = totalNum - vatAmount;

    return {
      platform,
      pickupDriver,
      laundry,
      deliveryDriver,
      totalNum,
      vatRate,
      vatAmount,
      netAmount,
    };
  }, [formProducts, laundryPrices, products, formDeliveryFee, formServiceFee, formMinOrderSurcharge, formTotalPrice, formLaundryItemPrices]);

  // Lomakkeen tyhjennys
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
    const defaultProd = products[0] || { name: "Pesuni-Kassi (9 kg)", base_price: 35.90, product_id: "prod_kassi_9kg" };
    setFormProducts([
      { id: "1", name: defaultProd.name, quantity: 1, unit_price: Number(defaultProd.base_price) || 35.90, product_id: defaultProd.product_id || defaultProd.id }
    ]);
    setFormDeliveryFee("9.90");
    setFormServiceFee("2.00");
    setFormMinThreshold("0");
    setFormPaymentMethod("invoice");
  };

  // 🚀 LUO TILAUS JA VÄLITÄ KEIKKA
  const handleCreateOrderAndDispatch = async (e: React.FormEvent) => {
    e.preventDefault();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupDateObj = new Date(formPickupDate);
    if (pickupDateObj < today) {
      toast({ title: "Virheellinen päivämäärä", description: "Noutopäivä ei voi olla menneisyydessä.", variant: "destructive" });
      return;
    }

    if (!formPhone.trim()) {
      toast({ title: "Puhelinnumero puuttuu", description: "Anna asiakkaan puhelinnumero.", variant: "destructive" });
      return;
    }
    if (!formStreet.trim()) {
      toast({ title: "Osoite puuttuu", description: "Anna nouto-osoite.", variant: "destructive" });
      return;
    }
    if (formProducts.length === 0) {
      toast({ title: "Tuotteet puuttuvat", description: "Lisää vähintään yksi tuote tilaukseen.", variant: "destructive" });
      return;
    }

    setFormSubmitting(true);
    try {
      let targetUserId = matchedUserId;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData.user?.id || "00000000-0000-0000-0000-000000000000";
      }

      const fullCustomerName = `${formFirstName.trim()} ${formLastName.trim()}`.trim() || "Asiakas";
      const fullAddress = `${formStreet.trim()}, ${formPostalCode.trim() ? formPostalCode.trim() + " " : ""}${formCity.trim()}`;
      const basePriceNum = formSubtotal;
      const deliveryFeeNum = parseFloat(formDeliveryFee) || 0;
      const finalPriceNum = parseFloat(formTotalPrice);

      const assignedDriver = formSelectedDriverId !== "unassigned" ? formSelectedDriverId : null;
      const chosenLaundry = laundries.find((l) => l.id === formLaundryId) || laundries[0];
      const laundryAddress = chosenLaundry?.address || "Siltakatu 11, 02770 Espoo";
      const laundryPhone = chosenLaundry?.contact_phone || "+358401422449";
      const laundryName = chosenLaundry?.name || "24Pesula Entresse";

      const summaryServiceName = formProducts.map((p) => `${p.name} x ${p.quantity}`).join(", ");

      // 1. Luodaan tilaus orders-tauluun
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
          service_name: summaryServiceName || "Pesupalvelu",
          service_type: formProducts.length > 1 ? "multiple" : "standard",
          price: basePriceNum,
          delivery_fee: deliveryFeeNum,
          service_fee: parseFloat(formServiceFee) || 0,
          final_price: finalPriceNum,
          payment_amount: finalPriceNum,
          laundry_id: formLaundryId || null,
          driver_id: assignedDriver,
          status: assignedDriver ? ("accepted" as any) : ("pending" as any),
          tracking_status: assignedDriver ? ("DRIVER_ASSIGNED" as any) : ("ORDER_PLACED" as any),
          payment_status: formPaymentMethod === "card" ? "paid" : "pending",
          payment_method: formPaymentMethod,
          special_instructions: formNotes.trim() || null,
          terms_accepted: true,
        })
        .select()
        .single();

      if (orderErr || !newOrder) {
        throw new Error(orderErr?.message || "Tilauksen tallennus epäonnistui");
      }

      // 2. Luodaan delivery_tasks: Nouto & Palautus
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

      // 3. Lisätään kaikki order_items
      const itemRows = formProducts.map((p) => ({
        order_id: newOrder.id,
        service_name: p.name,
        service_type: p.product_id || "standard",
        quantity: p.quantity,
        unit_price: p.unit_price,
        total_price: p.unit_price * p.quantity,
        laundry_id: formLaundryId || null,
      }));

      await supabase.from("order_items").insert(itemRows);

      toast({
        title: "Keikka luotu onnistuneesti!",
        description: `Tilaus ${shortOrderId(newOrder.id)} (${finalPriceNum.toFixed(2)} €) välitetty ${assignedDriver ? "kuljettajalle" : "yleiseen jakoon"}.`,
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

  const findLaundry = (id?: string | null) => {
    if (!id) return null;
    return laundries.find((l) => l.id === id) || null;
  };

  // 🔄 KULJETTAJAN MÄÄRITYS / VAIHTO
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

  // 🏢 PESULAN MÄÄRITYS / VAIHTO SUORAAN LISTASTA
  const handleAssignLaundry = async (task: TaskRow, laundryId: string | null) => {
    setActionLoading(true);
    try {
      const chosenLaundry = laundries.find((l) => l.id === laundryId);
      const laundryName = chosenLaundry?.name || null;
      const laundryAddress = chosenLaundry?.address || null;
      const laundryPhone = chosenLaundry?.contact_phone || null;
      const nowIso = new Date().toISOString();

      if (task.order_id) {
        // Päivitetään noudon määränpääksi ja palautuksen lähtöpisteeksi uusi pesula
        await supabase
          .from("delivery_tasks")
          .update({
            laundry_id: laundryId,
            destination_name: laundryName,
            destination_address: laundryAddress,
            destination_phone: laundryPhone,
            updated_at: nowIso,
          })
          .eq("order_id", task.order_id)
          .eq("task_type", "pickup");

        await supabase
          .from("delivery_tasks")
          .update({
            laundry_id: laundryId,
            origin_name: laundryName,
            origin_address: laundryAddress,
            origin_phone: laundryPhone,
            updated_at: nowIso,
          })
          .eq("order_id", task.order_id)
          .eq("task_type", "delivery");

        await supabase
          .from("orders")
          .update({
            laundry_id: laundryId,
            updated_at: nowIso,
          })
          .eq("id", task.order_id);

        await supabase
          .from("order_items")
          .update({
            laundry_id: laundryId,
          })
          .eq("order_id", task.order_id);
      }

      toast({
        title: "Pesula määritetty",
        description: laundryName
          ? `Tilaus ${shortOrderId(task.order_id)} ohjattu pesulalle ${laundryName}`
          : "Pesulan määritys poistettu.",
      });

      setAssignLaundryModalTask(null);
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Virhe", description: err.message || "Pesulan määritys epäonnistui", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
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

          const laundry = findLaundry(t.laundry_id);
          const laundryNameStr = (laundry?.name || "").toLowerCase();
          const matchLaundry = laundryNameStr.includes(q);

          const serviceNameStr = String(t.orders?.service_name || "").toLowerCase();
          const matchService = serviceNameStr.includes(q);

          if (!matchId && !matchName && !matchPhone && !matchAddr && !matchDriver && !matchLaundry && !matchService) {
            return false;
          }
        }

        return true;
      });
    } catch (err) {
      console.error("Dispatch filtering error:", err);
      return activeTasks;
    }
  }, [activeTasks, searchQuery, cityFilter, tabFilter, drivers, laundries]);

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
        laundryName: laundry?.name || "Ei määritetty",
        price: t.orders?.final_price || t.orders?.price || 35.9,
      };
    });
  }, [filteredTasks, drivers, laundries]);

  // Dropdown-optiot hakukentällisille valitsimille
  const productOptions: SearchableOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.name,
      label: p.name,
      icon: <Package className="h-3 w-3 text-muted-foreground" />,
    }));
  }, [products]);

  const laundryOptions: SearchableOption[] = useMemo(() => {
    return laundries.map((l) => ({
      value: l.id,
      label: l.name,
      sublabel: l.address || l.city || undefined,
      icon: <Building2 className="h-3 w-3 text-primary" />,
    }));
  }, [laundries]);

  const driverOptions: SearchableOption[] = useMemo(() => {
    const opts: SearchableOption[] = [
      {
        value: "unassigned",
        label: "Yleinen jako",
        badge: "Avoin",
        icon: <Truck className="h-3.5 w-3.5 text-primary" />,
      },
    ];
    drivers.forEach((d) => {
      opts.push({
        value: d.user_id,
        label: getDriverFullName(d),
        sublabel: d.phone || undefined,
        badge: d.is_active ? "Vuorossa" : "Pois",
        icon: <User className="h-3.5 w-3.5 text-muted-foreground" />,
      });
    });
    return opts;
  }, [drivers]);

  const cityOptions: SearchableOption[] = useMemo(() => {
    return CITIES.map((c) => ({
      value: c,
      label: c,
      icon: <MapPin className="h-3 w-3 text-muted-foreground" />,
    }));
  }, []);

  const paymentOptions: SearchableOption[] = useMemo(() => {
    return PAYMENT_METHODS.map((p) => ({
      value: p.value,
      label: p.label,
      icon: p.icon,
    }));
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* 🧭 YLÄRIVI: DISPATCH OPERAATTORIN PÄÄNÄKYMÄ (5 / 7 PALSTAA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ======================================================== */}
        {/* VASEN SARAKE: SELKEÄ JA TILAVA TILAUSLOMAKE (5 PALSTAA)  */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 xl:col-span-5 p-4 rounded-xl border bg-card shadow-xs space-y-4">
          
          {/* HEADER */}
          <div className="flex items-center justify-between pb-2.5 border-b">
            <h3 className="font-bold text-sm text-foreground">Uusi tilaus & välitys</h3>
            <div>
              {matchedUserId ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Kanta-asiakas
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pikatilaus</span>
              )}
            </div>
          </div>

          <form onSubmit={handleCreateOrderAndDispatch} className="space-y-3.5">
            
            {/* 1. ASIAKAS & OSOITE */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Asiakas & Nouto-osoite
                </span>
                {isCheckingPhone && <span className="text-xs text-muted-foreground">Etsitään...</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Puhelin *</Label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="040 123 4567"
                    required
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Etunimi</Label>
                  <Input
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Matti"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Sukunimi</Label>
                  <Input
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Meikäläinen"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-12 sm:col-span-5">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Katuosoite *</Label>
                  <Input
                    value={formStreet}
                    onChange={(e) => setFormStreet(e.target.value)}
                    placeholder="Mannerheimintie 10 B"
                    required
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Kaupunki</Label>
                  <SearchableSelect
                    options={cityOptions}
                    value={formCity}
                    onChange={setFormCity}
                    placeholder="Kaupunki"
                    searchPlaceholder="Hae kaupunkia..."
                    triggerClassName="h-9 text-sm"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Rappu / Koodi</Label>
                  <Input
                    value={formAccessCode}
                    onChange={(e) => setFormAccessCode(e.target.value)}
                    placeholder="B 14 / Koodi"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 2. AIKATAULU */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Aikataulu
                </span>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleDateTypeSelect("today")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      formDateType === "today" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Tänään
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateTypeSelect("tomorrow")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      formDateType === "tomorrow" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Huomenna
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Noutoaika</Label>
                  <div className="grid grid-cols-12 gap-2">
                    <Input
                      type="date"
                      value={formPickupDate}
                      min={todayDateStr}
                      onChange={(e) => {
                        setFormPickupDate(e.target.value);
                        setFormDateType("custom");
                        if (e.target.value > formReturnDate) {
                          setFormReturnDate(e.target.value);
                        }
                      }}
                      className="col-span-7 h-9 text-xs sm:text-sm px-2.5"
                    />
                    <select
                      value={formPickupTime}
                      onChange={(e) => setFormPickupTime(e.target.value)}
                      className="col-span-5 h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TIME_SLOTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Palautusaika</Label>
                  <div className="grid grid-cols-12 gap-2">
                    <Input
                      type="date"
                      value={formReturnDate}
                      min={formPickupDate || todayDateStr}
                      onChange={(e) => setFormReturnDate(e.target.value)}
                      className="col-span-7 h-9 text-xs sm:text-sm px-2.5"
                    />
                    <select
                      value={formReturnTime}
                      onChange={(e) => setFormReturnTime(e.target.value)}
                      className="col-span-5 h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TIME_SLOTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TUOTTEET & PESULA */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Tuotteet ({formProducts.length} kpl)
                </span>
                <button
                  type="button"
                  onClick={handleAddProductRow}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Lisää tuote
                </button>
              </div>

              {/* TUOTERIVIT */}
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {formProducts.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 p-1.5 rounded-lg border bg-card text-sm">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        options={productOptions}
                        value={row.name}
                        onChange={(val) => handleProductChange(row.id, val)}
                        placeholder="Valitse tuote..."
                        searchPlaceholder="Hae tuotetta..."
                        triggerClassName="h-9 text-sm"
                      />
                    </div>

                    {/* MÄÄRÄ (+ / -) */}
                    <div className="flex items-center border rounded-md bg-muted/30 h-9 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(row.id, -1)}
                        className="px-2.5 text-muted-foreground hover:text-foreground h-full font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 font-bold text-sm min-w-[20px] text-center">{row.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(row.id, 1)}
                        className="px-2.5 text-muted-foreground hover:text-foreground h-full font-bold"
                      >
                        +
                      </button>
                    </div>

                    {/* HINTA */}
                    <div className="w-[72px] shrink-0">
                      <Input
                        type="number"
                        step="0.1"
                        value={row.unit_price}
                        onChange={(e) => handleUnitPriceChange(row.id, e.target.value)}
                        className="h-9 text-sm px-2 text-right font-semibold"
                      />
                    </div>

                    {/* RIVISUMMA */}
                    <div className="w-[60px] text-right font-bold text-sm text-foreground shrink-0">
                      {(row.unit_price * row.quantity).toFixed(2)} €
                    </div>

                    {/* POISTONAPPI */}
                    {formProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProductRow(row.id)}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 shrink-0 transition-colors"
                        title="Poista rivi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* PESULA, KULJETUSMAKSU JA PALVELUMAKSU */}
              <div className="pt-2 border-t grid grid-cols-12 gap-2.5 items-end">
                <div className="col-span-12 sm:col-span-6">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Kumppanipesula</Label>
                  <SearchableSelect
                    options={laundryOptions}
                    value={formLaundryId}
                    onChange={setFormLaundryId}
                    placeholder="Valitse pesula..."
                    searchPlaceholder="Hae pesulaa..."
                    triggerClassName="h-9 text-sm"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Kuljetus (€)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Palvelumaksu (€)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formServiceFee}
                    onChange={(e) => setFormServiceFee(e.target.value)}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 4. KULJETTAJA, MAKSUTAPA & OHJEET */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Kuljettajan jako</Label>
                  <SearchableSelect
                    options={driverOptions}
                    value={formSelectedDriverId}
                    onChange={setFormSelectedDriverId}
                    placeholder="Valitse jako..."
                    searchPlaceholder="Hae kuskia..."
                    triggerClassName="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground/80 mb-1 block">Maksutapa</Label>
                  <SearchableSelect
                    options={paymentOptions}
                    value={formPaymentMethod}
                    onChange={setFormPaymentMethod}
                    placeholder="Maksutapa"
                    searchPlaceholder="Hae maksutapaa..."
                    triggerClassName="h-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-foreground/80 mb-1 block">Ohjeet kuljettajalle</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Esim. Soita ennen tuloa, jätä pussi oveen..."
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* 5. HINTAERITTELY JA PALKKIOJAKO (HAITARIVALIKKO - OLETUKSENA KIINNI) */}
            <div className="rounded-lg border bg-muted/20 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsPriceBreakdownOpen(!isPriceBreakdownOpen)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Hinta- ja palkkioerittely
                  </span>
                  <span className="text-[10px] text-muted-foreground border px-1.5 py-0.5 rounded bg-background font-mono">
                    ALV 25,5 %
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-xs font-medium">
                    {isPriceBreakdownOpen ? "Piilota erittely" : "Näytä erittely"}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isPriceBreakdownOpen && "rotate-180")} />
                </div>
              </button>

              {isPriceBreakdownOpen && (
                <div className="p-3 pt-0 border-t space-y-2">
                  <div className="rounded-md border bg-card overflow-hidden shadow-2xs mt-2">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-border/60">
                        {/* Tuotteiden välisumma */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 text-muted-foreground">Tuotteet yhteensä ({formProducts.reduce((acc, p) => acc + p.quantity, 0)} kpl)</td>
                          <td className="py-1.5 px-2.5 text-right font-medium text-foreground">{formSubtotal.toFixed(2)} €</td>
                        </tr>

                        {/* Kotiinkuljetus */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 text-muted-foreground">Kotiinkuljetus (nouto & palautus)</td>
                          <td className="py-1.5 px-2.5 text-right font-medium text-foreground">
                            {parseFloat(formDeliveryFee) > 0 ? `${parseFloat(formDeliveryFee).toFixed(2)} €` : "0,00 €"}
                          </td>
                        </tr>

                        {/* Palvelumaksu */}
                        {parseFloat(formServiceFee) > 0 && (
                          <tr className="hover:bg-muted/30">
                            <td className="py-1.5 px-2.5 text-muted-foreground">Palvelumaksu</td>
                            <td className="py-1.5 px-2.5 text-right font-medium text-foreground">{parseFloat(formServiceFee).toFixed(2)} €</td>
                          </tr>
                        )}

                        {/* Minimitilauslisä jos sovelletaan */}
                        {formMinOrderSurcharge > 0 && (
                          <tr className="hover:bg-muted/30 bg-muted/40">
                            <td className="py-1.5 px-2.5 text-muted-foreground font-medium">Pientilauslisä (alle {parseFloat(formMinThreshold).toFixed(2)} € minimin)</td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-foreground">+{formMinOrderSurcharge.toFixed(2)} €</td>
                          </tr>
                        )}

                        {/* Palkkioerittely osio */}
                        <tr className="bg-muted/50 font-semibold text-[10px] uppercase text-muted-foreground">
                          <td colSpan={2} className="py-1 px-2.5 tracking-wider">
                            Pesulan, alustan ja kuljettajien osuudet
                          </td>
                        </tr>

                        {/* Pesula */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 pl-4 text-muted-foreground">
                            Pesulan osuus (laitoshinta)
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-foreground">
                            {formPriceSplit.laundry.toFixed(2)} €
                          </td>
                        </tr>

                        {/* Alusta */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 pl-4 text-muted-foreground">
                            Alustan kate & palvelumaksu
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-foreground">
                            {formPriceSplit.platform.toFixed(2)} €
                          </td>
                        </tr>

                        {/* Noutokuski */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 pl-4 text-muted-foreground">
                            Noutokuljettajan palkkio
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-foreground">
                            {formPriceSplit.pickupDriver.toFixed(2)} €
                          </td>
                        </tr>

                        {/* Paluukuski */}
                        <tr className="hover:bg-muted/30">
                          <td className="py-1.5 px-2.5 pl-4 text-muted-foreground">
                            Palautuskuljettajan palkkio
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-semibold text-foreground">
                            {formPriceSplit.deliveryDriver.toFixed(2)} €
                          </td>
                        </tr>

                        {/* Veroton & ALV */}
                        <tr className="bg-muted/30 text-[11px] text-muted-foreground">
                          <td className="py-1 px-2.5">Veroton summa (Netto ALV 0%)</td>
                          <td className="py-1 px-2.5 text-right font-medium text-foreground">{formPriceSplit.netAmount.toFixed(2)} €</td>
                        </tr>
                        <tr className="bg-muted/30 text-[11px] text-muted-foreground">
                          <td className="py-1 px-2.5">ALV ({formPriceSplit.vatRate.toString().replace(".", ",")} %)</td>
                          <td className="py-1 px-2.5 text-right font-medium text-foreground">{formPriceSplit.vatAmount.toFixed(2)} €</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* YHTEENVETO & LÄHETYS */}
            <div className="flex items-center justify-between pt-2 gap-3 border-t">
              <div>
                <span className="text-xs text-muted-foreground block">Yhteensä (sis. kuljetus):</span>
                <span className="text-lg font-black text-foreground">{formTotalPrice} €</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForm}
                  disabled={formSubmitting}
                  className="text-xs h-9 px-3 text-muted-foreground"
                >
                  Tyhjennä
                </Button>

                <Button
                  type="submit"
                  disabled={formSubmitting}
                  className="text-sm h-9 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  {formSubmitting ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Välitetään...
                    </span>
                  ) : (
                    "Välitä"
                  )}
                </Button>
              </div>
            </div>

          </form>
        </div>

        {/* ======================================================== */}
        {/* OIKEA SARAKE: REAALIAIKAINEN KARTTA (7 PALSTAA)          */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-2.5">
          
          {/* KARTTA (SUUREMPI JA LAADUKKAAMPI NÄKYMÄ) */}
          <div className="h-[520px] lg:h-[560px] rounded-xl overflow-hidden border shadow-sm">
            <DispatchMap
              tasks={mapTasks}
              laundries={laundries}
              selectedTaskId={selectedMapTaskId}
              onSelectTask={(taskId) => setSelectedMapTaskId(taskId)}
              onAssignDriver={(taskId) => {
                const target = tasks.find((t) => t.id === taskId);
                if (target) setAssignModalTask(target);
              }}
              onAssignLaundry={(taskId) => {
                const target = tasks.find((t) => t.id === taskId);
                if (target) setAssignLaundryModalTask(target);
              }}
            />
          </div>

          {/* STATUS TICKER KARTAN ALLA */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setTabFilter(tabFilter === "unassigned" ? "all" : "unassigned")}
              className={`p-2 rounded-lg border text-left transition-colors ${
                tabFilter === "unassigned" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Jaossa</p>
              <h5 className="text-sm font-bold text-amber-600">{stats.unassigned} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "pickup" ? "all" : "pickup")}
              className={`p-2 rounded-lg border text-left transition-colors ${
                tabFilter === "pickup" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Noudossa</p>
              <h5 className="text-sm font-bold text-blue-600">{stats.pickingUp} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "washing" ? "all" : "washing")}
              className={`p-2 rounded-lg border text-left transition-colors ${
                tabFilter === "washing" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Pesulassa</p>
              <h5 className="text-sm font-bold text-emerald-600">{stats.washing} kpl</h5>
            </button>

            <button
              onClick={() => setTabFilter(tabFilter === "delivery" ? "all" : "delivery")}
              className={`p-2 rounded-lg border text-left transition-colors ${
                tabFilter === "delivery" ? "bg-muted border-foreground/30 font-semibold" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Palautuksessa</p>
              <h5 className="text-sm font-bold text-purple-600">{stats.returning} kpl</h5>
            </button>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* ALARIVI: KEIKKATAULUKKO PESULAN JA KUSKIN VALINNALLA     */}
      {/* ======================================================== */}
      <div className="space-y-2.5 pt-2">
        
        {/* HAKU & SUODATTIMET */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl border bg-card">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hae tilausnumerolla, asiakkaalla, osoitteella, pesulalla tai kuskilla..."
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
            <div className="w-[140px]">
              <SearchableSelect
                options={[{ value: "all", label: "Kaikki alueet" }, ...cities.map(c => ({ value: c, label: c }))]}
                value={cityFilter}
                onChange={setCityFilter}
                placeholder="Alue"
                triggerClassName="h-7 text-xs"
              />
            </div>

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
                  <th className="p-2.5">Pesula</th>
                  <th className="p-2.5">Kuljettaja</th>
                  <th className="p-2.5">Hinta</th>
                  <th className="p-2.5 text-right">Toiminnot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground text-xs">
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
                    const laundry = findLaundry(task.laundry_id);

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

                        <td className="p-2.5 max-w-[180px] truncate text-muted-foreground" title={address}>
                          {address}
                        </td>

                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                          {formatSafeDate(dateStr)} {timeWindow}
                        </td>

                        {/* 🏢 PESULAN VALINTA SUORAAN TAULUKOSTA */}
                        <td className="p-2.5 w-[160px]">
                          <SearchableSelect
                            options={laundryOptions}
                            value={task.laundry_id || ""}
                            onChange={(val) => handleAssignLaundry(task, val)}
                            placeholder="Määritä pesula"
                            searchPlaceholder="Hae pesulaa..."
                            triggerClassName="h-6 text-[11px] py-0 w-[150px]"
                          />
                        </td>

                        {/* 🚘 KUSKIN VALINTA SUORAAN TAULUKOSTA */}
                        <td className="p-2.5 w-[160px]">
                          <SearchableSelect
                            options={driverOptions}
                            value={task.driver_id || "unassigned"}
                            onChange={(val) => handleAssignDriver(task, val === "unassigned" ? null : val)}
                            placeholder="Määritä kuski"
                            searchPlaceholder="Hae kuskia..."
                            triggerClassName="h-6 text-[11px] py-0 w-[150px]"
                          />
                        </td>

                        <td className="p-2.5 font-semibold text-foreground whitespace-nowrap">
                          {price.toFixed(2)} €
                        </td>

                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedMapTaskId(task.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                            title="Näytä kartalla"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Kartta
                          </Button>
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

      {/* 🚘 KULJETTAJAN VALINTAMODAALI (FALLBACK / TARKASTELU) */}
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

      {/* 🏢 PESULAN VALINTAMODAALI */}
      {assignLaundryModalTask && (
        <Dialog open={!!assignLaundryModalTask} onOpenChange={() => setAssignLaundryModalTask(null)}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Määritä pesula tilaukselle</DialogTitle>
              <DialogDescription className="text-xs">
                Valitse pesula, jolle tämän tilauksen pyykit toimitetaan pestäväksi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2 max-h-[260px] overflow-y-auto">
              {laundries.map((l) => {
                const isCurrent = assignLaundryModalTask.laundry_id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => handleAssignLaundry(assignLaundryModalTask, l.id)}
                    disabled={actionLoading}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors text-xs",
                      isCurrent ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                    )}
                  >
                    <div>
                      <p className="text-foreground">{l.name}</p>
                      <p className="text-[11px] text-muted-foreground">{l.address || l.city || "Ei osoitetta"}</p>
                    </div>
                    {isCurrent ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAssignLaundryModalTask(null)}>
                Sulje
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default DispatchTaskBoard;
