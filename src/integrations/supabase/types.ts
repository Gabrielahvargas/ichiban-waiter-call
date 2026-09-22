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
      admin_pin: {
        Row: {
          id: string
          pin_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          pin_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          pin_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_pin_attempts: {
        Row: {
          attempted_at: string
          id: string
          screen_id: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          screen_id?: string | null
          success: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          screen_id?: string | null
          success?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          attended_card_seconds: number
          dinner_start_hour: number
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
          timezone: string
          updated_at: string
          wait_threshold_seconds: number
        }
        Insert: {
          attended_card_seconds?: number
          dinner_start_hour?: number
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
          timezone?: string
          updated_at?: string
          wait_threshold_seconds?: number
        }
        Update: {
          attended_card_seconds?: number
          dinner_start_hour?: number
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
          timezone?: string
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
          assigned_waiter_id: string | null
          assigned_waiter_name: string | null
          attended_at: string | null
          attended_by: string | null
          called_at: string
          cooldown_until: string | null
          created_at: string
          duration_seconds: number | null
          environment: Database["public"]["Enums"]["app_env"]
          id: string
          service_date: string | null
          shift: Database["public"]["Enums"]["app_shift"] | null
          status: Database["public"]["Enums"]["call_status"]
          table_number: number
        }
        Insert: {
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          attended_at?: string | null
          attended_by?: string | null
          called_at?: string
          cooldown_until?: string | null
          created_at?: string
          duration_seconds?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          service_date?: string | null
          shift?: Database["public"]["Enums"]["app_shift"] | null
          status?: Database["public"]["Enums"]["call_status"]
          table_number: number
        }
        Update: {
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          attended_at?: string | null
          attended_by?: string | null
          called_at?: string
          cooldown_until?: string | null
          created_at?: string
          duration_seconds?: number | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          service_date?: string | null
          shift?: Database["public"]["Enums"]["app_shift"] | null
          status?: Database["public"]["Enums"]["call_status"]
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "calls_assigned_waiter_id_fkey"
            columns: ["assigned_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
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
      display_screens: {
        Row: {
          created_at: string
          device_token_hash: string | null
          environment: Database["public"]["Enums"]["app_env"]
          id: string
          last_seen_at: string | null
          name: string
          paired_at: string | null
          pairing_code: string | null
          pairing_code_expires_at: string | null
          table_numbers: number[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token_hash?: string | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          last_seen_at?: string | null
          name: string
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          table_numbers?: number[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token_hash?: string | null
          environment?: Database["public"]["Enums"]["app_env"]
          id?: string
          last_seen_at?: string | null
          name?: string
          paired_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          table_numbers?: number[] | null
          updated_at?: string
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
      screen_pin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          screen_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          screen_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          screen_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_pin_sessions_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "display_screens"
            referencedColumns: ["id"]
          },
        ]
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
      waiter_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          service_date: string
          shift: Database["public"]["Enums"]["app_shift"]
          table_number: number
          updated_at: string
          waiter_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          service_date: string
          shift: Database["public"]["Enums"]["app_shift"]
          table_number: number
          updated_at?: string
          waiter_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          service_date?: string
          shift?: Database["public"]["Enums"]["app_shift"]
          table_number?: number
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_assignments_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      waiters: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_screen: {
        Args: {
          p_environment?: Database["public"]["Enums"]["app_env"]
          p_name: string
          p_tables?: number[]
        }
        Returns: Json
      }
      admin_pin_configured: { Args: never; Returns: boolean }
      admin_regenerate_pairing_code: {
        Args: { p_screen_id: string }
        Returns: Json
      }
      admin_set_pin: { Args: { p_pin: string }; Returns: Json }
      admin_set_table_assignment: {
        Args: {
          p_service_date: string
          p_shift: Database["public"]["Enums"]["app_shift"]
          p_table_number: number
          p_waiter_id: string
        }
        Returns: Json
      }
      claim_pairing_code: { Args: { p_code: string }; Returns: Json }
      current_service_slot: {
        Args: { p_at?: string }
        Returns: {
          service_date: string
          shift: Database["public"]["Enums"]["app_shift"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_token: { Args: { p_token: string }; Returns: string }
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
      screen_assignment_board: {
        Args: {
          p_pin_session: string
          p_screen_id: string
          p_service_date?: string
          p_shift?: Database["public"]["Enums"]["app_shift"]
        }
        Returns: Json
      }
      screen_session_valid: {
        Args: { p_pin_session: string; p_screen_id: string }
        Returns: boolean
      }
      screen_set_assignment: {
        Args: {
          p_pin_session: string
          p_screen_id: string
          p_service_date: string
          p_shift: Database["public"]["Enums"]["app_shift"]
          p_table_number: number
          p_waiter_id: string
        }
        Returns: Json
      }
      screen_state: {
        Args: { p_device_token: string; p_screen_id: string }
        Returns: Json
      }
      screen_verify_pin: {
        Args: { p_device_token: string; p_pin: string; p_screen_id: string }
        Returns: Json
      }
      set_table_assignment: {
        Args: {
          p_actor?: string
          p_service_date: string
          p_shift: Database["public"]["Enums"]["app_shift"]
          p_table_number: number
          p_waiter_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_env: "production" | "demo"
      app_role: "admin" | "staff"
      app_shift: "lunch" | "dinner"
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
      app_shift: ["lunch", "dinner"],
      call_status: ["pending", "attended"],
    },
  },
} as const
