import type {
  ActiveFilters,
  ComputedFilters,
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
    customFilters?: Array<{ filterName: string; value: string }>;
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
    isCPO: activeFilters.isCPO,
  });

  // Compute custom filter values from fully filtered products
  // (custom filters are on category pages where we want cascading behavior)
  const customFilterValues = computeCustomFilterValues(
    fullyFiltered,
    activeFilters.customFilters || [],
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
  };
}

/**
 * Computes available custom filter values
 * KEY RULE: Filter X does NOT reduce options for Filter X
 *
 * For each custom filter, we compute available values by filtering
 * products with all OTHER custom filters (excluding the one being computed)
 *
 * @param products - Products already filtered by non-custom filters
 * @param activeCustomFilters - Currently active custom filter selections
 * @returns Map of filter name → available values
 */
function computeCustomFilterValues(
  products: ProductFilterMetadata[],
  activeCustomFilters: Array<{ filterName: string; value: string }>,
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

    let filteredProducts = products;
    if (otherFilters.length > 0) {
      filteredProducts = products.filter((p) => {
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
