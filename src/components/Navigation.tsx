import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Truck, Settings, LogOut, UserCircle, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import pesuniLogo from "@/assets/pesuni-logo.png";

interface NavigationProps {
  activePanel: 'customer' | 'driver' | 'admin';
  onPanelChange: (panel: 'customer' | 'driver' | 'admin') => void;
}

export const Navigation = ({ activePanel, onPanelChange }: NavigationProps) => {
  const { userRole, user, signOut } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Fetch pending orders count for drivers
  useEffect(() => {
    if (userRole === 'driver' || userRole === 'admin') {
      const fetchPendingOrders = async () => {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('id', { count: 'exact' })
            .eq('status', 'pending');

          if (error) throw error;
          setPendingOrdersCount(data?.length || 0);
        } catch (error) {
          console.error('Error fetching pending orders:', error);
        }
      };

      fetchPendingOrders();

      // Set up real-time subscription for pending orders
      const channel = supabase
        .channel('pending-orders-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.pending'
          },
          () => fetchPendingOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole, user]);
  
  const panels = [
    { id: "customer" as const, label: "Asiakas", icon: User, roles: ["customer", "admin"] },
    { id: "driver" as const, label: "Kuljettaja", icon: Truck, roles: ["driver", "admin"] },
    { id: "admin" as const, label: "Ylläpito", icon: Settings, roles: ["admin"] },
  ];

  const availablePanels = panels.filter(panel => {
    // Hide "Customer" option for customer role users on all screens
    if (panel.id === "customer" && userRole === "customer") return false;
    return panel.roles.includes(userRole as string || "customer");
  });

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <img src={pesuniLogo} alt="Pesuni" className="h-8" />
          </div>
          
          <div className="flex items-center space-x-2">
            {availablePanels.map((panel) => {
              const Icon = panel.icon;
              const showNotification = panel.id === 'driver' && pendingOrdersCount > 0 && (userRole === 'driver' || userRole === 'admin');
              
              return (
                <div key={panel.id} className="relative">
                  <Button
                    variant={activePanel === panel.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onPanelChange(panel.id as 'customer' | 'driver' | 'admin')}
                    className="hidden md:flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{panel.label}</span>
                  </Button>
                  {showNotification && (
                    <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                      {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/profile'}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <UserCircle className="h-4 w-4" />
              <span className="hidden md:inline">Profiili</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Kirjaudu ulos</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};