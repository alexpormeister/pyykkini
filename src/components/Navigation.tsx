import { Button } from "@/components/ui/button";
import { User, Truck, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavigationProps {
  activePanel: 'customer' | 'driver' | 'admin';
  onPanelChange: (panel: 'customer' | 'driver' | 'admin') => void;
}

export const Navigation = ({ activePanel, onPanelChange }: NavigationProps) => {
  const { userRole, signOut } = useAuth();
  
  const panels = [
    { id: "customer" as const, label: "Asiakas", icon: User, roles: ["customer", "admin"] },
    { id: "driver" as const, label: "Kuljettaja", icon: Truck, roles: ["driver", "admin"] },
    { id: "admin" as const, label: "Ylläpito", icon: Settings, roles: ["admin"] },
  ];

  const availablePanels = panels.filter(panel => 
    panel.roles.includes(userRole as string || "customer")
  );

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Vaatepesupalvelu
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {availablePanels.map((panel) => {
              const Icon = panel.icon;
              return (
                <Button
                  key={panel.id}
                  variant={activePanel === panel.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPanelChange(panel.id as 'customer' | 'driver' | 'admin')}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {panel.label}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Kirjaudu ulos
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};