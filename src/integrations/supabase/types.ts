export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          content_type: string | null
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          log: string | null
          org_id: string
          size_bytes: number | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          log?: string | null
          org_id: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          log?: string | null
          org_id?: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_entitlements: {
        Row: {
          building_id: string | null
          created_at: string
          effective_end: string | null
          effective_start: string | null
          entitlement: Database["public"]["Enums"]["entitlement_type"]
          id: string
          org_id: string | null
          revenue_class: Database["public"]["Enums"]["revenue_class"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          entitlement: Database["public"]["Enums"]["entitlement_type"]
          id?: string
          org_id?: string | null
          revenue_class: Database["public"]["Enums"]["revenue_class"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          entitlement?: Database["public"]["Enums"]["entitlement_type"]
          id?: string
          org_id?: string | null
          revenue_class?: Database["public"]["Enums"]["revenue_class"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_entitlements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_entitlements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          scope_org_id: string | null
          spec_json: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope_org_id?: string | null
          spec_json: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope_org_id?: string | null
          spec_json?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_scope_org_id_fkey"
            columns: ["scope_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_results: {
        Row: {
          building_id: string | null
          computed_at: string
          created_at: string
          created_by: string | null
          extra_json: Json | null
          id: string
          kpi_name: string
          kpi_version: number | null
          org_id: string
          period_month: string
          room_id: string | null
          unit_id: string | null
          value: number
        }
        Insert: {
          building_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          extra_json?: Json | null
          id?: string
          kpi_name: string
          kpi_version?: number | null
          org_id: string
          period_month: string
          room_id?: string | null
          unit_id?: string | null
          value: number
        }
        Update: {
          building_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          extra_json?: Json | null
          id?: string
          kpi_name?: string
          kpi_version?: number | null
          org_id?: string
          period_month?: string
          room_id?: string | null
          unit_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_results_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_results_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_results_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mapping_json: Json
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mapping_json: Json
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mapping_json?: Json
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapping_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opex_parameters: {
        Row: {
          building_id: string | null
          cleaning_per_room: number
          cleaning_per_unit: number
          created_at: string
          effective_end: string | null
          effective_start: string | null
          electricity_per_room: number
          gas_per_room: number
          id: string
          is_active: boolean
          org_id: string | null
          smartlocks_per_unit: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          building_id?: string | null
          cleaning_per_room?: number
          cleaning_per_unit?: number
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          electricity_per_room?: number
          gas_per_room?: number
          id?: string
          is_active?: boolean
          org_id?: string | null
          smartlocks_per_unit?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string | null
          cleaning_per_room?: number
          cleaning_per_unit?: number
          created_at?: string
          effective_end?: string | null
          effective_start?: string | null
          electricity_per_room?: number
          gas_per_room?: number
          id?: string
          is_active?: boolean
          org_id?: string | null
          smartlocks_per_unit?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opex_parameters_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opex_parameters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opex_parameters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_counts: {
        Row: {
          building_id: string
          created_at: string
          id: string
          org_id: string
          room_count: number
          unit_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          org_id: string
          room_count: number
          unit_id: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          org_id?: string
          room_count?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_counts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_counts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_counts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      statements: {
        Row: {
          building_id: string | null
          created_at: string
          generated_by: string | null
          id: string
          org_id: string
          pdf_path: string | null
          period_month: string
          xlsx_path: string | null
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          org_id: string
          pdf_path?: string | null
          period_month: string
          xlsx_path?: string | null
        }
        Update: {
          building_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          org_id?: string
          pdf_path?: string | null
          period_month?: string
          xlsx_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_code: string | null
          account_name: string | null
          amount: number
          building_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          extra_json: Json | null
          id: string
          memo: string | null
          org_id: string
          period_end: string | null
          period_month: string
          period_start: string | null
          revenue_class: Database["public"]["Enums"]["revenue_class"] | null
          room_id: string | null
          source_file_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          account_name?: string | null
          amount: number
          building_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          extra_json?: Json | null
          id?: string
          memo?: string | null
          org_id: string
          period_end?: string | null
          period_month: string
          period_start?: string | null
          revenue_class?: Database["public"]["Enums"]["revenue_class"] | null
          room_id?: string | null
          source_file_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          account_name?: string | null
          amount?: number
          building_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          extra_json?: Json | null
          id?: string
          memo?: string | null
          org_id?: string
          period_end?: string | null
          period_month?: string
          period_start?: string | null
          revenue_class?: Database["public"]["Enums"]["revenue_class"] | null
          room_id?: string | null
          source_file_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          agreement_type: string | null
          building_id: string
          created_at: string
          external_id: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          agreement_type?: string | null
          building_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          agreement_type?: string | null
          building_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      user_scopes: {
        Row: {
          building_id: string | null
          id: string
          org_id: string
          unit_id: string | null
          user_id: string
        }
        Insert: {
          building_id?: string | null
          id?: string
          org_id: string
          unit_id?: string | null
          user_id: string
        }
        Update: {
          building_id?: string | null
          id?: string
          org_id?: string
          unit_id?: string | null
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
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_scoped: {
        Args: {
          _user_id: string
          _org: string
          _building: string
          _unit: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "finance" | "partner" | "readonly"
      entitlement_type: "landlord" | "roomrs"
      revenue_class:
        | "rent_income"
        | "utility_fee_income"
        | "bedroom_cleaning"
        | "convenience_fee"
        | "flex_fee_income"
        | "late_fee_income"
        | "lease_break_fee_income"
        | "membership_fee_income"
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
      app_role: ["admin", "finance", "partner", "readonly"],
      entitlement_type: ["landlord", "roomrs"],
      revenue_class: [
        "rent_income",
        "utility_fee_income",
        "bedroom_cleaning",
        "convenience_fee",
        "flex_fee_income",
        "late_fee_income",
        "lease_break_fee_income",
        "membership_fee_income",
      ],
    },
  },
} as const
