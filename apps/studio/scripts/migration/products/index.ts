/**
 * Product Migration Module
 * 
 * Exports all utilities and functions for product migration from
 * legacy SilverStripe database to Sanity CMS.
 */

// Types
export * from './types';

// Utilities
export { buildProductSourceData, getProductById,indexDataByProductId, loadAllCsvData } from './utils/csv-parser';
export {
  getLegacyAssetUrl,
  loadImageCache,
  processAndUploadImage,
  processImageDryRun,
  processImageWithFallback,
  saveImageCache,
} from './utils/image-optimizer';
export { createDryRunClient, createMigrationClient, getClientConfig } from './utils/sanity-client';

// Parsers
export {
  createHorizontalLine,
  createMinimalImageBlock,
  createPageBreak,
  createVimeoBlock,
  createYoutubeBlock,
  extractVimeoId,
  extractYouTubeId,
  htmlToPortableText,
} from './parser/html-to-portable-text';

// Transformers
export {
  getProductSummary,
  transformProduct,
  validateProduct,
} from './transformers/product-transformer';
export {
  clearReferenceMappings,
  createDryRunMappings,
  getReferenceMappings,
  loadReferenceMappings,
  printReferenceStats,
  resolveBrandReference,
  resolveCategoryReferences,
  resolveReviewReferences,
  validateReferences,
} from './transformers/reference-resolver';

