#!/usr/bin/env bun
/**
 * Migration Script: Review Authors CSV → Sanity `reviewAuthor` documents
 *
 * Usage examples:
 *   # Dry run (no writes)
 *   bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --dry-run
 *
 *   # Migrate all authors from default CSV (ReviewPage.csv in repo root)
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts
 *
 *   # Migrate a single author (case-insensitive match)
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --author="The Absolute Sound"
 *
 *   # Custom CSV path
 *   bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --csv=./data/review-authors.csv
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";
import slugify from "slugify";

type CliOptions = {
  csvPath: string;
  dryRun: boolean;
  verbose: boolean;
  authorFilter?: string;
};

type CsvRow = {
  AuthorName?: string;
  ReviewCount?: string;
};

type AuthorDoc = {
  _id: string;
  _type: "reviewAuthor";
  name: string;
  websiteUrl?: string;
};

type PreparedAuthor = {
  doc: AuthorDoc;
  reviewCount: number;
  rawName: string;
};

const DEFAULT_CSV_PATH = "./ReviewPage.csv";
const DEFAULT_PROJECT_ID = "fsw3likv";
const DEFAULT_DATASET = "production";

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const csvArg = args.find((arg) => arg.startsWith("--csv="));
  const authorArg = args.find((arg) => arg.startsWith("--author="));

  return {
    csvPath: csvArg ? csvArg.replace("--csv=", "") : DEFAULT_CSV_PATH,
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    authorFilter: authorArg
      ? authorArg.replace("--author=", "").trim()
      : undefined,
  };
}

function normalizeName(name: string): string {
  return name
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createSlug(name: string): string {
  return slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });
}

function looksLikeDomain(input: string): boolean {
  // Remove protocol and www for detection
  const sanitized = input
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .trim();

  // Domain-like strings shouldn't contain whitespace
  if (!sanitized || /\s/.test(sanitized)) {
    return false;
  }

  // Must include at least one dot and end with a TLD-like segment (2-10 letters)
  const domainPattern = /^(?:[a-z0-9-]+\.)+[a-z]{2,10}(?:\/.*)?$/i;
  return domainPattern.test(sanitized);
}

function inferWebsite(name: string): string | undefined {
  if (!looksLikeDomain(name)) {
    return undefined;
  }

  let sanitized = name.trim();

  if (!/^https?:\/\//i.test(sanitized)) {
    sanitized = `https://${sanitized}`;
  }

  return sanitized;
}

function buildAuthorDocuments(
  rows: CsvRow[],
  authorFilter?: string,
  verbose = false,
): PreparedAuthor[] {
  const normalizedFilter = authorFilter?.toLowerCase();
  const deduped = new Map<string, PreparedAuthor>();

  for (const row of rows) {
    const rawName = row.AuthorName ? normalizeName(row.AuthorName) : "";
    if (!rawName) continue;

    if (normalizedFilter && rawName.toLowerCase() !== normalizedFilter) {
      continue;
    }

    const slug = createSlug(rawName);
    if (!slug) {
      if (verbose) {
        console.warn(
          `⚠️  Could not create slug for author "${rawName}", skipping`,
        );
      }
      continue;
    }

    const _id = `review-author-${slug}`;
    const reviewCount = parseInt(row.ReviewCount ?? "0", 10) || 0;
    const websiteUrl = inferWebsite(rawName);

    const prepared: PreparedAuthor = {
      doc: {
        _id,
        _type: "reviewAuthor",
        name: rawName,
        ...(websiteUrl ? { websiteUrl } : {}),
      },
      reviewCount,
      rawName,
    };

    if (deduped.has(_id)) {
      const existing = deduped.get(_id)!;

      // Prefer the entry with more reviews (as a proxy for canonical source)
      if (reviewCount > existing.reviewCount) {
        deduped.set(_id, prepared);
      } else if (
        reviewCount === existing.reviewCount &&
        rawName.length > existing.rawName.length
      ) {
        // If review counts tie, prefer the longer/more descriptive name
        deduped.set(_id, prepared);
      }

      continue;
    }

    deduped.set(_id, prepared);
  }

  const authors = Array.from(deduped.values()).sort(
    (a, b) => b.reviewCount - a.reviewCount,
  );

  if (authors.length === 0 && normalizedFilter) {
    console.log(`⚠️  No authors matched filter "${authorFilter}"`);
  }

  return authors;
}

function readCsvRows(csvPath: string): CsvRow[] {
  const resolved = resolve(process.cwd(), csvPath);
  try {
    const fileContent = readFileSync(resolved, "utf-8");
    return parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    console.error(`❌ Unable to read CSV file at ${resolved}`);
    throw error;
  }
}

function createMigrationClient(): SanityClient {
  const projectId = process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || DEFAULT_DATASET;
  const token = process.env.SANITY_API_TOKEN;

  if (!token) {
    throw new Error("SANITY_API_TOKEN environment variable is required");
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2024-01-01",
    useCdn: false,
  });
}

async function migrateAuthors(
  authors: PreparedAuthor[],
  dryRun: boolean,
): Promise<void> {
  if (authors.length === 0) {
    console.log("ℹ️  No authors to migrate.");
    return;
  }

  console.log(
    `\n📦 Prepared ${authors.length} unique author document${authors.length === 1 ? "" : "s"}.`,
  );

  if (dryRun) {
    console.log("\n🧪 DRY RUN OUTPUT");
    authors.forEach(({ doc, reviewCount }) => {
      console.log(`\n${doc._id} (${reviewCount} reviews)`);
      console.log(JSON.stringify(doc, null, 2));
    });
    console.log(
      "\n💡 Run again without --dry-run to write documents to Sanity.",
    );
    return;
  }

  const client = createMigrationClient();

  console.log("\n🚀 Migrating authors to Sanity...");
  for (const { doc, reviewCount } of authors) {
    try {
      await client.createOrReplace(doc);
      console.log(`   ✓ ${doc.name} (${reviewCount} reviews) → ${doc._id}`);
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${doc.name}:`, error);
    }
  }

  console.log("\n✅ Author migration complete.");
}

async function main(): Promise<void> {
  const { csvPath, dryRun, verbose, authorFilter } = parseArgs();

  console.log("");
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║            AUDIOFAST DATA MIGRATION                           ║",
  );
  console.log(
    "║            Review Authors                                     ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");
  console.log(`CSV Path: ${resolve(process.cwd(), csvPath)}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  if (authorFilter) {
    console.log(`Author Filter: ${authorFilter}`);
  }
  console.log("");

  const rows = readCsvRows(csvPath);
  console.log(`Found ${rows.length} CSV rows.`);

  const authors = buildAuthorDocuments(rows, authorFilter, verbose);
  await migrateAuthors(authors, dryRun);
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
