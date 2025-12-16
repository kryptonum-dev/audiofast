#!/usr/bin/env bun
/**
 * Award Migration Script
 *
 * Migrates awards from legacy CSV data to Sanity CMS.
 *
 * Usage:
 *   # Dry run (preview without changes)
 *   bun run migrate-awards.ts --dry-run
 *
 *   # Migrate specific award
 *   bun run migrate-awards.ts --id=123
 *
 *   # Migrate with limit
 *   bun run migrate-awards.ts --limit=10
 *
 *   # Full migration
 *   bun run migrate-awards.ts
 *
 *   # Rollback
 *   bun run migrate-awards.ts --rollback
 *
 * Environment Variables:
 *   SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
 *   SANITY_DATASET     - Sanity dataset (default: production)
 *   SANITY_API_TOKEN   - Sanity API token (required for live migration)
 */

import type { SanityClient } from "@sanity/client";

import type {
  AwardSourceData,
  ImageCache,
  MigrationOptions,
  MigrationResult,
  SanityAward,
  SanityReference,
} from "./types";
import {
  buildAwardSourceData,
  getAwardStats,
  indexDataByAwardId,
  loadAllCsvData,
  type LoadedCsvData,
} from "./utils/csv-parser";
import {
  loadImageCache,
  processLogoDryRun,
  processLogoWithFallback,
  saveImageCache,
} from "./utils/image-processor";
import {
  createDryRunClient,
  createMigrationClient,
  getClientConfig,
} from "./utils/sanity-client";

// ============================================================================
// CLI Options
// ============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const idArg = args.find((arg) => arg.startsWith("--id="));
  const batchSizeArg = args.find((arg) => arg.startsWith("--batch-size="));

  return {
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    limit: limitArg
      ? parseInt(limitArg.replace("--limit=", ""), 10)
      : undefined,
    awardId: idArg ? idArg.replace("--id=", "") : undefined,
    skipExisting: args.includes("--skip-existing"),
    batchSize: batchSizeArg
      ? parseInt(batchSizeArg.replace("--batch-size=", ""), 10)
      : 10,
    rollback: args.includes("--rollback"),
  };
}

function printUsage(): void {
  console.log(`
Usage:
  bun run migrate-awards.ts [options]

Options:
  --dry-run           Preview without making changes to Sanity
  --id=<award-id>     Migrate a single award by legacy ID
  --limit=N           Migrate only N awards (for testing)
  --skip-existing     Skip awards that already exist in Sanity
  --batch-size=N      Process N awards per batch (default: 10)
  --verbose           Show detailed output
  --rollback          Delete all migrated awards
  --help              Show this help message

Environment Variables:
  SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
  SANITY_DATASET     - Sanity dataset (default: production)
  SANITY_API_TOKEN   - Sanity API token (required for live migration)

Examples:
  # Dry run to preview all awards
  bun run migrate-awards.ts --dry-run

  # Migrate single award
  bun run migrate-awards.ts --id=1 --verbose

  # Migrate first 10 awards
  bun run migrate-awards.ts --limit=10 --dry-run

  # Full migration
  bun run migrate-awards.ts

  # Rollback all migrated awards
  bun run migrate-awards.ts --rollback
  `);
}

// ============================================================================
// Product Reference Resolution
// ============================================================================

let existingProductIds: Set<string> = new Set();

async function loadExistingProductIds(client: SanityClient): Promise<void> {
  console.log("🔍 Loading existing products from Sanity...");

  const products = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "product" && _id match "product-*"]{_id}`,
  );

  existingProductIds = new Set(products.map((p) => p._id));
  console.log(`   ✓ Found ${existingProductIds.size} existing products`);
}

function resolveProductReferences(productIds: string[]): SanityReference[] {
  const references: SanityReference[] = [];
  const missingProducts: string[] = [];

  for (const legacyId of productIds) {
    const sanityId = `product-${legacyId}`;

    if (existingProductIds.has(sanityId)) {
      references.push({
        _type: "reference",
        _key: `ref-${legacyId}`,
        _ref: sanityId,
      });
    } else {
      missingProducts.push(legacyId);
    }
  }

  if (missingProducts.length > 0 && missingProducts.length <= 5) {
    console.log(
      `      ⚠️  Missing products: ${missingProducts.join(", ")} (skipped)`,
    );
  } else if (missingProducts.length > 5) {
    console.log(
      `      ⚠️  Missing ${missingProducts.length} products (skipped)`,
    );
  }

  return references;
}

// ============================================================================
// Award Transformation
// ============================================================================

async function transformAward(
  source: AwardSourceData,
  options: {
    dryRun: boolean;
    client: SanityClient | null;
    imageCache: ImageCache;
    verbose: boolean;
  },
): Promise<SanityAward> {
  const { dryRun, client, imageCache, verbose } = options;

  const award: SanityAward = {
    _id: `award-${source.id}`,
    _type: "award",
    name: source.name,
  };

  // Process logo
  if (source.logoFilename) {
    if (dryRun) {
      const mockResult = processLogoDryRun(source.logoFilename);
      award.logo = {
        _type: "image",
        asset: { _type: "reference", _ref: mockResult.assetId },
      };
    } else if (client) {
      const logoResult = await processLogoWithFallback(
        source.logoFilename,
        client,
        imageCache,
        verbose,
      );
      if (logoResult) {
        award.logo = {
          _type: "image",
          asset: { _type: "reference", _ref: logoResult.assetId },
        };
      }
    }
  }

  // Resolve product references
  if (source.productIds.length > 0) {
    if (dryRun) {
      // In dry run, create mock references
      award.products = source.productIds.map((id) => ({
        _type: "reference",
        _key: `ref-${id}`,
        _ref: `product-${id}`,
      }));
    } else {
      award.products = resolveProductReferences(source.productIds);
    }
  }

  return award;
}

// ============================================================================
// Existing Awards Check
// ============================================================================

async function getExistingAwardIds(client: SanityClient): Promise<Set<string>> {
  console.log("🔍 Checking for existing awards in Sanity...");

  const existingAwards = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "award" && _id match "award-*"]{_id}`,
  );

  const ids = new Set(existingAwards.map((a) => a._id));
  console.log(`   ✓ Found ${ids.size} existing awards`);
  return ids;
}

// ============================================================================
// Rollback
// ============================================================================

async function rollbackAwards(client: SanityClient): Promise<void> {
  console.log("\n🗑️  Rolling back all migrated awards...");

  const awardsToDelete = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "award" && _id match "award-*"]{_id}`,
  );

  if (awardsToDelete.length === 0) {
    console.log("   No migrated awards found to delete.");
    return;
  }

  console.log(`   Found ${awardsToDelete.length} awards to delete...`);

  // Delete in batches
  const batchSize = 50;
  for (let i = 0; i < awardsToDelete.length; i += batchSize) {
    const batch = awardsToDelete.slice(i, i + batchSize);
    const transaction = client.transaction();

    for (const award of batch) {
      transaction.delete(award._id);
    }

    await transaction.commit();
    console.log(
      `   ✓ Deleted ${Math.min(i + batchSize, awardsToDelete.length)}/${awardsToDelete.length}`,
    );
  }

  console.log("\n✅ Rollback complete.");
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processBatch(
  awards: AwardSourceData[],
  client: SanityClient | null,
  imageCache: ImageCache,
  options: MigrationOptions,
  result: MigrationResult,
): Promise<void> {
  for (const source of awards) {
    const awardLogPrefix = `[${source.id}] ${source.name}`;

    try {
      // Transform
      const award = await transformAward(source, {
        dryRun: options.dryRun,
        client,
        imageCache,
        verbose: options.verbose,
      });

      // Save
      if (!options.dryRun && client) {
        await client.createOrReplace(award);
        result.created.push(source.id);
        console.log(
          `   ✅ ${awardLogPrefix} (${award.products?.length || 0} products)`,
        );
      } else {
        result.created.push(source.id);
        console.log(
          `   🧪 ${awardLogPrefix} (${award.products?.length || 0} products) [dry run]`,
        );
      }

      // Verbose output
      if (options.verbose) {
        console.log(`      Logo: ${source.logoFilename || "none"}`);
        console.log(`      Products: ${source.productIds.length} in CSV`);
        console.log(
          `      Resolved: ${award.products?.length || 0} references`,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        awardId: source.id,
        awardName: source.name,
        error: errorMsg,
      });
      console.error(`   ❌ ${awardLogPrefix} - ${errorMsg}`);
    }
  }
}

// ============================================================================
// Main Migration
// ============================================================================

async function runMigration(
  options: MigrationOptions,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  // Load CSV data
  const csvData = loadAllCsvData();
  const indexed = indexDataByAwardId(csvData);

  // Print statistics
  const stats = getAwardStats(csvData);
  console.log("\n📊 Data Statistics:");
  console.log(`   Total awards: ${stats.totalAwards}`);
  console.log(`   Awards with logos: ${stats.awardsWithLogos}`);
  console.log(`   Total relations: ${stats.totalRelations}`);
  console.log(`   Unique products: ${stats.uniqueProducts}`);
  console.log(`   Avg products/award: ${stats.averageProductsPerAward}`);

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
  if (options.rollback) {
    if (options.dryRun) {
      console.log("\n🧪 [DRY RUN] Would delete all migrated awards");
      return result;
    }
    await rollbackAwards(client!);
    return result;
  }

  // Load existing product IDs for reference resolution
  if (!options.dryRun) {
    await loadExistingProductIds(client!);
  } else {
    console.log("\n🧪 [DRY RUN] Skipping product reference validation");
  }

  // Check for existing awards if skip-existing is set
  let existingAwardIds = new Set<string>();
  if (options.skipExisting && !options.dryRun) {
    existingAwardIds = await getExistingAwardIds(client!);
  }

  // Load image cache
  const imageCache: ImageCache = options.dryRun ? {} : loadImageCache();
  console.log(
    `\n✓ Image cache loaded (${Object.keys(imageCache).length} cached images)`,
  );

  // Build source data for all awards
  let awardsToMigrate = csvData.awards;

  // Filter by single award ID if specified
  if (options.awardId) {
    awardsToMigrate = awardsToMigrate.filter(
      (a) => a.AwardID === options.awardId,
    );
    if (awardsToMigrate.length === 0) {
      console.error(`\n❌ Award not found: ${options.awardId}`);
      console.log("\n📋 Available award IDs (first 20):");
      csvData.awards.slice(0, 20).forEach((a) => {
        console.log(`   [${a.AwardID}] ${a.AwardName}`);
      });
      return result;
    }
  }

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    awardsToMigrate = awardsToMigrate.slice(0, options.limit);
  }

  // Build source data and filter existing
  const sourcesToMigrate: AwardSourceData[] = [];
  for (const mainRow of awardsToMigrate) {
    const awardId = `award-${mainRow.AwardID}`;

    if (options.skipExisting && existingAwardIds.has(awardId)) {
      result.skipped.push(mainRow.AwardID);
      continue;
    }

    sourcesToMigrate.push(buildAwardSourceData(mainRow, indexed));
  }

  if (result.skipped.length > 0) {
    console.log(`\n⏭️  Skipping ${result.skipped.length} existing awards`);
  }

  console.log(`\n🚀 Migrating ${sourcesToMigrate.length} awards...\n`);

  // Process in batches
  const batchCount = Math.ceil(sourcesToMigrate.length / options.batchSize);
  for (let i = 0; i < sourcesToMigrate.length; i += options.batchSize) {
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const batch = sourcesToMigrate.slice(i, i + options.batchSize);

    console.log(
      `\n📦 Batch ${batchNum}/${batchCount} (${batch.length} awards)`,
    );
    await processBatch(
      batch,
      options.dryRun ? null : client,
      imageCache,
      options,
      result,
    );

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

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  console.log("\n");
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║              AUDIOFAST AWARD MIGRATION                        ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");
  console.log(`Mode: ${options.dryRun ? "🧪 DRY RUN (no writes)" : "🚀 LIVE"}`);
  if (options.awardId) {
    console.log(`Single Award: ${options.awardId}`);
  }
  if (options.limit) {
    console.log(`Limit: ${options.limit} awards`);
  }
  console.log(`Skip Existing: ${options.skipExisting ? "Yes" : "No"}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Verbose: ${options.verbose ? "Yes" : "No"}`);
  console.log(`Rollback: ${options.rollback ? "Yes" : "No"}`);

  const clientConfig = getClientConfig();
  console.log(`Project: ${clientConfig.projectId} / ${clientConfig.dataset}`);

  const startTime = Date.now();

  try {
    const result = await runMigration(options);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log("\n");
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log(
      "                      MIGRATION SUMMARY                         ",
    );
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log(`   Duration: ${duration}s`);
    console.log(`   Created: ${result.created.length}`);
    console.log(`   Updated: ${result.updated.length}`);
    console.log(`   Skipped: ${result.skipped.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log("\n❌ Errors:");
      for (const err of result.errors) {
        console.log(`   [${err.awardId}] ${err.awardName}: ${err.error}`);
      }
    }

    console.log("\n");
    if (options.dryRun) {
      console.log("✅ Dry run complete. No changes were made to Sanity.");
    } else if (options.rollback) {
      // Already printed by rollbackAwards
    } else {
      console.log("✅ Migration complete.");
    }
    console.log("");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
