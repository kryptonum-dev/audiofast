#!/usr/bin/env bun
/**
 * Migration Script: Dealers → Stores
 *
 * This script migrates Dealer records from the legacy SilverStripe database
 * to Store documents in Sanity CMS.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/stores/migrate-stores.ts --dry-run
 *   bun run apps/studio/scripts/migration/stores/migrate-stores.ts
 *   bun run apps/studio/scripts/migration/stores/migrate-stores.ts --rollback
 *
 * Environment variables required:
 *   SANITY_PROJECT_ID - Sanity project ID
 *   SANITY_DATASET - Dataset name (default: production)
 *   SANITY_API_TOKEN - API token with write access
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { parseDealersFromSQL } from './parser';
import { createMigrationClient, getClientConfig } from './sanity-client';
import { transformDealerToStore, validateStoreDocument } from './transformer';
import type { MigrationReport, SanityStoreDocument } from './types';

// Default SQL file path (relative to project root)
const DEFAULT_SQL_PATH = './20250528_audiofast.sql';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  dryRun: boolean;
  rollback: boolean;
  sqlPath: string;
  verbose: boolean;
  limit: number;
} {
  const args = process.argv.slice(2);

  // Parse --limit=N argument
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    rollback: args.includes('--rollback') || args.includes('-r'),
    sqlPath:
      args.find((arg) => arg.startsWith('--sql='))?.split('=')[1] ||
      DEFAULT_SQL_PATH,
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: isNaN(limit) ? 0 : limit, // 0 means no limit
  };
}

/**
 * Print migration report
 */
function printReport(report: MigrationReport): void {
  console.log('\n');
  console.log(
    '═══════════════════════════════════════════════════════════════',
  );
  console.log('                    STORE MIGRATION REPORT');
  console.log(
    '═══════════════════════════════════════════════════════════════',
  );
  console.log('');
  console.log(`Source: SQL File`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');
  console.log(
    '───────────────────────────────────────────────────────────────',
  );
  console.log('SUMMARY');
  console.log(
    '───────────────────────────────────────────────────────────────',
  );
  console.log(`Total Dealers in SQL:        ${report.totalDealers}`);
  console.log(`Published Dealers:           ${report.publishedDealers}`);
  console.log(`Successfully Migrated:       ${report.successfullyMigrated}`);
  console.log(`Failed:                      ${report.failed}`);
  console.log(`Skipped (unpublished):       ${report.skipped}`);
  console.log('');

  if (report.warnings.length > 0) {
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    console.log('WARNINGS');
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    report.warnings.forEach((w) => {
      console.log(`- Dealer ID ${w.dealerId}: ${w.error} (field: ${w.field})`);
    });
    console.log('');
  }

  if (report.errors.length > 0) {
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    console.log('ERRORS');
    console.log(
      '───────────────────────────────────────────────────────────────',
    );
    report.errors.forEach((e) => {
      console.log(`- Dealer ID ${e.dealerId}: ${e.error} (field: ${e.field})`);
    });
    console.log('');
  }

  console.log(
    '═══════════════════════════════════════════════════════════════',
  );
}

/**
 * Rollback migration - delete all migrated stores
 */
async function rollbackMigration(): Promise<void> {
  console.log('🔄 Starting rollback...');

  const client = createMigrationClient();
  const config = getClientConfig();

  console.log(`   Project: ${config.projectId}`);
  console.log(`   Dataset: ${config.dataset}`);

  // Find all stores with our migration ID pattern
  const query = `*[_type == "store" && _id match "store-dealer-*"]._id`;
  const ids: string[] = await client.fetch(query);

  if (ids.length === 0) {
    console.log('✅ No migrated stores found to rollback');
    return;
  }

  console.log(`   Found ${ids.length} stores to delete`);

  // Delete in batches
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const transaction = client.transaction();
    batch.forEach((id) => transaction.delete(id));
    await transaction.commit();
    console.log(
      `   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)}`,
    );
  }

  console.log(`✅ Rollback complete. Deleted ${ids.length} stores.`);
}

/**
 * Run the migration
 */
async function runMigration(
  dryRun: boolean,
  sqlPath: string,
  verbose: boolean,
  limit: number,
): Promise<void> {
  console.log('🚀 Starting Dealer → Store migration');
  console.log(
    `   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'PRODUCTION'}`,
  );
  console.log(`   SQL File: ${sqlPath}`);
  if (limit > 0) {
    console.log(`   Limit: First ${limit} dealers only`);
  }
  console.log('');

  // Initialize report
  const report: MigrationReport = {
    totalDealers: 0,
    publishedDealers: 0,
    successfullyMigrated: 0,
    failed: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    results: [],
  };

  // Read SQL file
  console.log('📖 Reading SQL file...');
  const absolutePath = resolve(process.cwd(), sqlPath);
  let sqlContent: string;

  try {
    sqlContent = readFileSync(absolutePath, 'utf-8');
    console.log(
      `   File size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`,
    );
  } catch (error) {
    console.error(`❌ Could not read SQL file: ${absolutePath}`);
    console.error(error);
    process.exit(1);
  }

  // Parse dealers from SQL
  console.log('🔍 Parsing Dealer records...');
  const allDealers = parseDealersFromSQL(sqlContent);
  report.totalDealers = allDealers.length;
  console.log(`   Found ${allDealers.length} dealer records`);

  // Apply limit if specified
  const dealers = limit > 0 ? allDealers.slice(0, limit) : allDealers;
  if (limit > 0) {
    console.log(
      `   Processing first ${dealers.length} dealers (limit applied)`,
    );
  }

  // Count published vs unpublished (for reporting only, we migrate ALL)
  const publishedCount = dealers.filter((d) => d.Publish === 1).length;
  const unpublishedCount = dealers.filter((d) => d.Publish === 0).length;
  report.publishedDealers = publishedCount;
  report.skipped = 0; // We're not skipping any
  console.log(`   Published dealers: ${publishedCount}`);
  console.log(`   Unpublished dealers: ${unpublishedCount}`);
  console.log(`   Total to migrate: ${dealers.length}`);

  // Transform dealers to stores
  console.log('🔄 Transforming data...');
  const documents: SanityStoreDocument[] = [];

  for (const dealer of dealers) {
    const { document, warnings } = transformDealerToStore(dealer);

    // Collect warnings
    report.warnings.push(...warnings);

    // Validate document
    const validationErrors = validateStoreDocument(document, dealer.ID);

    if (validationErrors.length > 0) {
      report.errors.push(...validationErrors);
      report.failed++;
      report.results.push({
        dealerId: dealer.ID,
        sanityId: document._id,
        success: false,
        error: validationErrors.map((e) => e.error).join('; '),
      });

      if (verbose) {
        console.log(
          `   ⚠️  Dealer ${dealer.ID} (${dealer.Name}): Validation failed`,
        );
        validationErrors.forEach((e) =>
          console.log(`      - ${e.field}: ${e.error}`),
        );
      }
    } else {
      documents.push(document);

      if (verbose) {
        console.log(`   ✓ Dealer ${dealer.ID} → ${document._id}`);
        console.log(`     Name: ${document.name}`);
        console.log(
          `     Address: ${document.address.street}, ${document.address.postalCode} ${document.address.city}`,
        );
        console.log(`     Phone: ${document.phone}`);
        if (document.email) console.log(`     Email: ${document.email}`);
        if (document.website) console.log(`     Website: ${document.website}`);
      }
    }
  }

  console.log(`   Valid documents: ${documents.length}`);
  console.log(`   Invalid documents: ${report.failed}`);

  // Dry run - just show what would be created
  if (dryRun) {
    console.log('\n📋 DRY RUN - Documents that would be created:');
    console.log(
      '───────────────────────────────────────────────────────────────',
    );

    documents.forEach((doc) => {
      console.log(`\n${doc._id}:`);
      console.log(JSON.stringify(doc, null, 2));
    });

    report.successfullyMigrated = documents.length;
    printReport(report);
    console.log('\n💡 Run without --dry-run to actually create documents');
    return;
  }

  // Production run - create documents in Sanity
  console.log('\n📤 Creating documents in Sanity...');

  const client = createMigrationClient();
  const config = getClientConfig();

  console.log(`   Project: ${config.projectId}`);
  console.log(`   Dataset: ${config.dataset}`);

  // Create documents in batches
  const batchSize = 50;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const transaction = client.transaction();

    for (const doc of batch) {
      // Use createOrReplace to make migration idempotent
      transaction.createOrReplace(doc);
    }

    try {
      await transaction.commit();
      console.log(
        `   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} committed`,
      );

      // Mark these as successful
      batch.forEach((doc) => {
        report.successfullyMigrated++;
        report.results.push({
          dealerId: parseInt(doc._id.replace('store-dealer-', ''), 10),
          sanityId: doc._id,
          success: true,
        });
      });
    } catch (error) {
      console.error(
        `   ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`,
        error,
      );

      // Mark these as failed
      batch.forEach((doc) => {
        report.failed++;
        report.results.push({
          dealerId: parseInt(doc._id.replace('store-dealer-', ''), 10),
          sanityId: doc._id,
          success: false,
          error: String(error),
        });
      });
    }
  }

  printReport(report);

  if (report.failed === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log(`\n⚠️  Migration completed with ${report.failed} errors`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { dryRun, rollback, sqlPath, verbose, limit } = parseArgs();

  console.log('');
  console.log(
    '╔═══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║            AUDIOFAST DATA MIGRATION                           ║',
  );
  console.log(
    '║            Dealers → Stores                                   ║',
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════╝',
  );
  console.log('');

  if (rollback) {
    await rollbackMigration();
  } else {
    await runMigration(dryRun, sqlPath, verbose, limit);
  }
}

// Run
main().catch((error) => {
  console.error('❌ Migration failed with error:', error);
  process.exit(1);
});
