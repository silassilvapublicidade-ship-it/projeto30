export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "user" | "moderator" | "admin" | "super_admin";
export type UserStatus = "active" | "suspended" | "deleted";
export type ChallengeStatus = "draft" | "active" | "paused" | "ended" | "archived";
export type EnrollmentStatus =
  "active" | "paused" | "completed" | "abandoned" | "restarted";
export type HabitType =
  | "boolean"
  | "quantity"
  | "duration"
  | "text"
  | "single_choice"
  | "multiple_choice"
  | "reading";
export type DailyLogStatus = "in_progress" | "finalized" | "missed" | "reopened";
export type HabitLogStatus = "pending" | "completed" | "not_applicable" | "skipped";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          city: string | null;
          timezone: string;
          onboarding_completed: boolean;
          role: UserRole;
          status: UserStatus;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          timezone?: string;
          onboarding_completed?: boolean;
          role?: UserRole;
          status?: UserStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      challenges: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          duration_days: number;
          status: ChallengeStatus;
          theme_config: Json;
          rules_config: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          duration_days?: number;
          status?: ChallengeStatus;
          theme_config?: Json;
          rules_config?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
      };
      point_events: {
        Row: {
          id: string;
          user_id: string;
          enrollment_id: string;
          daily_log_id: string | null;
          source_type: string;
          source_id: string | null;
          points: number;
          idempotency_key: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          enrollment_id: string;
          daily_log_id?: string | null;
          source_type: string;
          source_id?: string | null;
          points: number;
          idempotency_key: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["point_events"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      challenge_status: ChallengeStatus;
      enrollment_status: EnrollmentStatus;
      habit_type: HabitType;
      daily_log_status: DailyLogStatus;
      habit_log_status: HabitLogStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
