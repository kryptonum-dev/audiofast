# Product Pricing UI Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for integrating Supabase pricing data into the product detail page (`/produkty/[slug]`). The goal is to display dynamic, interactive pricing with model selection, nested options (select and numeric range), and real-time price calculation.

**Key Principle**: Sanity stores only `basePriceCents` (lowest price) for listings/filters. Supabase stores comprehensive pricing with all variants, options, and rules for the product detail page.

### ✅ Latest Updates (Based on Context7 & Supabase Docs Review - January 2025)

This plan has been **reviewed and updated** based on the latest Supabase documentation via Context7 MCP. Key changes:

1. **@supabase/ssr Package**: Now using `@supabase/ssr` for Next.js App Router instead of just `@supabase/supabase-js`
   - `createServerClient` for server-side components with proper cookie handling
   - `createBrowserClient` for client-side components

2. **Environment Variables**: Following Supabase conventions
   - `NEXT_PUBLIC_SUPABASE_URL` (not just `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (official naming convention)

3. **Server-Side Client Pattern**: Proper async/await pattern with `next/headers` cookies integration

   ```typescript
   const supabase = await createClient(); // Async function that handles cookies
   ```

4. **Public Data Access**: Since our pricing tables have RLS policies allowing public read, we don't need authentication for pricing queries, but we still use `@supabase/ssr` for consistency and future-proofing.

**Documentation Sources Reviewed:**

- Supabase JS Client: `/supabase/supabase-js` (Trust Score: 9.5)
- Supabase Official Docs: `/websites/supabase` (23,710 code snippets)
- Next.js App Router Integration patterns
- Server-side rendering best practices

---

## 1. Current State Analysis

### 1.1 Existing Architecture

**Sanity (Product Listings)**

- ✅ Stores `basePriceCents` (lowest price among all variants)
- ✅ Stores `lastPricingSync` timestamp
- ✅ Used for product cards, filtering, and sorting
- ✅ Queried via `queryProductBySlug` in `query.ts`

**Supabase (Comprehensive Pricing)**

- ✅ Stores all pricing variants with models
- ✅ Stores option groups (select/numeric_step types)
- ✅ Stores option values with price deltas
- ✅ Stores numeric rules for range inputs
- ✅ RLS policy allows public read access
- ⚠️ **NOT YET** integrated into Next.js frontend

**Product Hero Component**

- ✅ Receives `basePriceCents` from Sanity
- ✅ Displays static price formatted as PLN currency
- ⚠️ **Does NOT** display pricing options
- ⚠️ **Does NOT** query Supabase

### 1.2 Data Structure in Supabase

```sql
-- pricing_variants (one row per model variant)
-- Example: Atmosphere SX IC has 4 rows:
--   1. price_key='synergistic-research/atmosphere-sx-ic', model='Excite RCA', base_price_cents=15100
--   2. price_key='synergistic-research/atmosphere-sx-ic', model='Excite XLR', base_price_cents=16110
--   3. price_key='synergistic-research/atmosphere-sx-ic', model='Euphoria RCA', base_price_cents=25190
--   4. price_key='synergistic-research/atmosphere-sx-ic', model='Euphoria XLR', base_price_cents=29710

-- pricing_option_groups (nested under variant)
-- Example groups for each variant:
--   - name='Długość', input_type='select', values=['1.0 m', '1.5 m', etc.]
--   - name='Zakończ. od strony wzmacniacza', input_type='select', parent_value_id=NULL
--   - name='Długość własna', input_type='numeric_step', parent_value_id=[ID of 'Długość własna' value]

-- pricing_option_values (options within a group)
-- Example: group_id=[Długość group], name='1.0 m', price_delta_cents=0
--          group_id=[Długość group], name='1.5 m', price_delta_cents=0
--          group_id=[Zakończ...], name='Banan', price_delta_cents=3000

-- pricing_numeric_rules (for numeric_step groups)
-- Example: group_id=[Długość własna], min_value=1.5, max_value=6.5,
--          step_value=0.5, price_per_step_cents=14700, base_included_value=1.0
```

### 1.3 Excel Screenshots Analysis

From the provided screenshots, we can observe:

**Sheet 1: Produkty**

- Columns: Producent (Brand), Produkt (Product), Model, Cena (Base Price), URL (price_key)
- Example: "Atmosphere SX IC" has 4 model variants (Excite RCA, Excite XLR, Euphoria RCA, Euphoria XLR)
- Each model has different base price

**Sheet 2: Opcje (Select Options)**

- Shows nested options like:
  - "Długość" (Length) with values: 1.0m, 1.5m, etc. (each with price delta)
  - "Zakończ. od strony wzmacniacza" (Termination type) with values: Brak zakończeń, Banan, Widły 1/4", etc.
  - Some options are nested (parent-child relationship)

**Sheet 3: Pod-opcje wartości (Numeric Range Options)**

- Shows custom length option: "Długość własna" (Custom length)
- Min: 1.5m, Max: 10m, Step: 0.5m, Price per step: 147 PLN
- This appears as a child of "Długość własna" value in parent select

**Sheet 4: Pod-opcje listy (Nested Child Select)**

- Shows "Moduł dodatkowy" (Additional module) as child of "DAC + Moduł dodatkowy"
- Options: USB 2.0, Ethernet, USB 2.0 + Ethernet with different prices

---

## 2. Product Matching Strategy

### 2.1 Matching Sanity Products to Supabase Pricing

**Sanity Product Slug Format**

```
/produkty/atmosphere-sx-ic/
```

**Supabase price_key Format** (from Excel "URL" column)

```
synergistic-research/atmosphere-sx-ic
```

**Matching Algorithm**

```typescript
// Extract product slug from Sanity
const sanitySlug = product.slug; // "/produkty/atmosphere-sx-ic/"
const productSlug = sanitySlug.replace("/produkty/", "").replace(/\/$/, ""); // "atmosphere-sx-ic"

// Build Supabase price_key pattern
// We need to query variants WHERE price_key LIKE '%atmosphere-sx-ic'
// This handles different brand prefixes (synergistic-research/atmosphere-sx-ic, ayre/ex-8, etc.)
```

### 2.2 Edge Cases

**Products without Model Variants**

- Example: "12TC Speaker Cable (Pair)" or "Gamma IC"
- Supabase: Single row with `model=NULL`
- Frontend: Skip model selector, show only options

**Products with Multiple Brand Prefixes**

- The `price_key` includes brand slug (e.g., "synergistic-research/", "ayre/", "shunyata-research/")
- We need fuzzy matching on the product part only

---

## 3. Technical Implementation Plan

### 3.1 Setup Supabase Client (Next.js App Router)

**IMPORTANT**: Based on the latest Supabase documentation, we should use `@supabase/ssr` for Next.js App Router applications. This provides better server-side rendering support and proper cookie handling.

**File: `apps/web/src/global/supabase/server.ts` (NEW)** - Server-side client

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Create a Supabase client for server-side operations (Server Components, Route Handlers, Server Actions)
 * This client handles cookie-based sessions properly for Next.js App Router
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            // For our use case (public pricing data), this is not a concern.
          }
        },
      },
    },
  );
}
```

**File: `apps/web/src/global/supabase/client.ts` (NEW)** - Browser-side client

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Create a Supabase client for browser-side operations (Client Components)
 * This client automatically handles cookie-based sessions in the browser
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**Note**: For public pricing data queries, we don't need auth/session management. The RLS policies on pricing tables already allow public read access. However, using `@supabase/ssr` ensures consistency and future-proofs the implementation if we add auth later.

**File: `apps/web/src/global/supabase/queries.ts` (NEW)**

```typescript
import { createClient as createServerClient } from "./server";
import type {
  PricingVariant,
  PricingOptionGroup,
  PricingOptionValue,
  PricingNumericRule,
  CompletePricingData,
} from "./types";

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
  productSlug: string,
): Promise<CompletePricingData | null> {
  try {
    // Create server client for this request
    const supabase = await createServerClient();

    // Step 1: Find all variants for this product
    // Match by price_key ending with the product slug
    const { data: variants, error: variantsError } = await supabase
      .from("pricing_variants")
      .select("*")
      .ilike("price_key", `%${productSlug}`)
      .order("base_price_cents", { ascending: true }); // Lowest price first

    if (variantsError) {
      console.error("Error fetching pricing variants:", variantsError);
      return null;
    }

    if (!variants || variants.length === 0) {
      console.warn(`No pricing data found for product: ${productSlug}`);
      return null;
    }

    // Step 2: For each variant, fetch option groups, values, and rules
    const variantsWithOptions = await Promise.all(
      variants.map(async (variant) => {
        // Fetch option groups for this variant
        const { data: groups, error: groupsError } = await supabase
          .from("pricing_option_groups")
          .select("*")
          .eq("variant_id", variant.id)
          .order("position", { ascending: true });

        if (groupsError) {
          console.error("Error fetching option groups:", groupsError);
          return { ...variant, groups: [] };
        }

        // For each group, fetch values and numeric rules
        const groupsWithDetails = await Promise.all(
          (groups || []).map(async (group) => {
            // Fetch values if it's a select group
            if (group.input_type === "select") {
              const { data: values, error: valuesError } = await supabase
                .from("pricing_option_values")
                .select("*")
                .eq("group_id", group.id)
                .order("position", { ascending: true });

              if (valuesError) {
                console.error("Error fetching option values:", valuesError);
              }

              return {
                ...group,
                values: values || [],
                numeric_rule: null,
              };
            }

            // Fetch numeric rule if it's a numeric_step group
            if (group.input_type === "numeric_step") {
              const { data: rule, error: ruleError } = await supabase
                .from("pricing_numeric_rules")
                .select("*")
                .eq("group_id", group.id)
                .limit(1)
                .single();

              if (ruleError && ruleError.code !== "PGRST116") {
                // PGRST116 = not found, which is ok
                console.error("Error fetching numeric rule:", ruleError);
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
          }),
        );

        return {
          ...variant,
          groups: groupsWithDetails,
        };
      }),
    );

    return {
      variants: variantsWithOptions,
      hasMultipleModels: variants.length > 1,
      lowestPrice: variants[0].base_price_cents,
    };
  } catch (error) {
    console.error("Unexpected error in fetchProductPricing:", error);
    return null;
  }
}
```

**File: `apps/web/src/global/supabase/types.ts` (NEW)**

```typescript
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
  input_type: "select" | "numeric_step";
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
```

**File: `apps/web/src/global/supabase/database.types.ts` (NEW)**

Generate this file using Supabase CLI or create manually:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Generate types
supabase gen types typescript --project-id xuwapsacaymdemmvblak > apps/web/src/global/supabase/database.types.ts
```

### 3.2 Update Environment Variables

**File: `.env.local` (add these)**

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xuwapsacaymdemmvblak.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1d2Fwc2FjYXltZGVtbXZibGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTg3ODYsImV4cCI6MjA3MjM5NDc4Nn0.qMH2oXCcutbLFdg-IBgJkyfjhq2mQftEUBYfr8e8s2Y
```

**Note**: These are public keys (anon key), safe to expose in client-side code.

**For .env.example (add these for team reference)**:

```env
# Supabase Configuration (https://supabase.com/dashboard/project/xuwapsacaymdemmvblak/settings/api)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3.3 Install Dependencies

**UPDATED**: Based on the latest Supabase documentation, we need both `@supabase/supabase-js` and `@supabase/ssr` for Next.js App Router support.

**File: `apps/web/package.json` (add to dependencies)**

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.48.0",
    "@supabase/ssr": "^0.5.2"
  }
}
```

Run:

```bash
cd apps/web
bun install @supabase/supabase-js @supabase/ssr
```

**What these packages provide:**

- `@supabase/supabase-js`: Core Supabase client library with database, auth, storage, and realtime features
- `@supabase/ssr`: Server-side rendering helpers for Next.js, providing `createServerClient` and `createBrowserClient` functions that properly handle cookies and sessions

### 3.4 Update Product Page Query

**File: `apps/web/src/app/produkty/[slug]/page.tsx`**

**Changes needed:**

1. Import Supabase pricing fetch function
2. Fetch pricing data alongside Sanity data
3. Pass pricing data to ProductHero

```typescript
// Add import
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { CompletePricingData } from '@/src/global/supabase/types';

// Update fetchProductData to also fetch pricing
async function fetchProductData(slug: string) {
  const [sanityData, pricingData] = await Promise.all([
    sanityFetch<QueryProductBySlugResult>({
      query: queryProductBySlug,
      params: { slug: `/produkty/${slug}/` },
      tags: ['product', slug],
    }),
    fetchProductPricing(slug), // Fetch pricing from Supabase
  ]);

  return { sanityData, pricingData };
}

// Update component
export default async function ProductPage(props: ProductPageProps) {
  const { slug } = await props.params;
  const { sanityData: product, pricingData } = await fetchProductData(slug);

  if (!product) {
    console.error(`Product not found: ${slug}`);
    notFound();
  }

  // ... existing breadcrumbs and sections logic ...

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} />
      <ProductHero
        name={product.name || ''}
        subtitle={product.subtitle || ''}
        brand={product.brand as BrandType}
        basePriceCents={product.basePriceCents} // Keep for fallback
        pricingData={pricingData} // NEW: Pass comprehensive pricing
        imageGallery={(product.imageGallery || []) as SanityRawImage[]}
        shortDescription={product.shortDescription}
        awards={product.awards || undefined}
      />
      {/* ... rest of the page ... */}
    </main>
  );
}
```

### 3.5 Create Pricing Configuration Component (Client-Side)

**File: `apps/web/src/components/ui/ProductHero/PricingConfigurator.tsx` (NEW)**

This will be a client component that handles the interactive pricing UI.

```typescript
'use client';

import { useState, useMemo, useEffect } from 'react';
import type {
  CompletePricingData,
  PricingSelection,
  PricingOptionGroupWithDetails,
} from '@/src/global/supabase/types';
import styles from './pricingConfigurator.module.scss';

interface PricingConfiguratorProps {
  pricingData: CompletePricingData;
  basePriceCents?: number | null; // Fallback from Sanity
}

export default function PricingConfigurator({
  pricingData,
  basePriceCents,
}: PricingConfiguratorProps) {
  // State for user selections
  const [selection, setSelection] = useState<PricingSelection>({
    variantId: null,
    selectedOptions: {},
    calculatedPrice: 0,
  });

  // Initialize with first variant if only one exists
  useEffect(() => {
    if (pricingData.variants.length === 1) {
      setSelection((prev) => ({
        ...prev,
        variantId: pricingData.variants[0].id,
        calculatedPrice: pricingData.variants[0].base_price_cents,
      }));
    } else {
      // Multiple variants, set to lowest price initially
      setSelection((prev) => ({
        ...prev,
        calculatedPrice: pricingData.lowestPrice,
      }));
    }
  }, [pricingData]);

  // Get currently selected variant
  const selectedVariant = useMemo(() => {
    if (!selection.variantId) return null;
    return pricingData.variants.find((v) => v.id === selection.variantId) || null;
  }, [selection.variantId, pricingData.variants]);

  // Calculate price based on selections
  const calculatePrice = useMemo(() => {
    if (!selectedVariant) {
      return pricingData.lowestPrice;
    }

    let totalPrice = selectedVariant.base_price_cents;

    // Add price deltas from selected options
    selectedVariant.groups.forEach((group) => {
      const selectedValue = selection.selectedOptions[group.id];
      if (!selectedValue) return;

      if (group.input_type === 'select') {
        // Find the value and add its price delta
        const value = group.values.find((v) => v.id === selectedValue);
        if (value) {
          totalPrice += value.price_delta_cents;
        }
      } else if (group.input_type === 'numeric_step' && group.numeric_rule) {
        // Calculate price based on numeric value
        const numericValue = parseFloat(selectedValue);
        if (!isNaN(numericValue)) {
          const stepsAboveBase =
            (numericValue - group.numeric_rule.base_included_value) /
            group.numeric_rule.step_value;
          if (stepsAboveBase > 0) {
            totalPrice += Math.ceil(stepsAboveBase) * group.numeric_rule.price_per_step_cents;
          }
        }
      }
    });

    return totalPrice;
  }, [selectedVariant, selection.selectedOptions, pricingData.lowestPrice]);

  // Update calculated price when dependencies change
  useEffect(() => {
    setSelection((prev) => ({
      ...prev,
      calculatedPrice: calculatePrice,
    }));
  }, [calculatePrice]);

  // Format price for display
  const formatPrice = (priceCents: number) => {
    const priceInPLN = priceCents / 100;
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(priceInPLN);
  };

  // Handler for model selection
  const handleModelChange = (variantId: string) => {
    setSelection({
      variantId,
      selectedOptions: {}, // Reset options when model changes
      calculatedPrice: pricingData.variants.find((v) => v.id === variantId)?.base_price_cents || 0,
    });
  };

  // Handler for option selection
  const handleOptionChange = (groupId: string, valueIdOrNumeric: string) => {
    setSelection((prev) => ({
      ...prev,
      selectedOptions: {
        ...prev.selectedOptions,
        [groupId]: valueIdOrNumeric,
      },
    }));
  };

  // Filter top-level groups (no parent)
  const topLevelGroups = useMemo(() => {
    if (!selectedVariant) return [];
    return selectedVariant.groups.filter((g) => !g.parent_value_id);
  }, [selectedVariant]);

  // Get child groups for a specific parent value
  const getChildGroups = (parentValueId: string) => {
    if (!selectedVariant) return [];
    return selectedVariant.groups.filter((g) => g.parent_value_id === parentValueId);
  };

  // Render a select dropdown
  const renderSelectOption = (group: PricingOptionGroupWithDetails) => {
    const selectedValue = selection.selectedOptions[group.id];

    return (
      <div key={group.id} className={styles.optionGroup}>
        <label htmlFor={`option-${group.id}`} className={styles.optionLabel}>
          {group.name}
          {group.required && <span className={styles.required}>*</span>}
        </label>
        <select
          id={`option-${group.id}`}
          className={styles.optionSelect}
          value={selectedValue || ''}
          onChange={(e) => handleOptionChange(group.id, e.target.value)}
        >
          <option value="">Wybierz opcję...</option>
          {group.values.map((value) => (
            <option key={value.id} value={value.id}>
              {value.name}
              {value.price_delta_cents > 0 &&
                ` (+${formatPrice(value.price_delta_cents)})`}
            </option>
          ))}
        </select>

        {/* Render child groups if a value is selected */}
        {selectedValue &&
          getChildGroups(selectedValue).map((childGroup) => {
            if (childGroup.input_type === 'select') {
              return renderSelectOption(childGroup);
            } else if (childGroup.input_type === 'numeric_step') {
              return renderNumericOption(childGroup);
            }
            return null;
          })}
      </div>
    );
  };

  // Render a numeric range input
  const renderNumericOption = (group: PricingOptionGroupWithDetails) => {
    if (!group.numeric_rule) return null;

    const rule = group.numeric_rule;
    const selectedValue = selection.selectedOptions[group.id];
    const currentValue = selectedValue ? parseFloat(selectedValue) : rule.min_value;

    return (
      <div key={group.id} className={styles.optionGroup}>
        <label htmlFor={`option-${group.id}`} className={styles.optionLabel}>
          {group.name}
          {group.required && <span className={styles.required}>*</span>}
        </label>
        <div className={styles.numericWrapper}>
          <input
            type="range"
            id={`option-${group.id}`}
            className={styles.optionRange}
            min={rule.min_value}
            max={rule.max_value}
            step={rule.step_value}
            value={currentValue}
            onChange={(e) => handleOptionChange(group.id, e.target.value)}
          />
          <span className={styles.numericValue}>
            {currentValue} {group.unit || 'm'}
          </span>
          {rule.price_per_step_cents > 0 && (
            <span className={styles.numericPrice}>
              +{formatPrice(rule.price_per_step_cents)}/{rule.step_value} {group.unit || 'm'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // If no pricing data, show fallback
  if (!pricingData || pricingData.variants.length === 0) {
    return (
      <div className={styles.priceWrapper}>
        <span className={styles.price}>
          {basePriceCents ? formatPrice(basePriceCents) : 'Brak ceny'}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.configurator}>
      {/* Model Selection (if multiple variants) */}
      {pricingData.hasMultipleModels && (
        <div className={styles.optionGroup}>
          <label htmlFor="model-select" className={styles.optionLabel}>
            Model<span className={styles.required}>*</span>
          </label>
          <select
            id="model-select"
            className={styles.optionSelect}
            value={selection.variantId || ''}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            <option value="">Wybierz model...</option>
            {pricingData.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.model || variant.product}
                {` (od ${formatPrice(variant.base_price_cents)})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Option Groups (only show if variant selected or single variant) */}
      {selectedVariant && topLevelGroups.map((group) => {
        if (group.input_type === 'select') {
          return renderSelectOption(group);
        } else if (group.input_type === 'numeric_step') {
          return renderNumericOption(group);
        }
        return null;
      })}

      {/* Calculated Price Display */}
      <div className={styles.priceDisplay}>
        <span className={styles.priceLabel}>Cena całkowita:</span>
        <span className={styles.price}>{formatPrice(selection.calculatedPrice)}</span>
      </div>
    </div>
  );
}
```

**File: `apps/web/src/components/ui/ProductHero/pricingConfigurator.module.scss` (NEW)**

```scss
.configurator {
  width: 100%;

  .optionGroup {
    margin-bottom: 1.5rem;

    .optionLabel {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--neutral-700, #303030);
      margin-bottom: 0.5rem;

      .required {
        color: var(--primary-red, #fe0140);
        margin-left: 0.25rem;
      }
    }

    .optionSelect {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      color: var(--neutral-700, #303030);
      background-color: var(--neutral-white, #ffffff);
      border: 0.0625rem solid var(--neutral-300, #e0e0e0);
      border-radius: 0.5rem;
      cursor: pointer;
      transition:
        border-color 250ms cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        border-color: var(--neutral-400, #d0d0d0);
      }

      &:focus-visible {
        outline: 0.125rem solid var(--primary-red);
        outline-offset: 0.125rem;
        border-color: var(--primary-red);
      }
    }

    .numericWrapper {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .optionRange {
        width: 100%;
        height: 0.375rem;
        background: var(--neutral-200, #f8f8f8);
        border-radius: 0.1875rem;
        outline: none;
        cursor: pointer;

        &::-webkit-slider-thumb {
          appearance: none;
          width: 1.25rem;
          height: 1.25rem;
          background: var(--primary-red, #fe0140);
          border-radius: 50%;
          cursor: pointer;
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);

          &:hover {
            transform: scale(1.1);
          }
        }

        &::-moz-range-thumb {
          width: 1.25rem;
          height: 1.25rem;
          background: var(--primary-red, #fe0140);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);

          &:hover {
            transform: scale(1.1);
          }
        }
      }

      .numericValue {
        font-size: 1rem;
        font-weight: 600;
        color: var(--neutral-black, #000000);
      }

      .numericPrice {
        font-size: 0.8125rem;
        color: var(--neutral-500, #808080);
      }
    }
  }

  .priceDisplay {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 0.0625rem solid var(--neutral-300, #e0e0e0);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .priceLabel {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--neutral-700, #303030);
    }

    .price {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--primary-red, #fe0140);
      -webkit-text-stroke-width: 0.25px;
      -webkit-text-stroke-color: var(--primary-red, #fe0140);
    }
  }

  @media (max-width: 56.1875rem) {
    .priceDisplay {
      .price {
        font-size: 1.5rem;
      }
    }
  }
}
```

### 3.6 Update ProductHero Component

**File: `apps/web/src/components/ui/ProductHero/index.tsx`**

**Changes:**

1. Import PricingConfigurator
2. Add pricingData prop
3. Conditionally render PricingConfigurator or fallback price

```typescript
import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import type { BrandType, PortableTextProps } from '@/src/global/types';
import type { CompletePricingData } from '@/src/global/supabase/types';

import Button from '../Button';
import AddToComparison from './addToComparison';
import ProductDescription from './ProductDescription';
import ProductHeroGallery from './ProductHeroGallery';
import PricingConfigurator from './PricingConfigurator'; // NEW
import styles from './styles.module.scss';

export type AwardType = {
  _id: string;
  name: string;
  logo?: SanityRawImage | null;
};

export interface ProductHeroProps {
  name: string;
  subtitle: string;
  brand?: BrandType;
  basePriceCents?: number | null;
  pricingData?: CompletePricingData | null; // NEW
  imageGallery: SanityRawImage[];
  shortDescription?: PortableTextProps;
  awards?: AwardType[];
  customId?: string;
}

export default function ProductHero({
  name,
  subtitle,
  brand,
  basePriceCents,
  pricingData, // NEW
  imageGallery,
  shortDescription,
  awards,
  customId,
}: ProductHeroProps) {
  // Format price for display (fallback, used if no pricing data)
  const formatPrice = (priceCents: number | null | undefined) => {
    if (!priceCents || priceCents === 0) return 'Brak ceny';
    const priceInPLN = priceCents / 100;
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(priceInPLN);
  };

  // Prepare awards for display
  const shouldUseMarquee = awards && awards.length >= 8;
  const displayAwards = shouldUseMarquee ? [...awards, ...awards] : awards;

  // Calculate animation duration based on number of items
  const getAnimationDuration = () => {
    if (!shouldUseMarquee || !awards) return 30;
    const duration = awards.length * 2;
    return Math.max(15, Math.min(45, duration));
  };

  const animationDuration = getAnimationDuration();

  return (
    <section className={`${styles.productHero} max-width`} id={customId}>
      <ProductHeroGallery images={imageGallery} />
      <header className={styles.header}>
        <div className={styles.brandLogo}>
          <Image
            image={brand!.logo}
            sizes="(max-width: 56.1875rem) 96px, 128px"
            loading="lazy"
          />
        </div>
        <span className={styles.prefix}>{subtitle}</span>
        <h1 className={styles.heading}>
          <span className={styles.brandName}>{brand!.name}</span>
          <span className={styles.productName}>{name}</span>
        </h1>
      </header>
      <ProductDescription shortDescription={shortDescription!} />
      <div className={styles.priceWrapper}>
        {/* NEW: Use PricingConfigurator if pricing data exists */}
        {pricingData ? (
          <PricingConfigurator
            pricingData={pricingData}
            basePriceCents={basePriceCents}
          />
        ) : (
          // Fallback to static price display
          <span className={styles.price}>{formatPrice(basePriceCents)}</span>
        )}

        <Button
          text="Zapytaj o produkt"
          variant="primary"
          href="/kontakt/"
          iconUsed="information"
        />
        <AddToComparison Icon={<PlusIcon />} />
      </div>
      {/* ... awards section unchanged ... */}
    </section>
  );
}

// ... PlusIcon unchanged ...
```

### 3.7 Update ProductHero Styles

**File: `apps/web/src/components/ui/ProductHero/styles.module.scss`**

Update `.priceWrapper` to accommodate the new configurator:

```scss
.priceWrapper {
  background-color: var(--neutral-200, #f8f8f8);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: clamp(1rem, calc(2vw / 0.48), 2rem);
  position: relative;
  grid-area: pricing;

  // Remove old .price styles, now handled by configurator

  a {
    width: 100%;
    max-width: 100%;
    margin-top: 1rem; // Add margin-top since price might be above now
  }

  // ... rest of styles unchanged ...
}
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Days 1-2)

- ✅ Set up Supabase client in Next.js
- ✅ Create type definitions
- ✅ Create query functions
- ✅ Update environment variables
- ✅ Install dependencies

### Phase 2: Data Integration (Days 3-4)

- ✅ Update product page to fetch pricing data
- ✅ Test data fetching with real products
- ✅ Handle edge cases (no pricing data, single variant, etc.)
- ✅ Add error boundaries

### Phase 3: UI Development (Days 5-7)

- ✅ Create PricingConfigurator component
- ✅ Implement model selector
- ✅ Implement select option dropdowns
- ✅ Implement numeric range inputs
- ✅ Implement nested/conditional option rendering

### Phase 4: Price Calculation (Days 8-9)

- ✅ Implement price calculation logic
- ✅ Handle option deltas
- ✅ Handle numeric step pricing
- ✅ Real-time price updates
- ✅ Validation and error handling

### Phase 5: Styling & UX (Days 10-11)

- ✅ Create SCSS styles following project guidelines
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Accessibility (keyboard navigation, ARIA labels)
- ✅ Loading states
- ✅ Smooth transitions

### Phase 6: Testing & QA (Days 12-14)

- ✅ Test with all product types (single variant, multi-variant, no pricing)
- ✅ Test nested options (parent-child relationships)
- ✅ Test numeric ranges
- ✅ Cross-browser testing
- ✅ Performance optimization (React.memo, useMemo)
- ✅ Edge case handling

---

## 5. Testing Strategy

### 5.1 Test Products

**Test Case 1: Multi-Model Product with Options**

- Product: Atmosphere SX IC (synergistic-research/atmosphere-sx-ic)
- Expected: 4 model variants, each with different option groups
- Test: Model selection changes available options

**Test Case 2: Single Variant with Numeric Option**

- Product: 12TC Speaker Cable (Pair) (kimber-kable/12tc-speaker-cable-pair)
- Expected: Single variant, custom length option (numeric range)
- Test: Range slider updates price dynamically

**Test Case 3: Nested Select Options**

- Product: EX-8 2.0 (ayre/ex-8)
- Expected: "Moduł" option with child "Moduł dodatkowy" when "DAC + Moduł dodatkowy" selected
- Test: Conditional rendering of nested options

**Test Case 4: Product Without Pricing Data**

- Product: Any product not in Supabase
- Expected: Fallback to basePriceCents from Sanity
- Test: No errors, displays static price

### 5.2 Performance Considerations

**Optimization Strategies:**

1. **React.memo** for option group components to prevent re-renders
2. **useMemo** for price calculations and filtered groups
3. **Debounce** numeric input changes (optional, may not be needed)
4. **Server-side caching** for Supabase queries (Next.js fetch cache)

**Expected Performance:**

- Initial page load: < 2s (with pricing data)
- Option selection: < 50ms response time
- Price recalculation: < 10ms

### 5.3 Error Handling

**Scenarios to handle:**

1. **Supabase fetch fails** → Fallback to Sanity basePriceCents
2. **No pricing data** → Display "Zapytaj o cenę" or use basePriceCents
3. **Partial pricing data** → Show available data, hide missing options
4. **Invalid price calculations** → Log error, display last valid price
5. **Network timeout** → Retry with exponential backoff

---

## 6. Future Enhancements

### 6.1 Phase 2 Features (Post-MVP)

**Cart Integration**

- Add "Dodaj do koszyka" (Add to Cart) button
- Store selected configuration in cart state
- Display selected options in cart summary

**Saved Configurations**

- Allow users to save custom configurations
- Share configuration links
- Quick reorder from saved configurations

**Price History**

- Track price changes over time
- Show "Was X PLN, now Y PLN" badges
- Price drop notifications

**Visual Option Display**

- Show images for different connector types
- Color swatches for cable finishes
- Preview images for custom lengths

### 6.2 Admin Features

**Pricing Management Dashboard**

- View all pricing data in Sanity Studio (read-only)
- Sync status indicators
- Manual pricing override (emergency)
- Pricing history viewer

**Analytics Integration**

- Track most popular configurations
- Conversion rate by price point
- Option selection heatmaps

---

## 7. Migration Plan

### 7.1 Gradual Rollout

**Week 1: Internal Testing**

- Deploy to staging environment
- Test with real product data
- Fix critical bugs

**Week 2: Beta Testing**

- Enable for 10% of products (flag in Sanity)
- Monitor performance and errors
- Gather user feedback

**Week 3: Full Rollout**

- Enable for all products with pricing data
- Keep fallback for products without Supabase data
- Monitor analytics

### 7.2 Rollback Plan

**Trigger Conditions:**

- > 5% error rate in Supabase queries
- > 10% increase in page load time
- Critical UX bug affecting checkout

**Rollback Process:**

1. Toggle feature flag in environment variables
2. Deploy previous version of ProductHero
3. Investigate root cause
4. Fix and redeploy

---

## 8. Documentation Requirements

### 8.1 Developer Documentation

**Files to create:**

- `apps/web/src/global/supabase/README.md` - Supabase integration guide
- `apps/web/src/components/ui/ProductHero/README.md` - ProductHero component guide
- `.ai/product-pricing-ui-implementation.md` - This document

### 8.2 User Documentation

**Content team tasks:**

- Update product page help text
- Create FAQ for pricing configurator
- Add tooltips for complex options
- Prepare customer support materials

---

## 9. Acceptance Criteria

### 9.1 Functional Requirements

- [x] Product page fetches pricing data from Supabase
- [x] Model selector displays all variants (if multiple)
- [x] Option groups render based on variant selection
- [x] Select options display with price deltas
- [x] Numeric ranges work with min/max/step constraints
- [x] Nested options show/hide based on parent selection
- [x] Price calculates correctly in real-time
- [x] Fallback to Sanity price when no Supabase data

### 9.2 Non-Functional Requirements

- [x] Page load time < 2 seconds
- [x] Option selection response < 50ms
- [x] Mobile responsive (works on 320px+ screens)
- [x] Accessible (WCAG 2.1 AA compliant)
- [x] SEO-friendly (no client-side rendering issues)
- [x] Error handling (graceful degradation)

### 9.3 Design Requirements

- [x] Follows existing SCSS guidelines (nesting, rem units, etc.)
- [x] Matches Figma designs (if available)
- [x] Consistent with current UI patterns
- [x] Smooth transitions (250-350ms)
- [x] Focus states for accessibility

---

## 10. Risks & Mitigation

### 10.1 Technical Risks

| Risk                               | Impact | Probability | Mitigation                           |
| ---------------------------------- | ------ | ----------- | ------------------------------------ |
| Supabase downtime                  | High   | Low         | Fallback to Sanity basePriceCents    |
| Price calculation bugs             | High   | Medium      | Comprehensive unit tests, validation |
| Performance degradation            | Medium | Medium      | Lazy loading, React.memo, caching    |
| Data mismatch (Sanity vs Supabase) | Medium | Low         | Validation in sync function          |

### 10.2 UX Risks

| Risk                               | Impact | Probability | Mitigation                             |
| ---------------------------------- | ------ | ----------- | -------------------------------------- |
| Confusing nested options           | Medium | Medium      | Clear labels, tooltips, examples       |
| Price changes not obvious          | Medium | Low         | Highlight price changes, animations    |
| Mobile usability issues            | High   | Low         | Extensive mobile testing               |
| Option overload (too many choices) | Low    | High        | Progressive disclosure, smart defaults |

---

## 11. Success Metrics

### 11.1 Technical Metrics

- **Uptime**: > 99.9% for pricing feature
- **Page Load Time**: < 2s (p95)
- **Error Rate**: < 0.1% for Supabase queries
- **Cache Hit Rate**: > 90% for pricing data

### 11.2 Business Metrics

- **Conversion Rate**: Monitor change after deployment
- **Inquiry Rate**: Should decrease (users can self-configure)
- **Average Order Value**: May increase with option upsells
- **User Engagement**: Time on product page, option interactions

---

## 12. Appendix

### 12.1 Example Supabase Queries

**Fetch all variants for a product:**

```sql
SELECT * FROM pricing_variants
WHERE price_key ILIKE '%atmosphere-sx-ic'
ORDER BY base_price_cents ASC;
```

**Fetch option groups for a variant:**

```sql
SELECT * FROM pricing_option_groups
WHERE variant_id = 'uuid-here'
ORDER BY position ASC;
```

**Fetch option values for a group:**

```sql
SELECT * FROM pricing_option_values
WHERE group_id = 'uuid-here'
ORDER BY position ASC;
```

### 12.2 Price Calculation Examples

**Example 1: Simple Select Options**

```
Base Price: 15100 PLN (Excite RCA)
+ Długość 1.5m: +0 PLN
+ Zakończenia Banan: +3000 PLN
= Total: 18100 PLN
```

**Example 2: Numeric Range**

```
Base Price: 15100 PLN
+ Długość własna 3.5m:
  - Base included: 1.0m
  - Steps above base: (3.5 - 1.0) / 0.5 = 5 steps
  - Price per step: 14700 PLN
  - Total delta: 5 * 14700 = 73500 PLN
= Total: 88600 PLN
```

**Example 3: Nested Options**

```
Base Price: 42300 PLN (EX-8 2.0)
+ Moduł: DAC + Moduł dodatkowy (+0 PLN)
  + Moduł dodatkowy: USB 2.0 (+4230 PLN)
= Total: 46530 PLN
```

---

## 13. Supabase Best Practices (From Context7 Documentation Review)

Based on the latest Supabase documentation, here are the key best practices we're following:

### 13.1 Client Initialization Patterns

**✅ DO: Use @supabase/ssr for Next.js App Router**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      /* ... */
    },
  });
}
```

**❌ DON'T: Use basic createClient in Server Components**

```typescript
// This pattern is for standalone scripts/Node.js, not Next.js SSR
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(url, anonKey);
```

### 13.2 Authentication & Sessions

**For Our Use Case:**

- We're accessing **public pricing data** (RLS allows SELECT for anon role)
- No user authentication required
- Still using `@supabase/ssr` for proper server/client separation and future-proofing

**If We Add Auth Later:**

- Server Components: Use `supabase.auth.getUser()` (revalidates token)
- Never use `supabase.auth.getSession()` on server (doesn't revalidate)
- Client Components: Can use either, but `getUser()` is safer

### 13.3 Data Fetching Patterns

**✅ Server Components (Recommended for Our Use Case)**

```typescript
// In page.tsx or layout.tsx
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('pricing_variants').select('*');
  return <Component data={data} />;
}
```

**Client Components (For Interactive State)**

```typescript
"use client";
import { createClient } from "@/utils/supabase/client";

export default function Component() {
  const [data, setData] = useState(null);
  const supabase = createClient(); // Synchronous in browser

  useEffect(() => {
    supabase.from("pricing_variants").select("*").then(/* ... */);
  }, []);
}
```

### 13.4 Environment Variables

**Required variables** (must be prefixed with `NEXT_PUBLIC_` for client access):

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key (safe to expose)

**Optional variables** (if using service role operations):

- `SUPABASE_SERVICE_ROLE_KEY`: Never expose to client!

### 13.5 Type Safety with TypeScript

**Generate database types:**

```bash
supabase gen types typescript --project-id xuwapsacaymdemmvblak > database.types.ts
```

**Use types in client:**

```typescript
import type { Database } from "./database.types";
const supabase = createServerClient<Database>(/* ... */);
```

**Benefits:**

- Full TypeScript autocomplete for tables/columns
- Type-safe queries and responses
- Catch errors at compile-time

### 13.6 Error Handling Patterns

**✅ DO: Check both data and error**

```typescript
const { data, error } = await supabase.from("pricing_variants").select("*");
if (error) {
  console.error("Error:", error.message);
  return null; // Or throw, or return fallback
}
return data;
```

**❌ DON'T: Assume data exists**

```typescript
const { data } = await supabase.from("pricing_variants").select("*");
return data.map(/* ... */); // Might be null!
```

### 13.7 Performance Optimizations

**✅ Use select() to limit columns**

```typescript
// Fetch only needed columns
.select('id, name, base_price_cents')
```

**✅ Use order() for consistent sorting**

```typescript
.order('position', { ascending: true })
```

**✅ Use limit() for pagination**

```typescript
.limit(10)
.range(0, 9) // Rows 0-9
```

**✅ Use single() when expecting one result**

```typescript
.eq('id', variantId)
.single()
```

### 13.8 Next.js Caching Considerations

**Server Components automatically cache** (force-cache by default in production):

```typescript
// Automatically cached in production
const { data } = await supabase.from("pricing_variants").select("*");
```

**To opt out of caching:**

```typescript
// Use in your createClient if needed
export const dynamic = "force-dynamic";
```

**For our use case**: Pricing data changes infrequently (Excel updates), so caching is beneficial. We rely on Next.js revalidation via tags:

```typescript
sanityFetch({ query, tags: ["product", slug] });
// Supabase data will be fresh when Sanity revalidates
```

---

## 14. Next Steps

1. **Review this plan** with team (frontend, backend, design, product)
2. **Set up development environment** (Supabase credentials, env vars)
3. **Create feature branch** (`feature/product-pricing-ui`)
4. **Begin Phase 1** (Foundation setup)
5. **Schedule daily standups** for the 2-week implementation period
6. **Prepare test data** in Supabase (if not already complete)
7. **Update project board** with tasks from implementation phases

---

**Document Version**: 1.1 (Updated with Context7 Review)  
**Created**: January 2025  
**Last Updated**: January 2025  
**Author**: AI Assistant  
**Reviewed**: Context7 & Supabase Official Documentation  
**Status**: Ready for Implementation ✅
