/**
 * Migration script to import PDFs from old Audiofast site to Sanity
 *
 * This script:
 * 1. Reads the CSV file with PDF data (product_slug -> PDF mappings)
 * 2. Matches products by slug to Sanity documents
 * 3. Downloads PDFs from the old server
 * 4. Uploads them to Sanity as file assets
 * 5. Patches products with the downloadablePdfs array
 *
 * Usage:
 *   npx tsx apps/studio/scripts/migration/products/migrate-product-pdfs.ts [--dry-run]
 */

import { existsSync,readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import {
  createDryRunClient,
  createMigrationClient,
  getClientConfig,
} from "./utils/sanity-client";

// ============================================================================
// Types
// ============================================================================

interface PdfCsvRow {
  old_product_id: string;
  product_slug: string;
  product_name: string | null;
  attachment_id: string;
  pdf_title: string;
  pdf_description: string | null;
  file_id: string;
  file_path: string;
}

interface PdfItem {
  _key: string;
  title: string;
  description?: string;
  file: {
    _type: "file";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
}

interface ProductPdfData {
  productSlug: string;
  sanityId: string | null;
  pdfs: Array<{
    title: string;
    description: string | null;
    filePath: string;
    fileId: string;
    attachmentId: string;
  }>;
}

// ============================================================================
// Configuration
// ============================================================================

const OLD_SITE_BASE_URL = "https://wwwold.audiofast.pl/assets/";
const CSV_PATH = resolve(
  __dirname,
  "../../../../../csv/products/december/products-pdfs.csv"
);
const CACHE_PATH = resolve(__dirname, "pdf-upload-cache.json");

// ============================================================================
// CSV Parser
// ============================================================================

function loadPdfCsv(): PdfCsvRow[] {
  console.log("📖 Loading PDF CSV file...");

  const file = readFileSync(CSV_PATH, "utf-8");
  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    cast: (value: string) => {
      if (value === "NULL" || value === "null") return null;
      return value;
    },
  }) as PdfCsvRow[];

  console.log(`   ✓ Loaded ${rows.length} PDF entries`);
  return rows;
}

// ============================================================================
// Group PDFs by Product
// ============================================================================

function groupPdfsByProduct(rows: PdfCsvRow[]): Map<string, ProductPdfData> {
  console.log("\n📑 Grouping PDFs by product...");

  const productMap = new Map<string, ProductPdfData>();

  for (const row of rows) {
    if (!row.old_product_id || !row.pdf_title || !row.file_path) continue;

    // Use old product ID as key - Sanity IDs are "product-{old_id}"
    const sanityId = `product-${row.old_product_id}`;
    const slug = `/produkty/${row.product_slug}/`;

    if (!productMap.has(sanityId)) {
      productMap.set(sanityId, {
        productSlug: slug,
        sanityId: sanityId,
        pdfs: [],
      });
    }

    const product = productMap.get(sanityId)!;

    // Check for duplicates (same file_id for same product)
    const isDuplicate = product.pdfs.some(
      (pdf) => pdf.fileId === row.file_id && pdf.title === row.pdf_title
    );

    if (!isDuplicate) {
      product.pdfs.push({
        title: row.pdf_title,
        description: row.pdf_description,
        filePath: row.file_path,
        fileId: row.file_id,
        attachmentId: row.attachment_id,
      });
    }
  }

  console.log(`   ✓ Found ${productMap.size} unique products with PDFs`);

  // Count total unique PDFs
  let totalPdfs = 0;
  for (const product of productMap.values()) {
    totalPdfs += product.pdfs.length;
  }
  console.log(`   ✓ Total unique PDFs: ${totalPdfs}`);

  return productMap;
}

// ============================================================================
// Match Products with Sanity
// ============================================================================

async function matchProductsWithSanity(
  productMap: Map<string, ProductPdfData>,
  isDryRun: boolean
): Promise<void> {
  console.log("\n🔍 Matching products with Sanity by ID...");

  const client = isDryRun ? createDryRunClient() : createDryRunClient();

  // Get all product IDs we need to check (both with and without drafts. prefix)
  const productIds = Array.from(productMap.keys());
  const draftIds = productIds.map((id) => `drafts.${id}`);

  // Query Sanity for products by ID
  const query = `*[_type == "product" && (_id in $ids || _id in $draftIds)]{
    _id,
    "slug": slug.current,
    name,
    downloadablePdfs
  }`;

  const results = await client.fetch(query, { ids: productIds, draftIds });

  // Create a set of found IDs (normalized without drafts. prefix)
  const foundIds = new Set<string>();
  const productDataById = new Map<
    string,
    { _id: string; downloadablePdfs?: unknown[] }
  >();

  for (const result of results) {
    const normalizedId = result._id.replace(/^drafts\./, "");
    foundIds.add(normalizedId);
    // Prefer draft version for patching
    if (!productDataById.has(normalizedId) || result._id.startsWith("drafts.")) {
      productDataById.set(normalizedId, result);
    }
  }

  let matched = 0;
  let notFound = 0;
  let alreadyHasPdfs = 0;
  const notFoundList: string[] = [];

  for (const [sanityId, product] of productMap.entries()) {
    if (foundIds.has(sanityId)) {
      // Use the actual ID from Sanity (may include drafts. prefix)
      const sanityData = productDataById.get(sanityId);
      if (sanityData) {
        product.sanityId = sanityData._id;
        matched++;

        if (sanityData.downloadablePdfs && sanityData.downloadablePdfs.length > 0) {
          alreadyHasPdfs++;
        }
      }
    } else {
      product.sanityId = null;
      notFound++;
      notFoundList.push(`${sanityId} (${product.productSlug})`);
    }
  }

  console.log(`   ✓ Matched ${matched} products`);
  console.log(`   ⚠️  Not found in Sanity: ${notFound} products`);
  if (notFoundList.length > 0 && notFoundList.length <= 20) {
    console.log(`   Not found: ${notFoundList.join(", ")}`);
  }
  console.log(`   ℹ️  Already have PDFs: ${alreadyHasPdfs} products`);
}

// ============================================================================
// Upload Cache Management
// ============================================================================

interface UploadCache {
  [fileId: string]: string; // fileId -> Sanity asset reference
}

function loadUploadCache(): UploadCache {
  if (existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveUploadCache(cache: UploadCache): void {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ============================================================================
// Download and Upload PDF
// ============================================================================

async function downloadPdfBuffer(url: string): Promise<Buffer | null> {
  // Use https module directly for better SSL control
  const https = await import("node:https");

  return new Promise((resolve) => {
    const request = https.get(
      url,
      { rejectUnauthorized: false },
      (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadPdfBuffer(redirectUrl).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          console.log(`   ❌ HTTP ${response.statusCode} for ${url}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", (err) => {
          console.log(`   ❌ Response error: ${err.message}`);
          resolve(null);
        });
      }
    );

    request.on("error", (err) => {
      console.log(`   ❌ Request error: ${err.message}`);
      resolve(null);
    });
  });
}

async function downloadAndUploadPdf(
  filePath: string,
  fileId: string,
  client: ReturnType<typeof createMigrationClient>,
  cache: UploadCache
): Promise<string | null> {
  // Check cache first
  if (cache[fileId]) {
    return cache[fileId];
  }

  const url = `${OLD_SITE_BASE_URL}${filePath}`;

  try {
    const buffer = await downloadPdfBuffer(url);

    if (!buffer) {
      return null;
    }

    // Extract filename from path
    const filename = filePath.split("/").pop() || `pdf-${fileId}.pdf`;

    // Upload to Sanity
    const asset = await client.assets.upload("file", buffer, {
      filename,
      contentType: "application/pdf",
    });

    // Cache the result
    cache[fileId] = asset._id;
    saveUploadCache(cache);

    return asset._id;
  } catch (error) {
    console.log(`   ❌ Error processing ${url}:`, error);
    return null;
  }
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function migratePdfs(isDryRun: boolean, limit?: number): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 PDF Migration Script");
  console.log("=".repeat(60));

  const config = getClientConfig();
  console.log(`\n📌 Target: ${config.projectId} / ${config.dataset}`);
  console.log(`   Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (limit) {
    console.log(`   Limit: ${limit} product(s)`);
  }

  // Load and parse CSV
  const rows = loadPdfCsv();

  // Group by product
  const productMap = groupPdfsByProduct(rows);

  // Match with Sanity
  await matchProductsWithSanity(productMap, isDryRun);

  // Filter to only products found in Sanity
  let productsToMigrate = Array.from(productMap.values()).filter(
    (p) => p.sanityId !== null
  );

  // Apply limit if specified
  if (limit && limit > 0) {
    productsToMigrate = productsToMigrate.slice(0, limit);
  }

  console.log(`\n📦 Products to migrate: ${productsToMigrate.length}`);

  if (isDryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made");
    console.log("\nSample of what would be migrated:");

    for (const product of productsToMigrate.slice(0, 5)) {
      console.log(`\n  ${product.productSlug} (${product.sanityId}):`);
      for (const pdf of product.pdfs) {
        console.log(`    - ${pdf.title}`);
        console.log(`      ${pdf.description || "(no description)"}`);
        console.log(`      ${OLD_SITE_BASE_URL}${pdf.filePath}`);
      }
    }

    if (productsToMigrate.length > 5) {
      console.log(`\n  ... and ${productsToMigrate.length - 5} more products`);
    }

    return;
  }

  // Live migration
  const client = createMigrationClient();
  const cache = loadUploadCache();

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productsToMigrate.length; i++) {
    const product = productsToMigrate[i];
    const progress = `[${i + 1}/${productsToMigrate.length}]`;

    console.log(`\n${progress} Migrating: ${product.productSlug}`);

    const pdfItems: PdfItem[] = [];

    for (const pdf of product.pdfs) {
      console.log(`   📄 Uploading: ${pdf.title}`);

      const assetRef = await downloadAndUploadPdf(
        pdf.filePath,
        pdf.fileId,
        client,
        cache
      );

      if (assetRef) {
        pdfItems.push({
          _key: `pdf-${pdf.attachmentId}-${pdf.fileId}`,
          title: pdf.title,
          ...(pdf.description ? { description: pdf.description } : {}),
          file: {
            _type: "file",
            asset: {
              _type: "reference",
              _ref: assetRef,
            },
          },
        });
        console.log(`      ✓ Uploaded successfully`);
      } else {
        console.log(`      ❌ Upload failed`);
      }
    }

    if (pdfItems.length > 0) {
      try {
        await client
          .patch(product.sanityId!)
          .set({ downloadablePdfs: pdfItems })
          .commit();

        console.log(`   ✓ Patched product with ${pdfItems.length} PDFs`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed to patch product:`, error);
        errorCount++;
      }
    } else {
      console.log(`   ⚠️  No PDFs uploaded successfully, skipping patch`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary");
  console.log("=".repeat(60));
  console.log(`   ✅ Successfully migrated: ${successCount} products`);
  console.log(`   ❌ Errors: ${errorCount} products`);
  console.log("=".repeat(60));
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const isDryRun = process.argv.includes("--dry-run");

// Parse --limit N option
const limitIndex = process.argv.findIndex((arg) => arg === "--limit");
const limit = limitIndex !== -1 ? parseInt(process.argv[limitIndex + 1], 10) : undefined;

migratePdfs(isDryRun, limit).catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
