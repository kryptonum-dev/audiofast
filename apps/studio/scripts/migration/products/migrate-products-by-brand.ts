#!/usr/bin/env bun
/**
 * Product Migration Script (By Brand)
 *
 * Migrates all products from a specific brand.
 *
 * Usage:
 *   bun run migrate-products-by-brand.ts --brand="Wilson Audio"
 *   bun run migrate-products-by-brand.ts --brand="wilsonaudio" --dry-run
 *   bun run migrate-products-by-brand.ts --brand-slug=wilson-audio --verbose
 *
 * Environment Variables:
 *   SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
 *   SANITY_DATASET     - Sanity dataset (default: production)
 *   SANITY_API_TOKEN   - Sanity API token (required for live migration)
 */

import type { SanityClient } from "@sanity/client";

import {
  getProductSummary,
  transformProduct,
  validateProduct,
} from "./transformers/product-transformer";
import {
  clearReferenceMappings,
  createDryRunMappings,
  loadLegacyReviewIdMappings,
  loadReferenceMappings,
  printReferenceStats,
} from "./transformers/reference-resolver";
import type {
  ImageCache,
  MigrationResult,
  ProductMainRow,
  ProductSourceData,
  SanityProduct,
} from "./types";
import {
  buildProductSourceData,
  indexDataByProductId,
  type IndexedProductData,
  loadAllCsvData,
  type LoadedCsvData,
} from "./utils/csv-parser";
import {
  getAlternativeUrls,
  getLegacyAssetUrl,
  loadImageCache,
  saveImageCache,
} from "./utils/image-optimizer";
import {
  createDryRunClient,
  createMigrationClient,
  getClientConfig,
} from "./utils/sanity-client";
import sharp from "sharp";

// ============================================================================
// CLI Options
// ============================================================================

interface BrandMigrationOptions {
  brand?: string; // Brand name or slug
  brandSlug?: string; // Explicit brand slug
  dryRun: boolean;
  verbose: boolean;
  skipExisting: boolean;
  batchSize: number;
}

function parseArgs(): BrandMigrationOptions {
  const args = process.argv.slice(2);

  const brandArg = args.find((arg) => arg.startsWith("--brand="));
  const brandSlugArg = args.find((arg) => arg.startsWith("--brand-slug="));
  const batchSizeArg = args.find((arg) => arg.startsWith("--batch-size="));

  return {
    brand: brandArg ? brandArg.replace("--brand=", "") : undefined,
    brandSlug: brandSlugArg
      ? brandSlugArg.replace("--brand-slug=", "")
      : undefined,
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    skipExisting: args.includes("--skip-existing"),
    batchSize: batchSizeArg
      ? parseInt(batchSizeArg.replace("--batch-size=", ""), 10)
      : 10,
  };
}

function printUsage(): void {
  console.log(`
Usage:
  bun run migrate-products-by-brand.ts [options]

Options:
  --brand=<name>      Brand name or slug to filter by (required)
  --brand-slug=<slug> Explicit brand slug to filter by
  --dry-run           Preview without making changes to Sanity
  --skip-existing     Skip products that already exist in Sanity
  --batch-size=N      Process N products per batch (default: 10)
  --verbose           Show detailed output

Environment Variables:
  SANITY_PROJECT_ID  - Sanity project ID (default: fsw3likv)
  SANITY_DATASET     - Sanity dataset (default: production)
  SANITY_API_TOKEN   - Sanity API token (required for live migration)

Examples:
  bun run migrate-products-by-brand.ts --brand="Wilson Audio" --dry-run
  bun run migrate-products-by-brand.ts --brand-slug=wilson-audio --verbose
  bun run migrate-products-by-brand.ts --brand=dcs --skip-existing
  `);
}

// ============================================================================
// Brand Filtering
// ============================================================================

/**
 * Normalize a string for comparison (lowercase, remove spaces and special chars)
 */
function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[\s-_]/g, "");
}

/**
 * Find products matching the brand criteria
 */
function filterProductsByBrand(
  products: ProductMainRow[],
  options: BrandMigrationOptions,
): {
  products: ProductMainRow[];
  matchedBrand: { name: string; slug: string } | null;
} {
  // Determine what to match against
  const searchTerm = options.brandSlug || options.brand;
  if (!searchTerm) {
    return { products: [], matchedBrand: null };
  }

  const normalizedSearch = normalizeForComparison(searchTerm);

  // Find all unique brands
  const brands = new Map<string, { name: string; slug: string }>();
  for (const product of products) {
    brands.set(product.BrandSlug, {
      name: product.BrandName,
      slug: product.BrandSlug,
    });
  }

  // Try to match by slug first (exact), then by normalized name/slug
  let matchedBrand: { name: string; slug: string } | null = null;

  // Exact slug match
  if (brands.has(searchTerm.toLowerCase())) {
    matchedBrand = brands.get(searchTerm.toLowerCase())!;
  } else {
    // Normalized match (handles "Wilson Audio" → "wilsonaudio", etc.)
    for (const [slug, brand] of brands) {
      const normalizedSlug = normalizeForComparison(slug);
      const normalizedName = normalizeForComparison(brand.name);

      if (
        normalizedSlug === normalizedSearch ||
        normalizedName === normalizedSearch
      ) {
        matchedBrand = brand;
        break;
      }
    }
  }

  if (!matchedBrand) {
    return { products: [], matchedBrand: null };
  }

  // Filter products by the matched brand
  const filteredProducts = products.filter(
    (p) => p.BrandSlug === matchedBrand!.slug,
  );

  return { products: filteredProducts, matchedBrand };
}

/**
 * List all available brands from the CSV data
 */
function listAvailableBrands(products: ProductMainRow[]): void {
  const brands = new Map<string, { name: string; count: number }>();

  for (const product of products) {
    const existing = brands.get(product.BrandSlug);
    if (existing) {
      existing.count++;
    } else {
      brands.set(product.BrandSlug, { name: product.BrandName, count: 1 });
    }
  }

  console.log("\n📋 Available brands:");
  const sortedBrands = Array.from(brands.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  for (const [slug, { name, count }] of sortedBrands) {
    console.log(`   ${name} (${slug}): ${count} products`);
  }
}

// ============================================================================
// Existing Products Check
// ============================================================================

async function getExistingProductIds(
  client: SanityClient,
): Promise<Set<string>> {
  console.log("🔍 Checking for existing products in Sanity...");

  const existingProducts = await client.fetch<Array<{ _id: string }>>(
    `*[_type == "product" && _id match "product-*"]{_id}`,
  );

  const ids = new Set(existingProducts.map((p) => p._id));
  console.log(`   Found ${ids.size} existing products`);
  return ids;
}

// ============================================================================
// Post-Migration: Fix Missing Images
// ============================================================================

interface ProductWithMissingImage {
  _id: string;
  name: string;
}

async function fixMissingImagesForBrand(
  client: SanityClient,
  brandSlug: string,
  csvData: LoadedCsvData,
): Promise<{ fixed: number; failed: number }> {
  // Disable SSL verification for legacy server
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  // Query for products in this brand that don't have preview images
  const productsMissingImages = await client.fetch<ProductWithMissingImage[]>(
    `*[_type == "product" && brand->slug.current == $brandSlug && !defined(previewImage)]{_id, name}`,
    { brandSlug },
  );

  if (productsMissingImages.length === 0) {
    return { fixed: 0, failed: 0 };
  }

  console.log(
    `\n🔧 Fixing ${productsMissingImages.length} products with missing images...`,
  );

  // Build a map of product IDs to their CSV image paths
  const imagePathMap = new Map<string, string>();
  for (const csvProduct of csvData.mainProducts) {
    if (csvProduct.BrandSlug === brandSlug && csvProduct.Image) {
      imagePathMap.set(`product-${csvProduct.ProductID}`, csvProduct.Image);
    }
  }

  let fixed = 0;
  let failed = 0;

  for (const product of productsMissingImages) {
    const csvImagePath = imagePathMap.get(product._id);
    if (!csvImagePath) {
      console.log(
        `   ⚠️  [${product._id}] ${product.name} - No CSV image path`,
      );
      failed++;
      continue;
    }

    const primaryUrl = getLegacyAssetUrl(csvImagePath);
    const urlsToTry = getAlternativeUrls(primaryUrl);

    let downloadedBuffer: Buffer | null = null;

    for (const url of urlsToTry) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          downloadedBuffer = Buffer.from(arrayBuffer);
          if (downloadedBuffer.length > 0) {
            console.log(
              `   📍 [${product._id}] Found at: ${url.split("/").pop()}`,
            );
            break;
          }
        }
      } catch {
        // Try next URL
      }
    }

    if (!downloadedBuffer || downloadedBuffer.length === 0) {
      console.log(`   ❌ [${product._id}] ${product.name} - Download failed`);
      failed++;
      continue;
    }

    // Optimize image
    const metadata = await sharp(downloadedBuffer).metadata();
    const width = metadata.width || 0;
    let targetWidth = width;
    if (width < 1400) {
      targetWidth = Math.min(width * 2, 2400);
    }

    const optimizedBuffer = await sharp(downloadedBuffer)
      .resize(targetWidth, undefined, { withoutEnlargement: false })
      .webp({ quality: 82 })
      .toBuffer();

    // Upload to Sanity
    const filename = (csvImagePath.split("/").pop() || "image").replace(
      /\.[^.]+$/,
      ".webp",
    );
    const asset = await client.assets.upload("image", optimizedBuffer, {
      filename,
    });

    // Update product
    await client
      .patch(product._id)
      .set({
        previewImage: {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: asset._id,
          },
        },
      })
      .commit();

    console.log(`   ✅ [${product._id}] ${product.name}`);
    fixed++;
  }

  return { fixed, failed };
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processBatch(
  products: ProductSourceData[],
  client: SanityClient | null,
  imageCache: ImageCache,
  options: BrandMigrationOptions,
  result: MigrationResult,
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
        console.log(
          `   ⚠️  ${productLogPrefix} - Validation errors: ${validation.errors.join(", ")}`,
        );
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

async function runBrandMigration(
  options: BrandMigrationOptions,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  // Load CSV data
  const csvData = loadAllCsvData();
  const indexed = indexDataByProductId(csvData);

  // Filter by brand
  const { products: productsToMigrate, matchedBrand } = filterProductsByBrand(
    csvData.mainProducts,
    options,
  );

  if (!matchedBrand) {
    const searchTerm = options.brandSlug || options.brand;
    console.error(`\n❌ Brand not found: "${searchTerm}"`);
    listAvailableBrands(csvData.mainProducts);
    return result;
  }

  console.log(`\n🏷️  Brand: ${matchedBrand.name} (${matchedBrand.slug})`);
  console.log(`📦 Products to migrate: ${productsToMigrate.length}`);

  if (productsToMigrate.length === 0) {
    console.log("\n✅ No products to migrate for this brand.");
    return result;
  }

  // List products that will be migrated
  console.log("\n📋 Products:");
  for (const product of productsToMigrate) {
    console.log(`   [${product.ProductID}] ${product.ProductName}`);
  }

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

  // Check for existing products if skip-existing is set
  let existingIds = new Set<string>();
  if (options.skipExisting && !options.dryRun) {
    existingIds = await getExistingProductIds(client!);
  }

  // Load reference mappings
  console.log("\n");
  if (options.dryRun) {
    const allBrandSlugs = [
      ...new Set(csvData.mainProducts.map((p) => p.BrandSlug)),
    ];
    const allCategorySlugs = [
      ...new Set(csvData.categories.map((c) => c.CategorySlug)),
    ];
    const allReviewSlugs = [
      ...new Set(csvData.reviews.map((r) => r.ReviewSlug)),
    ];
    createDryRunMappings(allBrandSlugs, allCategorySlugs, allReviewSlugs);
    console.log("✓ Created mock reference mappings for dry run");
  } else {
    await loadReferenceMappings(client!);
  }

  // Load legacy review ID mappings (for [recenzja id=X] shortcodes)
  loadLegacyReviewIdMappings();
  printReferenceStats();

  // Load image cache
  const imageCache: ImageCache = options.dryRun ? {} : loadImageCache();
  console.log(
    `\n✓ Image cache loaded (${Object.keys(imageCache).length} cached images)`,
  );

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

    console.log(
      `\n📦 Batch ${batchNum}/${batchCount} (${batch.length} products)`,
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

  // Check if brand is provided
  if (!options.brand && !options.brandSlug) {
    console.error("\n❌ Error: --brand or --brand-slug is required");
    printUsage();
    process.exit(1);
  }

  console.log("\n");
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║          AUDIOFAST PRODUCT MIGRATION (By Brand)               ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");
  console.log(`Brand Filter: ${options.brandSlug || options.brand}`);
  console.log(`Mode: ${options.dryRun ? "🧪 DRY RUN (no writes)" : "🚀 LIVE"}`);
  console.log(`Skip Existing: ${options.skipExisting ? "Yes" : "No"}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Verbose: ${options.verbose ? "Yes" : "No"}`);

  const clientConfig = getClientConfig();
  console.log(`Project: ${clientConfig.projectId} / ${clientConfig.dataset}`);

  const startTime = Date.now();

  try {
    const result = await runBrandMigration(options);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Post-migration: Fix any missing images
    let imageFixResult = { fixed: 0, failed: 0 };
    if (!options.dryRun && result.created.length > 0) {
      const client = createMigrationClient();
      const csvData = loadAllCsvData();

      // Find the brand slug from the CSV data
      const searchTerm = options.brandSlug || options.brand;
      const normalizedSearch = searchTerm?.toLowerCase().replace(/[\s-_]/g, "");

      let brandSlug = options.brandSlug;
      if (!brandSlug && searchTerm) {
        for (const product of csvData.mainProducts) {
          const normalizedName = product.BrandName.toLowerCase().replace(
            /[\s-_]/g,
            "",
          );
          const normalizedSlug = product.BrandSlug.toLowerCase().replace(
            /[\s-_]/g,
            "",
          );
          if (
            normalizedName === normalizedSearch ||
            normalizedSlug === normalizedSearch
          ) {
            brandSlug = product.BrandSlug;
            break;
          }
        }
      }

      if (brandSlug) {
        imageFixResult = await fixMissingImagesForBrand(
          client,
          brandSlug,
          csvData,
        );
      }
    }

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
    console.log(`   Brand: ${options.brandSlug || options.brand}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Created: ${result.created.length}`);
    console.log(`   Updated: ${result.updated.length}`);
    console.log(`   Skipped: ${result.skipped.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (imageFixResult.fixed > 0 || imageFixResult.failed > 0) {
      console.log(`\n📷 Image Fix:`);
      console.log(`   Fixed: ${imageFixResult.fixed}`);
      console.log(`   Failed: ${imageFixResult.failed}`);
    }

    if (result.errors.length > 0) {
      console.log("\n❌ Errors:");
      for (const err of result.errors) {
        console.log(`   [${err.productId}] ${err.productName}: ${err.error}`);
      }
    }

    console.log("\n");
    if (options.dryRun) {
      console.log("✅ Dry run complete. No changes were made to Sanity.");
    } else {
      console.log("✅ Migration complete.");
    }
    console.log("");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    clearReferenceMappings();
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
