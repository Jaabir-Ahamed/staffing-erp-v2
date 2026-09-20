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
      absence_penalty_tiers: {
        Row: {
          from_absent_day: number
          id: string
          rate_aed_per_day: number
          rule_set_id: string
          to_absent_day: number | null
        }
        Insert: {
          from_absent_day: number
          id?: string
          rate_aed_per_day: number
          rule_set_id: string
          to_absent_day?: number | null
        }
        Update: {
          from_absent_day?: number
          id?: string
          rate_aed_per_day?: number
          rule_set_id?: string
          to_absent_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_penalty_tiers_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "payroll_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      client_payout_timesheets: {
        Row: {
          client_payout_id: string
          timesheet_id: string
        }
        Insert: {
          client_payout_id: string
          timesheet_id: string
        }
        Update: {
          client_payout_id?: string
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payout_timesheets_client_payout_id_fkey"
            columns: ["client_payout_id"]
            isOneToOne: false
            referencedRelation: "client_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payout_timesheets_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: true
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payouts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status: Database["public"]["Enums"]["aggregation_status"]
          total_client_charge_amount: number | null
          total_net_salary: number
          total_profit_amount: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["aggregation_status"]
          total_client_charge_amount?: number | null
          total_net_salary?: number
          total_profit_amount?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          staffing_company?: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["aggregation_status"]
          total_client_charge_amount?: number | null
          total_net_salary?: number
          total_profit_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payouts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rate_rules: {
        Row: {
          client_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          rate_aed_per_hour: number
          shift_key: string
          shift_type: Database["public"]["Enums"]["shift_type"] | null
          source_document: string | null
          trade: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          rate_aed_per_hour: number
          shift_key?: string
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          source_document?: string | null
          trade: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate_aed_per_hour?: number
          shift_key?: string
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          source_document?: string | null
          trade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rate_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          billing_contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          billing_contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parser_templates: {
        Row: {
          client_id: string
          created_at: string
          date_format: string | null
          effective_from: string
          field_mappings: Json
          id: string
          notes: string | null
          options: Json
          period_inference_rule: Database["public"]["Enums"]["period_inference_rule"]
          updated_at: string
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          date_format?: string | null
          effective_from: string
          field_mappings?: Json
          id?: string
          notes?: string | null
          options?: Json
          period_inference_rule: Database["public"]["Enums"]["period_inference_rule"]
          updated_at?: string
          version: number
        }
        Update: {
          client_id?: string
          created_at?: string
          date_format?: string | null
          effective_from?: string
          field_mappings?: Json
          id?: string
          notes?: string | null
          options?: Json
          period_inference_rule?: Database["public"]["Enums"]["period_inference_rule"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "parser_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rule_sets: {
        Row: {
          bonus_amount_aed: number
          bonus_requires_zero_absence: boolean
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          late_submission_gap_days: number
          name: string
          updated_at: string
        }
        Insert: {
          bonus_amount_aed?: number
          bonus_requires_zero_absence?: boolean
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          late_submission_gap_days?: number
          name: string
          updated_at?: string
        }
        Update: {
          bonus_amount_aed?: number
          bonus_requires_zero_absence?: boolean
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          late_submission_gap_days?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_field_review: {
        Row: {
          created_at: string
          id: string
          mapped_canonical_field: string | null
          parser_template_id: string | null
          raw_column_name: string
          resolved_at: string | null
          resolved_by: string | null
          sample_values: Json
          source_file_id: string
          status: Database["public"]["Enums"]["pending_field_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_canonical_field?: string | null
          parser_template_id?: string | null
          raw_column_name: string
          resolved_at?: string | null
          resolved_by?: string | null
          sample_values?: Json
          source_file_id: string
          status?: Database["public"]["Enums"]["pending_field_status"]
        }
        Update: {
          created_at?: string
          id?: string
          mapped_canonical_field?: string | null
          parser_template_id?: string | null
          raw_column_name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sample_values?: Json
          source_file_id?: string
          status?: Database["public"]["Enums"]["pending_field_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_field_review_parser_template_id_fkey"
            columns: ["parser_template_id"]
            isOneToOne: false
            referencedRelation: "parser_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_field_review_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_field_review_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "timesheet_source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_sheet_timesheets: {
        Row: {
          salary_sheet_id: string
          timesheet_id: string
        }
        Insert: {
          salary_sheet_id: string
          timesheet_id: string
        }
        Update: {
          salary_sheet_id?: string
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_sheet_timesheets_salary_sheet_id_fkey"
            columns: ["salary_sheet_id"]
            isOneToOne: false
            referencedRelation: "salary_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_sheet_timesheets_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: true
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_sheets: {
        Row: {
          created_at: string
          id: string
          payroll_period_end: string
          payroll_period_start: string
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status: Database["public"]["Enums"]["aggregation_status"]
          total_absence_penalty_amount: number
          total_bonus_amount: number
          total_gross_salary: number
          total_hours_worked: number
          total_net_salary: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payroll_period_end: string
          payroll_period_start: string
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["aggregation_status"]
          total_absence_penalty_amount?: number
          total_bonus_amount?: number
          total_gross_salary?: number
          total_hours_worked?: number
          total_net_salary?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payroll_period_end?: string
          payroll_period_start?: string
          staffing_company?: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["aggregation_status"]
          total_absence_penalty_amount?: number
          total_bonus_amount?: number
          total_gross_salary?: number
          total_hours_worked?: number
          total_net_salary?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_sheets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_adjustments: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason_code: Database["public"]["Enums"]["adjustment_reason_code"]
          timesheet_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason_code: Database["public"]["Enums"]["adjustment_reason_code"]
          timesheet_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason_code?: Database["public"]["Enums"]["adjustment_reason_code"]
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_adjustments_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_adjustments_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_normalized_rows: {
        Row: {
          client_id: string
          created_at: string
          days_absent: number
          hours_worked: number
          id: string
          linked_timesheet_id: string | null
          raw_row_id: string | null
          service_period_end: string
          service_period_start: string
          source_file_id: string
          trade: string | null
          worker_code: string | null
          worker_name_raw: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          days_absent?: number
          hours_worked?: number
          id?: string
          linked_timesheet_id?: string | null
          raw_row_id?: string | null
          service_period_end: string
          service_period_start: string
          source_file_id: string
          trade?: string | null
          worker_code?: string | null
          worker_name_raw?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          days_absent?: number
          hours_worked?: number
          id?: string
          linked_timesheet_id?: string | null
          raw_row_id?: string | null
          service_period_end?: string
          service_period_start?: string
          source_file_id?: string
          trade?: string | null
          worker_code?: string | null
          worker_name_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_normalized_rows_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_normalized_rows_linked_timesheet_id_fkey"
            columns: ["linked_timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_normalized_rows_raw_row_id_fkey"
            columns: ["raw_row_id"]
            isOneToOne: false
            referencedRelation: "timesheet_raw_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_normalized_rows_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "timesheet_source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_raw_rows: {
        Row: {
          id: string
          ingested_at: string
          raw_data: Json
          row_number: number
          source_file_id: string
        }
        Insert: {
          id?: string
          ingested_at?: string
          raw_data: Json
          row_number: number
          source_file_id: string
        }
        Update: {
          id?: string
          ingested_at?: string
          raw_data?: Json
          row_number?: number
          source_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_raw_rows_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "timesheet_source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_source_files: {
        Row: {
          client_id: string
          extraction_confidence: number | null
          extraction_engine: string | null
          file_name: string
          file_type: Database["public"]["Enums"]["file_type"]
          id: string
          parse_warnings: Json
          parser_template_id: string | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status: Database["public"]["Enums"]["source_file_status"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          extraction_confidence?: number | null
          extraction_engine?: string | null
          file_name: string
          file_type: Database["public"]["Enums"]["file_type"]
          id?: string
          parse_warnings?: Json
          parser_template_id?: string | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["source_file_status"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          extraction_confidence?: number | null
          extraction_engine?: string | null
          file_name?: string
          file_type?: Database["public"]["Enums"]["file_type"]
          id?: string
          parse_warnings?: Json
          parser_template_id?: string | null
          staffing_company?: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["source_file_status"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_source_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_source_files_parser_template_id_fkey"
            columns: ["parser_template_id"]
            isOneToOne: false
            referencedRelation: "parser_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_source_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          absence_penalty_amount: number
          attention_reason:
            | Database["public"]["Enums"]["attention_reason"]
            | null
          bonus_amount: number
          carried_forward_amount: number
          client_charge_amount: number | null
          client_charge_rate_aed_per_hour: number | null
          client_id: string | null
          created_at: string
          days_absent: number
          gross_salary: number | null
          hours_worked: number
          id: string
          import_batch_id: string | null
          needs_attention: boolean
          net_salary: number | null
          pay_rate_aed_per_hour: number | null
          profit_amount: number | null
          reporting_period_end: string
          reporting_period_start: string
          service_period_end: string
          service_period_start: string
          source_file_id: string | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status: Database["public"]["Enums"]["timesheet_status"]
          trade: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          absence_penalty_amount?: number
          attention_reason?:
            | Database["public"]["Enums"]["attention_reason"]
            | null
          bonus_amount?: number
          carried_forward_amount?: number
          client_charge_amount?: number | null
          client_charge_rate_aed_per_hour?: number | null
          client_id?: string | null
          created_at?: string
          days_absent?: number
          gross_salary?: number | null
          hours_worked?: number
          id?: string
          import_batch_id?: string | null
          needs_attention?: boolean
          net_salary?: number | null
          pay_rate_aed_per_hour?: number | null
          profit_amount?: number | null
          reporting_period_end: string
          reporting_period_start: string
          service_period_end: string
          service_period_start: string
          source_file_id?: string | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["timesheet_status"]
          trade?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          absence_penalty_amount?: number
          attention_reason?:
            | Database["public"]["Enums"]["attention_reason"]
            | null
          bonus_amount?: number
          carried_forward_amount?: number
          client_charge_amount?: number | null
          client_charge_rate_aed_per_hour?: number | null
          client_id?: string | null
          created_at?: string
          days_absent?: number
          gross_salary?: number | null
          hours_worked?: number
          id?: string
          import_batch_id?: string | null
          needs_attention?: boolean
          net_salary?: number | null
          pay_rate_aed_per_hour?: number | null
          profit_amount?: number | null
          reporting_period_end?: string
          reporting_period_start?: string
          service_period_end?: string
          service_period_start?: string
          source_file_id?: string | null
          staffing_company?: Database["public"]["Enums"]["staffing_company"]
          status?: Database["public"]["Enums"]["timesheet_status"]
          trade?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "timesheet_source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      worker_name_aliases: {
        Row: {
          alias_name: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          worker_code: string
        }
        Insert: {
          alias_name: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          worker_code: string
        }
        Update: {
          alias_name?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          worker_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_name_aliases_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_name_aliases_worker_code_fkey"
            columns: ["worker_code"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["worker_code"]
          },
        ]
      }
      workers: {
        Row: {
          camp_boss_name: string | null
          camp_contact: string | null
          camp_location: string | null
          check_in_at_work: string | null
          city_location: string | null
          contract_type: string | null
          created_at: string
          date_of_birth: string | null
          date_of_entry: string | null
          eid_status: string | null
          emirates_id: string | null
          finger_print_date: string | null
          full_name: string
          id: string
          iloe_insurance: string | null
          iloe_payment_date: string | null
          job_title_govt: string | null
          labor_camp_name: string | null
          labour_card_expiry_date: string | null
          labour_card_issue_date: string | null
          labour_card_no: string | null
          medical_report: string | null
          nationality: string | null
          overtime_rate: number | null
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_number: string | null
          passport_status: string | null
          pay_rate_aed_per_hour: number | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          stamping_status: string | null
          status: Database["public"]["Enums"]["worker_status"]
          tawjeeh_status: string | null
          trade: string | null
          updated_at: string
          visa_id_expiry: string | null
          visa_issue_date: string | null
          worker_code: string
          worker_phone: string | null
        }
        Insert: {
          camp_boss_name?: string | null
          camp_contact?: string | null
          camp_location?: string | null
          check_in_at_work?: string | null
          city_location?: string | null
          contract_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_entry?: string | null
          eid_status?: string | null
          emirates_id?: string | null
          finger_print_date?: string | null
          full_name: string
          id?: string
          iloe_insurance?: string | null
          iloe_payment_date?: string | null
          job_title_govt?: string | null
          labor_camp_name?: string | null
          labour_card_expiry_date?: string | null
          labour_card_issue_date?: string | null
          labour_card_no?: string | null
          medical_report?: string | null
          nationality?: string | null
          overtime_rate?: number | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          passport_status?: string | null
          pay_rate_aed_per_hour?: number | null
          staffing_company: Database["public"]["Enums"]["staffing_company"]
          stamping_status?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          tawjeeh_status?: string | null
          trade?: string | null
          updated_at?: string
          visa_id_expiry?: string | null
          visa_issue_date?: string | null
          worker_code: string
          worker_phone?: string | null
        }
        Update: {
          camp_boss_name?: string | null
          camp_contact?: string | null
          camp_location?: string | null
          check_in_at_work?: string | null
          city_location?: string | null
          contract_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_entry?: string | null
          eid_status?: string | null
          emirates_id?: string | null
          finger_print_date?: string | null
          full_name?: string
          id?: string
          iloe_insurance?: string | null
          iloe_payment_date?: string | null
          job_title_govt?: string | null
          labor_camp_name?: string | null
          labour_card_expiry_date?: string | null
          labour_card_issue_date?: string | null
          labour_card_no?: string | null
          medical_report?: string | null
          nationality?: string | null
          overtime_rate?: number | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          passport_status?: string | null
          pay_rate_aed_per_hour?: number | null
          staffing_company?: Database["public"]["Enums"]["staffing_company"]
          stamping_status?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          tawjeeh_status?: string | null
          trade?: string | null
          updated_at?: string
          visa_id_expiry?: string | null
          visa_issue_date?: string | null
          worker_code?: string
          worker_phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_absence_penalty: {
        Args: { p_days: number; p_rule_set_id?: string }
        Returns: number
      }
    }
    Enums: {
      adjustment_reason_code:
        | "late_client_submission"
        | "manual_correction"
        | "rate_backfill"
      aggregation_status: "draft" | "finalized" | "paid"
      attention_reason:
        | "worker_unmatched"
        | "duplicate_worker_name"
        | "missing_pay_rate"
        | "missing_charge_rate"
        | "charge_rate_ambiguous"
        | "missing_trade_for_charge_rate"
        | "penalty_exceeds_gross"
        | "late_submission"
        | "missing_client_lookup"
      audit_action: "insert" | "update" | "delete"
      file_type: "csv" | "xlsx" | "pdf"
      pending_field_status: "pending" | "mapped" | "ignored"
      period_inference_rule:
        | "single_date_as_start_and_end"
        | "explicit_start_end_columns"
        | "default_full_calendar_month"
      shift_type: "day" | "night"
      source_file_status: "pending" | "parsed" | "failed"
      staffing_company: "AH" | "SAH"
      timesheet_status: "draft" | "submitted" | "approved" | "paid"
      user_role: "staff" | "admin"
      worker_status: "active" | "inactive"
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
      adjustment_reason_code: [
        "late_client_submission",
        "manual_correction",
        "rate_backfill",
      ],
      aggregation_status: ["draft", "finalized", "paid"],
      attention_reason: [
        "worker_unmatched",
        "duplicate_worker_name",
        "missing_pay_rate",
        "missing_charge_rate",
        "charge_rate_ambiguous",
        "missing_trade_for_charge_rate",
        "penalty_exceeds_gross",
        "late_submission",
        "missing_client_lookup",
      ],
      audit_action: ["insert", "update", "delete"],
      file_type: ["csv", "xlsx", "pdf"],
      pending_field_status: ["pending", "mapped", "ignored"],
      period_inference_rule: [
        "single_date_as_start_and_end",
        "explicit_start_end_columns",
        "default_full_calendar_month",
      ],
      shift_type: ["day", "night"],
      source_file_status: ["pending", "parsed", "failed"],
      staffing_company: ["AH", "SAH"],
      timesheet_status: ["draft", "submitted", "approved", "paid"],
      user_role: ["staff", "admin"],
      worker_status: ["active", "inactive"],
    },
  },
} as const
