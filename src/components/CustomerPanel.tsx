import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Shirt, Sparkles, Zap, Star, CheckCircle, Package, Truck } from "lucide-react";
import { CheckoutForm } from "./CheckoutForm";

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

const mockOrders = [
  {
    id: '001',
    service: 'Normaali pesu',
    status: 'delivered',
    date: '2024-01-15',
    price: 15
  },
  {
    id: '002',
    service: 'Kenkäpesu',
    status: 'washing',
    date: '2024-01-18',
    price: 20
  },
  {
    id: '003',
    service: 'Lakanapyykki',
    status: 'ready',
    date: '2024-01-20',
    price: 25
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return Clock;
    case 'washing': return Sparkles;
    case 'ready': return CheckCircle;
    case 'delivered': return Package;
    default: return Clock;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Odottaa noutoa';
    case 'washing': return 'Pesussa';
    case 'ready': return 'Valmis';
    case 'delivered': return 'Toimitettu';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'washing': return 'bg-blue-100 text-blue-800';
    case 'ready': return 'bg-green-100 text-green-800';
    case 'delivered': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const CustomerPanel = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentView, setCurrentView] = useState<'services' | 'booking' | 'orders'>('services');

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
                    className={`cursor-pointer transition-all duration-300 hover:shadow-elegant hover:scale-105 ${
                      selectedService?.id === service.id ? 'ring-2 ring-primary shadow-glow' : ''
                    }`}
                    onClick={() => setSelectedService(service)}
                  >
                    <CardHeader className="text-center">
                      <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription className="text-sm">{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-primary mb-2">
                        {service.price}€
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {service.duration}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedService && (
              <Card className="animate-scale-in shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <selectedService.icon className="h-6 w-6 text-primary" />
                    {selectedService.name} - {selectedService.price}€
                  </CardTitle>
                  <CardDescription>{selectedService.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Valitse noutopäivä
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'].map((day) => (
                          <Button key={day} variant="outline" size="sm">
                            {day}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4">
                        <h5 className="font-medium mb-2">Noutoa aika</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm">9:00-12:00</Button>
                          <Button variant="outline" size="sm">13:00-16:00</Button>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Valitse palautuspäivä
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'].map((day) => (
                          <Button key={day} variant="outline" size="sm">
                            {day}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4">
                        <h5 className="font-medium mb-2">Palautus aika</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm">9:00-12:00</Button>
                          <Button variant="outline" size="sm">13:00-16:00</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Arvioitu kokonaishinta:</span>
                      <span className="text-2xl font-bold text-primary">{selectedService.price}€</span>
                    </div>
                    <Button 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      onClick={() => setCurrentView('booking')}
                    >
                      Jatka tilaukseen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Booking/Checkout View */}
        {currentView === 'booking' && selectedService && (
          <CheckoutForm 
            selectedService={selectedService}
            onBack={() => setCurrentView('services')}
          />
        )}

        {/* Orders View */}
        {currentView === 'orders' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-center">Omat tilaukset</h2>
            <div className="space-y-4 max-w-2xl mx-auto">
              {mockOrders.map((order) => {
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
                            <h3 className="font-semibold">{order.service}</h3>
                            <p className="text-sm text-muted-foreground">Tilaus #{order.id}</p>
                            <p className="text-sm text-muted-foreground">{order.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                          <p className="text-lg font-semibold mt-2">{order.price}€</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};