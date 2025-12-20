#!/usr/bin/env bun
/**
 * Migrate Product Creation Dates
 *
 * This script updates the publishedDate field for all products
 * with their original creation dates from the legacy SilverStripe database.
 *
 * Usage:
 *   # Dry run (preview changes)
 *   bun run apps/studio/scripts/migration/products/migrate-creation-dates.ts --dry-run
 *
 *   # Live migration
 *   SANITY_API_TOKEN=xxx bun run apps/studio/scripts/migration/products/migrate-creation-dates.ts
 *
 *   # Verbose output
 *   SANITY_API_TOKEN=xxx bun run apps/studio/scripts/migration/products/migrate-creation-dates.ts --verbose
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@sanity/client";
import { parse } from "csv-parse/sync";

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = resolve(
  __dirname,
  "../../../../../csv/products/december/products-creation-dates.csv",
);

const client = createClient({
  projectId: "fsw3likv",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// ============================================================================
// Types
// ============================================================================

interface CreationDateRow {
  ProductID: string;
  CreatedDate: string;
}

interface ProductWithDate {
  _id: string;
  name: string;
  publishedDate: string | null;
}

// ============================================================================
// Parse Arguments
// ============================================================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

// ============================================================================
// Main Migration
// ============================================================================

async function migrateCreationDates() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║         MIGRATE PRODUCT CREATION DATES                        ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  } else {
    if (!process.env.SANITY_API_TOKEN) {
      console.error("❌ SANITY_API_TOKEN is required for live migration");
      console.error("   Set it with: export SANITY_API_TOKEN=your-token-here");
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------
  // Step 1: Load CSV data
  // ----------------------------------------------------------------
  console.log("📖 Loading CSV file...");

  let csvData: CreationDateRow[];
  try {
    const csvContent = readFileSync(CSV_PATH, "utf-8");
    csvData = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CreationDateRow[];
    console.log(`   ✓ Loaded ${csvData.length} creation dates from CSV\n`);
  } catch (error) {
    console.error(`❌ Failed to load CSV file: ${CSV_PATH}`);
    console.error(error);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // Step 2: Fetch existing products from Sanity
  // ----------------------------------------------------------------
  console.log("🔍 Fetching existing products from Sanity...");

  const existingProducts = await client.fetch<ProductWithDate[]>(
    `*[_type == "product" && _id match "product-*"]{_id, name, publishedDate}`,
  );

  console.log(`   ✓ Found ${existingProducts.length} products in Sanity\n`);

  // Build lookup map: product-{legacyId} -> product
  const productMap = new Map<string, ProductWithDate>();
  for (const product of existingProducts) {
    productMap.set(product._id, product);
  }

  // ----------------------------------------------------------------
  // Step 3: Prepare updates
  // ----------------------------------------------------------------
  console.log("📝 Preparing updates...\n");

  const updates: Array<{
    sanityId: string;
    legacyId: string;
    name: string;
    oldDate: string | null;
    newDate: string;
  }> = [];

  const notFound: string[] = [];
  const alreadySet: string[] = [];

  for (const row of csvData) {
    const sanityId = `product-${row.ProductID}`;
    const product = productMap.get(sanityId);

    if (!product) {
      notFound.push(row.ProductID);
      continue;
    }

    // Parse the legacy date (format: "2016-07-04 10:37:24")
    // Convert to ISO 8601 format for Sanity datetime
    const legacyDate = row.CreatedDate;
    const isoDate = legacyDate.replace(" ", "T") + ".000Z";

    // Check if already set (and same value)
    if (product.publishedDate) {
      const existingDate = new Date(product.publishedDate).toISOString();
      const newDateObj = new Date(isoDate).toISOString();
      if (existingDate === newDateObj) {
        alreadySet.push(row.ProductID);
        continue;
      }
    }

    updates.push({
      sanityId,
      legacyId: row.ProductID,
      name: product.name,
      oldDate: product.publishedDate,
      newDate: isoDate,
    });
  }

  // ----------------------------------------------------------------
  // Step 4: Report summary
  // ----------------------------------------------------------------
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(
    "                       SUMMARY                                 ",
  );
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(`   📊 Total in CSV:        ${csvData.length}`);
  console.log(`   ✅ To update:           ${updates.length}`);
  console.log(`   ⏭️  Already set:         ${alreadySet.length}`);
  console.log(`   ⚠️  Not found in Sanity: ${notFound.length}`);
  console.log("");

  if (notFound.length > 0 && isVerbose) {
    console.log("   Products not found in Sanity:");
    for (const id of notFound.slice(0, 10)) {
      console.log(`      - product-${id}`);
    }
    if (notFound.length > 10) {
      console.log(`      ... and ${notFound.length - 10} more`);
    }
    console.log("");
  }

  if (updates.length === 0) {
    console.log("✅ No updates needed!\n");
    return;
  }

  // Show sample updates
  console.log("📋 Sample updates:");
  for (const update of updates.slice(0, 5)) {
    const oldStr = update.oldDate
      ? new Date(update.oldDate).toLocaleString()
      : "not set";
    const newStr = new Date(update.newDate).toLocaleString();
    console.log(`   [${update.sanityId}] ${update.name}`);
    console.log(`      ${oldStr} → ${newStr}`);
  }
  if (updates.length > 5) {
    console.log(`   ... and ${updates.length - 5} more\n`);
  }

  // ----------------------------------------------------------------
  // Step 5: Apply updates
  // ----------------------------------------------------------------
  if (isDryRun) {
    console.log(
      "\n🔍 DRY RUN - No changes made. Run without --dry-run to apply.\n",
    );
    return;
  }

  console.log("\n🔧 Applying updates...\n");

  let updated = 0;
  let failed = 0;

  // Use batched transactions for efficiency
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const transaction = client.transaction();

    for (const update of batch) {
      transaction.patch(update.sanityId, (patch) =>
        patch.set({ publishedDate: update.newDate }),
      );
    }

    try {
      await transaction.commit();
      updated += batch.length;

      if (isVerbose) {
        for (const update of batch) {
          const dateStr = new Date(update.newDate).toLocaleString();
          console.log(`   ✅ [${update.sanityId}] ${update.name} → ${dateStr}`);
        }
      } else {
        process.stdout.write(
          `\r   Progress: ${updated}/${updates.length} products updated...`,
        );
      }
    } catch (error) {
      console.error(`\n   ❌ Batch failed:`, error);
      failed += batch.length;
    }
  }

  console.log("\n");

  // ----------------------------------------------------------------
  // Step 6: Final report
  // ----------------------------------------------------------------
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(
    "                     FINAL REPORT                              ",
  );
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(`   ✅ Updated:  ${updated}`);
  console.log(`   ❌ Failed:   ${failed}`);
  console.log("");

  if (updated > 0) {
    console.log("✅ Migration complete!");
    console.log("");
    console.log("ℹ️  Notes:");
    console.log("   - Products now have their original creation dates");
    console.log('   - Sorting by "newest" or "oldest" will use these dates');
    console.log("   - Run 'bun typegen' to regenerate types if needed");
    console.log("");
  }
}

// ============================================================================
// Run
// ============================================================================

migrateCreationDates().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
