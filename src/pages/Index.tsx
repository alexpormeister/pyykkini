import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { DriverPanel } from "@/components/DriverPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { LaundryPanel } from "@/components/LaundryPanel";
import { useAuth } from "@/contexts/AuthContext";

type Panel = 'driver' | 'admin' | 'laundry';

const Index = () => {
  const { userRole } = useAuth();
  const [activePanel, setActivePanel] = useState<Panel>('driver');

  // Set panel based on user role
  useEffect(() => {
    if (userRole && ['driver', 'admin', 'laundry'].includes(userRole)) {
      setActivePanel(userRole as Panel);
    }
  }, [userRole]);

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'admin':
        return <AdminPanel />;
      case 'laundry':
        return <LaundryPanel />;
      default:
        return <DriverPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation activePanel={activePanel} onPanelChange={setActivePanel} />
      {renderActivePanel()}
    </div>
  );
};

export default Index;
