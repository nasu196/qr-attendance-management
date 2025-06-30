export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          clerk_user_id: string
          name: string | null
          email: string | null
          phone: string | null
          image_url: string | null
          is_premium: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          name?: string | null
          email?: string | null
          phone?: string | null
          image_url?: string | null
          is_premium?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          name?: string | null
          email?: string | null
          phone?: string | null
          image_url?: string | null
          is_premium?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          user_id: string
          name: string
          qr_code_data: string
          tags: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          qr_code_data: string
          tags?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          qr_code_data?: string
          tags?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      work_settings: {
        Row: {
          id: string
          user_id: string
          name: string
          work_hours: number
          break_hours: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          work_hours: number
          break_hours: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          work_hours?: number
          break_hours?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          user_id: string
          staff_id: string
          type: 'clock_in' | 'clock_out'
          timestamp: string
          qr_code_data: string | null
          is_corrected: boolean
          correction_reason: string | null
          corrected_by: string | null
          corrected_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          staff_id: string
          type: 'clock_in' | 'clock_out'
          timestamp: string
          qr_code_data?: string | null
          is_corrected?: boolean
          correction_reason?: string | null
          corrected_by?: string | null
          corrected_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          staff_id?: string
          type?: 'clock_in' | 'clock_out'
          timestamp?: string
          qr_code_data?: string | null
          is_corrected?: boolean
          correction_reason?: string | null
          corrected_by?: string | null
          corrected_at?: string | null
          created_at?: string
        }
      }
      qr_attendance_urls: {
        Row: {
          id: string
          user_id: string
          url_id: string
          name: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url_id: string
          name: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url_id?: string
          name?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      staff_monthly_settings: {
        Row: {
          id: string
          user_id: string
          staff_id: string
          work_setting_id: string | null
          year: number
          month: number
          date: string
          applied_at: string
        }
        Insert: {
          id?: string
          user_id: string
          staff_id: string
          work_setting_id?: string | null
          year: number
          month: number
          date: string
          applied_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          staff_id?: string
          work_setting_id?: string | null
          year?: number
          month?: number
          date?: string
          applied_at?: string
        }
      }
      help_articles: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          tags: string[]
          category: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          tags?: string[]
          category?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          tags?: string[]
          category?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ai_chat_history: {
        Row: {
          id: string
          user_id: string
          message: string
          response: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          response: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          response?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
} 