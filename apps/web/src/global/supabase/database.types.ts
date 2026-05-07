export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      coupons: {
        Row: {
          archived_at: string | null;
          code: string;
          created_at: string;
          discount_percent: number | null;
          discount_type: string;
          discount_value_cents: number | null;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          product_keys: string[] | null;
          starts_at: string | null;
          updated_at: string;
          usage_count: number;
          usage_limit: number | null;
        };
        Insert: {
          archived_at?: string | null;
          code: string;
          created_at?: string;
          discount_percent?: number | null;
          discount_type: string;
          discount_value_cents?: number | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          product_keys?: string[] | null;
          starts_at?: string | null;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
        };
        Update: {
          archived_at?: string | null;
          code?: string;
          created_at?: string;
          discount_percent?: number | null;
          discount_type?: string;
          discount_value_cents?: number | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          product_keys?: string[] | null;
          starts_at?: string | null;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          default_invoice_data: Json | null;
          default_shipping_address: Json;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          default_invoice_data?: Json | null;
          default_shipping_address?: Json;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          default_invoice_data?: Json | null;
          default_shipping_address?: Json;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_cancellation_requests: {
        Row: {
          admin_note: string | null;
          created_at: string;
          customer_email: string;
          customer_message: string | null;
          id: string;
          order_id: string;
          reason: string | null;
          requested_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          customer_email: string;
          customer_message?: string | null;
          id?: string;
          order_id: string;
          reason?: string | null;
          requested_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          customer_email?: string;
          customer_message?: string | null;
          id?: string;
          order_id?: string;
          reason?: string | null;
          requested_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_cancellation_requests_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          brand_name: string;
          created_at: string;
          id: string;
          is_returnable: boolean;
          item_snapshot: Json;
          line_discount_total_cents: number;
          line_position: number;
          line_subtotal_cents: number;
          line_total_cents: number;
          line_type: string;
          order_id: string;
          product_key: string;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          updated_at: string;
        };
        Insert: {
          brand_name: string;
          created_at?: string;
          id?: string;
          is_returnable?: boolean;
          item_snapshot?: Json;
          line_discount_total_cents?: number;
          line_position: number;
          line_subtotal_cents: number;
          line_total_cents: number;
          line_type: string;
          order_id: string;
          product_key: string;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          updated_at?: string;
        };
        Update: {
          brand_name?: string;
          created_at?: string;
          id?: string;
          is_returnable?: boolean;
          item_snapshot?: Json;
          line_discount_total_cents?: number;
          line_position?: number;
          line_subtotal_cents?: number;
          line_total_cents?: number;
          line_type?: string;
          order_id?: string;
          product_key?: string;
          product_name?: string;
          quantity?: number;
          unit_price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          current_status: string;
          customer_email: string;
          customer_profile_id: string | null;
          customer_snapshot: Json;
          discount_total_cents: number;
          grand_total_cents: number;
          id: string;
          invoice_data: Json | null;
          order_number: string;
          paid_at: string | null;
          payable_until: string;
          payment_provider: string;
          payment_reference: string | null;
          payment_verified_at: string | null;
          profile_persistence: Json | null;
          returned_at: string | null;
          shipment_data: Json | null;
          shipped_at: string | null;
          shipping_address_snapshot: Json;
          status_history: Json;
          subtotal_cents: number;
          updated_at: string;
          used_discount: Json | null;
        };
        Insert: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_status: string;
          customer_email: string;
          customer_profile_id?: string | null;
          customer_snapshot: Json;
          discount_total_cents?: number;
          grand_total_cents: number;
          id?: string;
          invoice_data?: Json | null;
          order_number: string;
          paid_at?: string | null;
          payable_until: string;
          payment_provider?: string;
          payment_reference?: string | null;
          payment_verified_at?: string | null;
          profile_persistence?: Json | null;
          returned_at?: string | null;
          shipment_data?: Json | null;
          shipped_at?: string | null;
          shipping_address_snapshot: Json;
          status_history?: Json;
          subtotal_cents: number;
          updated_at?: string;
          used_discount?: Json | null;
        };
        Update: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_status?: string;
          customer_email?: string;
          customer_profile_id?: string | null;
          customer_snapshot?: Json;
          discount_total_cents?: number;
          grand_total_cents?: number;
          id?: string;
          invoice_data?: Json | null;
          order_number?: string;
          paid_at?: string | null;
          payable_until?: string;
          payment_provider?: string;
          payment_reference?: string | null;
          payment_verified_at?: string | null;
          profile_persistence?: Json | null;
          returned_at?: string | null;
          shipment_data?: Json | null;
          shipped_at?: string | null;
          shipping_address_snapshot?: Json;
          status_history?: Json;
          subtotal_cents?: number;
          updated_at?: string;
          used_discount?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_profile_id_fkey';
            columns: ['customer_profile_id'];
            isOneToOne: false;
            referencedRelation: 'customer_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pricing_numeric_rules: {
        Row: {
          base_included_value: number;
          created_at: string;
          group_id: string;
          id: string;
          max_value: number;
          min_value: number;
          price_per_step_cents: number;
          step_value: number;
          updated_at: string;
          value_id: string | null;
        };
        Insert: {
          base_included_value?: number;
          created_at?: string;
          group_id: string;
          id?: string;
          max_value: number;
          min_value: number;
          price_per_step_cents?: number;
          step_value: number;
          updated_at?: string;
          value_id?: string | null;
        };
        Update: {
          base_included_value?: number;
          created_at?: string;
          group_id?: string;
          id?: string;
          max_value?: number;
          min_value?: number;
          price_per_step_cents?: number;
          step_value?: number;
          updated_at?: string;
          value_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_numeric_rules_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_option_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_numeric_rules_value_id_fkey';
            columns: ['value_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_option_values';
            referencedColumns: ['id'];
          },
        ];
      };
      pricing_option_groups: {
        Row: {
          created_at: string;
          id: string;
          input_type: string;
          name: string;
          parent_value_id: string | null;
          position: number;
          required: boolean;
          unit: string | null;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input_type: string;
          name?: string;
          parent_value_id?: string | null;
          position?: number;
          required?: boolean;
          unit?: string | null;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_type?: string;
          name?: string;
          parent_value_id?: string | null;
          position?: number;
          required?: boolean;
          unit?: string | null;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_option_groups_parent_value_id_fkey';
            columns: ['parent_value_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_option_values';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_option_groups_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      pricing_option_values: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          name: string | null;
          position: number;
          price_delta_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          name?: string | null;
          position?: number;
          price_delta_cents?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string | null;
          position?: number;
          price_delta_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_option_values_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'pricing_option_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      pricing_variants: {
        Row: {
          base_price_cents: number;
          brand: string;
          created_at: string;
          currency: string;
          id: string;
          model: string | null;
          position: number;
          price_key: string;
          product: string;
          updated_at: string;
        };
        Insert: {
          base_price_cents: number;
          brand: string;
          created_at?: string;
          currency?: string;
          id?: string;
          model?: string | null;
          position?: number;
          price_key: string;
          product: string;
          updated_at?: string;
        };
        Update: {
          base_price_cents?: number;
          brand?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          model?: string | null;
          position?: number;
          price_key?: string;
          product?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      return_cases: {
        Row: {
          closed_at: string | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          order_id: string;
          reason: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          closed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          reason?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          reason?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'return_cases_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_accept_order_cancellation: {
        Args: {
          p_actor: Json;
          p_admin_note: string | null;
          p_order_number: string;
          p_request_id: string;
          p_resolved_at: string;
          p_resolved_by: string | null;
        };
        Returns: Json;
      };
      admin_complete_order_return_case: {
        Args: {
          p_actor: Json;
          p_admin_note: string | null;
          p_completed_at: string;
          p_order_number: string;
          p_return_case_id: string;
        };
        Returns: Json;
      };
      ingest_pricing_json: {
        Args: { p_mode: string; p_variants: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
