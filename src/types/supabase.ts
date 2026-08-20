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
      generation_jobs: {
        Row: {
          attempt_count: number
          cached_tokens: number | null
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          input_tokens: number | null
          kind: string
          output_tokens: number | null
          payload: Json | null
          progress_stage: string | null
          project_id: string
          provider_requests: number
          request_id: string
          started_at: string | null
          status: string
          thoughts_tokens: number | null
          updated_at: string
          usage_released_at: string | null
          usage_reserved_at: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number
          cached_tokens?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input_tokens?: number | null
          kind?: string
          output_tokens?: number | null
          payload?: Json | null
          progress_stage?: string | null
          project_id: string
          provider_requests?: number
          request_id: string
          started_at?: string | null
          status?: string
          thoughts_tokens?: number | null
          updated_at?: string
          usage_released_at?: string | null
          usage_reserved_at?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number
          cached_tokens?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input_tokens?: number | null
          kind?: string
          output_tokens?: number | null
          payload?: Json | null
          progress_stage?: string | null
          project_id?: string
          provider_requests?: number
          request_id?: string
          started_at?: string | null
          status?: string
          thoughts_tokens?: number | null
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
            referencedRelation: "project_cards"
            referencedColumns: ["id", "user_id"]
          },
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
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          personal_instructions: string | null
          plan: string
          preferred_name: string | null
          subscription_status: string | null
          updated_at: string
          work_description: string | null
        }
        Insert: {
          created_at?: string
          daily_minutes?: number | null
          display_name?: string | null
          id: string
          interests?: string[] | null
          locale?: string
          onboarding_completed_at?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          personal_instructions?: string | null
          plan?: string
          preferred_name?: string | null
          subscription_status?: string | null
          updated_at?: string
          work_description?: string | null
        }
        Update: {
          created_at?: string
          daily_minutes?: number | null
          display_name?: string | null
          id?: string
          interests?: string[] | null
          locale?: string
          onboarding_completed_at?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          personal_instructions?: string | null
          plan?: string
          preferred_name?: string | null
          subscription_status?: string | null
          updated_at?: string
          work_description?: string | null
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
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_needing_thumbnail"
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
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_needing_thumbnail"
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
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_needing_thumbnail"
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
            referencedRelation: "project_cards"
            referencedColumns: ["id", "user_id"]
          },
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
          thumbnail_captured_at: string | null
          thumbnail_url: string | null
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
          thumbnail_captured_at?: string | null
          thumbnail_url?: string | null
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
          thumbnail_captured_at?: string | null
          thumbnail_url?: string | null
          time_availability?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          action: string
          created_at: string
          id: number
          subject: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          subject: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          subject?: string
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
    }
    Views: {
      /**
       * HAND-TIGHTENED, AND IT MUST STAY THAT WAY.
       *
       * `supabase gen types` marks EVERY column of a view nullable, because
       * Postgres does not carry a NOT NULL guarantee through a view definition
       * and the generator will not infer one. But this view is a plain
       * projection of public.projects, where id, user_id, project_type, status,
       * created_at and updated_at are all NOT NULL — so the generated `| null`
       * is a lie that forces a null check at every call site for a value that
       * cannot occur.
       *
       * If a regeneration reverts this, src/lib/workspace/shellNav.ts and
       * present.ts stop compiling. That is the intended alarm: re-apply this
       * block rather than adding null guards to satisfy it.
       */
      project_cards: {
        Row: {
          card_app: Json | null
          card_content: Json | null
          created_at: string
          id: string
          name: string | null
          project_type: string
          status: string
          summary: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_app?: never
          card_content?: never
          created_at?: string | null
          id?: string | null
          name?: string | null
          project_type?: string | null
          status?: string | null
          summary?: never
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_app?: never
          card_content?: never
          created_at?: string | null
          id?: string | null
          name?: string | null
          project_type?: string | null
          status?: string | null
          summary?: never
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      /** Same reasoning as project_cards above: a projection of NOT NULL columns. */
      projects_needing_thumbnail: {
        Row: {
          id: string
          snapshot_fields: Json | null
          updated_at: string
        }
        Insert: {
          id?: string | null
          snapshot_fields?: Json | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          snapshot_fields?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_generation_provider_request: {
        Args: { p_expected: number; p_job_id: string }
        Returns: boolean
      }
      consume_ai_usage: {
        Args: { p_limit: number; p_metric: string; p_user_id: string }
        Returns: {
          allowed: boolean
          used_count: number
        }[]
      }
      consume_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_subject: string
          p_window_seconds: number
        }
        Returns: Json
      }
      expire_stale_generation_jobs:
        | {
            Args: {
              p_cutoff: string
              p_kind: string
              p_metric: string
              p_metric_daily: boolean
              p_project_id: string
              p_user_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_cutoff: string
              p_kind: string
              p_metric: string
              p_metric_period: string
              p_project_id: string
              p_user_id: string
            }
            Returns: number
          }
      expire_stale_generation_jobs_for_user:
        | {
            Args: {
              p_cutoff: string
              p_kind: string
              p_metric: string
              p_metric_daily: boolean
              p_user_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_cutoff: string
              p_kind: string
              p_metric: string
              p_metric_period: string
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
      usage_key_for_job:
        | {
            Args: {
              p_metric: string
              p_metric_daily: boolean
              p_reserved_at: string
            }
            Returns: string
          }
        | {
            Args: {
              p_metric: string
              p_metric_period: string
              p_reserved_at: string
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
