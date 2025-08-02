import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, CheckCircle, X, Phone, Package, Truck, Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTimeForm, setShowTimeForm] = useState<string | null>(null);
  const [timeData, setTimeData] = useState({
    pickupTime: '',
    returnTime: ''
  });

  useEffect(() => {
    if (user) {
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
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch pending orders
      const { data: pending, error: pendingError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (pendingError) throw pendingError;

      // Fetch driver's assigned orders
      const { data: assigned, error: assignedError } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', user.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      if (assignedError) throw assignedError;

      setPendingOrders(pending || []);
      setMyOrders(assigned || []);
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
        .eq('status', 'pending');

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
        description: "Tilauksen hyväksyminen epäonnistui."
      });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: "Tilaus hylätty",
        description: "Tilaus on siirretty toiselle kuljettajalle."
      });

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
        description: "Täytä sekä nouto- että palautusaika."
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          actual_pickup_time: timeData.pickupTime,
          actual_return_time: timeData.returnTime
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Ajat asetettu!",
        description: "Asiakas saa ilmoituksen ajoista."
      });

      setShowTimeForm(null);
      setTimeData({ pickupTime: '', returnTime: '' });
      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Aikojen asettaminen epäonnistui."
      });
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus as any })
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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Kuljettajapaneeli
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            {pendingOrders.length} uutta tilausta odottaa hyväksyntää
          </p>
          
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
                            <h3 className="font-semibold">{order.first_name} {order.last_name}</h3>
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
                          <div className="text-lg font-semibold text-primary mt-2">
                            {order.final_price}€
                            {order.discount_code && (
                              <span className="text-sm text-green-600 ml-2">({order.discount_code})</span>
                            )}
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
                          onClick={() => handleRejectOrder(order.id)}
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
                              <h3 className="font-semibold">{order.first_name} {order.last_name}</h3>
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
                            Soita
                          </Button>
                        </div>
                      </div>

                      {/* Time Setting Form */}
                      {showTimeForm === order.id && (
                        <div className="border-t pt-4 bg-accent/30 p-4 rounded-lg">
                          <h4 className="font-semibold mb-4">Aseta nouto- ja palautusajat</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="pickupTime">Noutoaika</Label>
                              <Input
                                id="pickupTime"
                                type="datetime-local"
                                value={timeData.pickupTime}
                                onChange={(e) => setTimeData(prev => ({ ...prev, pickupTime: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="returnTime">Palautusaika</Label>
                              <Input
                                id="returnTime"
                                type="datetime-local"
                                value={timeData.returnTime}
                                onChange={(e) => setTimeData(prev => ({ ...prev, returnTime: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button 
                              variant="hero" 
                              size="sm"
                              onClick={() => handleSetTimes(order.id)}
                            >
                              Tallenna ajat
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowTimeForm(null)}
                            >
                              Peruuta
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Order Details */}
                      {order.actual_pickup_time && (
                        <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Sovittu noutoaika:</p>
                            <p className="font-medium">
                              {new Date(order.actual_pickup_time).toLocaleString('fi-FI')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sovittu palautusaika:</p>
                            <p className="font-medium">
                              {new Date(order.actual_return_time).toLocaleString('fi-FI')}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && pendingOrders.length === 0 && myOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ei tilauksia</h3>
            <p className="text-muted-foreground">Uusia tilauksia ei ole tällä hetkellä.</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Ladataan tilauksia...</p>
          </div>
        )}
      </div>
    </div>
  );
};