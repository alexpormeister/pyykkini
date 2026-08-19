import { Button } from "@/components/ui/button";
import { User, Truck, Settings, LogOut, UserCircle, WashingMachine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
// Logo removed - using image directly from uploads

interface NavigationProps {
  activePanel: 'customer' | 'driver' | 'admin' | 'laundry';
  onPanelChange: (panel: 'customer' | 'driver' | 'admin' | 'laundry') => void;
}

export const Navigation = ({ activePanel, onPanelChange }: NavigationProps) => {
  const { userRole, signOut } = useAuth();
  
  const panels = [
    { id: "customer" as const, label: "Asiakas", icon: User, roles: ["customer", "admin"] },
    { id: "driver" as const, label: "Kuljettaja", icon: Truck, roles: ["driver", "admin"] },
    { id: "laundry" as const, label: "Pesula", icon: WashingMachine, roles: ["laundry", "admin"] },
    { id: "admin" as const, label: "Ylläpito", icon: Settings, roles: ["admin"] },
  ];

  const availablePanels = panels.filter(panel => {
    // Hide "Customer" option for customer role users on all screens
    if (panel.id === "customer" && userRole === "customer") return false;
    return panel.roles.includes(userRole as string || "customer");
  });

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <img src="/lovable-uploads/08c6977a-49b1-49fc-84e2-ffb8957e8f41.png" alt="Pesuni" className="h-6 sm:h-8" />
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            {availablePanels.map((panel) => {
              const Icon = panel.icon;
              const showNotification = panel.id === 'driver' && pendingOrdersCount > 0 && (userRole === 'driver' || userRole === 'admin');
              
              return (
                <div key={panel.id} className="relative">
                  <Button
                    variant={activePanel === panel.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onPanelChange(panel.id as 'customer' | 'driver' | 'admin' | 'laundry')}
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline lg:inline">{panel.label}</span>
                  </Button>
                  {showNotification && (
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-4 sm:min-w-[20px] sm:h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
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
              className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-3"
            >
              <UserCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Profiili</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-3"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Kirjaudu ulos</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};