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
      achievements: {
        Row: {
          active: boolean
          category: string | null
          challenge_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          points_bonus: number
          rarity: string | null
          rule_config: Json
          share_message: string | null
          share_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          challenge_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          points_bonus?: number
          rarity?: string | null
          rule_config?: Json
          share_message?: string | null
          share_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          challenge_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          points_bonus?: number
          rarity?: string | null
          rule_config?: Json
          share_message?: string | null
          share_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          anonymous_id: string | null
          challenge_id: string | null
          created_at: string
          enrollment_id: string | null
          event_name: string
          id: string
          metadata: Json
          occurred_at: string
          session_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          challenge_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          event_name: string
          id?: string
          metadata?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          challenge_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          event_name?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_day_habits: {
        Row: {
          challenge_day_id: string
          challenge_id: string
          created_at: string
          habit_id: string
          id: string
          override_description: string | null
          override_points: number | null
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          challenge_day_id: string
          challenge_id: string
          created_at?: string
          habit_id: string
          id?: string
          override_description?: string | null
          override_points?: number | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          challenge_day_id?: string
          challenge_id?: string
          created_at?: string
          habit_id?: string
          id?: string
          override_description?: string | null
          override_points?: number | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_day_habits_challenge_day_id_challenge_id_fkey"
            columns: ["challenge_day_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_days"
            referencedColumns: ["id", "challenge_id"]
          },
          {
            foreignKeyName: "challenge_day_habits_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_day_habits_habit_id_challenge_id_fkey"
            columns: ["habit_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "challenge_id"]
          },
        ]
      }
      challenge_days: {
        Row: {
          challenge_id: string
          created_at: string
          day_number: number
          id: string
          message: string | null
          theme: string | null
          title: string | null
          unlock_rule: Json
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          day_number: number
          id?: string
          message?: string | null
          theme?: string | null
          title?: string | null
          unlock_rule?: Json
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          day_number?: number
          id?: string
          message?: string | null
          theme?: string | null
          title?: string | null
          unlock_rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_days_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_enrollments: {
        Row: {
          abandoned_at: string | null
          challenge_id: string
          completed_at: string | null
          completion_percent: number
          created_at: string
          current_day: number
          id: string
          joined_at: string
          paused_at: string | null
          paused_days_offset: number
          personal_start_date: string
          points_total: number
          restarted_from_enrollment_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          streak_best: number
          streak_current: number
          updated_at: string
          user_id: string
        }
        Insert: {
          abandoned_at?: string | null
          challenge_id: string
          completed_at?: string | null
          completion_percent?: number
          created_at?: string
          current_day?: number
          id?: string
          joined_at?: string
          paused_at?: string | null
          paused_days_offset?: number
          personal_start_date: string
          points_total?: number
          restarted_from_enrollment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          streak_best?: number
          streak_current?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          abandoned_at?: string | null
          challenge_id?: string
          completed_at?: string | null
          completion_percent?: number
          created_at?: string
          current_day?: number
          id?: string
          joined_at?: string
          paused_at?: string | null
          paused_days_offset?: number
          personal_start_date?: string
          points_total?: number
          restarted_from_enrollment_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          streak_best?: number
          streak_current?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_enrollments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_enrollments_restarted_from_enrollment_id_fkey"
            columns: ["restarted_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          duration_days: number
          end_date: string | null
          ended_at: string | null
          enrollment_end: string | null
          enrollment_start: string | null
          id: string
          is_test: boolean
          name: string
          paused_at: string | null
          rules_config: Json
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["challenge_status"]
          theme_config: Json
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_days: number
          end_date?: string | null
          ended_at?: string | null
          enrollment_end?: string | null
          enrollment_start?: string | null
          id?: string
          is_test?: boolean
          name: string
          paused_at?: string | null
          rules_config?: Json
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_days?: number
          end_date?: string | null
          ended_at?: string | null
          enrollment_end?: string | null
          enrollment_start?: string | null
          id?: string
          is_test?: boolean
          name?: string
          paused_at?: string | null
          rules_config?: Json
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          theme_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          alt_text: string | null
          category: string | null
          challenge_id: string | null
          content: string | null
          content_type: string
          created_at: string
          created_by: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_storage_path: string | null
          image_url: string | null
          published_at: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text?: string | null
          category?: string | null
          challenge_id?: string | null
          content?: string | null
          content_type: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          published_at?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string | null
          category?: string | null
          challenge_id?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          published_at?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_author_id_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          challenge_day_id: string
          challenge_id: string
          completion_percent: number
          created_at: string
          editable_until: string | null
          enrollment_id: string
          finalized_at: string | null
          id: string
          log_date: string
          points_earned: number
          rules_snapshot: Json
          status: Database["public"]["Enums"]["daily_log_status"]
          updated_at: string
        }
        Insert: {
          challenge_day_id: string
          challenge_id: string
          completion_percent?: number
          created_at?: string
          editable_until?: string | null
          enrollment_id: string
          finalized_at?: string | null
          id?: string
          log_date: string
          points_earned?: number
          rules_snapshot?: Json
          status?: Database["public"]["Enums"]["daily_log_status"]
          updated_at?: string
        }
        Update: {
          challenge_day_id?: string
          challenge_id?: string
          completion_percent?: number
          created_at?: string
          editable_until?: string | null
          enrollment_id?: string
          finalized_at?: string | null
          id?: string
          log_date?: string
          points_earned?: number
          rules_snapshot?: Json
          status?: Database["public"]["Enums"]["daily_log_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_challenge_day_id_challenge_id_fkey"
            columns: ["challenge_day_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_days"
            referencedColumns: ["id", "challenge_id"]
          },
          {
            foreignKeyName: "daily_logs_enrollment_id_challenge_id_fkey"
            columns: ["enrollment_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id", "challenge_id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          challenge_day_id: string
          completed_at: string | null
          created_at: string
          daily_log_id: string
          habit_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["habit_log_status"]
          updated_at: string
          value_json: Json
        }
        Insert: {
          challenge_day_id: string
          completed_at?: string | null
          created_at?: string
          daily_log_id: string
          habit_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["habit_log_status"]
          updated_at?: string
          value_json?: Json
        }
        Update: {
          challenge_day_id?: string
          completed_at?: string | null
          created_at?: string
          daily_log_id?: string
          habit_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["habit_log_status"]
          updated_at?: string
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_challenge_day_id_habit_id_fkey"
            columns: ["challenge_day_id", "habit_id"]
            isOneToOne: false
            referencedRelation: "challenge_day_habits"
            referencedColumns: ["challenge_day_id", "habit_id"]
          },
          {
            foreignKeyName: "habit_logs_daily_log_id_challenge_day_id_fkey"
            columns: ["daily_log_id", "challenge_day_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id", "challenge_day_id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          category: string | null
          challenge_id: string
          created_at: string
          description: string | null
          frequency_config: Json
          frequency_type: Database["public"]["Enums"]["habit_frequency_type"]
          habit_type: Database["public"]["Enums"]["habit_type"]
          icon: string | null
          id: string
          is_required: boolean
          points: number
          sort_order: number
          title: string
          updated_at: string
          validation_config: Json
        }
        Insert: {
          active?: boolean
          category?: string | null
          challenge_id: string
          created_at?: string
          description?: string | null
          frequency_config?: Json
          frequency_type?: Database["public"]["Enums"]["habit_frequency_type"]
          habit_type?: Database["public"]["Enums"]["habit_type"]
          icon?: string | null
          id?: string
          is_required?: boolean
          points?: number
          sort_order?: number
          title: string
          updated_at?: string
          validation_config?: Json
        }
        Update: {
          active?: boolean
          category?: string | null
          challenge_id?: string
          created_at?: string
          description?: string | null
          frequency_config?: Json
          frequency_type?: Database["public"]["Enums"]["habit_frequency_type"]
          habit_type?: Database["public"]["Enums"]["habit_type"]
          icon?: string | null
          id?: string
          is_required?: boolean
          points?: number
          sort_order?: number
          title?: string
          updated_at?: string
          validation_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "habits_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string | null
          created_at: string
          daily_log_id: string
          difficulty: string | null
          enrollment_id: string
          gratitude: string | null
          id: string
          mood: string | null
          tomorrow_focus: string | null
          updated_at: string
          user_id: string
          victory: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          daily_log_id: string
          difficulty?: string | null
          enrollment_id: string
          gratitude?: string | null
          id?: string
          mood?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          user_id: string
          victory?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          daily_log_id?: string
          difficulty?: string | null
          enrollment_id?: string
          gratitude?: string | null
          id?: string
          mood?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          user_id?: string
          victory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_daily_log_id_enrollment_id_fkey"
            columns: ["daily_log_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id", "enrollment_id"]
          },
          {
            foreignKeyName: "journal_entries_enrollment_id_user_id_fkey"
            columns: ["enrollment_id", "user_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          challenge_id: string
          created_at: string
          daily_log_id: string | null
          enrollment_id: string
          id: string
          idempotency_key: string
          metadata: Json
          points: number
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          daily_log_id?: string | null
          enrollment_id: string
          id?: string
          idempotency_key: string
          metadata?: Json
          points: number
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          daily_log_id?: string | null
          enrollment_id?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          points?: number
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_daily_log_id_enrollment_id_challenge_id_fkey"
            columns: ["daily_log_id", "enrollment_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id", "enrollment_id", "challenge_id"]
          },
          {
            foreignKeyName: "point_events_enrollment_id_user_id_challenge_id_fkey"
            columns: ["enrollment_id", "user_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id", "user_id", "challenge_id"]
          },
        ]
      }
      reading_plan_items: {
        Row: {
          created_at: string
          day_number: number
          external_url: string | null
          id: string
          question: string | null
          reading_plan_id: string
          reference: string
          reflection: string | null
          sort_order: number
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          external_url?: string | null
          id?: string
          question?: string | null
          reading_plan_id: string
          reference: string
          reflection?: string | null
          sort_order?: number
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          external_url?: string | null
          id?: string
          question?: string | null
          reading_plan_id?: string
          reference?: string
          reflection?: string | null
          sort_order?: number
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_plan_items_reading_plan_id_fkey"
            columns: ["reading_plan_id"]
            isOneToOne: false
            referencedRelation: "reading_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_plans: {
        Row: {
          active: boolean
          challenge_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          challenge_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          challenge_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_plans_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      share_cards: {
        Row: {
          achievement_id: string | null
          card_type: string
          challenge_id: string
          daily_log_id: string | null
          downloaded_at: string | null
          enrollment_id: string
          generated_at: string
          id: string
          image_url: string | null
          payload_hash: string | null
          share_config: Json
          shared_at: string | null
          storage_path: string | null
          template_id: string | null
          template_version: number
          user_achievement_id: string | null
          user_id: string
        }
        Insert: {
          achievement_id?: string | null
          card_type?: string
          challenge_id: string
          daily_log_id?: string | null
          downloaded_at?: string | null
          enrollment_id: string
          generated_at?: string
          id?: string
          image_url?: string | null
          payload_hash?: string | null
          share_config?: Json
          shared_at?: string | null
          storage_path?: string | null
          template_id?: string | null
          template_version?: number
          user_achievement_id?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string | null
          card_type?: string
          challenge_id?: string
          daily_log_id?: string | null
          downloaded_at?: string | null
          enrollment_id?: string
          generated_at?: string
          id?: string
          image_url?: string | null
          payload_hash?: string | null
          share_config?: Json
          shared_at?: string | null
          storage_path?: string | null
          template_id?: string | null
          template_version?: number
          user_achievement_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_cards_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_cards_daily_log_id_enrollment_id_challenge_id_fkey"
            columns: ["daily_log_id", "enrollment_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id", "enrollment_id", "challenge_id"]
          },
          {
            foreignKeyName: "share_cards_enrollment_id_user_id_challenge_id_fkey"
            columns: ["enrollment_id", "user_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id", "user_id", "challenge_id"]
          },
          {
            foreignKeyName: "share_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "share_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_cards_user_achievement_id_fkey"
            columns: ["user_achievement_id"]
            isOneToOne: false
            referencedRelation: "user_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      share_templates: {
        Row: {
          active: boolean
          challenge_id: string | null
          config: Json
          created_at: string
          id: string
          name: string
          preview_url: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          challenge_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          name: string
          preview_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          challenge_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          name?: string
          preview_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_templates_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          challenge_id: string
          enrollment_id: string
          id: string
          metadata: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          challenge_id: string
          enrollment_id: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          challenge_id?: string
          enrollment_id?: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_challenge_id_fkey"
            columns: ["achievement_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id", "challenge_id"]
          },
          {
            foreignKeyName: "user_achievements_enrollment_id_user_id_challenge_id_fkey"
            columns: ["enrollment_id", "user_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id", "user_id", "challenge_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          locale: string
          notifications: Json
          privacy: Json
          reduced_motion: boolean
          reminder_time: string | null
          share_defaults: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          locale?: string
          notifications?: Json
          privacy?: Json
          reduced_motion?: boolean
          reminder_time?: string | null
          share_defaults?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          locale?: string
          notifications?: Json
          privacy?: Json
          reduced_motion?: boolean
          reminder_time?: string | null
          share_defaults?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string
          id: string
          must_change_password: boolean
          name: string | null
          onboarding_completed: boolean
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email: string
          id: string
          must_change_password?: boolean
          name?: string | null
          onboarding_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          must_change_password?: boolean
          name?: string | null
          onboarding_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_challenge_enrollment: {
        Args: { target_enrollment_id: string }
        Returns: Json
      }
      admin_assert_not_sole_super_admin: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_assert_user_deletable: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_challenge_detail: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      admin_challenge_funnel: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      admin_dashboard_overview: { Args: never; Returns: Json }
      admin_delete_test_challenge_permanently: {
        Args: {
          confirmation_name: string
          confirmation_phrase: string
          target_challenge_id: string
        }
        Returns: Json
      }
      admin_end_challenge: {
        Args: { p_challenge_id: string; p_confirmation_name: string }
        Returns: undefined
      }
      admin_enroll_user_in_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: string
      }
      admin_generate_challenge_days: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      admin_list_challenges: {
        Args: {
          p_limit?: number | undefined
          p_offset?: number | undefined
          p_search?: string | undefined
          p_sort_by?: string | undefined
          p_sort_dir?: string | undefined
          p_status?: Database["public"]["Enums"]["challenge_status"] | undefined
        }
        Returns: {
          average_progress: number
          created_at: string
          duration_days: number
          end_date: string
          id: string
          is_test: boolean
          name: string
          participant_count: number
          slug: string
          start_date: string
          status: Database["public"]["Enums"]["challenge_status"]
          total_count: number
        }[]
      }
      admin_list_participants: {
        Args: {
          p_activity?: string | undefined
          p_challenge_id: string
          p_limit?: number | undefined
          p_max_progress?: number | undefined
          p_min_progress?: number | undefined
          p_offset?: number | undefined
          p_search?: string | undefined
          p_sort_by?: string | undefined
          p_sort_dir?: string | undefined
          p_status?: Database["public"]["Enums"]["enrollment_status"] | undefined
        }
        Returns: {
          activity: string
          completion_percent: number
          email: string
          enrollment_id: string
          finalized_days: number
          joined_at: string
          last_activity_at: string
          name: string
          points_total: number
          status: Database["public"]["Enums"]["enrollment_status"]
          streak_best: number
          streak_current: number
          total_count: number
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: {
          p_has_active_challenge?: boolean | undefined
          p_limit?: number | undefined
          p_must_change_password?: boolean | undefined
          p_offset?: number | undefined
          p_profile_complete?: boolean | undefined
          p_role?: Database["public"]["Enums"]["user_role"] | undefined
          p_search?: string | undefined
          p_sort_by?: string | undefined
          p_sort_dir?: string | undefined
          p_status?: Database["public"]["Enums"]["user_status"] | undefined
        }
        Returns: {
          active_challenge_count: number
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          id: string
          must_change_password: boolean
          name: string
          onboarding_completed: boolean
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          total_count: number
        }[]
      }
      admin_normalize_early_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
      admin_participant_detail: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
      admin_pause_challenge: {
        Args: { p_challenge_id: string }
        Returns: undefined
      }
      admin_pause_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      admin_require_admin: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      admin_require_super_admin: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      admin_resume_challenge: {
        Args: { p_challenge_id: string }
        Returns: undefined
      }
      admin_resume_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      admin_test_challenge_purge_preview: {
        Args: { target_challenge_id: string }
        Returns: Json
      }
      admin_update_user_profile: {
        Args: {
          p_city: string
          p_display_name: string
          p_name: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_update_user_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_update_user_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["user_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_user_detail: { Args: { p_user_id: string }; Returns: Json }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      ensure_today_daily_log: {
        Args: { target_enrollment_id?: string }
        Returns: string
      }
      finalize_daily_log: {
        Args: { target_daily_log_id: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      join_available_challenge: { Args: never; Returns: string }
      join_specific_challenge: {
        Args: { target_challenge_id: string }
        Returns: string
      }
      journey_calculate_day: {
        Args: {
          p_paused_days_offset?: number
          target_local_date: string
          target_start_date: string
        }
        Returns: number
      }
      journey_get_local_date: {
        Args: { target_timezone: string }
        Returns: string
      }
      journey_has_journal_content: {
        Args: {
          target_journal: Database["public"]["Tables"]["journal_entries"]["Row"]
        }
        Returns: boolean
      }
      journey_recalculate_daily_log: {
        Args: { target_daily_log_id: string }
        Returns: Json
      }
      journey_rule_int: {
        Args: { fallback_value: number; target_key: string; target_rules: Json }
        Returns: number
      }
      owns_daily_log: {
        Args: { target_daily_log_id: string }
        Returns: boolean
      }
      owns_enrollment: {
        Args: { target_enrollment_id: string }
        Returns: boolean
      }
      record_analytics_event: {
        Args: {
          p_challenge_id?: string
          p_enrollment_id?: string
          p_event_name: string
          p_metadata?: Json
          p_session_id?: string
          p_source?: string
        }
        Returns: string
      }
      save_journal_entry: {
        Args: {
          target_content?: string
          target_daily_log_id: string
          target_difficulty?: string
          target_gratitude?: string
          target_mood?: string
          target_tomorrow_focus?: string
          target_victory?: string
        }
        Returns: string
      }
      update_habit_log: {
        Args: {
          target_daily_log_id: string
          target_habit_id: string
          target_note?: string
          target_status: Database["public"]["Enums"]["habit_log_status"]
          target_value_json?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      challenge_status: "draft" | "active" | "paused" | "ended" | "archived"
      content_status: "draft" | "published" | "archived"
      daily_log_status: "in_progress" | "finalized" | "missed" | "reopened"
      enrollment_status:
        | "active"
        | "paused"
        | "completed"
        | "abandoned"
        | "restarted"
      habit_frequency_type: "daily" | "weekly" | "monthly"
      habit_log_status: "pending" | "completed" | "not_applicable" | "skipped"
      habit_type:
        | "boolean"
        | "quantity"
        | "duration"
        | "text"
        | "single_choice"
        | "multiple_choice"
        | "reading"
      notification_status:
        | "scheduled"
        | "sent"
        | "read"
        | "failed"
        | "cancelled"
      user_role: "user" | "moderator" | "admin" | "super_admin"
      user_status: "active" | "suspended" | "deleted" | "inactive"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      challenge_status: ["draft", "active", "paused", "ended", "archived"],
      content_status: ["draft", "published", "archived"],
      daily_log_status: ["in_progress", "finalized", "missed", "reopened"],
      enrollment_status: [
        "active",
        "paused",
        "completed",
        "abandoned",
        "restarted",
      ],
      habit_frequency_type: ["daily", "weekly", "monthly"],
      habit_log_status: ["pending", "completed", "not_applicable", "skipped"],
      habit_type: [
        "boolean",
        "quantity",
        "duration",
        "text",
        "single_choice",
        "multiple_choice",
        "reading",
      ],
      notification_status: ["scheduled", "sent", "read", "failed", "cancelled"],
      user_role: ["user", "moderator", "admin", "super_admin"],
      user_status: ["active", "suspended", "deleted", "inactive"],
    },
  },
} as const
