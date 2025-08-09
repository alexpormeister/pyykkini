import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, CheckCircle } from 'lucide-react';
import { format, addDays, addHours, isAfter, isBefore, setHours, setMinutes } from 'date-fns';
import { fi } from 'date-fns/locale';

interface TimeSlot {
  start: string;
  end: string;
  date: string;
  display: string;
}

interface TimeSlotSelectorProps {
  selectedPickupOption: 'asap' | 'choose_time' | '';
  onPickupOptionChange: (option: 'asap' | 'choose_time') => void;
  selectedTimeSlot?: TimeSlot;
  onTimeSlotChange: (slot: TimeSlot | null) => void;
  estimatedReturnSlot?: TimeSlot;
  onEstimatedReturnChange: (slot: TimeSlot) => void;
}

export const TimeSlotSelector = ({
  selectedPickupOption,
  onPickupOptionChange,
  selectedTimeSlot,
  onTimeSlotChange,
  estimatedReturnSlot,
  onEstimatedReturnChange
}: TimeSlotSelectorProps) => {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Generate available time slots (08:00-20:00 in 2-hour windows)
  const generateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const today = new Date();
    
    // Generate slots for next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = addDays(today, dayOffset);
      const isToday = dayOffset === 0;
      
      // Time slots from 08:00 to 18:00 (last slot is 18:00-20:00)
      for (let hour = 8; hour <= 18; hour += 2) {
        const startTime = setMinutes(setHours(currentDate, hour), 0);
        const endTime = setMinutes(setHours(currentDate, hour + 2), 0);
        
        // Skip past time slots for today
        if (isToday && isBefore(startTime, new Date())) {
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

  // Calculate return time slot based on pickup
  const calculateReturnSlot = (pickupSlot: TimeSlot, isASAP = false): TimeSlot => {
    const pickupDate = new Date(`${pickupSlot.date}T${pickupSlot.start}`);
    const hoursToAdd = isASAP ? 7 : 5; // ASAP gets 7 hours, chosen time gets 5 hours
    let returnDate = addHours(pickupDate, hoursToAdd);
    
    // Check if return time is after 20:00
    const returnHour = returnDate.getHours();
    if (returnHour >= 20) {
      // Move to next day 08:00-10:00
      returnDate = addDays(returnDate, 1);
      returnDate = setHours(setMinutes(returnDate, 0), 8);
    } else if (returnHour < 8) {
      // Move to 08:00 same day
      returnDate = setHours(setMinutes(returnDate, 0), 8);
    }
    
    const returnEndTime = addHours(returnDate, 2);
    
    return {
      start: format(returnDate, 'HH:mm'),
      end: format(returnEndTime, 'HH:mm'),
      date: format(returnDate, 'yyyy-MM-dd'),
      display: `${format(returnDate, 'eeee d.M.', { locale: fi })} klo ${format(returnDate, 'HH:mm')}-${format(returnEndTime, 'HH:mm')}`
    };
  };

  // Get next available ASAP slot
  const getASAPSlot = (): TimeSlot => {
    const now = new Date();
    const nextHour = Math.ceil(now.getHours() / 2) * 2; // Round up to next 2-hour boundary
    
    let asapDate = now;
    let asapHour = nextHour;
    
    // If it's past 18:00 or rounded up past 20:00, move to next day 08:00
    if (asapHour >= 20) {
      asapDate = addDays(now, 1);
      asapHour = 8;
    } else if (asapHour < 8) {
      asapHour = 8;
    }
    
    const startTime = setMinutes(setHours(asapDate, asapHour), 0);
    const endTime = setMinutes(setHours(asapDate, asapHour + 2), 0);
    
    return {
      start: format(startTime, 'HH:mm'),
      end: format(endTime, 'HH:mm'),
      date: format(asapDate, 'yyyy-MM-dd'),
      display: `${format(asapDate, 'eeee d.M.', { locale: fi })} klo ${format(startTime, 'HH:mm')}-${format(endTime, 'HH:mm')}`
    };
  };

  useEffect(() => {
    setAvailableSlots(generateTimeSlots());
  }, []);

  useEffect(() => {
    if (selectedPickupOption === 'asap') {
      const asapSlot = getASAPSlot();
      onTimeSlotChange(asapSlot);
      const returnSlot = calculateReturnSlot(asapSlot, true);
      onEstimatedReturnChange(returnSlot);
    } else if (selectedTimeSlot) {
      const returnSlot = calculateReturnSlot(selectedTimeSlot, false);
      onEstimatedReturnChange(returnSlot);
    }
  }, [selectedPickupOption, selectedTimeSlot]);

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    onTimeSlotChange(slot);
    const returnSlot = calculateReturnSlot(slot, false);
    onEstimatedReturnChange(returnSlot);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Valitse noutotapa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Button
              type="button"
              variant={selectedPickupOption === 'asap' ? 'default' : 'outline'}
              onClick={() => onPickupOptionChange('asap')}
              className="h-auto p-4 justify-start"
            >
              <div className="text-left">
                <div className="font-semibold">Nouda mahdollisimman pian</div>
                <div className="text-sm opacity-70">
                  Seuraava vapaa aikahaarukka: {selectedPickupOption === 'asap' && selectedTimeSlot ? selectedTimeSlot.display : ''}
                </div>
              </div>
            </Button>
            
            <Button
              type="button"
              variant={selectedPickupOption === 'choose_time' ? 'default' : 'outline'}
              onClick={() => onPickupOptionChange('choose_time')}
              className="h-auto p-4 justify-start"
            >
              <div className="text-left">
                <div className="font-semibold">Valitse aika</div>
                <div className="text-sm opacity-70">Valitse sopiva aikahaarukka alta</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedPickupOption === 'choose_time' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Valitse noutohaarukka
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {availableSlots.map((slot, index) => (
                <Button
                  key={index}
                  type="button"
                  variant={
                    selectedTimeSlot && 
                    selectedTimeSlot.date === slot.date && 
                    selectedTimeSlot.start === slot.start 
                      ? 'default' 
                      : 'outline'
                  }
                  onClick={() => handleTimeSlotSelect(slot)}
                  className="h-auto p-3 justify-start"
                >
                  <div className="flex items-center gap-2">
                    {selectedTimeSlot && 
                     selectedTimeSlot.date === slot.date && 
                     selectedTimeSlot.start === slot.start && (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{slot.display}</span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTimeSlot && estimatedReturnSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Valittu aikataulu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="font-semibold text-sm text-muted-foreground">NOUTO</div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{selectedTimeSlot.display}</Badge>
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm text-muted-foreground">ARVIOITU PALAUTUS</div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{estimatedReturnSlot.display}</Badge>
                <span className="text-xs text-muted-foreground">(Arvio)</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Kuljettaja voi ehdottaa muutoksia aikatauluun tilauksen hyväksymisen jälkeen.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};