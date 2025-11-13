import type {
  ComparisonCookie,
  ComparisonProduct,
  ComparisonTableData,
} from './types';

/**
 * Validate if product can be added to comparison
 */
export function validateProductAddition(
  productId: string,
  categorySlug: string,
  currentComparison: ComparisonCookie | null
): { valid: boolean; error?: string } {
  // Check if already in comparison
  if (currentComparison?.productIds.includes(productId)) {
    return {
      valid: false,
      error: 'Ten produkt jest już w porównaniu',
    };
  }

  // Check max products
  if (currentComparison && currentComparison.productIds.length >= 3) {
    return {
      valid: false,
      error: 'Możesz porównywać maksymalnie 3 produkty',
    };
  }

  // Check category match
  if (currentComparison && currentComparison.categorySlug !== categorySlug) {
    return {
      valid: false,
      error: 'Możesz porównywać tylko produkty z tej samej kategorii',
    };
  }

  return { valid: true };
}

/**
 * Extract all unique headings from products' technical data
 */
export function extractAllHeadings(products: ComparisonProduct[]): string[] {
  const headingsSet = new Set<string>();

  products.forEach((product) => {
    if (product.technicalData && Array.isArray(product.technicalData)) {
      product.technicalData.forEach((item) => {
        if (item.title) {
          headingsSet.add(item.title);
        }
      });
    }
  });

  // Sort alphabetically for consistent display
  return Array.from(headingsSet).sort();
}

/**
 * Create comparison rows with aligned data
 */
export function createComparisonRows(
  products: ComparisonProduct[],
  allHeadings: string[]
): ComparisonTableData['comparisonRows'] {
  return allHeadings.map((heading) => {
    const values = products.map((product) => {
      const technicalItem = product.technicalData?.find(
        (item) => item.title === heading
      );
      return technicalItem?.value || null;
    });

    return {
      heading,
      values,
    };
  });
}

/**
 * Process products into comparison table data
 */
export function processComparisonData(
  products: ComparisonProduct[]
): ComparisonTableData {
  const allHeadings = extractAllHeadings(products);
  const comparisonRows = createComparisonRows(products, allHeadings);

  return {
    products,
    allHeadings,
    comparisonRows,
  };
}
