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
  public: {
    Tables: {
      challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          profile_id: string
          reflection_text: string | null
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          profile_id: string
          reflection_text?: string | null
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          profile_id?: string
          reflection_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          action_prompt: string
          created_at: string
          day_number: number
          description: string
          id: string
          reflection_prompt: string
          title: string
        }
        Insert: {
          action_prompt: string
          created_at?: string
          day_number: number
          description: string
          id?: string
          reflection_prompt: string
          title: string
        }
        Update: {
          action_prompt?: string
          created_at?: string
          day_number?: number
          description?: string
          id?: string
          reflection_prompt?: string
          title?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          action_prompt: string
          content: string
          course_id: string
          created_at: string
          id: string
          lesson_number: number
          module_number: number
          reflection_prompt: string
          title: string
        }
        Insert: {
          action_prompt: string
          content: string
          course_id: string
          created_at?: string
          id?: string
          lesson_number: number
          module_number: number
          reflection_prompt: string
          title: string
        }
        Update: {
          action_prompt?: string
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_number?: number
          module_number?: number
          reflection_prompt?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          kind: string
          progress_stage: string | null
          project_id: string
          request_id: string
          started_at: string | null
          status: string
          updated_at: string
          usage_released_at: string | null
          usage_reserved_at: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind?: string
          progress_stage?: string | null
          project_id: string
          request_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          usage_released_at?: string | null
          usage_reserved_at?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind?: string
          progress_stage?: string | null
          project_id?: string
          request_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          usage_released_at?: string | null
          usage_reserved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_project_owner_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          daily_minutes: number | null
          display_name: string | null
          id: string
          interests: string[] | null
          locale: string
          onboarding_completed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_minutes?: number | null
          display_name?: string | null
          id: string
          interests?: string[] | null
          locale?: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_minutes?: number | null
          display_name?: string | null
          id?: string
          interests?: string[] | null
          locale?: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_ai_conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_memory: {
        Row: {
          id: string
          project_id: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_feedback_analyses: {
        Row: {
          analysis: Json | null
          analysis_started_at: string | null
          analyzed_at: string | null
          analyzed_response_count: number | null
          analyzed_response_fingerprint: string | null
          created_at: string
          project_id: string
          proposal_cache: Json
          publication_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          analysis_started_at?: string | null
          analyzed_at?: string | null
          analyzed_response_count?: number | null
          analyzed_response_fingerprint?: string | null
          created_at?: string
          project_id: string
          proposal_cache?: Json
          publication_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          analysis_started_at?: string | null
          analyzed_at?: string | null
          analyzed_response_count?: number | null
          analyzed_response_fingerprint?: string | null
          created_at?: string
          project_id?: string
          proposal_cache?: Json
          publication_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_feedback_analyses_publication_identity_fk"
            columns: ["publication_id", "project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "project_publications"
            referencedColumns: ["id", "project_id", "user_id"]
          },
        ]
      }
      project_outputs: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_outputs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_proofs: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          project_id: string
          stage: string | null
          task_id: string | null
          title: string
          type: string
          url: string | null
          user_id: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          project_id: string
          stage?: string | null
          task_id?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          project_id?: string
          stage?: string | null
          task_id?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_proofs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proofs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_publications: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          locale: string
          output: Json
          project_id: string
          published_at: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          locale: string
          output: Json
          project_id: string
          published_at?: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          locale?: string
          output?: Json
          project_id?: string
          published_at?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_publications_project_owner_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      project_responses: {
        Row: {
          created_at: string
          id: string
          payload: Json
          project_id: string
          publication_id: string
          submitter_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          project_id: string
          publication_id: string
          submitter_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          publication_id?: string
          submitter_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_responses_publication_identity_fk"
            columns: ["publication_id", "project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "project_publications"
            referencedColumns: ["id", "project_id", "user_id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          action: string
          completed_at: string | null
          completion_criteria: string
          created_at: string
          estimated_time: string
          expected_output: string
          id: string
          objective: string
          order_index: number
          output_kind: string
          project_id: string
          recommended_lesson_id: string | null
          review: Json | null
          review_status: string | null
          stage: string
          status: string
          title: string
          updated_at: string
          user_id: string
          why_it_matters: string
          xp: number
          xp_awarded: boolean
        }
        Insert: {
          action: string
          completed_at?: string | null
          completion_criteria: string
          created_at?: string
          estimated_time: string
          expected_output: string
          id?: string
          objective: string
          order_index: number
          output_kind?: string
          project_id: string
          recommended_lesson_id?: string | null
          review?: Json | null
          review_status?: string | null
          stage: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          why_it_matters: string
          xp?: number
          xp_awarded?: boolean
        }
        Update: {
          action?: string
          completed_at?: string | null
          completion_criteria?: string
          created_at?: string
          estimated_time?: string
          expected_output?: string
          id?: string
          objective?: string
          order_index?: number
          output_kind?: string
          project_id?: string
          recommended_lesson_id?: string | null
          review?: Json | null
          review_status?: string | null
          stage?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          why_it_matters?: string
          xp?: number
          xp_awarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          current_stage: string | null
          id: string
          intended_outcome: string
          locale: string
          name: string | null
          niche: string
          pathway_mode: string
          pitch: Json | null
          progress: number
          project_summary: Json | null
          project_type: string
          snapshot_fields: Json | null
          starting_stage: string
          status: string
          target_audience: string | null
          time_availability: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stage?: string | null
          id?: string
          intended_outcome: string
          locale?: string
          name?: string | null
          niche: string
          pathway_mode?: string
          pitch?: Json | null
          progress?: number
          project_summary?: Json | null
          project_type: string
          snapshot_fields?: Json | null
          starting_stage: string
          status?: string
          target_audience?: string | null
          time_availability: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_stage?: string | null
          id?: string
          intended_outcome?: string
          locale?: string
          name?: string | null
          niche?: string
          pathway_mode?: string
          pitch?: Json | null
          progress?: number
          project_summary?: Json | null
          project_type?: string
          snapshot_fields?: Json | null
          starting_stage?: string
          status?: string
          target_audience?: string | null
          time_availability?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_usage: {
        Row: {
          created_at: string
          metric: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          metric: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          metric?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      ventures: {
        Row: {
          budget: string | null
          created_at: string
          deadline: string | null
          id: string
          location: string | null
          mission: string
          owner_id: string
          research_completed_at: string | null
          research_report: Json | null
          resources: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          location?: string | null
          mission: string
          owner_id: string
          research_completed_at?: string | null
          research_report?: Json | null
          resources?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          location?: string | null
          mission?: string
          owner_id?: string
          research_completed_at?: string | null
          research_report?: Json | null
          resources?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      workshop_answers: {
        Row: {
          answered_at: string
          id: string
          is_correct: boolean
          participant_id: string
          points_awarded: number
          question_index: number
          response_ms: number
          selected_option: number
          session_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          is_correct: boolean
          participant_id: string
          points_awarded?: number
          question_index: number
          response_ms: number
          selected_option: number
          session_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          points_awarded?: number
          question_index?: number
          response_ms?: number
          selected_option?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "workshop_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_participants: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_registrations: {
        Row: {
          id: string
          profile_id: string
          registered_at: string
          workshop_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          registered_at?: string
          workshop_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          registered_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_registrations_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_sessions: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          host_id: string
          id: string
          question_started_at: string | null
          status: string
          updated_at: string
          workshop_slug: string
        }
        Insert: {
          code: string
          created_at?: string
          current_question_index?: number
          host_id: string
          id?: string
          question_started_at?: string | null
          status?: string
          updated_at?: string
          workshop_slug: string
        }
        Update: {
          code?: string
          created_at?: string
          current_question_index?: number
          host_id?: string
          id?: string
          question_started_at?: string | null
          status?: string
          updated_at?: string
          workshop_slug?: string
        }
        Relationships: []
      }
      workshops: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number
          id: string
          max_seats: number
          meeting_url: string
          scheduled_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          duration_minutes?: number
          id?: string
          max_seats?: number
          meeting_url: string
          scheduled_at: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          max_seats?: number
          meeting_url?: string
          scheduled_at?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_usage: {
        Args: { p_limit: number; p_metric: string; p_user_id: string }
        Returns: {
          allowed: boolean
          used_count: number
        }[]
      }
      expire_stale_generation_jobs: {
        Args: {
          p_cutoff: string
          p_kind: string
          p_metric: string
          p_project_id: string
          p_user_id: string
        }
        Returns: number
      }
      expire_stale_generation_jobs_for_user: {
        Args: {
          p_cutoff: string
          p_kind: string
          p_metric: string
          p_user_id: string
        }
        Returns: number
      }
      get_public_project: {
        Args: { p_slug: string }
        Returns: {
          locale: string
          output: Json
          published_at: string
          slug: string
          updated_at: string
        }[]
      }
      is_workshop_member: { Args: { p_session_id: string }; Returns: boolean }
      owns_project: { Args: { p_project_id: string }; Returns: boolean }
      release_ai_usage: {
        Args: { p_metric: string; p_user_id: string }
        Returns: undefined
      }
      release_generation_job_usage: {
        Args: { p_job_id: string; p_metric: string }
        Returns: boolean
      }
      reserve_generation_job_usage: {
        Args: {
          p_job_id: string
          p_limit: number
          p_metric: string
          p_user_id: string
        }
        Returns: {
          allowed: boolean
          used_count: number
        }[]
      }
      submit_public_project_response: {
        Args: {
          p_payload: Json
          p_server_submitter_hash: string
          p_slug: string
        }
        Returns: string
      }
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
