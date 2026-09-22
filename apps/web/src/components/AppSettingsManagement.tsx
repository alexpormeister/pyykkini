import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Loader2, Percent, Euro, Truck, ShoppingBag } from "lucide-react";

interface AppSettings {
  service_fee: number;
  vat_rate: number;
  delivery_fee: number;
  min_order_amount: number;
  updated_at?: string;
}

const DEFAULTS: AppSettings = {
  service_fee: 2,
  vat_rate: 25.5,
  delivery_fee: 0,
  min_order_amount: 0,
};

export const AppSettingsManagement = () => {
  const [form, setForm] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (error) {
        toast.error("Asetusten lataus epäonnistui");
      } else if (data) {
        setForm({
          service_fee: Number(data.service_fee ?? 0),
          vat_rate: Number(data.vat_rate ?? 0),
          delivery_fee: Number(data.delivery_fee ?? 0),
          min_order_amount: Number(data.min_order_amount ?? 0),
        });
        setUpdatedAt(data.updated_at);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if ([form.service_fee, form.vat_rate, form.min_order_amount].some((v) => isNaN(v) || v < 0)) {
      toast.error("Kaikkien arvojen tulee olla nollaa suurempia tai nolla");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: "global", ...form, updated_at: new Date().toISOString() }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error("Asetusten tallennus epäonnistui");
      return;
    }
    setUpdatedAt(new Date().toISOString());
    toast.success("Asetukset päivitetty onnistuneesti");
  };

  const num = (key: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value === "" ? 0 : parseFloat(e.target.value) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ladataan asetuksia...
      </div>
    );
  }

  const exampleBase = 20;
  const total = exampleBase + form.service_fee;
  const vatAmount = form.vat_rate > 0 ? total - total / (1 + form.vat_rate / 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Hinnoittelu ja verot
          </CardTitle>
          <CardDescription>
            Nämä asetukset vaikuttavat kaikkiin uusiin tilauksiin sovelluksessa ja verkossa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground -mt-2">
            Toimitusmaksut hallitaan kaupunkikohtaisesti Palvelualueet-sivulla.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service_fee" className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" /> Palvelumaksu (€)
              </Label>
              <Input id="service_fee" type="number" step="0.01" min="0" value={form.service_fee} onChange={num("service_fee")} />
              <p className="text-xs text-muted-foreground">Lisätään automaattisesti jokaisen tilauksen loppusummaan kaupungista riippumatta.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_rate" className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" /> ALV-kanta (%)
              </Label>
              <Input id="vat_rate" type="number" step="0.1" min="0" max="100" value={form.vat_rate} onChange={num("vat_rate")} />
              <p className="text-xs text-muted-foreground">Hinnat sisältävät ALV:n. Käytetään veroerittelyn laskentaan (esim. 25,5 % tai 24,0 %).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_order_amount" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Tilauksen minimisumma (€)
              </Label>
              <Input id="min_order_amount" type="number" step="0.01" min="0" value={form.min_order_amount} onChange={num("min_order_amount")} />
              <p className="text-xs text-muted-foreground">0 = ei minimisummaa. Estää liian pienet tilaukset.</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-1 text-sm">
            <p className="font-medium">Esimerkkilaskelma (tuotteet 20,00 €)</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Palvelumaksu</span><span>{form.service_fee.toFixed(2)} €</span></div>
            <div className="flex justify-between font-medium"><span>Yhteensä</span><span>{total.toFixed(2)} €</span></div>
            <div className="flex justify-between text-muted-foreground"><span>sis. ALV {form.vat_rate.toFixed(1)} %</span><span>{vatAmount.toFixed(2)} €</span></div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Tallennetaan...</> : "Tallenna asetukset"}
            </Button>
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Päivitetty {new Date(updatedAt).toLocaleString("fi-FI")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
