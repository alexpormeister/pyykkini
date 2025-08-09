import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Edit, CheckCircle, X } from 'lucide-react';
import { format, addHours, setHours, setMinutes, addDays } from 'date-fns';
import { fi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  start: string;
  end: string;
  date: string;
  display: string;
}

interface DriverTimeManagerProps {
  order: any;
  onOrderUpdate?: () => void;
}

export const DriverTimeManager = ({ order, onOrderUpdate }: DriverTimeManagerProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editType, setEditType] = useState<'pickup' | 'return'>('pickup');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Generate available time slots (08:00-20:00 in 2-hour windows)
  const generateTimeSlots = (startFromToday = false) => {
    const slots: TimeSlot[] = [];
    const today = new Date();
    const startDay = startFromToday ? 0 : 1; // Today or tomorrow
    
    // Generate slots for next 7 days
    for (let dayOffset = startDay; dayOffset < 7; dayOffset++) {
      const currentDate = addDays(today, dayOffset);
      const isToday = dayOffset === 0;
      
      // Time slots from 08:00 to 18:00 (last slot is 18:00-20:00)
      for (let hour = 8; hour <= 18; hour += 2) {
        const startTime = setMinutes(setHours(currentDate, hour), 0);
        const endTime = setMinutes(setHours(currentDate, hour + 2), 0);
        
        // Skip past time slots for today
        if (isToday && startTime <= new Date()) {
          continue;
        }
        
        slots.push({
          start: format(startTime, 'HH:mm'),
          end: format(endTime, 'HH:mm'),
          date: format(currentDate, 'yyyy-MM-dd'),
          display: `${format(currentDate, 'eeee d.M.', { locale: fi })} klo ${format(startTime, 'HH:mm')}-${format(endTime, 'HH:mm')}`
        });
      }
    }
    
    return slots;
  };

  const handleEditTime = (type: 'pickup' | 'return') => {
    setEditType(type);
    setAvailableSlots(generateTimeSlots(type === 'pickup'));
    setSelectedSlot(null);
    setShowEditDialog(true);
  };

  const handleAcceptOrder = async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Tilaus hyväksytty!",
        description: "Tilaus on hyväksytty nykyisillä ajoilla."
      });

      onOrderUpdate?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tilauksen hyväksyminen epäonnistui."
      });
    }
  };

  const handleSaveTimeChange = async () => {
    if (!selectedSlot) return;

    setIsSaving(true);
    try {
      const updateData: any = {};
      
      if (editType === 'pickup') {
        updateData.pickup_date = selectedSlot.date;
        updateData.pickup_time = selectedSlot.start;
        
        // Recalculate return time based on new pickup time
        const pickupDate = new Date(`${selectedSlot.date}T${selectedSlot.start}`);
        let returnDate = addHours(pickupDate, 5); // Standard 5 hours
        
        // Check if return time is after 20:00
        if (returnDate.getHours() >= 20) {
          returnDate = addDays(returnDate, 1);
          returnDate = setHours(setMinutes(returnDate, 0), 8);
        } else if (returnDate.getHours() < 8) {
          returnDate = setHours(setMinutes(returnDate, 0), 8);
        }
        
        updateData.return_date = format(returnDate, 'yyyy-MM-dd');
        updateData.return_time = format(returnDate, 'HH:mm');
      } else {
        updateData.return_date = selectedSlot.date;
        updateData.return_time = selectedSlot.start;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Aikataulu päivitetty!",
        description: `${editType === 'pickup' ? 'Nouto' : 'Palautus'}aika on päivitetty. Asiakas saa ilmoituksen muutoksesta.`
      });

      setShowEditDialog(false);
      onOrderUpdate?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Aikataulun päivittäminen epäonnistui."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentPickupSlot = {
    date: order.pickup_date,
    start: order.pickup_time,
    end: format(addHours(new Date(`${order.pickup_date}T${order.pickup_time}`), 2), 'HH:mm'),
    display: `${format(new Date(order.pickup_date), 'eeee d.M.', { locale: fi })} klo ${order.pickup_time}-${format(addHours(new Date(`${order.pickup_date}T${order.pickup_time}`), 2), 'HH:mm')}`
  };

  const currentReturnSlot = {
    date: order.return_date,
    start: order.return_time,
    end: format(addHours(new Date(`${order.return_date}T${order.return_time}`), 2), 'HH:mm'),
    display: `${format(new Date(order.return_date), 'eeee d.M.', { locale: fi })} klo ${order.return_time}-${format(addHours(new Date(`${order.return_date}T${order.return_time}`), 2), 'HH:mm')}`
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Aikataulu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-sm text-muted-foreground mb-1">NOUTO</div>
              <div className="flex items-center justify-between">
                <Badge variant="default" className="text-xs">
                  {currentPickupSlot.display}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditTime('pickup')}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <div className="font-semibold text-sm text-muted-foreground mb-1">PALAUTUS</div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {currentReturnSlot.display}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditTime('return')}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {order.status === 'pending' && (
            <Button onClick={handleAcceptOrder} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Hyväksy aikataulu
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ehdota uutta {editType === 'pickup' ? 'nouto' : 'palautus'}aikaa
            </DialogTitle>
            <DialogDescription>
              Valitse uusi aikahaarukka. Asiakas saa ilmoituksen muutoksesta.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableSlots.map((slot, index) => (
              <Button
                key={index}
                type="button"
                variant={selectedSlot?.date === slot.date && selectedSlot?.start === slot.start ? 'default' : 'outline'}
                onClick={() => setSelectedSlot(slot)}
                className="w-full h-auto p-3 justify-start"
              >
                <div className="flex items-center gap-2">
                  {selectedSlot?.date === slot.date && selectedSlot?.start === slot.start && (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>{slot.display}</span>
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Peruuta
            </Button>
            <Button 
              onClick={handleSaveTimeChange} 
              disabled={!selectedSlot || isSaving}
            >
              {isSaving ? "Tallennetaan..." : "Tallenna muutos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};