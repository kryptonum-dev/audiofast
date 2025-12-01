/**
 * Types for Dealer to Store migration
 */

// Source data from SQL Dealer table
export interface DealerRecord {
  ID: number;
  ClassName: string;
  LastEdited: string;
  Created: string;
  Sort: number;
  Name: string;
  City: string; // Contains "postal_code city" format
  Address: string | null;
  Phone: string;
  DealerPageID: number;
  Street: string;
  Publish: number; // 1 = published, 0 = not published
  Email: string | null;
  WWW: string | null;
  LastEditMemberID: number;
}

// Parsed address from City field
export interface ParsedAddress {
  postalCode: string;
  city: string;
}

// Target Sanity store document
export interface SanityStoreDocument {
  _type: 'store';
  _id: string;
  name: string;
  address: {
    postalCode: string;
    city: string;
    street: string;
  };
  phone: string;
  email?: string;
  website?: string;
}

// Validation error
export interface ValidationError {
  dealerId: number;
  field: string;
  originalValue: unknown;
  error: string;
}

// Migration result for a single record
export interface MigrationResult {
  dealerId: number;
  sanityId: string;
  success: boolean;
  error?: string;
}

// Migration report
export interface MigrationReport {
  totalDealers: number;
  publishedDealers: number;
  successfullyMigrated: number;
  failed: number;
  skipped: number;
  warnings: ValidationError[];
  errors: ValidationError[];
  results: MigrationResult[];
}

// Migration options
export interface MigrationOptions {
  dryRun: boolean;
  sqlFilePath: string;
  verbose: boolean;
}

