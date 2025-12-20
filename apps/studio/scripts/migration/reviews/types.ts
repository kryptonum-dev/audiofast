/**
 * Review Migration Types
 * Interfaces for parsing review records from CSV and transforming to Sanity review documents
 */

// ============================================================================
// CSV Row Types (from reviews-all.csv)
// ============================================================================

export interface ReviewCsvRow {
  ID: string;
  Slug: string;
  PageTitle: string;
  MenuTitle: string | null;
  BoxContent: string | null; // Full HTML content from Box table
  Description: string | null; // Short excerpt from LeadingText
  AuthorName: string;
  CoverID: string | null;
  CoverFilename: string | null;
  ArticleDate: string | null;
  ExternalLink: string | null;
  PDFFileID: string | null;
  PDFFilename: string | null;
  ReviewType: "page" | "pdf" | "external";
}

// ============================================================================
// Portable Text Types
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
  style: "normal" | "h2";
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

// Portable text content elements
export interface PtImage {
  _type: "ptImage";
  _key: string;
  layout: "single" | "double";
  image: SanityImageRef;
}

export interface PtHorizontalLine {
  _type: "ptHorizontalLine";
  _key: string;
  style?: "horizontalLine";
}

// Content type for review content field
export type ReviewPortableTextContent = PortableTextBlock | PtImage | PtHorizontalLine;

// ============================================================================
// Image Placeholder (for deferred upload)
// ============================================================================

export interface ImagePlaceholder {
  _type: "imagePlaceholder";
  _key: string;
  src: string;
  alt: string;
}

// ============================================================================
// Sanity Document Types
// ============================================================================

export interface SanityImageRef {
  _type: "image";
  _key?: string;
  asset: {
    _type: "reference";
    _ref: string;
  };
}

export interface SanityFileRef {
  _type: "file";
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

export interface SanitySlug {
  _type: "slug";
  current: string;
}

// ============================================================================
// Sanity Review Document
// ============================================================================

export interface SanityReviewDocument {
  _id: string;
  _type: "review";
  author?: SanityReference;
  destinationType: "page" | "pdf" | "external";
  publishedDate?: string;
  title: PortableTextBlock[];
  description?: PortableTextBlock[];
  image: SanityImageRef;
  // Page type specific
  slug?: SanitySlug;
  content?: ReviewPortableTextContent[];
  overrideGallery?: boolean;
  pageBuilder?: unknown[];
  seo?: {
    title?: string;
    description?: string;
    noIndex?: boolean;
    hideFromList?: boolean;
  };
  // PDF type specific
  pdfSlug?: SanitySlug;
  pdfFile?: SanityFileRef;
  // External type specific
  externalUrl?: string;
}

// ============================================================================
// Migration Result Types
// ============================================================================

export interface MigrationResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{
    reviewId: string;
    reviewTitle: string;
    error: string;
  }>;
}

export interface ImageUploadResult {
  assetId: string;
  originalUrl: string;
  filename: string;
}

export interface ImageCache {
  [sourceUrl: string]: {
    assetId: string;
    uploadedAt: string;
    originalSize?: number;
    optimizedSize?: number;
  };
}

// ============================================================================
// CLI Options
// ============================================================================

export interface MigrationOptions {
  csvPath: string;
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  minId?: number;
  skipExisting: boolean;
  batchSize: number;
  rollback: boolean;
  reportPath?: string;
}
