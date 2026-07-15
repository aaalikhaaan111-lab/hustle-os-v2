import type { ResearchReport } from "@/types/venture";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          interests: string[] | null;
          daily_minutes: number | null;
          onboarding_completed_at: string | null;
          xp: number;
          streak_days: number;
          last_activity_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          interests?: string[] | null;
          daily_minutes?: number | null;
          onboarding_completed_at?: string | null;
          xp?: number;
          streak_days?: number;
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          interests?: string[] | null;
          daily_minutes?: number | null;
          onboarding_completed_at?: string | null;
          xp?: number;
          streak_days?: number;
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ventures: {
        Row: {
          id: string;
          owner_id: string;
          mission: string;
          budget: string | null;
          deadline: string | null;
          location: string | null;
          resources: string | null;
          status: string;
          research_report: ResearchReport | null;
          research_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          mission: string;
          budget?: string | null;
          deadline?: string | null;
          location?: string | null;
          resources?: string | null;
          status?: string;
          research_report?: ResearchReport | null;
          research_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          mission?: string;
          budget?: string | null;
          deadline?: string | null;
          location?: string | null;
          resources?: string | null;
          status?: string;
          research_report?: ResearchReport | null;
          research_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_sessions: {
        Row: {
          id: string;
          code: string;
          workshop_slug: string;
          host_id: string;
          status: "lobby" | "question" | "reveal" | "finished";
          current_question_index: number;
          question_started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          workshop_slug: string;
          host_id: string;
          status?: "lobby" | "question" | "reveal" | "finished";
          current_question_index?: number;
          question_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          workshop_slug?: string;
          host_id?: string;
          status?: "lobby" | "question" | "reveal" | "finished";
          current_question_index?: number;
          question_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_participants: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          display_name: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          display_name: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          display_name?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      workshop_answers: {
        Row: {
          id: string;
          session_id: string;
          participant_id: string;
          question_index: number;
          selected_option: number;
          is_correct: boolean;
          response_ms: number;
          points_awarded: number;
          answered_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          participant_id: string;
          question_index: number;
          selected_option: number;
          is_correct: boolean;
          response_ms: number;
          points_awarded?: number;
          answered_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          participant_id?: string;
          question_index?: number;
          selected_option?: number;
          is_correct?: boolean;
          response_ms?: number;
          points_awarded?: number;
          answered_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
