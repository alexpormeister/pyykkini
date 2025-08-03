import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, Users, DollarSign, Package, Clock, Calendar, Download } from 'lucide-react';

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  completedOrders: number;
  pendingOrders: number;
  rejectedOrders: number;
  topService: string;
  totalCustomers: number;
  activeDrivers: number;
}

interface DriverPerformance {
  driver_name: string;
  driver_id: string;
  total_orders: number;
  completed_orders: number;
  rejected_orders: number;
  total_revenue: number;
  completion_rate: number;
  rejection_rate: number;
}

export const Reports = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformance[]>([]);
  const [revenueByService, setRevenueByService] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, [timeRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));
      const dateFilter = daysAgo.toISOString();

      // Fetch order statistics
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', dateFilter);

      if (ordersError) throw ordersError;

      // Fetch driver performance
      const { data: drivers, error: driversError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name
        `);

      if (driversError) throw driversError;

      // Calculate order statistics
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.final_price || 0), 0) || 0;
      const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const rejectedOrders = orders?.filter(o => o.status === 'rejected').length || 0;

      // Service analysis
      const serviceCount: { [key: string]: number } = {};
      const serviceRevenue: { [key: string]: number } = {};
      
      orders?.forEach(order => {
        serviceCount[order.service_name] = (serviceCount[order.service_name] || 0) + 1;
        serviceRevenue[order.service_name] = (serviceRevenue[order.service_name] || 0) + order.final_price;
      });

      const topService = Object.keys(serviceCount).reduce((a, b) => 
        serviceCount[a] > serviceCount[b] ? a : b, ''
      );

      // Unique customers
      const uniqueCustomers = new Set(orders?.map(o => o.user_id)).size;

      // Get drivers with role filter
      const { data: driverRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');

      if (rolesError) throw rolesError;

      const driverIds = driverRoles?.map(r => r.user_id) || [];
      const driverProfiles = drivers?.filter(d => driverIds.includes(d.user_id)) || [];

      // Driver performance calculation
      const driverStats: DriverPerformance[] = driverProfiles.map((driver) => {
        const driverOrders = orders?.filter(o => o.driver_id === driver.user_id) || [];
        const completed = driverOrders.filter(o => o.status === 'delivered').length;
        const rejected = driverOrders.filter(o => o.status === 'rejected').length;
        const total = driverOrders.length;
        const revenue = driverOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

        return {
          driver_name: driver.full_name || 'Tuntematon',
          driver_id: driver.user_id,
          total_orders: total,
          completed_orders: completed,
          rejected_orders: rejected,
          total_revenue: revenue,
          completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
          rejection_rate: total > 0 ? Math.round((rejected / total) * 100) : 0,
        };
      });

      // Revenue by service
      const revenueData = Object.keys(serviceRevenue).map(service => ({
        service,
        revenue: serviceRevenue[service],
        orders: serviceCount[service] || 0
      }));

      setOrderStats({
        totalOrders,
        totalRevenue,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        completedOrders,
        pendingOrders,
        rejectedOrders,
        topService,
        totalCustomers: uniqueCustomers,
        activeDrivers: driverProfiles?.length || 0
      });

      setDriverPerformance(driverStats.sort((a, b) => b.total_revenue - a.total_revenue));
      setRevenueByService(revenueData.sort((a, b) => b.revenue - a.revenue));

    } catch (error: any) {
      console.error('Error fetching reports:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Raporttien lataaminen epäonnistui'
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const csvData = [
      ['Kuljettaja', 'Tilaukset yhteensä', 'Valmistuneet', 'Hylätyt', 'Liikevaihto', 'Valmistumisprosentti'],
      ...driverPerformance.map(driver => [
        driver.driver_name,
        driver.total_orders,
        driver.completed_orders,
        driver.rejected_orders,
        `${driver.total_revenue}€`,
        `${driver.completion_rate}%`
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raportit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Ladataan raportteja...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-fredoka flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Raportit ja analytics
          </h2>
          <p className="text-muted-foreground">Suorituskyky- ja myyntiraportit</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Valitse aikaväli" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Viimeiset 7 päivää</SelectItem>
              <SelectItem value="30">Viimeiset 30 päivää</SelectItem>
              <SelectItem value="90">Viimeiset 3 kuukautta</SelectItem>
              <SelectItem value="365">Viimeiset 12 kuukautta</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Vie CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kokonaisliikevaihto</p>
                <p className="text-2xl font-bold text-green-600">{orderStats?.totalRevenue?.toFixed(2) || '0.00'}€</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tilaukset yhteensä</p>
                <p className="text-2xl font-bold">{orderStats?.totalOrders}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Keskimääräinen tilausarvo</p>
                <p className="text-2xl font-bold">{orderStats?.averageOrderValue}€</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktiiviset asiakkaat</p>
                <p className="text-2xl font-bold">{orderStats?.totalCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tilausten tila
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Valmistuneet</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">{orderStats?.completedOrders}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {orderStats?.totalOrders ? Math.round((orderStats.completedOrders / orderStats.totalOrders) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Odottaa</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800">{orderStats?.pendingOrders}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {orderStats?.totalOrders ? Math.round((orderStats.pendingOrders / orderStats.totalOrders) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Hylätyt</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">{orderStats?.rejectedOrders}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {orderStats?.totalOrders ? Math.round((orderStats.rejectedOrders / orderStats.totalOrders) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Palvelut liikevaihdolla</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueByService.map((service, index) => (
                <div key={service.service} className="flex items-center justify-between">
                  <span>{service.service}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{service.revenue.toFixed(2)}€</span>
                    <Badge variant="outline">{service.orders} til.</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Kuljettajien suorituskyky</CardTitle>
          <CardDescription>Kuljettajien tilastot valitulta ajanjaksolta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Kuljettaja</th>
                  <th className="text-right p-2">Tilaukset</th>
                  <th className="text-right p-2">Valmistuneet</th>
                  <th className="text-right p-2">Hylätyt</th>
                  <th className="text-right p-2">Liikevaihto</th>
                  <th className="text-right p-2">Valmistumis-%</th>
                  <th className="text-right p-2">Hylkäys-%</th>
                </tr>
              </thead>
              <tbody>
                {driverPerformance.map((driver) => (
                  <tr key={driver.driver_id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{driver.driver_name}</td>
                    <td className="p-2 text-right">{driver.total_orders}</td>
                    <td className="p-2 text-right">{driver.completed_orders}</td>
                    <td className="p-2 text-right">{driver.rejected_orders}</td>
                    <td className="p-2 text-right font-semibold">{driver.total_revenue.toFixed(2)}€</td>
                    <td className="p-2 text-right">
                      <Badge className={`${
                        driver.completion_rate >= 80 ? 'bg-green-100 text-green-800' :
                        driver.completion_rate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {driver.completion_rate}%
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      <Badge className={`${
                        driver.rejection_rate <= 10 ? 'bg-green-100 text-green-800' :
                        driver.rejection_rate <= 25 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {driver.rejection_rate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};