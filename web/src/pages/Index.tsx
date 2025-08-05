import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { CustomerPanel } from "@/components/CustomerPanel";
import { DriverPanel } from "@/components/DriverPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { useAuth } from "@/contexts/AuthContext";

type Panel = 'customer' | 'driver' | 'admin';

const Index = () => {
  const { userRole } = useAuth();
  const [activePanel, setActivePanel] = useState<Panel>('customer');

  // Set panel based on user role
  useEffect(() => {
    if (userRole && ['customer', 'driver', 'admin'].includes(userRole)) {
      setActivePanel(userRole as Panel);
    }
  }, [userRole]);

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'customer':
        return <CustomerPanel />;
      case 'driver':
        return <DriverPanel />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <CustomerPanel />;
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
