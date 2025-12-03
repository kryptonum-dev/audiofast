#!/usr/bin/env bun
/**
 * Migration Script: Brand → Reviews Relationships
 *
 * This script populates the `featuredReviews` array field on brand documents
 * using the review-brand relationships from the legacy database.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-reviews.ts --dry-run
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-reviews.ts
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-reviews.ts --rollback
 *
 * Environment variables required:
 *   SANITY_PROJECT_ID - Sanity project ID
 *   SANITY_DATASET - Dataset name (default: production)
 *   SANITY_API_TOKEN or MIGRATION_TOKEN - API token with write access
 */

import { createClient } from '@sanity/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface BrandReviewRelation {
  RelationID: string;
  ReviewID: string;
  BrandID: string;
  BrandSlug: string;
  BrandName: string;
  ReviewTitle: string;
  ReviewSlug: string;
}

interface SanityBrand {
  _id: string;
  name: string;
  slug: { current: string } | null;
  featuredReviews: Array<{ _ref: string; _type: string; _key: string }> | null;
}

interface MigrationReport {
  totalBrands: number;
  brandsUpdated: number;
  brandsSkipped: number;
  brandsFailed: number;
  reviewsMapped: number;
  missingReviews: string[];
  missingBrands: string[];
  details: Array<{
    brandSlug: string;
    brandName: string;
    reviewsAdded: number;
    status: 'updated' | 'skipped' | 'failed';
    error?: string;
  }>;
}

// Paths
const CSV_PATH = path.resolve(__dirname, '../../../../../csv/brands-reviews-mapping.csv');

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
 * Returns Map<brandSlug, reviewIds[]> where reviewIds are the legacy IDs (e.g., "1697")
 */
function parseBrandReviewRelations(csvPath: string): Map<string, string[]> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as BrandReviewRelation[];

  // Group review IDs by brand slug
  const brandReviews = new Map<string, string[]>();

  for (const record of records) {
    const brandSlug = record.BrandSlug;
    const reviewId = record.ReviewID?.trim(); // Use ReviewID instead of ReviewSlug

    if (!brandSlug || !reviewId) continue;

    if (!brandReviews.has(brandSlug)) {
      brandReviews.set(brandSlug, []);
    }

    const reviews = brandReviews.get(brandSlug)!;
    if (!reviews.includes(reviewId)) {
      reviews.push(reviewId);
    }
  }

  return brandReviews;
}

/**
 * Extract the simple slug from a full path (e.g., "/marki/primaluna/" → "primaluna")
 */
function extractSlug(fullPath: string): string {
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
    featuredReviews
  }`;

  const brands = await client.fetch<SanityBrand[]>(query);
  const brandMap = new Map<string, SanityBrand>();

  for (const brand of brands) {
    if (brand.slug?.current) {
      const simpleSlug = extractSlug(brand.slug.current);
      brandMap.set(simpleSlug, brand);
    }
  }

  return brandMap;
}

/**
 * Fetch all review IDs from Sanity
 * Returns a Set of existing review IDs (e.g., "review-1697")
 */
async function fetchReviewIds(client: ReturnType<typeof createMigrationClient>): Promise<Set<string>> {
  const query = `*[_type == "review"]._id`;
  const ids = await client.fetch<string[]>(query);
  return new Set(ids);
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
  console.log('           BRAND-REVIEWS MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('SUMMARY');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Total Brands Processed:       ${report.totalBrands}`);
  console.log(`Brands Updated:               ${report.brandsUpdated}`);
  console.log(`Brands Skipped (no reviews):  ${report.brandsSkipped}`);
  console.log(`Brands Failed:                ${report.brandsFailed}`);
  console.log(`Total Review References:      ${report.reviewsMapped}`);
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

  if (report.missingReviews.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`MISSING REVIEWS (${report.missingReviews.length})`);
    console.log('───────────────────────────────────────────────────────────────');
    // Show only first 20 if too many
    const toShow = report.missingReviews.slice(0, 20);
    toShow.forEach((slug) => {
      console.log(`  - ${slug}`);
    });
    if (report.missingReviews.length > 20) {
      console.log(`  ... and ${report.missingReviews.length - 20} more`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Rollback migration - clear featuredReviews arrays from all brands
 */
async function rollbackMigration(): Promise<void> {
  console.log('🔄 Starting rollback...');

  const client = createMigrationClient();

  // Find all brands with featuredReviews
  const query = `*[_type == "brand" && defined(featuredReviews) && count(featuredReviews) > 0]._id`;
  const ids: string[] = await client.fetch(query);

  if (ids.length === 0) {
    console.log('✅ No brands with featuredReviews found to rollback');
    return;
  }

  console.log(`   Found ${ids.length} brands with featuredReviews`);

  // Clear featuredReviews in batches
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const transaction = client.transaction();

    batch.forEach((id) => {
      transaction.patch(id, (p) => p.unset(['featuredReviews']));
    });

    await transaction.commit();
    console.log(`   Cleared batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)}`);
  }

  console.log(`✅ Rollback complete. Cleared featuredReviews from ${ids.length} brands.`);
}

/**
 * Run the migration
 */
async function runMigration(dryRun: boolean, verbose: boolean, filterBrandSlug: string | null): Promise<void> {
  console.log('🚀 Starting Brand → Reviews migration');
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
    reviewsMapped: 0,
    missingReviews: [],
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
  let brandReviewRelations = parseBrandReviewRelations(CSV_PATH);
  console.log(`   Found ${brandReviewRelations.size} brands with review relations`);

  // Filter to single brand if specified
  if (filterBrandSlug) {
    if (brandReviewRelations.has(filterBrandSlug)) {
      const singleBrandReviews = brandReviewRelations.get(filterBrandSlug)!;
      brandReviewRelations = new Map([[filterBrandSlug, singleBrandReviews]]);
      console.log(`   Filtered to brand "${filterBrandSlug}" with ${singleBrandReviews.length} reviews`);
    } else {
      console.error(`   ❌ Brand "${filterBrandSlug}" not found in CSV`);
      console.log('   Available brands:');
      Array.from(brandReviewRelations.keys()).sort().forEach((slug) => console.log(`      - ${slug}`));
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

  // Fetch existing review IDs from Sanity
  console.log('📥 Fetching reviews from Sanity...');
  const existingReviewIds = await fetchReviewIds(client);
  console.log(`   Found ${existingReviewIds.size} reviews in Sanity`);

  // Process each brand
  console.log('\n🔄 Processing brands...');
  report.totalBrands = brandReviewRelations.size;

  const updates: Array<{ brandId: string; brandSlug: string; reviews: Array<{ _ref: string; _type: string; _key: string }> }> = [];

  for (const [brandSlug, legacyReviewIds] of brandReviewRelations) {
    const brand = sanityBrands.get(brandSlug);

    if (!brand) {
      report.missingBrands.push(brandSlug);
      report.brandsFailed++;
      report.details.push({
        brandSlug,
        brandName: brandSlug,
        reviewsAdded: 0,
        status: 'failed',
        error: 'Brand not found in Sanity',
      });
      if (verbose) {
        console.log(`   ⚠️  Brand "${brandSlug}" not found in Sanity`);
      }
      continue;
    }

    // Build review references by matching review IDs
    const reviewRefs: Array<{ _ref: string; _type: string; _key: string }> = [];

    for (const legacyId of legacyReviewIds) {
      // Construct the Sanity _id from the legacy database ID
      const sanityReviewId = `review-${legacyId}`;

      if (!existingReviewIds.has(sanityReviewId)) {
        if (!report.missingReviews.includes(legacyId)) {
          report.missingReviews.push(legacyId);
        }
        if (verbose) {
          console.log(`      ⚠️  Review ID "${legacyId}" (${sanityReviewId}) not found (skipping)`);
        }
        continue;
      }

      reviewRefs.push({
        _ref: sanityReviewId,
        _type: 'reference',
        _key: generateKey(),
      });
    }

    if (reviewRefs.length === 0) {
      report.brandsSkipped++;
      report.details.push({
        brandSlug,
        brandName: brand.name,
        reviewsAdded: 0,
        status: 'skipped',
        error: 'No valid reviews to add',
      });
      if (verbose) {
        console.log(`   ○ ${brand.name} (${brandSlug}): No valid reviews`);
      }
      continue;
    }

    updates.push({
      brandId: brand._id,
      brandSlug,
      reviews: reviewRefs,
    });

    report.reviewsMapped += reviewRefs.length;
    report.details.push({
      brandSlug,
      brandName: brand.name,
      reviewsAdded: reviewRefs.length,
      status: 'updated',
    });

    if (verbose) {
      console.log(`   ✓ ${brand.name} (${brandSlug}): ${reviewRefs.length} reviews`);
    }
  }

  console.log(`\n   Total updates to apply: ${updates.length}`);

  // Dry run - just show what would be updated
  if (dryRun) {
    console.log('\n📋 DRY RUN - Updates that would be applied:');
    console.log('───────────────────────────────────────────────────────────────');

    for (const update of updates) {
      console.log(`\n${update.brandSlug}: ${update.reviews.length} reviews`);
      if (verbose) {
        update.reviews.slice(0, 5).forEach((ref) => console.log(`  - ${ref._ref}`));
        if (update.reviews.length > 5) {
          console.log(`  ... and ${update.reviews.length - 5} more`);
        }
      }
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
      transaction.patch(update.brandId, (p) => p.set({ featuredReviews: update.reviews }));
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
  console.log('║            Brand → Reviews Relationships                      ║');
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

