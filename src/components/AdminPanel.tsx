import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp, 
  Euro, 
  Clock, 
  CheckCircle, 
  BarChart3, 
  Truck, 
  ChevronRight, 
  ArrowLeft,
  Headphones,
  Sliders,
  Sparkles,
  Megaphone,
  MapPin,
  Calendar,
  CreditCard,
  Settings,
  ShieldCheck,
  MessageSquare
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
  
  // Pääosio: 'hub' (Etusivu), 'management' (Hallinta), 'support' (Asiakaspalvelu), 'appmanager' (App Manager)
  const [activeSection, setActiveSection] = useState<AdminSection>('hub');
  
  // Hallinta-osion alavälilehti
  const [managementTab, setManagementTab] = useState<string>('customers');
  
  // Tilastot
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
    
    // Check for tab preference from profile or session
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

    // Set up real-time subscription for support_chats updates
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
      // Total orders
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Active orders
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm font-medium text-muted-foreground">Ladataan ylläpitoa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-16">
      <div className="container mx-auto px-3 sm:px-6 py-6 max-w-7xl space-y-6">
        
        {/* YLÄPALKKI & GLOBAALI NAVIGAATIO DASHBOARD-VALITSIN */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {activeSection === 'hub' && 'Pesuni Ylläpidon Ohjauskeskus'}
                {activeSection === 'management' && '🏢 Hallinta Dashboard'}
                {activeSection === 'support' && '🎧 Asiakaspalvelu & Välitys Dashboard'}
                {activeSection === 'appmanager' && '⚙️ App Manager Dashboard'}
              </span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold uppercase tracking-wider">
                Ylläpito
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {activeSection === 'hub' && 'Keskitetty pääsy liiketoiminnan hallintaan, asiakaspalveluun ja sovellukseen'}
              {activeSection === 'management' && 'Käyttäjätunnukset, hinnastot, palvelualueet, maksut ja järjestelmäasetukset'}
              {activeSection === 'support' && 'Reaaliaikainen keikkavälitys, tuki-inbox ja tilaushaku'}
              {activeSection === 'appmanager' && 'Mobiilisovelluksen kampanjat, bannerit ja luottamusmerkit'}
            </p>
          </div>

          {/* DASHBOARD SWITCHER BUTTONS */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={activeSection === 'hub' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('hub')}
              className="font-semibold text-xs sm:text-sm h-9"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Etusivu
            </Button>
            <Button
              variant={activeSection === 'management' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('management')}
              className="font-semibold text-xs sm:text-sm h-9"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Hallinta
            </Button>
            <Button
              variant={activeSection === 'support' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('support')}
              className="font-semibold text-xs sm:text-sm h-9 relative"
            >
              <Headphones className="h-4 w-4 mr-1.5" />
              Asiakaspalvelu
              {unreadChatsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold">
                  {unreadChatsCount}
                </span>
              )}
            </Button>
            <Button
              variant={activeSection === 'appmanager' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('appmanager')}
              className="font-semibold text-xs sm:text-sm h-9"
            >
              <Sliders className="h-4 w-4 mr-1.5" />
              App Manager
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 1. YLLÄPIDON ETUSIVU (HUB / 3 PÄÄDASHBOARD-KORTTIA) */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'hub' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI STATS ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="border shadow-sm bg-card hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kokonaismyynti</p>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">{stats.revenue.toFixed(2)} €</h3>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{stats.totalOrders} tilausta yhteensä</p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-blue-50 text-primary flex items-center justify-center dark:bg-blue-950">
                    <Euro className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-card hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aktiiviset tilaukset</p>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">{stats.activeOrders} kpl</h3>
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5">Käsittelyssä tai jaossa</p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-950">
                    <Package className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-card hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tänään valmiit</p>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">{stats.completedToday} kpl</h3>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Toimitettu asiakkaalle</p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center dark:bg-emerald-950">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-card hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aktiiviset kuljettajat</p>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">{activeDrivers.length} kuskia</h3>
                    <p className="text-[11px] text-primary font-medium mt-0.5">Vuorossa tällä hetkellä</p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center dark:bg-sky-950">
                    <Truck className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 3 HERO DASHBOARD CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 1. HALLINTA DASHBOARD CARD */}
              <Card className="border-2 hover:border-primary/50 shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between group bg-gradient-to-b from-card to-blue-50/20 dark:to-card">
                <div>
                  <CardHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                        <Settings className="h-6 w-6" />
                      </div>
                      <Badge className="bg-primary/15 text-primary border-primary/30 font-bold px-3 py-1">
                        Liiketoiminta & Asetukset
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      Hallinta Dashboard
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                      Liiketoiminnan ohjaus, käyttäjätunnukset, tuotteiden hinnastot, kuponkikampanjat, palvelualueet, noutoajat ja maksuliikenne.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-6 py-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">👥 Käyttäjät</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">📦 Tuotteet & Hinnat</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🎫 Kupongit</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🗺️ Palvelualueet</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🕒 Ajoaikataulut</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">💰 Maksut</span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-4">
                  <Button 
                    className="w-full h-12 text-sm font-bold rounded-xl shadow-sm group-hover:shadow transition-all"
                    onClick={() => setActiveSection('management')}
                  >
                    Avaa Hallinta Dashboard
                    <ChevronRight className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>

              {/* 2. ASIAKASPALVELU DASHBOARD CARD */}
              <Card className="border-2 hover:border-emerald-500/50 shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between group bg-gradient-to-b from-card to-emerald-50/20 dark:to-card">
                <div>
                  <CardHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform dark:bg-emerald-950">
                        <Headphones className="h-6 w-6" />
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 font-bold px-3 py-1 dark:text-emerald-400">
                        Live Välitys & Tuki
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      Asiakaspalvelu Dashboard
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                      Reaaliaikainen keikkataulu ja tilausten välitys kuljettajille, asiakaspalvelun tuki-chat ja monipuolinen tilaus- & puhelinhaku.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-6 py-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🚦 Välityskeskus</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">
                        💬 Tuki-Chat {unreadChatsCount > 0 ? `(${unreadChatsCount} uutta)` : ''}
                      </span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🔍 Tilaushaku & PIN</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">⚠️ Reklamaatiot</span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-4">
                  <Button 
                    className="w-full h-12 text-sm font-bold rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                    onClick={() => setActiveSection('support')}
                  >
                    Avaa Asiakaspalvelu Dashboard
                    <ChevronRight className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>

              {/* 3. APP MANAGER DASHBOARD CARD */}
              <Card className="border-2 hover:border-purple-500/50 shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between group bg-gradient-to-b from-card to-purple-50/20 dark:to-card">
                <div>
                  <CardHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform dark:bg-purple-950">
                        <Sliders className="h-6 w-6" />
                      </div>
                      <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 font-bold px-3 py-1 dark:text-purple-400">
                        Mobiilisovellus
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      App Manager Dashboard
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                      Mobiilisovelluksen etusivun kampanjabannerit, erikoistarjoukset, luottamusmerkit ja esittelytekstit.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-6 py-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">📣 Kampanjat & Tarjoukset</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">🖼️ Mainosbannerit</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">⭐ Luottamusmerkit</span>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-foreground">📱 Sovellussisällöt</span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-4">
                  <Button 
                    className="w-full h-12 text-sm font-bold rounded-xl shadow-sm bg-purple-600 hover:bg-purple-700 text-white transition-all"
                    onClick={() => setActiveSection('appmanager')}
                  >
                    Avaa App Manager Dashboard
                    <ChevronRight className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 2. HALLINTA DASHBOARD (MANAGEMENT ALANÄKYMÄ)        */}
        {/* ---------------------------------------------------- */}
        {activeSection === 'management' && (
          <div className="space-y-6 animate-fade-in">
            {/* SUB-HEADER & SUB-TABS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin Ohjauskeskukseen
              </Button>

              {/* Subtabs selector */}
              <div className="w-full sm:w-auto">
                <Select value={managementTab} onValueChange={setManagementTab}>
                  <SelectTrigger className="w-full sm:w-[240px] h-9 text-xs font-semibold">
                    <SelectValue placeholder="Valitse hallintaosio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">👥 Käyttäjien hallinta</SelectItem>
                    <SelectItem value="products">📦 Tuotteiden hallinta</SelectItem>
                    <SelectItem value="categories">🗂️ Kategoriat</SelectItem>
                    <SelectItem value="coupons">🎫 Kuponkien hallinta</SelectItem>
                    <SelectItem value="service-areas">🗺️ Palvelualueet</SelectItem>
                    <SelectItem value="time-slots">🕒 Toimitus- ja noutoajat</SelectItem>
                    <SelectItem value="settlements">💰 Maksuliikenne</SelectItem>
                    <SelectItem value="app-settings">⚙️ Järjestelmäasetukset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Pills for Desktop */}
            <div className="hidden md:flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border overflow-x-auto">
              <Button
                variant={managementTab === 'customers' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('customers')}
                className="h-8 text-xs font-semibold"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Käyttäjät
              </Button>
              <Button
                variant={managementTab === 'products' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('products')}
                className="h-8 text-xs font-semibold"
              >
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Tuotteet
              </Button>
              <Button
                variant={managementTab === 'categories' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('categories')}
                className="h-8 text-xs font-semibold"
              >
                <Sliders className="h-3.5 w-3.5 mr-1.5" />
                Kategoriat
              </Button>
              <Button
                variant={managementTab === 'coupons' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('coupons')}
                className="h-8 text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Kupongit
              </Button>
              <Button
                variant={managementTab === 'service-areas' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('service-areas')}
                className="h-8 text-xs font-semibold"
              >
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Palvelualueet
              </Button>
              <Button
                variant={managementTab === 'time-slots' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('time-slots')}
                className="h-8 text-xs font-semibold"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Ajoajat
              </Button>
              <Button
                variant={managementTab === 'settlements' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('settlements')}
                className="h-8 text-xs font-semibold"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Maksuliikenne
              </Button>
              <Button
                variant={managementTab === 'app-settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setManagementTab('app-settings')}
                className="h-8 text-xs font-semibold"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Asetukset
              </Button>
            </div>

            {/* TAB CONTENT */}
            <div className="pt-2">
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
            <div className="flex items-center justify-between pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin Ohjauskeskukseen
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
            <div className="flex items-center justify-between pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('hub')}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Takaisin Ohjauskeskukseen
              </Button>
            </div>

            <AppManager />
          </div>
        )}

      </div>
    </div>
  );
};