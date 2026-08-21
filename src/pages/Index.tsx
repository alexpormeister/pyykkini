import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { AdminPanel } from "@/components/AdminPanel";
import { LaundryPanel } from "@/components/LaundryPanel";
import { useAuth } from "@/contexts/AuthContext";

type Panel = 'admin' | 'laundry';

const Index = () => {
  const { userRole } = useAuth();
  const [activePanel, setActivePanel] = useState<Panel>('admin');

  // Set panel based on user role
  useEffect(() => {
    if (userRole && ['admin', 'laundry'].includes(userRole)) {
      setActivePanel(userRole as Panel);
    }
  }, [userRole]);

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'laundry':
        return <LaundryPanel />;
      default:
        return <AdminPanel />;
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
