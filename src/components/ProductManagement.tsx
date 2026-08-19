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
import { Package, Plus, Trash2, Pencil, Building2 } from "lucide-react";
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
}

interface Laundry {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean;
}

interface LaundryPriceRow {
  id?: string;
  laundry_id: string;
  price: string;
}

const emptyFees = {
  platform_fee_type: "percent",
  platform_fee_value: "15",
  driver_fee_type: "percent",
  driver_fee_value: "10"
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
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Alustamaksu / komissio *</Label>
      <div className="flex gap-2">
        <Select value={values.platform_fee_type} onValueChange={(v) => onChange({ platform_fee_type: v })}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">%</SelectItem>
            <SelectItem value="fixed">€</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id={`${idPrefix}-platform_fee_value`}
          type="number"
          step="0.01"
          min="0"
          value={values.platform_fee_value}
          onChange={(e) => onChange({ platform_fee_value: e.target.value })}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">Alustan kate pesulan hinnan päälle.</p>
    </div>

    <div className="space-y-2 rounded-lg border p-3">
      <Label>Kuljettajan palkkio *</Label>
      <div className="flex gap-2">
        <Select value={values.driver_fee_type} onValueChange={(v) => onChange({ driver_fee_type: v })}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">%</SelectItem>
            <SelectItem value="fixed">€</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id={`${idPrefix}-driver_fee_value`}
          type="number"
          step="0.01"
          min="0"
          value={values.driver_fee_value}
          onChange={(e) => onChange({ driver_fee_value: e.target.value })}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">Tuotteesta kuljettajalle maksettava toimitusosuus.</p>
    </div>
  </div>
);

const LaundryPriceEditor = ({
  laundries,
  rows,
  setRows,
  fees,
  onAddLaundry
}: {
  laundries: Laundry[];
  rows: LaundryPriceRow[];
  setRows: (rows: LaundryPriceRow[]) => void;
  fees: { platform_fee_type: string; platform_fee_value: string; driver_fee_type: string; driver_fee_value: string };
  onAddLaundry: () => void;
}) => (
  <div className="space-y-3 rounded-lg border p-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Pesulakohtainen hinnasto
        </Label>
        <p className="text-xs text-muted-foreground">
          Asiakashinta = pesulan hinta + alustamaksu + kuljettajan palkkio.
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onAddLaundry}>
        + Uusi pesula
      </Button>
    </div>

    {rows.length === 0 && (
      <p className="text-xs text-muted-foreground">
        Ei pesulahintoja — käytetään tuotteen perushintaa.
      </p>
    )}

    {rows.map((row, index) => {
      const price = parseFloat(row.price || "0") || 0;
      const platform = feeSum(price, fees.platform_fee_type, fees.platform_fee_value);
      const driver = feeSum(price, fees.driver_fee_type, fees.driver_fee_value);
      return (
        <div key={index} className="space-y-2 rounded-md bg-muted/40 p-2">
          <div className="flex gap-2">
            <Select
              value={row.laundry_id}
              onValueChange={(v) => {
                const next = [...rows];
                next[index] = { ...next[index], laundry_id: v };
                setRows(next);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Valitse pesula" />
              </SelectTrigger>
              <SelectContent>
                {laundries.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}{l.city ? ` — ${l.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="w-28"
              placeholder="0.00"
              value={row.price}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...next[index], price: e.target.value };
                setRows(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pesula {price.toFixed(2)} € + alusta {platform.toFixed(2)} € + kuljettaja {driver.toFixed(2)} € ={" "}
            <span className="font-medium text-foreground">
              asiakashinta {(price + platform + driver).toFixed(2)} €
            </span>
          </p>
        </div>
      );
    })}

    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setRows([...rows, { laundry_id: "", price: "" }])}
    >
      <Plus className="h-4 w-4 mr-1" />
      Lisää pesula ja hinta
    </Button>
  </div>
);

export const ProductManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [priceRows, setPriceRows] = useState<LaundryPriceRow[]>([]);
  const [editPriceRows, setEditPriceRows] = useState<LaundryPriceRow[]>([]);
  const [showLaundryDialog, setShowLaundryDialog] = useState(false);
  const [laundryForm, setLaundryForm] = useState({ name: "", city: "" });
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

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchLaundries();
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

  const fetchLaundries = async () => {
    try {
      const { data, error } = await supabase
        .from("laundries")
        .select("id, name, city, is_active")
        .order("name");
      if (error) throw error;
      setLaundries((data as any) || []);
    } catch (error) {
      logger.error("Error fetching laundries:", error);
    }
  };

  const handleCreateLaundry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("laundries").insert({
        name: laundryForm.name,
        city: laundryForm.city || null
      });
      if (error) throw error;
      toast({ title: "Pesula lisätty", description: `${laundryForm.name} on lisätty` });
      setLaundryForm({ name: "", city: "" });
      setShowLaundryDialog(false);
      fetchLaundries();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Virhe", description: error.message || "Pesulan lisääminen epäonnistui" });
    }
  };

  const savePriceRows = async (productId: string, rows: LaundryPriceRow[]) => {
    const valid = rows.filter((r) => r.laundry_id && r.price !== "");
    if (valid.length > 0) {
      const { error } = await supabase
        .from("product_laundry_prices")
        .upsert(
          valid.map((r) => ({
            product_id: productId,
            laundry_id: r.laundry_id,
            price: parseFloat(r.price)
          })),
          { onConflict: "product_id,laundry_id" }
        );
      if (error) throw error;
    }
  };

  const loadPriceRows = async (productId: string) => {
    const { data } = await supabase
      .from("product_laundry_prices")
      .select("id, laundry_id, price")
      .eq("product_id", productId);
    setEditPriceRows(
      ((data as any[]) || []).map((r) => ({ id: r.id, laundry_id: r.laundry_id, price: String(r.price) }))
    );
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
          laundry_prices: priceRows
            .filter((r) => r.laundry_id && r.price !== "")
            .map((r) => ({ laundry_id: r.laundry_id, price: parseFloat(r.price) }))
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
      setPriceRows([]);
      
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
      driver_fee_type: product.driver_fee_type || "percent",
      driver_fee_value: (product.driver_fee_value ?? 10).toString(),
      is_active: product.is_active
    });
    loadPriceRows(product.product_id);
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
          is_active: editFormData.is_active
        } as any)
        .eq("id", editingProduct.id);

      if (error) throw error;

      await savePriceRows(editingProduct.product_id, editPriceRows);

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

            <LaundryPriceEditor
              laundries={laundries}
              rows={priceRows}
              setRows={setPriceRows}
              fees={formData}
              onAddLaundry={() => setShowLaundryDialog(true)}
            />

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
                  <TableHead>Alusta</TableHead>
                  <TableHead>Kuljettaja</TableHead>
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
                      {(product.platform_fee_type ?? 'percent') === 'fixed' ? ' €' : ' %'}
                    </TableCell>
                    <TableCell>
                      {Number(product.driver_fee_value ?? 10).toFixed(2)}
                      {(product.driver_fee_type ?? 'percent') === 'fixed' ? ' €' : ' %'}
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

            <LaundryPriceEditor
              laundries={laundries}
              rows={editPriceRows}
              setRows={setEditPriceRows}
              fees={editFormData}
              onAddLaundry={() => setShowLaundryDialog(true)}
            />

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

      {/* New laundry dialog */}
      <Dialog open={showLaundryDialog} onOpenChange={setShowLaundryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lisää uusi pesula</DialogTitle>
            <DialogDescription>Pesula tulee valittavaksi tuotteiden hinnastoon</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLaundry} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="laundry-name">Pesulan nimi *</Label>
              <Input
                id="laundry-name"
                value={laundryForm.name}
                onChange={(e) => setLaundryForm({ ...laundryForm, name: e.target.value })}
                placeholder="Esim. Pesula Oy Helsinki"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="laundry-city">Kaupunki</Label>
              <Input
                id="laundry-city"
                value={laundryForm.city}
                onChange={(e) => setLaundryForm({ ...laundryForm, city: e.target.value })}
                placeholder="Helsinki"
              />
            </div>
            <Button type="submit" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Tallenna pesula
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
