import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Truck, Sparkles, ShieldCheck, CreditCard, Award, Send,
  WashingMachine, Car, ArrowRight, Clock, Droplets, Menu,
} from "lucide-react";
import { Bubbles } from "@/components/landing/Bubbles";
import { AppStoreBadges } from "@/components/landing/AppStoreBadges";
import { ServiceAreaChecker } from "@/components/landing/ServiceAreaChecker";
import appMockup from "@/assets/pesuni-app-mockup.png";
import pesuniLogo from "@/assets/pesuni-logo.png";

const NAV_LINKS = [
  { href: "#miten-se-toimii", label: "Miten se toimii" },
  { href: "#toiminta-alueet", label: "Toiminta-alueet" },
  { href: "#kumppanit", label: "Kumppanit & Kuljettajat" },
];

const STEPS = [
  {
    icon: ShoppingBag,
    title: "Valitse & Tilaa",
    text: "Valitse vaatteet, puvut tai kodintekstiilit ja sovi iltanouto suoraan sovelluksesta.",
  },
  {
    icon: Truck,
    title: "Kuljettaja noutaa",
    text: "Kuriiri hakee pussit kotioveltasi sovittuna aikaikkunana.",
  },
  {
    icon: Sparkles,
    title: "Toimitus puhtaana",
    text: "Ammattilaisten pesemät, viikatut ja suojatut tekstiilit takaisin 48h sisällä.",
  },
];

const TRUST = [
  { icon: Droplets, label: "100 % Pesutakuu" },
  { icon: ShieldCheck, label: "Vastuuvakuutettu kuljetus" },
  { icon: CreditCard, label: "Turvalliset Stripe & Apple Pay -maksut" },
  { icon: Award, label: "Sertifioidut paikalliset ammattipesulat" },
];

export const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSms = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Latauslinkki lähetetty 📲",
      description: `Lähetimme sovelluksen latauslinkin numeroon ${phone}.`,
    });
    setPhone("");
  };

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gradient-landing">
      {/* Navigaatio */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="#top" className="flex items-center gap-2.5">
              <img src={pesuniLogo} alt="Pesuni" className="h-9 w-auto object-contain" />
              <span className="font-fredoka text-2xl font-bold text-foreground tracking-tight">Pesuni</span>
            </a>

            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((l) => (
                <Button key={l.href} variant="ghost" size="sm" onClick={() => scrollTo(l.href)}>
                  {l.label}
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground sm:inline-flex"
                onClick={() => navigate("/auth")}
              >
                Pesulaportaali
              </Button>
              <Button variant="hero" size="sm" className="rounded-2xl" onClick={() => scrollTo("#lataa")}>
                Lataa sovellus
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Valikko"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {menuOpen && (
            <div className="flex flex-col gap-1 pb-3 md:hidden">
              {NAV_LINKS.map((l) => (
                <Button key={l.href} variant="ghost" size="sm" className="justify-start" onClick={() => scrollTo(l.href)}>
                  {l.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => navigate("/auth")}>
                Pesulaportaali
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden py-14 md:py-20">
        <Bubbles />
        <div className="container relative mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <Badge className="mb-6 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 sm:text-sm">
                🧺 Pyykkihuolto kotiovellesi Espoossa & Pääkaupunkiseudulla
              </Badge>

              <h1 className="font-fredoka text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Unohda pyykkipäivä.{" "}
                <span className="bg-gradient-hero bg-clip-text text-transparent">Tilaa pesula suoraan kotiovelle.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                Noudamme vaatteet, puvut ja matot oveltasi ja toimitamme ne pestyinä takaisin 48 tunnissa.
                Helppoa kuin ruoan tilaaminen.
              </p>

              <div id="lataa" className="mt-8 scroll-mt-24">
                <AppStoreBadges className="justify-center lg:justify-start" />

                <form onSubmit={handleSms} className="mt-5 flex flex-col gap-3 sm:flex-row sm:max-w-md">
                  <Input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Syötä puhelinnumero"
                    aria-label="Puhelinnumero"
                    className="h-12 rounded-2xl bg-card/80"
                  />
                  <Button type="submit" variant="hero" className="h-12 shrink-0 rounded-2xl">
                    <Send className="mr-2 h-4 w-4" />
                    Lähetä latauslinkki
                  </Button>
                </form>

                <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
                  <Clock className="h-3.5 w-3.5" /> Iltanoudot samana päivänä · Toimitus 48 h
                </p>
              </div>
            </div>

            <div className="relative flex justify-center">
              <div className="absolute inset-0 -z-10 bg-gradient-radial blur-2xl" aria-hidden />
              <img
                src={appMockup}
                alt="Pesuni-sovellus näyttää tilauksen reaaliaikaisen seurannan"
                width={912}
                height={1200}
                className="animate-float w-[260px] drop-shadow-2xl sm:w-[320px] lg:w-[380px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Miten se toimii */}
      <section id="miten-se-toimii" className="scroll-mt-20 border-y border-primary/10 bg-background/60 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-fredoka text-3xl text-foreground sm:text-4xl">Miten Pesuni toimii?</h2>
            <p className="mt-4 text-muted-foreground">Kolme askelta puhtaisiin tekstiileihin – ilman pesukonetta.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Card
                key={s.title}
                className="group rounded-[1.25rem] border-primary/15 bg-card/80 p-7 shadow-elegant backdrop-blur-md transition-transform hover:-translate-y-1"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-fun">
                    <s.icon className="h-6 w-6 text-primary-foreground" />
                  </span>
                  <span className="font-fredoka text-3xl text-primary/20">0{i + 1}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Toiminta-alueet */}
      <section id="toiminta-alueet" className="relative scroll-mt-20 overflow-hidden py-16 md:py-24">
        <Bubbles className="opacity-60" />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-fredoka text-3xl text-foreground sm:text-4xl">Toimimmeko jo alueellasi?</h2>
            <p className="mt-4 text-muted-foreground">
              Kirjoita kaupunginosa tai postinumero ja tarkista toimituksen saatavuus heti.
            </p>
          </div>
          <ServiceAreaChecker />
        </div>
      </section>

      {/* Luottamus */}
      <section className="border-y border-primary/10 bg-background/60 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-3 rounded-[1.25rem] border border-primary/15 bg-card/70 p-4 backdrop-blur-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <t.icon className="h-5 w-5 text-primary" />
                </span>
                <span className="text-sm font-medium text-foreground">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kumppanit & kuljettajat */}
      <section id="kumppanit" className="scroll-mt-20 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-fredoka text-3xl text-foreground sm:text-4xl">Kasva Pesunin kanssa</h2>
            <p className="mt-4 text-muted-foreground">Etsimme jatkuvasti uusia pesulakumppaneita ja kuljettajia.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[1.25rem] border-primary/15 bg-card/80 p-8 shadow-elegant backdrop-blur-md">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-fun">
                <WashingMachine className="h-6 w-6 text-primary-foreground" />
              </span>
              <h3 className="mb-3 text-xl font-semibold text-foreground">Oletko pesulayrittäjä?</h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Kasvata myyntiäsi ja täytä kapasiteettisi Pesunin kautta ilman kiinteitä kuluja.
              </p>
              <Button variant="hero" className="rounded-2xl" asChild>
                <a href="mailto:kumppanit@pesuni.fi?subject=Pesulakumppanuus">
                  Liity pesulakumppaniksi <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </Card>

            <Card className="rounded-[1.25rem] border-primary/15 bg-card/80 p-8 shadow-elegant backdrop-blur-md">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-fun">
                <Car className="h-6 w-6 text-primary-foreground" />
              </span>
              <h3 className="mb-3 text-xl font-semibold text-foreground">Aja lisätuloja</h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Aja lisätuloja omalla aikataulullasi. Hae Pesunin kevytyrittäjäkuljettajaksi.
              </p>
              <Button variant="outline" className="rounded-2xl" asChild>
                <a href="mailto:kuljettajat@pesuni.fi?subject=Kuljettajahakemus">
                  Hae kuljettajaksi <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-background/80 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-primary">
                  <Droplets className="h-5 w-5 text-primary-foreground" />
                </span>
                <span className="font-fredoka text-xl text-foreground">Pesuni</span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Pyykkihuolto kotiovellesi. Noudamme, pesemme ja palautamme tekstiilisi 48 tunnissa –
                yhteistyössä paikallisten ammattipesuloiden kanssa.
              </p>
              <AppStoreBadges size="sm" className="mt-6" />
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Tietoa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/tietosuoja" className="hover:text-primary">Tietosuoja</a></li>
                <li><a href="/kayttoehdot" className="hover:text-primary">Käyttöehdot</a></li>
                <li><a href="#miten-se-toimii" className="hover:text-primary">UKK</a></li>
                <li><a href="mailto:asiakaspalvelu@pesuni.fi" className="hover:text-primary">Ota yhteyttä</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Yritys</h4>
              <p className="text-sm text-muted-foreground">
                Pesuni<br />Espoo, Finland<br />
                <a href="mailto:asiakaspalvelu@pesuni.fi" className="hover:text-primary">asiakaspalvelu@pesuni.fi</a>
              </p>
              <Button variant="ghost" size="sm" className="mt-4 px-0 text-muted-foreground" onClick={() => navigate("/auth")}>
                Pesulaportaali & henkilöstön kirjautuminen
              </Button>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Pesuni. Kaikki oikeudet pidätetään.
          </div>
        </div>
      </footer>
    </div>
  );
};
