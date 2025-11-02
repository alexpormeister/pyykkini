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
    <div className="min-h-screen bg-gradient-landing">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b border-primary/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <img
                src="/lovable-uploads/08c6977a-49b1-49fc-84e2-ffb8957e8f41.png"
                alt="Pesuni"
                className="h-8 w-auto object-contain"
              />
            </div>

            <div className="flex items-center space-x-3">
              {!user && (
                <>
                  <Button variant="ghost" size="sm" className="btn-bounce-hover" onClick={() => navigate('/auth')}>
                    Kirjaudu sisään
                  </Button>
                  <Button variant="hero" size="sm" className="btn-bounce-hover" onClick={() => navigate('/auth')}>
                    Rekisteröidy
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="animate-fade-in">
              <h1 className="font-fredoka text-5xl md:text-7xl lg:text-8xl font-bold mb-6 text-foreground leading-none tracking-tight">
                PUHTAAT PYYKIT
              </h1>
              <div className="text-2xl md:text-4xl lg:text-5xl font-fredoka font-bold mb-8 text-primary">
                YHDELLÄ TILAUKSELLA KAAPPI PUHTAAKSI.
              </div>

              <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
                Tilaa ammattimainen pesupalvelu kotiin. Sinun ei tarvitse tehdä muuta kuin nauttia vapaa-ajastasi.
              </p>

              <div className="mb-12">
                <Button
                  variant="hero"
                  size="lg"
                  className="text-xl px-12 py-6 h-auto font-fredoka font-bold btn-glow-hover"
                  onClick={() => !user && navigate('/auth')}
                >
                  {user ? 'TILAA PESU' : 'ALOITA NYT'}
                </Button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 md:py-24 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 md:mb-16 animate-fade-in">
            <h2 className="font-fredoka text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Valitse palvelusi
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Kaikki hinnat sisältävät noutoa ja palautuksen. Ei piilokustannuksia!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card
                  key={service.id}
                  className="group cursor-pointer transition-all duration-300 hover:shadow-fun hover:scale-105 animate-fade-in border-2 hover:border-primary/30 bg-card/70 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="text-center pb-4">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-fun rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow group-hover:animate-wiggle">
                      <Icon className="h-10 w-10 text-white" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-fredoka">{service.name}</CardTitle>
                    <CardDescription className="text-base">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl md:text-4xl font-fredoka font-bold text-primary mb-2">
                        {service.price}€
                      </div>
                      <Badge variant="secondary" className="text-sm font-semibold">
                        ⏱️ {service.duration}
                      </Badge>
                    </div>

                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full font-fredoka font-bold text-lg btn-bounce-hover h-12"
                      onClick={() => handleOrderNow(service)}
                    >
                      TILAA NYT
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary/90 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <img
                  src="/lovable-uploads/08c6977a-49b1-49fc-84e2-ffb8957e8f41.png"
                  alt="Pesuni"
                  className="h-10 w-auto object-contain brightness-0 invert"
                />
              </div>
              <p className="text-white/90 text-lg">
                Ammattimasta pesupalvelu kotiin. Nouto ja palautus sisältyy hintaan.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-fredoka font-bold text-xl">Yhteystiedot</h4>
              <div className="space-y-3 text-white/90">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg">+358 40 123 4567</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5" />
                  <span className="text-lg">tilaukset@pesuni.fi</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5" />
                  <span className="text-lg">02770 Espoo</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-fredoka font-bold text-xl">Palvelu</h4>
              <div className="text-white/90 text-lg space-y-2">
                <p>Ammattimasta pesupalvelu kotiin.</p>
                <p>Nouto ja palautus sisältyy hintaan.</p>
                <p className="font-bold text-secondary">100% tyytyväisyystakuu!</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 mt-8 pt-8 text-center text-white/70">
            <p className="text-lg">&copy; 2025 Pesuni. Kaikki oikeudet pidätetään.</p>
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