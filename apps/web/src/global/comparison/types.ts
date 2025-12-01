import type { PortableTextBlock } from '@portabletext/react';

import type { SanityProjectedImage } from '@/src/components/shared/Image';

/**
 * Cookie structure for storing comparison data
 */
export type ComparisonCookie = {
  categorySlug: string;
  productIds: string[];
  timestamp: number;
};

/**
 * Technical data value (cell content)
 */
export type TechnicalDataValue = {
  _key: string;
  content: PortableTextBlock[];
};

/**
 * Technical data row (parameter with values for each variant)
 */
export type TechnicalDataRow = {
  _key: string;
  title: string;
  values: TechnicalDataValue[];
};

/**
 * Technical data group (section with optional title)
 */
export type TechnicalDataGroup = {
  _key: string;
  title: string | null;
  rows: TechnicalDataRow[];
};

/**
 * Complete technical data structure
 */
export type TechnicalData = {
  variants: string[] | null;
  groups: TechnicalDataGroup[] | null;
};

/**
 * Product data structure for comparison
 * Used for both products in comparison AND available products in selector
 * All products have full data (including technical specs) for instant add/remove
 */
export type ComparisonProduct = {
  _id: string;
  name: string;
  slug: string;
  subtitle: string;
  basePriceCents: number | null;
  brand: {
    _id: string;
    name: string;
    slug: string;
    logo: SanityProjectedImage | null;
  };
  mainImage: SanityProjectedImage | null;
  imageSource: 'preview' | 'gallery';
  technicalData: TechnicalData | null;
  categories: Array<{
    slug: string;
  }>;
};

/**
 * A single column in the comparison table
 * Each variant of a product becomes its own column
 */
export type ComparisonColumn = {
  productId: string;
  productIndex: number;
  variantName: string | null; // null for single-model products
  variantIndex: number; // 0 for single-model products
};

/**
 * Enabled parameter from comparator config
 */
export type EnabledParameter = {
  name: string;
  displayName?: string;
};

/**
 * Comparator configuration for a category
 */
export type ComparatorCategoryConfig = {
  categoryId: string;
  enabledParameters: EnabledParameter[];
};

/**
 * Processed comparison table data structure
 */
export type ComparisonTableData = {
  products: ComparisonProduct[];
  columns: ComparisonColumn[];
  comparisonRows: Array<{
    heading: string;
    displayHeading: string; // Can be overridden by displayName from config
    values: Array<PortableTextBlock[] | null>;
  }>;
};
