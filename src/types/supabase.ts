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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bookmark: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          type: string
          user: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          type: string
          user: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          type?: string
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmark_user_fkey1"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: number
          name: string
          status: boolean
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: number
          name: string
          status?: boolean
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: number
          name?: string
          status?: boolean
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          client_id: string
          created_at: string
          event_booking_id: string | null
          evidence_client: Json | null
          evidence_provider: Json | null
          id: string
          provider_id: string
          reason: string
          resolution: string | null
          response_provider: string | null
          service_booking_id: string | null
          status: Database["public"]["Enums"]["dispute_status"] | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          client_id: string
          created_at?: string
          event_booking_id?: string | null
          evidence_client?: Json | null
          evidence_provider?: Json | null
          id?: string
          provider_id: string
          reason: string
          resolution?: string | null
          response_provider?: string | null
          service_booking_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          client_id?: string
          created_at?: string
          event_booking_id?: string | null
          evidence_client?: Json | null
          evidence_provider?: Json | null
          id?: string
          provider_id?: string
          reason?: string
          resolution?: string | null
          response_provider?: string | null
          service_booking_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_event_booking_id_fkey"
            columns: ["event_booking_id"]
            isOneToOne: false
            referencedRelation: "event_booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_service_booking_id_fkey"
            columns: ["service_booking_id"]
            isOneToOne: false
            referencedRelation: "services_booking"
            referencedColumns: ["id"]
          },
        ]
      }
      event_booking: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payment_id: string
          quantity: number
          status: Database["public"]["Enums"]["event_booking_status"]
          ticket_type_id: string
          total_price: number
          unit_price: number
          updated_at: string
          user: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payment_id: string
          quantity: number
          status?: Database["public"]["Enums"]["event_booking_status"]
          ticket_type_id: string
          total_price: number
          unit_price: number
          updated_at?: string
          user?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payment_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["event_booking_status"]
          ticket_type_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_booking_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_user_fkey1"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          event_id: string
          id: string
          rating: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          rating: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reviews_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_types: {
        Row: {
          capacity: number | null
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          book_till: string | null
          category: number
          created_at: string
          delete: boolean
          description: string | null
          end_at: string
          id: string
          images: string[] | null
          location: unknown
          provider: string
          start_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          book_till?: string | null
          category: number
          created_at?: string
          delete?: boolean
          description?: string | null
          end_at: string
          id?: string
          images?: string[] | null
          location?: unknown
          provider?: string
          start_at: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          book_till?: string | null
          category?: number
          created_at?: string
          delete?: boolean
          description?: string | null
          end_at?: string
          id?: string
          images?: string[] | null
          location?: unknown
          provider?: string
          start_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_provider_fkey1"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          status: string
          user: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          status?: string
          user?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          status?: string
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          country_code: string | null
          created_at: string | null
          id: string
          image: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["role"]
          status: Database["public"]["Enums"]["user_status"]
          tokens: string[] | null
          updated_at: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["role"]
          status?: Database["public"]["Enums"]["user_status"]
          tokens?: string[] | null
          updated_at?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["role"]
          status?: Database["public"]["Enums"]["user_status"]
          tokens?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider: {
        Row: {
          country: string
          created_at: string
          description: string | null
          document: string | null
          id: string
          id_photo: string[] | null
          id_type: string | null
          language: string | null
          location: unknown
          pricing: string | null
          service_type: string | null
          session_duration: string | null
          stripe: string | null
          type: Database["public"]["Enums"]["provider_type"] | null
        }
        Insert: {
          country: string
          created_at?: string
          description?: string | null
          document?: string | null
          id?: string
          id_photo?: string[] | null
          id_type?: string | null
          language?: string | null
          location?: unknown
          pricing?: string | null
          service_type?: string | null
          session_duration?: string | null
          stripe?: string | null
          type?: Database["public"]["Enums"]["provider_type"] | null
        }
        Update: {
          country?: string
          created_at?: string
          description?: string | null
          document?: string | null
          id?: string
          id_photo?: string[] | null
          id_type?: string | null
          language?: string | null
          location?: unknown
          pricing?: string | null
          service_type?: string | null
          session_duration?: string | null
          stripe?: string | null
          type?: Database["public"]["Enums"]["provider_type"] | null
        }
        Relationships: []
      }
      service_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          service_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          service_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          service_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          address: string | null
          capacity: number | null
          category: number
          created_at: string | null
          description: string | null
          end_at: string
          id: string
          images: string[] | null
          location: unknown
          price: number | null
          provider: string
          start_at: string
          title: string | null
          updated_at: string | null
          week_day: Database["public"]["Enums"]["week_day"][]
        }
        Insert: {
          active?: boolean
          address?: string | null
          capacity?: number | null
          category: number
          created_at?: string | null
          description?: string | null
          end_at: string
          id?: string
          images?: string[] | null
          location?: unknown
          price?: number | null
          provider?: string
          start_at: string
          title?: string | null
          updated_at?: string | null
          week_day: Database["public"]["Enums"]["week_day"][]
        }
        Update: {
          active?: boolean
          address?: string | null
          capacity?: number | null
          category?: number
          created_at?: string | null
          description?: string | null
          end_at?: string
          id?: string
          images?: string[] | null
          location?: unknown
          price?: number | null
          provider?: string
          start_at?: string
          title?: string | null
          updated_at?: string | null
          week_day?: Database["public"]["Enums"]["week_day"][]
        }
        Relationships: [
          {
            foreignKeyName: "services_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      services_booking: {
        Row: {
          appointed: string
          created_at: string | null
          id: string
          payment_id: string | null
          price: number
          service: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string | null
          user: string
        }
        Insert: {
          appointed: string
          created_at?: string | null
          id?: string
          payment_id?: string | null
          price: number
          service: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string | null
          user?: string
        }
        Update: {
          appointed?: string
          created_at?: string | null
          id?: string
          payment_id?: string | null
          price?: number
          service?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string | null
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_fkey"
            columns: ["service"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_booking_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhooks: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_event_rating_summary: {
        Args: { target_event_id: string }
        Returns: {
          avg_rating: number
          count: number
        }[]
      }
      get_event_reviews: {
        Args: { target_event_id: string }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          user_id: string
          user_image: string
          user_name: string
        }[]
      }
      get_liked_items: { Args: { p_type: string }; Returns: Json }
      get_service_by_id: { Args: { target_id: string }; Returns: Json }
      get_services_booking_report: {
        Args: never
        Returns: {
          description: string
          price: number
          pymtstatus: string
          status: string
          title: string
          usuario: string
          vendor: string
        }[]
      }
      get_vendor_service_counts: {
        Args: never
        Returns: {
          count: number
          vendor: string
        }[]
      }
      handle_checkout_session_completed: {
        Args: {
          p_amount_total: number
          p_customer_id: string
          p_metadata: Json
          p_payment_intent: string
          p_session_id: string
        }
        Returns: undefined
      }
      integrated_search: {
        Args: {
          category_filter?: number[]
          date_from?: string
          date_to?: string
          day_filter?: Database["public"]["Enums"]["week_day"][]
          p_type: string
          page_limit?: number
          page_offset?: number
          radius_meters?: number
          search_query?: string
          sort_by?: string
          target_lang?: string
          user_lat?: number
          user_lng?: number
        }
        Returns: {
          avg_rating: number
          book_till: string
          category_id: number
          category_name: string
          created_at: string
          description: string
          dist_meters: number
          end_at: string
          id: string
          images: string[]
          is_bookmarked: boolean
          lat: number
          lng: number
          max_price: number
          min_price: number
          price: number
          provider_id: string
          provider_image: string
          provider_name: string
          provider_role: string
          start_at: string
          title: string
          type: string
          week_day: Database["public"]["Enums"]["week_day"][]
        }[]
      }
      search_map_items: {
        Args: { radius_meters: number; user_lat: number; user_lng: number }
        Returns: {
          distance: number
          id: string
          images: string[]
          lat: number
          lng: number
          price: number
          provider_name: string
          rating: number
          title: string
          type: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      your_function_name: {
        Args: {
          category_filter: string[]
          day_filter: Database["public"]["Enums"]["week_day"][]
          page_limit: number
          page_offset: number
          radius_meters: number
          search_query: string
          sort_by: string
          user_lat: number
          user_lng: number
        }
        Returns: {
          avg_rating: number
          created_at: string
          description: string
          dist_meters: number
          id: string
          images: string[]
          is_bookmarked: boolean
          lat: number
          lng: number
          price: number
          provider: Json
          title: string
          total_count: number
          week_day: string[]
        }[]
      }
    }
    Enums: {
      booking_status: "booked" | "cancel" | "completed" | "disputed"
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_refund"
        | "resolved_payout"
        | "dismissed"
      event_booking_status: "booked" | "completed" | "cancelled" | "disputed"
      provider_type: "individual" | "company"
      role: "user" | "provider" | "admin"
      user_status:
        | "active"
        | "onboarding"
        | "pending"
        | "delete"
        | "reject"
        | "suspended"
      week_day: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
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
      booking_status: ["booked", "cancel", "completed", "disputed"],
      dispute_status: [
        "open",
        "under_review",
        "resolved_refund",
        "resolved_payout",
        "dismissed",
      ],
      event_booking_status: ["booked", "completed", "cancelled", "disputed"],
      provider_type: ["individual", "company"],
      role: ["user", "provider", "admin"],
      user_status: [
        "active",
        "onboarding",
        "pending",
        "delete",
        "reject",
        "suspended",
      ],
      week_day: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    },
  },
} as const
