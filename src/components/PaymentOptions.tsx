import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Banknote, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentOptionsProps {
  cartItems: Array<{
    id: string;
    type: 'service' | 'addon' | 'bundle';
    serviceId: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    metadata?: any;
  }>;
  appliedCoupon?: {
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  formData: {
    phone: string;
    address: string;
    specialInstructions: string;
    pickupOption: string;
    selectedTimeSlot?: {
      start: string;
      end: string;
      date: string;
      display: string;
    };
    estimatedReturnSlot?: {
      start: string;
      end: string;
      date: string;
      display: string;
    };
  };
  amount: number;
  onPaymentComplete: () => void;
  onPaymentCancel: () => void;
}

export function PaymentOptions({ cartItems, appliedCoupon, formData, amount, onPaymentComplete, onPaymentCancel }: PaymentOptionsProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const createOrder = async () => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Calculate subtotal
    const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Parse pickup and delivery slots as timestamps
    const pickupSlot = formData.selectedTimeSlot 
      ? new Date(`${formData.selectedTimeSlot.date}T${formData.selectedTimeSlot.start}:00`).toISOString()
      : null;
    
    const deliverySlot = formData.estimatedReturnSlot
      ? new Date(`${formData.estimatedReturnSlot.date}T${formData.estimatedReturnSlot.start}:00`).toISOString()
      : null;
    
    // Create the main order first with new schema
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        service_type: 'multiple',
        service_name: cartItems.length === 1 ? cartItems[0].name : `${cartItems.length} palvelua`,
        price: subtotal,
        final_price: amount,
        first_name: 'Asiakas',
        last_name: 'Asiakas',
        phone: formData.phone,
        address: formData.address,
        special_instructions: formData.specialInstructions || null,
        pickup_option: formData.pickupOption,
        pickup_date: formData.selectedTimeSlot?.date || currentDate,
        pickup_time: formData.selectedTimeSlot?.start || currentTime,
        return_option: 'automatic',
        return_date: formData.estimatedReturnSlot?.date || currentDate,
        return_time: formData.estimatedReturnSlot?.start || currentTime,
        discount_code: appliedCoupon?.code || null,
        terms_accepted: true,
        status: 'pending',
        // New fields for updated schema
        pickup_slot: pickupSlot,
        delivery_slot: deliverySlot,
        tracking_status: 'PENDING',
        access_code: null // Can be added to form if needed
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items with new schema
    const orderItems = cartItems.map(item => ({
      order_id: orderData.id,
      service_type: item.serviceId,
      service_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      metadata: item.metadata || null,
      rug_dimensions: item.metadata?.rugDimensions ? 
        `${item.metadata.rugDimensions.length}cm x ${item.metadata.rugDimensions.width}cm` : 
        null,
      // New fields for updated schema
      product_name: item.name,
      unit_price_charged: item.price,
      dimensions_cm: item.metadata?.rugDimensions ? {
        width: item.metadata.rugDimensions.width,
        length: item.metadata.rugDimensions.length
      } : null
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      throw itemsError;
    }

    // Update coupon usage count if one was applied
    if (appliedCoupon) {
      const { data: currentCoupon } = await supabase
        .from('coupons')
        .select('usage_count')
        .eq('code', appliedCoupon.code)
        .single();
      
      if (currentCoupon) {
        await supabase
          .from('coupons')
          .update({ 
            usage_count: currentCoupon.usage_count + 1
          })
          .eq('code', appliedCoupon.code);
      }
    }

    // Update user's profile with phone and address if needed
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('address, phone')
      .eq('user_id', user.id)
      .single();

    if (currentProfile && (currentProfile.address !== formData.address || currentProfile.phone !== formData.phone)) {
      await supabase
        .from('profiles')
        .update({ 
          address: formData.address,
          phone: formData.phone 
        })
        .eq('user_id', user.id);
    }

    return orderData.id;
  };

  const handleStripePayment = async () => {
    setIsProcessing(true);
    try {
      // First create the order
      const orderId = await createOrder();
      
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          order_id: orderId,
          amount: amount,
          currency: 'eur'
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
        onPaymentComplete();
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Maksuvirhje",
        description: "Maksun käsittelyssä tapahtui virhe. Yritä uudelleen.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPayment = async () => {
    setIsProcessing(true);
    try {
      // First create the order
      const orderId = await createOrder();
      
      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: 'cash',
          payment_status: 'paid',
          payment_amount: amount,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Käteismaksu valittu",
        description: "Maksu suoritetaan käteisellä kuljettajalle.",
        variant: "default",
      });

      onPaymentComplete();
    } catch (error) {
      console.error('Cash payment error:', error);
      toast({
        title: "Virhe",
        description: "Käteismaksun tallentamisessa tapahtui virhe.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFreePayment = async () => {
    setIsProcessing(true);
    try {
      // First create the order
      const orderId = await createOrder();
      
      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: 'free',
          payment_status: 'paid',
          payment_amount: 0,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Ilmainen maksu",
        description: "Tilaus merkitty ilmaiseksi testausta varten.",
        variant: "default",
      });

      onPaymentComplete();
    } catch (error) {
      console.error('Free payment error:', error);
      toast({
        title: "Virhe",
        description: "Ilmaisen maksun tallentamisessa tapahtui virhe.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = () => {
    switch (paymentMethod) {
      case 'stripe':
        handleStripePayment();
        break;
      case 'cash':
        handleCashPayment();
        break;
      case 'free':
        handleFreePayment();
        break;
      default:
        break;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Valitse maksutapa
        </CardTitle>
        <CardDescription>
          Loppusumma: {amount.toFixed(2)}€
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="stripe" id="stripe" />
            <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer flex-1">
              <CreditCard className="h-4 w-4" />
              <div>
                <div className="font-medium">Korttimaksu</div>
                <div className="text-sm text-muted-foreground">Visa, Mastercard, Apple Pay</div>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="cash" id="cash" />
            <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
              <Banknote className="h-4 w-4" />
              <div>
                <div className="font-medium">Käteinen</div>
                <div className="text-sm text-muted-foreground">Maksu kuljettajalle</div>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="free" id="free" />
            <Label htmlFor="free" className="flex items-center gap-2 cursor-pointer flex-1">
              <TestTube className="h-4 w-4" />
              <div>
                <div className="font-medium">Ilmainen (Testi)</div>
                <div className="text-sm text-muted-foreground">Testausta varten</div>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <div className="flex gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={onPaymentCancel}
            className="flex-1"
          >
            Peruuta
          </Button>
          <Button 
            onClick={handlePayment}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? "Käsitellään..." : "Maksa"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}