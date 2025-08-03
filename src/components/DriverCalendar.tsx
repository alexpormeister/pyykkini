import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MapPin, Phone, Clock, Package, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
  id: string;
  orderId: string;
  title: string;
  date: string;
  time: string;
  type: 'pickup' | 'return';
  customerName: string;
  customerPhone: string;
  address: string;
  serviceName: string;
  finalPrice: number;
  status: string;
  rugDimensions?: string;
}

export const DriverCalendar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user) {
      fetchCalendarEvents();
    }
  }, [user, currentDate]);

  const fetchCalendarEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get date range (current month)
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          pickup_date,
          pickup_time,
          return_date,
          return_time,
          actual_pickup_time,
          actual_return_time,
          first_name,
          last_name,
          phone,
          address,
          service_name,
          final_price,
          status,
          profiles!orders_user_id_fkey (
            full_name,
            phone
          ),
          order_items (
            rug_dimensions
          )
        `)
        .eq('driver_id', user.id)
        .gte('pickup_date', startOfMonth.toISOString().split('T')[0])
        .lte('pickup_date', endOfMonth.toISOString().split('T')[0])
        .neq('status', 'rejected');

      if (error) throw error;

      const calendarEvents: CalendarEvent[] = [];

      orders?.forEach(order => {
        const customerName = (order.profiles as any)?.full_name || `${order.first_name} ${order.last_name}`;
        const rugDimensions = order.order_items?.find(item => item.rug_dimensions)?.rug_dimensions;

        // Add pickup event
        if (order.pickup_date) {
          calendarEvents.push({
            id: `${order.id}-pickup`,
            orderId: order.id,
            title: `Nouto: ${customerName}`,
            date: order.pickup_date,
            time: order.actual_pickup_time 
              ? new Date(order.actual_pickup_time).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
              : order.pickup_time,
            type: 'pickup',
            customerName,
            customerPhone: (order.profiles as any)?.phone || order.phone,
            address: order.address,
            serviceName: order.service_name,
            finalPrice: order.final_price,
            status: order.status,
            rugDimensions
          });
        }

        // Add return event
        if (order.return_date) {
          calendarEvents.push({
            id: `${order.id}-return`,
            orderId: order.id,
            title: `Palautus: ${customerName}`,
            date: order.return_date,
            time: order.actual_return_time
              ? new Date(order.actual_return_time).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
              : order.return_time,
            type: 'return',
            customerName,
            customerPhone: (order.profiles as any)?.phone || order.phone,
            address: order.address,
            serviceName: order.service_name,
            finalPrice: order.final_price,
            status: order.status,
            rugDimensions
          });
        }
      });

      setEvents(calendarEvents.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      }));

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Kalenteritapahtumien lataaminen epäonnistui'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventsByDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventColor = (type: string, status: string) => {
    if (type === 'pickup') {
      return status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
    } else {
      return status === 'delivered' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Ladataan kalenteria...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Työkalenteri
              </CardTitle>
              <CardDescription>
                {currentDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                ←
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                →
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'].map(day => (
              <div key={day} className="p-2 text-center font-semibold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth().map((day, index) => (
              <div key={index} className="min-h-[100px] border border-muted/30 p-1">
                {day && (
                  <>
                    <div className="text-sm font-medium mb-1">
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {getEventsByDate(day).map(event => (
                        <div
                          key={event.id}
                          className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getEventColor(event.type, event.status)}`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="font-medium">{event.time}</div>
                          <div className="truncate">
                            {event.type === 'pickup' ? '📦' : '🚚'} {event.customerName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Tulevat tapahtumat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events
              .filter(event => new Date(`${event.date}T${event.time}`) >= new Date())
              .slice(0, 5)
              .map(event => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${event.type === 'pickup' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                    <div>
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('fi-FI')} klo {event.time}
                      </div>
                    </div>
                  </div>
                  <Badge className={getEventColor(event.type, event.status)}>
                    {event.type === 'pickup' ? 'Nouto' : 'Palautus'}
                  </Badge>
                </div>
              ))}
            
            {events.filter(event => new Date(`${event.date}T${event.time}`) >= new Date()).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Ei tulevia tapahtumia
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.type === 'pickup' ? <Package className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              {selectedEvent?.type === 'pickup' ? 'Nouto' : 'Palautus'}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && new Date(selectedEvent.date).toLocaleDateString('fi-FI')} klo {selectedEvent?.time}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedEvent.customerName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.customerPhone}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => window.open(`tel:${selectedEvent.customerPhone}`)}
                  >
                    Soita
                  </Button>
                </div>
                
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{selectedEvent.address}</span>
                </div>
                
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="font-medium mb-1">Tilauksen tiedot</div>
                  <div className="text-sm text-muted-foreground">
                    <div>Palvelu: {selectedEvent.serviceName}</div>
                    <div>Hinta: {selectedEvent.finalPrice.toFixed(2)}€</div>
                    <div>Tila: {selectedEvent.status}</div>
                    {selectedEvent.rugDimensions && (
                      <div>Maton mitat: {selectedEvent.rugDimensions}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => setSelectedEvent(null)}>
                  Sulje
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};