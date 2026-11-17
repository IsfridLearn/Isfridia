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
      admin_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          comic_id: string
          created_at: string
          is_favorite: boolean
          user_id: string
        }
        Insert: {
          comic_id: string
          created_at?: string
          is_favorite?: boolean
          user_id: string
        }
        Update: {
          comic_id?: string
          created_at?: string
          is_favorite?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_images: {
        Row: {
          bytes: number
          chapter_id: string
          created_at: string
          height: number
          id: string
          position: number
          storage_key: string
          width: number
        }
        Insert: {
          bytes: number
          chapter_id: string
          created_at?: string
          height: number
          id?: string
          position: number
          storage_key: string
          width: number
        }
        Update: {
          bytes?: number
          chapter_id?: string
          created_at?: string
          height?: number
          id?: string
          position?: number
          storage_key?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_images_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_view_dedupe: {
        Row: {
          chapter_id: string
          day: string
          visitor_hash: string
        }
        Insert: {
          chapter_id: string
          day?: string
          visitor_hash: string
        }
        Update: {
          chapter_id?: string
          day?: string
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_view_dedupe_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          comic_id: string
          created_at: string
          deleted_at: string | null
          external_url: string | null
          group_name: string | null
          id: string
          mangadex_id: string | null
          number: number
          published_at: string | null
          status: Database["public"]["Enums"]["chapter_status"]
          title: string | null
          translated_language: string | null
          updated_at: string
        }
        Insert: {
          comic_id: string
          created_at?: string
          deleted_at?: string | null
          external_url?: string | null
          group_name?: string | null
          id?: string
          mangadex_id?: string | null
          number: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["chapter_status"]
          title?: string | null
          translated_language?: string | null
          updated_at?: string
        }
        Update: {
          comic_id?: string
          created_at?: string
          deleted_at?: string | null
          external_url?: string | null
          group_name?: string | null
          id?: string
          mangadex_id?: string | null
          number?: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["chapter_status"]
          title?: string | null
          translated_language?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_genres: {
        Row: {
          comic_id: string
          genre_id: number
        }
        Insert: {
          comic_id: string
          genre_id: number
        }
        Update: {
          comic_id?: string
          genre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "comic_genres_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_genres_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_views_daily: {
        Row: {
          comic_id: string
          day: string
          views: number
        }
        Insert: {
          comic_id: string
          day?: string
          views?: number
        }
        Update: {
          comic_id?: string
          day?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "comic_views_daily_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_views_daily_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      comics: {
        Row: {
          alt_titles: string[]
          artist: string | null
          author: string | null
          cover_key: string | null
          created_at: string
          deleted_at: string | null
          external_popularity: number
          external_synced_at: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          mangadex_id: string | null
          mangaupdates_id: number | null
          mangaupdates_url: string | null
          official_links: Json
          release_year: number | null
          search_text: string
          slug: string
          source: string
          status: Database["public"]["Enums"]["comic_status"]
          synopsis: string
          title: string
          type: Database["public"]["Enums"]["comic_type"]
          updated_at: string
        }
        Insert: {
          alt_titles?: string[]
          artist?: string | null
          author?: string | null
          cover_key?: string | null
          created_at?: string
          deleted_at?: string | null
          external_popularity?: number
          external_synced_at?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          mangadex_id?: string | null
          mangaupdates_id?: number | null
          mangaupdates_url?: string | null
          official_links?: Json
          release_year?: number | null
          search_text?: string
          slug: string
          source?: string
          status?: Database["public"]["Enums"]["comic_status"]
          synopsis?: string
          title: string
          type?: Database["public"]["Enums"]["comic_type"]
          updated_at?: string
        }
        Update: {
          alt_titles?: string[]
          artist?: string | null
          author?: string | null
          cover_key?: string | null
          created_at?: string
          deleted_at?: string | null
          external_popularity?: number
          external_synced_at?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          mangadex_id?: string | null
          mangaupdates_id?: number | null
          mangaupdates_url?: string | null
          official_links?: Json
          release_year?: number | null
          search_text?: string
          slug?: string
          source?: string
          status?: Database["public"]["Enums"]["comic_status"]
          synopsis?: string
          title?: string
          type?: Database["public"]["Enums"]["comic_type"]
          updated_at?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          slug?: string
        }
        Relationships: []
      }
      mangadex_stat_snapshots: {
        Row: {
          comic_id: string
          follows: number
          rating: number | null
          taken_on: string
        }
        Insert: {
          comic_id: string
          follows: number
          rating?: number | null
          taken_on: string
        }
        Update: {
          comic_id?: string
          follows?: number
          rating?: number | null
          taken_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "mangadex_stat_snapshots_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mangadex_stat_snapshots_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      mangaupdates_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          chapter_id: string
          comic_id: string
          last_image_index: number
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          comic_id: string
          last_image_index?: number
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          comic_id?: string
          last_image_index?: number
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comic_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      comic_cards: {
        Row: {
          alt_titles: string[] | null
          artist: string | null
          author: string | null
          chapter_count: number | null
          cover_key: string | null
          created_at: string | null
          external_popularity: number | null
          genre_names: string[] | null
          genre_slugs: string[] | null
          id: string | null
          is_featured: boolean | null
          latest_chapter_at: string | null
          latest_chapter_number: number | null
          mangadex_id: string | null
          mangaupdates_url: string | null
          official_links: Json | null
          release_year: number | null
          search_text: string | null
          slug: string | null
          source: string | null
          status: Database["public"]["Enums"]["comic_status"] | null
          synopsis: string | null
          title: string | null
          type: Database["public"]["Enums"]["comic_type"] | null
          updated_at: string | null
          views_30d: number | null
          views_7d: number | null
          views_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_chapter_images: {
        Args: { p_chapter_id: string; p_pages: Json }
        Returns: string[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      record_chapter_view: {
        Args: { p_chapter_id: string; p_visitor_hash: string }
        Returns: boolean
      }
      reorder_chapter_images: {
        Args: { p_chapter_id: string; p_image_ids: string[] }
        Returns: undefined
      }
      set_comic_genres: {
        Args: { p_comic_id: string; p_genre_ids: number[] }
        Returns: undefined
      }
      trending_this_week: {
        Args: { p_limit?: number }
        Returns: {
          comic_id: string
          follows: number
          gain: number
          has_previous: boolean
          mode: string
          previous_rank: number
          rank: number
          window_end: string
          window_start: string
        }[]
      }
    }
    Enums: {
      admin_role: "owner" | "admin"
      chapter_status: "draft" | "published"
      comic_status: "ongoing" | "completed" | "hiatus" | "cancelled"
      comic_type: "manhwa" | "manga" | "manhua" | "webcomic"
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
      admin_role: ["owner", "admin"],
      chapter_status: ["draft", "published"],
      comic_status: ["ongoing", "completed", "hiatus", "cancelled"],
      comic_type: ["manhwa", "manga", "manhua", "webcomic"],
    },
  },
} as const
