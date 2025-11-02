import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2 } from "lucide-react";
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
  is_active: boolean;
}

export const ProductManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    image_url: "",
    base_price: ""
  });

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
      setProducts(data || []);
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
          base_price: parseFloat(formData.base_price)
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
        base_price: ""
      });
      
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
              <Label htmlFor="base_price">Hinta (€) *</Label>
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
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Tallennetaan..." : "Tallenna tuote"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_active 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {product.is_active ? 'Aktiivinen' : 'Ei aktiivinen'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        disabled={deleteLoading === product.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleteLoading === product.id ? "Poistetaan..." : "Poista"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
