-- Update delivery_tasks_status_check constraint to include 'failed' and 'pickup_failed'
ALTER TABLE public.delivery_tasks DROP CONSTRAINT IF EXISTS delivery_tasks_status_check;
ALTER TABLE public.delivery_tasks ADD CONSTRAINT delivery_tasks_status_check CHECK (
  status = ANY (ARRAY[
    'pending',
    'unassigned',
    'assigned',
    'in_progress',
    'awaiting_laundry',
    'completed',
    'failed',
    'pickup_failed',
    'cancelled',
    'rejected'
  ]::text[])
);
