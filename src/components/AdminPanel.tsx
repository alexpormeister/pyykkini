import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Package, 
  TrendingUp, 
  Euro, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Search,
  Filter,
  BarChart3,
  Calendar
} from "lucide-react";

interface Order {
  id: string;
  customerName: string;
  service: string;
  status: 'pending' | 'washing' | 'ready' | 'delivered';
  orderDate: string;
  pickupDate?: string;
  deliveryDate?: string;
  price: number;
  driverName?: string;
}

interface Stats {
  totalOrders: number;
  activeOrders: number;
  completedToday: number;
  revenue: number;
  avgProcessingTime: number;
}

const mockOrders: Order[] = [
  {
    id: '001',
    customerName: 'Matti Virtanen',
    service: 'Normaali pesu',
    status: 'pending',
    orderDate: '2024-01-20',
    price: 15,
    driverName: 'Jukka Kuljettaja'
  },
  {
    id: '002',
    customerName: 'Anna Korhonen',
    service: 'Urheiluvaatteet',
    status: 'washing',
    orderDate: '2024-01-19',
    pickupDate: '2024-01-19',
    price: 20
  },
  {
    id: '003',
    customerName: 'Pekka Nieminen',
    service: 'Premium-palvelu',
    status: 'ready',
    orderDate: '2024-01-18',
    pickupDate: '2024-01-18',
    price: 35,
    driverName: 'Marja Kuljettaja'
  },
  {
    id: '004',
    customerName: 'Liisa Järvinen',
    service: 'Pesu + mankelointi',
    status: 'delivered',
    orderDate: '2024-01-17',
    pickupDate: '2024-01-17',
    deliveryDate: '2024-01-19',
    price: 25,
    driverName: 'Jukka Kuljettaja'
  }
];

const mockStats: Stats = {
  totalOrders: 127,
  activeOrders: 23,
  completedToday: 8,
  revenue: 2450,
  avgProcessingTime: 36
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'washing': return 'bg-blue-100 text-blue-800';
    case 'ready': return 'bg-green-100 text-green-800';
    case 'delivered': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Odottaa noutoa';
    case 'washing': return 'Pesussa';
    case 'ready': return 'Valmis';
    case 'delivered': return 'Toimitettu';
    default: return status;
  }
};

export const AdminPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = mockOrders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.includes(searchTerm) ||
                         order.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = (orderId: string, newStatus: string) => {
    console.log(`Updating order ${orderId} to status ${newStatus}`);
    // Here would be the API call to update order status
  };

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

        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Yleiskatsaus</TabsTrigger>
            <TabsTrigger value="orders">Tilaukset</TabsTrigger>
            <TabsTrigger value="customers">Asiakkaat</TabsTrigger>
            <TabsTrigger value="reports">Raportit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tilaukset yhteensä</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">+12% edellisestä kuukaudesta</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktiiviset tilaukset</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.activeOrders}</div>
                  <p className="text-xs text-muted-foreground">Käsittelyssä tällä hetkellä</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tänään valmistuneet</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.completedToday}</div>
                  <p className="text-xs text-muted-foreground">+2 eilisestä</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Kuukauden liikevaihto</CardTitle>
                  <Euro className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.revenue}€</div>
                  <p className="text-xs text-muted-foreground">+8% edellisestä kuukaudesta</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Keskim. käsittelyaika</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.avgProcessingTime}h</div>
                  <p className="text-xs text-muted-foreground">-4h parannusta</p>
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
                  {mockOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{order.customerName}</h4>
                          <p className="text-sm text-muted-foreground">#{order.id} - {order.service}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">{order.price}€</p>
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
                      variant={statusFilter === 'washing' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('washing')}
                    >
                      Pesussa
                    </Button>
                    <Button
                      variant={statusFilter === 'ready' ? 'default' : 'outline'}
                      onClick={() => setStatusFilter('ready')}
                    >
                      Valmis
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
                          <h3 className="font-semibold">{order.customerName}</h3>
                          <p className="text-sm text-muted-foreground">#{order.id} - {order.service}</p>
                          <p className="text-sm text-muted-foreground">Tilattu: {order.orderDate}</p>
                          {order.driverName && (
                            <p className="text-sm text-muted-foreground">Kuljettaja: {order.driverName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                          <p className="text-lg font-semibold mt-1">{order.price}€</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {order.status !== 'delivered' && (
                            <>
                              {order.status === 'pending' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'washing')}>
                                  Aloita pesu
                                </Button>
                              )}
                              {order.status === 'washing' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready')}>
                                  Merkitse valmiiksi
                                </Button>
                              )}
                              {order.status === 'ready' && (
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

          {/* Customers Tab */}
          <TabsContent value="customers" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Asiakashallinta</CardTitle>
                <CardDescription>Hallitse asiakkaita ja katso tilaushistoria</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Asiakashallinta tulossa pian...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Myyntiraportit
                  </CardTitle>
                  <CardDescription>Myynti- ja tulosanalyysi</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Myyntiraportit tulossa pian...</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Suorituskykyraportit
                  </CardTitle>
                  <CardDescription>Käsittelyajat ja tehokkuus</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Suorituskykyraportit tulossa pian...</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};