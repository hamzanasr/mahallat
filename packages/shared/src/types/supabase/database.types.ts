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
      get_setting: {
        Args: {
          p_city_id?: string
          p_key: string
          p_merchant_id?: string
          p_store_id?: string
        }
        Returns: Json
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
      setting_type:
        | "number"
        | "percentage"
        | "amount_halalas"
        | "duration_minutes"
        | "duration_seconds"
        | "boolean"
        | "select"
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
      setting_type: [
        "number",
        "percentage",
        "amount_halalas",
        "duration_minutes",
        "duration_seconds",
        "boolean",
        "select",
      ],
    },
  },
} as const
