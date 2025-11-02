export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          id: string
          metadata: Json | null
          table_name: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          metadata?: Json | null
          table_name: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          metadata?: Json | null
          table_name?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      driver_calendar_events: {
        Row: {
          created_at: string
          description: string | null
          driver_id: string
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          driver_id: string
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          driver_id?: string
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_shifts: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          is_active: boolean
          started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_history: {
        Row: {
          change_description: string | null
          change_type: string
          changed_by: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          order_id: string
        }
        Insert: {
          change_description?: string | null
          change_type: string
          changed_by: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id: string
        }
        Update: {
          change_description?: string | null
          change_type?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dimensions_cm: Json | null
          id: string
          metadata: Json | null
          order_id: string
          product_name: string | null
          quantity: number
          rug_dimensions: string | null
          service_name: string
          service_type: string
          total_price: number
          unit_price: number
          unit_price_charged: number | null
        }
        Insert: {
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          metadata?: Json | null
          order_id: string
          product_name?: string | null
          quantity?: number
          rug_dimensions?: string | null
          service_name: string
          service_type: string
          total_price: number
          unit_price: number
          unit_price_charged?: number | null
        }
        Update: {
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          metadata?: Json | null
          order_id?: string
          product_name?: string | null
          quantity?: number
          rug_dimensions?: string | null
          service_name?: string
          service_type?: string
          total_price?: number
          unit_price?: number
          unit_price_charged?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_rejections: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          order_id: string
          rejected_at: string
          rejection_reason: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          order_id: string
          rejected_at?: string
          rejection_reason?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          order_id?: string
          rejected_at?: string
          rejection_reason?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          access_code: string | null
          actual_pickup_time: string | null
          actual_return_time: string | null
          address: string
          coupon_id: string | null
          created_at: string
          delivery_slot: string | null
          discount_code: string | null
          driver_id: string | null
          final_price: number
          first_name: string
          id: string
          last_name: string
          paid_at: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone: string
          pickup_date: string
          pickup_option: string | null
          pickup_slot: string | null
          pickup_time: string
          pickup_weight_kg: number | null
          price: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          rejection_timestamp: string | null
          return_date: string
          return_option: string | null
          return_time: string
          return_weight_kg: number | null
          service_name: string
          service_type: string
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          terms_accepted: boolean
          tracking_status:
            | Database["public"]["Enums"]["order_tracking_status"]
            | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          access_code?: string | null
          actual_pickup_time?: string | null
          actual_return_time?: string | null
          address: string
          coupon_id?: string | null
          created_at?: string
          delivery_slot?: string | null
          discount_code?: string | null
          driver_id?: string | null
          final_price: number
          first_name: string
          id?: string
          last_name: string
          paid_at?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone: string
          pickup_date: string
          pickup_option?: string | null
          pickup_slot?: string | null
          pickup_time: string
          pickup_weight_kg?: number | null
          price: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          rejection_timestamp?: string | null
          return_date: string
          return_option?: string | null
          return_time: string
          return_weight_kg?: number | null
          service_name: string
          service_type: string
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          terms_accepted?: boolean
          tracking_status?:
            | Database["public"]["Enums"]["order_tracking_status"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          access_code?: string | null
          actual_pickup_time?: string | null
          actual_return_time?: string | null
          address?: string
          coupon_id?: string | null
          created_at?: string
          delivery_slot?: string | null
          discount_code?: string | null
          driver_id?: string | null
          final_price?: number
          first_name?: string
          id?: string
          last_name?: string
          paid_at?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string
          pickup_date?: string
          pickup_option?: string | null
          pickup_slot?: string | null
          pickup_time?: string
          pickup_weight_kg?: number | null
          price?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          rejection_timestamp?: string | null
          return_date?: string
          return_option?: string | null
          return_time?: string
          return_weight_kg?: number | null
          service_name?: string
          service_type?: string
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          terms_accepted?: boolean
          tracking_status?:
            | Database["public"]["Enums"]["order_tracking_status"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          product_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          product_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          profile_image: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_image?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_image?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_driver_orders: {
        Args: never
        Returns: {
          address: string
          created_at: string
          driver_id: string
          first_name: string
          id: string
          last_name: string
          phone: string
          pickup_date: string
          pickup_time: string
          price: number
          return_date: string
          return_time: string
          service_name: string
          service_type: string
          status: Database["public"]["Enums"]["order_status"]
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_order_change: {
        Args: {
          p_change_type: string
          p_description?: string
          p_new_value?: Json
          p_old_value?: Json
          p_order_id: string
        }
        Returns: string
      }
      validate_data_access: {
        Args: { operation: string; table_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "customer"
      order_status:
        | "pending"
        | "accepted"
        | "picking_up"
        | "washing"
        | "returning"
        | "delivered"
        | "rejected"
        | "cancelled"
      order_tracking_status:
        | "PENDING"
        | "PICKED_UP"
        | "WASHING"
        | "PACKAGING"
        | "OUT_FOR_DELIVERY"
        | "COMPLETED"
      pricing_model: "FIXED" | "PER_M2"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "driver", "customer"],
      order_status: [
        "pending",
        "accepted",
        "picking_up",
        "washing",
        "returning",
        "delivered",
        "rejected",
        "cancelled",
      ],
      order_tracking_status: [
        "PENDING",
        "PICKED_UP",
        "WASHING",
        "PACKAGING",
        "OUT_FOR_DELIVERY",
        "COMPLETED",
      ],
      pricing_model: ["FIXED", "PER_M2"],
    },
  },
} as const
