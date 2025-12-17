import type {
  ActiveFilters,
  ActiveRangeFilter,
  ComputedFilters,
  CustomFilterValue,
  ProductFilterMetadata,
} from './types';

/**
 * Filter products by specific criteria (helper for computing filter options)
 */
function filterProducts(
  products: ProductFilterMetadata[],
  options: {
    category?: string | null;
    brands?: string[];
    minPrice?: number;
    maxPrice?: number;
    customFilters?: CustomFilterValue[];
    rangeFilters?: ActiveRangeFilter[];
    isCPO?: boolean;
  },
): ProductFilterMetadata[] {
  let filtered = products;

  // Apply category filter
  // Supports both short slugs ("glosniki") and full paths ("/kategoria/glosniki/")
  if (options.category) {
    const categoryToMatch = options.category;
    // Normalize to check both formats
    const isFullPath = categoryToMatch.startsWith('/kategoria/');
    const fullPath = isFullPath
      ? categoryToMatch
      : `/kategoria/${categoryToMatch}/`;
    const shortSlug = isFullPath
      ? categoryToMatch.replace('/kategoria/', '').replace(/\/$/, '')
      : categoryToMatch;

    filtered = filtered.filter((p) => {
      // Check full path match
      if (p.categorySlug === fullPath) return true;
      if (p.allCategorySlugs?.includes(fullPath)) return true;
      // Check short slug match (extract from full paths)
      const pShortSlug = p.categorySlug
        ?.replace('/kategoria/', '')
        .replace(/\/$/, '');
      if (pShortSlug === shortSlug) return true;
      // Check in all categories
      return p.allCategorySlugs?.some(
        (slug) =>
          slug?.replace('/kategoria/', '').replace(/\/$/, '') === shortSlug,
      );
    });
  }

  // Apply brand filter
  if (options.brands && options.brands.length > 0) {
    filtered = filtered.filter(
      (p) => p.brandSlug && options.brands!.includes(p.brandSlug),
    );
  }

  // Apply price filter
  if (options.minPrice && options.minPrice > 0) {
    filtered = filtered.filter(
      (p) => p.basePriceCents !== null && p.basePriceCents >= options.minPrice!,
    );
  }
  if (options.maxPrice && options.maxPrice < Infinity) {
    filtered = filtered.filter(
      (p) => p.basePriceCents !== null && p.basePriceCents <= options.maxPrice!,
    );
  }

  // Apply custom filters (for category pages)
  if (options.customFilters && options.customFilters.length > 0) {
    filtered = filtered.filter((p) => {
      if (!p.customFilterValues) return false;
      return options.customFilters!.every((activeFilter) =>
        p.customFilterValues?.some(
          (pf) =>
            pf.filterName === activeFilter.filterName &&
            pf.value === activeFilter.value,
        ),
      );
    });
  }

  // Apply range filters
  if (options.rangeFilters && options.rangeFilters.length > 0) {
    filtered = filtered.filter((p) => {
      return options.rangeFilters!.every((rangeFilter) => {
        const productValue = p.customFilterValues?.find(
          (fv) => fv.filterName === rangeFilter.filterName,
        );

        // Product must have a numeric value for this filter
        if (productValue?.numericValue === undefined) return false;

        const value = productValue.numericValue;

        if (
          rangeFilter.minValue !== undefined &&
          value < rangeFilter.minValue
        ) {
          return false;
        }
        if (
          rangeFilter.maxValue !== undefined &&
          value > rangeFilter.maxValue
        ) {
          return false;
        }

        return true;
      });
    });
  }

  // Apply CPO filter
  if (options.isCPO) {
    filtered = filtered.filter((p) => p.isCPO === true);
  }

  return filtered;
}

/**
 * Computes available filter options from product metadata
 * This runs client-side and is instant (~1-2ms for 500+ products)
 *
 * KEY RULE: Filter X does NOT reduce options for Filter X
 * - Brand counts are computed WITHOUT the brand filter applied
 * - Category counts are computed WITHOUT the category filter applied
 * - This allows users to change their selection within a filter type
 *
 * @param allProducts - Array of all products with filter-relevant data
 * @param activeFilters - Currently active filter values from URL
 * @returns Computed filter options with counts
 */
export function computeAvailableFilters(
  allProducts: ProductFilterMetadata[],
  activeFilters: ActiveFilters,
): ComputedFilters {
  // Compute BRAND counts: Apply all filters EXCEPT brands
  // This shows what brands are available if user changes brand selection
  const productsForBrandCounts = filterProducts(allProducts, {
    category: activeFilters.category,
    // brands: EXCLUDED - don't filter by brands when counting brands
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    customFilters: activeFilters.customFilters,
    rangeFilters: activeFilters.rangeFilters,
    isCPO: activeFilters.isCPO,
  });

  const brandCounts = new Map<string, number>();
  productsForBrandCounts.forEach((p) => {
    if (p.brandSlug) {
      brandCounts.set(p.brandSlug, (brandCounts.get(p.brandSlug) || 0) + 1);
    }
  });

  // Compute CATEGORY counts: Apply all filters EXCEPT category
  // This shows what categories are available if user changes category selection
  const productsForCategoryCounts = filterProducts(allProducts, {
    // category: EXCLUDED - don't filter by category when counting categories
    brands: activeFilters.brands,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    customFilters: activeFilters.customFilters,
    rangeFilters: activeFilters.rangeFilters,
    isCPO: activeFilters.isCPO,
  });

  const categoryCounts = new Map<string, number>();
  productsForCategoryCounts.forEach((p) => {
    // Count primary category
    if (p.categorySlug) {
      categoryCounts.set(
        p.categorySlug,
        (categoryCounts.get(p.categorySlug) || 0) + 1,
      );
    }
    // Also count all categories (for products with multiple categories)
    p.allCategorySlugs?.forEach((slug) => {
      if (slug && slug !== p.categorySlug) {
        categoryCounts.set(slug, (categoryCounts.get(slug) || 0) + 1);
      }
    });
  });

  // Compute PRICE range: Apply all filters EXCEPT price
  // This shows the available price range if user changes price selection
  const productsForPriceRange = filterProducts(allProducts, {
    category: activeFilters.category,
    brands: activeFilters.brands,
    // minPrice: EXCLUDED
    // maxPrice: EXCLUDED
    customFilters: activeFilters.customFilters,
    rangeFilters: activeFilters.rangeFilters,
    isCPO: activeFilters.isCPO,
  });

  const prices = productsForPriceRange
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);

  const minAvailablePrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxAvailablePrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Compute TOTAL count: Apply ALL filters (this is what actually matches)
  const fullyFiltered = filterProducts(allProducts, {
    category: activeFilters.category,
    brands: activeFilters.brands,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    customFilters: activeFilters.customFilters,
    rangeFilters: activeFilters.rangeFilters,
    isCPO: activeFilters.isCPO,
  });

  // Products filtered by everything EXCEPT custom dropdown filters
  // This is the base for computing dropdown filter options (each dropdown
  // should not affect its own options, only other filters should)
  const productsForDropdownValues = filterProducts(allProducts, {
    category: activeFilters.category,
    brands: activeFilters.brands,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    // customFilters: EXCLUDED - will be applied per-filter inside computeCustomFilterValues
    rangeFilters: activeFilters.rangeFilters,
    isCPO: activeFilters.isCPO,
  });

  // Compute custom filter values
  const customFilterValues = computeCustomFilterValues(
    productsForDropdownValues,
    activeFilters.customFilters || [],
  );

  // Products filtered by everything EXCEPT range filters
  // This is the base for computing range filter bounds (each range filter
  // should not affect its own bounds, only other filters should)
  const productsForRangeBounds = filterProducts(allProducts, {
    category: activeFilters.category,
    brands: activeFilters.brands,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    customFilters: activeFilters.customFilters,
    // rangeFilters: EXCLUDED - will be applied per-filter inside computeRangeFilterBounds
    isCPO: activeFilters.isCPO,
  });

  // Compute range filter bounds
  const rangeFilterBounds = computeRangeFilterBounds(
    productsForRangeBounds,
    activeFilters.rangeFilters || [],
  );

  return {
    brandCounts,
    categoryCounts,
    priceRange: { min: minAvailablePrice, max: maxAvailablePrice },
    totalCount: fullyFiltered.length,
    // "All products" count: filtered by brand/price but NOT by category
    // This is used for the "Wszystkie produkty" option in the sidebar
    allProductsCount: productsForCategoryCounts.length,
    customFilterValues,
    rangeFilterBounds,
  };
}

/**
 * Computes available custom filter values
 * KEY RULE: Filter X does NOT reduce options for Filter X
 *
 * For each custom filter, we compute available values by filtering
 * products with all OTHER custom filters (excluding the one being computed)
 *
 * @param products - Products filtered by category, brand, price, range filters, but NOT dropdown filters
 * @param activeCustomFilters - Currently active custom filter selections (to apply OTHER dropdowns)
 * @returns Map of filter name → available values
 */
function computeCustomFilterValues(
  products: ProductFilterMetadata[],
  activeCustomFilters: Array<CustomFilterValue>,
): Map<string, string[]> {
  // First, collect all unique filter names from products
  const allFilterNames = new Set<string>();
  products.forEach((p) => {
    p.customFilterValues?.forEach((fv) => {
      if (fv.filterName) allFilterNames.add(fv.filterName);
    });
  });

  const result = new Map<string, string[]>();

  // For each filter type, compute available values excluding that filter
  allFilterNames.forEach((filterName) => {
    // Filter products by all OTHER custom filters (not this one)
    const otherFilters = activeCustomFilters.filter(
      (f) => f.filterName !== filterName,
    );

    // Range filters already applied to products, now apply other dropdown filters
    let filteredProducts = products;
    if (otherFilters.length > 0) {
      filteredProducts = filteredProducts.filter((p) => {
        if (!p.customFilterValues) return false;
        return otherFilters.every((activeFilter) =>
          p.customFilterValues?.some(
            (pf) =>
              pf.filterName === activeFilter.filterName &&
              pf.value === activeFilter.value,
          ),
        );
      });
    }

    // Collect available values for this filter from the filtered products
    const values = new Set<string>();
    filteredProducts.forEach((p) => {
      p.customFilterValues?.forEach((fv) => {
        if (fv.filterName === filterName && fv.value) {
          values.add(fv.value);
        }
      });
    });

    result.set(filterName, Array.from(values).sort());
  });

  return result;
}

/**
 * Computes available range filter bounds (min/max) from products
 * KEY RULE: Filter X does NOT reduce options for Filter X
 *
 * For each range filter, we compute bounds by filtering products
 * with all OTHER filters (excluding the current range filter)
 *
 * @param products - Products filtered by category, brand, price, custom filters, but NOT range filters
 * @param activeRangeFilters - Currently active range filters (to apply OTHER range filters)
 */
function computeRangeFilterBounds(
  products: ProductFilterMetadata[],
  activeRangeFilters: Array<ActiveRangeFilter>,
): Map<string, { min: number; max: number; productCount: number }> {
  const allFilterNames = new Set<string>();
  products.forEach((p) => {
    p.customFilterValues?.forEach((fv) => {
      if (fv.filterName && fv.numericValue !== undefined) {
        allFilterNames.add(fv.filterName);
      }
    });
  });

  const result = new Map<
    string,
    { min: number; max: number; productCount: number }
  >();

  allFilterNames.forEach((filterName) => {
    // Filter products by all OTHER range filters (not this one)
    const otherRangeFilters = activeRangeFilters.filter(
      (f) => f.filterName !== filterName,
    );

    // Custom filters already applied to products
    let filteredProducts = products;

    // Apply other range filters
    if (otherRangeFilters.length > 0) {
      filteredProducts = filteredProducts.filter((p) => {
        return otherRangeFilters.every((rangeFilter) => {
          const productValue = p.customFilterValues?.find(
            (fv) => fv.filterName === rangeFilter.filterName,
          );
          if (productValue?.numericValue === undefined) return false;
          const value = productValue.numericValue;
          if (
            rangeFilter.minValue !== undefined &&
            value < rangeFilter.minValue
          )
            return false;
          if (
            rangeFilter.maxValue !== undefined &&
            value > rangeFilter.maxValue
          )
            return false;
          return true;
        });
      });
    }

    // Compute min/max for this filter
    const values = filteredProducts
      .map(
        (p) =>
          p.customFilterValues?.find((fv) => fv.filterName === filterName)
            ?.numericValue,
      )
      .filter((v): v is number => v !== undefined && v !== null);

    if (values.length > 0) {
      result.set(filterName, {
        min: Math.min(...values),
        max: Math.max(...values),
        productCount: values.length,
      });
    }
  });

  return result;
}
