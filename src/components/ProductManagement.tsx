import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logger } from "@/lib/logger";

interface Category {
  id: string;
  category_id: string;
  name: string;
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  category_id: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  commission_percent: number | null;
  platform_fee_type: string | null;
  platform_fee_value: number | null;
  driver_fee_type: string | null;
  driver_fee_value: number | null;
  is_active: boolean;
  badge_text?: string | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
  discount_price?: number | null;
  discount_bearer?: string | null;
  discount_custom_partner_fee?: number | null;
  discount_custom_driver_fee?: number | null;
}

const emptyFees = {
  platform_fee_type: "percent",
  platform_fee_value: "15",
  driver_fee_type: "percent",
  driver_fee_value: "85"
};

const emptyDiscount = {
  discount_price: "",
  discount_bearer: "platform",
  discount_custom_partner_fee: "",
  discount_custom_driver_fee: "",
  preview_laundry_price: ""
};

type DiscountValues = typeof emptyDiscount;

const round2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => `${round2(n).toFixed(2)} €`;

export const computeSplit = ({
  basePrice,
  discountPrice,
  laundryPrice,
  platformPct,
  bearer,
  customPartnerFee,
  customDriverFee
}: {
  basePrice: number;
  discountPrice: number | null;
  laundryPrice: number;
  platformPct: number;
  bearer: string;
  customPartnerFee: number | null;
  customDriverFee: number | null;
}) => {
  const hasDiscount = discountPrice != null && discountPrice > 0 && discountPrice < basePrice;
  const customerPrice = hasDiscount ? (discountPrice as number) : basePrice;
  const margin = Math.max(round2(basePrice - laundryPrice), 0);
  let laundry = laundryPrice;
  let platform = round2((margin * platformPct) / 100);
  let driver = round2(margin - platform);

  if (hasDiscount) {
    if (bearer === "pro_rata") {
      const ratio = basePrice > 0 ? customerPrice / basePrice : 1;
      laundry = round2(laundry * ratio);
      platform = round2(platform * ratio);
      driver = round2(customerPrice - laundry - platform);
    } else if (bearer === "partner") {
      laundry = round2(customerPrice - platform - driver);
    } else if (bearer === "custom") {
      laundry = round2(customPartnerFee ?? laundry);
      driver = round2(customDriverFee ?? 0);
      platform = round2(customerPrice - laundry - driver);
    } else {
      platform = round2(customerPrice - laundry - driver);
    }
  }

  return { hasDiscount, customerPrice, laundry, driver, platform };
};

const bearerOptions = [
  { value: "platform", label: "Alusta (Pesuni) kattaa", hint: "Suositus – pesula ja kuljettaja saavat täyden normaalin palkkion." },
  { value: "pro_rata", label: "Suhteellinen jako", hint: "Kaikki osapuolet jakavat alennusprosentin." },
  { value: "partner", label: "Pesula kattaa", hint: "Alennus vähennetään pesulan tilityksestä." },
  { value: "custom", label: "Mukautettu jako", hint: "Syötä pesulan ja kuljettajan osuudet käsin." }
];

const DiscountFields = ({
  idPrefix,
  basePrice,
  platformPct,
  values,
  onChange
}: {
  idPrefix: string;
  basePrice: number;
  platformPct: number;
  values: DiscountValues;
  onChange: (patch: Partial<DiscountValues>) => void;
}) => {
  const discountPrice = values.discount_price === "" ? null : parseFloat(values.discount_price);
  const laundryPrice = values.preview_laundry_price === ""
    ? basePrice
    : (parseFloat(values.preview_laundry_price) || 0);
  const split = computeSplit({
    basePrice,
    discountPrice: Number.isFinite(discountPrice as number) ? discountPrice : null,
    laundryPrice,
    platformPct,
    bearer: values.discount_bearer,
    customPartnerFee: values.discount_custom_partner_fee === "" ? null : parseFloat(values.discount_custom_partner_fee),
    customDriverFee: values.discount_custom_driver_fee === "" ? null : parseFloat(values.discount_custom_driver_fee)
  });
  const invalid = discountPrice != null && Number.isFinite(discountPrice) && basePrice > 0 && discountPrice >= basePrice;
  const pct = split.hasDiscount ? Math.round(((basePrice - split.customerPrice) / basePrice) * 100) : 0;

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-discount_price`}>Alennushinta (€)</Label>
        <Input
          id={`${idPrefix}-discount_price`}
          type="number"
          step="0.01"
          min="0"
          value={values.discount_price}
          onChange={(e) => onChange({ discount_price: e.target.value })}
          placeholder="Jätä tyhjäksi jos ei alennusta"
        />
        {split.hasDiscount && (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
            Alennus: -{pct} % (Säästö asiakkaalle: {eur(basePrice - split.customerPrice)})
          </Badge>
        )}
        {invalid && (
          <p className="text-xs text-destructive">
            Alennushinta ei voi olla suurempi tai yhtä suuri kuin normaalihinta.
          </p>
        )}
      </div>

      {split.hasDiscount && (
        <>
          <div className="space-y-2">
            <Label>Alennuksen kattaja maksuliikenteessä</Label>
            <RadioGroup
              value={values.discount_bearer}
              onValueChange={(v) => onChange({ discount_bearer: v })}
              className="gap-3"
            >
              {bearerOptions.map((opt) => (
                <div key={opt.value} className="flex items-start gap-3">
                  <RadioGroupItem value={opt.value} id={`${idPrefix}-bearer-${opt.value}`} className="mt-1" />
                  <Label htmlFor={`${idPrefix}-bearer-${opt.value}`} className="cursor-pointer font-normal">
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {values.discount_bearer === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-custom_partner`}>Pesulan osuus (€)</Label>
                <Input
                  id={`${idPrefix}-custom_partner`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.discount_custom_partner_fee}
                  onChange={(e) => onChange({ discount_custom_partner_fee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-custom_driver`}>Kuljettajan osuus (€)</Label>
                <Input
                  id={`${idPrefix}-custom_driver`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.discount_custom_driver_fee}
                  onChange={(e) => onChange({ discount_custom_driver_fee: e.target.value })}
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-preview_laundry`}>Pesulan hinta laskurissa (€)</Label>
        <Input
          id={`${idPrefix}-preview_laundry`}
          type="number"
          step="0.01"
          min="0"
          value={values.preview_laundry_price}
          onChange={(e) => onChange({ preview_laundry_price: e.target.value })}
          placeholder={basePrice ? basePrice.toFixed(2) : "0.00"}
        />
        <p className="text-xs text-muted-foreground">
          Vain laskurin esikatselua varten – todellinen tilitys käyttää pesulakohtaista hinnastoa.
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Asiakas maksaa</span>
          <span className="font-semibold">
            {eur(split.customerPrice)}
            {split.hasDiscount && (
              <span className="ml-2 text-xs text-muted-foreground line-through">{eur(basePrice)}</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span>🧺 Pesulan tilitys</span>
          <span className="font-semibold">{eur(split.laundry)}</span>
        </div>
        <div className="flex justify-between">
          <span>🚗 Kuljettajan tilitys</span>
          <span className="font-semibold">{eur(split.driver)}</span>
        </div>
        <div className="flex justify-between">
          <span>🏢 Pesuni (alustamaksu)</span>
          <span className={`font-semibold ${split.platform < 0 ? "text-destructive" : ""}`}>{eur(split.platform)}</span>
        </div>
      </div>
    </div>
  );
};

const feeSum = (base: number, type: string, value: string) => {
  const v = parseFloat(value || "0") || 0;
  return type === "fixed" ? v : (base * v) / 100;
};

const FeeFields = ({
  idPrefix,
  values,
  onChange
}: {
  idPrefix: string;
  values: { platform_fee_type: string; platform_fee_value: string; driver_fee_type: string; driver_fee_value: string };
  onChange: (patch: Partial<typeof values>) => void;
}) => {
  const platformPct = Math.min(100, Math.max(0, parseFloat(values.platform_fee_value || "0") || 0));
  const driverPct = Math.round((100 - platformPct) * 100) / 100;
  return (
  <div className="grid gap-4">
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Alustan komissio (%) *</Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-platform_fee_value`}
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={values.platform_fee_value}
          onChange={(e) => {
            const pct = Math.min(100, Math.max(0, parseFloat(e.target.value || "0") || 0));
            onChange({
              platform_fee_type: "percent",
              platform_fee_value: e.target.value,
              driver_fee_type: "percent",
              driver_fee_value: String(Math.round((100 - pct) * 100) / 100)
            });
          }}
          required
        />
        <span className="flex items-center text-sm text-muted-foreground">%</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Alustan osuus katteesta (asiakashinta − pesulan hinta). Kuljettajille jää automaattisesti {driverPct} %,
        joka jakautuu tasan nouto- ja palautuskeikan kesken.
      </p>
    </div>
  </div>
  );
};

export const ProductManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<"menu" | "new" | "list">("menu");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    image_url: "",
    base_price: "",
    ...emptyFees
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    image_url: "",
    base_price: "",
    ...emptyFees,
    is_active: true
  });
  const [newPromo, setNewPromo] = useState({ badge_text: "", is_featured: false, sort_order: "1" });
  const [editPromo, setEditPromo] = useState({ badge_text: "", is_featured: false, sort_order: "1" });

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logger.error("Error fetching categories:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kategorioiden lataaminen epäonnistui"
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((data as any) || []);
    } catch (error) {
      logger.error("Error fetching products:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tuotteiden lataaminen epäonnistui"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-product', {
        body: {
          name: formData.name,
          category_id: formData.category_id,
          description: formData.description || undefined,
          image_url: formData.image_url || undefined,
          base_price: parseFloat(formData.base_price),
          commission_percent: formData.platform_fee_type === 'percent'
            ? parseFloat(formData.platform_fee_value || "15")
            : 15,
          platform_fee_type: formData.platform_fee_type,
          platform_fee_value: parseFloat(formData.platform_fee_value || "0"),
          driver_fee_type: formData.driver_fee_type,
          driver_fee_value: parseFloat(formData.driver_fee_value || "0"),
          badge_text: newPromo.badge_text || undefined,
          is_featured: newPromo.is_featured,
          sort_order: parseInt(newPromo.sort_order || "1", 10) || 1
        }
      });

      if (error) throw error;

      toast({
        title: "Tuote lisätty",
        description: "Uusi tuote on lisätty onnistuneesti"
      });

      // Reset form and refresh product list
      setFormData({
        name: "",
        category_id: "",
        description: "",
        image_url: "",
        base_price: "",
        ...emptyFees
      });
      setNewPromo({ badge_text: "", is_featured: false, sort_order: "1" });
      
      fetchProducts();
    } catch (error: any) {
      logger.error("Error adding product:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tuotteen lisääminen epäonnistui"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      category_id: product.category_id,
      description: product.description || "",
      image_url: product.image_url || "",
      base_price: product.base_price.toString(),
      platform_fee_type: product.platform_fee_type || "percent",
      platform_fee_value: (product.platform_fee_value ?? product.commission_percent ?? 15).toString(),
      driver_fee_type: "percent",
      driver_fee_value: String(100 - (product.platform_fee_value ?? product.commission_percent ?? 15)),
      is_active: product.is_active
    });
    setEditPromo({
      badge_text: product.badge_text || "",
      is_featured: !!product.is_featured,
      sort_order: String(product.sort_order ?? 1)
    });
    setShowEditDialog(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: editFormData.name,
          category_id: editFormData.category_id,
          description: editFormData.description || null,
          image_url: editFormData.image_url || null,
          base_price: parseFloat(editFormData.base_price),
          commission_percent: editFormData.platform_fee_type === 'percent'
            ? parseFloat(editFormData.platform_fee_value || "15")
            : (editingProduct.commission_percent ?? 15),
          platform_fee_type: editFormData.platform_fee_type,
          platform_fee_value: parseFloat(editFormData.platform_fee_value || "0"),
          driver_fee_type: editFormData.driver_fee_type,
          driver_fee_value: parseFloat(editFormData.driver_fee_value || "0"),
          badge_text: editPromo.badge_text || null,
          is_featured: editPromo.is_featured,
          sort_order: parseInt(editPromo.sort_order || "1", 10) || 1,
          is_active: editFormData.is_active
        } as any)
        .eq("id", editingProduct.id);

      if (error) throw error;


      toast({
        title: "Tuote päivitetty",
        description: "Tuotteen tiedot on päivitetty onnistuneesti"
      });

      setShowEditDialog(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      logger.error("Error updating product:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tuotteen päivittäminen epäonnistui"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Haluatko varmasti poistaa tuotteen "${productName}"?`)) {
      return;
    }

    setDeleteLoading(productId);

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Tuote poistettu",
        description: `Tuote "${productName}" on poistettu onnistuneesti`
      });

      fetchProducts();
    } catch (error: any) {
      logger.error("Error deleting product:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tuotteen poistaminen epäonnistui"
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {view === "menu" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setView("new")}
            className="text-left rounded-xl border bg-card p-6 hover:border-primary hover:shadow-elegant transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Lisää uusi tuote</h3>
            </div>
            <p className="text-sm text-muted-foreground">Luo uusi tuote ja määritä hinnoittelu</p>
          </button>
          <button
            onClick={() => setView("list")}
            className="text-left rounded-xl border bg-card p-6 hover:border-primary hover:shadow-elegant transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Tuotteet</h3>
            </div>
            <p className="text-sm text-muted-foreground">{products.length} tuotetta · muokkaa tai poista</p>
          </button>
        </div>
      )}

      {view !== "menu" && (
        <Button variant="ghost" size="sm" onClick={() => setView("menu")} className="-ml-2">
          ← Takaisin
        </Button>
      )}

      {view === "new" && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lisää uusi tuote
          </CardTitle>
          <CardDescription>
            Täytä kaikki pakolliset tiedot ennen tuotteen tallentamista
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Tuotteen nimi *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Esim. Mattopesuri S"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategoria *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valitse kategoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.category_id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Kuvaus</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tuotteen kuvaus"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Kuvan URL</Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_price">Perushinta / pesulan oletushinta (€) *</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="0.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Käytetään, jos pesulalle ei ole omaa hintaa.
              </p>
            </div>

            <FeeFields
              idPrefix="new"
              values={formData}
              onChange={(patch) => setFormData({ ...formData, ...patch })}
            />

            <div className="grid gap-4 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="new-badge_text">Badge-teksti (sovelluksessa)</Label>
                <Input
                  id="new-badge_text"
                  value={newPromo.badge_text}
                  onChange={(e) => setNewPromo({ ...newPromo, badge_text: e.target.value })}
                  placeholder="Esim. Suosituin, 24h Pika, Säästöpaketti"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-sort_order">Järjestys sovelluksessa</Label>
                <Input
                  id="new-sort_order"
                  type="number"
                  min="1"
                  value={newPromo.sort_order}
                  onChange={(e) => setNewPromo({ ...newPromo, sort_order: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="new-is_featured"
                  checked={newPromo.is_featured}
                  onChange={(e) => setNewPromo({ ...newPromo, is_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-input"
                />
                <Label htmlFor="new-is_featured" className="cursor-pointer">Korosta tuote kärjessä</Label>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Tallennetaan..." : "Tallenna tuote"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {view === "list" && (

      <Card>
        <CardHeader>
          <CardTitle>Tuotteet</CardTitle>
          <CardDescription>
            Hallitse olemassa olevia tuotteita
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ei tuotteita vielä
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nimi</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Hinta</TableHead>
                  <TableHead>Alusta %</TableHead>
                  <TableHead>Kuljettajat %</TableHead>
                  <TableHead>Tila</TableHead>
                  <TableHead className="text-right">Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {categories.find(c => c.category_id === product.category_id)?.name || product.category_id}
                    </TableCell>
                    <TableCell>{product.base_price.toFixed(2)}€</TableCell>
                    <TableCell>
                      {Number(product.platform_fee_value ?? product.commission_percent ?? 15).toFixed(2)}
                      {' %'}
                    </TableCell>
                    <TableCell>
                      {(100 - Number(product.platform_fee_value ?? product.commission_percent ?? 15)).toFixed(2)}
                      {' %'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_active 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {product.is_active ? 'Aktiivinen' : 'Ei aktiivinen'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Muokkaa
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          disabled={deleteLoading === product.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteLoading === product.id ? "Poistetaan..." : "Poista"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Muokkaa tuotetta</DialogTitle>
            <DialogDescription>
              Päivitä tuotteen tiedot
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tuotteen nimi *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Esim. Mattopesuri S"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategoria *</Label>
              <Select
                value={editFormData.category_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, category_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valitse kategoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.category_id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Kuvaus</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Tuotteen kuvaus"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-image_url">Kuvan URL</Label>
              <Input
                id="edit-image_url"
                type="url"
                value={editFormData.image_url}
                onChange={(e) => setEditFormData({ ...editFormData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-base_price">Perushinta / pesulan oletushinta (€) *</Label>
              <Input
                id="edit-base_price"
                type="number"
                step="0.01"
                min="0"
                value={editFormData.base_price}
                onChange={(e) => setEditFormData({ ...editFormData, base_price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <FeeFields
              idPrefix="edit"
              values={editFormData}
              onChange={(patch) => setEditFormData({ ...editFormData, ...patch })}
            />

            <div className="grid gap-4 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="edit-badge_text">Badge-teksti (sovelluksessa)</Label>
                <Input
                  id="edit-badge_text"
                  value={editPromo.badge_text}
                  onChange={(e) => setEditPromo({ ...editPromo, badge_text: e.target.value })}
                  placeholder="Esim. Suosituin, 24h Pika, Säästöpaketti"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sort_order">Järjestys sovelluksessa</Label>
                <Input
                  id="edit-sort_order"
                  type="number"
                  min="1"
                  value={editPromo.sort_order}
                  onChange={(e) => setEditPromo({ ...editPromo, sort_order: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_featured"
                  checked={editPromo.is_featured}
                  onChange={(e) => setEditPromo({ ...editPromo, is_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-input"
                />
                <Label htmlFor="edit-is_featured" className="cursor-pointer">Korosta tuote kärjessä</Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={editFormData.is_active}
                onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-input"
              />
              <Label htmlFor="edit-is_active" className="cursor-pointer">
                Tuote aktiivinen
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Päivitetään..." : "Päivitä tuote"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                className="flex-1"
              >
                Peruuta
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};
