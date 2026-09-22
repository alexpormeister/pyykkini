import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Megaphone, Plus, Pencil, Trash2, ShieldCheck, Sparkles } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  image_url: string | null;
  product_id: string | null;
  button_text: string;
  is_active: boolean;
  sort_order: number;
}

interface TrustBadge {
  id: string;
  title: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
}

interface ProductOption {
  product_id: string;
  name: string;
}

const emptyBanner = {
  title: "",
  subtitle: "",
  badge_text: "SUOSITUIN ARJEN SÄÄSTÄJÄ",
  image_url: "",
  product_id: "",
  button_text: "Tilaa heti",
  is_active: true,
  sort_order: "1"
};

const ICONS = ["truck", "clock", "shield-check", "sparkles", "leaf", "star", "package", "heart"];

export const AppManager = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBannerDialog, setShowBannerDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm, setBannerForm] = useState({ ...emptyBanner });
  const [showBadgeDialog, setShowBadgeDialog] = useState(false);
  const [editingBadge, setEditingBadge] = useState<TrustBadge | null>(null);
  const [badgeForm, setBadgeForm] = useState({ title: "", icon_name: "shield-check", sort_order: "1", is_active: true });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [b, t, p] = await Promise.all([
        (supabase as any).from("app_banners").select("*").order("sort_order"),
        (supabase as any).from("app_trust_badges").select("*").order("sort_order"),
        supabase.from("products").select("product_id, name").eq("is_active", true).order("name")
      ]);
      if (b.error) throw b.error;
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      setBanners(b.data || []);
      setTrustBadges(t.data || []);
      setProducts(p.data || []);
    } catch (error) {
      logger.error("Error fetching app manager data:", error);
      toast({ variant: "destructive", title: "Virhe", description: "Tietojen lataaminen epäonnistui" });
    }
  };

  const openBanner = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerForm({
        title: banner.title,
        subtitle: banner.subtitle || "",
        badge_text: banner.badge_text || "",
        image_url: banner.image_url || "",
        product_id: banner.product_id || "",
        button_text: banner.button_text,
        is_active: banner.is_active,
        sort_order: String(banner.sort_order)
      });
    } else {
      setEditingBanner(null);
      setBannerForm({ ...emptyBanner });
    }
    setShowBannerDialog(true);
  };

  const saveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: bannerForm.title,
        subtitle: bannerForm.subtitle || null,
        badge_text: bannerForm.badge_text || null,
        image_url: bannerForm.image_url || null,
        product_id: bannerForm.product_id || null,
        button_text: bannerForm.button_text || "Tilaa heti",
        is_active: bannerForm.is_active,
        sort_order: parseInt(bannerForm.sort_order || "1", 10) || 1
      };
      const { error } = editingBanner
        ? await (supabase as any).from("app_banners").update(payload).eq("id", editingBanner.id)
        : await (supabase as any).from("app_banners").insert(payload);
      if (error) throw error;
      toast({ title: editingBanner ? "Kampanja päivitetty" : "Kampanja luotu" });
      setShowBannerDialog(false);
      setEditingBanner(null);
      fetchAll();
    } catch (error: any) {
      logger.error("Error saving banner:", error);
      toast({ variant: "destructive", title: "Virhe", description: error.message || "Tallennus epäonnistui" });
    } finally {
      setLoading(false);
    }
  };

  const toggleBanner = async (banner: Banner) => {
    const { error } = await (supabase as any).from("app_banners").update({ is_active: !banner.is_active }).eq("id", banner.id);
    if (error) {
      toast({ variant: "destructive", title: "Virhe", description: error.message });
      return;
    }
    fetchAll();
  };

  const deleteBanner = async (banner: Banner) => {
    if (!confirm(`Poistetaanko kampanja "${banner.title}"?`)) return;
    const { error } = await (supabase as any).from("app_banners").delete().eq("id", banner.id);
    if (error) {
      toast({ variant: "destructive", title: "Virhe", description: error.message });
      return;
    }
    toast({ title: "Kampanja poistettu" });
    fetchAll();
  };

  const openBadge = (badge?: TrustBadge) => {
    if (badge) {
      setEditingBadge(badge);
      setBadgeForm({ title: badge.title, icon_name: badge.icon_name, sort_order: String(badge.sort_order), is_active: badge.is_active });
    } else {
      setEditingBadge(null);
      setBadgeForm({ title: "", icon_name: "shield-check", sort_order: String(trustBadges.length + 1), is_active: true });
    }
    setShowBadgeDialog(true);
  };

  const saveBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: badgeForm.title,
        icon_name: badgeForm.icon_name,
        sort_order: parseInt(badgeForm.sort_order || "1", 10) || 1,
        is_active: badgeForm.is_active
      };
      const { error } = editingBadge
        ? await (supabase as any).from("app_trust_badges").update(payload).eq("id", editingBadge.id)
        : await (supabase as any).from("app_trust_badges").insert(payload);
      if (error) throw error;
      toast({ title: editingBadge ? "Lupaus päivitetty" : "Lupaus lisätty" });
      setShowBadgeDialog(false);
      setEditingBadge(null);
      fetchAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Virhe", description: error.message || "Tallennus epäonnistui" });
    } finally {
      setLoading(false);
    }
  };

  const deleteBadge = async (badge: TrustBadge) => {
    if (!confirm(`Poistetaanko lupaus "${badge.title}"?`)) return;
    const { error } = await (supabase as any).from("app_trust_badges").delete().eq("id", badge.id);
    if (error) {
      toast({ variant: "destructive", title: "Virhe", description: error.message });
      return;
    }
    fetchAll();
  };

  const productName = (id: string | null) =>
    id ? products.find((p) => p.product_id === id)?.name || id : "—";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Kampanjat
        </h2>
        <p className="text-sm text-muted-foreground">Hallitse mobiilisovelluksen aloitusnäkymän kampanjanostoja ja palvelulupauksia</p>
      </div>

      <Tabs defaultValue="banners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="banners">Hero-kampanjanostot</TabsTrigger>
          <TabsTrigger value="promises">Palvelulupaukset</TabsTrigger>
        </TabsList>

        <TabsContent value="banners" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openBanner()} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Lisää kampanja
            </Button>
          </div>

          {banners.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">Ei kampanjoita vielä</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {banners.map((banner) => (
                <Card key={banner.id} className={banner.is_active ? "" : "opacity-60"}>
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        loading="lazy"
                        className="h-24 w-full sm:w-36 rounded-xl object-cover bg-muted"
                      />
                    ) : (
                      <div className="h-24 w-full sm:w-36 rounded-xl bg-muted flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      {banner.badge_text && (
                        <Badge variant="secondary" className="text-[10px] tracking-wide">{banner.badge_text}</Badge>
                      )}
                      <h3 className="font-semibold truncate">{banner.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{banner.subtitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Järjestys {banner.sort_order} · Tuote: {productName(banner.product_id)} · Painike: {banner.button_text}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-center gap-2">
                      <Switch checked={banner.is_active} onCheckedChange={() => toggleBanner(banner)} />
                      <Button variant="outline" size="sm" onClick={() => openBanner(banner)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteBanner(banner)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="promises" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Palvelulupaukset
                </CardTitle>
                <CardDescription>Näytetään sovelluksen aloitusnäkymässä</CardDescription>
              </div>
              <Button size="sm" onClick={() => openBadge()}>
                <Plus className="h-4 w-4 mr-2" /> Lisää
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {trustBadges.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Ei lupauksia vielä</p>
              )}
              {trustBadges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{badge.title}</p>
                    <p className="text-xs text-muted-foreground">Ikoni: {badge.icon_name} · Järjestys {badge.sort_order}</p>
                  </div>
                  <Switch
                    checked={badge.is_active}
                    onCheckedChange={async () => {
                      await (supabase as any).from("app_trust_badges").update({ is_active: !badge.is_active }).eq("id", badge.id);
                      fetchAll();
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => openBadge(badge)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteBadge(badge)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Banner dialog */}
      <Dialog open={showBannerDialog} onOpenChange={setShowBannerDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Muokkaa kampanjaa" : "Uusi kampanja"}</DialogTitle>
            <DialogDescription>Kampanjakortti näkyy sovelluksen aloitusnäkymän kärjessä</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBanner} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner-title">Otsikko *</Label>
              <Input
                id="banner-title"
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                placeholder="Arkipyykkikassi (max 6 kg)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-subtitle">Esittelyteksti</Label>
              <Textarea
                id="banner-subtitle"
                rows={3}
                value={bannerForm.subtitle}
                onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                placeholder="Pesty, kuivattu ja siististi viikattuna takaisin kotiovellesi."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-badge">Badge-teksti</Label>
              <Input
                id="banner-badge"
                value={bannerForm.badge_text}
                onChange={(e) => setBannerForm({ ...bannerForm, badge_text: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-image">Kuvan URL</Label>
              <Input
                id="banner-image"
                type="url"
                value={bannerForm.image_url}
                onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Liitetty tuote</Label>
              <Select
                value={bannerForm.product_id || "none"}
                onValueChange={(v) => setBannerForm({ ...bannerForm, product_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ei tuotetta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ei tuotetta</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.product_id} value={p.product_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banner-button">Painikkeen teksti</Label>
                <Input
                  id="banner-button"
                  value={bannerForm.button_text}
                  onChange={(e) => setBannerForm({ ...bannerForm, button_text: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-sort">Järjestys</Label>
                <Input
                  id="banner-sort"
                  type="number"
                  min="1"
                  value={bannerForm.sort_order}
                  onChange={(e) => setBannerForm({ ...bannerForm, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="banner-active"
                checked={bannerForm.is_active}
                onCheckedChange={(v) => setBannerForm({ ...bannerForm, is_active: v })}
              />
              <Label htmlFor="banner-active">Aktiivinen</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBannerDialog(false)}>Peruuta</Button>
              <Button type="submit" disabled={loading}>{loading ? "Tallennetaan..." : "Tallenna"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Trust badge dialog */}
      <Dialog open={showBadgeDialog} onOpenChange={setShowBadgeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBadge ? "Muokkaa lupausta" : "Uusi palvelulupaus"}</DialogTitle>
            <DialogDescription>Esim. "Nouto ovelta" tai "100% Laatutakuu"</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBadge} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge-title">Otsikko *</Label>
              <Input
                id="badge-title"
                value={badgeForm.title}
                onChange={(e) => setBadgeForm({ ...badgeForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ikoni</Label>
              <Select value={badgeForm.icon_name} onValueChange={(v) => setBadgeForm({ ...badgeForm, icon_name: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="badge-sort">Järjestys</Label>
              <Input
                id="badge-sort"
                type="number"
                min="1"
                value={badgeForm.sort_order}
                onChange={(e) => setBadgeForm({ ...badgeForm, sort_order: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="badge-active"
                checked={badgeForm.is_active}
                onCheckedChange={(v) => setBadgeForm({ ...badgeForm, is_active: v })}
              />
              <Label htmlFor="badge-active">Aktiivinen</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBadgeDialog(false)}>Peruuta</Button>
              <Button type="submit" disabled={loading}>{loading ? "Tallennetaan..." : "Tallenna"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
