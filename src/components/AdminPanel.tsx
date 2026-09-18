import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/UserManagement";
import { CouponManagement } from "@/components/CouponManagement";
import { ProductManagement } from "@/components/ProductManagement";
import { CustomerServicePanel } from "@/components/CustomerServicePanel";
import { ServiceAreaManagement } from "@/components/ServiceAreaManagement";
import { TimeSlotManagement } from "@/components/TimeSlotManagement";
import { CategoryManagement } from "@/components/CategoryManagement";
import { AppSettingsManagement } from "@/components/AppSettingsManagement";
import { SettlementManagement } from "@/components/SettlementManagement";
import { AppManager } from "@/components/AppManager";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Package, 
  Euro, 
  Clock, 
  CheckCircle, 
  BarChart3, 
  Truck, 
  ArrowLeft,
  Headphones,
  Sliders,
  Sparkles,
  MapPin,
  CreditCard,
  Settings,
  ArrowRight
} from "lucide-react";

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

type AdminSection = 'hub' | 'management' | 'support' | 'appmanager';

export const AdminPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeSection, setActiveSection] = useState<AdminSection>('hub');
  const [managementTab, setManagementTab] = useState<string>('customers');
  
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    completedToday: 0,
    revenue: 0
  });
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchActiveDrivers();
    fetchUnreadChatsCount();
    
    const preferredTab = sessionStorage.getItem('adminTab');
    if (preferredTab) {
      if (['dispatch', 'chat', 'crm'].includes(preferredTab)) {
        setActiveSection('support');
      } else if (preferredTab === 'app-campaigns') {
        setActiveSection('appmanager');
      } else {
        setActiveSection('management');
        setManagementTab(preferredTab);
      }
      sessionStorage.removeItem('adminTab');
    }

    const chatsSubscription = supabase
      .channel('support_chats_changes_admin')
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

  const fetchStats = async () => {
    try {
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { count: activeOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(delivered,rejected,cancelled)');

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
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveDrivers = async () => {
    try {
      const { data: activeShifts, error } = await supabase
        .from('driver_shifts')
        .select(`
          id,
          driver_id,
          started_at,
          profiles:driver_id (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('is_active', true);

      if (error) throw error;

      const formattedDrivers = (activeShifts || []).map((shift: any) => ({
        id: shift.driver_id,
        first_name: shift.profiles?.first_name || 'Tuntematon',
        last_name: shift.profiles?.last_name || 'Kuljettaja',
        phone: shift.profiles?.phone,
        started_at: shift.started_at
      }));

      setActiveDrivers(formattedDrivers);
    } catch (error) {
      console.error('Error fetching active drivers:', error);
    }
  };

  const fetchUnreadChatsCount = async () => {
    try {
      const { count } = await supabase
        .from('support_chats')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('is_read', false);

      setUnreadChatsCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread chats count:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="text-xs text-muted-foreground">Ladataan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className={cn("mx-auto px-2 sm:px-4 py-4 space-y-5", activeSection === 'support' ? "w-full max-w-[1850px]" : "max-w-7xl")}>
        
        {/* YLÄPALKKI & NAVIGAATIO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {activeSection === 'hub' && 'Ylläpito'}
              {activeSection === 'management' && 'Hallinta'}
              {activeSection === 'support' && 'Asiakaspalvelu & Välitys'}
              {activeSection === 'appmanager' && 'App Manager'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeSection === 'hub' && 'Valitse haluamasi hallintanäkymä'}
              {activeSection === 'management' && 'Käyttäjät, tuotteet, alueet ja asetukset'}
              {activeSection === 'support' && 'Reaaliaikainen keikkavälitys ja tuki'}
              {activeSection === 'appmanager' && 'Sovelluksen kampanjat ja sisällöt'}
            </p>
          </div>

          {/* NAVIGAATIONAPIT */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={activeSection === 'hub' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('hub')}
              className="text-xs h-8"
            >
              Etusivu
            </Button>
            <Button
              variant={activeSection === 'management' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('management')}
              className="text-xs h-8"
            >
              Hallinta
            </Button>
            <Button
              variant={activeSection === 'support' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('support')}
              className="text-xs h-8 relative"
            >
              Asiakaspalvelu
              {unreadChatsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-primary text-primary-foreground rounded-full text-[10px] font-semibold">
                  {unreadChatsCount}
                </span>
              )}
            </Button>
            <Button
              variant={activeSection === 'appmanager' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('appmanager')}
              className="text-xs h-8"
            >
              App Manager
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 1. YLLÄPIDON ETUSIVU (MINIMALISTINEN HUB)            */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'hub' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI STATS ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Kokonaismyynti</p>
                <h3 className="text-lg font-bold text-foreground mt-1">{stats.revenue.toFixed(2)} €</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stats.totalOrders} tilausta</p>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Aktiiviset tilaukset</p>
                <h3 className="text-lg font-bold text-foreground mt-1">{stats.activeOrders} kpl</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Käsittelyssä</p>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Tänään toimitettu</p>
                <h3 className="text-lg font-bold text-foreground mt-1">{stats.completedToday} kpl</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Valmiit tilaukset</p>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground">Kuljettajat vuorossa</p>
                <h3 className="text-lg font-bold text-foreground mt-1">{activeDrivers.length} kpl</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Aktiivisena nyt</p>
              </div>
            </div>

            {/* 3 MINIMALISTISTA DASHBOARD-KORTTIA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* 1. HALLINTA */}
              <div className="p-5 rounded-xl border bg-card flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-semibold text-base text-foreground">Hallinta</h2>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Käyttäjien ja kuljettajien tilit, tuotteiden hinnastot, kuponkikampanjat, palvelualueet, noutoajat ja maksutiedot.
                  </p>
                </div>

                <Button 
                  variant="outline"
                  className="w-full text-xs h-9 justify-between"
                  onClick={() => setActiveSection('management')}
                >
                  Avaa Hallinta
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 2. ASIAKASPALVELU */}
              <div className="p-5 rounded-xl border bg-card flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-semibold text-base text-foreground">Asiakaspalvelu & Välitys</h2>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Reaaliaikainen keikkataulu ja kuljettajajako, asiakaspalvelun tuki-chat sekä tilaus- ja yhteystietohaku.
                  </p>
                </div>

                <Button 
                  variant="outline"
                  className="w-full text-xs h-9 justify-between"
                  onClick={() => setActiveSection('support')}
                >
                  Avaa Asiakaspalvelu
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 3. APP MANAGER */}
              <div className="p-5 rounded-xl border bg-card flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-semibold text-base text-foreground">App Manager</h2>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mobiilisovelluksen etusivun bannerit, kampanjat, luottamusmerkit ja esittelysisällöt.
                  </p>
                </div>

                <Button 
                  variant="outline"
                  className="w-full text-xs h-9 justify-between"
                  onClick={() => setActiveSection('appmanager')}
                >
                  Avaa App Manager
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 2. HALLINTA DASHBOARD                                */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'management' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin etusivulle
              </Button>

              {/* Mobile Select */}
              <div className="w-full sm:hidden">
                <Select value={managementTab} onValueChange={setManagementTab}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Valitse osio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">Käyttäjät</SelectItem>
                    <SelectItem value="products">Tuotteet</SelectItem>
                    <SelectItem value="categories">Kategoriat</SelectItem>
                    <SelectItem value="coupons">Kupongit</SelectItem>
                    <SelectItem value="service-areas">Palvelualueet</SelectItem>
                    <SelectItem value="time-slots">Ajoajat</SelectItem>
                    <SelectItem value="settlements">Maksuliikenne</SelectItem>
                    <SelectItem value="app-settings">Asetukset</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop Sub-tabs */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-muted/50 rounded-lg border">
                <Button
                  variant={managementTab === 'customers' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('customers')}
                  className="h-7 text-xs px-2.5"
                >
                  Käyttäjät
                </Button>
                <Button
                  variant={managementTab === 'products' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('products')}
                  className="h-7 text-xs px-2.5"
                >
                  Tuotteet
                </Button>
                <Button
                  variant={managementTab === 'categories' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('categories')}
                  className="h-7 text-xs px-2.5"
                >
                  Kategoriat
                </Button>
                <Button
                  variant={managementTab === 'coupons' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('coupons')}
                  className="h-7 text-xs px-2.5"
                >
                  Kupongit
                </Button>
                <Button
                  variant={managementTab === 'service-areas' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('service-areas')}
                  className="h-7 text-xs px-2.5"
                >
                  Palvelualueet
                </Button>
                <Button
                  variant={managementTab === 'time-slots' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('time-slots')}
                  className="h-7 text-xs px-2.5"
                >
                  Ajoajat
                </Button>
                <Button
                  variant={managementTab === 'settlements' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('settlements')}
                  className="h-7 text-xs px-2.5"
                >
                  Maksuliikenne
                </Button>
                <Button
                  variant={managementTab === 'app-settings' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setManagementTab('app-settings')}
                  className="h-7 text-xs px-2.5"
                >
                  Asetukset
                </Button>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div>
              {managementTab === 'customers' && <UserManagement />}
              {managementTab === 'products' && <ProductManagement />}
              {managementTab === 'categories' && <CategoryManagement />}
              {managementTab === 'coupons' && <CouponManagement />}
              {managementTab === 'service-areas' && <ServiceAreaManagement />}
              {managementTab === 'time-slots' && <TimeSlotManagement />}
              {managementTab === 'settlements' && <SettlementManagement />}
              {managementTab === 'app-settings' && <AppSettingsManagement />}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 3. ASIAKASPALVELU DASHBOARD                          */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'support' && (
          <div className="space-y-4 animate-fade-in">
            <div className="pb-3 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin etusivulle
              </Button>
            </div>

            <CustomerServicePanel />
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 4. APP MANAGER DASHBOARD                             */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'appmanager' && (
          <div className="space-y-4 animate-fade-in">
            <div className="pb-3 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin etusivulle
              </Button>
            </div>

            <AppManager />
          </div>
        )}

      </div>
    </div>
  );
};