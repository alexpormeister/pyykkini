import { Button } from "@/components/ui/button";
import { Truck, Settings, LogOut, UserCircle, WashingMachine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
// Logo removed - using image directly from uploads

interface NavigationProps {
  activePanel: 'admin' | 'laundry';
  onPanelChange: (panel: 'admin' | 'laundry') => void;
}

export const Navigation = ({ activePanel, onPanelChange }: NavigationProps) => {
  const { userRole, signOut } = useAuth();
  
  const panels = [
    { id: "laundry" as const, label: "Pesula", icon: WashingMachine, roles: ["laundry", "admin"] },
    { id: "admin" as const, label: "Ylläpito", icon: Settings, roles: ["admin"] },
  ];

  const availablePanels = panels.filter(panel => panel.roles.includes(userRole as string));

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
              return (
                <Button
                  key={panel.id}
                  variant={activePanel === panel.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPanelChange(panel.id)}
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline lg:inline">{panel.label}</span>
                </Button>
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