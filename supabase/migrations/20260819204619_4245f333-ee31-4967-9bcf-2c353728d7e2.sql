-- Palauta virheellisesti käynnissä olevat paluukeikat odottamaan pesulan noutoa
UPDATE public.delivery_tasks dt
SET status = 'assigned'
FROM public.orders o
WHERE o.id = dt.order_id
  AND dt.task_type = 'delivery'
  AND dt.status = 'in_progress'
  AND o.tracking_status::text NOT IN ('OUT_FOR_DELIVERY', 'COMPLETED');

-- Poista vanha driver_complete_delivery-versio ilman painoa, jotta toimitusta ei voi kuitata ilman punnitusta
DROP FUNCTION IF EXISTS public.driver_complete_delivery(uuid);