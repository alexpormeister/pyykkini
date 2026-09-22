import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mgdvyfvcdivwzjxgrggv.supabase.co";
const supabasePublishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZHZ5ZnZjZGl2d3pqeGdyZ2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNzA4MTksImV4cCI6MjA2ODc0NjgxOX0.IsqZo2HO__NTMyRaMSRba4BTwbgTV9i3FHCvtBOs9yY";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})