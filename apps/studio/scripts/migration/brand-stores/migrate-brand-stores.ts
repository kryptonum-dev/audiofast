#!/usr/bin/env bun
/**
 * Migration Script: Brand → Stores Relationships
 *
 * This script populates the `stores` array field on brand documents
 * using the dealer-brand relationships from the legacy database.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts --dry-run
 *   bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts
 *   bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts --rollback
 *
 * Environment variables required:
 *   SANITY_PROJECT_ID - Sanity project ID
 *   SANITY_DATASET - Dataset name (default: production)
 *   SANITY_API_TOKEN - API token with write access
 */

import { createClient } from '@sanity/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface BrandDealerRelation {
  RelationID: string;
  DealerID: string;
  BrandID: string;
  BrandSlug: string;
  BrandName: string;
  DealerName: string;
  DealerCity: string;
}

interface SanityStore {
  _id: string;
  name: string;
}

interface SanityBrand {
  _id: string;
  name: string;
  slug: { current: string } | null;
  stores: Array<{ _ref: string; _type: string; _key: string }> | null;
}

interface MigrationReport {
  totalBrands: number;
  brandsUpdated: number;
  brandsSkipped: number;
  brandsFailed: number;
  storesMapped: number;
  missingStores: string[];
  missingBrands: string[];
  details: Array<{
    brandSlug: string;
    brandName: string;
    storesAdded: number;
    status: 'updated' | 'skipped' | 'failed';
    error?: string;
  }>;
}

// Paths
const CSV_PATH = path.resolve(__dirname, '../../../../../csv/dealers/dealer-brand-relations.csv');

/**
 * Parse command line arguments
 */
function parseArgs(): { dryRun: boolean; rollback: boolean; verbose: boolean; brandSlug: string | null } {
  const args = process.argv.slice(2);
  const brandArg = args.find((a) => a.startsWith('--brand='));
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    rollback: args.includes('--rollback') || args.includes('-r'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    brandSlug: brandArg ? brandArg.split('=')[1] : null,
  };
}

// Default configuration
const DEFAULT_PROJECT_ID = 'fsw3likv';
const DEFAULT_DATASET = 'production';

/**
 * Create Sanity client
 */
function createMigrationClient() {
  const projectId = process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || DEFAULT_DATASET;
  const token = process.env.SANITY_API_TOKEN || process.env.MIGRATION_TOKEN;

  if (!token) {
    throw new Error('Missing required environment variable: SANITY_API_TOKEN or MIGRATION_TOKEN');
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  });
}

/**
 * Parse CSV file and group relations by brand
 * Returns Map<brandSlug, dealerNames[]>
 */
function parseBrandStoreRelations(csvPath: string): Map<string, string[]> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as BrandDealerRelation[];

  // Group dealer names by brand slug
  const brandStores = new Map<string, string[]>();

  for (const record of records) {
    const brandSlug = record.BrandSlug;
    const dealerName = record.DealerName.trim();

    if (!brandStores.has(brandSlug)) {
      brandStores.set(brandSlug, []);
    }

    const dealers = brandStores.get(brandSlug)!;
    if (!dealers.includes(dealerName)) {
      dealers.push(dealerName);
    }
  }

  return brandStores;
}

/**
 * Extract the simple slug from a full path (e.g., "/marki/primaluna/" → "primaluna")
 */
function extractSlug(fullPath: string): string {
  // Remove leading/trailing slashes and prefix
  return fullPath
    .replace(/^\/marki\//, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

/**
 * Fetch all brands from Sanity
 */
async function fetchBrands(client: ReturnType<typeof createMigrationClient>): Promise<Map<string, SanityBrand>> {
  const query = `*[_type == "brand"]{
    _id,
    name,
    slug,
    stores
  }`;

  const brands = await client.fetch<SanityBrand[]>(query);
  const brandMap = new Map<string, SanityBrand>();

  for (const brand of brands) {
    if (brand.slug?.current) {
      // Extract simple slug for matching (e.g., "/marki/primaluna/" → "primaluna")
      const simpleSlug = extractSlug(brand.slug.current);
      brandMap.set(simpleSlug, brand);
    }
  }

  return brandMap;
}

/**
 * Fetch all stores from Sanity and create name-to-ID map
 */
async function fetchStores(client: ReturnType<typeof createMigrationClient>): Promise<Map<string, string>> {
  const query = `*[_type == "store"]{_id, name}`;
  const stores = await client.fetch<SanityStore[]>(query);
  
  const storeMap = new Map<string, string>();
  for (const store of stores) {
    // Normalize name for matching (trim, uppercase for case-insensitive)
    const normalizedName = store.name.trim().toUpperCase();
    storeMap.set(normalizedName, store._id);
  }
  
  return storeMap;
}

/**
 * Find store ID by name (case-insensitive)
 */
function findStoreId(storeName: string, storeMap: Map<string, string>): string | null {
  const normalizedName = storeName.trim().toUpperCase();
  return storeMap.get(normalizedName) || null;
}

/**
 * Generate a unique key for reference array items
 */
function generateKey(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Print migration report
 */
function printReport(report: MigrationReport): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           BRAND-STORES MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('SUMMARY');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Total Brands Processed:      ${report.totalBrands}`);
  console.log(`Brands Updated:              ${report.brandsUpdated}`);
  console.log(`Brands Skipped (no stores):  ${report.brandsSkipped}`);
  console.log(`Brands Failed:               ${report.brandsFailed}`);
  console.log(`Total Store References:      ${report.storesMapped}`);
  console.log('');

  if (report.missingBrands.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`MISSING BRANDS (${report.missingBrands.length})`);
    console.log('───────────────────────────────────────────────────────────────');
    report.missingBrands.forEach((slug) => {
      console.log(`  - ${slug}`);
    });
    console.log('');
  }

  if (report.missingStores.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`MISSING STORES (${report.missingStores.length})`);
    console.log('───────────────────────────────────────────────────────────────');
    report.missingStores.forEach((id) => {
      console.log(`  - ${id}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Rollback migration - clear stores arrays from all brands
 */
async function rollbackMigration(): Promise<void> {
  console.log('🔄 Starting rollback...');

  const client = createMigrationClient();

  // Find all brands with stores
  const query = `*[_type == "brand" && defined(stores) && count(stores) > 0]._id`;
  const ids: string[] = await client.fetch(query);

  if (ids.length === 0) {
    console.log('✅ No brands with stores found to rollback');
    return;
  }

  console.log(`   Found ${ids.length} brands with stores`);

  // Clear stores in batches
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const transaction = client.transaction();

    batch.forEach((id) => {
      transaction.patch(id, (p) => p.unset(['stores']));
    });

    await transaction.commit();
    console.log(`   Cleared batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)}`);
  }

  console.log(`✅ Rollback complete. Cleared stores from ${ids.length} brands.`);
}

/**
 * Run the migration
 */
async function runMigration(dryRun: boolean, verbose: boolean, filterBrandSlug: string | null): Promise<void> {
  console.log('🚀 Starting Brand → Stores migration');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'PRODUCTION'}`);
  console.log(`   CSV File: ${CSV_PATH}`);
  if (filterBrandSlug) {
    console.log(`   Filter: Only brand "${filterBrandSlug}"`);
  }
  console.log('');

  // Initialize report
  const report: MigrationReport = {
    totalBrands: 0,
    brandsUpdated: 0,
    brandsSkipped: 0,
    brandsFailed: 0,
    storesMapped: 0,
    missingStores: [],
    missingBrands: [],
    details: [],
  };

  // Check CSV file exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  // Parse CSV
  console.log('📖 Parsing CSV file...');
  let brandStoreRelations = parseBrandStoreRelations(CSV_PATH);
  console.log(`   Found ${brandStoreRelations.size} brands with store relations`);

  // Filter to single brand if specified
  if (filterBrandSlug) {
    if (brandStoreRelations.has(filterBrandSlug)) {
      const singleBrandStores = brandStoreRelations.get(filterBrandSlug)!;
      brandStoreRelations = new Map([[filterBrandSlug, singleBrandStores]]);
      console.log(`   Filtered to brand "${filterBrandSlug}" with ${singleBrandStores.length} stores`);
    } else {
      console.error(`   ❌ Brand "${filterBrandSlug}" not found in CSV`);
      console.log('   Available brands:');
      Array.from(brandStoreRelations.keys()).sort().forEach((slug) => console.log(`      - ${slug}`));
      process.exit(1);
    }
  }

  // Create Sanity client
  const client = createMigrationClient();
  console.log(`   Project: ${process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID}`);
  console.log(`   Dataset: ${process.env.SANITY_DATASET || DEFAULT_DATASET}`);

  // Fetch existing brands from Sanity
  console.log('📥 Fetching brands from Sanity...');
  const sanityBrands = await fetchBrands(client);
  console.log(`   Found ${sanityBrands.size} brands in Sanity`);

  // Fetch existing stores (name → ID map)
  console.log('📥 Fetching stores from Sanity...');
  const storeNameToId = await fetchStores(client);
  console.log(`   Found ${storeNameToId.size} stores in Sanity`);

  // Process each brand
  console.log('\n🔄 Processing brands...');
  report.totalBrands = brandStoreRelations.size;

  const updates: Array<{ brandId: string; brandSlug: string; stores: Array<{ _ref: string; _type: string; _key: string }> }> = [];

  for (const [brandSlug, dealerNames] of brandStoreRelations) {
    const brand = sanityBrands.get(brandSlug);

    if (!brand) {
      report.missingBrands.push(brandSlug);
      report.brandsFailed++;
      report.details.push({
        brandSlug,
        brandName: brandSlug,
        storesAdded: 0,
        status: 'failed',
        error: 'Brand not found in Sanity',
      });
      if (verbose) {
        console.log(`   ⚠️  Brand "${brandSlug}" not found in Sanity`);
      }
      continue;
    }

    // Build store references by matching dealer names
    const storeRefs: Array<{ _ref: string; _type: string; _key: string }> = [];

    for (const dealerName of dealerNames) {
      const storeId = findStoreId(dealerName, storeNameToId);

      if (!storeId) {
        if (!report.missingStores.includes(dealerName)) {
          report.missingStores.push(dealerName);
        }
        if (verbose) {
          console.log(`      ⚠️  Store "${dealerName}" not found (skipping)`);
        }
        continue;
      }

      storeRefs.push({
        _ref: storeId,
        _type: 'reference',
        _key: generateKey(),
      });
    }

    if (storeRefs.length === 0) {
      report.brandsSkipped++;
      report.details.push({
        brandSlug,
        brandName: brand.name,
        storesAdded: 0,
        status: 'skipped',
        error: 'No valid stores to add',
      });
      if (verbose) {
        console.log(`   ○ ${brand.name} (${brandSlug}): No valid stores`);
      }
      continue;
    }

    updates.push({
      brandId: brand._id,
      brandSlug,
      stores: storeRefs,
    });

    report.storesMapped += storeRefs.length;
    report.details.push({
      brandSlug,
      brandName: brand.name,
      storesAdded: storeRefs.length,
      status: 'updated',
    });

    if (verbose) {
      console.log(`   ✓ ${brand.name} (${brandSlug}): ${storeRefs.length} stores`);
    }
  }

  console.log(`\n   Total updates to apply: ${updates.length}`);

  // Dry run - just show what would be updated
  if (dryRun) {
    console.log('\n📋 DRY RUN - Updates that would be applied:');
    console.log('───────────────────────────────────────────────────────────────');

    for (const update of updates) {
      console.log(`\n${update.brandSlug}: ${update.stores.length} stores`);
      update.stores.forEach((ref) => console.log(`  - ${ref._ref}`));
    }

    report.brandsUpdated = updates.length;
    printReport(report);
    console.log('\n💡 Run without --dry-run to actually apply changes');
    return;
  }

  // Production run - apply updates
  console.log('\n📤 Applying updates to Sanity...');

  const batchSize = 20;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const transaction = client.transaction();

    for (const update of batch) {
      transaction.patch(update.brandId, (p) => p.set({ stores: update.stores }));
    }

    try {
      await transaction.commit();
      console.log(`   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)} committed`);
      report.brandsUpdated += batch.length;
    } catch (error) {
      console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
      report.brandsFailed += batch.length;
    }
  }

  printReport(report);

  if (report.brandsFailed === 0 && report.missingBrands.length === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log(`\n⚠️  Migration completed with issues`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { dryRun, rollback, verbose, brandSlug } = parseArgs();

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            AUDIOFAST DATA MIGRATION                           ║');
  console.log('║            Brand → Stores Relationships                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (rollback) {
    await rollbackMigration();
  } else {
    await runMigration(dryRun, verbose, brandSlug);
  }
}

// Run
main().catch((error) => {
  console.error('❌ Migration failed with error:', error);
  process.exit(1);
});

