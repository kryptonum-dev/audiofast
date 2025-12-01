#!/usr/bin/env bun
/**
 * Brand Gallery Migration Script
 *
 * Migrates image galleries from legacy SilverStripe to Sanity brand.imageGallery field.
 * Updates existing brands (already migrated) with their gallery images.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-galleries.ts --dry-run
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-galleries.ts --name="Audio Research"
 *   bun run apps/studio/scripts/migration/brands/migrate-brand-galleries.ts --id=73
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/migrate-brand-galleries.ts --all
 */

import * as https from 'node:https';
import { Readable } from 'node:stream';

import { createClient, type SanityClient } from '@sanity/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_FILE_PATH = path.resolve(
  __dirname,
  '../../../../../brand-gallery-images.csv'
);

const LEGACY_ASSETS_BASE_URL = 'https://www.audiofast.pl/assets/';

// Minimum images required for a gallery (per schema validation)
const MIN_GALLERY_IMAGES = 2;

// SSL bypass agent for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// TYPES
// ============================================================================

interface CSVRow {
  BrandID: string;
  BrandName: string;
  BrandSlug: string;
  FileID: string;
  ImagePath: string;
  ImageTitle: string;
  SortOrder: string;
  RecordID: string;
}

interface BrandGallery {
  brandId: string;
  brandName: string;
  brandSlug: string;
  images: GalleryImage[];
}

interface GalleryImage {
  fileId: string;
  imagePath: string;
  imageTitle: string;
  sortOrder: number;
}

interface SanityImageRef {
  _type: 'image';
  _key: string;
  asset: {
    _type: 'reference';
    _ref: string;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateKey(): string {
  return uuidv4().slice(0, 8);
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(filePath: string): CSVRow[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CSVRow[];

  return records;
}

function groupImagesByBrand(rows: CSVRow[]): Map<string, BrandGallery> {
  const brands = new Map<string, BrandGallery>();

  for (const row of rows) {
    const brandId = row.BrandID;

    if (!brands.has(brandId)) {
      brands.set(brandId, {
        brandId,
        brandName: row.BrandName,
        brandSlug: row.BrandSlug,
        images: [],
      });
    }

    const brand = brands.get(brandId)!;

    // Add image data
    brand.images.push({
      fileId: row.FileID,
      imagePath: row.ImagePath,
      imageTitle: row.ImageTitle,
      sortOrder: parseInt(row.SortOrder, 10),
    });
  }

  // Sort images by sort order for each brand
  for (const brand of brands.values()) {
    brand.images.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return brands;
}

function findBrandByName(
  brands: Map<string, BrandGallery>,
  name: string
): BrandGallery | null {
  const normalizedName = name.toLowerCase().trim();

  for (const brand of brands.values()) {
    if (brand.brandName.toLowerCase().trim() === normalizedName) {
      return brand;
    }
  }

  return null;
}

function findBrandById(
  brands: Map<string, BrandGallery>,
  id: string
): BrandGallery | null {
  return brands.get(id) || null;
}

// ============================================================================
// ASSET UPLOAD
// ============================================================================

async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = https.get(
      imageUrl,
      { agent: insecureAgent },
      (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            fetchImageInsecure(redirectUrl).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          console.error(`    ✗ Failed to fetch image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', (error) => {
          console.error(`    ✗ Response error:`, error);
          resolve(null);
        });
      }
    );

    request.on('error', (error) => {
      console.error(`    ✗ Request error:`, error);
      resolve(null);
    });
  });
}

async function uploadImageToSanity(
  client: SanityClient,
  imageUrl: string,
  filename: string
): Promise<string | null> {
  console.log(`    ↓ Downloading: ${filename}`);

  const imageBuffer = await fetchImageInsecure(imageUrl);
  if (!imageBuffer) {
    return null;
  }

  console.log(`    ↑ Uploading to Sanity...`);

  try {
    const asset = await client.assets.upload(
      'image',
      Readable.from(imageBuffer),
      {
        filename: filename,
      }
    );

    console.log(`    ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`    ✗ Upload failed:`, error);
    return null;
  }
}

// ============================================================================
// SANITY CLIENT
// ============================================================================

function createMigrationClient(): SanityClient {
  const token = process.env.SANITY_API_TOKEN;

  if (!token) {
    throw new Error('SANITY_API_TOKEN environment variable is required');
  }

  return createClient({
    projectId: 'fsw3likv',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  });
}

// ============================================================================
// GALLERY MIGRATION
// ============================================================================

async function migrateGalleryForBrand(
  brand: BrandGallery,
  client: SanityClient | null,
  dryRun: boolean
): Promise<boolean> {
  console.log(`\n  📷 Processing ${brand.images.length} gallery images...`);

  // Check minimum images requirement
  if (brand.images.length < MIN_GALLERY_IMAGES) {
    console.log(
      `    ⏭️  Skipping: Only ${brand.images.length} images (minimum ${MIN_GALLERY_IMAGES} required)`
    );
    return false;
  }

  const imageRefs: SanityImageRef[] = [];

  // Upload each image
  for (let i = 0; i < brand.images.length; i++) {
    const img = brand.images[i];
    const imageUrl = `${LEGACY_ASSETS_BASE_URL}${img.imagePath}`;
    const filename = img.imagePath.split('/').pop() || 'gallery-image.jpg';

    console.log(`    [${i + 1}/${brand.images.length}] ${filename}`);

    if (!dryRun && client) {
      const assetRef = await uploadImageToSanity(client, imageUrl, filename);

      if (assetRef) {
        imageRefs.push({
          _type: 'image',
          _key: generateKey(),
          asset: {
            _type: 'reference',
            _ref: assetRef,
          },
        });
      } else {
        console.log(`    ⚠️  Failed to upload: ${filename}`);
      }
    } else {
      // Dry run - simulate successful upload
      imageRefs.push({
        _type: 'image',
        _key: generateKey(),
        asset: {
          _type: 'reference',
          _ref: `image-simulated-${img.fileId}`,
        },
      });
    }
  }

  // Check if we have enough images after upload
  if (imageRefs.length < MIN_GALLERY_IMAGES) {
    console.log(
      `    ⚠️  Only ${imageRefs.length} images uploaded successfully (minimum ${MIN_GALLERY_IMAGES} required)`
    );
    return false;
  }

  // Find existing brand document in Sanity by name (since IDs are inconsistent)
  if (!dryRun && client) {
    // Look up brand by name
    const existingBrand = await client.fetch<{ _id: string } | null>(
      `*[_type == "brand" && name == $name][0]{_id}`,
      { name: brand.brandName }
    );

    if (!existingBrand) {
      console.log(`    ✗ Brand not found in Sanity by name: ${brand.brandName}`);
      return false;
    }

    const brandDocId = existingBrand._id;
    console.log(`    📍 Found brand: ${brandDocId}`);

    // Update brand with gallery
    console.log(`    📤 Updating brand gallery...`);

    try {
      await client.patch(brandDocId).set({ imageGallery: imageRefs }).commit();

      console.log(
        `    ✅ Gallery updated: ${imageRefs.length} images added to ${brand.brandName}`
      );
      return true;
    } catch (error) {
      console.error(`    ✗ Failed to update brand:`, error);
      return false;
    }
  } else {
    console.log(`    📋 DRY RUN - Would update brand "${brand.brandName}" with:`);
    console.log(`       ${imageRefs.length} gallery images`);
    return true;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let brandName: string | null = null;
  let brandId: string | null = null;
  let dryRun = false;
  let migrateAll = false;
  const excludeIds: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--name=')) {
      brandName = arg.replace('--name=', '').replace(/"/g, '');
    } else if (arg.startsWith('--id=')) {
      brandId = arg.replace('--id=', '');
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--all') {
      migrateAll = true;
    } else if (arg.startsWith('--exclude=')) {
      const ids = arg.replace('--exclude=', '').split(',');
      excludeIds.push(...ids);
    }
  }

  if (!brandName && !brandId && !migrateAll) {
    console.error(
      'Usage: bun run migrate-brand-galleries.ts --name="BrandName" [--dry-run]'
    );
    console.error(
      '       bun run migrate-brand-galleries.ts --id=58 [--dry-run]'
    );
    console.error(
      '       bun run migrate-brand-galleries.ts --all [--exclude=id1,id2,...] [--dry-run]'
    );
    process.exit(1);
  }

  console.log(
    '╔════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║           BRAND GALLERY MIGRATION                              ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════╝'
  );
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Minimum images per gallery: ${MIN_GALLERY_IMAGES}`);

  // Check CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`\n✗ CSV file not found: ${CSV_FILE_PATH}`);
    console.error('  Please place brand-gallery-images.csv in the project root.');
    process.exit(1);
  }

  // Parse CSV
  console.log(`\n📄 Reading CSV: ${CSV_FILE_PATH}`);
  const rows = parseCSV(CSV_FILE_PATH);
  console.log(`  Found ${rows.length} rows`);

  // Group by brand
  const brands = groupImagesByBrand(rows);
  console.log(`  Grouped into ${brands.size} unique brands with galleries`);

  // Analyze galleries
  console.log('\n📊 Gallery Analysis:');
  let totalImages = 0;
  let brandsWithEnoughImages = 0;
  let brandsWithTooFewImages = 0;

  for (const brand of brands.values()) {
    totalImages += brand.images.length;
    if (brand.images.length >= MIN_GALLERY_IMAGES) {
      brandsWithEnoughImages++;
    } else {
      brandsWithTooFewImages++;
      console.log(
        `   ⚠️  ${brand.brandName}: ${brand.images.length} images (will skip)`
      );
    }
  }

  console.log(`  Total images: ${totalImages}`);
  console.log(`  Brands with ≥${MIN_GALLERY_IMAGES} images: ${brandsWithEnoughImages}`);
  console.log(`  Brands with <${MIN_GALLERY_IMAGES} images: ${brandsWithTooFewImages}`);

  // Create Sanity client
  let client: SanityClient | null = null;
  if (!dryRun) {
    try {
      client = createMigrationClient();
      console.log('\n✓ Sanity client initialized');
    } catch (error) {
      console.error('\n✗ Failed to create Sanity client:', error);
      process.exit(1);
    }
  }

  // Collect brands to migrate
  let brandsToMigrate: BrandGallery[] = [];

  if (migrateAll) {
    for (const brand of brands.values()) {
      if (
        !excludeIds.includes(brand.brandId) &&
        brand.images.length >= MIN_GALLERY_IMAGES
      ) {
        brandsToMigrate.push(brand);
      }
    }
    console.log(
      `\n📋 Will migrate ${brandsToMigrate.length} brand galleries (${excludeIds.length} excluded)`
    );
  } else if (brandName) {
    const brand = findBrandByName(brands, brandName);
    if (!brand) {
      console.error(`\n✗ Brand not found: "${brandName}"`);
      console.log('\nAvailable brands with galleries:');
      for (const b of brands.values()) {
        console.log(`  - ${b.brandName} (ID: ${b.brandId}, ${b.images.length} images)`);
      }
      process.exit(1);
    }
    brandsToMigrate = [brand];
  } else if (brandId) {
    const brand = findBrandById(brands, brandId);
    if (!brand) {
      console.error(`\n✗ Brand ID not found in gallery data: ${brandId}`);
      process.exit(1);
    }
    brandsToMigrate = [brand];
  }

  if (brandsToMigrate.length === 0) {
    console.error('\n✗ No brands to migrate');
    process.exit(1);
  }

  // Migration results tracking
  const results = {
    success: [] as string[],
    skipped: [] as string[],
    failed: [] as string[],
  };

  // Process each brand
  for (let i = 0; i < brandsToMigrate.length; i++) {
    const brand = brandsToMigrate[i];

    console.log(
      '\n═══════════════════════════════════════════════════════════════════'
    );
    console.log(
      `🏷️  [${i + 1}/${brandsToMigrate.length}] ${brand.brandName} (ID: ${brand.brandId})`
    );
    console.log(
      '═══════════════════════════════════════════════════════════════════'
    );
    console.log(`  Gallery images: ${brand.images.length}`);

    try {
      const success = await migrateGalleryForBrand(brand, client, dryRun);

      if (success) {
        results.success.push(brand.brandName);
      } else if (brand.images.length < MIN_GALLERY_IMAGES) {
        results.skipped.push(brand.brandName);
      } else {
        results.failed.push(brand.brandName);
      }
    } catch (error) {
      console.error(`\n✗ Failed to migrate ${brand.brandName}:`, error);
      results.failed.push(brand.brandName);
    }
  }

  // Print summary
  console.log(
    '\n════════════════════════════════════════════════════════════════════'
  );
  console.log('📊 MIGRATION SUMMARY');
  console.log(
    '════════════════════════════════════════════════════════════════════'
  );
  console.log(`✅ Successful: ${results.success.length}`);
  if (results.success.length > 0) {
    results.success.forEach((name) => console.log(`   - ${name}`));
  }
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  if (results.skipped.length > 0) {
    results.skipped.forEach((name) => console.log(`   - ${name}`));
  }
  console.log(`❌ Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach((name) => console.log(`   - ${name}`));
  }
  console.log('\nGallery migration complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

