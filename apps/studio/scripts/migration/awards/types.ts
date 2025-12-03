/**
 * Award Migration Types
 * Interfaces for parsing award records from CSV and transforming to Sanity award documents
 */

// ============================================================================
// CSV Row Types (from exported CSVs)
// ============================================================================

export interface AwardMainRow {
  AwardID: string;
  AwardName: string;
  LogoID: string;
  LogoFilename: string | null;
}

export interface AwardProductRelationRow {
  AwardID: string;
  ProductID: string;
}

// ============================================================================
// Processed Data Types
// ============================================================================

export interface AwardSourceData {
  id: string;
  name: string;
  logoFilename: string | null;
  productIds: string[];
}

// ============================================================================
// Sanity Document Types
// ============================================================================

export interface SanityImageRef {
  _type: 'image';
  _key?: string;
  asset: {
    _type: 'reference';
    _ref: string;
  };
}

export interface SanityReference {
  _type: 'reference';
  _key: string;
  _ref: string;
}

export interface SanityAward {
  _id: string;
  _type: 'award';
  name: string;
  logo?: SanityImageRef;
  products?: SanityReference[];
}

// ============================================================================
// Migration Result Types
// ============================================================================

export interface MigrationResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{
    awardId: string;
    awardName: string;
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
// CLI Options
// ============================================================================

export interface MigrationOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  awardId?: string;
  skipExisting: boolean;
  batchSize: number;
  rollback: boolean;
}

