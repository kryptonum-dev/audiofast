#!/usr/bin/env bun
/**
 * Clear Brand Galleries Script
 *
 * Removes imageGallery field from ALL brand documents in Sanity.
 * Use this to reset galleries before re-migration.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brands/clear-brand-galleries.ts --dry-run
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/clear-brand-galleries.ts
 */

import { createClient, type SanityClient } from '@sanity/client';

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
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(
    '╔════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║           CLEAR BRAND GALLERIES                                ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════╝'
  );
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);

  // Create Sanity client
  let client: SanityClient;
  
  if (!dryRun) {
    try {
      client = createMigrationClient();
      console.log('\n✓ Sanity client initialized');
    } catch (error) {
      console.error('\n✗ Failed to create Sanity client:', error);
      process.exit(1);
    }
  } else {
    // Create a read-only client for dry run
    client = createClient({
      projectId: 'fsw3likv',
      dataset: 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
    });
  }

  // Find all brands with imageGallery
  console.log('\n📋 Finding brands with imageGallery...');
  
  const brandsWithGallery = await client.fetch<Array<{ _id: string; name: string; imageCount: number }>>(
    `*[_type == "brand" && defined(imageGallery) && count(imageGallery) > 0]{
      _id,
      name,
      "imageCount": count(imageGallery)
    }`
  );

  if (brandsWithGallery.length === 0) {
    console.log('\n✓ No brands have imageGallery data. Nothing to clear.');
    return;
  }

  console.log(`\n📊 Found ${brandsWithGallery.length} brands with imageGallery:`);
  for (const brand of brandsWithGallery) {
    console.log(`   - ${brand.name}: ${brand.imageCount} images`);
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - Would clear imageGallery from:');
    for (const brand of brandsWithGallery) {
      console.log(`   - ${brand.name} (${brand._id})`);
    }
    console.log('\n✓ Dry run complete. No changes made.');
    return;
  }

  // Clear galleries
  console.log('\n🗑️  Clearing imageGallery from all brands...');

  let successCount = 0;
  let failCount = 0;

  for (const brand of brandsWithGallery) {
    try {
      await client
        .patch(brand._id)
        .unset(['imageGallery'])
        .commit();
      
      console.log(`   ✓ Cleared: ${brand.name}`);
      successCount++;
    } catch (error) {
      console.error(`   ✗ Failed: ${brand.name}`, error);
      failCount++;
    }
  }

  // Summary
  console.log(
    '\n════════════════════════════════════════════════════════════════════'
  );
  console.log('📊 SUMMARY');
  console.log(
    '════════════════════════════════════════════════════════════════════'
  );
  console.log(`✅ Cleared: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('\nGallery cleanup complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


