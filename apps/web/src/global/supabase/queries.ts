import type { PostgrestError } from '@supabase/supabase-js';

import { createClient as createServerClient } from './server';
import type {
  CompletePricingData,
  PricingOptionGroup,
  PricingOptionGroupWithDetails,
  PricingVariant,
  PricingVariantWithOptions,
} from './types';

/**
 * Fetches all pricing data for a product by matching the product slug
 * to the price_key in Supabase.
 *
 * This function is designed to be called from Server Components.
 * For Client Components, you'll need to create a separate function that uses the browser client.
 *
 * @param productSlug - The product slug (e.g., "atmosphere-sx-ic")
 * @returns Complete pricing data with variants, groups, values, and rules
 */
export async function fetchProductPricing(
  productSlug: string
): Promise<CompletePricingData | null> {
  try {
    // Create server client for this request
    const supabase = createServerClient();

    // Step 1: Find all variants for this product
    // Match by price_key ending with the product slug
    const {
      data: variants,
      error: variantsError,
    }: { data: PricingVariant[] | null; error: PostgrestError | null } =
      await supabase
        .from('pricing_variants')
        .select('*')
        .ilike('price_key', `%${productSlug}`)
        .order('base_price_cents', { ascending: true }); // Lowest price first

    if (variantsError) {
      console.error('Error fetching pricing variants:', variantsError);
      return null;
    }

    if (!variants || variants.length === 0) {
      console.warn(`No pricing data found for product: ${productSlug}`);
      return null;
    }

    // Step 2: For each variant, fetch option groups, values, and rules
    const variantsWithOptions: PricingVariantWithOptions[] = await Promise.all(
      variants.map(async (variant: PricingVariant) => {
        // Fetch option groups for this variant
        const { data: groups, error: groupsError } = await supabase
          .from('pricing_option_groups')
          .select('*')
          .eq('variant_id', variant.id)
          .order('position', { ascending: true });

        if (groupsError) {
          console.error('Error fetching option groups:', groupsError);
          return { ...variant, groups: [] };
        }

        // For each group, fetch values and numeric rules
        const groupsWithDetails: PricingOptionGroupWithDetails[] =
          await Promise.all(
            (groups || []).map(async (group: PricingOptionGroup) => {
              // Fetch values if it's a select group
              if (group.input_type === 'select') {
                const { data: values, error: valuesError } = await supabase
                  .from('pricing_option_values')
                  .select('*')
                  .eq('group_id', group.id)
                  .order('position', { ascending: true });

                if (valuesError) {
                  console.error('Error fetching option values:', valuesError);
                }

                return {
                  ...group,
                  values: values || [],
                  numeric_rule: null,
                };
              }

              // Fetch numeric rule if it's a numeric_step group
              if (group.input_type === 'numeric_step') {
                const { data: rule, error: ruleError } = await supabase
                  .from('pricing_numeric_rules')
                  .select('*')
                  .eq('group_id', group.id)
                  .limit(1)
                  .single();

                if (ruleError && ruleError.code !== 'PGRST116') {
                  // PGRST116 = not found, which is ok
                  console.error('Error fetching numeric rule:', ruleError);
                }

                return {
                  ...group,
                  values: [],
                  numeric_rule: rule || null,
                };
              }

              return {
                ...group,
                values: [],
                numeric_rule: null,
              };
            })
          );

        return {
          ...variant,
          groups: groupsWithDetails,
        };
      })
    );

    return {
      variants: variantsWithOptions,
      hasMultipleModels: variants.length > 1,
      lowestPrice: variants[0]?.base_price_cents || 0,
    };
  } catch (error) {
    console.error('Unexpected error in fetchProductPricing:', error);
    return null;
  }
}
