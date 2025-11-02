import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Banknote, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

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

  const createOrderViaEdgeFunction = async (method: 'stripe' | 'cash' | 'free') => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    // First validate the order server-side
    const { data: validatedOrder, error: validationError } = await supabase.functions.invoke('validate-order', {
      body: {
        cartItems: cartItems.map(item => ({
          serviceId: item.serviceId,
          quantity: item.quantity
        })),
        phone: formData.phone,
        address: formData.address,
        specialInstructions: formData.specialInstructions,
        pickupOption: formData.pickupOption,
        selectedTimeSlot: formData.selectedTimeSlot,
        estimatedReturnSlot: formData.estimatedReturnSlot,
        couponCode: appliedCoupon?.code
      }
    });

    if (validationError) {
      logger.error('Order validation error:', validationError);
      throw new Error('Order validation failed');
    }

    if (!validatedOrder?.valid) {
      throw new Error('Invalid order data');
    }

    // Create the order server-side
    const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-order', {
      body: {
        validatedOrder,
        formData,
        cartItems,
        paymentMethod: method
      }
    });

    if (orderError) {
      logger.error('Order creation error:', orderError);
      throw new Error('Failed to create order');
    }

    return orderResult;
  };

  const handleStripePayment = async () => {
    setIsProcessing(true);
    try {
      const orderResult = await createOrderViaEdgeFunction('stripe');
      
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          order_id: orderResult.orderId,
          amount: orderResult.finalPrice,
          currency: 'eur'
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onPaymentComplete();
      }
    } catch (error) {
      logger.error('Payment error:', error);
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
      const orderResult = await createOrderViaEdgeFunction('cash');
      
      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: 'cash',
          payment_status: 'paid',
          payment_amount: orderResult.finalPrice,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderResult.orderId);

      if (error) throw error;

      toast({
        title: "Käteismaksu valittu",
        description: "Maksu suoritetaan käteisellä kuljettajalle.",
        variant: "default",
      });

      onPaymentComplete();
    } catch (error) {
      logger.error('Cash payment error:', error);
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
      const orderResult = await createOrderViaEdgeFunction('free');
      
      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: 'free',
          payment_status: 'paid',
          payment_amount: 0,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderResult.orderId);

      if (error) throw error;

      toast({
        title: "Ilmainen maksu",
        description: "Tilaus merkitty ilmaiseksi testausta varten.",
        variant: "default",
      });

      onPaymentComplete();
    } catch (error) {
      logger.error('Free payment error:', error);
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
