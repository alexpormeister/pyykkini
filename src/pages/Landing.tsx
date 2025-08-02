import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shirt, Sparkles, Zap, Star, CheckCircle, ArrowRight, Truck, Clock, Phone, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  duration: string;
  features: string[];
}

const services: Service[] = [
  {
    id: 'normal',
    name: 'Normaali pesu',
    description: 'Arkivaatteiden perus pesu ja kuivaus',
    price: 15,
    icon: Shirt,
    duration: '24-48h',
    features: ['Pesu 40°C', 'Kuivaus', 'Taittelua', 'Nouto ja palautus']
  },
  {
    id: 'shoes',
    name: 'Kenkäpesu',
    description: 'Erikoispesu kengille ja urheilujalkineille',
    price: 20,
    icon: Sparkles,
    duration: '48h',
    features: ['Syvä puhdistus', 'Hajunpoisto', 'Suojaus', 'Nouto ja palautus']
  },
  {
    id: 'sheets',
    name: 'Lakanapyykki',
    description: 'Pesu, kuivaus ja huolellinen silitys',
    price: 25,
    icon: Zap,
    duration: '48-72h',
    features: ['Korkeatehopesu', 'Silitys', 'Taittelua', 'Nouto ja palautus']
  },
  {
    id: 'carpets',
    name: 'Mattopesu',
    description: 'Ammattimainen mattojen pesu ja kuivaus',
    price: 35,
    icon: Star,
    duration: '72h',
    features: ['Ammattipesu', 'Kuivaus', 'Hajunpoisto', 'Nouto ja palautus']
  }
];

export const Landing = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleOrderNow = (service: Service) => {
    if (user) {
      // Automatically redirect to app if logged in
      navigate('/app');
    } else {
      setSelectedService(service);
      setShowLoginDialog(true);
    }
  };

  const handleLoginRedirect = () => {
    setShowLoginDialog(false);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/a58faa00-8b99-4e66-aaee-2e31a0d5b94c.png" 
                alt="Maskotti" 
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Pesuni
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {!user && (
                <>
                  <Button variant="ghost" onClick={() => navigate('/auth')}>
                    Kirjaudu sisään
                  </Button>
                  <Button variant="hero" onClick={() => navigate('/auth')}>
                    Rekisteröidy
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent leading-tight">
                Pesupalvelu
                <br />
                kotiin helposti
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Tilaa ammattimainen pesupalvelu kotiin. Me noudamme, pesemme ja tuomme 
                takaisin puhtaana - sinun ei tarvitse tehdä muuta kuin nauttia vapaa-ajastasi.
              </p>
              
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Nouto ja palautus sisältyy
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Ammattilaispesu
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Nopea toimitus
                </div>
              </div>
              
              <Button 
                variant="hero" 
                size="lg" 
                className="text-lg px-8 py-6 h-auto"
                onClick={() => {
                  const servicesSection = document.getElementById('services');
                  servicesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Tutustu palveluihin
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
            
            <div className="relative animate-scale-in">
              <div className="relative">
                <img 
                  src="/lovable-uploads/a58faa00-8b99-4e66-aaee-2e31a0d5b94c.png" 
                  alt="Vaatepesupalvelu maskotti" 
                  className="w-full max-w-md mx-auto object-contain drop-shadow-2xl"
                />
                <div className="absolute -top-4 -right-4 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-semibold shadow-fun">
                  Kätevästi kotiin!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Palvelumme
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Valitse sopiva palvelu tarpeisiisi. Kaikki hinnat sisältävät noutoa ja palautuksen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card 
                  key={service.id} 
                  className="group cursor-pointer transition-all duration-300 hover:shadow-fun hover:scale-105 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-xl">{service.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {service.price}€
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {service.duration}
                      </Badge>
                    </div>
                    
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      variant="hero" 
                      className="w-full"
                      onClick={() => handleOrderNow(service)}
                    >
                      Tilaa nyt
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gradient-subtle">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Näin se toimii
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Yksinkertainen ja nopea prosessi - sinun ei tarvitse poistua kotoasi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Tilaa netistä",
                description: "Valitse palvelu ja sovita noutoa aika",
                icon: Phone
              },
              {
                step: "2", 
                title: "Me noudamme",
                description: "Kuljettajamme noutaa pyykkisi sovittuna aikana",
                icon: Truck
              },
              {
                step: "3",
                title: "Pesemme ja palautamme",
                description: "Ammattilainen pesee ja palauttaa puhtaana",
                icon: Sparkles
              }
            ].map((item, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${index * 0.2}s` }}>
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-primary rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-glow">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <img 
                  src="/lovable-uploads/a58faa00-8b99-4e66-aaee-2e31a0d5b94c.png" 
                  alt="Maskotti" 
                  className="h-8 w-8 object-contain brightness-0 invert"
                />
                <h3 className="text-lg font-bold">Pesuni</h3>
              </div>
              <p className="text-background/80">
                Ammattimasta pesupalvelu kotiin. Nouto ja palautus sisältyy hintaan.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Yhteystiedot</h4>
              <div className="space-y-2 text-background/80">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>+358 40 123 4567</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>tilaukset@vaatepesupalvelu.fi</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Vantaa</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Palvelu</h4>
              <div className="text-background/80">
                <p>Ammattimasta pesupalvelu kotiin.</p>
                <p>Nouto ja palautus sisältyy hintaan.</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-background/20 mt-8 pt-8 text-center text-background/60">
            <p>&copy; 2024 Pesuni. Kaikki oikeudet pidätetään.</p>
          </div>
        </div>
      </footer>

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Kirjaudu sisään jatkaaksesi</DialogTitle>
            <DialogDescription className="text-center">
              Sinun täytyy kirjautua sisään tai rekisteröityä voidaksesi tilata palvelun.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <Button 
              variant="hero" 
              className="w-full"
              onClick={handleLoginRedirect}
            >
              Kirjaudu sisään tai rekisteröidy
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowLoginDialog(false)}
            >
              Peruuta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};