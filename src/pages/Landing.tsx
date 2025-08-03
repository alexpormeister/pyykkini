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
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-background"></div>
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="animate-fade-in text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent leading-tight">
                Pesupalvelu
                <br />
                kotiin <span className="text-primary">helposti</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Tilaa ammattimainen pesupalvelu kotiin. Me noudamme, pesemme ja tuomme 
                takaisin puhtaana - sinun ei tarvitse tehdä muuta kuin nauttia vapaa-ajastasi.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center lg:justify-start">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Nouto ja palautus sisältyy</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center lg:justify-start">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Ammattilaispesu</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center lg:justify-start">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Nopea toimitus</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="text-lg px-8 py-4 h-auto shadow-glow hover:shadow-fun transition-all duration-300"
                  onClick={() => {
                    const servicesSection = document.getElementById('services');
                    servicesSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Tutustu palveluihin
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="text-lg px-8 py-4 h-auto border-primary/20 hover:bg-primary/5"
                  onClick={() => !user && navigate('/auth')}
                >
                  {user ? 'Tilaa nyt' : 'Aloita tästä'}
                </Button>
              </div>
            </div>
            
            <div className="relative animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-transparent rounded-full blur-3xl"></div>
                <img 
                  src="/lovable-uploads/a58faa00-8b99-4e66-aaee-2e31a0d5b94c.png" 
                  alt="Vaatepesupalvelu maskotti" 
                  className="w-full max-w-sm lg:max-w-md mx-auto object-contain drop-shadow-2xl relative z-10"
                />
                <div className="absolute -top-4 -right-4 bg-gradient-primary text-white px-4 py-2 rounded-full text-sm font-semibold shadow-glow animate-pulse">
                  ⚡ Kätevästi kotiin!
                </div>
                <div className="absolute -bottom-2 -left-4 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-medium shadow-fun">
                  🚚 Nopea toimitus
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 md:mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Palvelumme
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Valitse sopiva palvelu tarpeisiisi. Kaikki hinnat sisältävät noutoa ja palautuksen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card 
                  key={service.id} 
                  className="group cursor-pointer transition-all duration-300 hover:shadow-fun hover:scale-105 animate-fade-in border-2 hover:border-primary/20"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-lg md:text-xl">{service.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-2">
                        {service.price}€
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        ⏱️ {service.duration}
                      </Badge>
                    </div>
                    
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      variant="hero" 
                      className="w-full group-hover:shadow-glow transition-all duration-300"
                      onClick={() => handleOrderNow(service)}
                    >
                      Tilaa nyt
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">Tarvitsetko räätälöityä palvelua?</p>
            <Button variant="outline" size="lg" className="border-primary/20 hover:bg-primary/5">
              Ota yhteyttä
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 bg-gradient-subtle">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Näin se toimii
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Yksinkertainen ja nopea prosessi - sinun ei tarvitse poistua kotoasi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "1",
                title: "Tilaa netistä",
                description: "Valitse palvelu ja sovita noutoa aika helposti verkossa",
                icon: "📱",
                color: "from-blue-500 to-blue-600"
              },
              {
                step: "2", 
                title: "Me noudamme",
                description: "Kuljettajamme noutaa pyykkisi sovittuna aikana kotioveltasi",
                icon: "🚚",
                color: "from-green-500 to-green-600"
              },
              {
                step: "3",
                title: "Pesemme ja palautamme",
                description: "Ammattilainen pesee huolellisesti ja palauttaa puhtaana kotiin",
                icon: "✨",
                color: "from-purple-500 to-purple-600"
              }
            ].map((item, index) => (
              <div key={index} className="text-center animate-fade-in relative" style={{ animationDelay: `${index * 0.2}s` }}>
                <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-r ${item.color} rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-glow relative`}>
                  {item.step}
                  <div className="absolute -top-2 -right-2 text-2xl">
                    {item.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                
                {/* Connection arrow for desktop */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 left-full w-8 h-0.5 bg-gradient-to-r from-primary to-transparent transform -translate-y-1/2 z-10">
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-primary border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button 
              variant="hero" 
              size="lg" 
              className="shadow-glow hover:shadow-fun transition-all duration-300"
              onClick={() => !user && navigate('/auth')}
            >
              Aloita tilaaminen
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
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