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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          attended_card_seconds: number
          gateway_external_id: string | null
          id: string
          integration_status: string
          local_red_seconds: number
          log_retention_days: number
          new_call_rule: string
          output_mode: string
          shared_light_alert_color: string
          shared_light_color: string
          sound_alerts: string
          updated_at: string
          wait_threshold_seconds: number
        }
        Insert: {
          attended_card_seconds?: number
          gateway_external_id?: string | null
          id?: string
          integration_status?: string
          local_red_seconds?: number
          log_retention_days?: number
          new_call_rule?: string
          output_mode?: string
          shared_light_alert_color?: string
          shared_light_color?: string
          sound_alerts?: string
          updated_at?: string
          wait_threshold_seconds?: number
        }
        Update: {
          attended_card_seconds?: number
          gateway_external_id?: string | null
          id?: string
          integration_status?: string
          local_red_seconds?: number
          log_retention_days?: number
          new_call_rule?: string
          output_mode?: string
          shared_light_alert_color?: string
          shared_light_color?: string
          sound_alerts?: string
          updated_at?: string
          wait_threshold_seconds?: number
        }
        Relationships: []
      }
      bulbs: {
        Row: {
          bulb_code: string
          created_at: string
          external_id: string | null
          id: string
          table_number: number
        }
        Insert: {
          bulb_code: string
          created_at?: string
          external_id?: string | null
          id?: string
          table_number: number
        }
        Update: {
          bulb_code?: string
          created_at?: string
          external_id?: string | null
          id?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulbs_table_number_fkey"
            columns: ["table_number"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["table_number"]
          },
        ]
      }
      button_events: {
        Row: {
          button: number
          call_id: string | null
          environment: Database["public"]["Enums"]["app_env"]
          id: string
          idempotency_key: string
          received_at: string
          result: string | null
          source: string
          table_number: number
        }
        Insert: {
          button: number
          call_id?: string | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          idempotency_key: string
          received_at?: string
          result?: string | null
          source?: string
          table_number: number
        }
        Update: {
          button?: number
          call_id?: string | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          idempotency_key?: string
          received_at?: string
          result?: string | null
          source?: string
          table_number?: number
        }
        Relationships: []
      }
      calls: {
        Row: {
          attended_at: string | null
          attended_by: string | null
          called_at: string
          cooldown_until: string | null
          created_at: string
          duration_seconds: number | null
          environment: Database["public"]["Enums"]["app_env"]
          id: string
          status: Database["public"]["Enums"]["call_status"]
          table_number: number
        }
        Insert: {
          attended_at?: string | null
          attended_by?: string | null
          called_at?: string
          cooldown_until?: string | null
          created_at?: string
          duration_seconds?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          status?: Database["public"]["Enums"]["call_status"]
          table_number: number
        }
        Update: {
          attended_at?: string | null
          attended_by?: string | null
          called_at?: string
          cooldown_until?: string | null
          created_at?: string
          duration_seconds?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          status?: Database["public"]["Enums"]["call_status"]
          table_number?: number
        }
        Relationships: []
      }
      dining_tables: {
        Row: {
          alert_bulb_code: string
          button_device_external_id: string | null
          created_at: string
          gateway_external_id: string | null
          id: string
          table_number: number
        }
        Insert: {
          alert_bulb_code: string
          button_device_external_id?: string | null
          created_at?: string
          gateway_external_id?: string | null
          id?: string
          table_number: number
        }
        Update: {
          alert_bulb_code?: string
          button_device_external_id?: string | null
          created_at?: string
          gateway_external_id?: string | null
          id?: string
          table_number?: number
        }
        Relationships: []
      }
      lighting_commands: {
        Row: {
          action: string
          bulb_code: string | null
          color: string | null
          created_at: string
          dispatch_status: string
          duration_ms: number | null
          environment: Database["public"]["Enums"]["app_env"]
          id: string
          target: string
        }
        Insert: {
          action: string
          bulb_code?: string | null
          color?: string | null
          created_at?: string
          dispatch_status?: string
          duration_ms?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          target: string
        }
        Update: {
          action?: string
          bulb_code?: string | null
          color?: string | null
          created_at?: string
          dispatch_status?: string
          duration_ms?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          target?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          language: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          language?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ingest_button_event: {
        Args: {
          p_button: number
          p_environment: Database["public"]["Enums"]["app_env"]
          p_idempotency_key: string
          p_source?: string
          p_table_number: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_env: "production" | "demo"
      app_role: "admin" | "staff"
      call_status: "pending" | "attended"
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
  public: {
    Enums: {
      app_env: ["production", "demo"],
      app_role: ["admin", "staff"],
      call_status: ["pending", "attended"],
    },
  },
} as const
