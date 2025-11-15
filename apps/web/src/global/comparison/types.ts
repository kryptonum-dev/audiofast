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
  technicalData: Array<{
    title: string;
    value: PortableTextBlock[];
  }>;
  categories: Array<{
    slug: string;
  }>;
};

/**
 * Processed comparison table data structure
 */
export type ComparisonTableData = {
  products: ComparisonProduct[];
  allHeadings: string[];
  comparisonRows: Array<{
    heading: string;
    values: Array<PortableTextBlock[] | null>;
  }>;
};
