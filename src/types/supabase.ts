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
          // Added by supabase/migrations/*_add_profile_locale.sql, which is
          // NOT executed automatically — this column may not exist yet in
          // the live database. See src/lib/actions/locale.ts for the
          // corresponding runtime fallback.
          locale: string | null;
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
          locale?: string | null;
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
          locale?: string | null;
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
      // Added by supabase/migrations/*_add_build.sql, which is NOT executed
      // automatically — these tables may not exist yet in the live database.
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          project_type: string;
          niche: string;
          starting_stage: string;
          target_audience: string | null;
          intended_outcome: string;
          time_availability: string;
          pathway_mode: "standard" | "quick_sprint";
          current_stage: string | null;
          progress: number;
          status: "active" | "completed";
          locale: string;
          project_summary: unknown | null;
          pitch: unknown | null;
          snapshot_fields: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          project_type: string;
          niche: string;
          starting_stage: string;
          target_audience?: string | null;
          intended_outcome: string;
          time_availability: string;
          pathway_mode?: "standard" | "quick_sprint";
          current_stage?: string | null;
          progress?: number;
          status?: "active" | "completed";
          locale?: string;
          project_summary?: unknown | null;
          pitch?: unknown | null;
          snapshot_fields?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          project_type?: string;
          niche?: string;
          starting_stage?: string;
          target_audience?: string | null;
          intended_outcome?: string;
          time_availability?: string;
          pathway_mode?: "standard" | "quick_sprint";
          current_stage?: string | null;
          progress?: number;
          status?: "active" | "completed";
          locale?: string;
          project_summary?: unknown | null;
          pitch?: unknown | null;
          snapshot_fields?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_tasks: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          stage: string;
          order_index: number;
          title: string;
          objective: string;
          why_it_matters: string;
          action: string;
          expected_output: string;
          estimated_time: string;
          completion_criteria: string;
          output_kind: "text" | "longtext";
          recommended_lesson_id: string | null;
          status: "pending" | "completed";
          completed_at: string | null;
          xp: number;
          xp_awarded: boolean;
          // Added by *_add_task_review.sql (manual apply). May be absent until
          // that migration runs — the review gate degrades gracefully.
          review_status: "ready" | "needs_work" | null;
          review: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          stage: string;
          order_index: number;
          title: string;
          objective: string;
          why_it_matters: string;
          action: string;
          expected_output: string;
          estimated_time: string;
          completion_criteria: string;
          output_kind?: "text" | "longtext";
          recommended_lesson_id?: string | null;
          status?: "pending" | "completed";
          completed_at?: string | null;
          xp?: number;
          xp_awarded?: boolean;
          review_status?: "ready" | "needs_work" | null;
          review?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          stage?: string;
          order_index?: number;
          title?: string;
          objective?: string;
          why_it_matters?: string;
          action?: string;
          expected_output?: string;
          estimated_time?: string;
          completion_criteria?: string;
          output_kind?: "text" | "longtext";
          recommended_lesson_id?: string | null;
          status?: "pending" | "completed";
          completed_at?: string | null;
          xp?: number;
          xp_awarded?: boolean;
          review_status?: "ready" | "needs_work" | null;
          review?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_outputs: {
        Row: {
          id: string;
          project_id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Added by *_add_project_assistant.sql (manual apply).
      project_ai_conversations: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          project_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          project_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          project_id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_ai_memory: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          summary?: string | null;
          updated_at?: string;
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
