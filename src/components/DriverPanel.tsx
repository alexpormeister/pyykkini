import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, CheckCircle, X, Phone, Package, Truck, Sparkles, RotateCcw, LogIn, LogOut, Scale, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DriverTimeManager } from "./DriverTimeManager";

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return Clock;
    case 'accepted': return CheckCircle;
    case 'picking_up': return Truck;
    case 'washing': return Sparkles;
    case 'returning': return Truck;
    case 'delivered': return Package;
    default: return Clock;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Odottaa hyväksyntää';
    case 'accepted': return 'Hyväksytty';
    case 'picking_up': return 'Noutamassa';
    case 'washing': return 'Pesussa';
    case 'returning': return 'Palautumassa';
    case 'delivered': return 'Toimitettu';
    case 'rejected': return 'Hylätty';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'accepted': return 'bg-blue-100 text-blue-800';
    case 'picking_up': return 'bg-purple-100 text-purple-800';
    case 'washing': return 'bg-cyan-100 text-cyan-800';
    case 'returning': return 'bg-orange-100 text-orange-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const DriverPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnShift, setIsOnShift] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTimeForm, setShowTimeForm] = useState<string | null>(null);
  const [timeData, setTimeData] = useState({
    pickupTime: '',
    returnTime: ''
  });
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Calendar view removed - only orders view now
  const [activeTab, setActiveTab] = useState<'my' | 'free'>('my');
  const [myStatusFilter, setMyStatusFilter] = useState<'all' | 'accepted' | 'picking_up' | 'washing' | 'returning' | 'delivered'>('all');
  const [mySort, setMySort] = useState<'newest' | 'oldest'>('newest');
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [selectedOrderForWeight, setSelectedOrderForWeight] = useState<any>(null);
  const [weightInput, setWeightInput] = useState('');
  const [weightType, setWeightType] = useState<'pickup' | 'return'>('pickup');
  
  // Pagination for pending orders
  const [pendingPage, setPendingPage] = useState(0);
  // Pagination for my orders
  const [myOrdersPage, setMyOrdersPage] = useState(0);
  const ordersPerPage = 3;

  useEffect(() => {
    if (user) {
      checkShiftStatus();
      // Always fetch orders to see assigned orders, regardless of shift status
      fetchOrders();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up real-time subscription for all order changes
      const channel = supabase
        .channel('orders-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          () => {
            console.log('Order change detected, refreshing...');
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const checkShiftStatus = async () => {
    if (!user) return;
    
    try {
      const { data: activeShift } = await supabase
        .from('driver_shifts')
        .select('*')
        .eq('driver_id', user.id)
        .eq('is_active', true)
        .single();

      setIsOnShift(!!activeShift);
    } catch (error) {
      // No active shift found
      setIsOnShift(false);
    }
  };

  const toggleShift = async () => {
    if (!user) return;
    
    setShiftLoading(true);
    try {
      if (isOnShift) {
        // End shift
        const { error } = await supabase
          .from('driver_shifts')
          .update({
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq('driver_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        setIsOnShift(false);
        setPendingOrders([]);
        setMyOrders([]);
        
        toast({
          title: "Vuoro päättynyt",
          description: "Olet kirjautunut ulos vuorosta."
        });
      } else {
        // Start shift
        const { error } = await supabase
          .from('driver_shifts')
          .insert({
            driver_id: user.id,
            is_active: true,
            started_at: new Date().toISOString()
          });

        if (error) throw error;

        setIsOnShift(true);
        
        toast({
          title: "Vuoro aloitettu",
          description: "Olet nyt vuorossa ja voit vastaanottaa tilauksia."
        });
        
        fetchOrders();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Vuoron vaihtaminen epäonnistui."
      });
    } finally {
      setShiftLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    
    // Check user role first
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => r.role === 'admin');
    const isDriver = userRoles?.some(r => r.role === 'driver');
    
    // For drivers: can see their assigned orders always, pending orders only when on shift
    // For admins: can see all orders always
    if (!isAdmin && !isDriver) return;
    
    setLoading(true);
    try {
      // Fetch orders using the secure function
      const { data: allDriverOrders, error: driverOrdersError } = await supabase
        .rpc('get_driver_orders');

      if (driverOrdersError) {
        console.error('Error fetching driver orders:', driverOrdersError);
        throw driverOrdersError;
      }

      console.log('📊 Raw driver orders from database:', allDriverOrders);

      // Separate pending and assigned orders
      const pending = allDriverOrders?.filter(order => 
        order.status === 'pending' && order.driver_id === null
      ) || [];
      
      const assigned = allDriverOrders?.filter(order => 
        order.driver_id === user.id
      ) || [];

      console.log('🔄 Filtered orders:', { 
        pending: pending.length, 
        assigned: assigned.length,
        currentUserId: user.id,
        assignedOrderIds: assigned.map(o => ({ id: o.id, status: o.status, driver_id: o.driver_id }))
      });

      // Now fetch order items for all orders
      const allOrderIds = [...pending.map(o => o.id), ...assigned.map(o => o.id)];
      let orderItems: any[] = [];
      
      if (allOrderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', allOrderIds);
          
        if (!itemsError) {
          orderItems = items || [];
        }
      }

      // Fetch customer profiles separately for assigned orders only (where we have full access)
      const assignedCustomerIds = assigned.map(order => order.user_id);
      
      let customerProfiles: any[] = [];
      if (assignedCustomerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone')
          .in('user_id', assignedCustomerIds);
        customerProfiles = profiles || [];
      }

      // Add order items and customer info to orders
      const pendingWithItems = pending?.map(order => ({
        ...order,
        order_items: orderItems.filter(item => item.order_id === order.id),
        profiles: null // No profile data for pending orders for security
      })) || [];

      const assignedWithItems = assigned?.map(order => ({
        ...order,
        order_items: orderItems.filter(item => item.order_id === order.id),
        profiles: customerProfiles.find(p => p.user_id === order.user_id)
      })) || [];

      setPendingOrders(pendingWithItems);
      setMyOrders(assignedWithItems);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilausten lataaminen epäonnistui."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      console.log('🚀 Starting order acceptance:', { orderId, driverId: user?.id });
      
      // Check if user exists
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('orders')
        .update({
          driver_id: user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('status', 'pending')
        .is('driver_id', null)
        .select();

      console.log('💾 Update result:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('❌ DriverPanel: No rows updated');
        
        // Check if the order still exists and what its current state is
        const { data: currentOrder, error: selectError } = await supabase
          .from('orders')
          .select('id, status, driver_id')
          .eq('id', orderId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no row found
          
        console.log('🔍 Current order query result:', { currentOrder, selectError });
        
        if (selectError) {
          console.error('❌ Cannot read order details:', selectError);
          throw new Error('Tilauksen hyväksyminen epäonnistui. Ei pääsyä tilauksen tietoihin.');
        }
        
        if (!currentOrder) {
          throw new Error('Tilausta ei löydy.');
        }
        
        if (currentOrder.driver_id && currentOrder.driver_id !== user.id) {
          throw new Error('Tilaus on jo hyväksytty toiselta kuljettajalta');
        } else if (currentOrder.status !== 'pending') {
          throw new Error(`Tilausta ei voi hyväksyä, koska sen tila on: ${currentOrder.status}`);
        } else {
          throw new Error('Tilauksen hyväksyminen epäonnistui. Tarkista käyttöoikeutesi.');
        }
      }

      console.log('✅ Order accepted successfully:', data[0]);

      toast({
        title: "Tilaus hyväksytty!",
        description: "Voit nyt asettaa nouto- ja palautusajat."
      });

      // Switch to "My orders" tab after successful acceptance
      setActiveTab('my');
      
      // Refresh orders to see updated state
      console.log('🔄 Refreshing orders...');
      await fetchOrders();
      
      // Show time form for setting pickup/return times
      setShowTimeForm(orderId);
    } catch (error: any) {
      console.error('💥 Accept order error:', error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tilauksen hyväksyminen epäonnistui. Toinen kuljettaja on ehkä jo hyväksynyt sen."
      });
      // Refresh to see current state even on error
      fetchOrders();
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Anna hylkäyksen perustelu."
      });
      return;
    }

    try {
      // Get current user's profile for the name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user?.id)
        .single();

      const driverName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Tuntematon kuljettaja';

      // Insert rejection record
      const { error: rejectionError } = await supabase
        .from('order_rejections')
        .insert({
          order_id: orderId,
          driver_id: user?.id,
          rejection_reason: rejectionReason
        });

      if (rejectionError) throw rejectionError;

      // Update order with rejection info but keep status as pending for other drivers
      const { error } = await supabase
        .from('orders')
        .update({
          special_instructions: `HYLKÄYS: Kuljettaja ${driverName} hylkäsi tilauksen ${new Date().toLocaleString('fi-FI')}. Perustelu: ${rejectionReason}`
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Tilaus hylätty",
        description: "Hylkäys on kirjattu. Tilaus pysyy näkyvissä muille kuljettajille."
      });

      setShowRejectDialog(null);
      setRejectionReason('');
      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilauksen hylkääminen epäonnistui."
      });
    }
  };

  const handleSetTimes = async (orderId: string) => {
    if (!timeData.pickupTime || !timeData.returnTime) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Valitse sekä nouto- että palautusajat"
      });
      return;
    }

    try {
      // Parse datetime-local format (YYYY-MM-DDTHH:MM)
      const pickupDateTime = new Date(timeData.pickupTime);
      const returnDateTime = new Date(timeData.returnTime);

      if (isNaN(pickupDateTime.getTime()) || isNaN(returnDateTime.getTime())) {
        throw new Error('Invalid date format');
      }

      const { error } = await supabase
        .from('orders')
        .update({
          pickup_date: pickupDateTime.toISOString().split('T')[0],
          pickup_time: pickupDateTime.toTimeString().slice(0, 5), // HH:MM format
          return_date: returnDateTime.toISOString().split('T')[0],
          return_time: returnDateTime.toTimeString().slice(0, 5), // HH:MM format
          accepted_at: new Date().toISOString(),
          status: 'accepted'
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Ajat asetettu",
        description: "Nouto- ja palautusajat on päivitetty asiakkaalle"
      });

      setShowTimeForm(null);
      setTimeData({ pickupTime: '', returnTime: '' });
      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Aikojen asettaminen epäonnistui"
      });
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    const order = myOrders.find(o => o.id === orderId);
    
    // For pickup - show weight dialog if weight is missing
    if (newStatus === 'picking_up' && !order?.pickup_weight_kg) {
      setSelectedOrderForWeight(order);
      setWeightType('pickup');
      setWeightInput('');
      setShowWeightDialog(true);
      return;
    }
    
    // For delivery - show weight dialog if return weight is missing
    if (newStatus === 'delivered' && !order?.return_weight_kg) {
      setSelectedOrderForWeight(order);
      setWeightType('return');
      setWeightInput('');
      setShowWeightDialog(true);
      return;
    }

    // Proceed with status update if no weight is needed
    await updateOrderStatus(orderId, newStatus);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // Map status to tracking_status for customer visibility
      const trackingStatusMap: Record<string, string> = {
        'pending': 'PENDING',
        'accepted': 'PICKED_UP',
        'picking_up': 'PICKED_UP',
        'washing': 'WASHING',
        'returning': 'OUT_FOR_DELIVERY',
        'delivered': 'COMPLETED'
      };

      const updateData: any = { 
        status: newStatus,
        tracking_status: trackingStatusMap[newStatus] || 'PENDING'
      };
      
      // Add timestamps for specific status changes
      if (newStatus === 'picking_up') {
        updateData.actual_pickup_time = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.actual_return_time = new Date().toISOString();
      }

      console.log('📝 Updating order status:', { orderId, newStatus, updateData });

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Tila päivitetty!",
        description: `Tilaus merkitty tilaan: ${getStatusText(newStatus)}`
      });

      fetchOrders();
    } catch (error: any) {
      console.error('❌ Error updating status:', error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilan päivittäminen epäonnistui."
      });
    }
  };

  const handleWeightInput = (orderId: string, type: 'pickup' | 'return') => {
    const order = myOrders.find(o => o.id === orderId);
    setSelectedOrderForWeight(order);
    setWeightType(type);
    setWeightInput('');
    setShowWeightDialog(true);
  };

  const handleWeightSave = async () => {
    if (!selectedOrderForWeight || !weightInput.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Anna painotieto."
      });
      return;
    }

    const weight = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Anna kelvollinen painotieto (kg)."
      });
      return;
    }

    try {
      const updateData = weightType === 'pickup' 
        ? { pickup_weight_kg: weight }
        : { return_weight_kg: weight };

      console.log('💾 Saving weight:', { orderId: selectedOrderForWeight.id, weight, type: weightType });

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrderForWeight.id);

      if (error) throw error;

      console.log('✅ Weight saved successfully');

      toast({
        title: "Paino tallennettu!",
        description: `${weightType === 'pickup' ? 'Nouto' : 'Palautus'}paino: ${weight} kg`
      });

      setShowWeightDialog(false);
      setWeightInput('');
      setSelectedOrderForWeight(null);
      
      // Refresh orders to show updated weight immediately
      await fetchOrders();
      
      // If this was for status transition, proceed with the status update
      if (weightType === 'pickup') {
        await updateOrderStatus(selectedOrderForWeight.id, 'picking_up');
      } else if (weightType === 'return') {
        await updateOrderStatus(selectedOrderForWeight.id, 'delivered');
      }
    } catch (error: any) {
      console.error('❌ Error saving weight:', error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Painon tallentaminen epäonnistui."
      });
    }
  };

  const renderWeightInfo = (order: any) => {
    return renderWeightInfoInner(order);
  };

  const formatEuro = (value: number | string | null | undefined) => {
    const num = Number(value ?? 0);
    return `${num.toFixed(2).replace('.', ',')} €`;
  };

  const formatDateTimeMinutes = (value: string) =>
    new Date(value).toLocaleString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const formatDayTime = (date?: string | null, time?: string | null) => {
    if (!date) return '—';
    const d = new Date(date);
    const day = isNaN(d.getTime())
      ? date
      : d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
    return time ? `${day} klo ${time.slice(0, 5)}` : day;
  };

  // Area only – exact street address is revealed after accepting the gig
  const getAreaLabel = (address?: string | null) => {
    if (!address) return 'Alue ei tiedossa';
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts
        .slice(1)
        .join(', ')
        .replace(/\b\d{5}\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^,\s*|,\s*$/g, '')
        .trim() || 'Alue ei tiedossa';
    }
    const withoutNumber = parts[0].replace(/\s*\d+.*$/, '').trim();
    return withoutNumber || 'Alue ei tiedossa';
  };

  const getOrderItemTags = (order: any) => {
    const items = (order.order_items || []) as any[];
    if (items.length === 0) {
      return order.service_name ? [order.service_name] : [];
    }
    return items.map(item => {
      const name = item.product_name || item.service_name;
      const qty = Number(item.quantity || 1);
      return qty > 1 ? `${name} ${qty} kpl` : name;
    });
  };

  const renderWeightInfoInner = (order: any) => {
    const hasPickupWeight = order.pickup_weight_kg !== null && order.pickup_weight_kg !== undefined;
    const hasReturnWeight = order.return_weight_kg !== null && order.return_weight_kg !== undefined;
    const weightDiff = hasPickupWeight && hasReturnWeight 
      ? Math.abs(order.return_weight_kg - order.pickup_weight_kg) 
      : 0;

    // Always show weight section if order is accepted or beyond
    if (order.status === 'pending') return null;

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-4 w-4" />
          <span className="font-medium">Painotiedot:</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Nouto:</span> 
            {order.pickup_weight_kg ? `${order.pickup_weight_kg} kg` : 'Ei kirjattu'}
          </div>
          <div>
            <span className="text-muted-foreground">Palautus:</span> 
            {order.return_weight_kg ? `${order.return_weight_kg} kg` : 'Ei kirjattu'}
          </div>
        </div>
        {hasPickupWeight && hasReturnWeight && weightDiff > 0.1 && (
          <div className="mt-1 text-xs text-orange-600">
            Painoero: {weightDiff.toFixed(1)} kg
          </div>
        )}
      </div>
    );
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'accepted': return 'picking_up';
      case 'picking_up': return 'washing';
      case 'washing': return 'returning';
      case 'returning': return 'delivered';
      default: return currentStatus;
    }
  };

  const getNextStatusText = (currentStatus: string) => {
    switch (currentStatus) {
      case 'accepted': return 'Aloita nouto';
      case 'picking_up': return 'Merkitse pesussa';
      case 'washing': return 'Aloita palautus';
      case 'returning': return 'Merkitse toimitettu';
      default: return 'Valmis';
    }
  };

  const renderRugDimensions = (orderItems: any[]) => {
    const rugItems = orderItems.filter(item => item.rug_dimensions);
    if (rugItems.length === 0) return null;

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <strong>Maton mitat:</strong>
        {rugItems.map((item, index) => (
          <div key={index}>
            {item.service_name}: {item.rug_dimensions}
          </div>
        ))}
      </div>
    );
  };

  const getCustomerName = (order: any) => {
    // Use profile name if available and not "Asiakas"
    const profileFirstName = order.profiles?.first_name;
    const profileLastName = order.profiles?.last_name;
    
    if (profileFirstName || profileLastName) {
      const fullName = `${profileFirstName || ''} ${profileLastName || ''}`.trim();
      if (fullName && fullName !== 'Asiakas' && fullName !== 'Asiakas Asiakas') {
        return fullName;
      }
    }
    
    // Fallback to order names if they're not "Asiakas"
    const firstName = order.first_name && order.first_name !== 'Asiakas' ? order.first_name : '';
    const lastName = order.last_name && order.last_name !== 'Asiakas' ? order.last_name : '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    // Last resort
    return 'Asiakas';
  };

  if (!isOnShift) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
              Kuljettajapaneeli
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Kirjaudu vuoroon nähdäksesi tilauksia
            </p>
            
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8">
                <LogIn className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-semibold mb-4">Aloita työpäivä</h2>
                <p className="text-muted-foreground mb-6">
                  Klikkaa alla olevaa painiketta aloittaaksesi vuoron ja nähdäksesi käytettävissä olevat tilaukset.
                </p>
                <Button
                  onClick={toggleShift}
                  disabled={shiftLoading}
                  size="lg"
                  className="w-full"
                >
                  {shiftLoading ? 'Kirjaudutaan...' : 'Kirjaudu vuoroon'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                Kuljettajapaneeli
              </h1>
              <Button
                onClick={toggleShift}
                disabled={shiftLoading}
                variant="outline"
                size="sm"
                className="text-xs px-2 sm:px-3"
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{shiftLoading ? 'Lopetetaan...' : 'Lopeta vuoro'}</span>
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm sm:text-base text-muted-foreground">
              Vuorossa - {pendingOrders.length} tilausta odottaa
            </span>
          </div>
          
          {/* Compact stats bar */}
          <div className="max-w-2xl mx-auto rounded-xl border bg-card/60 divide-x flex overflow-hidden">
            {[
              { label: 'Odottaa', value: pendingOrders.length },
              { label: 'Hyväksytty', value: myOrders.filter(o => o.status === 'accepted').length },
              { label: 'Käsittelyssä', value: myOrders.filter(o => ['picking_up', 'washing', 'returning'].includes(o.status)).length },
              { label: 'Toimitettu', value: myOrders.filter(o => o.status === 'delivered').length },
            ].map(stat => (
              <div key={stat.label} className="flex-1 py-2 px-1 text-center">
                <div className="text-base sm:text-lg font-semibold leading-none">{stat.value}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* View Content */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Ladataan tilauksia...</p>
          </div>
        )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'free')} className="space-y-4 sm:space-y-6">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="my" className="text-xs sm:text-sm">Omat keikat</TabsTrigger>
                <TabsTrigger value="free" className="text-xs sm:text-sm">Vapaat keikat</TabsTrigger>
              </TabsList>

              <TabsContent value="my">
                <Card className="mb-4 sm:mb-6">
                  <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-1">
                      <Label className="text-xs sm:text-sm">Tila</Label>
                      <Select value={myStatusFilter} onValueChange={(v) => setMyStatusFilter(v as any)}>
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue placeholder="Kaikki" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Kaikki</SelectItem>
                          <SelectItem value="accepted">Hyväksytty</SelectItem>
                          <SelectItem value="picking_up">Noutamassa</SelectItem>
                          <SelectItem value="washing">Pesussa</SelectItem>
                          <SelectItem value="returning">Palautumassa</SelectItem>
                          <SelectItem value="delivered">Toimitettu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs sm:text-sm">Järjestys</Label>
                      <Select value={mySort} onValueChange={(v) => setMySort(v as any)}>
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue placeholder="Uusimmat ensin" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Uusimmat ensin</SelectItem>
                          <SelectItem value="oldest">Vanhimmat ensin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {myOrders.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {[...myOrders]
                      .filter(o => myStatusFilter === 'all' || o.status === myStatusFilter)
                      .sort((a, b) => mySort === 'newest' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((order) => {
                        const StatusIcon = getStatusIcon(order.status);
                        // Can progress if status isn't delivered
                        const canProgress = order.status !== 'delivered';
                        return (
                          <Card key={order.id} className="hover:shadow-elegant transition-all duration-300 overflow-hidden">
                            <CardContent className="p-3 sm:p-6">
                              {/* Mobile-first layout */}
                              <div className="flex flex-col gap-3">
                                {/* Header with status */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-primary/10">
                                      <StatusIcon className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="font-bold text-sm sm:text-lg truncate">👤 {getCustomerName(order)}</h3>
                                      <Badge className={`${getStatusColor(order.status)} text-xs`}>
                                        {getStatusText(order.status)}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-bold text-sm sm:text-base">{order.final_price}€</div>
                                  </div>
                                </div>
                                
                                {/* Order details */}
                                <div className="space-y-1">
                                  <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                                    <span className="break-words">{order.address}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                    {order.phone}
                                  </div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">
                                    {order.service_name}
                                  </div>
                                  {order.special_instructions && (
                                    <div className="text-xs sm:text-sm text-muted-foreground mt-1 p-2 bg-muted rounded">
                                      <strong>Lisätiedot:</strong> {order.special_instructions}
                                    </div>
                                  )}
                                  {renderRugDimensions(order.order_items || [])}
                                  {renderWeightInfo(order)}
                                </div>
                                
                                {/* Action buttons - stacked on mobile */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                  {canProgress && (
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      onClick={() => handleStatusUpdate(order.id, getNextStatus(order.status))}
                                      className="w-full sm:w-auto text-xs sm:text-sm"
                                    >
                                      {getNextStatusText(order.status)}
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => window.open(`tel:${order.phone}`)} 
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                  >
                                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    Soita asiakkaalle
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Time Manager */}
                              <div className="border-t mt-3 pt-3 sm:mt-4 sm:pt-4">
                                <DriverTimeManager 
                                  order={order} 
                                  onOrderUpdate={fetchOrders}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">Ei omia tilauksia</h3>
                    <p className="text-muted-foreground">Hyväksy vapaita tilauksia aloittaaksesi.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="free">
                {pendingOrders.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Pagination controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {pendingPage * ordersPerPage + 1}-{Math.min((pendingPage + 1) * ordersPerPage, pendingOrders.length)} / {pendingOrders.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingPage(Math.max(0, pendingPage - 1))}
                          disabled={pendingPage === 0}
                          className="text-xs px-2 sm:px-3"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Edellinen</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingPage(pendingPage + 1)}
                          disabled={(pendingPage + 1) * ordersPerPage >= pendingOrders.length}
                          className="text-xs px-2 sm:px-3"
                        >
                          <span className="hidden sm:inline">Seuraava</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {pendingOrders
                      .slice(pendingPage * ordersPerPage, (pendingPage + 1) * ordersPerPage)
                      .map((order) => (
                      <Card key={order.id} className="hover:shadow-elegant transition-all duration-300 overflow-hidden">
                        <CardContent className="p-3 sm:p-6">
                          {/* Mobile-first layout */}
                          <div className="flex flex-col gap-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-yellow-100">
                                  <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-sm sm:text-base truncate">{getCustomerName(order)}</h3>
                                  <Badge variant="outline" className="text-xs">{order.service_name}</Badge>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-bold text-base sm:text-lg text-primary">{order.final_price}€</div>
                              </div>
                            </div>
                            
                            {/* Details */}
                            <div className="space-y-1">
                              <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                                <span className="break-words">{order.address}</span>
                              </div>
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                Tilattu: {new Date(order.created_at).toLocaleString('fi-FI')}
                              </div>
                              {renderRugDimensions(order.order_items || [])}
                            </div>
                            
                            {/* Actions - stacked on mobile */}
                            <div className="flex flex-col gap-2 pt-2 border-t">
                              <DriverTimeManager 
                                order={order} 
                                onOrderUpdate={async () => {
                                  console.log('🔄 Order accepted via DriverTimeManager, switching to My orders tab');
                                  setActiveTab('my');
                                  await fetchOrders();
                                }}
                              />
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setShowRejectDialog(order.id)} 
                                  className="flex-1 text-xs sm:text-sm"
                                >
                                  <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Hylkää
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => window.open(`tel:${order.phone}`)} 
                                  className="flex-1 text-xs sm:text-sm"
                                >
                                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Soita
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">Ei vapaita tilauksia</h3>
                    <p className="text-muted-foreground">Tarkista myöhemmin uudelleen.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {!loading && pendingOrders.length === 0 && myOrders.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Ei tilauksia</h3>
                <p className="text-muted-foreground">Tällä hetkellä ei ole uusia tilauksia saatavilla.</p>
              </div>
            )}

        {/* Time Setting Dialog */}
        <Dialog open={!!showTimeForm} onOpenChange={() => setShowTimeForm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aseta nouto- ja palautusajat</DialogTitle>
              <DialogDescription>
                Määritä tarkat ajat noudolle ja palautukselle
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pickup-time">Noutamisaika</Label>
                <Input
                  id="pickup-time"
                  type="datetime-local"
                  value={timeData.pickupTime}
                  onChange={(e) => setTimeData(prev => ({ ...prev, pickupTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="return-time">Palautusaika</Label>
                <Input
                  id="return-time"
                  type="datetime-local"
                  value={timeData.returnTime}
                  onChange={(e) => setTimeData(prev => ({ ...prev, returnTime: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowTimeForm(null)}>
                  Peruuta
                </Button>
                <Button onClick={() => handleSetTimes(showTimeForm!)}>
                  Tallenna ajat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={!!showRejectDialog} onOpenChange={() => setShowRejectDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hylkää tilaus</DialogTitle>
              <DialogDescription>
                Anna perustelu tilauksen hylkäämiselle
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Syy hylkäykselle..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(null)}>
                  Peruuta
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleRejectOrder(showRejectDialog!)}
                  disabled={!rejectionReason.trim()}
                >
                  Hylkää tilaus
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Weight Input Dialog */}
        <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {weightType === 'pickup' ? 'Noutopaino' : 'Palautuspaino'}
              </DialogTitle>
              <DialogDescription>
                Syötä {weightType === 'pickup' ? 'noudettujen' : 'palautettujen'} tekstiilien paino kilogrammina.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Paino (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Esim. 2.5"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleWeightSave();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWeightDialog(false)}
                className="flex-1"
              >
                Peruuta
              </Button>
              <Button
                onClick={handleWeightSave}
                disabled={!weightInput.trim() || parseFloat(weightInput) <= 0}
                className="flex-1"
              >
                <Scale className="h-4 w-4 mr-2" />
                Tallenna paino
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
