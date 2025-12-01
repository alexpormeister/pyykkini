import { useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const ProductCatalog = lazy(() => import("@/components/ProductCatalog").then(module => ({ default: module.ProductCatalog })));


export const Landing = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAddToCart = () => {
    toast({
      title: "Kirjaudu sisään",
      description: "Sinun täytyy kirjautua sisään voidaksesi lisätä tuotteita ostoskoriin.",
    });
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
                  <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                    Kirjaudu sisään
                  </Button>
                  <Button variant="hero" size="sm" onClick={() => navigate('/auth')}>
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
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto">
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
                className="text-xl px-12 py-6 h-auto font-fredoka font-bold"
                onClick={() => !user && navigate('/auth')}
              >
                {user ? 'TILAA PESU' : 'ALOITA NYT'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="services" className="py-16 md:py-24 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-fredoka text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Valitse palvelusi
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Kaikki hinnat sisältävät noutoa ja palautuksen. Ei piilokustannuksia!
            </p>
          </div>

          <Suspense fallback={
            <div className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-96 rounded-lg" />
                ))}
              </div>
            </div>
          }>
            <ProductCatalog
              onAddToCart={handleAddToCart}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onSearchChange={setSearchQuery}
              onCategoryChange={setSelectedCategory}
            />
          </Suspense>
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

    </div>
  );
};