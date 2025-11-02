import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, Sparkles, Box, Truck, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";

interface Order {
  id: string;
  tracking_status: string;
  pickup_slot: string | null;
  delivery_slot: string | null;
  created_at: string;
  address: string;
  final_price: number;
}

export const OrderTracking = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: any; color: string }> = {
      PENDING: { label: "Tilaus vastaanotettu", icon: Clock, color: "bg-blue-500" },
      PICKED_UP: { label: "Noudettu", icon: Package, color: "bg-purple-500" },
      WASHING: { label: "Pesussa", icon: Sparkles, color: "bg-cyan-500" },
      PACKAGING: { label: "Pakataan", icon: Box, color: "bg-orange-500" },
      OUT_FOR_DELIVERY: { label: "Matkalla sinulle", icon: Truck, color: "bg-indigo-500" },
      COMPLETED: { label: "Toimitettu", icon: CheckCircle, color: "bg-green-500" }
    };
    return statusMap[status] || statusMap.PENDING;
  };

  if (loading) {
    return <div>Ladataan tilauksia...</div>;
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ei tilauksia</CardTitle>
          <CardDescription>Sinulla ei ole vielä tilauksia.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Omat Tilaukset</h2>
      
      {orders.map(order => {
        const statusInfo = getStatusInfo(order.tracking_status);
        const StatusIcon = statusInfo.icon;

        return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Tilaus #{order.id.slice(0, 8)}
                </CardTitle>
                <Badge variant="outline" className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  {statusInfo.label}
                </Badge>
              </div>
              <CardDescription>
                Tilattu {format(new Date(order.created_at), "d.M.yyyy 'klo' HH:mm", { locale: fi })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Toimitusosoite</p>
                  <p className="text-muted-foreground">{order.address}</p>
                </div>
                <div>
                  <p className="font-medium">Kokonaishinta</p>
                  <p className="text-lg font-bold">{order.final_price.toFixed(2)} €</p>
                </div>
                {order.pickup_slot && (
                  <div>
                    <p className="font-medium">Noutoaika</p>
                    <p className="text-muted-foreground">
                      {format(new Date(order.pickup_slot), "d.M.yyyy HH:mm", { locale: fi })}
                    </p>
                  </div>
                )}
                {order.delivery_slot && (
                  <div>
                    <p className="font-medium">Palautusaika</p>
                    <p className="text-muted-foreground">
                      {format(new Date(order.delivery_slot), "d.M.yyyy HH:mm", { locale: fi })}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress tracker */}
              <div className="pt-4">
                <div className="flex justify-between items-center">
                  {["PENDING", "PICKED_UP", "WASHING", "PACKAGING", "OUT_FOR_DELIVERY", "COMPLETED"].map((status, idx) => {
                    const info = getStatusInfo(status);
                    const Icon = info.icon;
                    const statuses = ["PENDING", "PICKED_UP", "WASHING", "PACKAGING", "OUT_FOR_DELIVERY", "COMPLETED"];
                    const currentIdx = statuses.indexOf(order.tracking_status);
                    const isActive = idx <= currentIdx;

                    return (
                      <div key={status} className="flex flex-col items-center flex-1">
                        <div className={`rounded-full p-2 ${isActive ? info.color : "bg-gray-300"} text-white`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {idx < 5 && (
                          <div className={`h-1 w-full ${idx < currentIdx ? info.color : "bg-gray-300"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
