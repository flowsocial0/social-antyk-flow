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
      admin_ideas: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      book_campaign_texts: {
        Row: {
          book_id: string
          created_at: string | null
          id: string
          platform: string
          post_type: string
          source_campaign_id: string | null
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string | null
          id?: string
          platform: string
          post_type: string
          source_campaign_id?: string | null
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string | null
          id?: string
          platform?: string
          post_type?: string
          source_campaign_id?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_campaign_texts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_campaign_texts_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
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
          user_id: string
          youtube_video_id: string | null
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
          user_id: string
          youtube_video_id?: string | null
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
          user_id?: string
          youtube_video_id?: string | null
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
          ai_text_facebook: string | null
          ai_text_linkedin: string | null
          ai_text_x: string | null
          ai_text_youtube: string | null
          author: string | null
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
          user_id: string
          video_storage_path: string | null
          video_url: string | null
          warehouse_quantity: number | null
        }
        Insert: {
          ai_generated_text?: string | null
          ai_text_facebook?: string | null
          ai_text_linkedin?: string | null
          ai_text_x?: string | null
          ai_text_youtube?: string | null
          author?: string | null
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
          user_id: string
          video_storage_path?: string | null
          video_url?: string | null
          warehouse_quantity?: number | null
        }
        Update: {
          ai_generated_text?: string | null
          ai_text_facebook?: string | null
          ai_text_linkedin?: string | null
          ai_text_x?: string | null
          ai_text_youtube?: string | null
          author?: string | null
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
          user_id?: string
          video_storage_path?: string | null
          video_url?: string | null
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
          user_id: string
        }
        Insert: {
          campaign_post_id: string
          category: string
          created_at?: string
          full_text: string
          id?: string
          platform: string
          topic_summary: string
          user_id: string
        }
        Update: {
          campaign_post_id?: string
          category?: string
          created_at?: string
          full_text?: string
          id?: string
          platform?: string
          topic_summary?: string
          user_id?: string
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
      campaign_generation_progress: {
        Row: {
          config: Json | null
          created_at: string | null
          error_message: string | null
          generated_posts: number | null
          id: string
          posts: Json | null
          status: string | null
          structure: Json | null
          total_posts: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          error_message?: string | null
          generated_posts?: number | null
          id?: string
          posts?: Json | null
          status?: string | null
          structure?: Json | null
          total_posts: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          error_message?: string | null
          generated_posts?: number | null
          id?: string
          posts?: Json | null
          status?: string | null
          structure?: Json | null
          total_posts?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      campaign_posts: {
        Row: {
          book_id: string | null
          campaign_id: string
          category: string
          created_at: string
          custom_image_url: string | null
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
          target_accounts: Json | null
          text: string
          time: string
          type: string
        }
        Insert: {
          book_id?: string | null
          campaign_id: string
          category: string
          created_at?: string
          custom_image_url?: string | null
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
          target_accounts?: Json | null
          text: string
          time: string
          type: string
        }
        Update: {
          book_id?: string | null
          campaign_id?: string
          category?: string
          created_at?: string
          custom_image_url?: string | null
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
          target_accounts?: Json | null
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
          selected_accounts: Json | null
          start_date: string
          status: string
          target_platforms: Json | null
          updated_at: string
          user_id: string
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
          selected_accounts?: Json | null
          start_date: string
          status?: string
          target_platforms?: Json | null
          updated_at?: string
          user_id: string
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
          selected_accounts?: Json | null
          start_date?: string
          status?: string
          target_platforms?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      facebook_oauth_tokens: {
        Row: {
          access_token: string
          account_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_default: boolean | null
          page_id: string | null
          page_name: string | null
          scope: string | null
          token_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          page_id?: string | null
          page_name?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          page_id?: string | null
          page_name?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      facebook_page_selections: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          pages_data: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          pages_data: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          pages_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      instagram_oauth_tokens: {
        Row: {
          access_token: string
          account_name: string | null
          created_at: string | null
          expires_at: string | null
          facebook_page_id: string | null
          id: string
          instagram_account_id: string
          instagram_username: string | null
          is_default: boolean | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          facebook_page_id?: string | null
          id?: string
          instagram_account_id: string
          instagram_username?: string | null
          is_default?: boolean | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          facebook_page_id?: string | null
          id?: string
          instagram_account_id?: string
          instagram_username?: string | null
          is_default?: boolean | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_oauth_tokens: {
        Row: {
          access_token: string
          account_name: string | null
          created_at: string | null
          display_name: string | null
          expires_at: string | null
          id: string
          is_default: boolean | null
          linkedin_id: string | null
          profile_picture_url: string | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          created_at?: string | null
          display_name?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          linkedin_id?: string | null
          profile_picture_url?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          created_at?: string | null
          display_name?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          linkedin_id?: string | null
          profile_picture_url?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_publications: {
        Row: {
          account_id: string
          book_id: string | null
          campaign_post_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          platform: string
          post_id: string | null
          published_at: string
          quota_cost: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          book_id?: string | null
          campaign_post_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          platform: string
          post_id?: string | null
          published_at?: string
          quota_cost?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          book_id?: string | null
          campaign_post_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          platform?: string
          post_id?: string | null
          published_at?: string
          quota_cost?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_publications_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_publications_campaign_post_id_fkey"
            columns: ["campaign_post_id"]
            isOneToOne: false
            referencedRelation: "campaign_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_rate_limits: {
        Row: {
          account_id: string
          api_headers: Json | null
          created_at: string
          id: string
          last_api_check: string | null
          limit_max: number
          limit_name: string | null
          limit_type: string
          notes: string | null
          platform: string
          remaining: number
          reset_at: string | null
          updated_at: string
          used: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          api_headers?: Json | null
          created_at?: string
          id?: string
          last_api_check?: string | null
          limit_max: number
          limit_name?: string | null
          limit_type: string
          notes?: string | null
          platform: string
          remaining: number
          reset_at?: string | null
          updated_at?: string
          used?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          api_headers?: Json | null
          created_at?: string
          id?: string
          last_api_check?: string | null
          limit_max?: number
          limit_name?: string | null
          limit_type?: string
          notes?: string | null
          platform?: string
          remaining?: number
          reset_at?: string | null
          updated_at?: string
          used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      tiktok_oauth_tokens: {
        Row: {
          access_token: string
          account_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_default: boolean | null
          open_id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          open_id: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          open_id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      twitter_oauth1_requests: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          oauth_token: string
          oauth_token_secret: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          oauth_token: string
          oauth_token_secret: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          oauth_token?: string
          oauth_token_secret?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      twitter_oauth1_tokens: {
        Row: {
          account_name: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          oauth_token: string
          oauth_token_secret: string
          screen_name: string | null
          updated_at: string | null
          user_id: string
          x_user_id: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          oauth_token: string
          oauth_token_secret: string
          screen_name?: string | null
          updated_at?: string | null
          user_id: string
          x_user_id?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          oauth_token?: string
          oauth_token_secret?: string
          screen_name?: string | null
          updated_at?: string | null
          user_id?: string
          x_user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_suffix_facebook: string | null
          ai_suffix_instagram: string | null
          ai_suffix_tiktok: string | null
          ai_suffix_x: string | null
          ai_suffix_youtube: string | null
          created_at: string | null
          default_website_url: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_suffix_facebook?: string | null
          ai_suffix_instagram?: string | null
          ai_suffix_tiktok?: string | null
          ai_suffix_x?: string | null
          ai_suffix_youtube?: string | null
          created_at?: string | null
          default_website_url?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_suffix_facebook?: string | null
          ai_suffix_instagram?: string | null
          ai_suffix_tiktok?: string | null
          ai_suffix_x?: string | null
          ai_suffix_youtube?: string | null
          created_at?: string | null
          default_website_url?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      x_daily_publications: {
        Row: {
          account_id: string
          book_id: string | null
          campaign_post_id: string | null
          id: string
          published_at: string
          source: string
          tweet_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          book_id?: string | null
          campaign_post_id?: string | null
          id?: string
          published_at?: string
          source?: string
          tweet_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          book_id?: string | null
          campaign_post_id?: string | null
          id?: string
          published_at?: string
          source?: string
          tweet_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "x_daily_publications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twitter_oauth1_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "x_daily_publications_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "x_daily_publications_campaign_post_id_fkey"
            columns: ["campaign_post_id"]
            isOneToOne: false
            referencedRelation: "campaign_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      x_rate_limits: {
        Row: {
          account_id: string
          endpoint: string
          id: string
          limit_max: number | null
          remaining: number | null
          reset_at: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          endpoint: string
          id?: string
          limit_max?: number | null
          remaining?: number | null
          reset_at?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          endpoint?: string
          id?: string
          limit_max?: number | null
          remaining?: number | null
          reset_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_rate_limits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twitter_oauth1_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_books: {
        Row: {
          created_at: string
          id: string
          product_url: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_url: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_url?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_oauth_tokens: {
        Row: {
          access_token: string
          account_name: string | null
          channel_id: string | null
          channel_title: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_default: boolean | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          channel_id?: string | null
          channel_title?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          channel_id?: string | null
          channel_title?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
