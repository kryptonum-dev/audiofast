/**
 * Migration script to populate denormalized fields for all existing products.
 *
 * This script:
 * 1. Fetches all published products
 * 2. Computes denormalized fields (brand slug/name, category slugs, filter keys)
 * 3. Patches each product with the computed values
 *
 * Run with: bun run migrate:denormalize
 * Dry run:  bun run migrate:denormalize --dry-run
 */

import { computeDenormalizedFields } from "../utils/denormalize-product";
import { createMigrationClient, getClientConfig } from "./migration/products/utils/sanity-client";

// Parse command line arguments
const isDryRun = process.argv.includes("--dry-run");
const isVerbose = process.argv.includes("--verbose");

async function migrateAllProducts() {
  const config = getClientConfig();
  console.log("🚀 Starting product denormalization migration...");
  console.log(`   Project: ${config.projectId}`);
  console.log(`   Dataset: ${config.dataset}`);
  console.log(`   Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("");

  const client = createMigrationClient();

  // Fetch all published products (not drafts)
  const products = await client.fetch<
    Array<{
      _id: string;
      name?: string;
      brand?: { _ref: string };
      categories?: Array<{ _ref: string }>;
      customFilterValues?: Array<{
        filterName?: string;
        value?: string;
        numericValue?: number;
      }>;
    }>
  >(`
    *[_type == "product" && !(_id in path("drafts.**"))] {
      _id,
      name,
      brand,
      categories,
      customFilterValues
    }
  `);

  console.log(`📦 Found ${products.length} products to migrate`);
  console.log("");

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const patches = await Promise.all(
      batch.map(async (product) => {
        try {
          const denormalized = await computeDenormalizedFields(client, product);

          if (isVerbose) {
            console.log(`   Processing: ${product.name || product._id}`);
            console.log(`     Brand: ${denormalized.denormBrandName} (${denormalized.denormBrandSlug})`);
            console.log(`     Categories: ${denormalized.denormCategorySlugs.join(", ") || "none"}`);
            console.log(`     Filter keys: ${denormalized.denormFilterKeys.length}`);
          }

          return {
            id: product._id,
            name: product.name,
            patch: denormalized,
          };
        } catch (error) {
          console.error(`❌ Error processing ${product.name || product._id}:`, error);
          errorCount++;
          return null;
        }
      }),
    );

    // Filter out failed patches
    const validPatches = patches.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );

    if (isDryRun) {
      // Dry run - just count
      skippedCount += validPatches.length;
    } else {
      // Apply patches in a transaction
      if (validPatches.length > 0) {
        const transaction = client.transaction();

        for (const { id, patch } of validPatches) {
          transaction.patch(id, (p) => p.set(patch));
        }

        await transaction.commit({ visibility: "async" });
        successCount += validPatches.length;
      }
    }

    const progress = Math.min(i + BATCH_SIZE, products.length);
    const progressPct = Math.round((progress / products.length) * 100);
    
    if (isDryRun) {
      console.log(`📋 [DRY RUN] Would migrate ${progress}/${products.length} products (${progressPct}%)`);
    } else {
      console.log(`✅ Migrated ${progress}/${products.length} products (${progressPct}%)`);
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log("");
  console.log("🎉 Migration complete!");
  console.log(`   Success: ${isDryRun ? skippedCount : successCount}`);
  console.log(`   Errors: ${errorCount}`);

  if (isDryRun) {
    console.log("");
    console.log("ℹ️  This was a dry run. Run without --dry-run to apply changes.");
  }
}

// Run migration
migrateAllProducts().catch((error) => {
  console.error("💥 Migration failed:", error);
  process.exit(1);
});
