import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, Clock, Sparkles, Box, Truck, CheckCircle, 
  MapPin, Scale, Calendar, Phone, Star, Download,
  MessageCircle, X, Edit3, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  tracking_status: string;
  status: string;
  pickup_slot: string | null;
  delivery_slot: string | null;
  created_at: string;
  address: string;
  final_price: number;
  price: number;
  pickup_weight_kg: number | null;
  return_weight_kg: number | null;
  pickup_date: string | null;
  pickup_time: string | null;
  return_date: string | null;
  return_time: string | null;
  special_instructions: string | null;
  access_code: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  service_name: string;
}

interface OrderItem {
  id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const STATUSES = [
  { key: "PENDING", label: "Vastaanotettu", icon: Clock },
  { key: "ACCEPTED", label: "Hyväksytty", icon: CheckCircle },
  { key: "PICKING_UP", label: "Noutamassa", icon: Truck },
  { key: "ARRIVED_PICKUP", label: "Saapunut noutamaan", icon: Package },
  { key: "WASHING", label: "Pesussa", icon: Sparkles },
  { key: "RETURNING", label: "Palautumassa", icon: Truck },
  { key: "ARRIVED_RETURN", label: "Saapunut paluuseen", icon: Box },
  { key: "COMPLETED", label: "Toimitettu", icon: CheckCircle },
];

export const OrderTracking = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editInstructionsOpen, setEditInstructionsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newInstructions, setNewInstructions] = useState("");
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    fetchOrders();
    
    const channel = supabase
      .channel('customer-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
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

      // Fetch order items for all orders
      if (data && data.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", data.map(o => o.id));
        
        if (items) {
          const itemsByOrder: Record<string, OrderItem[]> = {};
          items.forEach(item => {
            if (!itemsByOrder[item.order_id]) {
              itemsByOrder[item.order_id] = [];
            }
            itemsByOrder[item.order_id].push(item);
          });
          setOrderItems(itemsByOrder);
        }
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStatusIndex = (order: Order) => {
    let status = order.tracking_status;
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
      status = oldStatusMap[order.status] || 'PENDING';
    }
    return STATUSES.findIndex(s => s.key === status);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", tracking_status: null })
        .eq("id", selectedOrder.id);
      
      if (error) throw error;
      toast.success("Tilaus peruttu onnistuneesti");
      setCancelDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Virhe tilauksen peruuttamisessa");
    }
  };

  const handleUpdateInstructions = async () => {
    if (!selectedOrder) return;
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({ special_instructions: newInstructions })
        .eq("id", selectedOrder.id);
      
      if (error) throw error;
      toast.success("Nouto-ohjeet päivitetty");
      setEditInstructionsOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error("Error updating instructions:", error);
      toast.error("Virhe ohjeiden päivityksessä");
    }
  };

  const canCancelOrder = (order: Order) => {
    const idx = getCurrentStatusIndex(order);
    return idx <= 1; // Can cancel only if PENDING or ACCEPTED
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle>Ei tilauksia</CardTitle>
          <CardDescription>Sinulla ei ole vielä tilauksia. Aloita tilaamalla pesulasta!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-fredoka text-foreground">Omat Tilaukset</h2>
      
      {orders.map(order => {
        const currentIdx = getCurrentStatusIndex(order);
        const currentStatus = STATUSES[currentIdx] || STATUSES[0];
        const items = orderItems[order.id] || [];

        return (
          <Card key={order.id} className="overflow-hidden bg-card/80 backdrop-blur-sm border-border/50 shadow-lg">
            {/* Header */}
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg font-fredoka">
                    Tilaus #{order.id.slice(0, 8)}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(order.created_at), "d.M.yyyy 'klo' HH:mm", { locale: fi })}
                  </CardDescription>
                </div>
                <Badge 
                  variant="outline" 
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-primary/30 text-primary font-medium"
                >
                  <currentStatus.icon className="h-4 w-4" />
                  {currentStatus.label}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {/* Status Step Indicator */}
              <div className="relative">
                <div className="flex justify-between">
                  {STATUSES.map((status, idx) => {
                    const Icon = status.icon;
                    const isActive = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    
                    return (
                      <div key={status.key} className="flex flex-col items-center relative z-10 flex-1">
                        <div 
                          className={`
                            rounded-full p-2 transition-all duration-300 
                            ${isCurrent 
                              ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110' 
                              : isActive 
                                ? 'bg-primary/80 text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }
                          `}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`
                          text-[10px] mt-1.5 text-center max-w-[60px] leading-tight
                          ${isCurrent ? 'text-primary font-semibold' : isActive ? 'text-foreground' : 'text-muted-foreground'}
                        `}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Progress line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-0 mx-8">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(currentIdx / (STATUSES.length - 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Status-specific Info Box */}
              <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/50 p-4 space-y-3">
                {/* PENDING / ACCEPTED - Show confirmation and actions */}
                {currentIdx <= 1 && (
                  <>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">
                          {currentIdx === 0 ? "Tilaus vastaanotettu!" : "Tilaus hyväksytty!"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentIdx === 0 
                            ? "Kuljettaja käsittelee tilaustasi pian." 
                            : "Kuljettaja on hyväksynyt tilauksesi ja tulee noutamaan sen."
                          }
                        </p>
                      </div>
                    </div>
                    {(order.pickup_date || order.pickup_slot) && (
                      <div className="flex items-center gap-2 text-sm bg-primary/10 rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-foreground">
                          Arvioitu noutoaika: <strong>
                            {order.pickup_slot 
                              ? format(new Date(order.pickup_slot), "d.M.yyyy HH:mm", { locale: fi })
                              : `${order.pickup_date} ${order.pickup_time || ''}`
                            }
                          </strong>
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {canCancelOrder(order) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setCancelDialogOpen(true); }}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4 mr-1" /> Peru tilaus
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { 
                          setSelectedOrder(order); 
                          setNewInstructions(order.special_instructions || '');
                          setEditInstructionsOpen(true); 
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-1" /> Muokkaa nouto-ohjeita
                      </Button>
                    </div>
                  </>
                )}

                {/* PICKING_UP - Driver is on the way */}
                {currentIdx === 2 && (
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-primary animate-pulse mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Kuljettaja on matkalla!</p>
                      <p className="text-sm text-muted-foreground">
                        Kuljettaja on matkalla osoitteeseesi noutamaan pyykki.
                      </p>
                    </div>
                  </div>
                )}

                {/* ARRIVED_PICKUP - Weight recorded */}
                {currentIdx === 3 && (
                  <>
                    <div className="flex items-start gap-3">
                      <Scale className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Pyykki punnittu!</p>
                        <p className="text-sm text-muted-foreground">
                          Kuljettaja on saapunut ja punninnut pyykkisi.
                        </p>
                      </div>
                    </div>
                    {order.pickup_weight_kg && (
                      <div className="bg-primary/10 rounded-lg px-4 py-3">
                        <p className="text-sm text-muted-foreground">Pyykin paino</p>
                        <p className="text-2xl font-fredoka text-primary">{order.pickup_weight_kg} kg</p>
                      </div>
                    )}
                  </>
                )}

                {/* WASHING - In laundry */}
                {currentIdx === 4 && (
                  <>
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Pyykkisi on nyt pesulassa!</p>
                        <p className="text-sm text-muted-foreground">
                          Pyykkisi käsitellään ammattimaisesti. Laadunvalvonta on käynnissä.
                        </p>
                      </div>
                    </div>
                    {(order.return_date || order.delivery_slot) && (
                      <div className="flex items-center gap-2 text-sm bg-cyan-500/10 rounded-lg px-3 py-2">
                        <Calendar className="h-4 w-4 text-cyan-600" />
                        <span className="text-foreground">
                          Arvioitu palautus: <strong>
                            {order.delivery_slot 
                              ? format(new Date(order.delivery_slot), "d.M.yyyy HH:mm", { locale: fi })
                              : `${order.return_date} ${order.return_time || ''}`
                            }
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* RETURNING - On the way back */}
                {currentIdx === 5 && (
                  <>
                    <div className="flex items-start gap-3">
                      <Truck className="h-5 w-5 text-orange-500 animate-pulse mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Puhdas pyykki on matkalla!</p>
                        <p className="text-sm text-muted-foreground">
                          Kuljettaja on matkalla palauttamaan puhtaan pyykkisi.
                        </p>
                      </div>
                    </div>
                    {(order.return_date || order.delivery_slot) && (
                      <div className="flex items-center gap-2 text-sm bg-orange-500/10 rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="text-foreground">
                          Arvioitu saapuminen: <strong>
                            {order.delivery_slot 
                              ? format(new Date(order.delivery_slot), "d.M.yyyy HH:mm", { locale: fi })
                              : `${order.return_date} ${order.return_time || ''}`
                            }
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* ARRIVED_RETURN - Control weight */}
                {currentIdx === 6 && (
                  <>
                    <div className="flex items-start gap-3">
                      <Box className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Kontrollipaino kirjattu!</p>
                        <p className="text-sm text-muted-foreground">
                          Kuljettaja on saapunut ja punninnut palautettavan pyykin.
                        </p>
                      </div>
                    </div>
                    {order.return_weight_kg && (
                      <div className="bg-amber-500/10 rounded-lg px-4 py-3">
                        <p className="text-sm text-muted-foreground">Palautuspaino</p>
                        <p className="text-2xl font-fredoka text-amber-600">{order.return_weight_kg} kg</p>
                        {order.pickup_weight_kg && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Painoero: {Math.abs(order.return_weight_kg - order.pickup_weight_kg).toFixed(1)} kg
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* COMPLETED - Delivered */}
                {currentIdx === 7 && (
                  <>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Tilaus toimitettu!</p>
                        <p className="text-sm text-muted-foreground">
                          Pyykki on jätetty osoitteeseesi. Kiitos tilauksestasi!
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSelectedOrder(order); setRatingDialogOpen(true); }}
                      >
                        <Star className="h-4 w-4 mr-1" /> Arvostele palvelu
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" /> Lataa kuitti
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Address & Contact */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Toimitusosoite</p>
                      <p className="text-sm font-medium">{order.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Yhteystiedot</p>
                      <p className="text-sm font-medium">{order.first_name} {order.last_name}</p>
                      <p className="text-sm text-muted-foreground">{order.phone}</p>
                    </div>
                  </div>
                  {order.special_instructions && (
                    <div className="flex items-start gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nouto-ohjeet</p>
                        <p className="text-sm">{order.special_instructions}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Time & Weight Info */}
                <div className="space-y-3">
                  {(order.pickup_date || order.pickup_slot) && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Noutoaika</p>
                        <p className="text-sm font-medium">
                          {order.pickup_slot 
                            ? format(new Date(order.pickup_slot), "d.M.yyyy HH:mm", { locale: fi })
                            : `${order.pickup_date} ${order.pickup_time || ''}`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  {(order.return_date || order.delivery_slot) && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Palautusaika</p>
                        <p className="text-sm font-medium">
                          {order.delivery_slot 
                            ? format(new Date(order.delivery_slot), "d.M.yyyy HH:mm", { locale: fi })
                            : `${order.return_date} ${order.return_time || ''}`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  {(order.pickup_weight_kg || order.return_weight_kg) && (
                    <div className="flex items-start gap-2">
                      <Scale className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Painotiedot</p>
                        <div className="flex gap-4 text-sm">
                          <span>Nouto: <strong>{order.pickup_weight_kg ? `${order.pickup_weight_kg} kg` : '-'}</strong></span>
                          <span>Palautus: <strong>{order.return_weight_kg ? `${order.return_weight_kg} kg` : '-'}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Summary */}
              <div className="border-t border-border/50 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Palvelu: {order.service_name}</p>
                    {items.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {items.map(item => (
                          <span key={item.id} className="mr-2">
                            {item.service_name} ({item.quantity}x {item.unit_price.toFixed(2)}€)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {currentIdx >= 3 && order.pickup_weight_kg ? 'Lopullinen hinta' : 'Arvioitu hinta'}
                    </p>
                    <p className="text-2xl font-fredoka text-primary">{order.final_price.toFixed(2)} €</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Peru tilaus
            </DialogTitle>
            <DialogDescription>
              Oletko varma, että haluat perua tämän tilauksen? Tätä toimintoa ei voi kumota.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Peruuta
            </Button>
            <Button variant="destructive" onClick={handleCancelOrder}>
              Peru tilaus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instructions Dialog */}
      <Dialog open={editInstructionsOpen} onOpenChange={setEditInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Muokkaa nouto-ohjeita</DialogTitle>
            <DialogDescription>
              Lisää ovikoodi tai muita nouto-ohjeita kuljettajalle.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder="Esim. Ovikoodi on 1234, soita ovikelloa..."
            rows={3}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditInstructionsOpen(false)}>
              Peruuta
            </Button>
            <Button onClick={handleUpdateInstructions}>
              Tallenna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arvostele palvelu</DialogTitle>
            <DialogDescription>
              Miten palvelu sujui? Anna arvosana 1-5 tähteä.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star 
                  className={`h-8 w-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                />
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRatingDialogOpen(false)}>
              Peruuta
            </Button>
            <Button 
              onClick={() => {
                toast.success("Kiitos arvostelustasi!");
                setRatingDialogOpen(false);
                setRating(0);
              }}
              disabled={rating === 0}
            >
              Lähetä arvostelu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
