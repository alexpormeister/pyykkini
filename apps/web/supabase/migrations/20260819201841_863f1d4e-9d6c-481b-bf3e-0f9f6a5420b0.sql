REVOKE ALL ON FUNCTION public.get_order_handover_info(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_orders_handover_info(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_complete_pickup(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_handover_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_handover_info(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_complete_pickup(uuid, numeric) TO authenticated;