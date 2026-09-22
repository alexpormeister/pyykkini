-- Create driver calendar events table
CREATE TABLE public.driver_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  event_type TEXT NOT NULL DEFAULT 'custom', -- 'custom', 'break', 'maintenance', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies for driver calendar events
CREATE POLICY "Drivers can view their own events" 
ON public.driver_calendar_events 
FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create their own events" 
ON public.driver_calendar_events 
FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own events" 
ON public.driver_calendar_events 
FOR UPDATE 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can delete their own events" 
ON public.driver_calendar_events 
FOR DELETE 
USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all driver events" 
ON public.driver_calendar_events 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_driver_calendar_events_updated_at
BEFORE UPDATE ON public.driver_calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();