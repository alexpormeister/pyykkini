import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CreditCard, MapPin, Phone, User, Tag, Edit } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleMap } from './SimpleMap';
import { RugDimensionsDialog } from './RugDimensionsDialog';
import { PaymentOptions } from './PaymentOptions';
import { TimeSlotSelector } from './TimeSlotSelector';
import { SwipeToConfirm } from './SwipeToConfirm';
import { useIsMobile } from '@/hooks/use-mobile';
import { AddressAutocomplete } from './AddressAutocomplete';

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
  onApplyCoupon?: (coupon: { code: string; discount_type: string; discount_value: number }) => void;
}

export const CheckoutForm = ({ cartItems, appliedCoupon, onBack, onSuccess, onApplyCoupon }: CheckoutFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAddressEditable, setIsAddressEditable] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    specialInstructions: '',
    pickupOption: '' as 'asap' | 'choose_time' | ''
  });
  const [addressCoordinates, setAddressCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<any>(null);
  const [estimatedReturnSlot, setEstimatedReturnSlot] = useState<any>(null);
  const [showRugDimensionsDialog, setShowRugDimensionsDialog] = useState(false);
  const [pendingRugItem, setPendingRugItem] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // Fetch user profile data and populate form
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, address, email')
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

  const checkForRugAndProceed = () => {
    // Check if there's a rug item without dimensions
    const rugItem = cartItems.find(item => 
      item.name.toLowerCase().includes('matto') && 
      !item.metadata?.rugDimensions
    );
    
    if (rugItem) {
      setPendingRugItem(rugItem);
      setShowRugDimensionsDialog(true);
      return false;
    }
    return true;
  };

  const handleRugDimensions = (dimensions: { length: number; width: number }) => {
    if (pendingRugItem) {
      // Update the cart item with dimensions
      const updatedItems = cartItems.map(item => 
        item.id === pendingRugItem.id 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                rugDimensions: dimensions 
              } 
            }
          : item
      );
      // The parent component should handle this update
      console.log('Rug dimensions set:', dimensions);
      setPendingRugItem(null);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Anna kuponkikoodi."
      });
      return;
    }

    setCouponLoading(true);
    try {
      // Calculate order total for validation
      const orderTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Use secure coupon validation edge function
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          code: couponCode.trim().toUpperCase(),
          orderTotal: orderTotal
        }
      });

      if (error || !data.valid) {
        toast({
          variant: "destructive",
          title: "Virhe",
          description: data.error || "Kuponkia ei löytynyt tai se on vanhentunut."
        });
        return;
      }

      // Apply the coupon using the secure validation result
      if (onApplyCoupon && data.coupon) {
        onApplyCoupon({
          code: data.coupon.code,
          discount_type: data.coupon.discount_type,
          discount_value: data.coupon.discount_value
        });
      }
      
      toast({
        title: "Kuponki aktivoitu!",
        description: `Kuponki "${data.coupon.code}" on aktivoitu. Alennus: ${data.coupon.discount_type === 'percentage' ? data.coupon.discount_value + '%' : data.coupon.discount_value + '€'}`
      });
      
      setCouponCode('');
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kupongin aktivoinnissa tapahtui virhe."
      });
    } finally {
      setCouponLoading(false);
    }
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!user) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Sinun täytyy olla kirjautunut sisään tehdäksesi tilauksen."
      });
      return;
    }

    // Check for rug dimensions before proceeding
    if (!checkForRugAndProceed()) {
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

    if (!formData.pickupOption || !selectedTimeSlot) {
      toast({
        variant: "destructive", 
        title: "Puuttuvia tietoja",
        description: "Valitse noutotapa ja -aika."
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        variant: "destructive",
        title: "Hyväksy ehdot",
        description: "Sinun täytyy hyväksyä ehdot tehdäksesi tilauksen."
      });
      return;
    }

    setLoading(true);

    try {
      // Show payment options instead of creating order here
      setShowPayment(true);
      
      toast({
        title: "Tiedot vahvistettu!",
        description: "Valitse maksutapa viimeistelläksesi tilauksen."
      });
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
                      
                      {isAddressEditable ? (
                        <>
                          <AddressAutocomplete
                            value={formData.address}
                            onChange={(address, coordinates) => {
                              handleInputChange('address', address);
                              if (coordinates) {
                                setAddressCoordinates(coordinates);
                              }
                            }}
                            disabled={false}
                          />
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
                            className="mt-2"
                          >
                            Tallenna osoite
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="address"
                              className="pl-10 bg-muted/30"
                              value={formData.address}
                              disabled={true}
                              placeholder="Katu 1, 00100 Helsinki"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Osoite haettu profiilista. Klikkaa "Muokkaa" muuttaaksesi tämän tilauksen osoitetta.
                          </p>
                        </>
                      )}
                    </div>

                    {/* Map right below address */}
                    {formData.address && (
                      <div className="mt-4">
                        <SimpleMap address={formData.address} />
                      </div>
                    )}
                  </div>

                  {/* Time Slot Selection */}
                  <TimeSlotSelector
                    selectedPickupOption={formData.pickupOption}
                    onPickupOptionChange={(option) => setFormData(prev => ({ ...prev, pickupOption: option }))}
                    selectedTimeSlot={selectedTimeSlot}
                    onTimeSlotChange={setSelectedTimeSlot}
                    estimatedReturnSlot={estimatedReturnSlot}
                    onEstimatedReturnChange={setEstimatedReturnSlot}
                  />

                  {/* Special Instructions */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Lisätiedot</h4>
                    <div>
                      <Label htmlFor="instructions">Erityisohjeet (valinnainen)</Label>
                      <Textarea
                        id="instructions"
                        placeholder="Kerro meille lisätietoja tilauksestasi..."
                        value={formData.specialInstructions}
                        onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Coupon Section */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Kuponki
                    </h4>
                    
                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Anna kuponkikoodi"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="flex-1"
                        />
                        <Button 
                          type="button"
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          variant="outline"
                        >
                          {couponLoading ? 'Tarkistetaan...' : 'Käytä'}
                        </Button>
                      </div>
                    ) : (
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
                  </div>


                  {/* Terms and Conditions */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        className="mt-1"
                      />
                      <div>
                        <Label 
                          htmlFor="terms" 
                          className="text-sm leading-relaxed cursor-pointer font-medium"
                        >
                          Ymmärrän, että kaikkia tahroja ei välttämättä saada poistettua ja että vaatteiden luonnollinen kuluminen tai värimuutokset eivät ole palvelun vastuulla. Olen tarkistanut, että kaikki pyykit on pussissa tilauksen yhteydessä. *
                        </Label>
                      </div>
                    </div>
                  </div>

                  {isMobile ? (
                    <SwipeToConfirm
                      onConfirm={handleSubmit}
                      text={`Swipe to confirm - ${calculateFinalPrice().toFixed(2)}€`}
                      confirmText="Vahvistettu!"
                      disabled={loading}
                      className="w-full"
                    />
                  ) : (
                    <Button
                      type="submit" 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? 'Käsitellään...' : `Valitse maksutapa (${calculateFinalPrice().toFixed(2)}€)`}
                    </Button>
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Rug Dimensions Dialog */}
      <RugDimensionsDialog
        open={showRugDimensionsDialog}
        onOpenChange={setShowRugDimensionsDialog}
        onConfirm={handleRugDimensions}
        rugName={pendingRugItem?.name || ''}
      />

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <PaymentOptions
            cartItems={cartItems}
            appliedCoupon={appliedCoupon}
            formData={{
              ...formData,
              selectedTimeSlot,
              estimatedReturnSlot
            }}
            amount={calculateFinalPrice()}
            onPaymentComplete={() => {
              setShowPayment(false);
              setFormData({
                phone: '',
                address: '',
                specialInstructions: '',
                pickupOption: ''
              });
              setSelectedTimeSlot(null);
              setEstimatedReturnSlot(null);
              onSuccess();
            }}
            onPaymentCancel={() => setShowPayment(false)}
          />
        </div>
      )}
    </div>
  );
};