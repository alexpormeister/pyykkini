import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Phone, Trash2, Package, Hash, LogOut, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Import profile images
import profile1 from '@/assets/profile-1.jpg';
import profile2 from '@/assets/profile-2.jpg';
import profile3 from '@/assets/profile-3.jpg';
import profile4 from '@/assets/profile-4.jpg';
import profile5 from '@/assets/profile-5.jpg';

const profileImages = [
  { id: 1, src: profile1, alt: 'Profiilikuva 1' },
  { id: 2, src: profile2, alt: 'Profiilikuva 2' },
  { id: 3, src: profile3, alt: 'Profiilikuva 3' },
  { id: 4, src: profile4, alt: 'Profiilikuva 4' },
  { id: 5, src: profile5, alt: 'Profiilikuva 5' },
];

interface Order {
  id: string;
  service_name: string;
  status: string;
  created_at: string;
  final_price: number;
  pickup_option?: string;
  return_option?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  profile_image?: number;
  address?: string;
}

export const Profile = () => {
  const { user, userRole, signOut, deleteAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    profile_image: 1,
    address: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchOrders();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          profile_image: data.profile_image || 1,
          address: data.address || ''
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, service_name, status, created_at, final_price, pickup_option, return_option')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          profile_image: formData.profile_image,
          address: formData.address
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profiili päivitetty!",
        description: "Tietosi on tallennettu onnistuneesti."
      });

      fetchProfile();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Profiilin päivittäminen epäonnistui."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    
    if (!confirm('Oletko varma, että haluat poistaa tilisi pysyvästi? Tätä toimintoa ei voi peruuttaa ja kaikki tietosi poistetaan.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Use the new deleteAccount function from AuthContext
      await deleteAccount();
      
      toast({
        title: "Tili poistettu onnistuneesti",
        description: "Tilisi ja kaikki siihen liittyvät tiedot on poistettu pysyvästi."
      });

      navigate('/');
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({
        variant: "destructive",
        title: "Tilin poistaminen epäonnistui",
        description: error.message || "Tilin poistamisessa tapahtui virhe. Yritä uudelleen tai ota yhteyttä tukeen."
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'picked_up': return 'bg-purple-100 text-purple-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Odottaa';
      case 'accepted': return 'Hyväksytty';
      case 'picked_up': return 'Noudettu';
      case 'in_progress': return 'Käsittelyssä';
      case 'completed': return 'Valmis';
      case 'cancelled': return 'Peruutettu';
      default: return status;
    }
  };

  if (!user) {
    return <div>Kirjaudu sisään nähdäksesi profiilisi</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Navigation */}
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img src={profileImages[0].src} alt="Pesuni" className="h-8" />
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Package className="h-4 w-4" />
                <span className="hidden md:inline">Takaisin</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Kirjaudu ulos</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="shadow-elegant">
              <CardHeader className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <img 
                    src={profileImages[formData.profile_image - 1]?.src} 
                    alt="Profiilikuva" 
                    className="w-full h-full rounded-full object-cover border-4 border-primary/20"
                  />
                </div>
                <CardTitle>{formData.full_name || user.email}</CardTitle>
                <CardDescription className="flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {userRole}
                  </Badge>
                  {userRole === 'driver' && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      ID: {user.id.slice(0, 8)}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Profile Image Selection */}
                  <div>
                    <Label className="text-sm font-medium">Valitse profiilikuva</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {profileImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => handleInputChange('profile_image', img.id)}
                          className={`w-12 h-12 rounded-full border-2 transition-all ${
                            formData.profile_image === img.id
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-gray-200 hover:border-primary/50'
                          }`}
                        >
                          <img 
                            src={img.src} 
                            alt={img.alt} 
                            className="w-full h-full rounded-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <Label htmlFor="full_name">Koko nimi</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        className="pl-10"
                        placeholder="Koko nimesi"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email">Sähköposti</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10"
                        placeholder="sähköposti@example.com"
                      />
                    </div>
                  </div>

                   {/* Phone */}
                   <div>
                     <Label htmlFor="phone">Puhelinnumero</Label>
                     <div className="relative">
                       <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="phone"
                         type="tel"
                         value={formData.phone}
                         onChange={(e) => handleInputChange('phone', e.target.value)}
                         className="pl-10"
                         placeholder="+358 40 123 4567"
                       />
                     </div>
                   </div>

                   {/* Address */}
                   <div>
                     <Label htmlFor="address">Osoite</Label>
                     <div className="relative">
                       <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="address"
                         value={formData.address}
                         onChange={(e) => handleInputChange('address', e.target.value)}
                         className="pl-10"
                         placeholder="Katu 1, 00100 Helsinki"
                       />
                     </div>
                   </div>

                  <Button 
                    type="submit" 
                    variant="hero" 
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Tallennetaan...' : 'Tallenna muutokset'}
                  </Button>
                </form>

                <Separator className="my-6" />

                {/* Delete Account - Less Prominent */}
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    Vaaralliset toiminnot
                  </summary>
                  <div className="mt-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                    <Alert className="border-destructive/20 bg-transparent">
                      <Trash2 className="h-4 w-4" />
                      <AlertDescription>
                        Poista tilisi pysyvästi. Tätä toimintoa ei voi peruuttaa.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="w-full mt-4"
                      onClick={handleDeleteUser}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? 'Poistetaan...' : 'Poista tili'}
                    </Button>
                  </div>
                </details>
              </CardContent>
            </Card>
          </div>

          {/* Role-specific Content */}
          <div className="lg:col-span-2">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {userRole === 'customer' && <Package className="h-5 w-5" />}
                  {userRole === 'driver' && <User className="h-5 w-5" />}
                  {userRole === 'admin' && <User className="h-5 w-5" />}
                  {userRole === 'customer' ? 'Tilaushistoria' : 
                   userRole === 'driver' ? 'Kuljettajan tiedot' : 'Ylläpitäjän tiedot'}
                </CardTitle>
                <CardDescription>
                  {userRole === 'customer' ? 'Kaikki tekemäsi tilaukset' :
                   userRole === 'driver' ? 'Asetukset ja työkalut' : 'Hallinta ja työkalut'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userRole === 'customer' ? (
                  // Customer order history
                  orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Ei tilauksia vielä</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => navigate('/app')}
                      >
                        Tee ensimmäinen tilauksesi
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold">{order.service_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Tilattu {new Date(order.created_at).toLocaleDateString('fi-FI')}
                              </p>
                              {order.pickup_option && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Nouto: {order.pickup_option === 'immediate' ? 'Heti' : 
                                          order.pickup_option === 'choose_time' ? 'Valittu aika' : 'Ei väliä'}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge className={getStatusColor(order.status)}>
                                {getStatusText(order.status)}
                              </Badge>
                              <p className="text-lg font-bold mt-1">{order.final_price}€</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : userRole === 'driver' ? (
                  // Driver settings and info
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2"
                        onClick={() => navigate('/app')}
                      >
                        <Package className="h-6 w-6" />
                        <span>Tilausnäkymä</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2"
                        disabled
                      >
                        <User className="h-6 w-6" />
                        <span>Asetukset</span>
                      </Button>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Kuljettajan ID</h4>
                      <p className="text-sm text-muted-foreground font-mono">{user.id}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Yhteystiedot</h4>
                      <p className="text-sm text-muted-foreground">
                        Käytä profiilitietoja asiakkaiden yhteydenpitoon
                      </p>
                    </div>
                  </div>
                ) : (
                  // Admin tools
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2"
                        onClick={() => navigate('/app')}
                      >
                        <Package className="h-6 w-6" />
                        <span>Ylläpitäjäpaneeli</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2"
                        onClick={() => {
                          navigate('/app');
                          // Set a flag to show user management tab
                          sessionStorage.setItem('adminTab', 'users');
                        }}
                      >
                        <User className="h-6 w-6" />
                        <span>Käyttäjähallinta</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center gap-2"
                        onClick={() => {
                          navigate('/app');
                          // Set a flag to show reports tab
                          sessionStorage.setItem('adminTab', 'reports');
                        }}
                      >
                        <Package className="h-6 w-6" />
                        <span>Raportit</span>
                      </Button>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Järjestelmätiedot</h4>
                      <p className="text-sm text-muted-foreground">
                        Ylläpitäjä ID: {user.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};