// Base types from Supabase schema
export interface PricingVariant {
  id: string;
  price_key: string;
  brand: string;
  product: string;
  model: string | null;
  base_price_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PricingOptionGroup {
  id: string;
  variant_id: string;
  name: string;
  input_type: 'select' | 'numeric_step';
  unit: string | null;
  required: boolean;
  position: number;
  parent_value_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingOptionValue {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PricingNumericRule {
  id: string;
  group_id: string;
  value_id: string | null;
  min_value: number;
  max_value: number;
  step_value: number;
  price_per_step_cents: number;
  base_included_value: number;
  created_at: string;
  updated_at: string;
}

// Enhanced types with nested data
export interface PricingOptionGroupWithDetails extends PricingOptionGroup {
  values: PricingOptionValue[];
  numeric_rule: PricingNumericRule | null;
}

export interface PricingVariantWithOptions extends PricingVariant {
  groups: PricingOptionGroupWithDetails[];
}

export interface CompletePricingData {
  variants: PricingVariantWithOptions[];
  hasMultipleModels: boolean;
  lowestPrice: number;
}

// Frontend state types for user selections
export interface PricingSelection {
  variantId: string | null; // Selected model variant
  selectedOptions: Record<string, string>; // group_id -> value_id or numeric value
  calculatedPrice: number; // Final calculated price in cents
}
