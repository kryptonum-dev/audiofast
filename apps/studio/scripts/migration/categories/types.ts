/**
 * Types for Category Migration
 * Source: SiteTree (ProductType) + DeviceTypeItem
 * Target: productCategorySub
 */

/**
 * Raw ProductType record from SQL SiteTree table
 */
export interface ProductTypeRecord {
  id: number;
  className: string;
  lastEdited: string;
  created: string;
  urlSegment: string;
  title: string;
  menuTitle: string | null;
  content: string | null;
  metaDescription: string | null;
  showInMenus: number;
  showInSearch: number;
  sort: number;
  hasEmbeddedObjects: number;
  reportClass: number;
  canViewType: string | null;
  canEditType: string;
  version: number;
  parentID: number;
}

/**
 * DeviceTypeItem mapping (links ProductType to DeviceType/parent category)
 */
export interface DeviceTypeItemMapping {
  id: number;
  sort: number;
  deviceTypeId: number; // Parent category ID
  pageId: number; // ProductType page ID
}

/**
 * DeviceType (parent category) from SQL
 */
export interface DeviceTypeRecord {
  id: number;
  className: string;
  name: string;
  icon: string;
  sort: number;
}

/**
 * Parent category mapping to Sanity IDs
 */
export interface ParentCategoryMapping {
  sqlId: number;
  name: string;
  sanityId: string;
}

/**
 * Transformed subcategory for Sanity import
 */
export interface SubCategory {
  _type: "productCategorySub";
  _id: string;
  name: string;
  slug: {
    _type: "slug";
    current: string;
  };
  parentCategory: {
    _type: "reference";
    _ref: string;
  };
  seo: {
    title: string;
    description: string;
  };
  doNotIndex: boolean;
  hideFromList: boolean;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Migration result structure
 */
export interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migratedCount: number;
  failedCount: number;
  errors: Array<{
    recordId: number;
    errors: ValidationError[];
  }>;
  warnings: string[];
}
