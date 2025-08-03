import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MapPin, Phone, Clock, Package, User, Plus } from 'lucide-react';
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

interface CustomEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  type: string;
}

export const DriverCalendar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    type: 'custom'
  });

  useEffect(() => {
    if (user) {
      fetchCalendarEvents();
      fetchCustomEvents();
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
          user_id,
          order_items (
            rug_dimensions
          )
        `)
        .eq('driver_id', user.id)
        .gte('pickup_date', startOfMonth.toISOString().split('T')[0])
        .lte('pickup_date', endOfMonth.toISOString().split('T')[0])
        .neq('status', 'rejected');

      if (error) throw error;

      // Fetch customer profiles separately
      const customerIds = orders?.map(order => order.user_id) || [];
      let customerProfiles: any[] = [];
      
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', customerIds);
        customerProfiles = profiles || [];
      }

      const calendarEvents: CalendarEvent[] = [];

      orders?.forEach(order => {
        const customerProfile = customerProfiles.find(p => p.user_id === order.user_id);
        const customerName = customerProfile?.full_name || `${order.first_name} ${order.last_name}`;
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
            customerPhone: customerProfile?.phone || order.phone,
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
            customerPhone: customerProfile?.phone || order.phone,
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
    const orderEvents = events.filter(event => event.date === dateStr);
    const customEventsForDate = customEvents.filter(event => event.date === dateStr);
    return { orderEvents, customEvents: customEventsForDate };
  };

  const handleAddEvent = async () => {
    if (!selectedDate || !newEvent.title || !newEvent.startTime) {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Täytä vähintään otsikko ja alkamisaika'
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('driver_calendar_events')
        .insert({
          driver_id: user?.id,
          title: newEvent.title,
          description: newEvent.description || null,
          event_date: selectedDate.toISOString().split('T')[0],
          start_time: newEvent.startTime,
          end_time: newEvent.endTime || null,
          event_type: newEvent.type
        });
        
      if (error) throw error;
      
      toast({
        title: 'Tapahtuma lisätty',
        description: 'Uusi tapahtuma on lisätty kalenteriin'
      });
      
      setShowAddEventDialog(false);
      setNewEvent({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        type: 'custom'
      });
      setSelectedDate(null);
      fetchCustomEvents();
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Tapahtuman lisääminen epäonnistui'
      });
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddEventDialog(true);
  };

  const fetchCustomEvents = async () => {
    if (!user) return;
    
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const { data: driverEvents, error } = await supabase
        .from('driver_calendar_events')
        .select('*')
        .eq('driver_id', user.id)
        .gte('event_date', startOfMonth.toISOString().split('T')[0])
        .lte('event_date', endOfMonth.toISOString().split('T')[0]);
        
      if (error) throw error;
      
      const customEventsFormatted: CustomEvent[] = driverEvents?.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.event_date,
        startTime: event.start_time,
        endTime: event.end_time,
        type: event.event_type
      })) || [];
      
      setCustomEvents(customEventsFormatted);
      
    } catch (error: any) {
      console.error('Error fetching custom events:', error);
    }
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
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setShowAddEventDialog(true)}
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Lisää tapahtuma
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
            {getDaysInMonth().map((day, index) => {
              const dayEvents = day ? getEventsByDate(day) : { orderEvents: [], customEvents: [] };
              return (
                <div 
                  key={index} 
                  className="min-h-[100px] border border-muted/30 p-1 hover:bg-muted/20 cursor-pointer"
                  onClick={() => day && handleDateClick(day)}
                >
                  {day && (
                    <>
                      <div className="text-sm font-medium mb-1">
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {/* Order events */}
                        {dayEvents.orderEvents.map(event => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getEventColor(event.type, event.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                          >
                            <div className="font-medium">{event.time}</div>
                            <div className="truncate">
                              {event.type === 'pickup' ? '📦' : '🚚'} {event.customerName}
                            </div>
                          </div>
                        ))}
                        
                        {/* Custom events */}
                        {dayEvents.customEvents.map(event => (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded cursor-pointer hover:opacity-80 bg-gray-100 text-gray-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="font-medium">{event.startTime}</div>
                            <div className="truncate">
                              📅 {event.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
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
      
      {/* Add Event Dialog */}
      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lisää uusi tapahtuma</DialogTitle>
            <DialogDescription>
              {selectedDate && `Päivämäärä: ${selectedDate.toLocaleDateString('fi-FI')}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Otsikko *</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Esim. Tauko, Huolto, Kokous..."
              />
            </div>
            
            <div>
              <Label htmlFor="description">Kuvaus</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Vapaaehtoinen kuvaus..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Alkamisaika *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">Päättymisaika</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddEventDialog(false);
                  setNewEvent({
                    title: '',
                    description: '',
                    startTime: '',
                    endTime: '',
                    type: 'custom'
                  });
                  setSelectedDate(null);
                }}
              >
                Peruuta
              </Button>
              <Button onClick={handleAddEvent}>
                Lisää tapahtuma
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};