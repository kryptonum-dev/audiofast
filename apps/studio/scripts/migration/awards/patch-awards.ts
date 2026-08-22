#!/usr/bin/env bun
/**
 * Award Patch Script
 *
 * Patches existing awards in Sanity to update product references.
 * Does NOT re-upload logos - preserves existing images.
 *
 * Usage:
 *   # Dry run (preview without changes)
 *   bun run patch-awards.ts --dry-run
 *
 *   # Patch specific award
 *   bun run patch-awards.ts --id=123
 *
 *   # Patch with limit
 *   bun run patch-awards.ts --limit=10
 *
 *   # Full patch
 *   bun run patch-awards.ts
 *
 * Environment Variables:
 *   SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
 *   SANITY_DATASET     - Sanity dataset (default: production)
 *   SANITY_API_TOKEN   - Sanity API token (required for live patch)
 */

import { createClient, type SanityClient } from '@sanity/client';

import type { SanityReference } from './types';
import {
  buildAwardSourceData,
  indexDataByAwardId,
  loadAllCsvData,
} from './utils/csv-parser';

// ============================================================================
// Constants
// ============================================================================

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID || 'fsw3likv';
const SANITY_DATASET = process.env.SANITY_DATASET || 'production';
const SANITY_API_VERSION = '2024-01-01';

// ============================================================================
// Types
// ============================================================================

interface PatchOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  awardId?: string;
}

interface SanityAwardState {
  _id: string;
  name: string;
  products: string[] | null; // Array of _ref values
}

interface PatchOperation {
  awardId: string;
  name: string;
  currentProductCount: number;
  newProductCount: number;
  newProductRefs: string[];
  addedProducts: string[];
  removedProducts: string[];
}

interface PatchResult {
  patched: string[];
  skipped: string[];
  errors: Array<{ awardId: string; error: string }>;
}

// ============================================================================
// CLI Options
// ============================================================================

function parseArgs(): PatchOptions {
  const args = process.argv.slice(2);

  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const idArg = args.find((arg) => arg.startsWith('--id='));

  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: limitArg
      ? parseInt(limitArg.replace('--limit=', ''), 10)
      : undefined,
    awardId: idArg ? idArg.replace('--id=', '') : undefined,
  };
}

// ============================================================================
// Sanity Client
// ============================================================================

function createSanityClient(): SanityClient {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    throw new Error(
      'SANITY_API_TOKEN is required. Set it in environment variables.',
    );
  }

  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    token,
    useCdn: false,
  });
}

// ============================================================================
// Product Reference Resolution
// ============================================================================

let existingProductIds: Set<string> = new Set();

async function loadExistingProductIds(client: SanityClient): Promise<void> {
  console.log('🔍 Loading existing products from Sanity...');

  const products = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "product" && _id match "product-*"]{_id}`,
  );

  existingProductIds = new Set(products.map((p) => p._id));
  console.log(`   ✓ Found ${existingProductIds.size} existing products`);
}

function resolveProductReferences(productIds: string[]): {
  validRefs: string[];
  missingProducts: string[];
} {
  const validRefs: string[] = [];
  const missingProducts: string[] = [];

  for (const legacyId of productIds) {
    const sanityId = `product-${legacyId}`;

    if (existingProductIds.has(sanityId)) {
      validRefs.push(sanityId);
    } else {
      missingProducts.push(legacyId);
    }
  }

  return { validRefs, missingProducts };
}

// ============================================================================
// Determine Patch Operations
// ============================================================================

function determinePatchOperations(
  existingAward: SanityAwardState,
  csvProductIds: string[],
): PatchOperation | null {
  const currentRefs = new Set(existingAward.products || []);
  const { validRefs, missingProducts } =
    resolveProductReferences(csvProductIds);
  const newRefs = new Set(validRefs);

  // Find differences
  const addedProducts = [...newRefs].filter((ref) => !currentRefs.has(ref));
  const removedProducts = [...currentRefs].filter((ref) => !newRefs.has(ref));

  // Log missing products (but don't treat as "removed" - they just don't exist)
  if (missingProducts.length > 0 && missingProducts.length <= 5) {
    console.log(
      `      ⚠️  Missing products (not in Sanity): ${missingProducts.join(', ')}`,
    );
  } else if (missingProducts.length > 5) {
    console.log(
      `      ⚠️  ${missingProducts.length} products not found in Sanity`,
    );
  }

  // Only patch if there are differences
  if (addedProducts.length === 0 && removedProducts.length === 0) {
    return null;
  }

  return {
    awardId: existingAward._id.replace('award-', ''),
    name: existingAward.name,
    currentProductCount: currentRefs.size,
    newProductCount: newRefs.size,
    newProductRefs: validRefs,
    addedProducts,
    removedProducts,
  };
}

// ============================================================================
// Generate Key
// ============================================================================

function generateKey(): string {
  return `ref-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Execute Patch
// ============================================================================

async function executePatch(
  client: SanityClient,
  awardId: string,
  newProductRefs: string[],
  operation: PatchOperation,
  dryRun: boolean,
  verbose: boolean,
): Promise<boolean> {
  const awardSanityId = `award-${awardId}`;

  if (verbose) {
    console.log(`   📝 Patching ${awardSanityId}:`);
    console.log(
      `      Products: ${operation.currentProductCount} → ${operation.newProductCount}`,
    );
    if (operation.addedProducts.length > 0) {
      console.log(`      + Added: ${operation.addedProducts.length}`);
    }
    if (operation.removedProducts.length > 0) {
      console.log(`      - Removed: ${operation.removedProducts.length}`);
    }
  }

  if (dryRun) {
    console.log(
      `   🧪 [DRY RUN] Would patch ${awardSanityId} (${operation.currentProductCount} → ${operation.newProductCount} products)`,
    );
    return true;
  }

  try {
    // Build the product references array
    const productRefs: SanityReference[] = newProductRefs.map((ref) => ({
      _type: 'reference',
      _key: generateKey(),
      _ref: ref,
    }));

    await client.patch(awardSanityId).set({ products: productRefs }).commit();

    return true;
  } catch (error) {
    console.error(
      `   ❌ Failed to patch ${awardSanityId}: ${error instanceof Error ? error.message : error}`,
    );
    return false;
  }
}

// ============================================================================
// Main Patch Function
// ============================================================================

async function runPatch(options: PatchOptions): Promise<PatchResult> {
  const result: PatchResult = {
    patched: [],
    skipped: [],
    errors: [],
  };

  // Load CSV data
  console.log('\n📂 Loading CSV data...');
  const csvData = loadAllCsvData();
  const indexed = indexDataByAwardId(csvData);

  console.log(`   ✓ Loaded ${csvData.awards.length} awards`);
  console.log(`   ✓ Loaded ${csvData.relations.length} product relations`);

  // Create Sanity client
  let client: SanityClient;
  try {
    client = createSanityClient();
  } catch (error) {
    if (options.dryRun) {
      // For dry run, we can continue without a real client
      console.log(
        '\n⚠️  No SANITY_API_TOKEN set, but continuing in dry-run mode',
      );
      client = createClient({
        projectId: SANITY_PROJECT_ID,
        dataset: SANITY_DATASET,
        apiVersion: SANITY_API_VERSION,
        useCdn: true,
      });
    } else {
      throw error;
    }
  }

  // Load existing product IDs for reference resolution
  await loadExistingProductIds(client);

  // Fetch existing awards from Sanity
  console.log('\n🔍 Fetching existing awards from Sanity...');
  const existingAwards = await client.fetch<SanityAwardState[]>(
    `*[_type == "award" && _id match "award-*"]{
      _id,
      name,
      "products": products[]._ref
    }`,
  );
  console.log(`   ✓ Found ${existingAwards.length} existing awards`);

  // Build a map of existing awards by ID
  const existingAwardsMap = new Map<string, SanityAwardState>();
  for (const award of existingAwards) {
    const legacyId = award._id.replace('award-', '');
    existingAwardsMap.set(legacyId, award);
  }

  // Filter CSV awards to only those that exist in Sanity
  let awardsToProcess = csvData.awards.filter((row) =>
    existingAwardsMap.has(row.AwardID),
  );

  // Filter by single award ID if specified
  if (options.awardId) {
    awardsToProcess = awardsToProcess.filter(
      (a) => a.AwardID === options.awardId,
    );
    if (awardsToProcess.length === 0) {
      console.error(`\n❌ Award not found: ${options.awardId}`);
      return result;
    }
  }

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    awardsToProcess = awardsToProcess.slice(0, options.limit);
  }

  console.log(
    `\n🔄 Processing ${awardsToProcess.length} awards for patching...\n`,
  );

  // Determine operations needed
  const operations: PatchOperation[] = [];

  for (const csvRow of awardsToProcess) {
    const existingAward = existingAwardsMap.get(csvRow.AwardID);
    if (!existingAward) continue;

    const sourceData = buildAwardSourceData(csvRow, indexed);
    const operation = determinePatchOperations(
      existingAward,
      sourceData.productIds,
    );

    if (operation) {
      operations.push(operation);
    } else {
      result.skipped.push(csvRow.AwardID);
      if (options.verbose) {
        console.log(
          `   ⏭️  ${csvRow.AwardID} "${csvRow.AwardName}" - no changes needed`,
        );
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Awards to patch: ${operations.length}`);
  console.log(`   Awards unchanged: ${result.skipped.length}`);

  if (operations.length === 0) {
    console.log('\n✅ No patches needed. All awards are up to date.');
    return result;
  }

  // Execute patches
  console.log(`\n🚀 Executing patches...\n`);

  for (const operation of operations) {
    const success = await executePatch(
      client,
      operation.awardId,
      operation.newProductRefs,
      operation,
      options.dryRun,
      options.verbose,
    );

    if (success) {
      result.patched.push(operation.awardId);
      if (!options.verbose) {
        console.log(
          `   ✅ award-${operation.awardId} "${operation.name}" (${operation.currentProductCount} → ${operation.newProductCount} products)`,
        );
      }
    } else {
      result.errors.push({
        awardId: operation.awardId,
        error: 'Patch failed',
      });
    }
  }

  return result;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n');
  console.log(
    '╔═══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║              AUDIOFAST AWARD PATCH                            ║',
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════╝',
  );
  console.log('');
  console.log(`Mode: ${options.dryRun ? '🧪 DRY RUN (no writes)' : '🚀 LIVE'}`);
  if (options.awardId) {
    console.log(`Single Award: ${options.awardId}`);
  }
  if (options.limit) {
    console.log(`Limit: ${options.limit} awards`);
  }
  console.log(`Verbose: ${options.verbose ? 'Yes' : 'No'}`);
  console.log(`Project: ${SANITY_PROJECT_ID} / ${SANITY_DATASET}`);

  const startTime = Date.now();

  try {
    const result = await runPatch(options);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log('\n');
    console.log(
      '═══════════════════════════════════════════════════════════════',
    );
    console.log(
      '                      PATCH SUMMARY                             ',
    );
    console.log(
      '═══════════════════════════════════════════════════════════════',
    );
    console.log(`   Duration: ${duration}s`);
    console.log(`   Patched: ${result.patched.length}`);
    console.log(`   Skipped (no changes): ${result.skipped.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const err of result.errors) {
        console.log(`   [${err.awardId}]: ${err.error}`);
      }
    }

    console.log('\n');
    if (options.dryRun) {
      console.log('✅ Dry run complete. No changes were made to Sanity.');
    } else {
      console.log('✅ Patch complete.');
    }
    console.log('');
  } catch (error) {
    console.error('\n❌ Patch failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Patch failed:', error);
  process.exit(1);
});
