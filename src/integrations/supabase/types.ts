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
      book_platform_content: {
        Row: {
          ai_generated_text: string | null
          auto_publish_enabled: boolean | null
          book_id: string
          created_at: string
          custom_text: string | null
          hashtags: string[] | null
          id: string
          media_urls: string[] | null
          mentions: string[] | null
          platform: string
          post_id: string | null
          published: boolean | null
          published_at: string | null
          scheduled_publish_at: string | null
          updated_at: string
        }
        Insert: {
          ai_generated_text?: string | null
          auto_publish_enabled?: boolean | null
          book_id: string
          created_at?: string
          custom_text?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          mentions?: string[] | null
          platform: string
          post_id?: string | null
          published?: boolean | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated_text?: string | null
          auto_publish_enabled?: boolean | null
          book_id?: string
          created_at?: string
          custom_text?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          mentions?: string[] | null
          platform?: string
          post_id?: string | null
          published?: boolean | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_platform_content_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          ai_generated_text: string | null
          auto_publish_enabled: boolean | null
          campaign_post_count: number | null
          code: string
          created_at: string
          description: string | null
          exclude_from_campaigns: boolean | null
          id: string
          image_url: string | null
          is_product: boolean | null
          last_campaign_date: string | null
          product_url: string | null
          promotional_price: number | null
          published: boolean
          sale_price: number | null
          scheduled_publish_at: string | null
          stock_status: string | null
          storage_path: string | null
          template_type: string | null
          title: string
          updated_at: string
          warehouse_quantity: number | null
        }
        Insert: {
          ai_generated_text?: string | null
          auto_publish_enabled?: boolean | null
          campaign_post_count?: number | null
          code: string
          created_at?: string
          description?: string | null
          exclude_from_campaigns?: boolean | null
          id?: string
          image_url?: string | null
          is_product?: boolean | null
          last_campaign_date?: string | null
          product_url?: string | null
          promotional_price?: number | null
          published?: boolean
          sale_price?: number | null
          scheduled_publish_at?: string | null
          stock_status?: string | null
          storage_path?: string | null
          template_type?: string | null
          title: string
          updated_at?: string
          warehouse_quantity?: number | null
        }
        Update: {
          ai_generated_text?: string | null
          auto_publish_enabled?: boolean | null
          campaign_post_count?: number | null
          code?: string
          created_at?: string
          description?: string | null
          exclude_from_campaigns?: boolean | null
          id?: string
          image_url?: string | null
          is_product?: boolean | null
          last_campaign_date?: string | null
          product_url?: string | null
          promotional_price?: number | null
          published?: boolean
          sale_price?: number | null
          scheduled_publish_at?: string | null
          stock_status?: string | null
          storage_path?: string | null
          template_type?: string | null
          title?: string
          updated_at?: string
          warehouse_quantity?: number | null
        }
        Relationships: []
      }
      campaign_content_history: {
        Row: {
          campaign_post_id: string
          category: string
          created_at: string
          full_text: string
          id: string
          platform: string
          topic_summary: string
        }
        Insert: {
          campaign_post_id: string
          category: string
          created_at?: string
          full_text: string
          id?: string
          platform: string
          topic_summary: string
        }
        Update: {
          campaign_post_id?: string
          category?: string
          created_at?: string
          full_text?: string
          id?: string
          platform?: string
          topic_summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_content_history_campaign_post_id_fkey"
            columns: ["campaign_post_id"]
            isOneToOne: false
            referencedRelation: "campaign_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_posts: {
        Row: {
          book_id: string | null
          campaign_id: string
          category: string
          created_at: string
          day: number
          error_code: string | null
          error_message: string | null
          id: string
          next_retry_at: string | null
          platforms: Json | null
          published_at: string | null
          retry_count: number | null
          scheduled_at: string
          status: string
          text: string
          time: string
          type: string
        }
        Insert: {
          book_id?: string | null
          campaign_id: string
          category: string
          created_at?: string
          day: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          platforms?: Json | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at: string
          status?: string
          text: string
          time: string
          type: string
        }
        Update: {
          book_id?: string | null
          campaign_id?: string
          category?: string
          created_at?: string
          day?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          platforms?: Json | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string
          status?: string
          text?: string
          time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          content_posts_count: number
          created_at: string
          description: string | null
          duration_days: number
          id: string
          name: string
          posting_times: Json
          posts_per_day: number
          sales_posts_count: number
          start_date: string
          status: string
          target_platforms: Json | null
          updated_at: string
        }
        Insert: {
          content_posts_count: number
          created_at?: string
          description?: string | null
          duration_days: number
          id?: string
          name: string
          posting_times: Json
          posts_per_day: number
          sales_posts_count: number
          start_date: string
          status?: string
          target_platforms?: Json | null
          updated_at?: string
        }
        Update: {
          content_posts_count?: number
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          name?: string
          posting_times?: Json
          posts_per_day?: number
          sales_posts_count?: number
          start_date?: string
          status?: string
          target_platforms?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      facebook_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          page_id: string | null
          page_name: string | null
          scope: string | null
          token_type: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      twitter_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      xml_books: {
        Row: {
          created_at: string
          id: string
          product_url: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_url: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          product_url?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
