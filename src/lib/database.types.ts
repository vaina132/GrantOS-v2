export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          currency: string
          working_hours_per_day: number
          working_days_per_year: number
          default_overhead_rate: number
          average_personnel_rate_pm: number
          departments: Json
          timesheets_drive_allocations: boolean
          plan: string
          trial_ends_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          currency?: string
          working_hours_per_day?: number
          working_days_per_year?: number
          default_overhead_rate?: number
          average_personnel_rate_pm?: number
          departments?: Json
          timesheets_drive_allocations?: boolean
          plan?: string
          trial_ends_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          currency?: string
          working_hours_per_day?: number
          working_days_per_year?: number
          default_overhead_rate?: number
          average_personnel_rate_pm?: number
          departments?: Json
          timesheets_drive_allocations?: boolean
          plan?: string
          trial_ends_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role: string
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          role: string
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          role?: string
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'org_members_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          org_id: string
          role: string
          can_see_dashboard: boolean
          can_see_projects: boolean
          can_see_staff: boolean
          can_see_allocations: boolean
          can_see_timesheets: boolean
          can_see_absences: boolean
          can_see_financials: boolean
          can_see_timeline: boolean
          can_see_reports: boolean
          can_see_import: boolean
          can_see_audit: boolean
          can_see_guests: boolean
          can_see_salary_info: boolean
          can_see_financial_details: boolean
          can_see_personnel_rates: boolean
          can_edit_projects: boolean
          can_edit_allocations: boolean
          can_approve_timesheets: boolean
          can_submit_timesheets: boolean
          can_manage_budgets: boolean
          can_generate_reports: boolean
          can_manage_users: boolean
          can_manage_org: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          role: string
          can_see_dashboard?: boolean
          can_see_projects?: boolean
          can_see_staff?: boolean
          can_see_allocations?: boolean
          can_see_timesheets?: boolean
          can_see_absences?: boolean
          can_see_financials?: boolean
          can_see_timeline?: boolean
          can_see_reports?: boolean
          can_see_import?: boolean
          can_see_audit?: boolean
          can_see_guests?: boolean
          can_see_salary_info?: boolean
          can_see_financial_details?: boolean
          can_see_personnel_rates?: boolean
          can_edit_projects?: boolean
          can_edit_allocations?: boolean
          can_approve_timesheets?: boolean
          can_submit_timesheets?: boolean
          can_manage_budgets?: boolean
          can_generate_reports?: boolean
          can_manage_users?: boolean
          can_manage_org?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: string
          can_see_dashboard?: boolean
          can_see_projects?: boolean
          can_see_staff?: boolean
          can_see_allocations?: boolean
          can_see_timesheets?: boolean
          can_see_absences?: boolean
          can_see_financials?: boolean
          can_see_timeline?: boolean
          can_see_reports?: boolean
          can_see_import?: boolean
          can_see_audit?: boolean
          can_see_guests?: boolean
          can_see_salary_info?: boolean
          can_see_financial_details?: boolean
          can_see_personnel_rates?: boolean
          can_edit_projects?: boolean
          can_edit_allocations?: boolean
          can_approve_timesheets?: boolean
          can_submit_timesheets?: boolean
          can_manage_budgets?: boolean
          can_generate_reports?: boolean
          can_manage_users?: boolean
          can_manage_org?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      project_guests: {
        Row: {
          id: string
          org_id: string
          project_id: string
          user_id: string
          invited_by: string | null
          access_level: string
          is_active: boolean
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          user_id: string
          invited_by?: string | null
          access_level?: string
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          user_id?: string
          invited_by?: string | null
          access_level?: string
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_guests_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_guests_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      funding_schemes: {
        Row: {
          id: string
          org_id: string
          name: string
          type: string
          overhead_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          type?: string
          overhead_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          type?: string
          overhead_rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'funding_schemes_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      persons: {
        Row: {
          id: string
          org_id: string
          full_name: string
          email: string | null
          department: string | null
          role: string | null
          employment_type: string
          fte: number
          start_date: string | null
          end_date: string | null
          annual_salary: number | null
          overhead_rate: number | null
          country: string | null
          is_active: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          full_name: string
          email?: string | null
          department?: string | null
          role?: string | null
          employment_type?: string
          fte?: number
          start_date?: string | null
          end_date?: string | null
          annual_salary?: number | null
          overhead_rate?: number | null
          country?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          full_name?: string
          email?: string | null
          department?: string | null
          role?: string | null
          employment_type?: string
          fte?: number
          start_date?: string | null
          end_date?: string | null
          annual_salary?: number | null
          overhead_rate?: number | null
          country?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'persons_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          org_id: string
          acronym: string
          title: string
          funding_scheme_id: string | null
          grant_number: string | null
          status: string
          start_date: string
          end_date: string
          total_budget: number | null
          overhead_rate: number | null
          has_wps: boolean
          is_lead_organisation: boolean
          our_pm_rate: number | null
          budget_personnel: number | null
          budget_travel: number | null
          budget_subcontracting: number | null
          budget_other: number | null
          responsible_person_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          acronym: string
          title: string
          funding_scheme_id?: string | null
          grant_number?: string | null
          status?: string
          start_date: string
          end_date: string
          total_budget?: number | null
          overhead_rate?: number | null
          has_wps?: boolean
          is_lead_organisation?: boolean
          our_pm_rate?: number | null
          budget_personnel?: number | null
          budget_travel?: number | null
          budget_subcontracting?: number | null
          budget_other?: number | null
          responsible_person_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          acronym?: string
          title?: string
          funding_scheme_id?: string | null
          grant_number?: string | null
          status?: string
          start_date?: string
          end_date?: string
          total_budget?: number | null
          overhead_rate?: number | null
          has_wps?: boolean
          is_lead_organisation?: boolean
          our_pm_rate?: number | null
          budget_personnel?: number | null
          budget_travel?: number | null
          budget_subcontracting?: number | null
          budget_other?: number | null
          responsible_person_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_funding_scheme_id_fkey'
            columns: ['funding_scheme_id']
            isOneToOne: false
            referencedRelation: 'funding_schemes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_responsible_person_id_fkey'
            columns: ['responsible_person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
        ]
      }
      work_packages: {
        Row: {
          id: string
          org_id: string
          project_id: string
          number: number | null
          name: string
          description: string | null
          lead_person_id: string | null
          start_month: number | null
          end_month: number | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          number?: number | null
          name: string
          description?: string | null
          lead_person_id?: string | null
          start_month?: number | null
          end_month?: number | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          number?: number | null
          name?: string
          description?: string | null
          lead_person_id?: string | null
          start_month?: number | null
          end_month?: number | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'work_packages_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'work_packages_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      assignments: {
        Row: {
          id: string
          org_id: string
          person_id: string
          project_id: string
          work_package_id: string | null
          year: number
          month: number
          pms: number
          type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          person_id: string
          project_id: string
          work_package_id?: string | null
          year: number
          month: number
          pms?: number
          type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          person_id?: string
          project_id?: string
          work_package_id?: string | null
          year?: number
          month?: number
          pms?: number
          type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assignments_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assignments_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assignments_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      pm_budgets: {
        Row: {
          id: string
          org_id: string
          project_id: string
          work_package_id: string | null
          year: number
          target_pms: number
          type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          work_package_id?: string | null
          year: number
          target_pms?: number
          type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          work_package_id?: string | null
          year?: number
          target_pms?: number
          type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pm_budgets_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pm_budgets_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      absences: {
        Row: {
          id: string
          org_id: string
          person_id: string
          type: string
          start_date: string | null
          end_date: string | null
          days: number | null
          notes: string | null
          date: string | null
          period: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          person_id: string
          type: string
          start_date?: string | null
          end_date?: string | null
          days?: number | null
          notes?: string | null
          date?: string | null
          period?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          person_id?: string
          type?: string
          start_date?: string | null
          end_date?: string | null
          days?: number | null
          notes?: string | null
          date?: string | null
          period?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'absences_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'absences_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
        ]
      }
      timesheet_entries: {
        Row: {
          id: string
          org_id: string
          person_id: string
          project_id: string
          work_package_id: string | null
          year: number
          month: number
          hours: number | null
          planned_percentage: number | null
          confirmed_percentage: number | null
          planned_hours: number | null
          actual_hours: number | null
          working_days: number | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          approved_at: string | null
          approved_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          person_id: string
          project_id: string
          work_package_id?: string | null
          year: number
          month: number
          hours?: number | null
          planned_percentage?: number | null
          confirmed_percentage?: number | null
          planned_hours?: number | null
          actual_hours?: number | null
          working_days?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          person_id?: string
          project_id?: string
          work_package_id?: string | null
          year?: number
          month?: number
          hours?: number | null
          planned_percentage?: number | null
          confirmed_percentage?: number | null
          planned_hours?: number | null
          actual_hours?: number | null
          working_days?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'timesheet_entries_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'timesheet_entries_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'timesheet_entries_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      financial_budgets: {
        Row: {
          id: string
          org_id: string
          project_id: string
          category: string
          year: number
          budgeted: number
          actual: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          category: string
          year: number
          budgeted?: number
          actual?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          category?: string
          year?: number
          budgeted?: number
          actual?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'financial_budgets_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'financial_budgets_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_expenses: {
        Row: {
          id: string
          org_id: string
          project_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          vendor: string | null
          reference: string | null
          person_id: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          vendor?: string | null
          reference?: string | null
          person_id?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          vendor?: string | null
          reference?: string | null
          person_id?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_expenses_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_expenses_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_expenses_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
        ]
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          org_id: string
          display_name: string | null
          email_timesheet_reminders: boolean
          email_timesheet_submitted: boolean
          email_project_alerts: boolean
          email_budget_alerts: boolean
          email_period_locked: boolean
          email_role_changes: boolean
          email_invitations: boolean
          email_welcome: boolean
          email_trial_expiring: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          display_name?: string | null
          email_timesheet_reminders?: boolean
          email_timesheet_submitted?: boolean
          email_project_alerts?: boolean
          email_budget_alerts?: boolean
          email_period_locked?: boolean
          email_role_changes?: boolean
          email_invitations?: boolean
          email_welcome?: boolean
          email_trial_expiring?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          display_name?: string | null
          email_timesheet_reminders?: boolean
          email_timesheet_submitted?: boolean
          email_project_alerts?: boolean
          email_budget_alerts?: boolean
          email_period_locked?: boolean
          email_role_changes?: boolean
          email_invitations?: boolean
          email_welcome?: boolean
          email_trial_expiring?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_preferences_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      project_documents: {
        Row: {
          id: string
          org_id: string
          project_id: string
          title: string | null
          name: string | null
          document_type: string | null
          description: string | null
          file_name: string | null
          file_url: string | null
          file_size: string | null
          file_size_bytes: number | null
          uploaded_by: string | null
          uploaded_at: string | null
          valid_from: string | null
          valid_until: string | null
          tags: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          title?: string | null
          name?: string | null
          document_type?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          file_size?: string | null
          file_size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          tags?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          title?: string | null
          name?: string | null
          document_type?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          file_size?: string | null
          file_size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          tags?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_documents_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_documents_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          user_email: string | null
          entity_type: string | null
          action: string | null
          entity_id: string | null
          details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          user_email?: string | null
          entity_type?: string | null
          action?: string | null
          entity_id?: string | null
          details?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          user_email?: string | null
          entity_type?: string | null
          action?: string | null
          entity_id?: string | null
          details?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      audit_changes: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          entity_type: string | null
          entity_id: string | null
          field_name: string | null
          old_value: string | null
          new_value: string | null
          action: string | null
          changed_by_name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          action?: string | null
          changed_by_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          action?: string | null
          changed_by_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_changes_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      proposals: {
        Row: {
          id: string
          org_id: string
          project_name: string
          call_identifier: string
          funding_scheme: string
          submission_deadline: string | null
          expected_decision: string | null
          our_pms: number
          personnel_budget: number
          travel_budget: number
          subcontracting_budget: number
          other_budget: number
          status: string
          converted_project_id: string | null
          responsible_person_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_name: string
          call_identifier?: string
          funding_scheme?: string
          submission_deadline?: string | null
          expected_decision?: string | null
          our_pms?: number
          personnel_budget?: number
          travel_budget?: number
          subcontracting_budget?: number
          other_budget?: number
          status?: string
          converted_project_id?: string | null
          responsible_person_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_name?: string
          call_identifier?: string
          funding_scheme?: string
          submission_deadline?: string | null
          expected_decision?: string | null
          our_pms?: number
          personnel_budget?: number
          travel_budget?: number
          subcontracting_budget?: number
          other_budget?: number
          status?: string
          converted_project_id?: string | null
          responsible_person_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'proposals_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proposals_responsible_person_id_fkey'
            columns: ['responsible_person_id']
            isOneToOne: false
            referencedRelation: 'persons'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          org_id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      period_locks: {
        Row: {
          id: string
          org_id: string
          year: number
          month: number
          locked_by: string | null
          locked_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          year: number
          month: number
          locked_by?: string | null
          locked_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          year?: number
          month?: number
          locked_by?: string | null
          locked_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'period_locks_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      persons_masked: {
        Row: {
          id: string
          org_id: string
          full_name: string
          email: string | null
          department: string | null
          role: string | null
          employment_type: string
          fte: number
          start_date: string | null
          end_date: string | null
          annual_salary: number | null
          overhead_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      auth_org_id: {
        Args: Record<string, never>
        Returns: string
      }
      auth_org_role: {
        Args: Record<string, never>
        Returns: string
      }
      auth_is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      auth_is_finance: {
        Args: Record<string, never>
        Returns: boolean
      }
      auth_can_see_salary: {
        Args: Record<string, never>
        Returns: boolean
      }
      auth_guest_project_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      auth_org_is_active: {
        Args: Record<string, never>
        Returns: boolean
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
