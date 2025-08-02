import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CreditCard, MapPin, Phone, User, Tag, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleMap } from './SimpleMap';

interface CheckoutFormProps {
  cartItems: Array<{
    id: string;
    type: 'service' | 'addon' | 'bundle';
    serviceId: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    metadata?: {
      rugDimensions?: {
        length: number;
        width: number;
      };
      sockColor?: string;
      sockPairs?: number;
    };
  }>;
  appliedCoupon?: {
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  onBack: () => void;
  onSuccess: () => void;
}

export const CheckoutForm = ({ cartItems, appliedCoupon, onBack, onSuccess }: CheckoutFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAddressEditable, setIsAddressEditable] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    specialInstructions: '',
    pickupOption: '', // 'immediate', 'choose_time', 'no_preference'
    pickupDate: '',
    pickupTime: '',
    returnOption: '', // 'immediate', 'choose_time', 'no_preference'
    returnDate: '',
    returnTime: ''
  });

  // Fetch user profile data and populate form
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone, address, email')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (profile) {
          setUserProfile(profile);
          setFormData(prev => ({
            ...prev,
            phone: profile.phone || '',
            address: profile.address || ''
          }));

          // If address is missing, prompt user to add it
          if (!profile.address) {
            toast({
              title: "Osoite puuttuu",
              description: "Anna osoitteesi jatkaaksesi tilauksen tekemistä. Osoite tallennetaan profiiliisi.",
              duration: 5000,
            });
            setIsAddressEditable(true);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          variant: "destructive",
          title: "Virhe",
          description: "Profiilin tietojen lataaminen epäonnistui."
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user, toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    const subtotal = calculateSubtotal();
    if (appliedCoupon.discount_type === 'percentage') {
      return subtotal * (appliedCoupon.discount_value / 100);
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  };

  const calculateFinalPrice = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    return Math.max(0, subtotal - discount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Sinun täytyy olla kirjautunut sisään tehdäksesi tilauksen."
      });
      return;
    }

    // Check if user has phone and address in profile
    if (!formData.phone || !formData.address) {
      toast({
        variant: "destructive",
        title: "Puuttuvat tiedot",
        description: "Anna puhelinnumero ja osoite tehdäksesi tilauksen."
      });
      return;
    }

    if (!formData.pickupOption || !formData.returnOption) {
      toast({
        variant: "destructive", 
        title: "Puuttuvia tietoja",
        description: "Valitse sekä nouto- että palautustapa."
      });
      return;
    }

    if (formData.pickupOption === 'choose_time' && (!formData.pickupDate || !formData.pickupTime)) {
      toast({
        variant: "destructive",
        title: "Puuttuvia tietoja", 
        description: "Valitse noutopäivä ja -aika."
      });
      return;
    }

    if (formData.returnOption === 'choose_time' && (!formData.returnDate || !formData.returnTime)) {
      toast({
        variant: "destructive",
        title: "Puuttuvia tietoja",
        description: "Valitse palautuspäivä ja -aika."
      });
      return;
    }

    setLoading(true);

    try {
      const finalPrice = calculateFinalPrice();
      const subtotal = calculateSubtotal();
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);
      
      // Create the main order first
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          service_type: 'multiple', // Indicate this is a multi-item order
          service_name: cartItems.length === 1 ? cartItems[0].name : `${cartItems.length} palvelua`,
          price: subtotal,
          final_price: finalPrice,
          first_name: 'Asiakas', // Default value since we removed name fields
          last_name: 'Asiakas', // Default value since we removed name fields
          phone: formData.phone,
          address: formData.address,
          special_instructions: formData.specialInstructions || null,
          pickup_option: formData.pickupOption,
          pickup_date: formData.pickupOption === 'choose_time' ? formData.pickupDate : currentDate,
          pickup_time: formData.pickupOption === 'choose_time' ? formData.pickupTime : currentTime,
          return_option: formData.returnOption,
          return_date: formData.returnOption === 'choose_time' ? formData.returnDate : currentDate,
          return_time: formData.returnOption === 'choose_time' ? formData.returnTime : currentTime,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: orderData.id,
        service_type: item.serviceId,
        service_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        metadata: item.metadata || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      // Update user's profile with phone and address if they were changed
      if (userProfile?.address !== formData.address || userProfile?.phone !== formData.phone) {
        await supabase
          .from('profiles')
          .update({ 
            address: formData.address,
            phone: formData.phone 
          })
          .eq('user_id', user.id);
      }
      
      toast({
        title: "Tilaus vastaanotettu!",
        description: `Tilauksesi ${cartItems.length} tuotetta on käsittelyssä. Saat vahvistuksen pian.`
      });
      
      setFormData({
        phone: '',
        address: '',
        specialInstructions: '',
        pickupOption: '',
        pickupDate: '',
        pickupTime: '',
        returnOption: '',
        returnDate: '',
        returnTime: ''
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tilauksen käsittelyssä tapahtui virhe. Yritä uudelleen."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Takaisin ostoskoriin
        </Button>
        <h2 className="text-2xl font-fredoka text-center">Tilauksen tiedot</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tilausyhteenveto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Ostoskori ({cartItems.length})</h4>
                <div className="space-y-2 mt-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x {item.price}€
                        </p>
                      </div>
                      <p className="text-sm font-bold">{(item.price * item.quantity).toFixed(2)}€</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Välisumma:</span>
                  <span className="text-lg font-bold">{calculateSubtotal().toFixed(2)}€</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between items-center mb-2 text-green-600">
                    <span className="font-semibold">Alennus ({appliedCoupon.code}):</span>
                    <span className="text-lg font-bold">-{calculateDiscount().toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-lg font-semibold">Yhteensä:</span>
                  <span className="text-2xl font-bold text-primary">{calculateFinalPrice().toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checkout Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Asiakastiedot ja nouto</CardTitle>
            <CardDescription>
              Täytä tiedot palvelun tilaamiseksi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Loading State */}
              {profileLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Ladataan profiilitietoja...</span>
                </div>
              )}

              {!profileLoading && (
                <>
                   {/* Customer Information */}
                   <div className="space-y-4">
                     <h4 className="font-semibold flex items-center gap-2">
                       <User className="h-4 w-4" />
                       Yhteystiedot
                       <span className="text-sm text-muted-foreground font-normal">(Profiilista)</span>
                     </h4>
                     <div className="grid grid-cols-1 gap-4">
                       <div>
                         <Label htmlFor="phone">Puhelinnumero *</Label>
                         <Input
                           id="phone"
                           type="tel"
                           value={formData.phone}
                           onChange={(e) => handleInputChange('phone', e.target.value)}
                           required
                           className="bg-muted/30"
                           placeholder="+358 40 123 4567"
                         />
                         <p className="text-xs text-muted-foreground mt-1">
                           Puhelinnumero haettu profiilista. Voit muokata sitä tarvittaessa.
                         </p>
                       </div>
                     </div>
                    <div>
                      <Label htmlFor="address" className="flex items-center justify-between">
                        <span>Noutoosoite *</span>
                        {!isAddressEditable && (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => setIsAddressEditable(true)}
                            className="text-xs"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Muokkaa
                          </Button>
                        )}
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          className={`pl-10 ${!isAddressEditable ? 'bg-muted/30' : ''}`}
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          placeholder="Katu 1, 00100 Helsinki"
                          required
                          disabled={!isAddressEditable}
                        />
                        {isAddressEditable && (
                           <Button 
                             type="button"
                             variant="outline" 
                             size="sm"
                             onClick={async () => {
                               // Update profile with new address
                               try {
                                 const { error } = await supabase
                                   .from('profiles')
                                   .update({ address: formData.address })
                                   .eq('user_id', user.id);
                                 
                                 if (error) throw error;
                                 
                                 toast({
                                   title: "Osoite päivitetty",
                                   description: "Osoite on tallennettu profiiliisi."
                                 });
                                 setIsAddressEditable(false);
                               } catch (error) {
                                 toast({
                                   variant: "destructive",
                                   title: "Virhe",
                                   description: "Osoitteen tallentaminen epäonnistui."
                                 });
                               }
                             }}
                             className="absolute right-1 top-1 h-8 text-xs"
                           >
                             Tallenna
                           </Button>
                        )}
                      </div>
                      {!isAddressEditable && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Osoite haettu profiilista. Klikkaa "Muokkaa" muuttaaksesi tämän tilauksen osoitetta.
                        </p>
                      )}
                     </div>

                     {/* Map right below address */}
                     {formData.address && (
                       <div className="mt-4">
                         <SimpleMap address={formData.address} />
                       </div>
                     )}
                   </div>

              {/* Pickup and Return Times */}
              <div className="space-y-6">
                <h4 className="font-semibold">Nouto- ja palautusajat</h4>
                
                {/* Pickup Options */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Noudon ajankohta *</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        formData.pickupOption === 'immediate' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleInputChange('pickupOption', 'immediate')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          formData.pickupOption === 'immediate' 
                            ? 'border-primary bg-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {formData.pickupOption === 'immediate' && (
                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                          )}
                        </div>
                        <div>
                          <h5 className="font-medium">HETI</h5>
                          <p className="text-sm text-muted-foreground">Jos kuljettajia saatavilla</p>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        formData.pickupOption === 'choose_time' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleInputChange('pickupOption', 'choose_time')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          formData.pickupOption === 'choose_time' 
                            ? 'border-primary bg-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {formData.pickupOption === 'choose_time' && (
                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                          )}
                        </div>
                        <div>
                          <h5 className="font-medium">Valitse ajankohta</h5>
                          <p className="text-sm text-muted-foreground">Kalenteri 2 viikoksi eteenpäin, 08:00-20:00</p>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        formData.pickupOption === 'no_preference' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleInputChange('pickupOption', 'no_preference')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          formData.pickupOption === 'no_preference' 
                            ? 'border-primary bg-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {formData.pickupOption === 'no_preference' && (
                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                          )}
                        </div>
                        <div>
                          <h5 className="font-medium">Ei väliä</h5>
                          <p className="text-sm text-muted-foreground">Järjestelmä valitsee automaattisesti seuraavan vapaan ajan</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {formData.pickupOption === 'choose_time' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label htmlFor="pickupDate">Noutopäivä *</Label>
                        <Input
                          id="pickupDate"
                          type="date"
                          value={formData.pickupDate}
                          onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                          className="rounded-xl border-2 focus:border-primary/50 transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="pickupTime">Noutoaika *</Label>
                        <Input
                          id="pickupTime"
                          type="time"
                          value={formData.pickupTime}
                          onChange={(e) => handleInputChange('pickupTime', e.target.value)}
                          min="08:00"
                          max="20:00"
                          className="rounded-xl border-2 focus:border-primary/50 transition-colors"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Return Options */}
                {formData.pickupOption && (
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Palautuksen ajankohta *</Label>
                    <div className="grid grid-cols-1 gap-3">
                      <div 
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          formData.returnOption === 'immediate' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleInputChange('returnOption', 'immediate')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            formData.returnOption === 'immediate' 
                              ? 'border-primary bg-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {formData.returnOption === 'immediate' && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <div>
                            <h5 className="font-medium">HETI</h5>
                            <p className="text-sm text-muted-foreground">Jos kuljettajia saatavilla</p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          formData.returnOption === 'choose_time' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleInputChange('returnOption', 'choose_time')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            formData.returnOption === 'choose_time' 
                              ? 'border-primary bg-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {formData.returnOption === 'choose_time' && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <div>
                            <h5 className="font-medium">Valitse ajankohta</h5>
                            <p className="text-sm text-muted-foreground">Kalenteri 2 viikoksi eteenpäin, 08:00-20:00</p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          formData.returnOption === 'no_preference' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleInputChange('returnOption', 'no_preference')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            formData.returnOption === 'no_preference' 
                              ? 'border-primary bg-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {formData.returnOption === 'no_preference' && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <div>
                            <h5 className="font-medium">Ei väliä</h5>
                            <p className="text-sm text-muted-foreground">Järjestelmä valitsee automaattisesti seuraavan vapaan ajan</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {formData.returnOption === 'choose_time' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                         <div>
                           <Label htmlFor="returnDate">Palautuspäivä *</Label>
                           <Input
                             id="returnDate"
                             type="date"
                             value={formData.returnDate}
                             onChange={(e) => handleInputChange('returnDate', e.target.value)}
                             min={formData.pickupDate || new Date().toISOString().split('T')[0]}
                             max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                             className="rounded-xl border-2 focus:border-primary/50 transition-colors"
                             required
                           />
                         </div>
                         <div>
                           <Label htmlFor="returnTime">Palautusaika *</Label>
                           <Input
                             id="returnTime"
                             type="time"
                             value={formData.returnTime}
                             onChange={(e) => handleInputChange('returnTime', e.target.value)}
                             min="08:00"
                             max="20:00"
                             className="rounded-xl border-2 focus:border-primary/50 transition-colors"
                             required
                           />
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              <div>
                <Label htmlFor="specialInstructions">Erityisohjeet</Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                  placeholder="Lisätietoja noudosta, erityistoiveet jne..."
                  rows={3}
                />
              </div>
              {/* Applied Coupon Display */}
              {appliedCoupon && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <Tag className="h-4 w-4" />
                    <span className="font-semibold">Käytetty kuponki: {appliedCoupon.code}</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    Saat {appliedCoupon.discount_type === 'percentage' 
                      ? `${appliedCoupon.discount_value}% alennuksen`
                      : `${appliedCoupon.discount_value}€ alennuksen`
                    }
                  </p>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-4">
                <h4 className="font-semibold">Maksutavat</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center hover:border-primary cursor-pointer transition-colors">
                    <div className="font-semibold">MobilePay</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center hover:border-primary cursor-pointer transition-colors">
                    <div className="font-semibold">Visa</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center hover:border-primary cursor-pointer transition-colors">
                    <div className="font-semibold">Klarna</div>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                className="w-full"
                 disabled={loading}
               >
                 {loading ? 'Käsitellään...' : `Vahvista tilaus (${calculateFinalPrice()}€)`}
               </Button>
                 </>
               )}
             </form>
           </CardContent>
         </Card>

       </div>
     </div>
   );
 };