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
  public: {
    Tables: {
      day_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          details: string | null
          entry_date: string
          id: string
          kind: string
          memo_id: string | null
          name: string | null
          party_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          details?: string | null
          entry_date?: string
          id?: string
          kind: string
          memo_id?: string | null
          name?: string | null
          party_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          details?: string | null
          entry_date?: string
          id?: string
          kind?: string
          memo_id?: string | null
          name?: string | null
          party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_entries_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      hawlat_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          kind: string
          note: string | null
          party_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          kind: string
          note?: string | null
          party_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          kind?: string
          note?: string | null
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hawlat_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          id: string
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memo_items: {
        Row: {
          id: string
          memo_id: string
          name: string
          position: number
          price: number
          product_id: string | null
          quantity: number
          unit: string | null
        }
        Insert: {
          id?: string
          memo_id: string
          name?: string
          position?: number
          price?: number
          product_id?: string | null
          quantity?: number
          unit?: string | null
        }
        Update: {
          id?: string
          memo_id?: string
          name?: string
          position?: number
          price?: number
          product_id?: string | null
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memo_items_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      memos: {
        Row: {
          address: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          memo_date: string
          memo_no: number | null
          mobile: string | null
          note: string | null
          owner_name: string | null
          paid: number
          party_id: string | null
          party_serial: string | null
          previous_due: number
          shop_name: string | null
          status: string
          total: number
        }
        Insert: {
          address?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          memo_date?: string
          memo_no?: number | null
          mobile?: string | null
          note?: string | null
          owner_name?: string | null
          paid?: number
          party_id?: string | null
          party_serial?: string | null
          previous_due?: number
          shop_name?: string | null
          status?: string
          total?: number
        }
        Update: {
          address?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          memo_date?: string
          memo_no?: number | null
          mobile?: string | null
          note?: string | null
          owner_name?: string | null
          paid?: number
          party_id?: string | null
          party_serial?: string | null
          previous_due?: number
          shop_name?: string | null
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "memos_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          address: string | null
          created_at: string
          id: string
          kind: string
          location: string | null
          mobile: string | null
          owner_name: string | null
          serial: string
          shop_name: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          kind: string
          location?: string | null
          mobile?: string | null
          owner_name?: string | null
          serial: string
          shop_name: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          kind?: string
          location?: string | null
          mobile?: string | null
          owner_name?: string | null
          serial?: string
          shop_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          last_login_at: string | null
          mobile: string
          serial: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          last_login_at?: string | null
          mobile: string
          serial?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          mobile?: string
          serial?: string | null
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          about: string | null
          gallery: Json
          id: number
          owner_photo_path: string | null
          shop_photo_path: string | null
        }
        Insert: {
          about?: string | null
          gallery?: Json
          id?: number
          owner_photo_path?: string | null
          shop_photo_path?: string | null
        }
        Update: {
          about?: string | null
          gallery?: Json
          id?: number
          owner_photo_path?: string | null
          shop_photo_path?: string | null
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
      confirm_memo: { Args: { _memo_id: string }; Returns: number }
      day_summary: {
        Args: { _d: string }
        Returns: {
          cash: number
          closing: number
          credits: number
          deposits: number
          expenses: number
          hawlat_due: number
          opening: number
          sales: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "moderator" | "customer"
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
      app_role: ["owner", "moderator", "customer"],
    },
  },
} as const
