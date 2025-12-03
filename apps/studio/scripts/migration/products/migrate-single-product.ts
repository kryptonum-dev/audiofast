#!/usr/bin/env bun
/**
 * Single Product Migration Script
 *
 * Migrates one product at a time for testing and validation.
 * Usage:
 *   bun run migrate-single-product.ts --id=506
 *   bun run migrate-single-product.ts --id=506 --dry-run
 *   bun run migrate-single-product.ts --id=506 --verbose
 */

import {
  getProductSummary,
  transformProduct,
  validateProduct,
} from './transformers/product-transformer';
import {
  clearReferenceMappings,
  createDryRunMappings,
  loadLegacyReviewIdMappings,
  loadReferenceMappings,
  printReferenceStats,
} from './transformers/reference-resolver';
import type { ImageCache, SanityProduct } from './types';
import {
  buildProductSourceData,
  indexDataByProductId,
  loadAllCsvData,
} from './utils/csv-parser';
import {
  loadImageCache,
  saveImageCache,
} from './utils/image-optimizer';
import { createMigrationClient, getClientConfig } from './utils/sanity-client';

// ============================================================================
// CLI Options
// ============================================================================

interface CliOptions {
  productId: string;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  
  const productIdArg = args.find((arg) => arg.startsWith('--id='));
  
  if (!productIdArg) {
    console.log(`
Usage:
  bun run migrate-single-product.ts --id=506
  bun run migrate-single-product.ts --id=506 --dry-run
  bun run migrate-single-product.ts --id=506 --verbose

Options:
  --id=<id>       Product ID to migrate (required)
  --dry-run       Preview without making changes
  --verbose       Show detailed output
    `);
    process.exit(1);
  }

  return {
    productId: productIdArg.replace('--id=', ''),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          AUDIOFAST PRODUCT MIGRATION (Single Product)         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Product ID: ${options.productId}`);
  console.log(`Mode: ${options.dryRun ? '🧪 DRY RUN (no writes)' : '🚀 LIVE'}`);
  console.log(`Verbose: ${options.verbose ? 'Yes' : 'No'}`);

  // Get client config
  const clientConfig = getClientConfig();
  console.log(`Project: ${clientConfig.projectId} / ${clientConfig.dataset}`);

  // Load CSV data
  console.log('\n');
  const csvData = loadAllCsvData();
  const indexed = indexDataByProductId(csvData);

  // Find the product
  const mainRow = csvData.mainProducts.find((p) => p.ProductID === options.productId);
  if (!mainRow) {
    console.error(`\n❌ Product not found: ${options.productId}`);
    console.log('\nAvailable product IDs (first 10):');
    csvData.mainProducts.slice(0, 10).forEach((p) => {
      console.log(`   ${p.ProductID}: ${p.ProductName}`);
    });
    process.exit(1);
  }

  // Build source data
  const sourceData = buildProductSourceData(mainRow, indexed);

  // Display source data summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      SOURCE DATA SUMMARY                       ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Name: ${sourceData.name}`);
  console.log(`   Subtitle: ${sourceData.subtitle || '(none)'}`);
  console.log(`   Slug: /produkty/${sourceData.slug}/`);
  console.log(`   Brand: ${sourceData.brandName} (${sourceData.brandSlug})`);
  console.log(`   Main Image: ${sourceData.mainImageFilename || '(none)'}`);
  console.log(`   Gallery Images: ${sourceData.galleryImages.length}`);
  console.log(`   Content Boxes: ${sourceData.contentBoxes.length}`);
  console.log(`   Technical Data Tabs: ${sourceData.technicalDataRows.length}`);
  console.log(`   Categories: ${sourceData.categorySlugsByProduct.join(', ') || '(none)'}`);
  console.log(`   Reviews: ${sourceData.reviewRows.length || 0} (IDs: ${sourceData.reviewRows.map(r => r.ReviewID).join(', ') || '(none)'})`);
  console.log(`   Is Archived: ${sourceData.isArchived}`);
  console.log(`   Is Published: ${sourceData.isPublished}`);
  console.log(`   Is Hidden: ${sourceData.isHidden}`);

  // Create client or null for dry run
  let client = null;
  if (!options.dryRun) {
    try {
      client = createMigrationClient();
      console.log('\n✓ Sanity client created');
    } catch (error) {
      console.error(`\n❌ Failed to create Sanity client: ${error}`);
      process.exit(1);
    }
  }

  // Load reference mappings
  console.log('\n');
  if (options.dryRun) {
    // Create mock mappings for dry run
    const allBrandSlugs = [...new Set(csvData.mainProducts.map((p) => p.BrandSlug))];
    const allCategorySlugs = [...new Set(csvData.categories.map((c) => c.CategorySlug))];
    const allReviewSlugs = [...new Set(csvData.reviews.map((r) => r.ReviewSlug))];
    createDryRunMappings(allBrandSlugs, allCategorySlugs, allReviewSlugs);
    console.log('✓ Created mock reference mappings for dry run');
  } else {
    await loadReferenceMappings(client!);
  }
  // Load legacy review ID mappings (for [recenzja id=X] shortcodes)
  loadLegacyReviewIdMappings();
  printReferenceStats();

  // Load image cache
  const imageCache: ImageCache = options.dryRun ? {} : loadImageCache();
  console.log(`\n✓ Image cache loaded (${Object.keys(imageCache).length} cached images)`);

  // Transform product
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       TRANSFORMATION                          ');
  console.log('═══════════════════════════════════════════════════════════════');

  let product: SanityProduct;
  try {
    product = await transformProduct(sourceData, {
      dryRun: options.dryRun,
      client,
      imageCache,
      verbose: options.verbose,
    });
    console.log('\n✓ Product transformed successfully');
  } catch (error) {
    console.error(`\n❌ Transformation failed: ${error}`);
    process.exit(1);
  }

  // Validate product
  const validation = validateProduct(product);
  if (!validation.valid) {
    console.log('\n⚠️  Validation errors:');
    validation.errors.forEach((e) => console.log(`   ❌ ${e}`));
  }
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Validation warnings:');
    validation.warnings.forEach((w) => console.log(`   ⚠️  ${w}`));
  }

  // Display product summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      PRODUCT SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(getProductSummary(product));

  // Display full document in verbose mode
  if (options.verbose) {
    console.log('\n📄 Full document:');
    console.log(JSON.stringify(product, null, 2));
  }

  // Save to Sanity
  if (!options.dryRun) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      SAVING TO SANITY                         ');
    console.log('═══════════════════════════════════════════════════════════════');

    try {
      await client!.createOrReplace(product);
      console.log(`\n✅ Successfully migrated: ${product.name}`);
    } catch (error) {
      console.error(`\n❌ Failed to save product: ${error}`);
      process.exit(1);
    }

    // Save image cache
    saveImageCache(imageCache);
    console.log(`✓ Image cache saved (${Object.keys(imageCache).length} images)`);
  } else {
    console.log('\n🧪 [DRY RUN] Would save product to Sanity');
  }

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         COMPLETE                              ');
  console.log('═══════════════════════════════════════════════════════════════');
  if (options.dryRun) {
    console.log('✅ Dry run complete. No changes were made to Sanity.');
  } else {
    console.log('✅ Migration complete.');
  }
  console.log('');

  // Cleanup
  clearReferenceMappings();
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

