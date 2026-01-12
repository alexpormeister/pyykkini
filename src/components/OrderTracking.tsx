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
  pickup_weight_kg: number | null;
  return_weight_kg: number | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
}

export const OrderTracking = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time subscription for order changes
    const channel = supabase
      .channel('customer-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          console.log('Order change detected, refreshing customer orders...');
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const getStatusInfo = (order: Order) => {
    // Handle both old 'status' and new 'tracking_status' fields
    let status = order.tracking_status;
    
    // Map old status values to new tracking_status values
    if (!status) {
      const oldStatusMap: Record<string, string> = {
        'pending': 'PENDING',
        'accepted': 'ACCEPTED',
        'picking_up': 'PICKING_UP',
        'arrived_pickup': 'ARRIVED_PICKUP',
        'washing': 'WASHING',
        'returning': 'RETURNING',
        'arrived_return': 'ARRIVED_RETURN',
        'delivered': 'COMPLETED'
      };
      status = oldStatusMap[(order as any).status] || 'PENDING';
    }
    
    const statusMap: Record<string, { label: string; icon: any; color: string }> = {
      PENDING: { label: "Tilaus vastaanotettu", icon: Clock, color: "bg-blue-500" },
      ACCEPTED: { label: "Hyväksytty", icon: CheckCircle, color: "bg-green-500" },
      PICKING_UP: { label: "Noutamassa", icon: Truck, color: "bg-purple-500" },
      ARRIVED_PICKUP: { label: "Saapunut noutamaan", icon: Package, color: "bg-indigo-500" },
      WASHING: { label: "Pesussa", icon: Sparkles, color: "bg-cyan-500" },
      RETURNING: { label: "Palautumassa", icon: Truck, color: "bg-orange-500" },
      ARRIVED_RETURN: { label: "Saapunut paluuseen", icon: Box, color: "bg-amber-500" },
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
        const statusInfo = getStatusInfo(order);
        const StatusIcon = statusInfo.icon;
        const currentStatus = order.tracking_status || 'PENDING';

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
                {(order.pickup_slot || (order.pickup_date && order.pickup_time)) && (
                  <div>
                    <p className="font-medium">Noutoaika</p>
                    <p className="text-muted-foreground">
                      {order.pickup_slot 
                        ? format(new Date(order.pickup_slot), "d.M.yyyy HH:mm", { locale: fi })
                        : `${order.pickup_date} ${order.pickup_time}`
                      }
                    </p>
                  </div>
                )}
                {(order.delivery_slot || (order.return_date && order.return_time)) && (
                  <div>
                    <p className="font-medium">Palautusaika</p>
                    <p className="text-muted-foreground">
                      {order.delivery_slot 
                        ? format(new Date(order.delivery_slot), "d.M.yyyy HH:mm", { locale: fi })
                        : `${order.return_date} ${order.return_time}`
                      }
                    </p>
                  </div>
                )}
                {(order.pickup_weight_kg || order.return_weight_kg) && (
                  <div className="col-span-2 mt-2 p-3 bg-blue-50 rounded">
                    <p className="font-medium mb-2">Painotiedot</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Noudossa:</span>{' '}
                        <span className="font-medium">
                          {order.pickup_weight_kg ? `${order.pickup_weight_kg} kg` : 'Ei vielä kirjattu'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Palautuksessa:</span>{' '}
                        <span className="font-medium">
                          {order.return_weight_kg ? `${order.return_weight_kg} kg` : 'Ei vielä kirjattu'}
                        </span>
                      </div>
                    </div>
                    {order.pickup_weight_kg && order.return_weight_kg && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Painoero: {Math.abs(order.return_weight_kg - order.pickup_weight_kg).toFixed(1)} kg
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress tracker */}
              <div className="pt-4">
                <div className="flex justify-between items-center">
                  {["PENDING", "ACCEPTED", "PICKING_UP", "ARRIVED_PICKUP", "WASHING", "RETURNING", "ARRIVED_RETURN", "COMPLETED"].map((status, idx) => {
                    const info = getStatusInfo({ tracking_status: status } as Order);
                    const Icon = info.icon;
                    const statuses = ["PENDING", "ACCEPTED", "PICKING_UP", "ARRIVED_PICKUP", "WASHING", "RETURNING", "ARRIVED_RETURN", "COMPLETED"];
                    const currentIdx = statuses.indexOf(currentStatus);
                    const isActive = idx <= currentIdx;

                    return (
                      <div key={status} className="flex flex-col items-center flex-1">
                        <div className={`rounded-full p-1.5 sm:p-2 ${isActive ? info.color : "bg-gray-300"} text-white`}>
                          <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                        </div>
                        {idx < 7 && (
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
