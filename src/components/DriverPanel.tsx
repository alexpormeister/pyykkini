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
import { MapPin, Clock, CheckCircle, X, Phone, Package, Truck, Sparkles, RotateCcw, LogIn, LogOut, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DriverCalendar } from "./DriverCalendar";

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

  useEffect(() => {
    if (user) {
      checkShiftStatus();
    }
  }, [user]);

  useEffect(() => {
    if (user && isOnShift) {
      fetchOrders();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('orders-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          () => fetchOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isOnShift]);

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
    if (!user || !isOnShift) return;
    
    setLoading(true);
    try {
      // Fetch pending orders (only visible to drivers on shift)
      const { data: pending, error: pendingError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            service_name,
            quantity,
            rug_dimensions,
            metadata
          )
        `)
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch driver's assigned orders
      const { data: assigned, error: assignedError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            service_name,
            quantity,
            rug_dimensions,
            metadata
          )
        `)
        .eq('driver_id', user.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      if (assignedError) throw assignedError;

      // Fetch customer profiles separately
      const allOrders = [...(pending || []), ...(assigned || [])];
      const customerIds = allOrders.map(order => order.user_id);
      
      let customerProfiles: any[] = [];
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', customerIds);
        customerProfiles = profiles || [];
      }

      // Add customer info to orders
      const pendingWithProfiles = pending?.map(order => ({
        ...order,
        profiles: customerProfiles.find(p => p.user_id === order.user_id)
      })) || [];

      const assignedWithProfiles = assigned?.map(order => ({
        ...order,
        profiles: customerProfiles.find(p => p.user_id === order.user_id)
      })) || [];

      setPendingOrders(pendingWithProfiles);
      setMyOrders(assignedWithProfiles);
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
      const { error } = await supabase
        .from('orders')
        .update({
          driver_id: user?.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('status', 'pending')
        .is('driver_id', null);

      if (error) throw error;

      toast({
        title: "Tilaus hyväksytty!",
        description: "Voit nyt asettaa nouto- ja palautusajat."
      });

      fetchOrders();
      setShowTimeForm(orderId);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilauksen hyväksyminen epäonnistui. Toinen kuljettaja on ehkä jo hyväksynyt sen."
      });
      fetchOrders(); // Refresh to see current state
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
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Kuljettajapaneeli
            </h1>
            <div className="flex gap-2">
              <Button
                variant={currentView === 'orders' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('orders')}
              >
                Tilaukset
              </Button>
              <Button
                variant={currentView === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('calendar')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Kalenteri
              </Button>
              <Button
                onClick={toggleShift}
                disabled={shiftLoading}
                variant="outline"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
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

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6">Uudet tilaukset</h2>
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100">
                          <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{order.profiles?.full_name || `${order.first_name} ${order.last_name}`}</h3>
                            <Badge variant="outline">{order.service_name}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="h-4 w-4" />
                            {order.address}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Nouto: {new Date(order.pickup_date).toLocaleDateString('fi-FI')} klo {order.pickup_time}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Palautus: {new Date(order.return_date).toLocaleDateString('fi-FI')} klo {order.return_time}
                          </div>
                          {order.special_instructions && (
                            <div className="text-sm text-muted-foreground mt-1">
                              <strong>Lisätiedot:</strong> {order.special_instructions}
                            </div>
                          )}
                          {renderRugDimensions(order.order_items || [])}
                          <div className="text-lg font-semibold text-primary mt-2">
                            {order.final_price}€
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="hero" 
                          size="sm"
                          onClick={() => handleAcceptOrder(order.id)}
                          className="w-28"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Hyväksy
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowRejectDialog(order.id)}
                          className="w-28"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Hylkää
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(`tel:${order.phone}`)}
                          className="w-28 text-xs"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Soita
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Orders */}
        {myOrders.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6">Omat tilaukset</h2>
            <div className="space-y-4">
              {myOrders.map((order) => {
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
                              <h3 className="font-semibold">{order.profiles?.full_name || `${order.first_name} ${order.last_name}`}</h3>
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
                          
                          {order.status === 'accepted' && !order.actual_pickup_time && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowTimeForm(order.id)}
                              className="w-36"
                            >
                              Aseta ajat
                            </Button>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(`tel:${order.phone}`)}
                            className="w-36 text-xs"
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Soita asiakkaalle
                          </Button>
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Nouto:</strong><br />
                          {new Date(order.pickup_date).toLocaleDateString('fi-FI')} klo {order.pickup_time}
                          {order.actual_pickup_time && (
                            <div className="text-green-600">
                              Todellinen: {new Date(order.actual_pickup_time).toLocaleString('fi-FI')}
                            </div>
                          )}
                        </div>
                        <div>
                          <strong>Palautus:</strong><br />
                          {new Date(order.return_date).toLocaleDateString('fi-FI')} klo {order.return_time}
                          {order.actual_return_time && (
                            <div className="text-green-600">
                              Todellinen: {new Date(order.actual_return_time).toLocaleString('fi-FI')}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

            {!loading && pendingOrders.length === 0 && myOrders.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Ei tilauksia</h3>
                <p className="text-muted-foreground">
                  Tällä hetkellä ei ole uusia tilauksia saatavilla.
                </p>
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
      </div>
    </div>
  );
};
