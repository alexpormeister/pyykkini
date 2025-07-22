import { Button } from "@/components/ui/button";
import { User, Truck, Settings } from "lucide-react";

interface NavigationProps {
  activePanel: 'customer' | 'driver' | 'admin';
  onPanelChange: (panel: 'customer' | 'driver' | 'admin') => void;
}

export const Navigation = ({ activePanel, onPanelChange }: NavigationProps) => {
  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              PesulaPalvelu
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={activePanel === 'customer' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPanelChange('customer')}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Asiakas
            </Button>
            <Button
              variant={activePanel === 'driver' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPanelChange('driver')}
              className="flex items-center gap-2"
            >
              <Truck className="h-4 w-4" />
              Kuljettaja
            </Button>
            <Button
              variant={activePanel === 'admin' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPanelChange('admin')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Ylläpito
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};