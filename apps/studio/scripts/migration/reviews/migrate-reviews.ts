#!/usr/bin/env bun
/**
 * Review Migration Script
 *
 * Migrates reviews from legacy CSV to Sanity CMS
 *
 * Usage:
 *   # Dry run (preview without changes)
 *   bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv --dry-run
 *
 *   # Skip existing reviews
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv --skip-existing
 *
 *   # Migrate all (createOrReplace)
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv
 *
 *   # Limit to first N reviews
 *   bun run ... --limit=10
 *
 *   # Start from a minimum ID
 *   bun run ... --min-id=2845
 *
 *   # Rollback migrated reviews
 *   SANITY_API_TOKEN="xxx" bun run ... --rollback
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SanityClient } from "@sanity/client";

import { createDryRunAuthorMappings,loadAuthorMappings } from "./transformers/author-resolver";
import { transformReview, validateReviewDocument } from "./transformers/review-transformer";
import type { MigrationOptions, MigrationResult, ReviewCsvRow, SanityReviewDocument } from "./types";
import { loadImageCache, saveImageCache } from "./utils/asset-uploader";
import { filterReviews, readReviewsCsv } from "./utils/csv-parser";
import { createDryRunClient, createMigrationClient, getClientConfig } from "./utils/sanity-client";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const getArg = (prefix: string): string | undefined => {
    const arg = args.find((a) => a.startsWith(`${prefix}=`));
    return arg ? arg.replace(`${prefix}=`, "") : undefined;
  };

  const hasFlag = (flag: string): boolean => {
    return args.includes(flag) || args.includes(`--${flag}`);
  };

  return {
    csvPath: getArg("--csv") || "./csv/reviews/reviews-all.csv",
    dryRun: hasFlag("--dry-run") || hasFlag("-d"),
    verbose: hasFlag("--verbose") || hasFlag("-v"),
    limit: getArg("--limit") ? parseInt(getArg("--limit")!, 10) : undefined,
    minId: getArg("--min-id") ? parseInt(getArg("--min-id")!, 10) : undefined,
    skipExisting: hasFlag("--skip-existing"),
    batchSize: getArg("--batch-size") ? parseInt(getArg("--batch-size")!, 10) : 50,
    rollback: hasFlag("--rollback"),
    reportPath: getArg("--report") || undefined,
  };
}

// ============================================================================
// Sanity Operations
// ============================================================================

/**
 * Fetch existing review IDs from Sanity
 */
async function fetchExistingReviewIds(client: SanityClient): Promise<Set<string>> {
  console.log("\n🔍 Fetching existing review IDs from Sanity...");

  const ids = await client.fetch<string[]>(
    '*[_type == "review" && !(_id match "drafts.*")]._id',
  );

  console.log(`   Found ${ids.length} existing reviews in Sanity`);
  return new Set(ids);
}

/**
 * Rollback migrated reviews (delete by pattern)
 */
async function rollbackReviews(client: SanityClient): Promise<void> {
  console.log("\n🔄 Rolling back migrated reviews...");

  // Find all reviews with legacy ID pattern
  const ids = await client.fetch<string[]>(
    '*[_type == "review" && _id match "review-*" && !(_id match "drafts.*")]._id',
  );

  if (ids.length === 0) {
    console.log("   No reviews found to rollback");
    return;
  }

  console.log(`   Found ${ids.length} reviews to delete`);

  // Delete in batches
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const transaction = client.transaction();

    for (const id of batch) {
      transaction.delete(id);
    }

    await transaction.commit();
    console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)}`);
  }

  console.log(`   ✓ Rolled back ${ids.length} reviews`);
}

/**
 * Migrate reviews in batches
 */
async function migrateReviews(
  client: SanityClient | null,
  documents: SanityReviewDocument[],
  options: MigrationOptions,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  if (documents.length === 0) {
    console.log("   No documents to migrate");
    return result;
  }

  if (options.dryRun) {
    console.log("\n🧪 DRY RUN - No changes will be made");

    for (const doc of documents) {
      const validation = validateReviewDocument(doc);
      if (validation.valid) {
        result.created.push(doc._id);
        if (options.verbose) {
          console.log(`\n${doc._id}:`);
          console.log(JSON.stringify(doc, null, 2));
        }
      } else {
        result.errors.push({
          reviewId: doc._id,
          reviewTitle: doc.title[0]?.children[0]?.text || "Unknown",
          error: validation.errors.join(", "),
        });
      }
    }

    console.log(`\n   Would create/update ${result.created.length} reviews`);
    if (result.errors.length > 0) {
      console.log(`   ${result.errors.length} reviews have validation errors`);
    }

    return result;
  }

  // Live migration
  console.log(`\n🚀 Migrating ${documents.length} reviews to Sanity...`);

  const batchSize = options.batchSize;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(documents.length / batchSize);

    console.log(`\n   Batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);

    const transaction = client!.transaction();
    for (const doc of batch) {
      transaction.createOrReplace(doc);
    }

    try {
      await transaction.commit();

      for (const doc of batch) {
        result.created.push(doc._id);
        if (options.verbose) {
          console.log(`      ✓ ${doc._id}`);
        }
      }
    } catch (err) {
      console.error(`   ❌ Batch failed:`, err instanceof Error ? err.message : err);

      // Fallback to individual documents
      console.log("   Falling back to individual migration...");

      for (const doc of batch) {
        try {
          await client!.createOrReplace(doc);
          result.created.push(doc._id);
          if (options.verbose) {
            console.log(`      ✓ ${doc._id}`);
          }
        } catch (docErr) {
          result.errors.push({
            reviewId: doc._id,
            reviewTitle: doc.title[0]?.children[0]?.text || "Unknown",
            error: docErr instanceof Error ? docErr.message : String(docErr),
          });
          console.error(`      ❌ ${doc._id}: ${docErr instanceof Error ? docErr.message : docErr}`);
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(
  result: MigrationResult,
  options: MigrationOptions,
): void {
  const reportPath = options.reportPath || `apps/studio/scripts/migration/reviews/migration-report-${Date.now()}.json`;

  const report = {
    timestamp: new Date().toISOString(),
    options: {
      csvPath: options.csvPath,
      dryRun: options.dryRun,
      skipExisting: options.skipExisting,
      limit: options.limit,
      minId: options.minId,
    },
    summary: {
      created: result.created.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    },
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors,
  };

  writeFileSync(resolve(process.cwd(), reportPath), JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log("");
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║            AUDIOFAST DATA MIGRATION                           ║",
  );
  console.log(
    "║            Reviews (Restructured)                             ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");

  // Print configuration
  const config = getClientConfig();
  console.log(`📋 Configuration:`);
  console.log(`   Project: ${config.projectId}`);
  console.log(`   Dataset: ${config.dataset}`);
  console.log(`   CSV Path: ${resolve(process.cwd(), options.csvPath)}`);
  console.log(`   Mode: ${options.dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`   Skip Existing: ${options.skipExisting}`);
  if (options.limit) console.log(`   Limit: ${options.limit}`);
  if (options.minId) console.log(`   Min ID: ${options.minId}`);
  console.log(`   Batch Size: ${options.batchSize}`);

  // Create client
  let client: SanityClient | null = null;

  if (!options.dryRun) {
    if (!process.env.SANITY_API_TOKEN) {
      throw new Error(
        "SANITY_API_TOKEN environment variable is required for live migration.\n" +
        "Set it with: SANITY_API_TOKEN='your-token' bun run ...",
      );
    }
    client = createMigrationClient();
  } else {
    client = createDryRunClient();
  }

  // Handle rollback
  if (options.rollback) {
    if (options.dryRun) {
      console.log("\n⚠️  Cannot rollback in dry-run mode");
      return;
    }
    await rollbackReviews(client!);
    return;
  }

  // Load image cache
  loadImageCache();

  // Read CSV
  const allRows = readReviewsCsv(options.csvPath);

  // Fetch existing reviews if skip-existing is enabled
  let skipIds: Set<string> | undefined;
  if (options.skipExisting && !options.dryRun) {
    skipIds = await fetchExistingReviewIds(client!);
  }

  // Filter reviews
  const rows = filterReviews(allRows, {
    minId: options.minId,
    limit: options.limit,
    skipIds,
  });

  if (rows.length === 0) {
    console.log("\nℹ️  No reviews to migrate after filtering");
    return;
  }

  console.log(`\n📝 Processing ${rows.length} reviews...`);

  // Load author mappings
  if (options.dryRun) {
    const uniqueAuthors = [...new Set(rows.map((r) => r.AuthorName).filter(Boolean))];
    createDryRunAuthorMappings(uniqueAuthors);
  } else {
    await loadAuthorMappings(client!);
  }

  // Transform reviews
  const documents: SanityReviewDocument[] = [];
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const doc = await transformReview(row, client, options.dryRun, options.verbose);
      if (doc) {
        documents.push(doc);
        processed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`   ❌ Error transforming review ${row.ID}:`, err instanceof Error ? err.message : err);
      failed++;
    }

    // Progress indicator
    if ((processed + failed) % 50 === 0) {
      console.log(`   Processed ${processed + failed}/${rows.length}...`);
    }
  }

  console.log(`\n   Transformed ${documents.length} valid documents (${failed} failed)`);

  // Migrate
  const result = await migrateReviews(client, documents, options);

  // Save image cache
  if (!options.dryRun) {
    saveImageCache();
  }

  // Summary
  console.log("\n" + "═".repeat(65));
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Created/Updated: ${result.created.length}`);
  console.log(`   ⏭️  Skipped: ${result.skipped.length}`);
  console.log(`   ❌ Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`   - ${err.reviewId}: ${err.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more errors`);
    }
  }

  // Generate report if requested or if there are errors
  if (options.reportPath || result.errors.length > 0) {
    generateReport(result, options);
  }

  console.log("\n✅ Review migration complete.");
}

// Run
main().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
