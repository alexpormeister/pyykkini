import { SupabaseClient } from '@supabase/supabase-js';

export interface OrderEmbedded {
  id: string;
  user_id: string;
  driver_id: string | null;
  laundry_id: string | null;
  status: string;
  tracking_status: string | null;
  laundry_status: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  special_instructions: string | null;
  service_name: string;
  final_price: number;
  price?: number;
  payment_method?: string | null;
  access_code: string | null;
}

export interface TaskRow {
  id: string;
  order_id: string;
  task_type: string;
  driver_id: string | null;
  laundry_id: string | null;
  origin_name: string | null;
  origin_address: string | null;
  destination_name: string | null;
  destination_address: string | null;
  pickup_name?: string | null;
  pickup_address?: string | null;
  pickup_phone?: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  scheduled_time_slot: string | null;
  status: string;
  driver_payout: number;
  route_order: number | null;
  batch_id: string | null;
  notes?: string | null;
  orders?: OrderEmbedded | null;
}

export interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export interface DriverInfo extends Profile {
  is_active: boolean;
}

export interface LaundryInfo {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  contact_phone?: string | null;
}

export interface ProductInfo {
  id: string;
  product_id?: string;
  name: string;
  base_price: number;
  platform_fee_value?: number | string | null;
  driver_fee_value?: number | string | null;
}

export interface LaundryProductPrice {
  product_id: string;
  laundry_id: string;
  price: number;
  is_active: boolean;
}

export const fetchDispatchData = async (supabase: SupabaseClient) => {
  const [tasksRes, rolesRes, shiftsRes, laundriesRes, productsRes, slotsRes, settingsRes] = await Promise.all([
    supabase
      .from("delivery_tasks")
      .select("*, orders(*)")
      .order("scheduled_date", { ascending: true })
      .order("route_order", { ascending: true, nullsFirst: false }),
    supabase.from("user_roles").select("user_id, role").eq("role", "driver"),
    supabase.from("driver_shifts").select("driver_id").eq("is_active", true),
    supabase.from("laundries").select("id, name, address, city, contact_phone").order("name"),
    supabase.from("products").select("id, product_id, name, base_price, platform_fee_value, driver_fee_value").eq("is_active", true).order("sort_order"),
    supabase.from("time_slots").select("id, label, slot_type, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("app_settings").select("min_order_amount, service_fee, delivery_fee").eq("id", "global").maybeSingle(),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (rolesRes.error) throw rolesRes.error;
  if (shiftsRes.error) throw shiftsRes.error;
  if (laundriesRes.error) throw laundriesRes.error;
  if (productsRes.error) throw productsRes.error;
  if (slotsRes.error) throw slotsRes.error;

  const driverIds = (rolesRes.data || []).map((r: any) => r.user_id as string);
  const activeIds = new Set((shiftsRes.data || []).map((s: any) => s.driver_id as string));

  let drivers: DriverInfo[] = [];
  if (driverIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, phone")
      .in("user_id", driverIds);
      
    if (profileError) throw profileError;

    drivers = driverIds.map((id) => {
      const p = (profileData as Profile[] | null)?.find((pr) => pr.user_id === id);
      return {
        user_id: id,
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        phone: p?.phone || null,
        is_active: activeIds.has(id),
      };
    });
  }

  return {
    tasks: tasksRes.data as unknown as TaskRow[],
    drivers,
    laundries: laundriesRes.data as LaundryInfo[],
    products: productsRes.data as ProductInfo[],
    dbTimeSlots: slotsRes.data,
    settings: settingsRes.data
  };
};

export const fetchLaundryPrices = async (supabase: SupabaseClient, laundryId: string) => {
  const { data, error } = await supabase
    .from("product_laundry_prices")
    .select("product_id, laundry_id, price, is_active")
    .eq("laundry_id", laundryId);

  if (error) throw error;
  return data as LaundryProductPrice[];
};
