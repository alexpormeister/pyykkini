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
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: number
          is_admin_message: boolean | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: number
          is_admin_message?: boolean | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: number
          is_admin_message?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_notes: string | null
          compensation_amount: number
          coupon_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_urls: string[]
          issue_type: string
          order_id: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          compensation_amount?: number
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_urls?: string[]
          issue_type?: string
          order_id?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          compensation_amount?: number
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_urls?: string[]
          issue_type?: string
          order_id?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      delivery_tasks: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          created_at: string
          destination_address: string | null
          destination_name: string | null
          destination_phone: string | null
          driver_id: string | null
          driver_payout: number
          id: string
          laundry_id: string | null
          order_id: string
          origin_address: string | null
          origin_name: string | null
          origin_phone: string | null
          route_order: number | null
          scheduled_date: string | null
          scheduled_time_slot: string | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_name?: string | null
          destination_phone?: string | null
          driver_id?: string | null
          driver_payout?: number
          id?: string
          laundry_id?: string | null
          order_id: string
          origin_address?: string | null
          origin_name?: string | null
          origin_phone?: string | null
          route_order?: number | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_name?: string | null
          destination_phone?: string | null
          driver_id?: string | null
          driver_payout?: number
          id?: string
          laundry_id?: string | null
          order_id?: string
          origin_address?: string | null
          origin_name?: string | null
          origin_phone?: string | null
          route_order?: number | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tasks_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      laundries: {
        Row: {
          address: string | null
          business_id: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      laundry_contracts: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          laundry_id: string
          notes: string | null
          payment_terms: string | null
          status: string
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          laundry_id: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          laundry_id?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_contracts_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_order_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_urls: string[]
          laundry_id: string
          note: string | null
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_urls?: string[]
          laundry_id: string
          note?: string | null
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_urls?: string[]
          laundry_id?: string
          note?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_order_notes_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_users: {
        Row: {
          created_at: string
          id: string
          laundry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          laundry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          laundry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_users_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
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
          commission_percent: number
          created_at: string
          dimensions_cm: Json | null
          driver_payout: number | null
          id: string
          laundry_id: string | null
          laundry_price: number | null
          metadata: Json | null
          order_id: string
          platform_fee: number | null
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
          commission_percent?: number
          created_at?: string
          dimensions_cm?: Json | null
          driver_payout?: number | null
          id?: string
          laundry_id?: string | null
          laundry_price?: number | null
          metadata?: Json | null
          order_id: string
          platform_fee?: number | null
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
          commission_percent?: number
          created_at?: string
          dimensions_cm?: Json | null
          driver_payout?: number | null
          id?: string
          laundry_id?: string | null
          laundry_price?: number | null
          metadata?: Json | null
          order_id?: string
          platform_fee?: number | null
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
            foreignKeyName: "order_items_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
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
          laundry_id: string | null
          laundry_status: string
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
          laundry_id?: string | null
          laundry_status?: string
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
          laundry_id?: string | null
          laundry_status?: string
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
          {
            foreignKeyName: "orders_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          points: number
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points: number
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points?: number
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_laundry_prices: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          laundry_id: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          laundry_id: string
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          laundry_id?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_laundry_prices_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_laundry_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string
          commission_percent: number
          created_at: string
          description: string | null
          driver_fee_type: string
          driver_fee_value: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          platform_fee_type: string
          platform_fee_value: number
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          product_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id: string
          commission_percent?: number
          created_at?: string
          description?: string | null
          driver_fee_type?: string
          driver_fee_value?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          platform_fee_type?: string
          platform_fee_value?: number
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          product_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string
          commission_percent?: number
          created_at?: string
          description?: string | null
          driver_fee_type?: string
          driver_fee_value?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          platform_fee_type?: string
          platform_fee_value?: number
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
          avatar_url: string | null
          business_id: string | null
          company_name: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          points_balance: number
          profile_image: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          business_id?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          points_balance?: number
          profile_image?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          business_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          points_balance?: number
          profile_image?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          city: string
          created_at: string
          delivery_days: string[]
          delivery_fee: number
          id: string
          is_active: boolean
          notes: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          delivery_days?: string[]
          delivery_fee?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          delivery_days?: string[]
          delivery_fee?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          created_at: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          order_ids: string[]
          orders_count: number
          paid_at: string | null
          paid_by: string | null
          paid_by_name: string | null
          payee_id: string | null
          payee_name: string
          payee_type: string
          period_end: string | null
          period_start: string | null
          platform_commission: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_ids?: string[]
          orders_count?: number
          paid_at?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          payee_id?: string | null
          payee_name: string
          payee_type: string
          period_end?: string | null
          period_start?: string | null
          platform_commission?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_ids?: string[]
          orders_count?: number
          paid_at?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          payee_id?: string | null
          payee_name?: string
          payee_type?: string
          period_end?: string | null
          period_start?: string | null
          platform_commission?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_chats: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          last_message_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          last_message_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          last_message_at?: string
          status?: string
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
      award_order_points: {
        Args: { p_amount: number; p_order_id: string; p_user_id: string }
        Returns: number
      }
      deduct_points: {
        Args: { amount_to_deduct: number; user_id_param: string }
        Returns: undefined
      }
      delete_user_account: { Args: never; Returns: undefined }
      driver_claim_task: {
        Args: { p_take_return?: boolean; p_task_id: string }
        Returns: Json
      }
      driver_complete_delivery:
        | { Args: { p_task_id: string }; Returns: Json }
        | { Args: { p_task_id: string; p_weight_kg?: number }; Returns: Json }
      driver_complete_pickup: {
        Args: { p_task_id: string; p_weight_kg?: number }
        Returns: Json
      }
      driver_pickup_from_laundry: { Args: { p_task_id: string }; Returns: Json }
      get_driver_completed_tasks: {
        Args: never
        Returns: {
          completed_at: string
          driver_payout: number
          id: string
          items: string[]
          order_id: string
          pickup_weight_kg: number
          return_weight_kg: number
          scheduled_date: string
          scheduled_time_slot: string
          task_type: string
        }[]
      }
      get_driver_orders: {
        Args: never
        Returns: {
          address: string
          created_at: string
          driver_id: string
          final_price: number
          first_name: string
          id: string
          last_name: string
          laundry_status: string
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
      get_open_delivery_tasks: {
        Args: never
        Returns: {
          area: string
          driver_payout: number
          id: string
          items: string[]
          laundry_name: string
          order_id: string
          pickup_claimed: boolean
          pickup_done: boolean
          scheduled_date: string
          scheduled_time_slot: string
          status: string
          task_type: string
        }[]
      }
      get_order_handover_info: { Args: { p_order_id: string }; Returns: Json }
      get_orders_handover_info: {
        Args: { p_order_ids: string[] }
        Returns: {
          access_code: string
          order_id: string
          pickup_weight_kg: number
          tracking_status: string
        }[]
      }
      get_product_pricing: {
        Args: { p_laundry_id?: string; p_product_id: string }
        Returns: {
          customer_price: number
          driver_payout: number
          laundry_id: string
          laundry_price: number
          platform_fee: number
          product_id: string
        }[]
      }
      get_user_points_balance: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_laundry_member: {
        Args: { _laundry_id: string; _user_id: string }
        Returns: boolean
      }
      laundry_confirm_receipt: {
        Args: { p_code: string; p_laundry_id: string; p_order_id: string }
        Returns: Json
      }
      laundry_decide_order: {
        Args: { p_decision: string; p_laundry_id: string; p_order_id: string }
        Returns: Json
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
      recalculate_order_payouts: {
        Args: { p_order_id: string }
        Returns: number
      }
      redeem_points: {
        Args: { p_description?: string; p_points: number; p_user_id: string }
        Returns: boolean
      }
      validate_data_access: {
        Args: { operation: string; table_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "customer" | "laundry"
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
        | "pending"
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
      app_role: ["admin", "driver", "customer", "laundry"],
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
        "pending",
      ],
      pricing_model: ["FIXED", "PER_M2"],
    },
  },
} as const
