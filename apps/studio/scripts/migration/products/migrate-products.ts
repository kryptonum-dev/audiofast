#!/usr/bin/env bun
/**
 * Product Migration Script (Batch)
 *
 * Migrates all products from legacy database (via CSVs) to Sanity.
 * 
 * Usage:
 *   bun run migrate-products.ts
 *   bun run migrate-products.ts --dry-run
 *   bun run migrate-products.ts --limit=10
 *   bun run migrate-products.ts --skip-existing
 *   bun run migrate-products.ts --batch-size=20
 *
 * Environment Variables:
 *   SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
 *   SANITY_DATASET     - Sanity dataset (default: production)
 *   SANITY_API_TOKEN   - Sanity API token (required for live migration)
 */

import type { SanityClient } from '@sanity/client';

import type {
  ImageCache,
  MigrationOptions,
  MigrationResult,
  ProductMainRow,
  ProductSourceData,
  SanityProduct,
} from './types';
import {
  getProductSummary,
  transformProduct,
  validateProduct,
} from './transformers/product-transformer';
import {
  clearReferenceMappings,
  createDryRunMappings,
  loadReferenceMappings,
  printReferenceStats,
} from './transformers/reference-resolver';
import {
  buildProductSourceData,
  indexDataByProductId,
  loadAllCsvData,
  type IndexedProductData,
  type LoadedCsvData,
} from './utils/csv-parser';
import {
  loadImageCache,
  saveImageCache,
} from './utils/image-optimizer';
import { createDryRunClient, createMigrationClient, getClientConfig } from './utils/sanity-client';

// ============================================================================
// CLI Options
// ============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
  const productIdArg = args.find((arg) => arg.startsWith('--id='));

  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : undefined,
    productId: productIdArg ? productIdArg.replace('--id=', '') : undefined,
    skipExisting: args.includes('--skip-existing'),
    batchSize: batchSizeArg ? parseInt(batchSizeArg.replace('--batch-size=', ''), 10) : 10,
    rollback: args.includes('--rollback'),
  };
}

function printUsage(): void {
  console.log(`
Usage:
  bun run migrate-products.ts [options]

Options:
  --dry-run         Preview without making changes to Sanity
  --limit=N         Migrate only first N products
  --id=<id>         Migrate a specific product by ID
  --skip-existing   Skip products that already exist in Sanity
  --batch-size=N    Process N products per batch (default: 10)
  --verbose         Show detailed output
  --rollback        Delete all migrated products (use with caution!)

Environment Variables:
  SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
  SANITY_DATASET     - Sanity dataset (default: production)
  SANITY_API_TOKEN   - Sanity API token (required for live migration)

Examples:
  bun run migrate-products.ts --dry-run
  bun run migrate-products.ts --limit=5 --verbose
  bun run migrate-products.ts --skip-existing
  `);
}

// ============================================================================
// Existing Products Check
// ============================================================================

async function getExistingProductIds(client: SanityClient): Promise<Set<string>> {
  console.log('🔍 Checking for existing products in Sanity...');
  
  const existingProducts = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "product" && _id match "product-*"]{_id}`
  );
  
  const ids = new Set(existingProducts.map((p) => p._id));
  console.log(`   Found ${ids.size} existing products`);
  return ids;
}

// ============================================================================
// Rollback
// ============================================================================

async function rollbackMigration(client: SanityClient): Promise<void> {
  console.log('\n⚠️  ROLLBACK MODE - Deleting all migrated products...');
  
  const productIds = await client.fetch<string[]>(
    `*[_type == "product" && _id match "product-*"]._id`
  );
  
  if (productIds.length === 0) {
    console.log('   No migrated products found.');
    return;
  }
  
  console.log(`   Found ${productIds.length} products to delete`);
  console.log('   Press Ctrl+C within 5 seconds to cancel...');
  
  await new Promise((resolve) => setTimeout(resolve, 5000));
  
  console.log('   Deleting products...');
  
  // Delete in batches
  const batchSize = 100;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const transaction = client.transaction();
    for (const id of batch) {
      transaction.delete(id);
    }
    await transaction.commit();
    console.log(`   Deleted ${Math.min(i + batchSize, productIds.length)}/${productIds.length}`);
  }
  
  console.log('✅ Rollback complete');
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processBatch(
  products: ProductSourceData[],
  client: SanityClient | null,
  imageCache: ImageCache,
  options: MigrationOptions,
  result: MigrationResult
): Promise<void> {
  for (const source of products) {
    const productLogPrefix = `[${source.id}] ${source.name}`;
    
    try {
      // Transform
      const product = await transformProduct(source, {
        dryRun: options.dryRun,
        client,
        imageCache,
        verbose: options.verbose,
      });

      // Validate
      const validation = validateProduct(product);
      if (!validation.valid) {
        console.log(`   ⚠️  ${productLogPrefix} - Validation errors: ${validation.errors.join(', ')}`);
      }

      // Save
      if (!options.dryRun && client) {
        await client.createOrReplace(product);
        result.created.push(source.id);
        console.log(`   ✅ ${productLogPrefix}`);
      } else {
        result.created.push(source.id);
        console.log(`   🧪 ${productLogPrefix} (dry run)`);
      }

      // Log summary in verbose mode
      if (options.verbose) {
        console.log(`      ${getProductSummary(product)}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        productId: source.id,
        productName: source.name,
        error: errorMsg,
      });
      console.error(`   ❌ ${productLogPrefix} - ${errorMsg}`);
    }
  }
}

// ============================================================================
// Main Migration
// ============================================================================

async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  const result: MigrationResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  // Load CSV data
  const csvData = loadAllCsvData();
  const indexed = indexDataByProductId(csvData);

  // Determine products to migrate
  let productsToMigrate: ProductMainRow[] = csvData.mainProducts;
  
  // Filter by specific ID if provided
  if (options.productId) {
    productsToMigrate = productsToMigrate.filter((p) => p.ProductID === options.productId);
    if (productsToMigrate.length === 0) {
      console.error(`\n❌ Product not found: ${options.productId}`);
      return result;
    }
  }
  
  // Apply limit
  if (options.limit) {
    productsToMigrate = productsToMigrate.slice(0, options.limit);
  }

  console.log(`\n📦 Products to migrate: ${productsToMigrate.length}`);

  // Create client
  let client: SanityClient | null = null;
  if (!options.dryRun) {
    try {
      client = createMigrationClient();
    } catch (error) {
      console.error(`\n❌ Failed to create Sanity client: ${error}`);
      throw error;
    }
  } else {
    client = createDryRunClient();
  }

  // Handle rollback
  if (options.rollback && !options.dryRun) {
    await rollbackMigration(client!);
    return result;
  }

  // Check for existing products if skip-existing is set
  let existingIds = new Set<string>();
  if (options.skipExisting && !options.dryRun) {
    existingIds = await getExistingProductIds(client!);
  }

  // Load reference mappings
  console.log('\n');
  if (options.dryRun) {
    const allBrandSlugs = [...new Set(csvData.mainProducts.map((p) => p.BrandSlug))];
    const allCategorySlugs = [...new Set(csvData.categories.map((c) => c.CategorySlug))];
    const allReviewSlugs = [...new Set(csvData.reviews.map((r) => r.ReviewSlug))];
    createDryRunMappings(allBrandSlugs, allCategorySlugs, allReviewSlugs);
    console.log('✓ Created mock reference mappings for dry run');
  } else {
    await loadReferenceMappings(client!);
  }
  printReferenceStats();

  // Load image cache
  const imageCache: ImageCache = options.dryRun ? {} : loadImageCache();
  console.log(`\n✓ Image cache loaded (${Object.keys(imageCache).length} cached images)`);

  // Build source data and filter
  const sourcesToMigrate: ProductSourceData[] = [];
  for (const mainRow of productsToMigrate) {
    const productId = `product-${mainRow.ProductID}`;
    
    if (options.skipExisting && existingIds.has(productId)) {
      result.skipped.push(mainRow.ProductID);
      continue;
    }
    
    sourcesToMigrate.push(buildProductSourceData(mainRow, indexed));
  }

  if (result.skipped.length > 0) {
    console.log(`\n⏭️  Skipping ${result.skipped.length} existing products`);
  }

  console.log(`\n🚀 Migrating ${sourcesToMigrate.length} products...\n`);

  // Process in batches
  const batchCount = Math.ceil(sourcesToMigrate.length / options.batchSize);
  for (let i = 0; i < sourcesToMigrate.length; i += options.batchSize) {
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const batch = sourcesToMigrate.slice(i, i + options.batchSize);
    
    console.log(`\n📦 Batch ${batchNum}/${batchCount} (${batch.length} products)`);
    await processBatch(batch, options.dryRun ? null : client, imageCache, options, result);
    
    // Save image cache after each batch
    if (!options.dryRun) {
      saveImageCache(imageCache);
    }
  }

  return result;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║             AUDIOFAST PRODUCT MIGRATION (Batch)               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Mode: ${options.dryRun ? '🧪 DRY RUN (no writes)' : '🚀 LIVE'}`);
  console.log(`Skip Existing: ${options.skipExisting ? 'Yes' : 'No'}`);
  console.log(`Batch Size: ${options.batchSize}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  if (options.productId) console.log(`Product ID: ${options.productId}`);
  if (options.rollback) console.log(`Mode: ⚠️  ROLLBACK`);

  const clientConfig = getClientConfig();
  console.log(`Project: ${clientConfig.projectId} / ${clientConfig.dataset}`);

  const startTime = Date.now();

  try {
    const result = await runMigration(options);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      MIGRATION SUMMARY                         ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Created: ${result.created.length}`);
    console.log(`   Updated: ${result.updated.length}`);
    console.log(`   Skipped: ${result.skipped.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const err of result.errors) {
        console.log(`   [${err.productId}] ${err.productName}: ${err.error}`);
      }
    }

    console.log('\n');
    if (options.dryRun) {
      console.log('✅ Dry run complete. No changes were made to Sanity.');
    } else {
      console.log('✅ Migration complete.');
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    clearReferenceMappings();
  }
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

