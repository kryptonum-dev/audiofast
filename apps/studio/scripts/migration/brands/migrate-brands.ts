/**
 * Brand Migration Script
 * Migrates ProducerPage (brands) from legacy SilverStripe database to Sanity CMS
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brands/migrate-brands.ts [--dry-run] [--limit=N] [--verbose]
 *
 * Environment variables required:
 *   SANITY_PROJECT_ID - Sanity project ID
 *   SANITY_DATASET - Sanity dataset name
 *   SANITY_API_TOKEN - Sanity API token with write access
 */

import * as fs from 'fs';
import pLimit from 'p-limit';
import * as path from 'path';

import { parseBrandsFromSQL } from './parser';
import { createMigrationClient, transformBrandToSanity } from './transformer';
import type { ExistingBrand, MigrationResult } from './types';

// Concurrency limit for parallel operations
const CONCURRENCY_LIMIT = 3;

// SQL file path
const SQL_FILE_PATH = path.resolve(
  __dirname,
  '../../../../../20250528_audiofast.sql',
);

/**
 * Parse command line arguments
 */
function parseArgs(): {
  dryRun: boolean;
  limit: number | null;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: (() => {
      const limitArg = args.find((a) => a.startsWith('--limit='));
      return limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
    })(),
    verbose: args.includes('--verbose'),
  };
}

/**
 * Fetch existing brands from Sanity
 */
async function fetchExistingBrands(
  client: ReturnType<typeof createMigrationClient>,
): Promise<Map<string, ExistingBrand>> {
  const query = `*[_type == "brand"]{
    _id,
    name,
    "hasLogo": defined(logo),
    "hasDescription": defined(description),
    "hasBrandDescription": defined(brandDescription),
    "hasHeroImage": defined(heroImage),
    "hasBannerImage": defined(bannerImage),
    "hasSeoTitle": defined(seo.title),
    "hasSeoDescription": defined(seo.description),
    slug
  }`;

  const results = await client.fetch<ExistingBrand[]>(query);
  const map = new Map<string, ExistingBrand>();

  for (const brand of results) {
    // Map by name (lowercase for case-insensitive matching)
    map.set(brand.name.toLowerCase().trim(), brand);
  }

  return map;
}

/**
 * Check if brand is fully complete (PrimaLuna is the reference)
 */
function isBrandComplete(existing: ExistingBrand): boolean {
  return (
    existing.hasLogo &&
    existing.hasDescription &&
    existing.hasBrandDescription &&
    existing.hasHeroImage &&
    existing.hasSeoTitle &&
    existing.hasSeoDescription
  );
}

/**
 * Main migration function
 */
async function migrateBrands(): Promise<void> {
  const { dryRun, limit, verbose } = parseArgs();

  console.log('='.repeat(60));
  console.log('BRAND MIGRATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} brands`);
  console.log('');

  // Initialize Sanity client
  console.log('Initializing Sanity client...');
  const client = createMigrationClient();

  // Read SQL file
  console.log(`Reading SQL file: ${SQL_FILE_PATH}`);
  if (!fs.existsSync(SQL_FILE_PATH)) {
    throw new Error(`SQL file not found: ${SQL_FILE_PATH}`);
  }
  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf-8');
  console.log(`SQL file size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);

  // Parse brands from SQL
  console.log('\nParsing brands from SQL...');
  let sourceBrands = parseBrandsFromSQL(sqlContent);
  console.log(`Found ${sourceBrands.length} brands in SQL`);

  // Apply limit if specified
  if (limit) {
    sourceBrands = sourceBrands.slice(0, limit);
    console.log(`Limited to ${sourceBrands.length} brands`);
  }

  // Fetch existing brands from Sanity
  console.log('\nFetching existing brands from Sanity...');
  const existingBrands = await fetchExistingBrands(client);
  console.log(`Found ${existingBrands.size} existing brands in Sanity`);

  // Categorize brands
  const toCreate: typeof sourceBrands = [];
  const toUpdate: Array<{
    source: (typeof sourceBrands)[0];
    existing: ExistingBrand;
  }> = [];
  const toSkip: Array<{ name: string; reason: string }> = [];

  for (const source of sourceBrands) {
    const existing = existingBrands.get(source.name.toLowerCase().trim());

    if (existing) {
      if (isBrandComplete(existing)) {
        toSkip.push({ name: source.name, reason: 'Already complete' });
      } else {
        toUpdate.push({ source, existing });
      }
    } else {
      toCreate.push(source);
    }
  }

  console.log('\nMigration Plan:');
  console.log(`  - Create: ${toCreate.length} new brands`);
  console.log(`  - Update: ${toUpdate.length} existing brands (missing fields)`);
  console.log(`  - Skip: ${toSkip.length} complete brands`);

  if (verbose) {
    console.log('\nBrands to create:');
    toCreate.forEach((b) => console.log(`  - ${b.name}`));
    console.log('\nBrands to update:');
    toUpdate.forEach(({ source }) => console.log(`  - ${source.name}`));
    console.log('\nBrands to skip:');
    toSkip.forEach(({ name, reason }) => console.log(`  - ${name}: ${reason}`));
  }

  if (dryRun) {
    console.log('\n[DRY RUN] No changes will be made.');
    return;
  }

  // Migration results tracking
  const results: MigrationResult = {
    created: [],
    updated: [],
    skipped: toSkip.map((s) => s.name),
    errors: [],
  };

  // Logo cache to avoid re-uploading
  const logoCache = new Map<string, string>();

  // Create rate limiter
  const limiter = pLimit(CONCURRENCY_LIMIT);

  // Transform and create new brands
  console.log('\n--- Creating New Brands ---');
  const createTasks = toCreate.map((source) =>
    limiter(async () => {
      try {
        console.log(`Processing: ${source.name}`);
        const brand = await transformBrandToSanity(source, client, logoCache);

        if (brand) {
          await client.createOrReplace(brand);
          results.created.push(source.name);
          console.log(`✓ Created: ${source.name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push({ brandName: source.name, error: message });
        console.error(`✗ Error creating ${source.name}: ${message}`);
      }
    }),
  );

  await Promise.all(createTasks);

  // Update existing brands (only missing fields)
  console.log('\n--- Updating Existing Brands ---');
  const updateTasks = toUpdate.map(({ source, existing }) =>
    limiter(async () => {
      try {
        console.log(`Updating: ${source.name}`);
        const brand = await transformBrandToSanity(source, client, logoCache);

        if (brand) {
          // Build patch with only missing fields
          const patch: Record<string, any> = {};

          if (!existing.hasHeroImage) {
            patch.heroImage = brand.heroImage;
          }
          if (!existing.hasBannerImage && brand.bannerImage) {
            patch.bannerImage = brand.bannerImage;
          }
          if (!existing.hasBrandDescription) {
            patch.brandDescriptionHeading = brand.brandDescriptionHeading;
            patch.brandDescription = brand.brandDescription;
          }
          if (!existing.hasSeoTitle && brand.seo?.title) {
            patch['seo.title'] = brand.seo.title;
          }
          if (!existing.hasSeoDescription && brand.seo?.description) {
            patch['seo.description'] = brand.seo.description;
          }
          // Don't override logo if it already exists
          if (!existing.hasLogo && brand.logo) {
            patch.logo = brand.logo;
          }

          if (Object.keys(patch).length > 0) {
            await client.patch(existing._id).set(patch).commit();
            results.updated.push(source.name);
            console.log(`✓ Updated: ${source.name}`);
          } else {
            results.skipped.push(source.name);
            console.log(`○ Skipped (no changes): ${source.name}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push({ brandName: source.name, error: message });
        console.error(`✗ Error updating ${source.name}: ${message}`);
      }
    }),
  );

  await Promise.all(updateTasks);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Created: ${results.created.length}`);
  console.log(`Updated: ${results.updated.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(({ brandName, error }) => {
      console.log(`  - ${brandName}: ${error}`);
    });
  }

  if (verbose) {
    console.log('\nCreated brands:');
    results.created.forEach((name) => console.log(`  - ${name}`));
    console.log('\nUpdated brands:');
    results.updated.forEach((name) => console.log(`  - ${name}`));
  }
}

// Run migration
migrateBrands().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

