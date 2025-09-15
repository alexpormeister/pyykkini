import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart as CartIcon, Plus, Minus, Trash2, Package, Sparkles, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface CartItem {
  id: string;
  type: 'service' | 'addon' | 'bundle';
  serviceId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  metadata?: {
    rugDimensions?: {
      length: number;
      width: number;
    };
    sockColor?: string;
    sockPairs?: number;
  };
}

interface ShoppingCartProps {
  cartItems: CartItem[];
  onUpdateCart: (items: CartItem[]) => void;
  onProceedToCheckout: (items: CartItem[], total: number) => void;
  appliedCoupon?: {
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  onCouponApplied: (coupon: any) => void;
}

const bundleOffers = [
  {
    id: 'sheet-normal-bundle',
    name: 'Lakanapyykki + Normaali pesu',
    description: 'Säästä 10€ ostamalla yhdessä',
    originalPrice: 50,
    bundlePrice: 39.99,
    services: ['sheets', 'normal']
  },
  {
    id: 'shoes-normal-bundle', 
    name: 'Kenkäpesu + Normaali pesu',
    description: 'Säästä 5€ ostamalla yhdessä',
    originalPrice: 45,
    bundlePrice: 39.99,
    services: ['shoes', 'normal']
  }
];

const addonItems = [
  {
    id: 'socks-black-1',
    name: 'Mustat sukat',
    description: '1 pari laadukkaita mustia sukkia',
    price: 5,
    type: 'socks',
    options: { color: 'black', pairs: 1 }
  },
  {
    id: 'socks-white-1',
    name: 'Valkoiset sukat', 
    description: '1 pari laadukkaita valkoisia sukkia',
    price: 5,
    type: 'socks',
    options: { color: 'white', pairs: 1 }
  },
  {
    id: 'socks-black-3',
    name: 'Mustat sukat 3-pack',
    description: '3 paria mustia sukkia - säästä 20%',
    price: 12,
    type: 'socks',
    options: { color: 'black', pairs: 3 }
  },
  {
    id: 'socks-white-3',
    name: 'Valkoiset sukat 3-pack',
    description: '3 paria valkoisia sukkia - säästä 20%',
    price: 12,
    type: 'socks',
    options: { color: 'white', pairs: 3 }
  }
];

export const ShoppingCart = ({ 
  cartItems, 
  onUpdateCart, 
  onProceedToCheckout,
  appliedCoupon,
  onCouponApplied 
}: ShoppingCartProps) => {
  const { toast } = useToast();
  const [showAddons, setShowAddons] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [rugDimensions, setRugDimensions] = useState({ length: '', width: '' });
  const [showRugDialog, setShowRugDialog] = useState(false);
  const [pendingRugItem, setPendingRugItem] = useState<CartItem | null>(null);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeItem(itemId);
      return;
    }
    
    const updatedItems = cartItems.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    );
    onUpdateCart(updatedItems);
  };

  const removeItem = (itemId: string) => {
    const updatedItems = cartItems.filter(item => item.id !== itemId);
    onUpdateCart(updatedItems);
    toast({
      title: "Tuote poistettu",
      description: "Tuote on poistettu ostoskorista"
    });
  };

  const addService = (service: any) => {
    // Check if it's a rug wash service that needs dimensions
    if (service.id === 'carpets') {
      const rugItem: CartItem = {
        id: `${service.id}-${Date.now()}`,
        type: 'service',
        serviceId: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        quantity: 1
      };
      setPendingRugItem(rugItem);
      setShowRugDialog(true);
      return;
    }

    const newItem: CartItem = {
      id: `${service.id}-${Date.now()}`,
      type: 'service',
      serviceId: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      quantity: 1
    };
    
    onUpdateCart([...cartItems, newItem]);
    toast({
      title: "Palvelu lisätty",
      description: `${service.name} lisätty ostoskoriin`
    });
  };

  const addRugWithDimensions = () => {
    if (!pendingRugItem || !rugDimensions.length || !rugDimensions.width) {
      toast({
        variant: "destructive",
        title: "Puuttuvat tiedot",
        description: "Anna maton pituus ja leveys"
      });
      return;
    }

    const rugItem = {
      ...pendingRugItem,
      metadata: {
        rugDimensions: {
          length: parseFloat(rugDimensions.length),
          width: parseFloat(rugDimensions.width)
        }
      }
    };

    onUpdateCart([...cartItems, rugItem]);
    setShowRugDialog(false);
    setPendingRugItem(null);
    setRugDimensions({ length: '', width: '' });
    
    toast({
      title: "Mattopesu lisätty",
      description: `Mattopesu (${rugDimensions.length}x${rugDimensions.width} cm) lisätty ostoskoriin`
    });
  };

  const addAddon = (addon: any) => {
    const newItem: CartItem = {
      id: `${addon.id}-${Date.now()}`,
      type: 'addon',
      serviceId: addon.id,
      name: addon.name,
      description: addon.description,
      price: addon.price,
      quantity: 1,
      metadata: {
        sockColor: addon.options.color,
        sockPairs: addon.options.pairs
      }
    };
    
    onUpdateCart([...cartItems, newItem]);
    toast({
      title: "Lisätuote lisätty",
      description: `${addon.name} lisätty ostoskoriin`
    });
  };

  const addBundle = (bundle: any) => {
    const newItem: CartItem = {
      id: `${bundle.id}-${Date.now()}`,
      type: 'bundle',
      serviceId: bundle.id,
      name: bundle.name,
      description: bundle.description,
      price: bundle.bundlePrice,
      quantity: 1
    };
    
    onUpdateCart([...cartItems, newItem]);
    toast({
      title: "Paketti lisätty",
      description: `${bundle.name} lisätty ostoskoriin`
    });
  };

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    
    const subtotal = getSubtotal();
    if (appliedCoupon.discount_type === 'percentage') {
      return subtotal * (appliedCoupon.discount_value / 100);
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const discount = getDiscountAmount();
    return Math.max(0, subtotal - discount);
  };

  if (cartItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CartIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ostoskori on tyhjä</h3>
          <p className="text-muted-foreground mb-6">Lisää palveluita aloittaaksesi tilauksen</p>
          
          <div className="space-y-3">
            <Button 
              onClick={() => setShowBundles(true)}
              className="w-full bg-gradient-fun hover:opacity-90 transition-all duration-300 hover:scale-105"
            >
              <Package className="h-4 w-4 mr-2" />
              Katso pakettitarjouksia
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowAddons(true)}
              className="w-full transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Valitse pesu
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CartIcon className="h-5 w-5" />
            Ostoskori ({cartItems.length})
          </CardTitle>
          <CardDescription>Tarkista tilauksesi ennen maksua</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold">{item.name}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                {item.metadata?.rugDimensions && (
                  <p className="text-xs text-primary">
                    Mitat: {item.metadata.rugDimensions.length}x{item.metadata.rugDimensions.width} cm
                  </p>
                )}
                {item.metadata?.sockColor && (
                  <p className="text-xs text-primary">
                    {item.metadata.sockColor === 'black' ? 'Mustat' : 'Valkoiset'} sukat - {item.metadata.sockPairs} paria
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {item.type === 'bundle' && <Badge variant="secondary" className="text-xs">Paketti</Badge>}
                  {item.type === 'addon' && <Badge variant="outline" className="text-xs">Lisä</Badge>}
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="text-right">
                  <p className="font-semibold">{(item.price * item.quantity).toFixed(2)}€</p>
                  <p className="text-xs text-muted-foreground">{item.price}€ / kpl</p>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Quick Add Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowBundles(true)}
              className="transition-all duration-300 hover:scale-105"
            >
              <Package className="h-3 w-3 mr-1" />
              Paketit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddons(true)}
              className="transition-all duration-300 hover:scale-105"
            >
              <Plus className="h-3 w-3 mr-1" />
              Lisätuotteet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between">
            <span>Välisumma:</span>
            <span>{getSubtotal().toFixed(2)}€</span>
          </div>
          
          {appliedCoupon && (
            <div className="flex justify-between text-green-600">
              <span>Alennus ({appliedCoupon.code}):</span>
              <span>-{getDiscountAmount().toFixed(2)}€</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-bold border-t pt-4">
            <span>Yhteensä:</span>
            <span className="text-primary">{getTotal().toFixed(2)}€</span>
          </div>
          
          <Button 
            onClick={() => onProceedToCheckout(cartItems, getTotal())}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            Siirry kassalle
            <Sparkles className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Bundle Offers Dialog */}
      <Dialog open={showBundles} onOpenChange={setShowBundles}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pakettitarjoukset
            </DialogTitle>
            <DialogDescription>
              Säästä rahaa ostamalla palveluja yhdessä
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4">
            {bundleOffers.map((bundle) => (
              <Card key={bundle.id} className="hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{bundle.name}</h3>
                      <p className="text-sm text-muted-foreground">{bundle.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-muted-foreground line-through">{bundle.originalPrice}€</span>
                        <span className="text-lg font-bold text-primary">{bundle.bundlePrice}€</span>
                        <Badge className="bg-green-100 text-green-800">
                          Säästä {(bundle.originalPrice - bundle.bundlePrice).toFixed(2)}€
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      onClick={() => {
                        addBundle(bundle);
                        setShowBundles(false);
                      }}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      Lisää koriin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Addon Items Dialog */}
      <Dialog open={showAddons} onOpenChange={setShowAddons}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Valitse pesu
            </DialogTitle>
            <DialogDescription>
              Valitse haluamasi pesupalvelu
            </DialogDescription>
          </DialogHeader>
          
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'normal', name: '👕 Normaali pesu', description: 'Arkivaatteiden perus pesu ja kuivaus', price: 15 },
              { id: 'shoes', name: '👟 Kenkäpesu', description: 'Erikoispesu kengille ja urheilujalkineille', price: 20 },
              { id: 'sheets', name: '🛏️ Lakanapyykki', description: 'Pesu, kuivaus ja huolellinen silitys', price: 25 },
              { id: 'carpets', name: '🧼 Mattopesu', description: 'Ammattimainen mattojen pesu ja kuivaus', price: 35 }
            ].map((service) => (
              <Card key={service.id} className="hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                    <p className="text-lg font-bold text-primary mb-3">{service.price}€</p>
                    <Button 
                      onClick={() => {
                        addService(service);
                        setShowAddons(false);
                      }}
                      className="w-full"
                      variant="outline"
                    >
                      Lisää koriin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rug Dimensions Dialog */}
      <Dialog open={showRugDialog} onOpenChange={setShowRugDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Maton mitat</DialogTitle>
            <DialogDescription>
              Anna maton pituus ja leveys senttimetreinä
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="length">Pituus (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  value={rugDimensions.length}
                  onChange={(e) => setRugDimensions(prev => ({ ...prev, length: e.target.value }))}
                  placeholder="200"
                />
              </div>
              <div>
                <Label htmlFor="width">Leveys (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={rugDimensions.width}
                  onChange={(e) => setRugDimensions(prev => ({ ...prev, width: e.target.value }))}
                  placeholder="150"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowRugDialog(false)}
                className="flex-1"
              >
                Peruuta
              </Button>
              <Button 
                onClick={addRugWithDimensions}
                className="flex-1"
              >
                Lisää koriin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};