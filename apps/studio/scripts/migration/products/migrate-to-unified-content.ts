#!/usr/bin/env bun
/**
 * Product Unified Content Migration Script
 *
 * Migrates product details.content (array of content blocks) to details.productDetailContent (unified portable text).
 * This unifies the nested array structure into a single flat portable text array.
 *
 * PREREQUISITES:
 *   1. Deploy the schema first: cd apps/studio && npx sanity deploy
 *   2. Set environment variables: SANITY_API_TOKEN, SANITY_PROJECT_ID, SANITY_DATASET
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/products/migrate-to-unified-content.ts --dry-run
 *   bun run apps/studio/scripts/migration/products/migrate-to-unified-content.ts --product="Gryphon Diablo 333"
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-to-unified-content.ts
 */

import { createClient, type SanityClient } from "@sanity/client";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "your-project-id";
const DATASET = process.env.SANITY_DATASET || "production";
const API_TOKEN = process.env.SANITY_API_TOKEN || "";

// ============================================================================
// TYPES
// ============================================================================

interface PortableTextItem {
  _key: string;
  _type: string;
  [key: string]: any;
}

interface ContentBlockText {
  _type: "contentBlockText";
  _key: string;
  content: PortableTextItem[];
}

interface ContentBlockYoutube {
  _type: "contentBlockYoutube";
  _key: string;
  youtubeId: string;
  title?: string;
  thumbnail?: any;
}

interface ContentBlockVimeo {
  _type: "contentBlockVimeo";
  _key: string;
  vimeoId: string;
  title?: string;
  thumbnail?: any;
}

interface ContentBlockHorizontalLine {
  _type: "contentBlockHorizontalLine";
  _key: string;
}

type ContentBlock =
  | ContentBlockText
  | ContentBlockYoutube
  | ContentBlockVimeo
  | ContentBlockHorizontalLine;

interface Product {
  _id: string;
  name: string;
  details?: {
    content?: ContentBlock[];
    productDetailContent?: PortableTextItem[];
  };
}

// ============================================================================
// SANITY CLIENT
// ============================================================================

function createMigrationClient(): SanityClient {
  if (!API_TOKEN) {
    throw new Error(
      "SANITY_API_TOKEN environment variable is required.\n" +
        "Get a token from: https://www.sanity.io/manage/project/" +
        PROJECT_ID +
        "/api#tokens"
    );
  }

  return createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: "2024-01-01",
    token: API_TOKEN,
    useCdn: false,
  });
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

/**
 * Check if a contentBlockText has a ptPageBreak inside
 */
function hasPageBreak(block: ContentBlockText): boolean {
  if (!block.content || !Array.isArray(block.content)) return false;
  return block.content.some((item) => item._type === "ptPageBreak");
}

/**
 * Create a ptTwoColumnLine marker
 */
function createTwoColumnLine(): PortableTextItem {
  return {
    _key: uuidv4().slice(0, 8),
    _type: "ptTwoColumnLine",
    style: "twoColumnLine",
  };
}

/**
 * Analyze blocks to determine which need ptTwoColumnLine markers
 */
interface BlockAnalysis {
  index: number;
  block: ContentBlock;
  hasPageBreak: boolean;
  needsStartMarker: boolean; // Only true if there's single-column content before
  needsEndMarker: boolean; // Only true if there's single-column content after
}

function analyzeBlocks(blocks: ContentBlock[]): BlockAnalysis[] {
  const analysis: BlockAnalysis[] = blocks.map((block, index) => ({
    index,
    block,
    hasPageBreak:
      block._type === "contentBlockText" ? hasPageBreak(block) : false,
    needsStartMarker: false,
    needsEndMarker: false,
  }));

  // Determine which two-column blocks need markers
  for (let i = 0; i < analysis.length; i++) {
    if (!analysis[i].hasPageBreak) continue;

    // Check if there's single-column content BEFORE this two-column block
    let hasSingleColumnBefore = false;
    for (let j = i - 1; j >= 0; j--) {
      if (!analysis[j].hasPageBreak) {
        hasSingleColumnBefore = true;
        break;
      }
    }
    analysis[i].needsStartMarker = hasSingleColumnBefore;

    // Check if there's single-column content AFTER this two-column block
    let hasSingleColumnAfter = false;
    for (let j = i + 1; j < analysis.length; j++) {
      if (!analysis[j].hasPageBreak) {
        hasSingleColumnAfter = true;
        break;
      }
    }
    analysis[i].needsEndMarker = hasSingleColumnAfter;
  }

  return analysis;
}

/**
 * Transform details.content to unified details.productDetailContent
 *
 * Optimized logic with ptTwoColumnLine as boundary marker:
 * - ptTwoColumnLine is ONLY inserted when needed:
 *   → BEFORE a two-column block if there's single-column content before it
 *   → AFTER a two-column block if there's single-column content after it
 * - ptPageBreak implicitly starts two-column mode (content before → left, after → right)
 * - This avoids unnecessary markers at the start/end of content
 */
function transformToUnifiedContent(blocks: ContentBlock[]): PortableTextItem[] {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return [];
  }

  const result: PortableTextItem[] = [];
  const analysis = analyzeBlocks(blocks);

  // Track if we just processed a two-column block (to avoid duplicate end markers)
  let lastWasTwoColumn = false;
  let lastTwoColumnNeedsEndMarker = false;

  for (let i = 0; i < analysis.length; i++) {
    const { block, hasPageBreak: isTwoColumn, needsStartMarker, needsEndMarker } = analysis[i];

    // If transitioning from two-column to single-column, insert end marker if needed
    if (lastWasTwoColumn && !isTwoColumn && lastTwoColumnNeedsEndMarker) {
      result.push(createTwoColumnLine());
      lastTwoColumnNeedsEndMarker = false;
    }

    switch (block._type) {
      case "contentBlockText": {
        if (isTwoColumn && needsStartMarker) {
          // Insert start marker before two-column block (only if there's single-column before)
          result.push(createTwoColumnLine());
        }

        // Flatten the content array
        if (block.content && Array.isArray(block.content)) {
          for (const item of block.content) {
            result.push({
              ...item,
              _key: item._key || uuidv4().slice(0, 8),
            });
          }
        }

        // Track for potential end marker on transition
        lastWasTwoColumn = isTwoColumn;
        lastTwoColumnNeedsEndMarker = isTwoColumn && needsEndMarker;
        break;
      }

      case "contentBlockYoutube": {
        result.push({
          _key: uuidv4().slice(0, 8),
          _type: "ptYoutubeVideo",
          youtubeId: block.youtubeId,
          ...(block.title && { title: block.title }),
          ...(block.thumbnail && { thumbnail: block.thumbnail }),
        });
        lastWasTwoColumn = false;
        lastTwoColumnNeedsEndMarker = false;
        break;
      }

      case "contentBlockVimeo": {
        result.push({
          _key: uuidv4().slice(0, 8),
          _type: "ptVimeoVideo",
          vimeoId: block.vimeoId,
          ...(block.title && { title: block.title }),
          ...(block.thumbnail && { thumbnail: block.thumbnail }),
        });
        lastWasTwoColumn = false;
        lastTwoColumnNeedsEndMarker = false;
        break;
      }

      case "contentBlockHorizontalLine": {
        result.push({
          _key: uuidv4().slice(0, 8),
          _type: "ptHorizontalLine",
        });
        lastWasTwoColumn = false;
        lastTwoColumnNeedsEndMarker = false;
        break;
      }

      default:
        console.warn(`Unknown block type: ${(block as any)._type}`);
    }
  }

  // No need for trailing end marker - frontend handles content ending in two-column mode

  return result;
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function fetchProducts(
  client: SanityClient,
  productName?: string,
  brandName?: string
): Promise<Product[]> {
  let query = `*[_type == "product" && defined(details.content) && count(details.content) > 0]`;

  if (productName) {
    query = `*[_type == "product" && name match $productName]`;
  } else if (brandName) {
    query = `*[_type == "product" && defined(details.content) && count(details.content) > 0 && brand->name match $brandName]`;
  }

  query += `{
    _id,
    name,
    "brandName": brand->name,
    details{
      content[]{
        _type,
        _key,
        _type == "contentBlockText" => {
          content[]{
            ...,
          }
        },
        _type == "contentBlockYoutube" => {
          youtubeId,
          title,
          thumbnail
        },
        _type == "contentBlockVimeo" => {
          vimeoId,
          title,
          thumbnail
        },
        _type == "contentBlockHorizontalLine" => {
          // No additional fields
        }
      },
      productDetailContent
    }
  }`;

  const params: Record<string, string> = {};
  if (productName) {
    params.productName = `*${productName}*`;
  } else if (brandName) {
    params.brandName = `*${brandName}*`;
  }
  return client.fetch<Product[]>(query, params);
}

async function migrateProduct(
  client: SanityClient,
  product: Product,
  dryRun: boolean,
  forceOverwrite: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip if already has productDetailContent (unless force overwrite)
    if (
      !forceOverwrite &&
      product.details?.productDetailContent &&
      Array.isArray(product.details.productDetailContent) &&
      product.details.productDetailContent.length > 0
    ) {
      console.log(`  ⏭️  Skipping (already has details.productDetailContent)`);
      return { success: true };
    }

    // Skip if no details.content
    if (
      !product.details?.content ||
      !Array.isArray(product.details.content) ||
      product.details.content.length === 0
    ) {
      console.log(`  ⏭️  Skipping (no details.content)`);
      return { success: true };
    }

    // Transform
    const unifiedContent = transformToUnifiedContent(product.details.content);

    if (unifiedContent.length === 0) {
      console.log(`  ⏭️  Skipping (transformation resulted in empty content)`);
      return { success: true };
    }

    console.log(
      `  📦 Transformed ${product.details.content.length} blocks → ${unifiedContent.length} items`
    );

    // Log some details about the transformation
    const blockTypes = product.details.content.map((b) => b._type);
    const resultTypes = [...new Set(unifiedContent.map((r) => r._type))];
    console.log(`     Input types: ${blockTypes.join(", ")}`);
    console.log(`     Output types: ${resultTypes.join(", ")}`);

    // Check for ptTwoColumnLine markers
    const twoColumnLineCount = unifiedContent.filter(
      (item) => item._type === "ptTwoColumnLine"
    ).length;
    if (twoColumnLineCount > 0) {
      console.log(
        `     📐 Inserted ${twoColumnLineCount} ptTwoColumnLine boundary marker(s)`
      );
    }

    if (dryRun) {
      console.log(`  🔍 DRY RUN - Would patch product with new content`);
      return { success: true };
    }

    // Patch the product - update details.productDetailContent
    await client
      .patch(product._id)
      .set({ "details.productDetailContent": unifiedContent })
      .commit();

    console.log(`  ✅ Migrated successfully`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error: ${message}`);
    return { success: false, error: message };
  }
}

async function clearProductUnifiedContent(
  client: SanityClient,
  dryRun: boolean
): Promise<void> {
  console.log("\n🧹 Clearing existing details.productDetailContent from all products...");

  const products = await client.fetch<{ _id: string; name: string }[]>(
    `*[_type == "product" && defined(details.productDetailContent)]{_id, name}`
  );

  if (products.length === 0) {
    console.log("   No products with details.productDetailContent found.");
    return;
  }

  console.log(`   Found ${products.length} product(s) with existing content.`);

  if (dryRun) {
    console.log("   🔍 DRY RUN - Would clear details.productDetailContent from:");
    products.slice(0, 10).forEach((p) => console.log(`      - ${p.name}`));
    if (products.length > 10) {
      console.log(`      ... and ${products.length - 10} more`);
    }
    return;
  }

  for (const product of products) {
    await client.patch(product._id).unset(["details.productDetailContent"]).commit();
  }

  console.log(`   ✅ Cleared details.productDetailContent from ${products.length} products.\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceOverwrite = args.includes("--force");
  const clearFirst = args.includes("--clear");
  const productArg = args.find((arg) => arg.startsWith("--product="));
  const productName = productArg?.split("=")[1]?.replace(/"/g, "");
  const brandArg = args.find((arg) => arg.startsWith("--brand="));
  const brandName = brandArg?.split("=")[1]?.replace(/"/g, "");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     Product Unified Content Migration                      ║");
  console.log("║     details.content → details.productDetailContent               ║");
  console.log("║     Using ptTwoColumnLine as boundary marker               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  console.log(`📊 Configuration:`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Dataset: ${DATASET}`);
  if (productName) {
    console.log(`   Filter: Product name matches "${productName}"`);
  }
  if (brandName) {
    console.log(`   Filter: Brand name matches "${brandName}"`);
  }
  if (forceOverwrite) {
    console.log(`   Force: Will overwrite existing details.productDetailContent`);
  }
  if (clearFirst) {
    console.log(`   Clear: Will clear all details.productDetailContent first`);
  }
  console.log();

  // Create client
  let client: SanityClient;
  try {
    client = createMigrationClient();
  } catch (error) {
    console.error(
      "❌ Failed to create Sanity client:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }

  // Clear existing content if requested
  if (clearFirst) {
    await clearProductUnifiedContent(client, dryRun);
  }

  // Fetch products
  console.log("📥 Fetching products...");
  const products = await fetchProducts(client, productName, brandName);
  console.log(`   Found ${products.length} product(s) to process\n`);

  if (products.length === 0) {
    console.log("✨ No products to migrate!");
    return;
  }

  // Process each product
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const product of products) {
    const brandInfo = (product as any).brandName ? ` [${(product as any).brandName}]` : '';
    console.log(`\n📦 Processing: ${product.name}${brandInfo} (${product._id})`);

    const result = await migrateProduct(client, product, dryRun, forceOverwrite);

    if (result.success) {
      if (result.error === undefined) {
        successCount++;
      } else {
        skipCount++;
      }
    } else {
      errorCount++;
    }
  }

  // Summary
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Migrated: ${successCount}`);
  console.log(`   ⏭️  Skipped:  ${skipCount}`);
  console.log(`   ❌ Errors:   ${errorCount}`);
  console.log("════════════════════════════════════════════════════════════");

  if (dryRun) {
    console.log("\n💡 Run without --dry-run to apply changes");
    console.log("💡 Use --clear to clear existing details.productDetailContent first");
    console.log("💡 Use --force to overwrite existing details.productDetailContent");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
