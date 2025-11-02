import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

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
}

export const ProductCatalog = ({ onAddToCart }: ProductCatalogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<{ [key: string]: { width: string; length: string } }>({});

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

  return (
    <div className="space-y-12">
      {categories.map(category => {
        const categoryProducts = products.filter(p => p.category_id === category.category_id);
        
        if (categoryProducts.length === 0) return null;

        return (
          <div key={category.id}>
            <h2 className="text-3xl font-bold mb-2">{category.name}</h2>
            {category.description && (
              <p className="text-muted-foreground mb-6">{category.description}</p>
            )}
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map(product => {
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
                            <div>
                              <Label htmlFor={`width-${product.id}`}>Leveys (cm)</Label>
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
                              <Label htmlFor={`length-${product.id}`}>Pituus (cm)</Label>
                              <Input
                                id={`length-${product.id}`}
                                type="number"
                                placeholder="esim. 210"
                                value={dims.length}
                                onChange={(e) => handleDimensionChange(product.id, "length", e.target.value)}
                                min="1"
                              />
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
        );
      })}
    </div>
  );
};
