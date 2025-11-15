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
      analytics_summary: {
        Row: {
          avg_duration_seconds: number | null
          created_at: string
          date: string
          id: string
          total_views: number | null
          tour_id: string
          unique_viewers: number | null
          updated_at: string
        }
        Insert: {
          avg_duration_seconds?: number | null
          created_at?: string
          date: string
          id?: string
          total_views?: number | null
          tour_id: string
          unique_viewers?: number | null
          updated_at?: string
        }
        Update: {
          avg_duration_seconds?: number | null
          created_at?: string
          date?: string
          id?: string
          total_views?: number | null
          tour_id?: string
          unique_viewers?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_summary_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_destination_audit: {
        Row: {
          action: string
          created_at: string | null
          destination_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          destination_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          destination_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_destination_audit_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_destinations: {
        Row: {
          auto_backup_enabled: boolean | null
          backup_frequency: string | null
          backup_on_photo_upload: boolean | null
          cloud_access_token: string | null
          cloud_folder_id: string | null
          cloud_folder_path: string | null
          cloud_provider: string | null
          cloud_refresh_token: string | null
          created_at: string | null
          destination_type: string
          id: string
          is_active: boolean | null
          last_backup_at: string | null
          tenant_id: string
          token_expires_at: string | null
          token_last_refreshed_at: string | null
          token_refresh_count: number | null
          updated_at: string | null
        }
        Insert: {
          auto_backup_enabled?: boolean | null
          backup_frequency?: string | null
          backup_on_photo_upload?: boolean | null
          cloud_access_token?: string | null
          cloud_folder_id?: string | null
          cloud_folder_path?: string | null
          cloud_provider?: string | null
          cloud_refresh_token?: string | null
          created_at?: string | null
          destination_type: string
          id?: string
          is_active?: boolean | null
          last_backup_at?: string | null
          tenant_id: string
          token_expires_at?: string | null
          token_last_refreshed_at?: string | null
          token_refresh_count?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_backup_enabled?: boolean | null
          backup_frequency?: string | null
          backup_on_photo_upload?: boolean | null
          cloud_access_token?: string | null
          cloud_folder_id?: string | null
          cloud_folder_path?: string | null
          cloud_provider?: string | null
          cloud_refresh_token?: string | null
          created_at?: string | null
          destination_type?: string
          id?: string
          is_active?: boolean | null
          last_backup_at?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          token_last_refreshed_at?: string | null
          token_refresh_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_destinations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_jobs: {
        Row: {
          cloud_sync_error: string | null
          cloud_synced: boolean | null
          completed_at: string | null
          created_at: string | null
          destination_id: string | null
          destination_type: string | null
          error_message: string | null
          estimated_size_mb: number | null
          file_hash: string | null
          file_size: number | null
          file_url: string | null
          id: string
          job_type: string
          last_error: string | null
          max_retries: number | null
          metadata: Json | null
          processed_items: number | null
          progress_percentage: number | null
          retry_count: number | null
          status: string
          storage_path: string | null
          tenant_id: string
          total_items: number | null
          tour_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cloud_sync_error?: string | null
          cloud_synced?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          error_message?: string | null
          estimated_size_mb?: number | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_retries?: number | null
          metadata?: Json | null
          processed_items?: number | null
          progress_percentage?: number | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          total_items?: number | null
          tour_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cloud_sync_error?: string | null
          cloud_synced?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          error_message?: string | null
          estimated_size_mb?: number | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_retries?: number | null
          metadata?: Json | null
          processed_items?: number | null
          progress_percentage?: number | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          total_items?: number | null
          tour_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_jobs_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_jobs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_job_id: string
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          is_error: boolean | null
          message: string
        }
        Insert: {
          backup_job_id: string
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          is_error?: boolean | null
          message: string
        }
        Update: {
          backup_job_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          is_error?: boolean | null
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_metrics: {
        Row: {
          details: Json | null
          id: string
          metric_type: string
          metric_value: number | null
          recorded_at: string | null
        }
        Insert: {
          details?: Json | null
          id?: string
          metric_type: string
          metric_value?: number | null
          recorded_at?: string | null
        }
        Update: {
          details?: Json | null
          id?: string
          metric_type?: string
          metric_value?: number | null
          recorded_at?: string | null
        }
        Relationships: []
      }
      backup_parts: {
        Row: {
          backup_job_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_hash: string | null
          file_size: number | null
          file_url: string | null
          id: string
          items_count: number
          part_number: number
          status: string
          storage_path: string | null
        }
        Insert: {
          backup_job_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          items_count?: number
          part_number: number
          status?: string
          storage_path?: string | null
        }
        Update: {
          backup_job_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          items_count?: number
          part_number?: number
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_parts_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_queue: {
        Row: {
          attempts: number | null
          backup_job_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          locked_until: string | null
          max_attempts: number | null
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          backup_job_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          locked_until?: string | null
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          backup_job_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          locked_until?: string | null
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_queue_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_sync_history: {
        Row: {
          backup_job_id: string | null
          completed_at: string | null
          destination_id: string
          error_message: string | null
          files_failed: number | null
          files_synced: number | null
          id: string
          metadata: Json | null
          started_at: string | null
          status: string | null
          sync_type: string | null
          total_size_bytes: number | null
        }
        Insert: {
          backup_job_id?: string | null
          completed_at?: string | null
          destination_id: string
          error_message?: string | null
          files_failed?: number | null
          files_synced?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          total_size_bytes?: number | null
        }
        Update: {
          backup_job_id?: string | null
          completed_at?: string | null
          destination_id?: string
          error_message?: string | null
          files_failed?: number | null
          files_synced?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          total_size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_sync_history_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_sync_history_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_file_mappings: {
        Row: {
          backed_up_at: string | null
          backup_job_id: string | null
          checksum: string | null
          cloud_file_id: string
          cloud_file_name: string
          cloud_file_path: string
          destination_id: string
          file_size_bytes: number | null
          floor_plan_id: string | null
          hotspot_id: string | null
          id: string
          local_file_type: string | null
          local_file_url: string
          metadata: Json | null
          photo_id: string | null
          tour_id: string
        }
        Insert: {
          backed_up_at?: string | null
          backup_job_id?: string | null
          checksum?: string | null
          cloud_file_id: string
          cloud_file_name: string
          cloud_file_path: string
          destination_id: string
          file_size_bytes?: number | null
          floor_plan_id?: string | null
          hotspot_id?: string | null
          id?: string
          local_file_type?: string | null
          local_file_url: string
          metadata?: Json | null
          photo_id?: string | null
          tour_id: string
        }
        Update: {
          backed_up_at?: string | null
          backup_job_id?: string | null
          checksum?: string | null
          cloud_file_id?: string
          cloud_file_name?: string
          cloud_file_path?: string
          destination_id?: string
          file_size_bytes?: number | null
          floor_plan_id?: string | null
          hotspot_id?: string | null
          id?: string
          local_file_type?: string | null
          local_file_url?: string
          metadata?: Json | null
          photo_id?: string | null
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_file_mappings_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_file_mappings_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_file_mappings_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_file_mappings_hotspot_id_fkey"
            columns: ["hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_file_mappings_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "panorama_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_file_mappings_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          command_number: number
          command_text: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          command_number: number
          command_text: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          command_number?: number
          command_text?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_address: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          resend_id: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_address: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          resend_id?: string | null
          sent_at?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_address?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          device_type: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string | null
          description: string | null
          feature_key: string
          feature_name: string
          id: string
          is_beta: boolean | null
          requires_subscription_tier: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature_key: string
          feature_name: string
          id?: string
          is_beta?: boolean | null
          requires_subscription_tier?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature_key?: string
          feature_name?: string
          id?: string
          is_beta?: boolean | null
          requires_subscription_tier?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      floor_plans: {
        Row: {
          capture_date: string | null
          created_at: string
          height: number
          id: string
          image_url: string
          name: string
          tenant_id: string
          tour_id: string
          width: number
        }
        Insert: {
          capture_date?: string | null
          created_at?: string
          height: number
          id?: string
          image_url: string
          name: string
          tenant_id: string
          tour_id: string
          width: number
        }
        Update: {
          capture_date?: string | null
          created_at?: string
          height?: number
          id?: string
          image_url?: string
          name?: string
          tenant_id?: string
          tour_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      global_feature_config: {
        Row: {
          created_at: string | null
          default_enabled: boolean | null
          feature_id: string
          id: string
          rollout_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_enabled?: boolean | null
          feature_id: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_enabled?: boolean | null
          feature_id?: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_feature_config_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: true
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      golden_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          rule_number: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          rule_number: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          rule_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotspot_navigation_points: {
        Row: {
          capture_date: string | null
          created_at: string | null
          display_order: number | null
          from_hotspot_id: string
          height_offset: number | null
          id: string
          is_active: boolean | null
          label: string | null
          phi: number
          style: Json | null
          theta: number
          to_hotspot_id: string
          u: number | null
          v: number | null
        }
        Insert: {
          capture_date?: string | null
          created_at?: string | null
          display_order?: number | null
          from_hotspot_id: string
          height_offset?: number | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phi?: number
          style?: Json | null
          theta: number
          to_hotspot_id: string
          u?: number | null
          v?: number | null
        }
        Update: {
          capture_date?: string | null
          created_at?: string | null
          display_order?: number | null
          from_hotspot_id?: string
          height_offset?: number | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phi?: number
          style?: Json | null
          theta?: number
          to_hotspot_id?: string
          u?: number | null
          v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotspot_navigation_points_from_hotspot_id_fkey"
            columns: ["from_hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotspot_navigation_points_to_hotspot_id_fkey"
            columns: ["to_hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
        ]
      }
      hotspots: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          floor_plan_id: string
          has_panorama: boolean | null
          id: string
          media_type: string | null
          media_url: string | null
          panorama_count: number | null
          title: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          floor_plan_id: string
          has_panorama?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          panorama_count?: number | null
          title: string
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          floor_plan_id?: string
          has_panorama?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          panorama_count?: number | null
          title?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotspots_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_on_new_user: boolean | null
          email_on_new_view: boolean | null
          email_weekly_report: boolean | null
          id: string
          push_on_new_comment: boolean | null
          push_on_new_like: boolean | null
          push_on_new_view: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_on_new_user?: boolean | null
          email_on_new_view?: boolean | null
          email_weekly_report?: boolean | null
          id?: string
          push_on_new_comment?: boolean | null
          push_on_new_like?: boolean | null
          push_on_new_view?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_on_new_user?: boolean | null
          email_on_new_view?: boolean | null
          email_weekly_report?: boolean | null
          id?: string
          push_on_new_comment?: boolean | null
          push_on_new_like?: boolean | null
          push_on_new_view?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          related_tour_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          related_tour_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          related_tour_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_tour_id_fkey"
            columns: ["related_tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          redirect_uri: string | null
          state_token: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          redirect_uri?: string | null
          state_token: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_uri?: string | null
          state_token?: string
          tenant_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_locked: boolean
          name: string
          route: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          name: string
          route: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          name?: string
          route?: string
          updated_at?: string
        }
        Relationships: []
      }
      panorama_photos: {
        Row: {
          capture_date: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          hotspot_id: string
          id: string
          original_filename: string | null
          photo_url: string
          photo_url_mobile: string | null
          photo_url_thumbnail: string | null
        }
        Insert: {
          capture_date?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotspot_id: string
          id?: string
          original_filename?: string | null
          photo_url: string
          photo_url_mobile?: string | null
          photo_url_thumbnail?: string | null
        }
        Update: {
          capture_date?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotspot_id?: string
          id?: string
          original_filename?: string | null
          photo_url?: string
          photo_url_mobile?: string | null
          photo_url_thumbnail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panorama_photos_hotspot_id_fkey"
            columns: ["hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_sync_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          photo_id: string
          priority: number | null
          processed_at: string | null
          status: string | null
          tenant_id: string
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          photo_id: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
          tenant_id: string
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          photo_id?: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
          tenant_id?: string
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_sync_queue_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "panorama_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_page_variants: {
        Row: {
          code_override: string | null
          config_id: string
          created_at: string
          css_overrides: Json | null
          id: string
          is_default: boolean
          updated_at: string
          variant_name: string
        }
        Insert: {
          code_override?: string | null
          config_id: string
          created_at?: string
          css_overrides?: Json | null
          id?: string
          is_default?: boolean
          updated_at?: string
          variant_name: string
        }
        Update: {
          code_override?: string | null
          config_id?: string
          created_at?: string
          css_overrides?: Json | null
          id?: string
          is_default?: boolean
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_page_variants_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "platform_ui_config"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ui_config: {
        Row: {
          component_path: string
          created_at: string
          created_by: string | null
          feature_flags: Json | null
          id: string
          is_active: boolean
          layout_config: Json | null
          page_name: string
          platform: string
          updated_at: string
          version: number
        }
        Insert: {
          component_path: string
          created_at?: string
          created_by?: string | null
          feature_flags?: Json | null
          id?: string
          is_active?: boolean
          layout_config?: Json | null
          page_name: string
          platform: string
          updated_at?: string
          version?: number
        }
        Update: {
          component_path?: string
          created_at?: string
          created_by?: string | null
          feature_flags?: Json | null
          id?: string
          is_active?: boolean
          layout_config?: Json | null
          page_name?: string
          platform?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          account_status?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          account_status?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_access_logs: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_messages: Json | null
          failed_items: number
          id: string
          job_type: string
          processed_items: number
          started_at: string
          status: string
          tenant_id: string
          total_items: number
          tour_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_messages?: Json | null
          failed_items?: number
          id?: string
          job_type?: string
          processed_items?: number
          started_at?: string
          status?: string
          tenant_id: string
          total_items?: number
          tour_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_messages?: Json | null
          failed_items?: number
          id?: string
          job_type?: string
          processed_items?: number
          started_at?: string
          status?: string
          tenant_id?: string
          total_items?: number
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_features: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          enabled_at: string | null
          feature_id: string
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          feature_id: string
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          feature_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          settings: Json | null
          status: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          settings?: Json | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_analytics: {
        Row: {
          avg_duration_seconds: number | null
          comments_count: number | null
          created_at: string
          id: string
          last_viewed_at: string | null
          likes_count: number | null
          tour_id: string
          unique_viewers: number | null
          updated_at: string
          views_count: number | null
        }
        Insert: {
          avg_duration_seconds?: number | null
          comments_count?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          likes_count?: number | null
          tour_id: string
          unique_viewers?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          avg_duration_seconds?: number | null
          comments_count?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          likes_count?: number | null
          tour_id?: string
          unique_viewers?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_analytics_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_backup_config: {
        Row: {
          auto_backup_enabled: boolean | null
          backup_frequency: string | null
          backup_on_create: boolean | null
          backup_on_update: boolean | null
          backup_type: string | null
          created_at: string | null
          destination_id: string | null
          id: string
          last_auto_backup_at: string | null
          tenant_id: string
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          auto_backup_enabled?: boolean | null
          backup_frequency?: string | null
          backup_on_create?: boolean | null
          backup_on_update?: boolean | null
          backup_type?: string | null
          created_at?: string | null
          destination_id?: string | null
          id?: string
          last_auto_backup_at?: string | null
          tenant_id: string
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          auto_backup_enabled?: boolean | null
          backup_frequency?: string | null
          backup_on_create?: boolean | null
          backup_on_update?: boolean | null
          backup_type?: string | null
          created_at?: string | null
          destination_id?: string | null
          id?: string
          last_auto_backup_at?: string | null
          tenant_id?: string
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_backup_config_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "backup_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_backup_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_backup_config_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_comments: {
        Row: {
          comment_text: string
          commenter_email: string | null
          commenter_name: string | null
          created_at: string
          id: string
          is_read: boolean | null
          tour_id: string
          user_id: string | null
        }
        Insert: {
          comment_text: string
          commenter_email?: string | null
          commenter_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tour_id: string
          user_id?: string | null
        }
        Update: {
          comment_text?: string
          commenter_email?: string | null
          commenter_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tour_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_comments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_views: number | null
          permission_level: Database["public"]["Enums"]["share_permission"]
          share_token: string
          tour_id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_views?: number | null
          permission_level?: Database["public"]["Enums"]["share_permission"]
          share_token: string
          tour_id: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_views?: number | null
          permission_level?: Database["public"]["Enums"]["share_permission"]
          share_token?: string
          tour_id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tour_shares_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_views: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          ip_address: string | null
          session_id: string | null
          tour_id: string
          user_agent: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          tour_id: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          tour_id?: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_views_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      user_approval_requests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_approval_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          auto_downloads: boolean | null
          auto_reports: boolean | null
          autoplay: boolean | null
          backup_frequency: string | null
          cloud_sync: boolean | null
          color_scheme: string | null
          contact_preferences: Json | null
          created_at: string | null
          cross_device_sync: boolean | null
          currency: string | null
          data_sharing: boolean | null
          data_usage: string | null
          date_format: string | null
          default_volume: number | null
          email_notifications: boolean | null
          font_size: string | null
          id: string
          image_quality: string | null
          in_app_notifications: boolean | null
          language: string | null
          layout_mode: string | null
          local_storage_limit_mb: number | null
          metrics_to_track: Json | null
          notification_types: Json | null
          profile_visibility: string | null
          push_notifications: boolean | null
          pwa_auto_update: boolean | null
          pwa_auto_update_delay: number | null
          pwa_browser_notifications: boolean | null
          pwa_check_interval: number | null
          report_frequency: string | null
          share_usage_data: boolean | null
          sound_effects: boolean | null
          subscription_tier: string | null
          sync_data_types: Json | null
          theme: string | null
          time_format: string | null
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          user_id: string
          video_quality: string | null
        }
        Insert: {
          auto_downloads?: boolean | null
          auto_reports?: boolean | null
          autoplay?: boolean | null
          backup_frequency?: string | null
          cloud_sync?: boolean | null
          color_scheme?: string | null
          contact_preferences?: Json | null
          created_at?: string | null
          cross_device_sync?: boolean | null
          currency?: string | null
          data_sharing?: boolean | null
          data_usage?: string | null
          date_format?: string | null
          default_volume?: number | null
          email_notifications?: boolean | null
          font_size?: string | null
          id?: string
          image_quality?: string | null
          in_app_notifications?: boolean | null
          language?: string | null
          layout_mode?: string | null
          local_storage_limit_mb?: number | null
          metrics_to_track?: Json | null
          notification_types?: Json | null
          profile_visibility?: string | null
          push_notifications?: boolean | null
          pwa_auto_update?: boolean | null
          pwa_auto_update_delay?: number | null
          pwa_browser_notifications?: boolean | null
          pwa_check_interval?: number | null
          report_frequency?: string | null
          share_usage_data?: boolean | null
          sound_effects?: boolean | null
          subscription_tier?: string | null
          sync_data_types?: Json | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          video_quality?: string | null
        }
        Update: {
          auto_downloads?: boolean | null
          auto_reports?: boolean | null
          autoplay?: boolean | null
          backup_frequency?: string | null
          cloud_sync?: boolean | null
          color_scheme?: string | null
          contact_preferences?: Json | null
          created_at?: string | null
          cross_device_sync?: boolean | null
          currency?: string | null
          data_sharing?: boolean | null
          data_usage?: string | null
          date_format?: string | null
          default_volume?: number | null
          email_notifications?: boolean | null
          font_size?: string | null
          id?: string
          image_quality?: string | null
          in_app_notifications?: boolean | null
          language?: string | null
          layout_mode?: string | null
          local_storage_limit_mb?: number | null
          metrics_to_track?: Json | null
          notification_types?: Json | null
          profile_visibility?: string | null
          push_notifications?: boolean | null
          pwa_auto_update?: boolean | null
          pwa_auto_update_delay?: number | null
          pwa_browser_notifications?: boolean | null
          pwa_check_interval?: number | null
          report_frequency?: string | null
          share_usage_data?: boolean | null
          sound_effects?: boolean | null
          subscription_tier?: string | null
          sync_data_types?: Json | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          video_quality?: string | null
        }
        Relationships: []
      }
      virtual_tours: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_publicly_listed: boolean | null
          is_published: boolean
          password_hash: string | null
          password_protected: boolean | null
          password_updated_at: string | null
          share_description: string | null
          share_image_url: string | null
          tenant_id: string
          title: string
          tour_type: string | null
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_publicly_listed?: boolean | null
          is_published?: boolean
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          share_description?: string | null
          share_image_url?: string | null
          tenant_id: string
          title: string
          tour_type?: string | null
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_publicly_listed?: boolean | null
          is_published?: boolean
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          share_description?: string | null
          share_image_url?: string | null
          tenant_id?: string
          title?: string
          tour_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_tours_organization_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: {
        Args: { _approved_by: string; _notes?: string; _user_id: string }
        Returns: undefined
      }
      auto_cleanup_old_backup_jobs: { Args: never; Returns: undefined }
      belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      check_system_health: {
        Args: never
        Returns: {
          alert_level: string
          details: Json
          health_status: string
          message: string
        }[]
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      cleanup_inactive_backup_destinations: { Args: never; Returns: number }
      cleanup_old_backup_jobs: { Args: never; Returns: number }
      cleanup_old_queue_items: { Args: never; Returns: number }
      cleanup_orphaned_backups: {
        Args: never
        Returns: {
          cancelled_count: number
          deleted_count: number
        }[]
      }
      cleanup_queue_for_job: { Args: { p_job_id: string }; Returns: number }
      cleanup_stalled_backup_jobs: { Args: never; Returns: undefined }
      cleanup_stalled_jobs: {
        Args: never
        Returns: {
          cleaned_job_id: string
          stalled_for_minutes: number
          tour_id: string
        }[]
      }
      cleanup_stuck_jobs_fallback: { Args: never; Returns: undefined }
      delete_cloud_file_mapping: {
        Args: { p_mapping_id: string }
        Returns: undefined
      }
      enable_auto_backup_for_existing_tours: {
        Args: { p_tenant_id: string }
        Returns: {
          configs_created: number
          tours_updated: number
        }[]
      }
      enqueue_photos_for_sync: {
        Args: { p_photo_ids: string[]; p_tenant_id: string; p_tour_id: string }
        Returns: number
      }
      export_backup_system_config: {
        Args: never
        Returns: {
          config_data: Json
          config_type: string
        }[]
      }
      generate_share_token: { Args: never; Returns: string }
      generate_system_documentation: {
        Args: never
        Returns: {
          content: string
          section: string
        }[]
      }
      get_active_backup_destination: {
        Args: { p_tenant_id: string }
        Returns: {
          auto_backup_enabled: boolean
          cloud_provider: string
          destination_type: string
          id: string
        }[]
      }
      get_backup_system_dashboard: {
        Args: never
        Returns: {
          queue_status: Json
          recent_activity: Json
          storage_info: Json
          system_metrics: Json
        }[]
      }
      get_cloud_file_mappings_for_tour: {
        Args: { p_tour_id: string }
        Returns: {
          cloud_file_id: string
          cloud_file_name: string
          cloud_file_path: string
          destination_id: string
          floor_plan_id: string
          hotspot_id: string
          id: string
          local_file_type: string
          local_file_url: string
          photo_id: string
          tour_id: string
        }[]
      }
      get_next_photos_to_process: {
        Args: { p_batch_size?: number }
        Returns: {
          attempts: number
          id: string
          photo_id: string
          tenant_id: string
          tour_id: string
        }[]
      }
      get_queue_stats: {
        Args: never
        Returns: {
          avg_processing_time_seconds: number
          completed_today: number
          pending_count: number
          processing_count: number
          retry_count: number
        }[]
      }
      get_queue_stats_by_tour: {
        Args: { p_tour_id: string }
        Returns: {
          completed_count: number
          failed_count: number
          pending_count: number
          processing_count: number
          total_count: number
        }[]
      }
      get_user_tenants: {
        Args: { _user_id: string }
        Returns: {
          tenant_id: string
          tenant_name: string
          user_role: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_feature_enabled: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      monitor_stuck_backup_jobs: {
        Args: never
        Returns: {
          current_part: number
          job_id: string
          stuck_for_hours: number
          total_parts: number
          tour_id: string
        }[]
      }
      optimize_backup_system: { Args: never; Returns: string }
      process_backup_queue: {
        Args: never
        Returns: {
          failed_count: number
          processed_count: number
          total_processed: number
        }[]
      }
      process_backup_queue_fallback: {
        Args: never
        Returns: {
          failed: number
          processed: number
          total_processed: number
        }[]
      }
      promote_to_super_admin: {
        Args: { _promoted_by: string; _user_id: string }
        Returns: undefined
      }
      record_backup_metrics: { Args: never; Returns: undefined }
      reject_user: {
        Args: { _notes?: string; _rejected_by: string; _user_id: string }
        Returns: undefined
      }
      reset_queue_for_tour: { Args: { p_tour_id: string }; Returns: number }
      revoke_cloud_storage_access: {
        Args: { p_destination_id: string }
        Returns: undefined
      }
      revoke_super_admin: {
        Args: { _revoked_by: string; _user_id: string }
        Returns: undefined
      }
      run_backup_system_tests: {
        Args: never
        Returns: {
          details: Json
          duration_ms: number
          test_name: string
          test_result: string
        }[]
      }
      run_edge_case_tests: {
        Args: never
        Returns: {
          details: Json
          edge_case: string
          test_result: string
        }[]
      }
      run_load_test: {
        Args: { num_backups?: number }
        Returns: {
          avg_processing_time_seconds: number
          backups_created: number
          details: Json
          failed_backups: number
          successful_backups: number
          test_type: string
        }[]
      }
      should_rotate_backup_tokens: {
        Args: { p_destination_id: string }
        Returns: boolean
      }
      suggest_hotspot_connections: {
        Args: { p_floor_plan_id: string; p_max_distance?: number }
        Returns: {
          distance: number
          from_id: string
          suggested_theta: number
          to_id: string
        }[]
      }
      update_queue_item_status: {
        Args: { p_error_message?: string; p_queue_id: string; p_status: string }
        Returns: undefined
      }
      verify_production_readiness: {
        Args: never
        Returns: {
          check_item: string
          details: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      share_permission: "view" | "comment" | "edit"
      tenant_role: "tenant_admin" | "member"
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
      app_role: ["admin", "user"],
      share_permission: ["view", "comment", "edit"],
      tenant_role: ["tenant_admin", "member"],
    },
  },
} as const
