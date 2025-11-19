import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/UserManagement";
import { Reports } from "@/components/Reports";
import { CouponManagement } from "@/components/CouponManagement";
import { ProductManagement } from "@/components/ProductManagement";
import { ChatManagement } from "@/components/ChatManagement";
import { useToast } from "@/hooks/use-toast";
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
  Calendar,
  Truck,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Filter,
  RotateCcw,
  MessageSquare
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
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

interface Stats {
  totalOrders: number;
  activeOrders: number;
  completedToday: number;
  revenue: number;
}

interface ActiveDriver {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  started_at: string;
}

export const AdminPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<{[key: string]: boolean}>({
    management: true,
    orders: false,
    analytics: false
  });
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [orderToAssign, setOrderToAssign] = useState<string>("");
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchActiveDrivers();
    fetchAllDrivers();
    fetchUnreadChatsCount();
    
    // Check for tab preference from Profile navigation
    const preferredTab = sessionStorage.getItem('adminTab');
    if (preferredTab === 'users') {
      setActiveTab('customers');
      sessionStorage.removeItem('adminTab');
    } else if (preferredTab === 'reports') {
      setActiveTab('reports');
      sessionStorage.removeItem('adminTab');
    }

    // Set up real-time subscription for support_chats updates
    const chatsSubscription = supabase
      .channel('support_chats_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'support_chats' },
        () => {
          fetchUnreadChatsCount();
        }
      )
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      // First fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_history (
            id,
            change_type,
            change_description,
            created_at,
            changed_by
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch customer profiles
      const customerIds = ordersData?.map(o => o.user_id) || [];
      let customerProfiles: any[] = [];
      
      if (customerIds.length > 0) {
        const { data: customerProfilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone')
          .in('user_id', customerIds);
        
        customerProfiles = customerProfilesData || [];
      }

      // Then fetch driver profiles for orders that have drivers
      const driverIds = ordersData?.filter(o => o.driver_id).map(o => o.driver_id) || [];
      let driverProfiles: any[] = [];
      
      if (driverIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone')
          .in('user_id', driverIds);
        
        driverProfiles = profilesData || [];
      }

      // Combine orders with customer and driver profiles and fix customer names
      const ordersWithProfiles = ordersData?.map(order => {
        const customerProfile = customerProfiles.find(p => p.user_id === order.user_id);
        
        // Get history with user names
        const historyWithProfiles = order.order_history?.map((history: any) => {
          const changedByProfile = [...customerProfiles, ...driverProfiles].find(p => p.user_id === history.changed_by);
          const fullName = changedByProfile 
            ? `${changedByProfile.first_name || ''} ${changedByProfile.last_name || ''}`.trim() 
            : 'Tuntematon';
          return {
            ...history,
            profiles: {
              first_name: changedByProfile?.first_name,
              last_name: changedByProfile?.last_name,
              full_name: fullName
            }
          };
        }) || [];
        
        const driverProfile = driverProfiles.find(d => d.user_id === order.driver_id);
        const driverFullName = driverProfile 
          ? `${driverProfile.first_name || ''} ${driverProfile.last_name || ''}`.trim() 
          : null;
        
        const customerFullName = customerProfile 
          ? `${customerProfile.first_name || ''} ${customerProfile.last_name || ''}`.trim() 
          : `${order.first_name} ${order.last_name}`;
        
        return {
          ...order,
          // Use customer profile name if first_name is empty or "Asiakas"
          first_name: order.first_name === 'Asiakas' || !order.first_name 
            ? customerProfile?.first_name || order.first_name 
            : order.first_name,
          last_name: order.last_name === 'Asiakas' || !order.last_name 
            ? customerProfile?.last_name || order.last_name 
            : order.last_name,
          customer_name: customerFullName,
          customer_phone: customerProfile?.phone || order.phone,
          driver_name: driverFullName,
          order_history: historyWithProfiles
        };
      }) || [];

      setOrders(ordersWithProfiles);
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

  const fetchActiveDrivers = async () => {
    try {
      const { data: activeShifts, error } = await supabase
        .from('driver_shifts')
        .select('*')
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Fetch driver profiles
      const driverIds = activeShifts?.map(shift => shift.driver_id) || [];
      let driverProfiles: any[] = [];
      
      if (driverIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone')
          .in('user_id', driverIds);
        
        driverProfiles = profilesData || [];
      }

      const drivers = activeShifts?.map(shift => {
        const driverProfile = driverProfiles.find(p => p.user_id === shift.driver_id);
        return {
          id: shift.driver_id,
          first_name: driverProfile?.first_name || 'Tuntematon',
          last_name: driverProfile?.last_name || 'kuljettaja',
          phone: driverProfile?.phone,
          started_at: shift.started_at
        };
      }) || [];

      setActiveDrivers(drivers);
    } catch (error) {
      console.error('Error fetching active drivers:', error);
    }
  };

  const fetchAllDrivers = async () => {
    try {
      // First, get all users with driver role
      const { data: driverRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');

      if (rolesError) throw rolesError;

      const driverIds = driverRoles?.map(role => role.user_id) || [];
      if (driverIds.length === 0) {
        setAllDrivers([]);
        return;
      }

      // Then get their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', driverIds);

      if (profilesError) throw profilesError;

      // Check which drivers are currently on shift
      const { data: activeShifts } = await supabase
        .from('driver_shifts')
        .select('driver_id')
        .eq('is_active', true);

      const activeDriverIds = activeShifts?.map(shift => shift.driver_id) || [];

      const driversWithShiftStatus = profiles?.map(profile => ({
        ...profile,
        is_active: activeDriverIds.includes(profile.user_id)
      })) || [];

      setAllDrivers(driversWithShiftStatus);
    } catch (error) {
      console.error('Error fetching all drivers:', error);
    }
  };

  const fetchUnreadChatsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('support_chats')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) throw error;
      setUnreadChatsCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread chats count:', error);
    }
  };

  const assignOrderToDriver = async (orderId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_id: driverId,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Tilaus asetettu kuljettajalle',
        description: 'Tilaus on nyt asetettu valitulle kuljettajalle'
      });

      fetchOrders();
      setSelectedDriverId('');
      setOrderToAssign('');
    } catch (error) {
      console.error('Error assigning order:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Tilauksen asettaminen epäonnistui'
      });
    }
  };

  const logoutDriver = async (driverId: string) => {
    try {
      // Check if current user is admin - only allow admins to logout other drivers
      if (!user || !driverId) {
        throw new Error('Unauthorized or missing driver ID');
      }

      const { error } = await supabase
        .from('driver_shifts')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('driver_id', driverId)
        .eq('is_active', true);

      if (error) throw error;

      // Refresh the active drivers list
      fetchActiveDrivers();
      
      // Show success message
      toast({
        title: 'Kuljettaja kirjattu ulos',
        description: 'Kuljettajan vuoro on päättynyt'
      });
    } catch (error) {
      console.error('Error logging out driver:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Kuljettajan uloskirjaaminen epäonnistui'
      });
    }
  };

  const allStatusOptions = [
    { value: 'pending', label: 'Odottaa' },
    { value: 'accepted', label: 'Hyväksytty' },
    { value: 'picking_up', label: 'Haetaan' },
    { value: 'washing', label: 'Pesussa' },
    { value: 'returning', label: 'Palautuvat' },
    { value: 'delivered', label: 'Toimitettu' },
    { value: 'rejected', label: 'Hylätty' }
  ];

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    if (checked) {
      setStatusFilters(prev => [...prev, status]);
    } else {
      setStatusFilters(prev => prev.filter(s => s !== status));
    }
  };

  const resetFilters = () => {
    setStatusFilters([]);
    setDateFilter('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setSearchTerm('');
  };

  const getDateRange = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (dateFilter) {
      case 'today':
        return { start: startOfToday, end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) };
      case 'this_week':
        return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) };
      case 'this_month':
        return { start: startOfMonth, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
      case 'custom':
        return customDateStart && customDateEnd 
          ? { start: new Date(customDateStart), end: new Date(customDateEnd + 'T23:59:59') }
          : null;
      default:
        return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    // Search filter
    const matchesSearch = 
      `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(order.status);
    
    // Date filter
    let matchesDate = true;
    const dateRange = getDateRange();
    if (dateRange) {
      const orderDate = new Date(order.created_at);
      matchesDate = orderDate >= dateRange.start && orderDate <= dateRange.end;
    }
    
    return matchesSearch && matchesStatus && matchesDate;
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

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
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
          
          {/* Contact Information */}
          <div className="mt-6 p-4 bg-card rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-3 text-primary">Yhteystiedot</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📧</span>
                <a href="mailto:alex@alexsites.com" className="text-primary hover:underline">
                  alex@alexsites.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📞</span>
                <a href="tel:+358401422449" className="text-primary hover:underline">
                  +358 40 1422449
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 space-y-4">
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-2">
                  {/* Management Section */}
                  <div>
                    <button
                      onClick={() => toggleMenu('management')}
                      className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded-lg"
                    >
                      <span className="font-medium text-primary">Hallinta</span>
                      {expandedMenus.management ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {expandedMenus.management && (
                      <div className="ml-4 mt-2 space-y-1">
                        <button
                          onClick={() => setActiveTab('overview')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'overview' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Yleiskatsaus
                        </button>
                        <button
                          onClick={() => setActiveTab('drivers')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'drivers' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Aktiiviset kuljettajat
                        </button>
                        <button
                          onClick={() => setActiveTab('customers')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'customers' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Käyttäjien hallinta
                        </button>
                        <button
                          onClick={() => setActiveTab('products')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'products' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Tuotteiden hallinta
                        </button>
                        <button
                          onClick={() => setActiveTab('coupons')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'coupons' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Kuponkien hallinta
                        </button>
                        <button
                          onClick={() => setActiveTab('chat')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'chat' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Viestit
                            </div>
                            {unreadChatsCount > 0 && (
                              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                {unreadChatsCount}
                              </Badge>
                            )}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Orders Section */}
                  <div>
                    <button
                      onClick={() => toggleMenu('orders')}
                      className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded-lg"
                    >
                      <span className="font-medium text-primary">Tilaukset</span>
                      {expandedMenus.orders ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                     {expandedMenus.orders && (
                      <div className="ml-4 mt-2 space-y-1">
                        <button
                          onClick={() => setActiveTab('orders')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'orders' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Kaikki tilaukset
                        </button>
                        <button
                          onClick={() => setActiveTab('free-orders')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'free-orders' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Vapaat ajot
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Analytics Section */}
                  <div>
                    <button
                      onClick={() => toggleMenu('analytics')}
                      className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded-lg"
                    >
                      <span className="font-medium text-primary">Analytiikka</span>
                      {expandedMenus.analytics ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {expandedMenus.analytics && (
                      <div className="ml-4 mt-2 space-y-1">
                        <button
                          onClick={() => setActiveTab('reports')}
                          className={`block w-full text-left p-2 rounded text-sm hover:bg-muted ${activeTab === 'reports' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          Raportit ja tilastot
                        </button>
                      </div>
                    )}
                  </div>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8"
                  style={{ display: 'contents' }}>

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
                  <div className="text-2xl font-bold">{stats.revenue.toFixed(2)}€</div>
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

          {/* Active Drivers Tab */}
          <TabsContent value="drivers" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Aktiiviset kuljettajat
                </CardTitle>
                <CardDescription>
                  Tällä hetkellä työvuorossa olevat kuljettajat
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeDrivers.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ei aktiivisia kuljettajia</h3>
                    <p className="text-muted-foreground">Tällä hetkellä kukaan kuljettajista ei ole työvuorossa.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeDrivers.map((driver) => (
                      <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                            <Truck className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{`${driver.first_name} ${driver.last_name}`}</h3>
                            {driver.phone && (
                              <p className="text-sm text-muted-foreground">Puh: {driver.phone}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Vuoro alkanut: {driver.started_at ? new Date(driver.started_at).toLocaleString('fi-FI') : 'Tuntematon'}
                            </p>
                          </div>
                        </div>
                         <div className="flex items-center gap-2">
                           <Badge className="bg-green-100 text-green-800">
                             Aktiivinen
                           </Badge>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => logoutDriver(driver.id)}
                             className="text-xs"
                           >
                             Kirjaa ulos
                           </Button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Yhteensä aktiivisia kuljettajia:</strong> {activeDrivers.length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="animate-fade-in">
            {/* Enhanced Search and Filters */}
            <Card className="mb-6">
              <CardContent className="p-6">
                {/* Main Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="🔍 Superhaku - Hae tilauksia (asiakas, osoite, tilausnumero, palvelu...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>

                {/* Advanced Filters */}
                <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="mb-4">
                      <Filter className="h-4 w-4 mr-2" />
                      Lisäfiltterit
                      <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4">
                    {/* Status Filters */}
                    <div>
                      <Label className="text-sm font-medium">Tila (monivalinta)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        {allStatusOptions.map(status => (
                          <div key={status.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={status.value}
                              checked={statusFilters.includes(status.value)}
                              onCheckedChange={(checked) => 
                                handleStatusFilterChange(status.value, checked as boolean)
                              }
                            />
                            <Label htmlFor={status.value} className="text-sm">
                              {status.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Date Range */}
                    <div>
                      <Label className="text-sm font-medium">Aikaväli</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          variant={dateFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter('all')}
                        >
                          Kaikki
                        </Button>
                        <Button
                          variant={dateFilter === 'today' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter('today')}
                        >
                          Tänään
                        </Button>
                        <Button
                          variant={dateFilter === 'this_week' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter('this_week')}
                        >
                          Tämä viikko
                        </Button>
                        <Button
                          variant={dateFilter === 'this_month' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter('this_month')}
                        >
                          Tämä kuukausi
                        </Button>
                        <Button
                          variant={dateFilter === 'custom' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter('custom')}
                        >
                          Mukautettu
                        </Button>
                      </div>
                      
                      {dateFilter === 'custom' && (
                        <div className="flex gap-2 mt-2">
                          <div>
                            <Label htmlFor="start-date" className="text-xs">Alkaen</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={customDateStart}
                              onChange={(e) => setCustomDateStart(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="end-date" className="text-xs">Päättyen</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={customDateEnd}
                              onChange={(e) => setCustomDateEnd(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset Filters */}
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Nollaa filtterit
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                {/* Active Filters Summary */}
                {(statusFilters.length > 0 || dateFilter !== 'all' || searchTerm) && (
                  <div className="flex flex-wrap gap-2 mt-4 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Aktiiviset suodattimet:</span>
                    {searchTerm && (
                      <Badge variant="secondary">Haku: "{searchTerm}"</Badge>
                    )}
                    {statusFilters.map(status => {
                      const statusOption = allStatusOptions.find(s => s.value === status);
                      return (
                        <Badge key={status} variant="secondary">
                          {statusOption?.label}
                        </Badge>
                      );
                    })}
                    {dateFilter !== 'all' && (
                      <Badge variant="secondary">
                        {dateFilter === 'today' && 'Tänään'}
                        {dateFilter === 'this_week' && 'Tämä viikko'}
                        {dateFilter === 'this_month' && 'Tämä kuukausi'}
                        {dateFilter === 'custom' && `${customDateStart} - ${customDateEnd}`}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      ({filteredOrders.length} tilausta löytyi)
                    </span>
                  </div>
                )}
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

          {/* Products Tab */}
          <TabsContent value="products" className="animate-fade-in">
            <ProductManagement />
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="animate-fade-in">
            <CouponManagement />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="animate-fade-in">
            <ChatManagement />
          </TabsContent>

          {/* Free Orders Tab */}
          <TabsContent value="free-orders" className="animate-fade-in">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Vapaat ajot
                </CardTitle>
                <CardDescription>
                  Tilaukset ilman kuljettajaa - aseta kuljettaja
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-4 flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Hae kuljettajia nimellä..."
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {orderToAssign && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border">
                    <h4 className="font-semibold mb-3 text-blue-800">Valitse kuljettaja tilaukselle</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {allDrivers
                        .filter(driver => 
                          driver.full_name?.toLowerCase().includes(driverSearch.toLowerCase())
                        )
                        .map((driver) => (
                          <div 
                            key={driver.user_id} 
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedDriverId === driver.user_id 
                                ? 'border-primary bg-primary/10' 
                                : 'border-gray-200 hover:border-gray-300'
                            } ${
                              driver.is_active 
                                ? 'bg-green-50' 
                                : 'bg-red-50'
                            }`}
                            onClick={() => setSelectedDriverId(driver.user_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{driver.full_name}</p>
                                {driver.phone && (
                                  <p className="text-sm text-muted-foreground">Puh: {driver.phone}</p>
                                )}
                              </div>
                              <Badge 
                                className={
                                  driver.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }
                              >
                                {driver.is_active ? 'Vuorossa' : 'Ei vuorossa'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => assignOrderToDriver(orderToAssign, selectedDriverId)}
                        disabled={!selectedDriverId}
                      >
                        Aseta kuljettajalle
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setOrderToAssign('');
                          setSelectedDriverId('');
                          setDriverSearch('');
                        }}
                      >
                        Peruuta
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {orders
                .filter(order => order.status === 'pending' && !order.driver_id)
                .map((order) => (
                  <Card key={order.id} className="hover:shadow-elegant transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100">
                            <Clock className="h-6 w-6 text-yellow-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{order.first_name} {order.last_name}</h3>
                            <p className="text-sm text-muted-foreground">#{order.id.slice(0, 8)} - {order.service_name}</p>
                            <p className="text-sm text-muted-foreground">Tilattu: {new Date(order.created_at).toLocaleDateString('fi-FI')}</p>
                            <p className="text-sm text-muted-foreground">Osoite: {order.address}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Badge className="bg-yellow-100 text-yellow-800">
                              Vapaa ajo
                            </Badge>
                            <p className="text-lg font-semibold mt-1">{order.final_price}€</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => {
                                setOrderToAssign(order.id);
                                setSelectedDriverId('');
                              }}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Aseta kuljettaja
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openOrderDetails(order)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Avaa
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              
              {orders.filter(order => order.status === 'pending' && !order.driver_id).length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Ei vapaita ajoja</h3>
                  <p className="text-muted-foreground">Kaikki tilaukset on asetettu kuljettajille.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="animate-fade-in">
            <Reports />
          </TabsContent>
            </Tabs>
          </div>
        </div>

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
                         {selectedOrder.profiles?.first_name || selectedOrder.profiles?.last_name 
                           ? `${selectedOrder.profiles.first_name || ''} ${selectedOrder.profiles.last_name || ''}`.trim()
                           : 'Ei määritetty'}
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