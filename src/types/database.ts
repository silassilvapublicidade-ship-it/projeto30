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
          content_item_id: string | null
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
          content_item_id?: string | null
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
          content_item_id?: string | null
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
            foreignKeyName: "analytics_events_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
      challenge_habit_notifications: {
        Row: {
          created_at: string
          enabled: boolean
          frequency_type: string
          habit_id: string
          id: string
          monthly_day: number | null
          notification_body: string
          notification_time: string
          notification_title: string
          only_if_not_completed: boolean
          priority: number
          updated_at: string
          weekdays: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency_type?: string
          habit_id: string
          id?: string
          monthly_day?: number | null
          notification_body?: string
          notification_time?: string
          notification_title?: string
          only_if_not_completed?: boolean
          priority?: number
          updated_at?: string
          weekdays?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency_type?: string
          habit_id?: string
          id?: string
          monthly_day?: number | null
          notification_body?: string
          notification_time?: string
          notification_title?: string
          only_if_not_completed?: boolean
          priority?: number
          updated_at?: string
          weekdays?: Json
        }
        Relationships: [
          {
            foreignKeyName: "challenge_habit_notifications_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: true
            referencedRelation: "habits"
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
          streak_at_finalize: number | null
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
          streak_at_finalize?: number | null
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
          streak_at_finalize?: number | null
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
      daily_motivation_messages: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          ends_at: string | null
          id: string
          priority: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          priority?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          priority?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          daily_prompt: string | null
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
          visibility_config: Json
        }
        Insert: {
          active?: boolean
          category?: string | null
          challenge_id: string
          created_at?: string
          daily_prompt?: string | null
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
          visibility_config?: Json
        }
        Update: {
          active?: boolean
          category?: string | null
          challenge_id?: string
          created_at?: string
          daily_prompt?: string | null
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
          visibility_config?: Json
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
      notification_campaigns: {
        Row: {
          action_label: string | null
          audience_estimated_count: number | null
          audience_type: string
          automation_type: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          challenge_id: string | null
          channel_internal: boolean
          channel_push: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          destination_reference_id: string | null
          destination_type: string
          habit_keyword: string | null
          id: string
          idempotency_key: string
          image_url: string | null
          message: string
          metadata: Json
          min_streak_threshold: number | null
          scheduled_for: string | null
          source: string
          specific_user_id: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_label?: string | null
          audience_estimated_count?: number | null
          audience_type: string
          automation_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          challenge_id?: string | null
          channel_internal?: boolean
          channel_push?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_reference_id?: string | null
          destination_type: string
          habit_keyword?: string | null
          id?: string
          idempotency_key?: string
          image_url?: string | null
          message: string
          metadata?: Json
          min_streak_threshold?: number | null
          scheduled_for?: string | null
          source?: string
          specific_user_id?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_label?: string | null
          audience_estimated_count?: number | null
          audience_type?: string
          automation_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          challenge_id?: string | null
          channel_internal?: boolean
          channel_push?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_reference_id?: string | null
          destination_type?: string
          habit_keyword?: string | null
          id?: string
          idempotency_key?: string
          image_url?: string | null
          message?: string
          metadata?: Json
          min_streak_threshold?: number | null
          scheduled_for?: string | null
          source?: string
          specific_user_id?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_specific_user_id_fkey"
            columns: ["specific_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          internal_notification_id: string | null
          next_retry_at: string | null
          opened_at: string | null
          read_at: string | null
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          internal_notification_id?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          read_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          internal_notification_id?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          read_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_internal_notification_id_fkey"
            columns: ["internal_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          body: string
          campaign_id: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          data: Json
          delivery_id: string | null
          destination_reference_id: string | null
          destination_type: string | null
          id: string
          image_url: string | null
          opened_at: string | null
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
          action_label?: string | null
          body: string
          campaign_id?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          data?: Json
          delivery_id?: string | null
          destination_reference_id?: string | null
          destination_type?: string | null
          id?: string
          image_url?: string | null
          opened_at?: string | null
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
          action_label?: string | null
          body?: string
          campaign_id?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          data?: Json
          delivery_id?: string | null
          destination_reference_id?: string | null
          destination_type?: string | null
          id?: string
          image_url?: string | null
          opened_at?: string | null
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
            foreignKeyName: "notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "notification_deliveries"
            referencedColumns: ["id"]
          },
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_name: string | null
          endpoint: string
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          platform: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_name?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_name?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
          snapshot_enrollment_id: string | null
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
          snapshot_enrollment_id?: string | null
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
          snapshot_enrollment_id?: string | null
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
            foreignKeyName: "share_cards_snapshot_enrollment_id_fkey"
            columns: ["snapshot_enrollment_id"]
            isOneToOne: false
            referencedRelation: "challenge_enrollments"
            referencedColumns: ["id"]
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
      system_error_events: {
        Row: {
          app_version: string | null
          area: string
          created_at: string
          error_code: string
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          message_safe: string
          metadata_safe: Json
          occurrence_count: number
          operation: string
          postgres_code: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_in_version: string | null
          route: string | null
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          area: string
          created_at?: string
          error_code: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message_safe: string
          metadata_safe?: Json
          occurrence_count?: number
          operation: string
          postgres_code?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_in_version?: string | null
          route?: string | null
          severity: string
          status?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          area?: string
          created_at?: string
          error_code?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message_safe?: string
          metadata_safe?: Json
          occurrence_count?: number
          operation?: string
          postgres_code?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_in_version?: string | null
          route?: string | null
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_error_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_error_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      admin_achievement_delete_preview: {
        Args: { p_achievement_id: string }
        Returns: Json
      }
      admin_achievements_analytics: { Args: never; Returns: Json }
      admin_assert_not_sole_super_admin: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_assert_user_deletable: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_cancel_notification_campaign: {
        Args: { p_campaign_id: string }
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
      admin_challenge_retention: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      admin_create_notification_campaign: {
        Args: {
          p_action_label?: string | undefined
          p_audience_type: string
          p_challenge_id?: string | undefined
          p_channel_internal?: boolean
          p_channel_push?: boolean
          p_destination_reference_id?: string | undefined
          p_destination_type: string
          p_habit_keyword?: string | undefined
          p_image_url?: string | undefined
          p_message: string
          p_min_streak_threshold?: number | undefined
          p_specific_user_id?: string | undefined
          p_title: string
        }
        Returns: string
      }
      admin_dashboard_overview: { Args: never; Returns: Json }
      admin_delete_achievement: {
        Args: { p_achievement_id: string }
        Returns: undefined
      }
      admin_delete_notification_campaign_draft: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_delete_test_challenge_permanently: {
        Args: {
          confirmation_name: string
          confirmation_phrase: string
          target_challenge_id: string
        }
        Returns: Json
      }
      admin_duplicate_notification_campaign: {
        Args: { p_campaign_id: string }
        Returns: string
      }
      admin_end_challenge: {
        Args: { p_challenge_id: string; p_confirmation_name: string }
        Returns: undefined
      }
      admin_enroll_user_in_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: string
      }
      admin_estimate_notification_audience: {
        Args: {
          p_audience_type: string
          p_challenge_id?: string | undefined
          p_habit_keyword?: string | undefined
          p_min_streak?: number | undefined
          p_specific_user_id?: string | undefined
        }
        Returns: number
      }
      admin_generate_challenge_days: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      admin_get_notification_campaign: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      admin_get_system_error_event: {
        Args: { p_id: string }
        Returns: {
          app_version: string
          area: string
          error_code: string
          first_seen_at: string
          id: string
          last_seen_at: string
          message_safe: string
          metadata_safe: Json
          occurrence_count: number
          operation: string
          postgres_code: string
          resolution_note: string
          resolved_at: string
          resolved_by: string
          resolved_in_version: string
          route: string
          severity: string
          status: string
          user_id: string
        }[]
      }
      admin_get_system_health_overview: { Args: never; Returns: Json }
      admin_list_challenges: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string | undefined
          p_sort_by?: string
          p_sort_dir?: string
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
      admin_list_notification_campaigns: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string | undefined
          p_sort_by?: string | undefined
          p_sort_dir?: string | undefined
          p_status?: string | undefined
        }
        Returns: {
          audience_estimated_count: number
          audience_type: string
          channel_internal: boolean
          channel_push: boolean
          clicked_count: number
          completed_at: string
          created_at: string
          created_by_name: string
          delivered_count: number
          failed_count: number
          id: string
          opened_count: number
          scheduled_for: string
          sent_count: number
          source: string
          status: string
          title: string
          total_count: number
          total_recipients: number
        }[]
      }
      admin_list_system_error_events: {
        Args: {
          p_area?: string
          p_error_code?: string
          p_limit?: number
          p_offset?: number
          p_operation?: string
          p_period_start?: string
          p_severity?: string
          p_status?: string
        }
        Returns: {
          app_version: string
          area: string
          error_code: string
          first_seen_at: string
          id: string
          last_seen_at: string
          message_safe: string
          metadata_safe: Json
          occurrence_count: number
          operation: string
          postgres_code: string
          resolution_note: string
          resolved_at: string
          route: string
          severity: string
          status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_list_participants: {
        Args: {
          p_activity?: string | undefined
          p_challenge_id: string
          p_limit?: number
          p_max_progress?: number | undefined
          p_min_progress?: number | undefined
          p_offset?: number
          p_search?: string | undefined
          p_sort_by?: string
          p_sort_dir?: string
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
          p_limit?: number
          p_must_change_password?: boolean | undefined
          p_offset?: number
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
      admin_notification_campaign_period_summary: {
        Args: { p_days?: number }
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
      admin_purge_old_system_error_events: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      admin_recompute_finalized_daily_log: {
        Args: { target_daily_log_id: string }
        Returns: Json
      }
      admin_require_admin: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      admin_require_super_admin: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      admin_resolve_system_error_event: {
        Args: {
          p_id: string
          p_resolution_note?: string
          p_resolved_in_version?: string
          p_status: string
        }
        Returns: undefined
      }
      admin_resume_challenge: {
        Args: { p_challenge_id: string }
        Returns: undefined
      }
      admin_resume_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      admin_retention_for_day: {
        Args: { p_challenge_id: string; p_day: number }
        Returns: Json
      }
      admin_schedule_notification_campaign: {
        Args: { p_campaign_id: string; p_scheduled_for: string }
        Returns: undefined
      }
      admin_start_notification_campaign_now: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_test_challenge_purge_preview: {
        Args: { target_challenge_id: string }
        Returns: Json
      }
      admin_tips_analytics: { Args: never; Returns: Json }
      admin_update_notification_campaign: {
        Args: {
          p_action_label?: string | undefined
          p_audience_type: string
          p_campaign_id: string
          p_challenge_id?: string | undefined
          p_channel_internal?: boolean
          p_channel_push?: boolean
          p_destination_reference_id?: string | undefined
          p_destination_type: string
          p_habit_keyword?: string | undefined
          p_image_url?: string | undefined
          p_message: string
          p_min_streak_threshold?: number | undefined
          p_specific_user_id?: string | undefined
          p_title: string
        }
        Returns: undefined
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
      admin_users_analytics: { Args: never; Returns: Json }
      automation_resolve_challenge_date_audience: {
        Args: { p_days_offset: number; p_use_start_date: boolean }
        Returns: {
          challenge_id: string
          challenge_name: string
          push_eligible: boolean
          user_id: string
        }[]
      }
      automation_resolve_daily_reminder_audience: {
        Args: never
        Returns: {
          local_date: string
          push_eligible: boolean
          user_id: string
        }[]
      }
      automation_resolve_inactive_users_audience: {
        Args: { p_inactive_days?: number }
        Returns: {
          push_eligible: boolean
          user_id: string
        }[]
      }
      automation_resolve_new_tip_subscribers_audience: {
        Args: never
        Returns: {
          push_eligible: boolean
          user_id: string
        }[]
      }
      automation_resolve_smart_notification_candidates: {
        Args: {
          p_daily_motivation_body?: string | undefined
          p_daily_motivation_category?: string | undefined
          p_daily_motivation_message_id?: string | undefined
          p_daily_motivation_title?: string | undefined
        }
        Returns: {
          candidate_key: string
          destination_reference_id: string
          destination_type: string
          habit_id: string
          notification_body: string
          notification_title: string
          push_eligible: boolean
          user_id: string
        }[]
      }
      automation_resolve_specific_users_audience: {
        Args: { p_user_ids: string[] }
        Returns: {
          push_eligible: boolean
          user_id: string
        }[]
      }
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
      finalize_daily_log_with_responses: {
        Args: { responses?: Json; target_daily_log_id: string }
        Returns: Json
      }
      habit_visible_on_day: {
        Args: {
          p_day_number: number
          p_duration_days: number
          p_visibility_config: Json
        }
        Returns: boolean
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
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_delivery_clicked: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      mark_notification_clicked: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_opened: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      member_pick_daily_mission_message: { Args: never; Returns: Json }
      member_pick_faith_message: { Args: never; Returns: Json }
      member_profile_overview: { Args: never; Returns: Json }
      member_profile_timeline: {
        Args: {
          p_challenge_id?: string | undefined
          p_cursor_at?: string | undefined
          p_cursor_id?: string | undefined
          p_limit?: number
          p_types?: string[] | undefined
        }
        Returns: Json
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
          p_content_item_id?: string
          p_enrollment_id?: string
          p_event_name: string
          p_metadata?: Json
          p_session_id?: string
          p_source?: string
        }
        Returns: string
      }
      record_system_error: {
        Args: {
          p_app_version?: string
          p_area: string
          p_message_safe: string
          p_metadata_safe?: Json
          p_operation: string
          p_postgres_code?: string
          p_route?: string
          p_severity: string
          p_user_id?: string
        }
        Returns: {
          error_code: string
          occurrence_count: number
        }[]
      }
      resolve_notification_audience: {
        Args: {
          p_audience_type: string
          p_challenge_id?: string
          p_habit_keyword?: string
          p_min_streak?: number
          p_specific_user_id?: string
        }
        Returns: {
          push_eligible: boolean
          user_id: string
        }[]
      }
      resolve_notification_audience_combined: {
        Args: {
          p_audience_type: string
          p_challenge_id?: string | undefined
          p_combined_min_streak?: number | undefined
          p_habit_keyword?: string | undefined
          p_min_streak?: number | undefined
          p_specific_user_id?: string | undefined
        }
        Returns: {
          push_eligible: boolean
          user_id: string
        }[]
      }
      revoke_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
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
      upsert_push_subscription: {
        Args: {
          p_auth: string
          p_device_name?: string
          p_endpoint: string
          p_p256dh: string
          p_platform?: string
          p_user_agent?: string
        }
        Returns: string
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
