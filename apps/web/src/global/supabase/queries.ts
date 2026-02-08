import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { createClient as createServerClient } from './server';
import type {
  CompletePricingData,
  PricingNumericRule,
  PricingOptionGroup,
  PricingOptionValue,
  PricingVariant,
  PricingVariantWithOptions,
} from './types';

// Type for the raw response from Supabase nested select query
type SupabaseVariantWithRelations = PricingVariant & {
  pricing_option_groups: (PricingOptionGroup & {
    pricing_option_values: PricingOptionValue[];
    pricing_numeric_rules: PricingNumericRule[];
  })[];
};

/**
 * Fetches all pricing data for a product by matching the product slug
 * to the price_key in Supabase.
 *
 * This function is designed to be called from Server Components.
 * Uses Next.js 16 Cache Components for performance and static generation.
 *
 * Optimized to use a single query with nested relationships instead of
 * multiple sequential queries (N+1 problem).
 *
 * @param productSlug - The product slug (e.g., "atmosphere-sx-ic")
 * @returns Complete pricing data with variants, groups, values, and rules
 */
export async function fetchProductPricing(
  productSlug: string,
): Promise<CompletePricingData | null> {
  'use cache';

  // Specific tag for this product's pricing + broad tag for type
  cacheTag('product-pricing', `product-pricing:${productSlug}`);

  if (process.env.NODE_ENV === 'development') {
    cacheLife('seconds');
  } else {
    cacheLife('weeks');
  }

  try {
    const supabase = createServerClient();

    // Single query with all nested relationships
    // This replaces multiple sequential queries with one efficient query
    // Note: We must specify the FK relationship explicitly because there are two:
    // - pricing_option_values.group_id -> pricing_option_groups.id (the one we want)
    // - pricing_option_groups.parent_value_id -> pricing_option_values.id (for conditional options)
    const { data, error } = await supabase
      .from('pricing_variants')
      .select(
        `
        *,
        pricing_option_groups (
          *,
          pricing_option_values!pricing_option_values_group_id_fkey (*),
          pricing_numeric_rules (*)
        )
      `,
      )
      .ilike('price_key', `%/${productSlug}`)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching pricing data:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`No pricing data found for product: ${productSlug}`);
      return null;
    }

    // Cast to our expected type (Supabase can't infer nested query types from string)
    const variants = data as unknown as SupabaseVariantWithRelations[];

    // Transform the nested data to match the existing types
    const variantsWithOptions: PricingVariantWithOptions[] = variants.map(
      (variant) => ({
        id: variant.id,
        price_key: variant.price_key,
        brand: variant.brand,
        product: variant.product,
        model: variant.model,
        base_price_cents: variant.base_price_cents,
        currency: variant.currency,
        created_at: variant.created_at,
        updated_at: variant.updated_at,
        groups: (variant.pricing_option_groups || [])
          .sort((a, b) => a.position - b.position)
          .map((group) => ({
            id: group.id,
            variant_id: group.variant_id,
            name: group.name,
            input_type: group.input_type,
            unit: group.unit,
            required: group.required,
            position: group.position,
            parent_value_id: group.parent_value_id,
            created_at: group.created_at,
            updated_at: group.updated_at,
            values: (group.pricing_option_values || []).sort(
              (a, b) => a.position - b.position,
            ),
            numeric_rule: group.pricing_numeric_rules?.[0] || null,
          })),
      }),
    );

    return {
      variants: variantsWithOptions,
      hasMultipleModels: variants.length > 1,
      // First variant is now the first model from Excel (ordered by position)
      lowestPrice: variants[0]?.base_price_cents || 0,
    };
  } catch (error) {
    console.error('Unexpected error in fetchProductPricing:', error);
    return null;
  }
}
