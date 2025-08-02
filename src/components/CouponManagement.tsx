import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tag, Plus, Edit, Trash2, Calendar, Users, Percent, Euro } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  usage_limit?: number;
  usage_count: number;
  valid_from: string;
  valid_until?: string;
  created_at: string;
}

export const CouponManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    usage_limit: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kuponkien lataaminen epäonnistui."
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      usage_limit: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: ''
    });
    setEditingCoupon(null);
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      usage_limit: coupon.usage_limit?.toString() || '',
      valid_from: coupon.valid_from.split('T')[0],
      valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : ''
    });
    setShowCreateDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.discount_value) {
      toast({
        variant: "destructive",
        title: "Puuttuvat tiedot",
        description: "Täytä vaaditut kentät"
      });
      return;
    }

    const couponData = {
      code: formData.code.toUpperCase(),
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
      valid_from: new Date(formData.valid_from).toISOString(),
      valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
      created_by: user?.id
    };

    try {
      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;

        toast({
          title: "Kuponki päivitetty",
          description: `Kuponki ${couponData.code} on päivitetty`
        });
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert([couponData]);

        if (error) throw error;

        toast({
          title: "Kuponki luotu",
          description: `Kuponki ${couponData.code} on luotu onnistuneesti`
        });
      }

      setShowCreateDialog(false);
      resetForm();
      fetchCoupons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Kupongin tallentaminen epäonnistui"
      });
    }
  };

  const handleDelete = async (couponId: string, couponCode: string) => {
    if (!confirm(`Oletko varma, että haluat poistaa kupongin ${couponCode}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponId);

      if (error) throw error;

      toast({
        title: "Kuponki poistettu",
        description: `Kuponki ${couponCode} on poistettu`
      });

      fetchCoupons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kupongin poistaminen epäonnistui"
      });
    }
  };

  const getCouponStatus = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

    if (now < validFrom) return { status: 'upcoming', color: 'bg-blue-100 text-blue-800' };
    if (validUntil && now > validUntil) return { status: 'expired', color: 'bg-red-100 text-red-800' };
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { status: 'used_up', color: 'bg-orange-100 text-orange-800' };
    }
    return { status: 'active', color: 'bg-green-100 text-green-800' };
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Tuleva';
      case 'expired': return 'Vanhentunut';
      case 'used_up': return 'Käytetty loppuun';
      case 'active': return 'Aktiivinen';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Kuponkien hallinta
            </CardTitle>
            <CardDescription>Luo ja hallitse alennuskuponkeja</CardDescription>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Luo kuponki
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {coupons.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ei kuponkeja</h3>
            <p className="text-muted-foreground mb-4">Luo ensimmäinen kuponkisi</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Luo kuponki
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => {
              const { status, color } = getCouponStatus(coupon);
              return (
                <div key={coupon.id} className="border rounded-lg p-4 hover:shadow-elegant transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary">
                        {coupon.discount_type === 'percentage' ? (
                          <Percent className="h-6 w-6 text-white" />
                        ) : (
                          <Euro className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{coupon.code}</h3>
                          <Badge className={color}>
                            {getStatusText(status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {coupon.discount_type === 'percentage' 
                              ? `${coupon.discount_value}% alennus`
                              : `${coupon.discount_value}€ alennus`
                            }
                          </span>
                          {coupon.usage_limit && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {coupon.usage_count}/{coupon.usage_limit} käytetty
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(coupon.valid_from).toLocaleDateString('fi-FI')}
                            {coupon.valid_until && ` - ${new Date(coupon.valid_until).toLocaleDateString('fi-FI')}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(coupon)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(coupon.id, coupon.code)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Coupon Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {editingCoupon ? 'Muokkaa kuponkia' : 'Luo uusi kuponki'}
              </DialogTitle>
              <DialogDescription>
                {editingCoupon ? 'Päivitä kupongin tiedot' : 'Täytä kupongin tiedot'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Kuponkikoodi *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER2024"
                  required
                />
              </div>

              <div>
                <Label htmlFor="discount_type">Alennustyyppi *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setFormData(prev => ({ ...prev, discount_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Prosenttialennus (%)</SelectItem>
                    <SelectItem value="fixed">Kiinteä alennus (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discount_value">
                  Alennuksen määrä * {formData.discount_type === 'percentage' ? '(%)' : '(€)'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                  placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
                  required
                />
              </div>

              <div>
                <Label htmlFor="usage_limit">Käyttöraja (valinnainen)</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                  placeholder="100"
                />
              </div>

              <div>
                <Label htmlFor="valid_from">Voimassa alkaen *</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="valid_until">Voimassa asti (valinnainen)</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Peruuta
                </Button>
                <Button type="submit" className="flex-1">
                  {editingCoupon ? 'Tallenna' : 'Luo kuponki'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};