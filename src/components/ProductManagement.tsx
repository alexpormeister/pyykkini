import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus } from "lucide-react";

interface Category {
  id: string;
  category_id: string;
  name: string;
}

export const ProductManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    image_url: "",
    base_price: ""
  });

  useEffect(() => {
    fetchCategories();
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
      console.error("Error fetching categories:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kategorioiden lataaminen epäonnistui"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tuotteen nimi on pakollinen"
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Valitse kategoria"
      });
      return;
    }

    if (!formData.base_price || isNaN(parseFloat(formData.base_price)) || parseFloat(formData.base_price) <= 0) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Anna kelvollinen hinta"
      });
      return;
    }

    setLoading(true);

    try {
      // Generate product_id from name (lowercase, replace spaces with hyphens)
      const product_id = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

      const { error } = await supabase
        .from("products")
        .insert({
          product_id,
          name: formData.name,
          category_id: formData.category_id,
          description: formData.description || null,
          image_url: formData.image_url || null,
          base_price: parseFloat(formData.base_price),
          is_active: true,
          pricing_model: "FIXED"
        });

      if (error) throw error;

      toast({
        title: "Tuote lisätty",
        description: "Uusi tuote on lisätty onnistuneesti"
      });

      // Reset form
      setFormData({
        name: "",
        category_id: "",
        description: "",
        image_url: "",
        base_price: ""
      });
    } catch (error: any) {
      console.error("Error adding product:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tuotteen lisääminen epäonnistui"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
};
