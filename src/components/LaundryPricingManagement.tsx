import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Euro, Save, WashingMachine } from 'lucide-react';

interface Product {
  product_id: string;
  name: string;
  category_id: string;
  base_price: number;
  is_active: boolean;
}

interface Laundry {
  id: string;
  name: string;
  city: string | null;
}

interface PriceRow {
  price: string;
  is_active: boolean;
  exists: boolean;
}

interface LaundryPricingManagementProps {
  laundryId?: string;
  hideHeader?: boolean;
}

export const LaundryPricingManagement = ({ laundryId, hideHeader }: LaundryPricingManagementProps = {}) => {
  const { toast } = useToast();
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedLaundry, setSelectedLaundry] = useState<string>(laundryId || '');
  const [rows, setRows] = useState<Record<string, PriceRow>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from('laundries').select('id, name, city').order('name'),
        supabase.from('products').select('product_id, name, category_id, base_price, is_active').order('name'),
      ]);
      setLaundries(l || []);
      setProducts((p || []) as Product[]);
      if (laundryId) setSelectedLaundry(laundryId);
      else if (l && l.length > 0) setSelectedLaundry(l[0].id);
      setLoading(false);
    };
    load();
  }, [laundryId]);

  useEffect(() => {
    if (!selectedLaundry) return;
    const loadPrices = async () => {
      const { data } = await supabase
        .from('product_laundry_prices')
        .select('product_id, price, is_active')
        .eq('laundry_id', selectedLaundry);
      const map: Record<string, PriceRow> = {};
      (data || []).forEach((r: any) => {
        map[r.product_id] = { price: String(r.price), is_active: r.is_active, exists: true };
      });
      setRows(map);
    };
    loadPrices();
  }, [selectedLaundry]);

  const getRow = (productId: string, basePrice: number): PriceRow =>
    rows[productId] || { price: '', is_active: false, exists: false };

  const setRow = (productId: string, patch: Partial<PriceRow>) => {
    setRows((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || { price: '', is_active: false, exists: false }), ...patch },
    }));
  };

  const savePrice = async (product: Product, overrides?: Partial<PriceRow>) => {
    const row = { ...getRow(product.product_id, product.base_price), ...overrides };
    const priceValue = parseFloat(row.price);
    if (row.is_active && (isNaN(priceValue) || priceValue < 0)) {
      toast({ variant: 'destructive', title: 'Virheellinen hinta', description: 'Syötä hinta ennen tuotteen aktivointia.' });
      return;
    }
    setSaving(product.product_id);
    try {
      const { error } = await supabase
        .from('product_laundry_prices')
        .upsert(
          {
            product_id: product.product_id,
            laundry_id: selectedLaundry,
            price: isNaN(priceValue) ? 0 : priceValue,
            is_active: row.is_active,
          },
          { onConflict: 'product_id,laundry_id' }
        );
      if (error) throw error;
      setRow(product.product_id, { ...row, exists: true });
      toast({ title: 'Tallennettu', description: `${product.name} päivitetty.` });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Virhe', description: e.message || 'Tallennus epäonnistui' });
    } finally {
      setSaving(null);
    }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = Object.values(rows).filter((r) => r.is_active).length;

  return (
    <Card className={hideHeader ? 'border-0 shadow-none' : 'mb-6'}>
      {!hideHeader && (
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WashingMachine className="h-5 w-5" />
          Pesuloiden tuotehinnat
        </CardTitle>
        <CardDescription>
          Valitse pesula ja määritä sen veloittamat hinnat. Vain aktivoidut tuotteet ovat pesulalla käytössä.
        </CardDescription>
      </CardHeader>
      )}
      <CardContent className={hideHeader ? 'space-y-4 p-0' : 'space-y-4'}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ladataan…</p>
        ) : laundries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ei pesuloita. Lisää pesula ensin tuotehallinnasta.</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              {!laundryId && (
              <div className="sm:w-72">
                <Label className="text-xs">Pesula</Label>
                <Select value={selectedLaundry} onValueChange={setSelectedLaundry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse pesula" />
                  </SelectTrigger>
                  <SelectContent>
                    {laundries.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}{l.city ? ` – ${l.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
              <div className="flex-1">
                <Label className="text-xs">Hae tuotetta</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10" placeholder="Tuotteen nimi" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeCount} tuotetta käytössä</Badge>
              <Badge variant="outline">{products.length} tuotetta yhteensä</Badge>
            </div>

            <div className="space-y-2">
              {filtered.map((product) => {
                const row = getRow(product.product_id, product.base_price);
                return (
                  <div
                    key={product.product_id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-lg p-3 bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Oletushinta {product.base_price.toFixed(2)} €
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(checked) => {
                          setRow(product.product_id, { is_active: checked });
                          savePrice(product, { is_active: checked });
                        }}
                      />
                      <span className="text-xs text-muted-foreground w-16">
                        {row.is_active ? 'Käytössä' : 'Ei käytössä'}
                      </span>
                      <div className="relative w-32">
                        <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          className="pl-7"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={product.base_price.toFixed(2)}
                          value={row.price}
                          onChange={(e) => setRow(product.product_id, { price: e.target.value })}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving === product.product_id}
                        onClick={() => savePrice(product)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Tallenna
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">Ei tuotteita hakuehdolla.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};