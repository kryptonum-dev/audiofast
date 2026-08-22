#!/usr/bin/env bun
/**
 * Category Migration Script
 * Migrates ProductType records from SQL to Sanity productCategorySub
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/categories/migrate-categories.ts [options]
 *
 * Options:
 *   --dry-run     Preview changes without creating documents
 *   --verbose     Show detailed output
 *   --limit=N     Only process first N records (for testing)
 *   --rollback    Delete all migrated categories
 */

import { createClient } from '@sanity/client';
import * as fs from 'fs';
import * as path from 'path';

import {
  buildParentCategoryMap,
  parseDeviceTypeItemsFromSQL,
  parseProductTypesFromSQL,
} from './parser';
import {
  PARENT_CATEGORY_MAPPINGS,
  transformProductTypeToSubCategory,
  validateSubCategory,
} from './transformer';
import type { MigrationResult, SubCategory } from './types';

// ============================================================================
// Configuration
// ============================================================================

const SQL_FILE_PATH = './20250528_audiofast.sql';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const isRollback = args.includes('--rollback');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// Sanity client configuration
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || 'fsw3likv',
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function printHeader(): void {
  console.log('\n');
  console.log(
    '╔═══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║            AUDIOFAST DATA MIGRATION                           ║',
  );
  console.log(
    '║            ProductType → productCategorySub                   ║',
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════╝',
  );
  console.log('');
}

function printReport(result: MigrationResult): void {
  console.log(
    '\n═══════════════════════════════════════════════════════════════',
  );
  console.log('                    CATEGORY MIGRATION REPORT');
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  );

  console.log(`Source: SQL File`);
  console.log(`Date: ${new Date().toISOString()}`);

  console.log(
    '\n───────────────────────────────────────────────────────────────',
  );
  console.log('SUMMARY');
  console.log(
    '───────────────────────────────────────────────────────────────',
  );

  console.log(`Total ProductTypes in SQL:   ${result.totalRecords}`);
  console.log(`Successfully Migrated:       ${result.migratedCount}`);
  console.log(`Failed:                      ${result.failedCount}`);

  if (result.warnings.length > 0) {
    console.log(
      '\n───────────────────────────────────────────────────────────────',
    );
    console.log('WARNINGS');
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (result.errors.length > 0) {
    console.log(
      '\n───────────────────────────────────────────────────────────────',
    );
    console.log('ERRORS');
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    result.errors.forEach((error) => {
      console.log(`\nRecord ID ${error.recordId}:`);
      error.errors.forEach((e) => {
        console.log(`  - ${e.field}: ${e.message}`);
      });
    });
  }

  console.log(
    '\n═══════════════════════════════════════════════════════════════\n',
  );
}

// ============================================================================
// Rollback Function
// ============================================================================

async function rollback(): Promise<void> {
  console.log('🗑️  Rolling back migrated categories...\n');

  // Query all productCategorySub documents
  const categories = await client.fetch<{ _id: string; name: string }[]>(
    `*[_type == "productCategorySub"]{ _id, name }`,
  );

  if (categories.length === 0) {
    console.log('No categories found to rollback.');
    return;
  }

  console.log(`Found ${categories.length} categories to delete.\n`);

  if (isDryRun) {
    console.log('DRY RUN - Would delete:');
    categories.forEach((cat) => console.log(`  - ${cat._id}: ${cat.name}`));
    return;
  }

  // Delete in batches
  const transaction = client.transaction();
  categories.forEach((cat) => transaction.delete(cat._id));

  await transaction.commit();
  console.log(`✓ Deleted ${categories.length} categories.`);
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function migrate(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    totalRecords: 0,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
    warnings: [],
  };

  printHeader();

  console.log('🚀 Starting ProductType → productCategorySub migration');
  console.log(
    `   Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'PRODUCTION'}`,
  );
  console.log(`   SQL File: ${SQL_FILE_PATH}`);
  if (limit) console.log(`   Limit: First ${limit} categories only`);

  // -------------------------------------------------------------------------
  // Step 1: Read SQL file
  // -------------------------------------------------------------------------

  console.log('\n📖 Reading SQL file...');
  const sqlFilePath = path.resolve(process.cwd(), SQL_FILE_PATH);

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`   ❌ SQL file not found: ${sqlFilePath}`);
    result.success = false;
    return result;
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
  console.log(`   File size: ${formatBytes(sqlContent.length)}`);

  // -------------------------------------------------------------------------
  // Step 2: Parse ProductType records and DeviceTypeItem mappings
  // -------------------------------------------------------------------------

  console.log('🔍 Parsing ProductType records...');
  const productTypes = parseProductTypesFromSQL(sqlContent);
  console.log(`   Found ${productTypes.length} ProductType records`);

  console.log('🔍 Parsing DeviceTypeItem mappings...');
  const deviceTypeItems = parseDeviceTypeItemsFromSQL(sqlContent);
  console.log(`   Found ${deviceTypeItems.length} category mappings`);

  const parentCategoryMap = buildParentCategoryMap(deviceTypeItems);

  // Apply limit if specified
  const recordsToProcess = limit ? productTypes.slice(0, limit) : productTypes;
  result.totalRecords = recordsToProcess.length;

  if (limit) {
    console.log(`   Processing first ${limit} categories (limit applied)`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Transform records
  // -------------------------------------------------------------------------

  console.log('🔄 Transforming data...');
  const validDocuments: SubCategory[] = [];

  for (const record of recordsToProcess) {
    const parentDeviceTypeId = parentCategoryMap.get(record.id);
    const subCategory = transformProductTypeToSubCategory(
      record,
      parentDeviceTypeId,
      result.warnings,
    );

    if (!subCategory) {
      result.failedCount++;
      continue;
    }

    // Validate the transformed document
    const validationErrors = validateSubCategory(subCategory);

    if (validationErrors.length > 0) {
      result.errors.push({
        recordId: record.id,
        errors: validationErrors,
      });
      result.failedCount++;
      continue;
    }

    validDocuments.push(subCategory);

    if (isVerbose) {
      const parentName = PARENT_CATEGORY_MAPPINGS.find(
        (m) => m.sanityId === subCategory.parentCategory._ref,
      )?.name;
      console.log(`   ✓ ProductType ${record.id} → ${subCategory._id}`);
      console.log(`     Name: ${subCategory.name}`);
      console.log(`     Slug: ${subCategory.slug.current}`);
      console.log(`     Parent: ${parentName || 'Unknown'}`);
      console.log(`     SEO Title: ${subCategory.seo.title}`);
      console.log(
        `     SEO Desc: ${subCategory.seo.description.substring(0, 60)}...`,
      );
    }
  }

  console.log(`   Valid documents: ${validDocuments.length}`);
  console.log(`   Invalid documents: ${result.failedCount}`);

  // -------------------------------------------------------------------------
  // Step 4: Create documents in Sanity (or show dry run preview)
  // -------------------------------------------------------------------------

  if (isDryRun) {
    console.log('\n📋 DRY RUN - Documents that would be created:');
    console.log(
      '───────────────────────────────────────────────────────────────\n',
    );

    validDocuments.forEach((doc) => {
      console.log(`${doc._id}:`);
      console.log(JSON.stringify(doc, null, 2));
      console.log('');
    });

    result.migratedCount = validDocuments.length;
  } else {
    console.log('\n📤 Creating documents in Sanity...');
    console.log(`   Project: ${client.config().projectId}`);
    console.log(`   Dataset: ${client.config().dataset}`);

    // Create documents in batches of 100
    const batchSize = 100;
    for (let i = 0; i < validDocuments.length; i += batchSize) {
      const batch = validDocuments.slice(i, i + batchSize);
      const transaction = client.transaction();

      batch.forEach((doc) => {
        transaction.createOrReplace(doc);
      });

      await transaction.commit();
      console.log(
        `   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validDocuments.length / batchSize)} committed`,
      );
    }

    result.migratedCount = validDocuments.length;
  }

  result.success = result.failedCount === 0;

  return result;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  try {
    if (isRollback) {
      await rollback();
    } else {
      const result = await migrate();
      printReport(result);

      if (isDryRun) {
        console.log('💡 Run without --dry-run to actually create documents\n');
      } else if (result.success) {
        console.log('✅ Migration completed successfully!\n');
      } else {
        console.log('⚠️  Migration completed with errors.\n');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    process.exit(1);
  }
}

main();
