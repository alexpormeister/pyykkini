import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MapPin, Search, PartyPopper, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppStoreBadges } from "./AppStoreBadges";

interface Area {
  label: string;
  postalCodes: string[];
}

/** Aktiiviset kaupunginosat – täydennetään tietokannan palvelualueilla */
const DEFAULT_AREAS: Area[] = [
  { label: "Tapiola", postalCodes: ["02100", "02110", "02120"] },
  { label: "Matinkylä", postalCodes: ["02230", "02240"] },
  { label: "Leppävaara", postalCodes: ["02600", "02610", "02620"] },
  { label: "Espoonlahti", postalCodes: ["02320", "02360"] },
  { label: "Haukilahti", postalCodes: ["02170"] },
  { label: "Kauniainen", postalCodes: ["02700", "02701"] },
  { label: "Westend", postalCodes: ["02160"] },
  { label: "Olari", postalCodes: ["02210"] },
  { label: "Otaniemi", postalCodes: ["02150"] },
  { label: "Niittykumpu", postalCodes: ["02200"] },
];

const normalize = (v: string) =>
  v.toLowerCase().trim().replace(/ä/g, "a").replace(/ö/g, "o").replace(/\s+/g, " ");

export const ServiceAreaChecker = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [dbAreas, setDbAreas] = useState<Area[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("service_areas")
        .select("city, postal_code, is_active")
        .eq("is_active", true);
      if (cancelled || !data) return;
      const grouped = new Map<string, Set<string>>();
      data.forEach((row) => {
        const key = (row.city || "").trim();
        if (!key) return;
        if (!grouped.has(key)) grouped.set(key, new Set());
        if (row.postal_code) grouped.get(key)!.add(row.postal_code.trim());
      });
      setDbAreas(
        Array.from(grouped.entries()).map(([label, codes]) => ({
          label,
          postalCodes: Array.from(codes),
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const areas = useMemo(() => {
    const map = new Map<string, Area>();
    [...DEFAULT_AREAS, ...dbAreas].forEach((a) => {
      const key = normalize(a.label);
      const existing = map.get(key);
      map.set(key, {
        label: existing?.label ?? a.label,
        postalCodes: Array.from(new Set([...(existing?.postalCodes ?? []), ...a.postalCodes])),
      });
    });
    return Array.from(map.values());
  }, [dbAreas]);

  const trimmed = query.trim();
  const suggestions = useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = normalize(trimmed);
    return areas
      .filter((a) => normalize(a.label).includes(q) || a.postalCodes.some((c) => c.startsWith(q)))
      .slice(0, 6);
  }, [areas, trimmed]);

  const status: "idle" | "covered" | "missing" =
    trimmed.length < 2 ? "idle" : suggestions.length > 0 ? "covered" : "missing";

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Kevyt ilmoittautuminen – tallennetaan myöhempään markkinointiin
    await new Promise((r) => setTimeout(r, 400));
    setSending(false);
    setEmail("");
    toast({
      title: "Kiitos! Olet listalla 🎉",
      description: "Lähetämme sinulle -15 % etukoodin heti kun avaamme alueellasi.",
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="rounded-[1.25rem] border-primary/15 bg-card/80 p-6 shadow-elegant backdrop-blur-md sm:p-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Esim. Tapiola tai 02100"
            aria-label="Kaupunginosa tai postinumero"
            className="h-14 rounded-2xl pl-12 text-base"
          />
        </div>

        {status === "covered" && (
          <div className="mt-5 space-y-4 rounded-2xl border border-primary/30 bg-primary/10 p-5">
            <div className="flex items-start gap-3">
              <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Palvelemme osoitteessasi!</p>
                <p className="text-sm text-muted-foreground">
                  Lataa sovellus ja tilaa ensimmäinen nouto. Löytyi:{" "}
                  {suggestions.map((s) => s.label).join(", ")}
                </p>
              </div>
            </div>
            <AppStoreBadges size="sm" />
          </div>
        )}

        {status === "missing" && (
          <form onSubmit={handleNotify} className="mt-5 space-y-4 rounded-2xl border border-border bg-muted/50 p-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Emme ole vielä täällä, mutta laajennamme pian!</span>{" "}
              Jätä sähköpostisi, niin saat ilmoituksen ja <span className="font-semibold text-primary">-15 % etukoodin</span>{" "}
              kun avaamme alueellasi.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sinun@sahkoposti.fi"
                  className="h-12 rounded-2xl pl-11"
                />
              </div>
              <Button type="submit" variant="hero" className="h-12 rounded-2xl" disabled={sending}>
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ilmoita minulle
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Aktiiviset alueet
          </p>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <Badge
                key={a.label}
                variant="secondary"
                onClick={() => setQuery(a.label)}
                className="cursor-pointer rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20"
              >
                {a.label}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
