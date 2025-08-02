import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, Shirt, Sparkles, Zap, Star, CheckCircle, Package, Truck, ArrowRight } from "lucide-react";
import { CheckoutForm } from "./CheckoutForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  duration: string;
}

const services: Service[] = [
  {
    id: 'normal',
    name: 'Normaali pesu',
    description: 'Arkivaatteiden perus pesu ja kuivaus',
    price: 15,
    icon: Shirt,
    duration: '24-48h'
  },
  {
    id: 'shoes',
    name: 'Kenkäpesu',
    description: 'Erikoispesu kengille ja urheilujalkineille',
    price: 20,
    icon: Sparkles,
    duration: '48h'
  },
  {
    id: 'sheets',
    name: 'Lakanapyykki',
    description: 'Pesu, kuivaus ja huolellinen silitys',
    price: 25,
    icon: Zap,
    duration: '48-72h'
  },
  {
    id: 'carpets',
    name: 'Mattopesu',
    description: 'Ammattimainen mattojen pesu ja kuivaus',
    price: 35,
    icon: Star,
    duration: '72h'
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return Clock;
    case 'accepted': return CheckCircle;
    case 'picking_up': return Truck;
    case 'washing': return Sparkles;
    case 'returning': return Truck;
    case 'delivered': return Package;
    default: return Clock;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Odottaa hyväksyntää';
    case 'accepted': return 'Hyväksytty';
    case 'picking_up': return 'Noutamassa';
    case 'washing': return 'Pesussa';
    case 'returning': return 'Palautumassa';
    case 'delivered': return 'Toimitettu';
    case 'rejected': return 'Hylätty';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'accepted': return 'bg-blue-100 text-blue-800';
    case 'picking_up': return 'bg-purple-100 text-purple-800';
    case 'washing': return 'bg-cyan-100 text-cyan-800';
    case 'returning': return 'bg-orange-100 text-orange-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const CustomerPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentView, setCurrentView] = useState<'services' | 'booking' | 'orders'>('services');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentView === 'orders' && user) {
      fetchOrders();
    }
  }, [currentView, user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilausten lataaminen epäonnistui."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  const handleOrderNow = () => {
    setShowServiceModal(false);
    setCurrentView('booking');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Vaatepesupalvelu helposti
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Tilaa pesupalvelu kotiin - me noudamme, pesemme ja tuomme takaisin puhtaana
          </p>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button 
              variant={currentView === 'services' ? 'hero' : 'outline'} 
              size="lg"
              onClick={() => setCurrentView('services')}
              className="flex items-center gap-2"
            >
              <Shirt className="h-5 w-5" />
              Tilaa palvelu
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

        {/* Services View */}
        {currentView === 'services' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-center">Valitse palvelu</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <Card 
                    key={service.id} 
                    className="cursor-pointer transition-all duration-300 hover:shadow-elegant hover:scale-105 group"
                    onClick={() => handleServiceSelect(service)}
                  >
                    <CardHeader className="text-center">
                      <Icon className="h-12 w-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription className="text-sm">{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-primary mb-2">
                        {service.price}€
                      </div>
                      <Badge variant="secondary" className="text-xs mb-4">
                        {service.duration}
                      </Badge>
                      <Button 
                        variant="hero" 
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServiceSelect(service);
                        }}
                      >
                        Tilaa nyt
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Service Selection Modal */}
        <Dialog open={showServiceModal} onOpenChange={setShowServiceModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedService && <selectedService.icon className="h-6 w-6 text-primary" />}
                {selectedService?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedService?.description}
              </DialogDescription>
            </DialogHeader>
            
            {selectedService && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">
                    {selectedService.price}€
                  </div>
                  <Badge variant="secondary">
                    Toimitusaika: {selectedService.duration}
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Palveluun sisältyy:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Nouto kotoa sovittuna aikana
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Ammattimasta pesu
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Palautus kotiin puhtaana
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      SMS-päivitykset tilauksesta
                    </li>
                  </ul>
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowServiceModal(false)}
                  >
                    Peruuta
                  </Button>
                  <Button 
                    variant="hero" 
                    className="flex-1"
                    onClick={handleOrderNow}
                  >
                    Jatka tilaukseen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Booking/Checkout View */}
        {currentView === 'booking' && selectedService && (
          <CheckoutForm 
            selectedService={selectedService}
            onBack={() => {
              setCurrentView('services');
              setShowServiceModal(false);
            }}
            onSuccess={() => {
              setSelectedService(null);
              setCurrentView('orders');
              fetchOrders();
            }}
          />
        )}

        {/* Orders View */}
        {currentView === 'orders' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-center">Omat tilaukset</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Ladataan tilauksia...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ei tilauksia</h3>
                <p className="text-muted-foreground mb-6">Et ole tehnyt vielä yhtään tilausta.</p>
                <Button 
                  variant="hero"
                  onClick={() => setCurrentView('services')}
                >
                  Tee ensimmäinen tilaus
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {orders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  return (
                    <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                              <StatusIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{order.service_name}</h3>
                              <p className="text-sm text-muted-foreground">Tilaus #{order.id.slice(0, 8)}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString('fi-FI')}
                              </p>
                              {order.discount_code && (
                                <p className="text-sm text-green-600">Alennuskoodi: {order.discount_code}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusText(order.status)}
                            </Badge>
                            <div className="mt-2">
                              {order.discount_code && order.final_price !== order.price && (
                                <p className="text-sm text-muted-foreground line-through">{order.price}€</p>
                              )}
                              <p className="text-lg font-semibold">{order.final_price}€</p>
                            </div>
                          </div>
                        </div>
                        
                        {order.status !== 'pending' && order.status !== 'rejected' && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Nouto:</p>
                                <p className="font-medium">
                                  {new Date(order.pickup_date).toLocaleDateString('fi-FI')} klo {order.pickup_time}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Palautus:</p>
                                <p className="font-medium">
                                  {new Date(order.return_date).toLocaleDateString('fi-FI')} klo {order.return_time}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};