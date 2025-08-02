import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/UserManagement";
import { Reports } from "@/components/Reports";
import { CouponManagement } from "@/components/CouponManagement";
import { 
  Users, 
  Package, 
  TrendingUp, 
  Euro, 
  Clock, 
  CheckCircle, 
  Search,
  Eye,
  BarChart3,
  Calendar
} from "lucide-react";

interface Order {
  id: string;
  user_id: string;
  driver_id?: string;
  service_type: string;
  service_name: string;
  status: string;
  created_at: string;
  accepted_at?: string;
  actual_pickup_time?: string;
  actual_return_time?: string;
  price: number;
  final_price: number;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  pickup_option?: string;
  return_option?: string;
  pickup_date?: string;
  pickup_time?: string;
  return_date?: string;
  return_time?: string;
  special_instructions?: string;
  // Join data
  customer_email?: string;
  driver_name?: string;
  profiles?: {
    full_name?: string;
    phone?: string;
  };
}

interface Stats {
  totalOrders: number;
  activeOrders: number;
  completedToday: number;
  revenue: number;
}

export const AdminPanel = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    completedToday: 0,
    revenue: 0
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchOrders();
    fetchStats();
    
    // Check for tab preference from Profile navigation
    const preferredTab = sessionStorage.getItem('adminTab');
    if (preferredTab === 'users') {
      setActiveTab('customers');
      sessionStorage.removeItem('adminTab');
    } else if (preferredTab === 'reports') {
      setActiveTab('reports');
      sessionStorage.removeItem('adminTab');
    }
  }, []);

  const fetchOrders = async () => {
    try {
      // First fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Then fetch driver profiles for orders that have drivers
      const driverIds = ordersData?.filter(o => o.driver_id).map(o => o.driver_id) || [];
      let driverProfiles: any[] = [];
      
      if (driverIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', driverIds);
        
        driverProfiles = profilesData || [];
      }

      // Combine orders with driver profiles
      const ordersWithDrivers = ordersData?.map(order => ({
        ...order,
        profiles: order.driver_id 
          ? driverProfiles.find(p => p.user_id === order.driver_id)
          : null
      })) || [];

      setOrders(ordersWithDrivers);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Total orders
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Active orders (not delivered, rejected or cancelled)
      const { count: activeOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(delivered,rejected,cancelled)');

      // Completed today
      const today = new Date().toISOString().split('T')[0];
      const { count: completedToday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .gte('updated_at', today);

      const { data: revenueData } = await supabase
        .from('orders')
        .select('final_price')
        .eq('status', 'delivered');

      const revenue = revenueData?.reduce((sum, order) => sum + (order.final_price || 0), 0) || 0;

      setStats({
        totalOrders: totalOrders || 0,
        activeOrders: activeOrders || 0,
        completedToday: completedToday || 0,
        revenue
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      // Add timestamp for specific status changes
      if (newStatus === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      } else if (newStatus === 'picking_up') {
        updateData.actual_pickup_time = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.actual_return_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Refresh data
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'picking_up':
        return 'bg-purple-100 text-purple-800';
      case 'washing':
        return 'bg-orange-100 text-orange-800';
      case 'returning':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Odottaa';
      case 'accepted':
        return 'Hyväksytty';
      case 'picking_up':
        return 'Haetaan';
      case 'washing':
        return 'Pesussa';
      case 'returning':
        return 'Palautetaan';
      case 'delivered':
        return 'Toimitettu';
      case 'rejected':
        return 'Hylätty';
      default:
        return status;
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Ladataan tilauksia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Ylläpitäjäpaneeli
          </h1>
          <p className="text-lg text-muted-foreground">
            Hallitse tilauksia ja seuraa liiketoimintaa
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Yleiskatsaus</TabsTrigger>
            <TabsTrigger value="orders">Tilaukset</TabsTrigger>
            <TabsTrigger value="customers">Käyttäjät</TabsTrigger>
            <TabsTrigger value="coupons">Kupongit</TabsTrigger>
            <TabsTrigger value="reports">Raportit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tilaukset yhteensä</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">Kaikki tilaukset</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktiiviset tilaukset</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeOrders}</div>
                  <p className="text-xs text-muted-foreground">Käsittelyssä tällä hetkellä</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tänään valmistuneet</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedToday}</div>
                  <p className="text-xs text-muted-foreground">Päivän suoritukset</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Kokonaistulot</CardTitle>
                  <Euro className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.revenue}€</div>
                  <p className="text-xs text-muted-foreground">Valmiit tilaukset</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Viimeisimmät tilaukset</CardTitle>
                <CardDescription>Uusimmat tilaukset reaaliajassa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{order.first_name} {order.last_name}</h4>
                          <p className="text-sm text-muted-foreground">#{order.id.slice(0, 8)} - {order.service_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">{order.final_price}€</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="animate-fade-in">
            {/* Search and Filters */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Hae tilauksia (asiakas, tilausnumero, palvelu...)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={statusFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('all')}
                    >
                      Kaikki
                    </Button>
                    <Button
                      variant={statusFilter === 'pending' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('pending')}
                    >
                      Odottaa
                    </Button>
                    <Button
                      variant={statusFilter === 'accepted' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('accepted')}
                    >
                      Hyväksytty
                    </Button>
                    <Button
                      variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('delivered')}
                    >
                      Toimitettu
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders List */}
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{order.first_name} {order.last_name}</h3>
                          <p className="text-sm text-muted-foreground">#{order.id.slice(0, 8)} - {order.service_name}</p>
                          <p className="text-sm text-muted-foreground">Tilattu: {new Date(order.created_at).toLocaleDateString('fi-FI')}</p>
                          {order.driver_name && (
                            <p className="text-sm text-muted-foreground">Kuljettaja: {order.driver_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                          <p className="text-lg font-semibold mt-1">{order.final_price}€</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => openOrderDetails(order)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Avaa
                          </Button>
                          {order.status !== 'delivered' && order.status !== 'rejected' && (
                            <>
                              {order.status === 'pending' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'accepted')}>
                                  Hyväksy
                                </Button>
                              )}
                              {order.status === 'accepted' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'picking_up')}>
                                  Merkitse haettavaksi
                                </Button>
                              )}
                              {order.status === 'picking_up' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'washing')}>
                                  Aloita pesu
                                </Button>
                              )}
                              {order.status === 'washing' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'returning')}>
                                  Aloita palautus
                                </Button>
                              )}
                              {order.status === 'returning' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                  Merkitse toimitetuksi
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="customers" className="animate-fade-in">
            <UserManagement />
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="animate-fade-in">
            <CouponManagement />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="animate-fade-in">
            <Reports />
          </TabsContent>
        </Tabs>

        {/* Order Details Dialog */}
        <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tilauksen tiedot</DialogTitle>
              <DialogDescription>
                Tilauksen #{selectedOrder?.id.slice(0, 8)} yksityiskohtaiset tiedot
              </DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div>
                  <h3 className="font-semibold mb-2">Asiakastiedot</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nimi:</span>
                      <p className="font-medium">{selectedOrder.first_name} {selectedOrder.last_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sähköposti:</span>
                      <p className="font-medium">{selectedOrder.customer_email || 'Ei saatavilla'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Puhelin:</span>
                      <p className="font-medium">{selectedOrder.phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Osoite:</span>
                      <p className="font-medium">{selectedOrder.address}</p>
                    </div>
                  </div>
                </div>

                {/* Order Info */}
                <div>
                  <h3 className="font-semibold mb-2">Tilauksen tiedot</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Palvelu:</span>
                      <p className="font-medium">{selectedOrder.service_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hinta:</span>
                      <p className="font-medium">{selectedOrder.final_price}€</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tila:</span>
                      <Badge className={getStatusColor(selectedOrder.status)}>
                        {getStatusText(selectedOrder.status)}
                      </Badge>
                    </div>
                     <div>
                       <span className="text-muted-foreground">Kuljettaja:</span>
                       <p className="font-medium">
                         {selectedOrder.profiles?.full_name || 'Ei määritetty'}
                       </p>
                       {selectedOrder.profiles?.phone && (
                         <p className="text-xs text-muted-foreground">
                           Puh: {selectedOrder.profiles.phone}
                         </p>
                       )}
                     </div>
                  </div>
                </div>

                {/* Pickup/Return Options */}
                <div>
                  <h3 className="font-semibold mb-2">Nouto ja palautus</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Noutovaihtoehto:</span>
                      <p className="font-medium">
                        {selectedOrder.pickup_option === 'immediate' ? 'Heti' : 
                         selectedOrder.pickup_option === 'choose_time' ? 'Valittu aika' : 
                         selectedOrder.pickup_option === 'no_preference' ? 'Ei väliä' : 'Ei määritetty'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Palautusvaihtoehto:</span>
                      <p className="font-medium">
                        {selectedOrder.return_option === 'immediate' ? 'Heti' : 
                         selectedOrder.return_option === 'choose_time' ? 'Valittu aika' : 
                         selectedOrder.return_option === 'no_preference' ? 'Ei väliä' : 'Ei määritetty'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div>
                  <h3 className="font-semibold mb-2">Aikaleimoja</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tilaus luotu:</span>
                      <span>{new Date(selectedOrder.created_at).toLocaleString('fi-FI')}</span>
                    </div>
                    {selectedOrder.accepted_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hyväksytty:</span>
                        <span>{new Date(selectedOrder.accepted_at).toLocaleString('fi-FI')}</span>
                      </div>
                    )}
                    {selectedOrder.actual_pickup_time && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Noudettu:</span>
                        <span>{new Date(selectedOrder.actual_pickup_time).toLocaleString('fi-FI')}</span>
                      </div>
                    )}
                    {selectedOrder.actual_return_time && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Palautettu:</span>
                        <span>{new Date(selectedOrder.actual_return_time).toLocaleString('fi-FI')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Special Instructions */}
                {selectedOrder.special_instructions && (
                  <div>
                    <h3 className="font-semibold mb-2">Erityisohjeet</h3>
                    <p className="text-sm bg-muted p-3 rounded">{selectedOrder.special_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};