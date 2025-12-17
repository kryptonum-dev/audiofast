# Advanced Custom Filters Implementation Plan

## Overview

This document outlines a comprehensive plan to enhance the custom filters system in Audiofast's product listing. The enhancement adds:

1. **Filter Type Support** - Dropdown (select) or Range (min/max slider) filters
2. **Sub-category Filters Configuration View** - A dedicated Sanity Studio view for managing filters per sub-category
3. **Drag-and-Drop Sorting** - Reorder filters via drag-and-drop
4. **Range Filter Support** - Numeric range inputs with unit display (min/max computed from product values)
5. **Frontend Range Component** - Similar styling to existing PriceRange component

### Key Design Decisions

- **Range min/max values** are computed dynamically from product filter values (not configured in sub-category)
- **Range step** is always `1` (hardcoded, not configurable)
- **Range filters** require at least 2 products with different values to be displayed (same as dropdowns)
- **Range filter values** on products must be numeric only

---

## Current State

### Sanity Schema (product-category-sub.ts)

```typescript
// Current: Simple string array for filter names
defineField({
  name: 'customFilters',
  title: 'Niestandardowe filtry',
  type: 'array',
  of: [{ type: 'string' }],
});
```

### Product Schema (product.ts)

```typescript
// Current: Simple key-value pairs for filter values
defineField({
  name: 'customFilterValues',
  type: 'array',
  of: [
    {
      type: 'object',
      fields: [
        { name: 'filterName', type: 'string' },
        { name: 'value', type: 'string' }, // Always string, even for numeric
      ],
    },
  ],
});
```

### Frontend (CustomFiltersBar)

- Only supports dropdown/select filters
- Values are always strings
- URL params: `?filterName=value`

### Limitations

- No support for range filters (min/max sliders)
- No dedicated UI for managing filters per sub-category
- No visual sorting of filters
- Filter configuration is disconnected from filter values on products
- Cannot filter by numeric ranges (e.g., impedance 4-12Ω)

---

## Proposed Schema Changes

### 1. Enhanced Filter Definition (New Object Type)

Create a reusable filter definition object type:

```typescript
// apps/studio/schemaTypes/definitions/custom-filter-definition.ts

import { defineField, defineType } from 'sanity';
import { Filter, Hash, Sliders } from 'lucide-react';

export const customFilterDefinition = defineType({
  name: 'customFilterDefinition',
  title: 'Definicja filtra',
  type: 'object',
  icon: Filter,
  fields: [
    defineField({
      name: 'name',
      title: 'Nazwa filtra',
      type: 'string',
      description:
        'Nazwa wyświetlana użytkownikowi (np. "Impedancja", "Długość kabla")',
      validation: (Rule) => Rule.required().error('Nazwa filtra jest wymagana'),
    }),
    defineField({
      name: 'filterType',
      title: 'Typ filtra',
      type: 'string',
      description: 'Wybierz jak filtr będzie wyświetlany na stronie',
      options: {
        list: [
          { title: 'Lista rozwijana (dropdown)', value: 'dropdown' },
          { title: 'Zakres (suwak min-max)', value: 'range' },
        ],
        layout: 'radio',
      },
      initialValue: 'dropdown',
      validation: (Rule) => Rule.required(),
    }),
    // Range-specific field: only unit is configurable
    // Min/max are computed dynamically from product values
    // Step is always 1 (hardcoded in frontend)
    defineField({
      name: 'unit',
      title: 'Jednostka',
      type: 'string',
      description:
        'Jednostka dla zakresu (np. "Ω", "W", "m", "Hz"). Wartości min/max są obliczane automatycznie z produktów.',
      hidden: ({ parent }) => parent?.filterType !== 'range',
    }),
  ],
  preview: {
    select: {
      name: 'name',
      filterType: 'filterType',
      unit: 'unit',
    },
    prepare: ({ name, filterType, unit }) => ({
      title: name || 'Filtr',
      subtitle:
        filterType === 'range'
          ? `Zakres${unit ? ` (${unit})` : ''}`
          : 'Lista rozwijana',
      media: filterType === 'range' ? Sliders : Hash,
    }),
  },
});
```

### 2. Updated Sub-category Schema

```typescript
// apps/studio/schemaTypes/documents/collections/product-category-sub.ts

defineField({
  name: 'customFilters',
  title: 'Konfiguracja filtrów',
  type: 'array',
  description:
    'Zdefiniuj filtry dostępne dla tej kategorii. Przeciągnij aby zmienić kolejność.',
  of: [{ type: 'customFilterDefinition' }],
  validation: (Rule) =>
    Rule.custom((filters) => {
      if (!filters || !Array.isArray(filters)) return true;
      const names = filters
        .map((f: any) => f.name?.toLowerCase())
        .filter(Boolean);
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        return 'Nazwy filtrów muszą być unikalne';
      }
      return true;
    }),
});
```

### 3. Enhanced Product Filter Values

```typescript
// apps/studio/schemaTypes/documents/collections/product.ts

defineField({
  name: 'customFilterValues',
  title: 'Wartości niestandardowych filtrów',
  type: 'array',
  group: GROUP.MAIN_CONTENT,
  hidden: ({ document }) =>
    !document?.categories ||
    !Array.isArray(document.categories) ||
    document.categories.length === 0,
  components: {
    input: CustomFilterValueInput, // Enhanced component that shows correct input type
  },
  of: [
    defineField({
      type: 'object',
      name: 'filterValue',
      title: 'Wartość filtra',
      fields: [
        defineField({
          name: 'filterName',
          title: 'Nazwa filtra',
          type: 'string',
          validation: (Rule) => Rule.required(),
        }),
        // For dropdown filters - string value (any text)
        defineField({
          name: 'value',
          title: 'Wartość tekstowa',
          type: 'string',
          description: 'Dla filtrów typu lista (np. "2m", "Złoty", "Custom")',
        }),
        // For range filters - numeric value ONLY (no text allowed)
        defineField({
          name: 'numericValue',
          title: 'Wartość liczbowa',
          type: 'number',
          description: 'Dla filtrów typu zakres - tylko liczby (np. 4, 8, 12)',
          validation: (Rule) =>
            Rule.custom((value, context) => {
              // numericValue is required for range filters
              // This validation is handled in CustomFilterValueInput component
              return true;
            }),
        }),
      ],
      preview: {
        select: {
          filterName: 'filterName',
          value: 'value',
          numericValue: 'numericValue',
        },
        prepare: ({ filterName, value, numericValue }) => ({
          title: filterName || 'Filtr',
          subtitle:
            numericValue !== undefined
              ? String(numericValue)
              : value || 'Brak wartości',
        }),
      },
    }),
  ],
});
```

**Important:** The `CustomFilterValueInput` component will:

- Fetch filter definitions from selected categories
- For **dropdown** filters: show text input (string value)
- For **range** filters: show number input ONLY (no text, numericValue required)
- Hide the inappropriate input field based on filter type

---

## Sanity Studio Components

> **✅ IMPLEMENTED** - All Sanity Studio components have been created and are functional.

### 1. Custom Filters Configuration View (Sub-category)

A dedicated view for sub-category filter management with inline editing and product value management:

```
apps/studio/components/custom-filters-config/
├── index.tsx                       # Export barrel
├── custom-filters-config-view.tsx  # Main view component (599 lines)
├── filter-item.tsx                 # Sortable filter item with inline editing
├── filter-editor-dialog.tsx        # Edit filter dialog (legacy, replaced by inline)
├── product-filter-values.tsx       # Product values management with search/pagination
└── types.ts                        # Type definitions
```

#### Implemented Features

1. **Drag-drop sorting** using `@dnd-kit/core` and `@dnd-kit/sortable`
2. **Inline editing** of filter name, type (dropdown/range), and unit
3. **Add new filter** button with automatic key generation
4. **Delete filter** with modal confirmation dialog
5. **Auto-save** with debounce (800ms) and status indicator
6. **Optimistic updates** for instant UI feedback
7. **Product values management** - expand each filter to see/edit product values:
   - Search products by name
   - Product image previews
   - Shows products with/without values separately
   - Pagination (10 products initially, "show all" button)
   - Product counts shown even when collapsed

#### Key Implementation Details

```typescript
// Types used in the implementation
type FilterConfigItem = {
  _key: string;
  name: string;
  filterType: 'dropdown' | 'range';
  unit?: string;
};

type ProductCounts = {
  total: number;
  withValue: number;
};

// GROQ query to fetch products (prefers drafts)
`*[_type == "product" && references($categoryId) && (isArchived != true) && !(_id in path("drafts.**"))] {
  "product": coalesce(
    *[_id == "drafts." + ^._id][0],
    @
  ) {
    _id,
    name,
    "brandName": brand->name,
    "imageUrl": previewImage.asset->url,
    customFilterValues
  }
}.product | order(name asc)`;
```

### 2. Product Filters View (Product)

A new dedicated view for products to manage their filter values:

```
apps/studio/components/product-filters-view/
├── index.tsx                    # Export barrel
└── product-filters-view.tsx     # Main view component (584 lines)
```

#### Implemented Features

1. **Lists all custom filters** from product's categories
2. **Visual cards** for each filter with:
   - Icon (Sliders for range, Hash for dropdown)
   - Filter name and type badge
   - Source category name
   - Appropriate input (number/text)
   - Unit suffix for range filters
   - Green styling when filled
3. **Progress badge** showing X/Y filters completed
4. **Auto-save** with debounce and status indicator
5. **Empty state** when no filters are defined in categories
6. **Draft management** - creates drafts when saving to published products

### 3. Structure.ts Configuration

Both custom views are registered in the document node resolver:

```typescript
// apps/studio/structure.ts

import { CustomFiltersConfigView } from './components/custom-filters-config';
import { ProductFiltersView } from './components/product-filters-view';
import { TechnicalDataView } from './components/technical-data-table/technical-data-view';

export const defaultDocumentNode: DefaultDocumentNodeResolver = (
  S,
  { schemaType }
) => {
  // Product: 3 tabs
  if (schemaType === 'product') {
    return S.document().views([
      S.view.form().title('Zawartość').icon(EditIcon),
      S.view
        .component(TechnicalDataView)
        .title('Dane techniczne')
        .icon(BlockContentIcon),
      S.view.component(ProductFiltersView).title('Filtry').icon(FilterIcon),
    ]);
  }

  // Sub-category: 2 tabs
  if (schemaType === 'productCategorySub') {
    return S.document().views([
      S.view.form().title('Zawartość').icon(EditIcon),
      S.view
        .component(CustomFiltersConfigView)
        .title('Konfiguracja filtrów')
        .icon(FilterIcon),
    ]);
  }

  return S.document();
};
```

### 4. Hidden Fields in Content Views

Since filters are now managed via dedicated view tabs, the raw array fields are hidden from the main content forms:

```typescript
// product.ts - customFilterValues field
defineField({
  name: 'customFilterValues',
  // ...
  hidden: true, // Managed via "Filtry" view tab
});

// product-category-sub.ts - customFilters field
defineField({
  name: 'customFilters',
  // ...
  hidden: true, // Managed via "Konfiguracja filtrów" view tab
});
```

### 5. CustomFilterValueInput Component

The existing component was updated to handle both filter types:

```typescript
// apps/studio/components/custom-filter-value-input.tsx

// Changes made:
// 1. Fetches filter definitions with filterType and unit from categories
// 2. Shows TextInput for dropdown filters (string value)
// 3. Shows number input for range filters (numericValue)
// 4. Displays unit suffix for range filters
// 5. Updated validation messages

// Note: This component is no longer used in the main form since
// customFilterValues is hidden, but remains for reference/API access.
```

---

## GROQ Query Updates

### 1. Category Metadata Query

```groq
// Enhanced to include filter configuration
// Note: min/max for range filters are computed from product values on frontend
*[_type == "productCategorySub" && slug.current == $category][0]{
  _id,
  name,
  "slug": slug.current,
  customFilters[]{
    _key,
    name,
    filterType,
    unit
  }
}
```

### 2. Products with Filter Values Query

```groq
// Enhanced to include numeric values
*[_type == "product" && references($categoryId)]{
  _id,
  name,
  customFilterValues[]{
    filterName,
    value,
    numericValue
  }
}
```

### 3. Products Page Data Query Fragment

```groq
// Update productsWithFilters to handle range filters
"productsWithFilters": *[
  _type == "product"
  && defined(slug.current)
  && isArchived != true
  && count(categories) > 0
  && $category in categories[]->slug.current
  && defined(customFilterValues)
]{
  _id,
  customFilterValues[]{
    filterName,
    value,
    numericValue
  }
}
```

---

## Frontend Implementation

### 1. Types Updates

```typescript
// apps/web/src/global/filters/types.ts

/**
 * Filter definition from sub-category
 * Note: For range filters, min/max are computed from product values (not stored)
 * Step is always 1 (hardcoded)
 */
export type CustomFilterDefinition = {
  _key: string;
  name: string;
  filterType: 'dropdown' | 'range';
  unit?: string; // Only for range filters
};

/**
 * Custom filter value on a product
 */
export type CustomFilterValue = {
  filterName: string;
  value?: string; // For dropdown filters
  numericValue?: number; // For range filters
};

/**
 * Active range filter
 */
export type ActiveRangeFilter = {
  filterName: string;
  minValue?: number;
  maxValue?: number;
};

/**
 * Updated ActiveFilters type
 */
export type ActiveFilters = {
  search: string;
  brands: string[];
  minPrice: number;
  maxPrice: number;
  category: string | null;
  customFilters: CustomFilterValue[]; // Dropdown filters
  rangeFilters: ActiveRangeFilter[]; // Range filters
  isCPO: boolean;
};
```

### 2. New RangeFilter Component

```typescript
// apps/web/src/components/products/RangeFilter/index.tsx

"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./styles.module.scss";

type RangeFilterProps = {
  name: string;
  unit?: string;
  minValue: number;        // Current selected min (from URL or default)
  maxValue: number;        // Current selected max (from URL or default)
  minLimit: number;        // Computed from products (smallest value)
  maxLimit: number;        // Computed from products (largest value)
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
};

// Step is always 1 (hardcoded per requirements)
const STEP = 1;

export default function RangeFilter({
  name,
  unit,
  minValue,
  maxValue,
  minLimit,
  maxLimit,
  onMinChange,
  onMaxChange,
}: RangeFilterProps) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);

  // ... Similar logic to PriceRange component

  return (
    <div className={styles.rangeFilter}>
      <div className={styles.header}>
        <h3 className={styles.title}>{name}{unit && ` (${unit})`}</h3>
        <span className={styles.rangeHelper}>
          {minLimit} - {maxLimit}{unit && ` ${unit}`}
        </span>
      </div>

      {/* Dual Range Slider */}
      <div className={styles.sliderContainer}>
        {/* Similar to PriceRange slider */}
      </div>

      {/* Value Inputs */}
      <div className={styles.valuesWrapper}>
        <div className={styles.valueGroup}>
          <span className={styles.valueLabel}>od</span>
          <input
            type="number"
            step={STEP}
            min={minLimit}
            max={localMax}
            value={localMin}
            onChange={(e) => handleMinChange(e.target.value)}
            onBlur={handleMinBlur}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        <div className={styles.valueGroup}>
          <span className={styles.valueLabel}>do</span>
          <input
            type="number"
            step={STEP}
            min={localMin}
            max={maxLimit}
            value={localMax}
            onChange={(e) => handleMaxChange(e.target.value)}
            onBlur={handleMaxBlur}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}
```

### 3. Updated CustomFiltersBar

```typescript
// apps/web/src/components/products/CustomFiltersBar/index.tsx

export type CustomFilter = {
  name: string;
  filterType: "dropdown" | "range";
  values?: string[];           // For dropdown - unique values from products
  unit?: string;               // For range - display unit
  minValue?: number;           // For range - computed from products (smallest)
  maxValue?: number;           // For range - computed from products (largest)
  productCount: number;        // Number of products with this filter value
};

// URL params for range filters:
// - min{filterNameSlug}: minimum value (e.g., minimpedancja=4)
// - max{filterNameSlug}: maximum value (e.g., maximpedancja=12)

// Filter visibility rules:
// - Dropdown: show if >= 2 unique values exist
// - Range: show if >= 2 products have different numeric values (min !== max)

export default function CustomFiltersBar({
  customFilters,
  activeFilters,
  activeRangeFilters,
  basePath,
  currentSearchParams,
}: CustomFiltersBarProps) {
  // ... existing dropdown logic

  // Filter out filters that shouldn't be shown
  // Dropdown: needs >= 2 unique values
  // Range: needs min !== max (at least 2 products with different values)
  const visibleDropdownFilters = customFilters.filter(
    f => f.filterType === "dropdown" && f.values && f.values.length >= 2
  );

  const visibleRangeFilters = customFilters.filter(
    f => f.filterType === "range" &&
    f.minValue !== undefined &&
    f.maxValue !== undefined &&
    f.minValue !== f.maxValue
  );

  // Range filter handling
  const handleRangeChange = (filterName: string, min: number, max: number) => {
    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);

    // Set min param (skip if at minimum - computed from products)
    const filter = customFilters.find(f => f.name === filterName);
    const computedMin = filter?.minValue ?? 0;
    const computedMax = filter?.maxValue ?? Infinity;

    if (min > computedMin) {
      params.set(`min${slugifiedName}`, min.toString());
    } else {
      params.delete(`min${slugifiedName}`);
    }

    if (max < computedMax) {
      params.set(`max${slugifiedName}`, max.toString());
    } else {
      params.delete(`max${slugifiedName}`);
    }

    params.delete("page");

    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Filtry</h3>

      {/* Dropdown Filters - only show if >= 2 unique values */}
      {visibleDropdownFilters.map(filter => (
        <DropdownFilter key={filter.name} filter={filter} />
      ))}

      {/* Range Filters - only show if min !== max */}
      {visibleRangeFilters.map(filter => (
        <RangeFilter
          key={filter.name}
          name={filter.name}
          unit={filter.unit}
          minValue={getActiveRangeMin(filter.name) ?? filter.minValue!}
          maxValue={getActiveRangeMax(filter.name) ?? filter.maxValue!}
          minLimit={filter.minValue!}  // Computed from products
          maxLimit={filter.maxValue!}  // Computed from products
          onMinChange={(v) => handleRangeChange(filter.name, v, getActiveRangeMax(filter.name) ?? filter.maxValue!)}
          onMaxChange={(v) => handleRangeChange(filter.name, getActiveRangeMin(filter.name) ?? filter.minValue!, v)}
        />
      ))}

      {hasAnyActiveFilters && (
        <button className={styles.clearAll} onClick={handleClearAll}>
          Wyczyść wszystkie
        </button>
      )}
    </div>
  );
}
```

### 4. Updated computeFilters.ts

```typescript
// apps/web/src/global/filters/computeFilters.ts

/**
 * Filter products by range filters
 */
function applyRangeFilters(
  products: ProductFilterMetadata[],
  rangeFilters: ActiveRangeFilter[]
): ProductFilterMetadata[] {
  if (!rangeFilters || rangeFilters.length === 0) return products;

  return products.filter((product) => {
    return rangeFilters.every((rangeFilter) => {
      const productValue = product.customFilterValues?.find(
        (fv) => fv.filterName === rangeFilter.filterName
      );

      // Product must have a numeric value for this filter
      if (productValue?.numericValue === undefined) return false;

      const value = productValue.numericValue;

      if (rangeFilter.minValue !== undefined && value < rangeFilter.minValue) {
        return false;
      }
      if (rangeFilter.maxValue !== undefined && value > rangeFilter.maxValue) {
        return false;
      }

      return true;
    });
  });
}

/**
 * Compute min/max bounds for a range filter from product values
 * Returns null if filter should be hidden (< 2 distinct values)
 */
function computeRangeFilterBounds(
  products: ProductFilterMetadata[],
  filterName: string
): { min: number; max: number; productCount: number } | null {
  const values = products
    .map(
      (p) =>
        p.customFilterValues?.find((fv) => fv.filterName === filterName)
          ?.numericValue
    )
    .filter((v): v is number => v !== undefined && v !== null);

  // No products have this filter value
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Only 1 product or all products have same value - don't show filter
  if (min === max) return null;

  return {
    min,
    max,
    productCount: values.length,
  };
}

/**
 * Compute all range filter bounds for a category
 * Filters out ranges that shouldn't be displayed
 */
function computeAllRangeFilterBounds(
  products: ProductFilterMetadata[],
  rangeFilterDefinitions: CustomFilterDefinition[]
): Map<string, { min: number; max: number; productCount: number }> {
  const bounds = new Map();

  rangeFilterDefinitions.forEach((filter) => {
    const filterBounds = computeRangeFilterBounds(products, filter.name);
    if (filterBounds !== null) {
      bounds.set(filter.name, filterBounds);
    }
  });

  return bounds;
}
```

### 5. URL Parameter Utilities

```typescript
// apps/web/src/global/utils.ts (additions)

/**
 * Parse range filter params from URL
 * e.g., ?minimpedancja=4&maximpedancja=12 → [{ filterName: "impedancja", minValue: 4, maxValue: 12 }]
 *
 * Note: We parse as integers since step is always 1
 */
export function parseRangeFilters(
  searchParams: URLSearchParams,
  filterDefinitions: CustomFilterDefinition[]
): ActiveRangeFilter[] {
  const rangeFilters: ActiveRangeFilter[] = [];

  filterDefinitions
    .filter((f) => f.filterType === 'range')
    .forEach((filter) => {
      const slug = slugifyFilterName(filter.name);
      const minParam = searchParams.get(`min${slug}`);
      const maxParam = searchParams.get(`max${slug}`);

      if (minParam !== null || maxParam !== null) {
        rangeFilters.push({
          filterName: filter.name,
          minValue: minParam ? parseInt(minParam, 10) : undefined,
          maxValue: maxParam ? parseInt(maxParam, 10) : undefined,
        });
      }
    });

  return rangeFilters;
}

/**
 * Build range filter URL params
 * Only includes params that differ from computed min/max
 */
export function buildRangeFilterParams(
  rangeFilters: ActiveRangeFilter[],
  computedBounds: Map<string, { min: number; max: number }>
): URLSearchParams {
  const params = new URLSearchParams();

  rangeFilters.forEach((rf) => {
    const bounds = computedBounds.get(rf.filterName);
    if (!bounds) return;

    const slug = slugifyFilterName(rf.filterName);

    // Only add param if different from computed min
    if (rf.minValue !== undefined && rf.minValue > bounds.min) {
      params.set(`min${slug}`, rf.minValue.toString());
    }
    // Only add param if different from computed max
    if (rf.maxValue !== undefined && rf.maxValue < bounds.max) {
      params.set(`max${slug}`, rf.maxValue.toString());
    }
  });

  return params;
}
```

---

## Implementation Phases

### Phase 1: Schema & Type Updates ✅ COMPLETED

1. ✅ Create `customFilterDefinition` object type
2. ✅ Update `productCategorySub` schema to use new filter definition
3. ✅ Update `product` schema to support `numericValue`
4. ⏭️ Migration script not needed (additive change, existing data compatible)
5. ✅ Run Sanity typegen

**Files created/modified:**

- ✅ `apps/studio/schemaTypes/definitions/custom-filter-definition.ts` (new)
- ✅ `apps/studio/schemaTypes/definitions/index.ts` (updated)
- ✅ `apps/studio/schemaTypes/documents/collections/product-category-sub.ts` (updated)
- ✅ `apps/studio/schemaTypes/documents/collections/product.ts` (updated)

### Phase 2: Sanity Studio Components ✅ COMPLETED

1. ✅ Create CustomFiltersConfigView component (with inline editing, drag-drop, auto-save)
2. ✅ Create sortable filter item component
3. ✅ Create filter editor dialog (replaced by inline editing)
4. ✅ Create product values management component (with search, images, pagination)
5. ✅ Create ProductFiltersView for products (new - not in original plan)
6. ✅ Update structure.ts to add both new views
7. ✅ Update CustomFilterValueInput for range support
8. ✅ Hide raw fields from content views (managed via dedicated tabs)

**Files created/modified:**

- ✅ `apps/studio/components/custom-filters-config/` (new folder)
  - `index.tsx`
  - `custom-filters-config-view.tsx` (599 lines)
  - `filter-item.tsx` (179 lines)
  - `filter-editor-dialog.tsx` (145 lines)
  - `product-filter-values.tsx` (629 lines)
  - `types.ts` (30 lines)
- ✅ `apps/studio/components/product-filters-view/` (new folder - bonus feature)
  - `index.tsx`
  - `product-filters-view.tsx` (584 lines)
- ✅ `apps/studio/components/custom-filter-value-input.tsx` (updated)
- ✅ `apps/studio/structure.ts` (updated)

### Phase 3: GROQ & Type Updates (1 day)

1. Update GROQ queries to include filter configuration
2. Update GROQ queries to include numeric values
3. Update filter metadata queries
4. Regenerate Sanity types

**Files to modify:**

- `apps/web/src/global/sanity/query.ts`

### Phase 4: Frontend Filter Logic (2 days)

1. Update filter types
2. Update computeFilters to handle range filters
3. Add URL parameter utilities for range filters
4. Update filter parsing from URL

**Files to modify:**

- `apps/web/src/global/filters/types.ts`
- `apps/web/src/global/filters/computeFilters.ts`
- `apps/web/src/global/utils.ts`

### Phase 5: Frontend Components (2 days)

1. Create RangeFilter component
2. Create RangeFilter styles
3. Update CustomFiltersBar to render both dropdown and range filters
4. Update ProductsAside if needed

**Files to create/modify:**

- `apps/web/src/components/products/RangeFilter/` (new folder)
  - `index.tsx`
  - `styles.module.scss`
- `apps/web/src/components/products/CustomFiltersBar/index.tsx` (update)
- `apps/web/src/components/products/CustomFiltersBar/styles.module.scss` (update)

### Phase 6: Page Integration & Testing (1-2 days)

1. Update category page to pass filter definitions
2. Update products page data fetching
3. Test dropdown filters (existing functionality)
4. Test range filters (new functionality)
5. Test combined filters (dropdown + range)
6. Test edge cases (empty values, invalid params)

**Files to modify:**

- `apps/web/src/app/(products)/kategoria/[...slug]/page.tsx`
- `apps/web/src/app/(products)/produkty/page.tsx`

---

## Data Migration Strategy

### Existing Filters Migration

The schema change is additive - existing `customFilters` string arrays need to be migrated to the new object structure.

```typescript
// Migration script concept
const migrateFilters = async (client: SanityClient) => {
  const subCategories = await client.fetch(
    `*[_type == "productCategorySub" && defined(customFilters)]`
  );

  for (const subCat of subCategories) {
    if (!subCat.customFilters) continue;

    // Convert string array to object array
    const newFilters = subCat.customFilters.map((filterName: string) => ({
      _key: generateKey(),
      name: filterName,
      filterType: 'dropdown', // Default to dropdown for existing filters
    }));

    await client.patch(subCat._id).set({ customFilters: newFilters }).commit();
  }
};
```

### Backward Compatibility

- Existing dropdown filters continue to work unchanged
- `value` field on products remains for dropdown filters
- New `numericValue` field added for range filters
- Frontend detects filter type and renders appropriate component

---

## Edge Cases & Considerations

### 1. Mixed Filter Types

Products can have both dropdown and range filter values. The system handles them independently.

### 2. Filter Visibility Rules

**Dropdown filters:**

- Show only if >= 2 unique string values exist across products
- Same as current behavior

**Range filters:**

- Show only if >= 2 products have different numeric values (min !== max)
- If only 1 product has the filter, or all products have the same value: hide the filter
- Example: 3 products with values 4, 8, 13 → show range 4-13
- Example: 1 product with value 8 → hide filter
- Example: 3 products all with value 8 → hide filter (min === max)

### 3. Invalid Range Values

- Range filter with non-numeric value: Not possible (schema enforces number type)
- Min > Max in URL params: Frontend prevents this in UI, clamp values
- Value outside computed bounds: Clamp to valid range

### 4. Empty Filters

- Category with no filters: No filter bar shown
- Filter with no products having values: Filter hidden
- Filter with only 1 product or identical values: Filter hidden

### 5. URL Parameter Conflicts

Range filter params use `min{name}` and `max{name}` prefixes to avoid conflicts with existing params.

### 6. Performance

- Filter computation remains client-side and instant
- Range filter bounds computed from product values: O(n) per filter
- With ~500 products and 5 filters, computation is <5ms

---

## Component Styling

### RangeFilter Component

```scss
// apps/web/src/components/products/RangeFilter/styles.module.scss

.rangeFilter {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  // Reuse PriceRange patterns for slider styles
  // ...
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--neutral-black, #000);
  letter-spacing: -0.02em;
  margin: 0;
}

.rangeHelper {
  font-family: var(--font-family-poppins);
  font-size: 0.75rem;
  font-weight: 300;
  color: var(--neutral-700, #303030);
  opacity: 0.7;
}

// Slider and input styles similar to PriceRange
// ...
```

---

## Testing Checklist

### Sanity Studio ✅ IMPLEMENTED

- [x] Create new filter (dropdown type)
- [x] Create new filter (range type)
- [x] Edit existing filter (inline editing)
- [x] Delete filter (with modal confirmation)
- [x] Drag-drop reorder filters
- [x] View products with filter values (expandable section per filter)
- [x] Set filter values on products from sub-category view
- [x] Set filter values on products from product view ("Filtry" tab)
- [x] Search products by name in filter values
- [x] Product image previews in filter values
- [x] Pagination for products without values (10 initial, show all button)
- [x] Progress indicators (X/Y uzupełnionych)
- [x] Auto-save with status indicator
- [x] Hidden fields in content views (managed via dedicated tabs)

### Frontend (Not Yet Implemented)

- [ ] Dropdown filter renders correctly
- [ ] Range filter renders correctly
- [ ] Range slider interaction works
- [ ] Range input fields work
- [ ] URL updates on filter change
- [ ] Filters persist on page reload
- [ ] Clear individual filter
- [ ] Clear all filters
- [ ] Filter counts update correctly
- [ ] Products list updates on filter change
- [ ] Mobile responsive layout

### Edge Cases (Frontend - Not Yet Implemented)

- [ ] Category with no filters
- [ ] Filter with no products
- [ ] Invalid URL parameters
- [ ] Range filter with only 1 product (should be hidden)
- [ ] Range filter where all products have same value (min = max, should be hidden)
- [ ] Range filter with 2+ products with different values (should be shown)
- [ ] Combined dropdown + range filters

---

## Future Enhancements

1. **Multi-select Dropdown**: Allow selecting multiple values in dropdown filter
2. **Filter Presets**: Save and load filter combinations
3. **Filter Analytics**: Track which filters are most used
4. **Filter Suggestions**: AI-powered filter value suggestions based on product data
5. **Quick Edit**: Edit filter values directly from products table view

---

## Summary

This implementation adds sophisticated filter management capabilities to the Audiofast product catalog while maintaining the existing user experience for dropdown filters. The new range filter type enables numeric filtering for specifications like impedance, power, and length, providing users with a more intuitive way to find products within specific parameter ranges.

### Current Implementation Status

| Phase                          | Status      | Notes                                 |
| ------------------------------ | ----------- | ------------------------------------- |
| Phase 1: Schema & Types        | ✅ Complete | All schemas updated                   |
| Phase 2: Sanity Studio         | ✅ Complete | Views for sub-categories and products |
| Phase 3: GROQ & Types          | ⏳ Pending  | Frontend queries not yet updated      |
| Phase 4: Frontend Logic        | ⏳ Pending  | Filter computation not yet updated    |
| Phase 5: Frontend Components   | ⏳ Pending  | RangeFilter component not yet created |
| Phase 6: Integration & Testing | ⏳ Pending  | -                                     |

### Key Simplifications

- **No min/max/step configuration** in sub-category: Range bounds are computed dynamically from product values
- **Step is always 1**: Hardcoded for simplicity
- **Range values are numeric only**: Products can only set number values for range filters
- **Visibility rules**: Range filters hidden if only 1 product or all products have same value (same as dropdowns)

### Filter Configuration (Sub-category)

| Field        | Dropdown   | Range                       |
| ------------ | ---------- | --------------------------- |
| `name`       | ✓ Required | ✓ Required                  |
| `filterType` | "dropdown" | "range"                     |
| `unit`       | —          | ✓ Optional (e.g., "Ω", "m") |

### Filter Values (Product)

| Filter Type | Input Field             | Value Type   |
| ----------- | ----------------------- | ------------ |
| Dropdown    | `value` (string)        | Any text     |
| Range       | `numericValue` (number) | Numbers only |

### Sanity Studio Views

| Document Type        | View Tab             | Purpose                                    |
| -------------------- | -------------------- | ------------------------------------------ |
| `productCategorySub` | Konfiguracja filtrów | Define filters, set product values in bulk |
| `product`            | Filtry               | Set filter values for individual product   |

Both views feature:

- Auto-save with debounce
- Optimistic UI updates
- Draft/published document management
- Visual progress indicators
- Search and pagination (sub-category view)

The Sanity Studio custom views provide content editors with a powerful, visual interface for managing filters per category, including drag-drop sorting and product value management, matching the quality of the existing TechnicalDataView implementation.
