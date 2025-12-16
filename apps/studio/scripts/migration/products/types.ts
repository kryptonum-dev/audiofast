/**
 * Product Migration Types
 * Interfaces for parsing product records from CSV and transforming to Sanity product documents
 */

// ============================================================================
// CSV Row Types (from exported CSVs)
// ============================================================================

export interface ProductMainRow {
  ProductID: string;
  ProductName: string;
  Subtitle: string | null;
  ProductSlug: string;
  IsArchived: string; // '0' or '1'
  IsPublished: string; // '0' or '1'
  IsHidden: string; // '0' or '1'
  MetaDescription: string | null;
  MetaTitle: string | null;
  MainImageID: string | null;
  MainImageFilename: string | null;
  PrimaryCategoryID: string;
  PrimaryCategorySlug: string;
  PrimaryCategoryName: string;
  BrandID: string;
  BrandSlug: string;
  BrandName: string;
}

export interface ProductCategoryRow {
  ProductID: string;
  CategoryID: string;
  CategorySlug: string;
  CategoryName: string;
}

export interface ProductGalleryRow {
  ProductID: string;
  BoxID: string;
  SortOrder: string;
  FileID: string;
  ImageFilename: string;
  ImageTitle: string | null;
}

export interface ProductBoxRow {
  ProductID: string;
  BoxID: string;
  SortOrder: string;
  BoxType: string; // 'text', 'hr', 'video'
  TextContent: string | null;
  VideoUrl: string | null;
}

export interface ProductReviewRow {
  ProductID: string;
  ReviewID: string;
  SortOrder: string;
  ReviewTitle: string;
  ReviewSlug: string;
}

export interface ProductTechnicalDataRow {
  TabID: string;
  BoxID: string;
  ProductID: string;
  ProductName: string;
  ProductSlug: string;
  TabSort: string;
  TabTitle: string | null;
  TabContent: string | null;
}

// ============================================================================
// Processed Data Types
// ============================================================================

export interface ProductSourceData {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  isArchived: boolean;
  isPublished: boolean;
  isHidden: boolean;
  mainImageFilename: string | null;
  brandSlug: string;
  brandName: string;
  categorySlugsByProduct: string[];
  galleryImages: ProductGalleryRow[];
  contentBoxes: ProductBoxRow[];
  reviewRows: ProductReviewRow[];
  technicalDataRows: ProductTechnicalDataRow[];
}

// ============================================================================
// Sanity Document Types
// ============================================================================

export interface PortableTextSpan {
  _type: "span";
  _key: string;
  text: string;
  marks?: string[];
}

export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal" | "h3";
  markDefs: MarkDef[];
  children: PortableTextSpan[];
  listItem?: "bullet" | "number";
  level?: number;
}

export interface MarkDef {
  _type: string;
  _key: string;
  [key: string]: unknown;
}

export interface SanityImageRef {
  _type: "image";
  _key?: string;
  asset: {
    _type: "reference";
    _ref: string;
  };
}

export interface SanityReference {
  _type: "reference";
  _key?: string;
  _ref: string;
}

// Content block types (array items for details.content)
export interface ContentBlockText {
  _type: "contentBlockText";
  _key: string;
  content: PortableTextContent[]; // Portable text inside contentBlockText
}

export interface ContentBlockYoutube {
  _type: "contentBlockYoutube";
  _key: string;
  youtubeId: string;
}

export interface ContentBlockVimeo {
  _type: "contentBlockVimeo";
  _key: string;
  vimeoId: string;
}

export interface ContentBlockHorizontalLine {
  _type: "contentBlockHorizontalLine";
  _key: string;
}

// Types used inside contentBlockText.content (portable text elements)
export interface PtPageBreak {
  _type: "ptPageBreak";
  _key: string;
  style: "columnBreak";
}

export interface PtMinimalImage {
  _type: "ptMinimalImage";
  _key: string;
  image: SanityImageRef;
}

export interface PtYoutubeVideo {
  _type: "ptYoutubeVideo";
  _key: string;
  youtubeId: string;
}

export interface PtVimeoVideo {
  _type: "ptVimeoVideo";
  _key: string;
  vimeoId: string;
}

export interface PtReviewEmbed {
  _type: "ptReviewEmbed";
  _key: string;
  review: SanityReference;
}

export interface PtHorizontalLine {
  _type: "ptHorizontalLine";
  _key: string;
  style?: "horizontalLine";
}

export interface PtInlineImage {
  _type: "ptInlineImage";
  _key: string;
  image: SanityImageRef;
  float: "left" | "right";
  alt?: string;
  width?: number;
}

// Portable text content types (inside contentBlockText)
export type PortableTextContent =
  | PortableTextBlock
  | PtPageBreak
  | PtHorizontalLine
  | PtMinimalImage
  | PtInlineImage
  | PtYoutubeVideo
  | PtVimeoVideo
  | PtReviewEmbed;

// Top-level content blocks (details.content array items)
export type DetailsContentBlock =
  | ContentBlockText
  | ContentBlockYoutube
  | ContentBlockVimeo
  | ContentBlockHorizontalLine;

// ============================================================================
// Technical Data Types
// ============================================================================

/**
 * A single cell value in technical data table
 * Contains Portable Text to support rich formatting
 */
export interface TechnicalDataCellValue {
  _key: string;
  content: PortableTextBlock[];
}

/**
 * A row in technical data table
 * - title: Parameter name (e.g., "Impedancja")
 * - values: Array of values, one per variant (or just one for no-variant tables)
 */
export interface TechnicalDataRow {
  _type: "technicalDataRow";
  _key: string;
  title: string;
  values: TechnicalDataCellValue[];
}

/**
 * A group/section of technical data
 * - title: Optional section title (e.g., "Specyfikacja audio")
 * - rows: Array of parameter rows
 */
export interface TechnicalDataGroup {
  _type: "technicalDataGroup";
  _key: string;
  title?: string;
  rows: TechnicalDataRow[];
}

/**
 * Complete technical data structure for a product
 * - variants: Array of variant names (column headers), empty for simple tables
 * - groups: Array of data groups/sections
 */
export interface TechnicalData {
  variants?: string[];
  groups?: TechnicalDataGroup[];
}

export interface SanityProduct {
  _id: string;
  _type: "product";
  name: string;
  subtitle?: string;
  slug: {
    _type: "slug";
    current: string;
  };
  previewImage?: SanityImageRef;
  imageGallery?: SanityImageRef[];
  isArchived: boolean;
  isCPO: boolean;
  brand?: SanityReference;
  categories?: SanityReference[];
  customFilterValues?: unknown[];
  details?: {
    content?: DetailsContentBlock[];
  };
  technicalData?: TechnicalData;
  reviews?: SanityReference[];
  pageBuilder?: unknown[];
  seo?: {
    title?: string;
    description?: string;
  };
  doNotIndex: boolean;
  hideFromList: boolean;
}

// ============================================================================
// Migration Result Types
// ============================================================================

export interface MigrationResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{
    productId: string;
    productName: string;
    error: string;
  }>;
}

export interface ImageUploadResult {
  assetId: string;
  originalSize: number;
  optimizedSize: number;
  filename: string;
}

export interface ImageCache {
  [sourceUrl: string]: {
    assetId: string;
    originalSize: number;
    optimizedSize: number;
    uploadedAt: string;
  };
}

// ============================================================================
// Reference Mapping Types
// ============================================================================

export interface ReferenceMapping {
  [slug: string]: string; // slug → Sanity document ID
}

export interface ReferenceMappings {
  brands: ReferenceMapping;
  categories: ReferenceMapping;
  reviews: ReferenceMapping;
}

// ============================================================================
// CLI Options
// ============================================================================

export interface MigrationOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  productId?: string;
  skipExisting: boolean;
  batchSize: number;
  rollback: boolean;
}
