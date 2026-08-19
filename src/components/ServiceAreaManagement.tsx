import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, MapPin, Plus, Search, Trash2, Loader2 } from "lucide-react";

const WEEKDAYS = [
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
  "Lauantai",
  "Sunnuntai",
] as const;

const DEFAULT_CITIES = ["Helsinki", "Espoo", "Vantaa", "Kauniainen", "Kirkkonummi"];

interface ServiceArea {
  id: string;
  city: string;
  postal_code: string | null;
  is_active: boolean;
  delivery_fee: number;
  delivery_days: string[];
  notes: string | null;
}

export const ServiceAreaManagement = () => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    city: "",
    postal_code: "",
    delivery_fee: "0.00",
    notes: "",
    delivery_days: WEEKDAYS.slice(0, 5) as unknown as string[],
  });

  const fetchAreas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_areas")
      .select("id, city, postal_code, is_active, delivery_fee, delivery_days, notes")
      .order("city", { ascending: true })
      .order("postal_code", { ascending: true, nullsFirst: true });

    if (error) {
      toast({ title: "Virhe", description: "Palvelualueiden lataus epäonnistui.", variant: "destructive" });
    } else {
      setAreas(
        (data || []).map((a) => ({
          ...a,
          delivery_fee: Number(a.delivery_fee ?? 0),
          delivery_days: a.delivery_days ?? [],
        })) as ServiceArea[]
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const updateArea = async (id: string, patch: Partial<ServiceArea>, silent = false) => {
    setSavingId(id);
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("service_areas").update(patch).eq("id", id);
    setSavingId(null);

    if (error) {
      toast({ title: "Tallennus epäonnistui", description: error.message, variant: "destructive" });
      fetchAreas();
      return;
    }
    if (!silent) {
      toast({ title: "Tallennettu", description: "Muutokset tallennettiin onnistuneesti." });
    }
  };

  const deleteArea = async (area: ServiceArea) => {
    const { error } = await supabase.from("service_areas").delete().eq("id", area.id);
    if (error) {
      toast({ title: "Poisto epäonnistui", description: error.message, variant: "destructive" });
      return;
    }
    setAreas((prev) => prev.filter((a) => a.id !== area.id));
    toast({ title: "Poistettu", description: `${area.city}${area.postal_code ? ` ${area.postal_code}` : ""} poistettiin.` });
  };

  const createArea = async () => {
    const city = form.city.trim();
    const postal = form.postal_code.trim();

    if (!city) {
      toast({ title: "Puuttuva tieto", description: "Anna kunnan nimi.", variant: "destructive" });
      return;
    }
    if (postal && !/^\d{5}$/.test(postal)) {
      toast({ title: "Virheellinen postinumero", description: "Postinumeron tulee olla 5 numeroa.", variant: "destructive" });
      return;
    }
    const fee = Number(form.delivery_fee.replace(",", "."));
    if (Number.isNaN(fee) || fee < 0 || fee > 1000) {
      toast({ title: "Virheellinen maksu", description: "Toimitusmaksun tulee olla 0–1000 €.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("service_areas").insert({
      city,
      postal_code: postal || null,
      delivery_fee: fee,
      delivery_days: form.delivery_days,
      notes: form.notes.trim() ? form.notes.trim().slice(0, 500) : null,
      is_active: true,
    });
    setCreating(false);

    if (error) {
      toast({
        title: "Lisäys epäonnistui",
        description: error.code === "23505" ? "Tämä kunta tai postinumero on jo listalla." : error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Lisätty", description: `${city}${postal ? ` (${postal})` : ""} lisättiin palvelualueisiin.` });
    setDialogOpen(false);
    setForm({ city: "", postal_code: "", delivery_fee: "0.00", notes: "", delivery_days: WEEKDAYS.slice(0, 5) as unknown as string[] });
    fetchAreas();
  };

  const cities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const grouped = new Map<string, { base: ServiceArea | null; postals: ServiceArea[] }>();

    for (const c of DEFAULT_CITIES) {
      grouped.set(c, { base: null, postals: [] });
    }
    for (const area of areas) {
      const entry = grouped.get(area.city) || { base: null, postals: [] };
      if (area.postal_code) entry.postals.push(area);
      else entry.base = area;
      grouped.set(area.city, entry);
    }

    return Array.from(grouped.entries())
      .filter(([city, entry]) => {
        if (!term) return entry.base || entry.postals.length > 0;
        return (
          city.toLowerCase().includes(term) ||
          entry.postals.some((p) => (p.postal_code || "").includes(term))
        );
      })
      .sort((a, b) => a[0].localeCompare(b[0], "fi"));
  }, [areas, search]);

  const activeCount = areas.filter((a) => a.is_active && !a.postal_code).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                Palvelualueet
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Hallitse kuntia ja postinumeroita, joilla pesula- ja kotiinkuljetuspalvelua tarjotaan.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Lisää uusi kunta tai postinumero
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Etsi kuntaa tai postinumeroa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="w-fit">
              {activeCount} aktiivista kuntaa
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ladataan...
            </div>
          ) : cities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Ei tuloksia haulla "{search}".</p>
          ) : (
            <div className="space-y-3">
              {cities.map(([city, entry]) => {
                const base = entry.base;
                return (
                  <div
                    key={city}
                    className={`rounded-lg border p-3 sm:p-4 transition-colors ${
                      base?.is_active ? "bg-card" : "bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm sm:text-base">{city}</h3>
                          <Badge variant={base?.is_active ? "default" : "secondary"} className="text-xs">
                            {base?.is_active ? "Aktiivinen" : "Ei aktiivinen"}
                          </Badge>
                          {savingId === base?.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                        {entry.postals.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.postals.length} postinumerosääntöä
                          </p>
                        )}
                      </div>
                      {base ? (
                        <Switch
                          checked={base.is_active}
                          onCheckedChange={(checked) => updateArea(base.id, { is_active: checked })}
                          aria-label={`Aseta ${city} aktiiviseksi`}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setForm((f) => ({ ...f, city }));
                            setDialogOpen(true);
                          }}
                        >
                          Ota käyttöön
                        </Button>
                      )}
                    </div>

                    {base && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Toimitusmaksu (€)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.10"
                              value={base.delivery_fee}
                              onChange={(e) =>
                                setAreas((prev) =>
                                  prev.map((a) =>
                                    a.id === base.id ? { ...a, delivery_fee: Number(e.target.value) } : a
                                  )
                                )
                              }
                              onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (Number.isNaN(value) || value < 0 || value > 1000) {
                                  toast({
                                    title: "Virheellinen maksu",
                                    description: "Toimitusmaksun tulee olla 0–1000 €.",
                                    variant: "destructive",
                                  });
                                  fetchAreas();
                                  return;
                                }
                                updateArea(base.id, { delivery_fee: value });
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Muistiinpanot</Label>
                            <Input
                              value={base.notes ?? ""}
                              maxLength={500}
                              placeholder="Vapaaehtoinen"
                              onChange={(e) =>
                                setAreas((prev) =>
                                  prev.map((a) => (a.id === base.id ? { ...a, notes: e.target.value } : a))
                                )
                              }
                              onBlur={(e) => updateArea(base.id, { notes: e.target.value.trim() || null })}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <Label className="text-xs">Toimituspäivät</Label>
                          <div className="flex flex-wrap gap-3 mt-2">
                            {WEEKDAYS.map((day) => {
                              const checked = base.delivery_days.includes(day);
                              return (
                                <label key={day} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => {
                                      const next = value
                                        ? [...base.delivery_days, day]
                                        : base.delivery_days.filter((d) => d !== day);
                                      updateArea(base.id, {
                                        delivery_days: WEEKDAYS.filter((w) => next.includes(w)),
                                      });
                                    }}
                                  />
                                  {day.slice(0, 2)}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <Collapsible
                          open={!!expanded[city]}
                          onOpenChange={(open) => setExpanded((prev) => ({ ...prev, [city]: open }))}
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="mt-3 -ml-2 text-xs">
                              {expanded[city] ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              Postinumerot ({entry.postals.length})
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-2">
                            {entry.postals.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Ei postinumerokohtaisia sääntöjä – koko kunta on palvelun piirissä.
                              </p>
                            ) : (
                              entry.postals.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{p.postal_code}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {p.delivery_fee.toFixed(2)} € · {p.delivery_days.length} päivää
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={p.is_active}
                                      onCheckedChange={(checked) => updateArea(p.id, { is_active: checked })}
                                      aria-label={`Aseta ${p.postal_code} aktiiviseksi`}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => deleteArea(p)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lisää kunta tai postinumero</DialogTitle>
            <DialogDescription>
              Jätä postinumero tyhjäksi, jos sääntö koskee koko kuntaa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-city">Kunta *</Label>
              <Input
                id="sa-city"
                value={form.city}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Esim. Helsinki"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-postal">Postinumero</Label>
              <Input
                id="sa-postal"
                value={form.postal_code}
                maxLength={5}
                inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value.replace(/\D/g, "") }))}
                placeholder="Esim. 00500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-fee">Toimitusmaksu (€)</Label>
              <Input
                id="sa-fee"
                type="number"
                min="0"
                step="0.10"
                value={form.delivery_fee}
                onChange={(e) => setForm((f) => ({ ...f, delivery_fee: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Toimituspäivät</Label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={form.delivery_days.includes(day)}
                      onCheckedChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          delivery_days: WEEKDAYS.filter((w) =>
                            value ? [...f.delivery_days, day].includes(w) : f.delivery_days.includes(w) && w !== day
                          ),
                        }))
                      }
                    />
                    {day.slice(0, 2)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-notes">Muistiinpanot</Label>
              <Textarea
                id="sa-notes"
                value={form.notes}
                maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Vapaaehtoinen lisätieto"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Peruuta
            </Button>
            <Button onClick={createArea} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lisää
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};