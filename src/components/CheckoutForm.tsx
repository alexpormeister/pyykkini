import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CreditCard, MapPin, Phone, User } from 'lucide-react';

interface CheckoutFormProps {
  selectedService: {
    id: string;
    name: string;
    price: number;
    description: string;
  };
  onBack: () => void;
}

export const CheckoutForm = ({ selectedService, onBack }: CheckoutFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    specialInstructions: '',
    pickupDate: '',
    pickupTime: '',
    returnDate: '',
    returnTime: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate order processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Tilaus vastaanotettu!",
        description: `${selectedService.name} tilaus on käsittelyssä. Saat vahvistuksen sähköpostitse.`
      });
      
      // Reset form and go back
      setFormData({
        fullName: '',
        phone: '',
        address: '',
        specialInstructions: '',
        pickupDate: '',
        pickupTime: '',
        returnDate: '',
        returnTime: ''
      });
      onBack();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilauksen käsittelyssä tapahtui virhe. Yritä uudelleen."
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
          Takaisin palveluihin
        </Button>
        <h2 className="text-2xl font-semibold text-center">Tilauksen tiedot</h2>
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
                <h4 className="font-semibold">{selectedService.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedService.description}</p>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Yhteensä:</span>
                  <span className="text-2xl font-bold text-primary">{selectedService.price}€</span>
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
              {/* Customer Information */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Yhteystiedot
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Koko nimi *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Puhelinnumero *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Noutoosoite *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      className="pl-10"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Katu 1, 00100 Helsinki"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Pickup and Return Times */}
              <div className="space-y-4">
                <h4 className="font-semibold">Nouto- ja palautusajat</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pickupDate">Noutopäivä *</Label>
                    <Input
                      id="pickupDate"
                      type="date"
                      value={formData.pickupDate}
                      onChange={(e) => handleInputChange('pickupDate', e.target.value)}
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
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="returnDate">Palautuspäivä *</Label>
                    <Input
                      id="returnDate"
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => handleInputChange('returnDate', e.target.value)}
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
                      required
                    />
                  </div>
                </div>
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

              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Käsitellään...' : `Vahvista tilaus (${selectedService.price}€)`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};