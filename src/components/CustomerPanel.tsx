import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart as CartIcon, Package, Shirt } from "lucide-react";
import { CheckoutForm } from "./CheckoutForm";
import { ShoppingCart } from "./ShoppingCart";
import type { CartItem } from "./ShoppingCart";
import { ProductCatalog } from "./ProductCatalog";
import { OrderTracking } from "./OrderTracking";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface NewCartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_charged: number;
  dimensions_cm?: { width: number; length: number };
}

export const CustomerPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'services' | 'cart' | 'booking' | 'orders'>('services');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [newCartItems, setNewCartItems] = useState<NewCartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  const handleAddToCart = (item: NewCartItem) => {
    // Convert new cart item format to old format for compatibility with existing checkout
    const legacyItem: CartItem = {
      id: `${item.product_id}-${Date.now()}`,
      type: 'service',
      serviceId: item.product_id,
      name: item.product_name,
      description: '',
      price: item.unit_price_charged,
      quantity: item.quantity,
      metadata: item.dimensions_cm ? { rugDimensions: item.dimensions_cm } : undefined
    };
    
    setCartItems(prev => [...prev, legacyItem]);
    setNewCartItems(prev => [...prev, item]);
  };

  const handleProceedToCheckout = (items: CartItem[], total: number) => {
    setCurrentView('booking');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section with Mascot */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex justify-center mb-6">
            <img 
              src="/lovable-uploads/89393e6a-83c3-4f5a-916e-d3ed09d4386a.png" 
              alt="Pesuni maskotti" 
              className="w-24 h-24 animate-bounce"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-fredoka font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Tilaa Pesu Helposti! 
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto font-fredoka">
            Valitse palvelu, lisää ostoskoriin ja lähetä tilaus - me hoidamme loput!
          </p>
          <div className="bg-primary/10 rounded-xl p-6 max-w-3xl mx-auto mb-8">
            <h2 className="text-2xl font-fredoka font-bold mb-4 text-primary">📝 Näin se toimii:</h2>
            <div className="grid md:grid-cols-3 gap-4 text-left">
              <div className="bg-background rounded-lg p-4 shadow-sm">
                <div className="text-3xl mb-2">1️⃣</div>
                <h3 className="font-bold mb-1">Valitse palvelu</h3>
                <p className="text-sm text-muted-foreground">Klikkaa "Tilaa pesu" ja valitse haluamasi pesupalvelu</p>
              </div>
              <div className="bg-background rounded-lg p-4 shadow-sm">
                <div className="text-3xl mb-2">2️⃣</div>
                <h3 className="font-bold mb-1">Lisää ostoskoriin</h3>
                <p className="text-sm text-muted-foreground">Lisää tuotteet koriin ja siirry kassalle</p>
              </div>
              <div className="bg-background rounded-lg p-4 shadow-sm">
                <div className="text-3xl mb-2">3️⃣</div>
                <h3 className="font-bold mb-1">Lähetä tilaus</h3>
                <p className="text-sm text-muted-foreground">Täytä yhteystiedot ja valitse nouto- ja palautusajat</p>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button 
              variant={currentView === 'services' ? 'hero' : 'outline'} 
              size="lg"
              onClick={() => setCurrentView('services')}
              className="flex items-center gap-2"
            >
              <Shirt className="h-5 w-5" />
              Tilaa pesu
            </Button>
            <Button 
              variant={currentView === 'cart' ? 'hero' : 'outline'} 
              size="lg"
              onClick={() => setCurrentView('cart')}
              className="flex items-center gap-2 relative"
            >
              <CartIcon className="h-5 w-5" />
              Ostoskori
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </Button>
            <Button 
              variant={currentView === 'orders' ? 'hero' : 'outline'} 
              size="lg"
              onClick={() => setCurrentView('orders')}
              className="flex items-center gap-2"
            >
              <Package className="h-5 w-5" />
              Omat tilaukset
            </Button>
          </div>
        </div>

        {/* Services View - Product Catalog */}
        {currentView === 'services' && (
          <div className="animate-fade-in">
            <ProductCatalog onAddToCart={handleAddToCart} />
          </div>
        )}

        {/* Shopping Cart View */}
        {currentView === 'cart' && (
          <div className="animate-fade-in">
            <ShoppingCart
              cartItems={cartItems}
              appliedCoupon={appliedCoupon}
              onUpdateCart={setCartItems}
              onProceedToCheckout={handleProceedToCheckout}
              onCouponApplied={setAppliedCoupon}
            />
          </div>
        )}

        {/* Booking/Checkout View */}
        {currentView === 'booking' && (
          <div className="animate-fade-in">
            <CheckoutForm
              cartItems={cartItems}
              appliedCoupon={appliedCoupon}
              onBack={() => setCurrentView('cart')}
              onSuccess={() => {
                setCartItems([]);
                setNewCartItems([]);
                setAppliedCoupon(null);
                setCurrentView('orders');
                toast({
                  title: "Tilaus onnistui!",
                  description: "Kiitos tilauksesta! Näet tilauksen tiedot tilaushistoriassa."
                });
              }}
              onApplyCoupon={setAppliedCoupon}
            />
          </div>
        )}

        {/* Orders View - Order Tracking */}
        {currentView === 'orders' && (
          <div className="animate-fade-in">
            <OrderTracking />
          </div>
        )}
      </div>
    </div>
  );
};
