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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          acknowledged_forfeiture: boolean
          created_at: string
          id: string
          phone: string
          reason: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_forfeiture?: boolean
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_forfeiture?: boolean
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_invitations: {
        Row: {
          city_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_invitations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          boundary: unknown
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          boundary?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          city_hint: string | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          district_name: string | null
          id: string
          ip_address: string | null
          latitude: number
          location: unknown
          longitude: number
          note: string | null
        }
        Insert: {
          city_hint?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          district_name?: string | null
          id?: string
          ip_address?: string | null
          latitude: number
          location: unknown
          longitude: number
          note?: string | null
        }
        Update: {
          city_hint?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          district_name?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number
          location?: unknown
          longitude?: number
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coverage_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          apartment: string | null
          building: string | null
          city_id: string | null
          corrected_entrance_lat: number | null
          corrected_entrance_lng: number | null
          corrected_entrance_location: unknown
          created_at: string
          customer_id: string
          district_name: string | null
          entry_instructions: string | null
          floor: string | null
          id: string
          is_default: boolean
          latitude: number
          location: unknown
          longitude: number
          name: string
          no_answer_instructions: string | null
          pin_confirmed_at: string
          short_national_address: string | null
          street_name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          apartment?: string | null
          building?: string | null
          city_id?: string | null
          corrected_entrance_lat?: number | null
          corrected_entrance_lng?: number | null
          corrected_entrance_location?: unknown
          created_at?: string
          customer_id: string
          district_name?: string | null
          entry_instructions?: string | null
          floor?: string | null
          id?: string
          is_default?: boolean
          latitude: number
          location: unknown
          longitude: number
          name: string
          no_answer_instructions?: string | null
          pin_confirmed_at: string
          short_national_address?: string | null
          street_name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          apartment?: string | null
          building?: string | null
          city_id?: string | null
          corrected_entrance_lat?: number | null
          corrected_entrance_lng?: number | null
          corrected_entrance_location?: unknown
          created_at?: string
          customer_id?: string
          district_name?: string | null
          entry_instructions?: string | null
          floor?: string | null
          id?: string
          is_default?: boolean
          latitude?: number
          location?: unknown
          longitude?: number
          name?: string
          no_answer_instructions?: string | null
          pin_confirmed_at?: string
          short_national_address?: string | null
          street_name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          applies_to: Database["public"]["Enums"]["document_entity_type"]
          code: string
          created_at: string
          id: string
          is_mandatory: boolean
          name_ar: string
          name_en: string
          requires_expiry_date: boolean
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["document_entity_type"]
          code: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          name_ar: string
          name_en: string
          requires_expiry_date?: boolean
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["document_entity_type"]
          code?: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          name_ar?: string
          name_en?: string
          requires_expiry_date?: boolean
        }
        Relationships: []
      }
      menu_item_option_groups: {
        Row: {
          id: string
          is_required: boolean
          item_id: string
          max_selectable: number
          min_selectable: number
          name_ar: string
          name_en: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_required?: boolean
          item_id: string
          max_selectable?: number
          min_selectable?: number
          name_ar: string
          name_en: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_required?: boolean
          item_id?: string
          max_selectable?: number
          min_selectable?: number
          name_ar?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_option_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_options: {
        Row: {
          calories_delta: number
          group_id: string
          id: string
          name_ar: string
          name_en: string
          price_delta_halalas: number
          sort_order: number
        }
        Insert: {
          calories_delta?: number
          group_id: string
          id?: string
          name_ar: string
          name_en: string
          price_delta_halalas?: number
          sort_order?: number
        }
        Update: {
          calories_delta?: number
          group_id?: string
          id?: string
          name_ar?: string
          name_en?: string
          price_delta_halalas?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_item_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_sizes: {
        Row: {
          calories_value: number | null
          id: string
          is_default: boolean
          item_id: string
          name_ar: string
          name_en: string
          price_delta_halalas: number
          sort_order: number
        }
        Insert: {
          calories_value?: number | null
          id?: string
          is_default?: boolean
          item_id: string
          name_ar: string
          name_en: string
          price_delta_halalas?: number
          sort_order?: number
        }
        Update: {
          calories_value?: number | null
          id?: string
          is_default?: boolean
          item_id?: string
          name_ar?: string
          name_en?: string
          price_delta_halalas?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_sizes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          available_hours: Json | null
          base_price_halalas: number
          caffeine_mg: number | null
          calories_max: number | null
          calories_min: number | null
          calories_value: number | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          dietary_tags: string[]
          has_caffeine: boolean
          id: string
          image_url: string | null
          is_available: boolean
          is_high_salt: boolean
          is_published: boolean
          is_sfda_exempt: boolean
          is_suggested_in_cart: boolean
          name_ar: string
          name_en: string
          paused_until: string | null
          prep_time_minutes: number
          section_id: string
          sfda_exemption_reason_id: string | null
          sodium_mg: number | null
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          available_hours?: Json | null
          base_price_halalas: number
          caffeine_mg?: number | null
          calories_max?: number | null
          calories_min?: number | null
          calories_value?: number | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          dietary_tags?: string[]
          has_caffeine?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_high_salt?: boolean
          is_published?: boolean
          is_sfda_exempt?: boolean
          is_suggested_in_cart?: boolean
          name_ar: string
          name_en: string
          paused_until?: string | null
          prep_time_minutes: number
          section_id: string
          sfda_exemption_reason_id?: string | null
          sodium_mg?: number | null
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          available_hours?: Json | null
          base_price_halalas?: number
          caffeine_mg?: number | null
          calories_max?: number | null
          calories_min?: number | null
          calories_value?: number | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          dietary_tags?: string[]
          has_caffeine?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_high_salt?: boolean
          is_published?: boolean
          is_sfda_exempt?: boolean
          is_suggested_in_cart?: boolean
          name_ar?: string
          name_en?: string
          paused_until?: string | null
          prep_time_minutes?: number
          section_id?: string
          sfda_exemption_reason_id?: string | null
          sodium_mg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_sfda_exemption_reason_id_fkey"
            columns: ["sfda_exemption_reason_id"]
            isOneToOne: false
            referencedRelation: "sfda_exemption_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_review_requests: {
        Row: {
          change_type: string
          created_at: string
          id: string
          item_id: string
          old_price_halalas: number | null
          proposed_price_halalas: number
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["review_request_status"]
          store_id: string
        }
        Insert: {
          change_type: string
          created_at?: string
          id?: string
          item_id: string
          old_price_halalas?: number | null
          proposed_price_halalas: number
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          store_id: string
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          item_id?: string
          old_price_halalas?: number | null
          proposed_price_halalas?: number
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_review_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_review_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_bank_accounts: {
        Row: {
          bank_name: string
          beneficiary_name: string
          created_at: string
          iban: string
          id: string
          is_verified: boolean
          merchant_id: string
          updated_at: string
        }
        Insert: {
          bank_name: string
          beneficiary_name: string
          created_at?: string
          iban: string
          id?: string
          is_verified?: boolean
          merchant_id: string
          updated_at?: string
        }
        Update: {
          bank_name?: string
          beneficiary_name?: string
          created_at?: string
          iban?: string
          id?: string
          is_verified?: boolean
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_bank_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_users: {
        Row: {
          branch_id: string | null
          can_manage_menu: boolean
          can_manage_orders: boolean
          can_view_finance: boolean
          created_at: string
          id: string
          merchant_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          can_manage_menu?: boolean
          can_manage_orders?: boolean
          can_view_finance?: boolean
          created_at?: string
          id?: string
          merchant_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          can_manage_menu?: boolean
          can_manage_orders?: boolean
          can_view_finance?: boolean
          created_at?: string
          id?: string
          merchant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_users_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          commercial_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          cr_number: string | null
          created_at: string
          id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          commercial_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cr_number?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          commercial_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cr_number?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          order_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          city_id: string
          cooling_off_expires_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          delivery_address_id: string | null
          delivery_address_snapshot: Json | null
          delivery_code: string | null
          delivery_fee_halalas: number
          delivery_type: string
          discount_halalas: number
          estimated_delivery_time_minutes: number
          estimated_prep_time_minutes: number
          id: string
          idempotency_key: string | null
          items_total_halalas: number
          order_number: string
          order_snapshot: Json
          out_of_stock_action: string
          pickup_code: string | null
          service_fee_halalas: number
          status: string
          store_id: string
          tip_halalas: number
          total_halalas: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          city_id: string
          cooling_off_expires_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          delivery_address_id?: string | null
          delivery_address_snapshot?: Json | null
          delivery_code?: string | null
          delivery_fee_halalas?: number
          delivery_type: string
          discount_halalas?: number
          estimated_delivery_time_minutes?: number
          estimated_prep_time_minutes?: number
          id?: string
          idempotency_key?: string | null
          items_total_halalas: number
          order_number?: string
          order_snapshot: Json
          out_of_stock_action?: string
          pickup_code?: string | null
          service_fee_halalas?: number
          status?: string
          store_id: string
          tip_halalas?: number
          total_halalas: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          city_id?: string
          cooling_off_expires_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          delivery_address_id?: string | null
          delivery_address_snapshot?: Json | null
          delivery_code?: string | null
          delivery_fee_halalas?: number
          delivery_type?: string
          discount_halalas?: number
          estimated_delivery_time_minutes?: number
          estimated_prep_time_minutes?: number
          id?: string
          idempotency_key?: string | null
          items_total_halalas?: number
          order_number?: string
          order_snapshot?: Json
          out_of_stock_action?: string
          pickup_code?: string | null
          service_fee_halalas?: number
          status?: string
          store_id?: string
          tip_halalas?: number
          total_halalas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_rate_limits: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      setting_definitions: {
        Row: {
          allowed_levels: string[]
          created_at: string
          default_value: Json
          description_ar: string | null
          key: string
          max_value: number | null
          min_value: number | null
          name_ar: string
          options: Json | null
          related_requirements: string[]
          type: Database["public"]["Enums"]["setting_type"]
        }
        Insert: {
          allowed_levels?: string[]
          created_at?: string
          default_value: Json
          description_ar?: string | null
          key: string
          max_value?: number | null
          min_value?: number | null
          name_ar: string
          options?: Json | null
          related_requirements?: string[]
          type: Database["public"]["Enums"]["setting_type"]
        }
        Update: {
          allowed_levels?: string[]
          created_at?: string
          default_value?: Json
          description_ar?: string | null
          key?: string
          max_value?: number | null
          min_value?: number | null
          name_ar?: string
          options?: Json | null
          related_requirements?: string[]
          type?: Database["public"]["Enums"]["setting_type"]
        }
        Relationships: []
      }
      setting_values: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          key: string
          level: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          key: string
          level: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          key?: string
          level?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "setting_values_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "setting_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      sfda_exemption_reasons: {
        Row: {
          code: string
          id: string
          reason_ar: string
          reason_en: string
        }
        Insert: {
          code: string
          id?: string
          reason_ar: string
          reason_en: string
        }
        Update: {
          code?: string
          id?: string
          reason_ar?: string
          reason_en?: string
        }
        Relationships: []
      }
      store_blocked_drivers: {
        Row: {
          created_at: string
          driver_id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          reason?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_blocked_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_blocked_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_branches: {
        Row: {
          address_text: string
          city_id: string
          created_at: string
          default_prep_time_minutes: number
          id: string
          is_active: boolean
          location: unknown
          min_order_halalas: number
          name_ar: string
          name_en: string
          paused_until: string | null
          store_id: string
          updated_at: string
          working_hours: Json
        }
        Insert: {
          address_text: string
          city_id: string
          created_at?: string
          default_prep_time_minutes?: number
          id?: string
          is_active?: boolean
          location: unknown
          min_order_halalas?: number
          name_ar: string
          name_en: string
          paused_until?: string | null
          store_id: string
          updated_at?: string
          working_hours?: Json
        }
        Update: {
          address_text?: string
          city_id?: string
          created_at?: string
          default_prep_time_minutes?: number
          id?: string
          is_active?: boolean
          location?: unknown
          min_order_halalas?: number
          name_ar?: string
          name_en?: string
          paused_until?: string | null
          store_id?: string
          updated_at?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_branches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_branches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          section_key: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          section_key: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          section_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      store_contracts: {
        Row: {
          contract_per_customer_cap_halalas: number
          contract_per_customer_period_days: number
          contract_percentage: number
          created_at: string
          id: string
          mart_pharmacy_customer_markup_percentage: number
          mart_pharmacy_merchant_percentage: number
          menu_markup_percentage: number
          menu_markup_platform_share_percentage: number
          payment_gateway_fee_fixed_halalas: number
          payment_gateway_fee_percentage: number
          pricing_model: Database["public"]["Enums"]["contract_pricing_model"]
          store_id: string
          text_orders_platform_fee_percentage: number
          tier1_fee_halalas: number
          tier1_order_threshold_halalas: number
          tier2_fee_halalas: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          contract_per_customer_cap_halalas?: number
          contract_per_customer_period_days?: number
          contract_percentage?: number
          created_at?: string
          id?: string
          mart_pharmacy_customer_markup_percentage?: number
          mart_pharmacy_merchant_percentage?: number
          menu_markup_percentage?: number
          menu_markup_platform_share_percentage?: number
          payment_gateway_fee_fixed_halalas?: number
          payment_gateway_fee_percentage?: number
          pricing_model?: Database["public"]["Enums"]["contract_pricing_model"]
          store_id: string
          text_orders_platform_fee_percentage?: number
          tier1_fee_halalas?: number
          tier1_order_threshold_halalas?: number
          tier2_fee_halalas?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          contract_per_customer_cap_halalas?: number
          contract_per_customer_period_days?: number
          contract_percentage?: number
          created_at?: string
          id?: string
          mart_pharmacy_customer_markup_percentage?: number
          mart_pharmacy_merchant_percentage?: number
          menu_markup_percentage?: number
          menu_markup_platform_share_percentage?: number
          payment_gateway_fee_fixed_halalas?: number
          payment_gateway_fee_percentage?: number
          pricing_model?: Database["public"]["Enums"]["contract_pricing_model"]
          store_id?: string
          text_orders_platform_fee_percentage?: number
          tier1_fee_halalas?: number
          tier1_order_threshold_halalas?: number
          tier2_fee_halalas?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_favorite_drivers: {
        Row: {
          created_at: string
          driver_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_favorite_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_favorite_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner_url: string | null
          can_exceed_max_prep_time: boolean
          category_id: string | null
          city_id: string
          created_at: string
          custom_delivery_fee_halalas: number | null
          default_prep_time_minutes: number
          delivery_zone_id: string | null
          id: string
          logo_url: string | null
          menu_permission: Database["public"]["Enums"]["menu_permission_type"]
          menu_price_tolerance_percentage: number
          menu_slug: string
          merchant_id: string
          min_order_halalas: number
          name_ar: string
          name_en: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          pharmacy_license_expiry: string | null
          pharmacy_license_number: string | null
          pos_system_name: string | null
          self_pickup_cost_bearer: Database["public"]["Enums"]["pickup_cost_bearer"]
          self_pickup_discount_percentage: number
          self_pickup_enabled: boolean
          self_pickup_platform_share_percentage: number
          store_type: Database["public"]["Enums"]["store_type"]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          can_exceed_max_prep_time?: boolean
          category_id?: string | null
          city_id: string
          created_at?: string
          custom_delivery_fee_halalas?: number | null
          default_prep_time_minutes?: number
          delivery_zone_id?: string | null
          id?: string
          logo_url?: string | null
          menu_permission?: Database["public"]["Enums"]["menu_permission_type"]
          menu_price_tolerance_percentage?: number
          menu_slug: string
          merchant_id: string
          min_order_halalas?: number
          name_ar: string
          name_en: string
          operation_type?: Database["public"]["Enums"]["operation_type"]
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pos_system_name?: string | null
          self_pickup_cost_bearer?: Database["public"]["Enums"]["pickup_cost_bearer"]
          self_pickup_discount_percentage?: number
          self_pickup_enabled?: boolean
          self_pickup_platform_share_percentage?: number
          store_type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          can_exceed_max_prep_time?: boolean
          category_id?: string | null
          city_id?: string
          created_at?: string
          custom_delivery_fee_halalas?: number | null
          default_prep_time_minutes?: number
          delivery_zone_id?: string | null
          id?: string
          logo_url?: string | null
          menu_permission?: Database["public"]["Enums"]["menu_permission_type"]
          menu_price_tolerance_percentage?: number
          menu_slug?: string
          merchant_id?: string
          min_order_halalas?: number
          name_ar?: string
          name_en?: string
          operation_type?: Database["public"]["Enums"]["operation_type"]
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pos_system_name?: string | null
          self_pickup_cost_bearer?: Database["public"]["Enums"]["pickup_cost_bearer"]
          self_pickup_discount_percentage?: number
          self_pickup_enabled?: boolean
          self_pickup_platform_share_percentage?: number
          store_type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          created_at: string
          document_type_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          expiry_date: string | null
          file_url: string
          id: string
          is_verified: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          expiry_date?: string | null
          file_url: string
          id?: string
          is_verified?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type_id?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["document_entity_type"]
          expiry_date?: string | null
          file_url?: string
          id?: string
          is_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consent_type: string
          created_at: string
          device_info: Json | null
          id: string
          ip_address: string | null
          status: string
          user_id: string
          version: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          status: string
          user_id: string
          version?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          status?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          city_id: string | null
          created_at: string
          fleet_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          store_id: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          city_id?: string | null
          created_at?: string
          fleet_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          city_id?: string | null
          created_at?: string
          fleet_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          boundary: unknown
          city_id: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          updated_at: string
          zone_type: string
        }
        Insert: {
          boundary: unknown
          city_id: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          updated_at?: string
          zone_type: string
        }
        Update: {
          boundary?: unknown
          city_id?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          updated_at?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_store_contract: {
        Args: {
          p_contract_per_customer_cap_halalas: number
          p_contract_per_customer_period_days: number
          p_contract_percentage: number
          p_mart_pharmacy_customer_markup_percentage: number
          p_mart_pharmacy_merchant_percentage: number
          p_menu_markup_percentage: number
          p_menu_markup_platform_share_percentage: number
          p_payment_gateway_fee_fixed_halalas: number
          p_payment_gateway_fee_percentage: number
          p_pricing_model: Database["public"]["Enums"]["contract_pricing_model"]
          p_store_id: string
          p_text_orders_platform_fee_percentage: number
          p_tier1_fee_halalas: number
          p_tier1_order_threshold_halalas: number
          p_tier2_fee_halalas: number
        }
        Returns: string
      }
      admin_save_branch: {
        Args: {
          p_address_text: string
          p_city_id: string
          p_default_prep_time_minutes?: number
          p_id: string
          p_is_active?: boolean
          p_latitude: number
          p_longitude: number
          p_min_order_halalas?: number
          p_name_ar: string
          p_name_en: string
          p_store_id: string
          p_working_hours?: Json
        }
        Returns: string
      }
      admin_save_city: {
        Args: {
          p_geojson?: string
          p_id: string
          p_is_active: boolean
          p_name_ar: string
          p_name_en: string
        }
        Returns: string
      }
      admin_update_setting: {
        Args: {
          p_city_id?: string
          p_key: string
          p_reason: string
          p_store_id?: string
          p_value: Json
        }
        Returns: Json
      }
      calculate_customer_item_price: {
        Args: { p_base_price_halalas: number; p_store_id: string }
        Returns: number
      }
      calculate_delivery_fee: {
        Args: {
          p_branch_id: string
          p_city_id: string
          p_distance_km: number
          p_store_id: string
        }
        Returns: number
      }
      calculate_service_fee: {
        Args: {
          p_city_id: string
          p_delivery_halalas: number
          p_products_halalas: number
        }
        Returns: number
      }
      cancel_customer_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      check_and_record_otp_request: {
        Args: { p_device_id?: string; p_ip?: string; p_phone: string }
        Returns: Json
      }
      check_branch_open_status: {
        Args: { p_branch_id: string; p_check_time?: string }
        Returns: Json
      }
      city_for_point: {
        Args: { lat: number; lng: number }
        Returns: {
          boundary: unknown
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_customer_order: {
        Args: {
          p_address_id?: string
          p_branch_id: string
          p_customer_lat?: number
          p_customer_lng?: number
          p_customer_notes?: string
          p_delivery_type: string
          p_expected_total_halalas?: number
          p_idempotency_key?: string
          p_items?: Json
          p_out_of_stock_action?: string
          p_tip_halalas?: number
        }
        Returns: Json
      }
      customer_menu: { Args: { p_store_id: string }; Returns: Json }
      estimate_delivery_time: {
        Args: {
          p_city_id: string
          p_distance_km: number
          p_prep_time_minutes: number
        }
        Returns: Json
      }
      generate_order_number: { Args: never; Returns: string }
      get_cities_geojson: {
        Args: never
        Returns: {
          created_at: string
          geojson: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }[]
      }
      get_setting: {
        Args: {
          p_city_id?: string
          p_key: string
          p_merchant_id?: string
          p_store_id?: string
        }
        Returns: Json
      }
      get_store_branches: {
        Args: { p_store_id: string }
        Returns: {
          address_text: string
          city_id: string
          created_at: string
          default_prep_time_minutes: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          min_order_halalas: number
          name_ar: string
          name_en: string
          paused_until: string
          store_id: string
          updated_at: string
          working_hours: Json
        }[]
      }
      has_role: {
        Args: {
          _branch_id?: string
          _city_id?: string
          _fleet_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _store_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_aal2: { Args: { _user_id: string }; Returns: boolean }
      quote_cart: {
        Args: {
          p_device_lat?: number
          p_device_lng?: number
          p_items: Json
          p_lat: number
          p_lng: number
          p_store_id: string
        }
        Returns: Json
      }
      review_menu_change_request: {
        Args: {
          p_action: string
          p_rejection_reason?: string
          p_request_id: string
        }
        Returns: Json
      }
      stores_for_point: {
        Args: {
          p_category_id?: string
          p_lat: number
          p_lng: number
          p_section?: string
        }
        Returns: {
          banner_url: string
          category_name_ar: string
          category_name_en: string
          closes_at: string
          delivery_fee_halalas: number
          distance_km: number
          estimated_time_range: string
          is_open: boolean
          logo_url: string
          min_order_halalas: number
          next_open_at: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          self_pickup_discount_percentage: number
          self_pickup_enabled: boolean
          serving_branch_id: string
          serving_branch_name_ar: string
          store_id: string
          store_name_ar: string
          store_name_en: string
          store_type: Database["public"]["Enums"]["store_type"]
        }[]
      }
      submit_coverage_request: {
        Args: {
          p_city_hint?: string
          p_device_id?: string
          p_district_name?: string
          p_lat: number
          p_lng: number
          p_note?: string
        }
        Returns: {
          city_hint: string | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          district_name: string | null
          id: string
          ip_address: string | null
          latitude: number
          location: unknown
          longitude: number
          note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "coverage_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_menu_item_price_update: {
        Args: { p_item_id: string; p_new_price_halalas: number }
        Returns: Json
      }
      transition_order_status: {
        Args: {
          p_changed_by_role?: string
          p_metadata?: Json
          p_new_status: string
          p_order_id: string
          p_reason?: string
        }
        Returns: {
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          city_id: string
          cooling_off_expires_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          delivery_address_id: string | null
          delivery_address_snapshot: Json | null
          delivery_code: string | null
          delivery_fee_halalas: number
          delivery_type: string
          discount_halalas: number
          estimated_delivery_time_minutes: number
          estimated_prep_time_minutes: number
          id: string
          idempotency_key: string | null
          items_total_halalas: number
          order_number: string
          order_snapshot: Json
          out_of_stock_action: string
          pickup_code: string | null
          service_fee_halalas: number
          status: string
          store_id: string
          tip_halalas: number
          total_halalas: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "operations"
        | "finance"
        | "support"
        | "marketing"
        | "merchant_owner"
        | "branch_staff"
        | "fleet_manager"
        | "driver"
        | "customer"
      contract_pricing_model: "per_customer" | "percentage" | "no_commission"
      document_entity_type: "merchant" | "branch"
      menu_permission_type: "full" | "price_tolerance" | "review_required"
      operation_type: "restaurant" | "retail" | "mart" | "pharmacy"
      pickup_cost_bearer: "platform" | "merchant" | "split"
      review_request_status: "pending" | "approved" | "rejected"
      setting_type:
        | "number"
        | "percentage"
        | "amount_halalas"
        | "duration_minutes"
        | "duration_seconds"
        | "boolean"
        | "select"
      store_type: "contracted_menu" | "contracted_text_only" | "uncontracted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "operations",
        "finance",
        "support",
        "marketing",
        "merchant_owner",
        "branch_staff",
        "fleet_manager",
        "driver",
        "customer",
      ],
      contract_pricing_model: ["per_customer", "percentage", "no_commission"],
      document_entity_type: ["merchant", "branch"],
      menu_permission_type: ["full", "price_tolerance", "review_required"],
      operation_type: ["restaurant", "retail", "mart", "pharmacy"],
      pickup_cost_bearer: ["platform", "merchant", "split"],
      review_request_status: ["pending", "approved", "rejected"],
      setting_type: [
        "number",
        "percentage",
        "amount_halalas",
        "duration_minutes",
        "duration_seconds",
        "boolean",
        "select",
      ],
      store_type: ["contracted_menu", "contracted_text_only", "uncontracted"],
    },
  },
} as const
