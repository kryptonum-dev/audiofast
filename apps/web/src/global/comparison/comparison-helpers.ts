import type { PortableTextBlock } from "@portabletext/react";

import type {
  ComparisonColumn,
  ComparisonCookie,
  ComparisonProduct,
  ComparisonTableData,
  EnabledParameter,
} from "./types";

/**
 * Validate if product can be added to comparison
 */
type ValidationOptions = {
  categoryName?: string;
  productName?: string;
};

export function validateProductAddition(
  productId: string,
  categorySlug: string,
  currentComparison: ComparisonCookie | null,
  options?: ValidationOptions,
): { valid: boolean; error?: string } {
  const categoryName = options?.categoryName;
  const productName = options?.productName;
  // Check if already in comparison
  if (currentComparison?.productIds.includes(productId)) {
    return {
      valid: false,
      error: "Ten produkt jest już w porównaniu",
    };
  }

  // Check max products
  if (currentComparison && currentComparison.productIds.length >= 3) {
    return {
      valid: false,
      error: "Możesz porównywać maksymalnie 3 produkty",
    };
  }

  // Check category match
  if (currentComparison && currentComparison.categorySlug !== categorySlug) {
    const getCategoryLabel = (slug: string, name?: string) =>
      name?.trim() || slug;
    const currentLabel = getCategoryLabel(
      currentComparison.categorySlug,
      currentComparison.categoryName,
    );
    const incomingLabel = getCategoryLabel(categorySlug, categoryName);
    const productLabel = productName
      ? `Produkt "${productName}"`
      : "Ten produkt";

    return {
      valid: false,
      error: `${productLabel} jest w kategorii "${incomingLabel}". Porównywarka zawiera już produkty z kategorii "${currentLabel}".`,
    };
  }

  return { valid: true };
}

/**
 * Get variants for a product (returns null if no variants/single model)
 */
export function getProductVariants(
  product: ComparisonProduct,
): string[] | null {
  const variants = product.technicalData?.variants;
  if (!variants || variants.length === 0) {
    return null;
  }
  return variants;
}

/**
 * Get number of columns a product spans (1 for single-model, N for multi-variant)
 */
export function getProductColumnCount(product: ComparisonProduct): number {
  const variants = getProductVariants(product);
  return variants ? variants.length : 1;
}

/**
 * Create comparison columns from products
 * Each variant of a product becomes its own column
 */
export function createComparisonColumns(
  products: ComparisonProduct[],
): ComparisonColumn[] {
  const columns: ComparisonColumn[] = [];

  products.forEach((product, productIndex) => {
    const variants = getProductVariants(product);

    if (variants) {
      // Multi-variant product: create a column for each variant
      variants.forEach((variantName, variantIndex) => {
        columns.push({
          productId: product._id,
          productIndex,
          variantName,
          variantIndex,
        });
      });
    } else {
      // Single-model product: create one column
      columns.push({
        productId: product._id,
        productIndex,
        variantName: null,
        variantIndex: 0,
      });
    }
  });

  return columns;
}

/**
 * Extract all unique headings from products' technical data (new nested structure)
 */
export function extractAllHeadings(products: ComparisonProduct[]): string[] {
  const headingsSet = new Set<string>();

  products.forEach((product) => {
    const groups = product.technicalData?.groups;
    if (groups && Array.isArray(groups)) {
      groups.forEach((group) => {
        if (group.rows && Array.isArray(group.rows)) {
          group.rows.forEach((row) => {
            if (row.title) {
              headingsSet.add(row.title);
            }
          });
        }
      });
    }
  });

  // Sort alphabetically for consistent display
  return Array.from(headingsSet).sort();
}

/**
 * Find a parameter value for a specific product and variant index
 */
function findParameterValue(
  product: ComparisonProduct,
  parameterName: string,
  variantIndex: number,
): PortableTextBlock[] | null {
  const groups = product.technicalData?.groups;
  if (!groups) return null;

  for (const group of groups) {
    if (!group.rows) continue;

    const row = group.rows.find((r) => r.title === parameterName);
    if (row && row.values && row.values[variantIndex]) {
      const value = row.values[variantIndex];
      // Check if content exists and is not empty
      if (value.content && value.content.length > 0) {
        return value.content;
      }
    }
  }

  return null;
}

/**
 * Create comparison rows with aligned data for all columns
 */
export function createComparisonRows(
  products: ComparisonProduct[],
  columns: ComparisonColumn[],
  headings: string[],
  enabledParameters?: EnabledParameter[],
): ComparisonTableData["comparisonRows"] {
  // If enabledParameters is provided (even if empty), use it as the source of truth
  // Only fall back to all headings if enabledParameters is undefined/null (no config exists)
  const orderedHeadings =
    enabledParameters !== undefined && enabledParameters !== null
      ? enabledParameters
          .map((param) => param.name)
          .filter((name) => headings.includes(name))
      : headings;

  // Create a map for display names
  const displayNameMap = new Map<string, string>();
  if (enabledParameters) {
    enabledParameters.forEach((param) => {
      if (param.displayName) {
        displayNameMap.set(param.name, param.displayName);
      }
    });
  }

  return orderedHeadings.map((heading) => {
    const values = columns.map((column) => {
      const product = products[column.productIndex];
      if (!product) return null;

      return findParameterValue(product, heading, column.variantIndex);
    });

    return {
      heading,
      displayHeading: displayNameMap.get(heading) || heading,
      values,
    };
  });
}

/**
 * Process products into comparison table data
 * @param products - Array of products to compare
 * @param enabledParameters - Optional array of enabled parameters from comparator config
 */
export function processComparisonData(
  products: ComparisonProduct[],
  enabledParameters?: EnabledParameter[],
): ComparisonTableData {
  const columns = createComparisonColumns(products);
  const allHeadings = extractAllHeadings(products);
  const comparisonRows = createComparisonRows(
    products,
    columns,
    allHeadings,
    enabledParameters,
  );

  return {
    products,
    columns,
    comparisonRows,
  };
}
