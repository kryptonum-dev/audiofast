/**
 * CSV Parser for Review Migration
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import type { ReviewCsvRow } from "../types";

/**
 * Read and parse review CSV file
 */
export function readReviewsCsv(csvPath: string): ReviewCsvRow[] {
  const resolved = resolve(process.cwd(), csvPath);
  console.log(`📂 Reading CSV: ${resolved}`);

  const file = readFileSync(resolved, "utf-8");
  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as ReviewCsvRow[];

  console.log(`   Found ${rows.length} reviews in CSV`);
  return rows;
}

/**
 * Clean string value (handle null, "NULL", whitespace)
 */
export function cleanString(value: string | null | undefined): string {
  if (value === undefined || value === null) return "";
  const cleaned = value.replace(/\u00a0/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return "";
  return cleaned;
}

/**
 * Parse review type from string
 */
export function parseReviewType(
  type: string | null | undefined,
): "page" | "pdf" | "external" {
  const cleaned = cleanString(type).toLowerCase();
  if (cleaned === "external") return "external";
  if (cleaned === "pdf") return "pdf";
  return "page";
}

/**
 * Filter reviews by options
 */
export function filterReviews(
  rows: ReviewCsvRow[],
  options: {
    minId?: number;
    limit?: number;
    skipIds?: Set<string>;
  },
): ReviewCsvRow[] {
  let filtered = rows;

  // Filter by minimum ID
  if (options.minId !== undefined) {
    filtered = filtered.filter((row) => {
      const id = parseInt(row.ID, 10);
      return !isNaN(id) && id > options.minId!;
    });
    console.log(`   After minId filter (>${options.minId}): ${filtered.length} reviews`);
  }

  // Skip already existing IDs
  if (options.skipIds && options.skipIds.size > 0) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((row) => {
      const sanityId = `review-${row.ID}`;
      return !options.skipIds!.has(sanityId);
    });
    console.log(
      `   Skipping ${beforeCount - filtered.length} existing reviews`,
    );
  }

  // Apply limit
  if (options.limit !== undefined && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
    console.log(`   Limited to ${options.limit} reviews`);
  }

  return filtered;
}
