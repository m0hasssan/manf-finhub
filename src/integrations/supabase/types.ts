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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          exchange_rate: number
          id: string
          is_active: boolean
          level: number
          name: string
          opening_balance: number
          opening_balance_credit: number
          opening_balance_debit: number
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          level: number
          name: string
          opening_balance?: number
          opening_balance_credit?: number
          opening_balance_debit?: number
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          opening_balance?: number
          opening_balance_credit?: number
          opening_balance_debit?: number
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      action_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string | null
          account_number: string
          bank_name: string
          branch: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_balance: number | null
          id: string
          is_active: boolean
          name: string
          opening_balance: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_number: string
          bank_name: string
          branch?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_number?: string
          bank_name?: string
          branch?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          description: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          payment_method: string | null
          reference: string
          supplier_id: string | null
          type: Database["public"]["Enums"]["cash_transaction_type"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          description: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string | null
          reference: string
          supplier_id?: string | null
          type: Database["public"]["Enums"]["cash_transaction_type"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          description?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string | null
          reference?: string
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["cash_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cash_txn_journal"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      checks: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          due_date: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          party_name: string
          status: Database["public"]["Enums"]["check_status"]
          supplier_id: string | null
          type: Database["public"]["Enums"]["check_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          due_date: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          number: string
          party_name: string
          status?: Database["public"]["Enums"]["check_status"]
          supplier_id?: string | null
          type: Database["public"]["Enums"]["check_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          due_date?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          number?: string
          party_name?: string
          status?: Database["public"]["Enums"]["check_status"]
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["check_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checks_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_check_journal"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      custodies: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          date: string
          department: string | null
          employee_id: string | null
          employee_name: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          purpose: string
          remaining_amount: number
          settled_amount: number
          status: Database["public"]["Enums"]["custody_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          department?: string | null
          employee_id?: string | null
          employee_name: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          number: string
          purpose: string
          remaining_amount: number
          settled_amount?: number
          status?: Database["public"]["Enums"]["custody_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          department?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          number?: string
          purpose?: string
          remaining_amount?: number
          settled_amount?: number
          status?: Database["public"]["Enums"]["custody_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_custody_journal"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_settlements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          custody_id: string
          date: string
          description: string
          id: string
          journal_entry_id: string | null
          receipt_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          custody_id: string
          date?: string
          description: string
          id?: string
          journal_entry_id?: string | null
          receipt_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          custody_id?: string
          date?: string
          description?: string
          id?: string
          journal_entry_id?: string | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_settlements_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_settlement_journal"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_id: string | null
          code: string
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          is_active: boolean
          job_title: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_work_order_inputs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          item_id: string | null
          karat: number | null
          pure_gold_weight: number
          total_cost: number
          unit_price: number
          weight: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          item_id?: string | null
          karat?: number | null
          pure_gold_weight?: number
          total_cost?: number
          unit_price?: number
          weight?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          item_id?: string | null
          karat?: number | null
          pure_gold_weight?: number
          total_cost?: number
          unit_price?: number
          weight?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gold_work_order_inputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_work_order_inputs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "gold_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_work_order_outputs: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          karat: number
          product_name: string
          pure_gold_weight: number
          quantity: number
          total_cost: number
          unit_cost: number
          weight: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          karat?: number
          product_name: string
          pure_gold_weight?: number
          quantity?: number
          total_cost?: number
          unit_cost?: number
          weight?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          karat?: number
          product_name?: string
          pure_gold_weight?: number
          quantity?: number
          total_cost?: number
          unit_cost?: number
          weight?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gold_work_order_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_work_order_outputs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "gold_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_work_order_stages: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          input_weight: number
          labor_cost: number
          loss_weight: number
          notes: string | null
          output_weight: number
          stage_name: string
          stage_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["stage_status"]
          work_order_id: string
          worker_name: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          input_weight?: number
          labor_cost?: number
          loss_weight?: number
          notes?: string | null
          output_weight?: number
          stage_name: string
          stage_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          work_order_id: string
          worker_name?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          input_weight?: number
          labor_cost?: number
          loss_weight?: number
          notes?: string | null
          output_weight?: number
          stage_name?: string
          stage_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          work_order_id?: string
          worker_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gold_work_order_stages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "gold_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_work_orders: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          gold_price_per_gram: number
          id: string
          journal_entry_id: string | null
          labor_cost: number
          loss_percentage: number
          material_cost: number
          notes: string | null
          number: string
          overhead_cost: number
          product_name: string
          status: Database["public"]["Enums"]["work_order_status"]
          target_karat: number
          total_cost: number
          total_gold_input_weight: number
          total_loss_weight: number
          total_output_weight: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          gold_price_per_gram?: number
          id?: string
          journal_entry_id?: string | null
          labor_cost?: number
          loss_percentage?: number
          material_cost?: number
          notes?: string | null
          number: string
          overhead_cost?: number
          product_name: string
          status?: Database["public"]["Enums"]["work_order_status"]
          target_karat?: number
          total_cost?: number
          total_gold_input_weight?: number
          total_loss_weight?: number
          total_output_weight?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          gold_price_per_gram?: number
          id?: string
          journal_entry_id?: string | null
          labor_cost?: number
          loss_percentage?: number
          material_cost?: number
          notes?: string | null
          number?: string
          overhead_cost?: number
          product_name?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          target_karat?: number
          total_cost?: number
          total_gold_input_weight?: number
          total_loss_weight?: number
          total_output_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gold_work_orders_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          account_id: string | null
          category: string | null
          code: string
          cost_price: number | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          id: string
          is_active: boolean
          min_stock: number | null
          name: string
          opening_stock: number | null
          sell_price: number | null
          unit: string
          updated_at: string
          warehouse: string | null
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          code: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          id?: string
          is_active?: boolean
          min_stock?: number | null
          name: string
          opening_stock?: number | null
          sell_price?: number | null
          unit?: string
          updated_at?: string
          warehouse?: string | null
        }
        Update: {
          account_id?: string | null
          category?: string | null
          code?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          id?: string
          is_active?: boolean
          min_stock?: number | null
          name?: string
          opening_stock?: number | null
          sell_price?: number | null
          unit?: string
          updated_at?: string
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          item_id: string
          journal_entry_id: string | null
          notes: string | null
          quantity: number
          reference: string
          supplier_id: string | null
          total: number
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number
          warehouse: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id: string
          journal_entry_id?: string | null
          notes?: string | null
          quantity: number
          reference: string
          supplier_id?: string | null
          total: number
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number
          warehouse?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id?: string
          journal_entry_id?: string | null
          notes?: string | null
          quantity?: number
          reference?: string
          supplier_id?: string | null
          total?: number
          type?: Database["public"]["Enums"]["movement_type"]
          unit_price?: number
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_mov_journal"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_request_lines: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          request_id: string
          total: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          request_id: string
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          request_id?: string
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "inventory_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_requests: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          item_id: string
          notes: string | null
          number: string
          quantity: number
          status: string
          supplier_id: string | null
          total: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number | null
          updated_at: string
          warehouse: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id: string
          notes?: string | null
          number: string
          quantity: number
          status?: string
          supplier_id?: string | null
          total?: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          updated_at?: string
          warehouse?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          item_id?: string
          notes?: string | null
          number?: string
          quantity?: number
          status?: string
          supplier_id?: string | null
          total?: number | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          updated_at?: string
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          exchange_rate: number
          id: string
          notes: string | null
          number: string
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          number: string
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          number?: string
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          force_password_change: boolean
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          force_password_change?: boolean
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          force_password_change?: boolean
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_invoice_lines: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          discount: number
          exchange_rate: number
          id: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          discount: number
          exchange_rate: number
          id: string
          notes: string | null
          number: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "admin" | "accountant" | "viewer" | "customized"
      cash_transaction_type: "receipt" | "payment"
      check_status: "pending" | "collected" | "bounced" | "cashed" | "endorsed"
      check_type: "received" | "issued"
      custody_status: "active" | "partial" | "settled"
      input_type: "gold_raw" | "stones" | "other"
      journal_status: "draft" | "posted" | "void"
      movement_type: "in" | "out"
      stage_status: "pending" | "in_progress" | "completed"
      work_order_status: "draft" | "in_progress" | "completed" | "cancelled"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["admin", "accountant", "viewer", "customized"],
      cash_transaction_type: ["receipt", "payment"],
      check_status: ["pending", "collected", "bounced", "cashed", "endorsed"],
      check_type: ["received", "issued"],
      custody_status: ["active", "partial", "settled"],
      input_type: ["gold_raw", "stones", "other"],
      journal_status: ["draft", "posted", "void"],
      movement_type: ["in", "out"],
      stage_status: ["pending", "in_progress", "completed"],
      work_order_status: ["draft", "in_progress", "completed", "cancelled"],
    },
  },
} as const
