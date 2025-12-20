/**
 * Author Resolver for Review Migration
 *
 * Resolves author names to Sanity reviewAuthor document references
 */

import type { SanityClient } from "@sanity/client";
import slugify from "slugify";

import type { SanityReference } from "../types";
import { cleanString } from "../utils/csv-parser";

// Cache of author mappings
let authorMap: Map<string, string> | null = null;

/**
 * Load all review authors from Sanity into cache
 */
export async function loadAuthorMappings(
  client: SanityClient,
): Promise<Map<string, string>> {
  if (authorMap) {
    return authorMap;
  }

  console.log("\n🔗 Loading review author mappings from Sanity...");

  const docs = await client.fetch<Array<{ _id: string; name: string }>>(
    '*[_type == "reviewAuthor"]{_id, name}',
  );

  authorMap = new Map<string, string>();
  for (const doc of docs) {
    const normalizedName = slugify(cleanString(doc.name), {
      lower: true,
      strict: true,
      trim: true,
    });
    authorMap.set(normalizedName, doc._id);
  }

  console.log(`   ✓ Loaded ${authorMap.size} author mappings`);
  return authorMap;
}

/**
 * Create dry-run author mappings (mock data)
 */
export function createDryRunAuthorMappings(
  authorNames: string[],
): Map<string, string> {
  authorMap = new Map<string, string>();

  for (const name of authorNames) {
    const normalizedName = slugify(cleanString(name), {
      lower: true,
      strict: true,
      trim: true,
    });
    authorMap.set(normalizedName, `review-author-${normalizedName}`);
  }

  console.log(`   ✓ Created ${authorMap.size} dry-run author mappings`);
  return authorMap;
}

/**
 * Resolve an author name to a Sanity reference
 */
export function resolveAuthorReference(
  authorName: string | null | undefined,
): SanityReference | null {
  if (!authorMap) {
    console.warn(
      "⚠️  Author mappings not loaded. Call loadAuthorMappings first.",
    );
    return null;
  }

  const cleanedName = cleanString(authorName);
  if (!cleanedName) {
    return null;
  }

  const normalizedName = slugify(cleanedName, {
    lower: true,
    strict: true,
    trim: true,
  });

  const authorId = authorMap.get(normalizedName);
  if (!authorId) {
    console.warn(`   ⚠️  Author not found: "${cleanedName}" (slug: ${normalizedName})`);
    return null;
  }

  return {
    _type: "reference",
    _ref: authorId,
  };
}

/**
 * Check if an author exists in the cache
 */
export function authorExists(authorName: string): boolean {
  if (!authorMap) return false;

  const cleanedName = cleanString(authorName);
  if (!cleanedName) return false;

  const normalizedName = slugify(cleanedName, {
    lower: true,
    strict: true,
    trim: true,
  });

  return authorMap.has(normalizedName);
}

/**
 * Clear author cache (useful for testing)
 */
export function clearAuthorMappings(): void {
  authorMap = null;
}

/**
 * Get author statistics
 */
export function getAuthorStats(): { total: number; names: string[] } {
  if (!authorMap) {
    return { total: 0, names: [] };
  }

  return {
    total: authorMap.size,
    names: Array.from(authorMap.keys()),
  };
}
