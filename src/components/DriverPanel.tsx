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
import { MapPin, Clock, CheckCircle, X, Phone, Package, Truck, Sparkles, RotateCcw, LogIn, LogOut, Calendar, Scale, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DriverCalendar } from "./DriverCalendar";
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
  const [currentView, setCurrentView] = useState<'orders' | 'calendar'>('orders');
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
          .select('user_id, full_name, phone')
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
        .select('full_name')
        .eq('user_id', user?.id)
        .single();

      const driverName = profile?.full_name || 'Tuntematon kuljettaja';

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
    try {
      const updateData: any = { status: newStatus };
      
      // Add timestamps for specific status changes
      if (newStatus === 'picking_up') {
        updateData.actual_pickup_time = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.actual_return_time = new Date().toISOString();
      }

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

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrderForWeight.id);

      if (error) throw error;

      toast({
        title: "Paino tallennettu!",
        description: `${weightType === 'pickup' ? 'Nouto' : 'Palautus'}paino: ${weight} kg`
      });

      setShowWeightDialog(false);
      setWeightInput('');
      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Painon tallentaminen epäonnistui."
      });
    }
  };

  const renderWeightInfo = (order: any) => {
    const hasPickupWeight = order.pickup_weight_kg !== null;
    const hasReturnWeight = order.return_weight_kg !== null;
    const weightDiff = hasPickupWeight && hasReturnWeight 
      ? Math.abs(order.return_weight_kg - order.pickup_weight_kg) 
      : 0;

    if (!hasPickupWeight && !hasReturnWeight) return null;

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-4 w-4" />
          <span className="font-medium">Painotiedot:</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Nouto:</span> 
            {hasPickupWeight ? `${order.pickup_weight_kg} kg` : 'Ei kirjattu'}
          </div>
          <div>
            <span className="text-muted-foreground">Palautus:</span> 
            {hasReturnWeight ? `${order.return_weight_kg} kg` : 'Ei kirjattu'}
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
    if (order.profiles?.full_name && 
        order.profiles.full_name.trim() !== '' && 
        order.profiles.full_name !== 'Asiakas' &&
        order.profiles.full_name !== 'Asiakas Asiakas') {
      return order.profiles.full_name;
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent text-center sm:text-left">
              Kuljettajapaneeli
            </h1>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <Button
                variant={currentView === 'orders' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('orders')}
                className="text-xs px-3"
              >
                Tilaukset
              </Button>
              <Button
                variant={currentView === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('calendar')}
                className="text-xs px-3"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Kalenteri
              </Button>
              <Button
                onClick={toggleShift}
                disabled={shiftLoading}
                variant="outline"
                size="sm"
                className="text-xs px-3"
              >
                <LogOut className="h-4 w-4 mr-1" />
                {shiftLoading ? 'Lopetetaan...' : 'Lopeta vuoro'}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-lg text-muted-foreground">
              Vuorossa - {pendingOrders.length} uutta tilausta odottaa
            </span>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
                <div className="text-sm text-muted-foreground">Odottaa</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {myOrders.filter(o => o.status === 'accepted').length}
                </div>
                <div className="text-sm text-muted-foreground">Hyväksytty</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {myOrders.filter(o => ['picking_up', 'washing', 'returning'].includes(o.status)).length}
                </div>
                <div className="text-sm text-muted-foreground">Käsittelyssä</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {myOrders.filter(o => o.status === 'delivered').length}
                </div>
                <div className="text-sm text-muted-foreground">Toimitettu</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* View Content */}
        {currentView === 'calendar' ? (
          <DriverCalendar />
        ) : (
          <>
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Ladataan tilauksia...</p>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'free')} className="space-y-6">
              <TabsList className="w-full grid grid-cols-2 md:w-auto">
                <TabsTrigger value="my">Omat keikat</TabsTrigger>
                <TabsTrigger value="free">Vapaat keikat</TabsTrigger>
              </TabsList>

              <TabsContent value="my">
                <Card className="mb-6">
                  <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-56">
                      <Label>Tila</Label>
                      <Select value={myStatusFilter} onValueChange={(v) => setMyStatusFilter(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Kaikki" /></SelectTrigger>
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
                    <div className="w-full md:w-56">
                      <Label>Järjestys</Label>
                      <Select value={mySort} onValueChange={(v) => setMySort(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Uusimmat ensin" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Uusimmat ensin</SelectItem>
                          <SelectItem value="oldest">Vanhimmat ensin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {myOrders.length > 0 ? (
                  <div className="space-y-4">
                    {/* Pagination controls for my orders */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Näytetään {myOrdersPage * 3 + 1}-{Math.min((myOrdersPage + 1) * 3, myOrders.filter(o => myStatusFilter === 'all' || o.status === myStatusFilter).length)} / {myOrders.filter(o => myStatusFilter === 'all' || o.status === myStatusFilter).length} tilausta
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOrdersPage(Math.max(0, myOrdersPage - 1))}
                          disabled={myOrdersPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Edellinen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOrdersPage(myOrdersPage + 1)}
                          disabled={(myOrdersPage + 1) * 3 >= myOrders.filter(o => myStatusFilter === 'all' || o.status === myStatusFilter).length}
                        >
                          Seuraava
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {[...myOrders]
                      .filter(o => myStatusFilter === 'all' || o.status === myStatusFilter)
                      .sort((a, b) => mySort === 'newest' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .slice(myOrdersPage * 3, (myOrdersPage + 1) * 3)
                      .map((order) => {
                        const StatusIcon = getStatusIcon(order.status);
                        const canProgress = order.status !== 'delivered';
                        return (
                          <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                                    <StatusIcon className="h-6 w-6 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{getCustomerName(order)}</h3>
                                      <Badge className={getStatusColor(order.status)}>
                                        {getStatusText(order.status)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                      <MapPin className="h-4 w-4" />
                                      {order.address}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {order.service_name} - {order.final_price}€
                                    </div>
                                    {order.special_instructions && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        <strong>Lisätiedot:</strong> {order.special_instructions}
                                      </div>
                                    )}
                                    {renderRugDimensions(order.order_items || [])}
                                    {renderWeightInfo(order)}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {canProgress && (
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      onClick={() => handleStatusUpdate(order.id, getNextStatus(order.status))}
                                      className="w-36"
                                    >
                                      {getNextStatusText(order.status)}
                                    </Button>
                                  )}
                                  {(order.status === 'picking_up' || order.status === 'washing') && !order.pickup_weight_kg && (
                                    <Button variant="outline" size="sm" onClick={() => handleWeightInput(order.id, 'pickup')} className="w-36">
                                      <Scale className="h-4 w-4 mr-1" />
                                      Noutopaino
                                    </Button>
                                  )}
                                  {order.status === 'returning' && !order.return_weight_kg && (
                                    <Button variant="outline" size="sm" onClick={() => handleWeightInput(order.id, 'return')} className="w-36">
                                      <Scale className="h-4 w-4 mr-1" />
                                      Palautuspaino
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${order.phone}`)} className="w-36 text-xs">
                                    <Phone className="h-4 w-4 mr-1" />
                                    Soita asiakkaalle
                                  </Button>
                                </div>
                              </div>
                              <div className="border-t pt-4">
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
                  <div className="space-y-4">
                    {/* Pagination controls */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Näytetään {pendingPage * ordersPerPage + 1}-{Math.min((pendingPage + 1) * ordersPerPage, pendingOrders.length)} / {pendingOrders.length} tilausta
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingPage(Math.max(0, pendingPage - 1))}
                          disabled={pendingPage === 0}
                        >
                          Edellinen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingPage(pendingPage + 1)}
                          disabled={(pendingPage + 1) * ordersPerPage >= pendingOrders.length}
                        >
                          Seuraava
                        </Button>
                      </div>
                    </div>
                    
                    {pendingOrders
                      .slice(pendingPage * ordersPerPage, (pendingPage + 1) * ordersPerPage)
                      .map((order) => (
                      <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100">
                                <Clock className="h-6 w-6 text-yellow-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{getCustomerName(order)}</h3>
                                  <Badge variant="outline">{order.service_name}</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <MapPin className="h-4 w-4" />
                                  {order.address}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Tilattu: {new Date(order.created_at).toLocaleString('fi-FI')}
                                </div>
                                {renderRugDimensions(order.order_items || [])}
                                <div className="text-lg font-semibold text-primary mt-2">{order.final_price}€</div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <DriverTimeManager 
                                order={order} 
                                onOrderUpdate={async () => {
                                  console.log('🔄 Order accepted via DriverTimeManager, switching to My orders tab');
                                  setActiveTab('my');
                                  await fetchOrders();
                                }}
                              />
                              <Button variant="outline" size="sm" onClick={() => setShowRejectDialog(order.id)} className="w-28">
                                <X className="h-4 w-4 mr-1" />
                                Hylkää
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${order.phone}`)} className="w-28 text-xs">
                                <Phone className="h-4 w-4 mr-1" />
                                Soita
                              </Button>
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
          </>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kirjaa painotieto</DialogTitle>
              <DialogDescription>
                {weightType === 'pickup' ? 'Syötä pussin kokonaispaino noudettaessa' : 'Syötä pussin kokonaispaino palautettaessa'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="weight">Paino (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="esim. 2.5"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowWeightDialog(false)}>
                  Peruuta
                </Button>
                <Button onClick={handleWeightSave} disabled={!weightInput.trim()}>
                  Tallenna paino
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
