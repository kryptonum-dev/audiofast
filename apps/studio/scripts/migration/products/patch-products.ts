#!/usr/bin/env bun
/**
 * Product Patch Script
 *
 * Patches existing products in Sanity with:
 * - shortDescription (from ArticlePage)
 * - publicationImage (from ArticlePage)
 * - reviews (updated references)
 *
 * Only patches products that already exist in Sanity (created before cutoff date).
 *
 * Usage:
 *   bun run patch-products.ts --dry-run
 *   bun run patch-products.ts --dry-run --limit=10
 *   bun run patch-products.ts --id=1021
 *   bun run patch-products.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";

import { htmlToPortableText } from "./parser/html-to-portable-text";
import { loadLegacyReviewIdMappings,loadReferenceMappings, resolveReviewByLegacyId, resolveReviewReferences } from "./transformers/reference-resolver";
import type { PortableTextBlock, ProductArticleRow, ProductReviewRow, SanityImageRef } from "./types";
import { getLegacyAssetUrl, loadImageCache, processAndUploadImage, processImageDryRun,saveImageCache } from "./utils/image-optimizer";

// ============================================================================
// Configuration
// ============================================================================

// Cutoff: Only patch products with publishedDate before this date (latest product: Audio Research I/70)
// Using publishedDate (the overwritten creation date from legacy DB), not _createdAt
const CUTOFF_DATE = "2025-05-23";

const CSV_BASE_PATH = resolve(__dirname, "../../../../../csv/products/december");

// ============================================================================
// Types
// ============================================================================

interface PatchOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  productId?: string;
}

interface SanityProductState {
  _id: string;
  _createdAt: string;
  legacyId: string;
  name: string;
  hasShortDescription: boolean;
  hasPublicationImage: boolean;
  currentReviewRefs: string[];
}

interface PatchOperation {
  productId: string;
  productName: string;
  legacyId: string;
  addShortDescription: boolean;
  addPublicationImage: boolean;
  updateReviews: boolean;
  currentReviewCount: number;
  newReviewCount: number;
}

interface PatchResult {
  patched: string[];
  skipped: string[];
  errors: Array<{ productId: string; error: string }>;
}

// ============================================================================
// CLI Parsing
// ============================================================================

function parseArgs(): PatchOptions {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const productIdArg = args.find((arg) => arg.startsWith("--id="));

  return {
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    limit: limitArg ? parseInt(limitArg.replace("--limit=", ""), 10) : undefined,
    productId: productIdArg ? productIdArg.replace("--id=", "") : undefined,
  };
}

// ============================================================================
// Sanity Client
// ============================================================================

function createSanityClient(): SanityClient {
  const projectId = process.env.SANITY_PROJECT_ID || "fsw3likv";
  const dataset = process.env.SANITY_DATASET || "production";
  const token = process.env.SANITY_API_TOKEN;

  if (!token) {
    throw new Error("SANITY_API_TOKEN environment variable is required");
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });
}

// ============================================================================
// CSV Loading
// ============================================================================

function loadArticlesCSV(): Map<string, ProductArticleRow> {
  const csvPath = resolve(CSV_BASE_PATH, "products-articles.csv");
  const file = readFileSync(csvPath, "utf-8");
  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value: string) => (value === "NULL" || value === "null" ? null : value),
  }) as ProductArticleRow[];

  // Index by ProductID (take first if duplicates)
  const map = new Map<string, ProductArticleRow>();
  for (const row of rows) {
    if (!map.has(row.ProductID)) {
      map.set(row.ProductID, row);
    }
  }
  return map;
}

function loadReviewsCSV(): Map<string, ProductReviewRow[]> {
  const csvPath = resolve(CSV_BASE_PATH, "products-reviews.csv");
  const file = readFileSync(csvPath, "utf-8");
  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ProductReviewRow[];

  // Index by ProductID
  const map = new Map<string, ProductReviewRow[]>();
  for (const row of rows) {
    const existing = map.get(row.ProductID) || [];
    existing.push(row);
    map.set(row.ProductID, existing);
  }
  return map;
}

// ============================================================================
// Query Existing Products
// ============================================================================

async function queryExistingProducts(
  client: SanityClient,
  options: PatchOptions
): Promise<SanityProductState[]> {
  let query: string;
  let params: Record<string, unknown> = {};

  if (options.productId) {
    // Query specific product by legacy ID
    query = `*[_type == "product" && _id == $productId] {
      _id,
      publishedDate,
      name,
      "legacyId": string::split(_id, "-")[1],
      "hasShortDescription": defined(shortDescription) && count(shortDescription) > 0,
      "hasPublicationImage": defined(publicationImage),
      "currentReviewRefs": coalesce(reviews[]._ref, [])
    }`;
    params = { productId: `product-${options.productId}` };
  } else {
    // Query all products with publishedDate before cutoff (using legacy creation date)
    query = `*[_type == "product" && publishedDate <= $cutoff] | order(publishedDate asc) {
      _id,
      publishedDate,
      name,
      "legacyId": string::split(_id, "-")[1],
      "hasShortDescription": defined(shortDescription) && count(shortDescription) > 0,
      "hasPublicationImage": defined(publicationImage),
      "currentReviewRefs": coalesce(reviews[]._ref, [])
    }`;
    params = { cutoff: CUTOFF_DATE };
  }

  const results = await client.fetch<SanityProductState[]>(query, params);

  if (options.limit && !options.productId) {
    return results.slice(0, options.limit);
  }

  return results;
}

// ============================================================================
// Determine Patch Operations
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function determinePatchOperations(
  products: SanityProductState[],
  articlesMap: Map<string, ProductArticleRow>,
  reviewsMap: Map<string, ProductReviewRow[]>
): PatchOperation[] {
  const operations: PatchOperation[] = [];

  for (const product of products) {
    const articleData = articlesMap.get(product.legacyId);
    const reviewData = reviewsMap.get(product.legacyId) || [];

    // Check if we need to add shortDescription
    const addShortDescription = !product.hasShortDescription && 
      !!articleData?.ShortDescription;

    // Check if we need to add publicationImage
    const addPublicationImage = !product.hasPublicationImage && 
      !!articleData?.PublicationImageFilename;

    // Check if we need to update reviews
    // Resolve expected review references from CSV (deduplicated with Set)
    const expectedReviewRefs = new Set<string>();
    for (const row of reviewData) {
      // Try by slug first
      const refsBySlug = resolveReviewReferences([row.ReviewSlug], { silent: true });
      if (refsBySlug.length > 0) {
        expectedReviewRefs.add(refsBySlug[0]._ref);
      } else {
        // Fallback to legacy ID
        const refByLegacyId = resolveReviewByLegacyId(row.ReviewID);
        if (refByLegacyId) {
          expectedReviewRefs.add(refByLegacyId._ref);
        }
      }
    }

    // Compare: are there any NEW reviews in CSV that aren't already in Sanity?
    const currentSet = new Set(product.currentReviewRefs);
    const newReviewsToAdd = [...expectedReviewRefs].filter(ref => !currentSet.has(ref));
    const updateReviews = newReviewsToAdd.length > 0;

    // Only add if there's something to patch
    if (addShortDescription || addPublicationImage || updateReviews) {
      operations.push({
        productId: product._id,
        productName: product.name,
        legacyId: product.legacyId,
        addShortDescription,
        addPublicationImage,
        updateReviews,
        currentReviewCount: product.currentReviewRefs.length,
        newReviewCount: newReviewsToAdd.length, // Count of NEW reviews to add
      });
    }
  }

  return operations;
}

// ============================================================================
// Execute Patches
// ============================================================================

async function executePatch(
  client: SanityClient,
  operation: PatchOperation,
  articlesMap: Map<string, ProductArticleRow>,
  reviewsMap: Map<string, ProductReviewRow[]>,
  imageCache: Record<string, { assetId: string; originalSize: number; optimizedSize: number }>,
  dryRun: boolean,
  verbose: boolean
): Promise<void> {
  const articleData = articlesMap.get(operation.legacyId);
  const reviewData = reviewsMap.get(operation.legacyId) || [];

  const patchOps: Record<string, unknown> = {};

  // Add shortDescription
  if (operation.addShortDescription && articleData?.ShortDescription) {
    const descriptionBlocks = htmlToPortableText(articleData.ShortDescription);
    const textBlocks = descriptionBlocks.filter(
      (block): block is PortableTextBlock => block._type === "block"
    );
    if (textBlocks.length > 0) {
      patchOps.shortDescription = textBlocks;
      if (verbose) console.log(`     + shortDescription: ${textBlocks.length} blocks`);
    }
  }

  // Add publicationImage
  if (operation.addPublicationImage && articleData?.PublicationImageFilename) {
    if (dryRun) {
      console.log(`     🧪 [DRY RUN] Would upload: ${articleData.PublicationImageFilename}`);
      patchOps.publicationImage = {
        _type: "image",
        asset: { _type: "reference", _ref: "image-dry-run-placeholder" },
      };
    } else {
      const imageUrl = getLegacyAssetUrl(articleData.PublicationImageFilename);
      const result = await processAndUploadImage(imageUrl, client, imageCache, {
        imageType: "preview",
      });
      if (result) {
        patchOps.publicationImage = {
          _type: "image",
          asset: { _type: "reference", _ref: result.assetId },
        };
        if (verbose) console.log(`     + publicationImage: ${result.assetId}`);
      }
    }
  }

  // Update reviews - MERGE with existing, don't replace
  if (operation.updateReviews) {
    // Start with existing review refs (to preserve them)
    const existingRefs = new Set(
      (await client.fetch<string[]>(
        `*[_id == $id][0].reviews[]._ref`,
        { id: operation.productId }
      )) || []
    );
    
    // Collect new refs from CSV
    const newRefs = new Set<string>();
    for (const row of reviewData) {
      const refsBySlug = resolveReviewReferences([row.ReviewSlug], { silent: true });
      if (refsBySlug.length > 0) {
        newRefs.add(refsBySlug[0]._ref);
      } else {
        const refByLegacyId = resolveReviewByLegacyId(row.ReviewID);
        if (refByLegacyId) {
          newRefs.add(refByLegacyId._ref);
        }
      }
    }
    
    // Merge: existing + new (union), deduplicated
    const allRefs = new Set([...existingRefs, ...newRefs]);
    
    // Only patch if there are actually new reviews to add
    const addedCount = [...allRefs].filter(ref => !existingRefs.has(ref)).length;
    
    if (addedCount > 0) {
      const reviewRefs = [...allRefs].map(ref => ({
        _type: "reference" as const,
        _ref: ref,
        _key: generateKey(),
      }));
      patchOps.reviews = reviewRefs;
      if (verbose) {
        console.log(`     + reviews: ${existingRefs.size} → ${allRefs.size} (+${addedCount} new)`);
      }
    } else if (verbose) {
      console.log(`     = reviews: ${existingRefs.size} (no new reviews to add)`);
    }
  }

  // Execute patch
  if (Object.keys(patchOps).length > 0) {
    if (dryRun) {
      console.log(`     🧪 [DRY RUN] Would patch ${operation.productId}`);
    } else {
      await client.patch(operation.productId).set(patchOps).commit();
      console.log(`     ✓ Patched ${operation.productId}`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              AUDIOFAST PRODUCT PATCH SCRIPT                   ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`Mode: ${options.dryRun ? "🧪 DRY RUN (no writes)" : "🚀 LIVE PATCH"}`);
  console.log(`Cutoff Date: ${CUTOFF_DATE}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  if (options.productId) console.log(`Product ID: ${options.productId}`);
  console.log("");

  // Load CSV data
  console.log("📖 Loading CSV files...");
  const articlesMap = loadArticlesCSV();
  console.log(`   ✓ products-articles.csv: ${articlesMap.size} unique products`);

  const reviewsMap = loadReviewsCSV();
  console.log(`   ✓ products-reviews.csv: ${reviewsMap.size} products with reviews`);

  // Create client
  const client = createSanityClient();

  // Load reference mappings
  console.log("\n📚 Loading reference mappings...");
  await loadReferenceMappings(client);
  loadLegacyReviewIdMappings();

  // Query products
  console.log("\n🔍 Querying existing products in Sanity...");
  const products = await queryExistingProducts(client, options);
  console.log(`   ✓ Found ${products.length} products to check`);

  // Determine patch operations
  console.log("\n📊 Analyzing what needs patching...");
  const operations = determinePatchOperations(products, articlesMap, reviewsMap);
  console.log(`   ✓ ${operations.length} products need patching`);

  if (operations.length === 0) {
    console.log("\n✅ All products are up to date! Nothing to patch.");
    return;
  }

  // Summary of what will be patched
  const stats = {
    shortDescription: operations.filter((o) => o.addShortDescription).length,
    publicationImage: operations.filter((o) => o.addPublicationImage).length,
    reviews: operations.filter((o) => o.updateReviews).length,
  };

  console.log(`
📋 Patch Summary:
   - Add shortDescription: ${stats.shortDescription} products
   - Add publicationImage: ${stats.publicationImage} products
   - Update reviews: ${stats.reviews} products
`);

  // Load image cache
  const imageCache = loadImageCache();

  // Execute patches
  console.log("🔧 Executing patches...\n");
  const result: PatchResult = { patched: [], skipped: [], errors: [] };

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    console.log(`[${i + 1}/${operations.length}] ${op.productName} (ID: ${op.legacyId})`);

    try {
      await executePatch(
        client,
        op,
        articlesMap,
        reviewsMap,
        imageCache,
        options.dryRun,
        options.verbose
      );
      result.patched.push(op.productId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`     ❌ Error: ${errorMsg}`);
      result.errors.push({ productId: op.productId, error: errorMsg });
    }
  }

  // Save image cache
  if (!options.dryRun) {
    saveImageCache(imageCache);
  }

  // Final summary
  console.log(`
═══════════════════════════════════════════════════════════════
                      PATCH SUMMARY                         
═══════════════════════════════════════════════════════════════
   ${options.dryRun ? "Would patch" : "Patched"}: ${result.patched.length}
   Errors: ${result.errors.length}
`);

  if (result.errors.length > 0) {
    console.log("Errors:");
    for (const err of result.errors) {
      console.log(`   - ${err.productId}: ${err.error}`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
