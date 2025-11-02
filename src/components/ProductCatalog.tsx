import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Search } from "lucide-react";

// Valmiit mattokoot
const PRESET_RUG_SIZES = [
  { width: 80, length: 150, name: "Pieni matto" },
  { width: 133, length: 195, name: "Keskikokoinen matto" },
  { width: 200, length: 300, name: "Iso matto" },
];

interface Category {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Product {
  id: string;
  product_id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  pricing_model: "FIXED" | "PER_M2";
  is_active: boolean;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_charged: number;
  dimensions_cm?: { width: number; length: number };
}

interface ProductCatalogProps {
  onAddToCart: (item: CartItem) => void;
  searchQuery: string;
  selectedCategory: string;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
}

export const ProductCatalog = ({ 
  onAddToCart,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onCategoryChange
}: ProductCatalogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<{ [key: string]: { width: string; length: string } }>({});
  const [selectedPreset, setSelectedPreset] = useState<{ [key: string]: number | null }>({});

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      console.log('🔍 Fetching product catalog...');
      
      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*").eq("is_active", true)
      ]);

      console.log('📦 Categories response:', categoriesRes);
      console.log('📦 Products response:', productsRes);

      if (categoriesRes.error) {
        console.error('❌ Categories error:', categoriesRes.error);
        throw categoriesRes.error;
      }
      if (productsRes.error) {
        console.error('❌ Products error:', productsRes.error);
        throw productsRes.error;
      }

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
      
      console.log('✅ Loaded categories:', categoriesRes.data?.length);
      console.log('✅ Loaded products:', productsRes.data?.length);
    } catch (error) {
      console.error("❌ Error fetching catalog:", error);
      toast.error("Virhe tuotteiden lataamisessa");
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (product: Product, width?: string, length?: string) => {
    if (product.pricing_model === "FIXED") {
      return product.base_price;
    }
    
    if (!width || !length) return 0;
    const w = parseFloat(width);
    const l = parseFloat(length);
    if (isNaN(w) || isNaN(l)) return 0;
    
    const squareMeters = (w * l) / 10000; // Convert cm² to m²
    return squareMeters * product.base_price;
  };

  const handleDimensionChange = (productId: string, field: "width" | "length", value: string) => {
    setDimensions(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
    // Clear preset selection when manually editing
    setSelectedPreset(prev => ({
      ...prev,
      [productId]: null
    }));
  };

  const handlePresetSelect = (productId: string, presetIndex: number) => {
    const preset = PRESET_RUG_SIZES[presetIndex];
    setDimensions(prev => ({
      ...prev,
      [productId]: {
        width: preset.width.toString(),
        length: preset.length.toString()
      }
    }));
    setSelectedPreset(prev => ({
      ...prev,
      [productId]: presetIndex
    }));
  };

  const handleAddToCart = (product: Product) => {
    if (product.pricing_model === "FIXED") {
      onAddToCart({
        product_id: product.product_id,
        product_name: product.name,
        quantity: 1,
        unit_price_charged: product.base_price
      });
      toast.success(`${product.name} lisätty ostoskoriin`);
    } else {
      const dims = dimensions[product.id];
      if (!dims?.width || !dims?.length) {
        toast.error("Syötä mitat ensin");
        return;
      }
      
      const width = parseFloat(dims.width);
      const length = parseFloat(dims.length);
      
      if (isNaN(width) || isNaN(length) || width <= 0 || length <= 0) {
        toast.error("Tarkista mitat");
        return;
      }

      const finalPrice = calculatePrice(product, dims.width, dims.length);
      
      onAddToCart({
        product_id: product.product_id,
        product_name: product.name,
        quantity: 1,
        unit_price_charged: finalPrice,
        dimensions_cm: { width, length }
      });
      
      toast.success(`${product.name} lisätty ostoskoriin`);
      // Reset dimensions
      setDimensions(prev => ({
        ...prev,
        [product.id]: { width: "", length: "" }
      }));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Ladataan tuotteita...</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-muted-foreground">Ei tuotteita saatavilla.</p>
        <p className="text-sm text-muted-foreground mt-2">Tuotteet lisätään pian!</p>
      </div>
    );
  }

  // Filter products based on search and category
  const filteredCategories = categories.map(category => {
    const categoryProducts = products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return p.category_id === category.category_id && matchesCategory && matchesSearch;
    });

    return {
      ...category,
      products: categoryProducts
    };
  }).filter(cat => cat.products.length > 0);

  return (
    <div className="space-y-8">
      {/* Search and Filter Section */}
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Hae palvelua..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-14 text-lg"
          />
        </div>

        {/* Category Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            variant={selectedCategory === 'all' ? 'hero' : 'outline'}
            size="lg"
            onClick={() => onCategoryChange('all')}
            className="font-fredoka font-bold btn-bounce-hover"
          >
            Kaikki palvelut
          </Button>
          {categories.map((category) => (
            <Button
              key={category.category_id}
              variant={selectedCategory === category.category_id ? 'hero' : 'outline'}
              size="lg"
              onClick={() => onCategoryChange(category.category_id)}
              className="font-fredoka font-bold btn-bounce-hover"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Categories */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Ei tuloksia haulle "{searchQuery}"</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              onSearchChange("");
              onCategoryChange("all");
            }}
          >
            Tyhjennä haku
          </Button>
        </div>
      ) : (
        filteredCategories.map(category => (
          <div key={category.id}>
            <h2 className="text-3xl font-bold mb-2">{category.name}</h2>
            {category.description && (
              <p className="text-muted-foreground mb-6">{category.description}</p>
            )}
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {category.products.map(product => {
                const dims = dimensions[product.id] || { width: "", length: "" };
                const calculatedPrice = product.pricing_model === "PER_M2" 
                  ? calculatePrice(product, dims.width, dims.length)
                  : product.base_price;

                return (
                  <Card key={product.id}>
                    {product.image_url && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{product.name}</CardTitle>
                      {product.description && (
                        <CardDescription>{product.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {product.pricing_model === "FIXED" ? (
                        <>
                          <div className="text-2xl font-bold">
                            {product.base_price.toFixed(2)} €
                          </div>
                          <Button 
                            onClick={() => handleAddToCart(product)}
                            className="w-full"
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Lisää ostoskoriin
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-semibold">
                            {product.base_price.toFixed(2)} € / m²
                          </div>
                          
                          <div className="space-y-3">
                            {/* Valmiit mattokoot */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Valitse mattokoko tai syötä mitat</Label>
                              <div className="grid grid-cols-1 gap-2 mb-3">
                                {PRESET_RUG_SIZES.map((preset, index) => {
                                  const presetPrice = calculatePrice(
                                    product, 
                                    preset.width.toString(), 
                                    preset.length.toString()
                                  );
                                  const isSelected = selectedPreset[product.id] === index;
                                  
                                  return (
                                    <Button
                                      key={index}
                                      type="button"
                                      variant={isSelected ? "default" : "outline"}
                                      className="justify-between h-auto py-2 px-3"
                                      onClick={() => handlePresetSelect(product.id, index)}
                                    >
                                      <span className="text-left flex-1">
                                        {preset.width}cm x {preset.length}cm | {preset.name}
                                      </span>
                                      <Badge variant="secondary" className="ml-2">
                                        {presetPrice.toFixed(2)} €
                                      </Badge>
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Tai omat mitat */}
                            <div className="pt-2 border-t">
                              <Label className="text-sm font-medium mb-2 block">Tai syötä omat mitat</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor={`width-${product.id}`} className="text-xs">Leveys (cm)</Label>
                                  <Input
                                    id={`width-${product.id}`}
                                    type="number"
                                    placeholder="esim. 170"
                                    value={dims.width}
                                    onChange={(e) => handleDimensionChange(product.id, "width", e.target.value)}
                                    min="1"
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor={`length-${product.id}`} className="text-xs">Pituus (cm)</Label>
                                  <Input
                                    id={`length-${product.id}`}
                                    type="number"
                                    placeholder="esim. 210"
                                    value={dims.length}
                                    onChange={(e) => handleDimensionChange(product.id, "length", e.target.value)}
                                    min="1"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {calculatedPrice > 0 && (
                              <div className="text-lg font-bold text-primary">
                                Hinta: {calculatedPrice.toFixed(2)} €
                              </div>
                            )}
                            
                            <Button 
                              onClick={() => handleAddToCart(product)}
                              className="w-full"
                              disabled={!dims.width || !dims.length}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Lisää ostoskoriin
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
