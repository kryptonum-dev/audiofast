/**
 * Reference Resolver for Product Migration
 *
 * Resolves brand slugs, category slugs, and review slugs to their Sanity document IDs.
 * Caches lookups to minimize API calls.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";

import type { ReferenceMappings, SanityReference } from "../types";

// ============================================================================
// Reference Cache
// ============================================================================

let referenceMappings: ReferenceMappings | null = null;

// Legacy review ID to Sanity ID mapping (loaded from CSV + Sanity)
let legacyReviewIdMapping: Map<string, string> | null = null;

// Set of review IDs that actually exist in Sanity (for validation)
let existingReviewIds: Set<string> | null = null;

const DEFAULT_PRODUCTS_REVIEWS_CSV_PATH = "csv/products/december/products-reviews.csv";

type ProductReviewRow = {
  ProductID: string;
  ReviewID: string;
  SortOrder: string;
  ReviewTitle: string;
  ReviewSlug: string;
};

/**
 * Load all reference mappings from Sanity (brands, categories, reviews)
 */
export async function loadReferenceMappings(
  client: SanityClient,
): Promise<ReferenceMappings> {
  if (referenceMappings) {
    return referenceMappings;
  }

  console.log("\n🔗 Loading reference mappings from Sanity...");

  // Load brands
  const brands = await client.fetch<
    Array<{ _id: string; slug: { current: string } }>
  >(`*[_type == "brand" && defined(slug.current)]{_id, slug}`);
  const brandMapping: Record<string, string> = {};
  for (const brand of brands) {
    // Extract slug from full path (e.g., "/marki/acoustic-signature/" → "acoustic-signature")
    const slug = brand.slug.current
      .replace(/^\/marki\//, "")
      .replace(/\/$/, "");
    brandMapping[slug] = brand._id;
  }
  console.log(`   ✓ Loaded ${brands.length} brand mappings`);

  // Load categories (product categories/types)
  const categories = await client.fetch<
    Array<{ _id: string; slug: { current: string } }>
  >(`*[_type == "productCategorySub" && defined(slug.current)]{_id, slug}`);
  const categoryMapping: Record<string, string> = {};
  for (const category of categories) {
    // Extract slug from full path (e.g., "/produkty/kategoria/gramofony/" → "gramofony")
    const slug = category.slug.current
      .replace(/^\/produkty\/kategoria\//, "")
      .replace(/^\/kategoria\//, "")
      .replace(/\/$/, "");
    categoryMapping[slug] = category._id;
  }
  console.log(`   ✓ Loaded ${categories.length} category mappings`);

  // Load ALL reviews (including PDF and external types that don't have slugs)
  const reviews = await client.fetch<
    Array<{ _id: string; slug?: { current: string }; destinationType?: string }>
  >(`*[_type == "review"]{_id, slug, destinationType}`);
  const reviewMapping: Record<string, string> = {};
  existingReviewIds = new Set<string>();
  let pageReviews = 0;
  let otherReviews = 0;

  for (const review of reviews) {
    // Track all existing review IDs for validation
    existingReviewIds.add(review._id);

    // For page type reviews with slug, map by slug
    if (review.slug?.current) {
      const slug = review.slug.current
        .replace(/^\/recenzje\//, "")
        .replace(/\/$/, "");
      reviewMapping[slug] = review._id;
      pageReviews++;
    } else {
      otherReviews++;
    }

    // Also map by _id pattern for legacy ID lookups (e.g., "review-123" → extract "123")
    // This helps match PDF/external reviews that were migrated with ID pattern
    if (review._id.startsWith("review-")) {
      const legacyIdFromSanityId = review._id.replace("review-", "");
      // Store with a special prefix to avoid collisions with slugs
      reviewMapping[`__id__${legacyIdFromSanityId}`] = review._id;
    }
  }
  console.log(
    `   ✓ Loaded ${reviews.length} review mappings (${pageReviews} with slug, ${otherReviews} PDF/external)`,
  );

  referenceMappings = {
    brands: brandMapping,
    categories: categoryMapping,
    reviews: reviewMapping,
  };

  return referenceMappings;
}

/**
 * Load legacy review ID to Sanity ID mappings
 * Uses products-reviews.csv to get legacy ID → slug mapping,
 * then uses Sanity reviews to get slug → Sanity ID mapping
 *
 * Supports three matching strategies:
 * 1. By slug (for page-type reviews)
 * 2. By Sanity _id pattern "review-{legacyId}" (for all review types)
 * 3. Direct fallback using "review-{legacyId}" pattern
 */
export function loadLegacyReviewIdMappings(): void {
  if (legacyReviewIdMapping || !referenceMappings) {
    return;
  }

  console.log("\n🔗 Loading legacy review ID mappings...");

  legacyReviewIdMapping = new Map();

  try {
    const resolved = resolve(process.cwd(), DEFAULT_PRODUCTS_REVIEWS_CSV_PATH);
    const file = readFileSync(resolved, "utf-8");
    const rows = parse(file, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as ProductReviewRow[];

    let matchedBySlug = 0;
    let matchedById = 0;
    let unmatched = 0;

    for (const row of rows) {
      const legacyId = row.ReviewID;
      const slug = row.ReviewSlug;

      // Strategy 1: Try to find by slug (page-type reviews)
      let sanityId = referenceMappings.reviews[slug];

      if (sanityId) {
        legacyReviewIdMapping.set(legacyId, sanityId);
        matchedBySlug++;
        continue;
      }

      // Strategy 2: Try to find by Sanity _id pattern "review-{legacyId}"
      sanityId = referenceMappings.reviews[`__id__${legacyId}`];

      if (sanityId) {
        legacyReviewIdMapping.set(legacyId, sanityId);
        matchedById++;
        continue;
      }

      // Strategy 3: Assume the review exists with ID "review-{legacyId}"
      // This is a fallback that allows resolving references even if we didn't
      // load all reviews (e.g., if they were migrated separately)
      legacyReviewIdMapping.set(legacyId, `review-${legacyId}`);
      unmatched++;
    }

    console.log(`   ✓ Matched ${matchedBySlug} legacy reviews by slug`);
    console.log(`   ✓ Matched ${matchedById} legacy reviews by ID pattern`);
    if (unmatched > 0) {
      console.log(
        `   ⚠️  ${unmatched} reviews assumed with ID pattern "review-{legacyId}"`,
      );
    }
  } catch (err) {
    console.warn(
      `   ⚠️  Could not load legacy review mappings: ${err instanceof Error ? err.message : err}`,
    );
  }
}

/**
 * Clear cached mappings (useful for testing)
 */
export function clearReferenceMappings(): void {
  referenceMappings = null;
  legacyReviewIdMapping = null;
  existingReviewIds = null;
}

/**
 * Get current mappings without refetching
 */
export function getReferenceMappings(): ReferenceMappings | null {
  return referenceMappings;
}

// ============================================================================
// Reference Resolution
// ============================================================================

/**
 * Resolve a brand slug to a Sanity reference
 */
export function resolveBrandReference(
  brandSlug: string,
): SanityReference | null {
  if (!referenceMappings) {
    console.warn(
      "⚠️  Reference mappings not loaded. Call loadReferenceMappings first.",
    );
    return null;
  }

  const brandId = referenceMappings.brands[brandSlug];
  if (!brandId) {
    console.warn(`   ⚠️  Brand not found: ${brandSlug}`);
    return null;
  }

  return {
    _type: "reference",
    _ref: brandId,
  };
}

/**
 * Resolve category slugs to Sanity references
 */
export function resolveCategoryReferences(
  categorySlugs: string[],
): SanityReference[] {
  if (!referenceMappings) {
    console.warn(
      "⚠️  Reference mappings not loaded. Call loadReferenceMappings first.",
    );
    return [];
  }

  const references: SanityReference[] = [];
  for (const slug of categorySlugs) {
    const categoryId = referenceMappings.categories[slug];
    if (categoryId) {
      references.push({
        _type: "reference",
        _key: generateKey(),
        _ref: categoryId,
      });
    } else {
      console.warn(`   ⚠️  Category not found: ${slug}`);
    }
  }

  return references;
}

/**
 * Resolve review slugs to Sanity references
 * Supports both slug-based lookups (page reviews) and ID-based fallback (PDF/external reviews)
 * @param reviewSlugs - Array of review slugs to resolve
 * @param options.silent - If true, suppress warnings for not-found reviews (useful when there's a fallback)
 */
export function resolveReviewReferences(
  reviewSlugs: string[],
  options: { silent?: boolean } = {},
): SanityReference[] {
  if (!referenceMappings) {
    console.warn(
      "⚠️  Reference mappings not loaded. Call loadReferenceMappings first.",
    );
    return [];
  }

  const references: SanityReference[] = [];
  for (const slug of reviewSlugs) {
    // Try by slug first
    let reviewId = referenceMappings.reviews[slug];

    // If not found by slug, this might be a legacy ID - try the __id__ pattern
    if (!reviewId && legacyReviewIdMapping) {
      // The slug might actually be a legacy ID in some cases
      reviewId = legacyReviewIdMapping.get(slug) || undefined;
    }

    if (reviewId) {
      references.push({
        _type: "reference",
        _key: generateKey(),
        _ref: reviewId,
      });
    } else if (!options.silent) {
      console.warn(`   ⚠️  Review not found: ${slug}`);
    }
  }

  return references;
}

/**
 * Check if a review ID exists in Sanity
 */
export function reviewExistsInSanity(reviewId: string): boolean {
  if (!existingReviewIds) {
    return false;
  }
  return existingReviewIds.has(reviewId);
}

/**
 * Resolve a legacy review ID (from [recenzja id=X]) to a Sanity reference
 * @param options.validateExists - If true (default), verify the review exists in Sanity before returning
 */
export function resolveReviewByLegacyId(
  legacyId: string,
  options: { validateExists?: boolean } = {},
): SanityReference | null {
  const { validateExists = true } = options;

  if (!legacyReviewIdMapping) {
    // Try to load if not yet loaded
    loadLegacyReviewIdMappings();
  }

  if (!legacyReviewIdMapping) {
    console.warn("⚠️  Legacy review ID mappings not available");
    return null;
  }

  const sanityId = legacyReviewIdMapping.get(legacyId);
  if (!sanityId) {
    console.warn(`   ⚠️  Legacy review ID ${legacyId} not found in Sanity`);
    return null;
  }

  // Validate that the review actually exists in Sanity
  if (validateExists && !reviewExistsInSanity(sanityId)) {
    console.warn(
      `   ⚠️  Review ${sanityId} (legacy ID ${legacyId}) does not exist in Sanity - skipping`,
    );
    return null;
  }

  return {
    _type: "reference",
    _ref: sanityId,
  };
}

// ============================================================================
// Dry Run Helpers
// ============================================================================

/**
 * Create mock reference mappings for dry run
 */
export function createDryRunMappings(
  brandSlugs: string[],
  categorySlugs: string[],
  reviewSlugs: string[],
): ReferenceMappings {
  const brands: Record<string, string> = {};
  for (const slug of brandSlugs) {
    brands[slug] = `brand-dryrun-${slug}`;
  }

  const categories: Record<string, string> = {};
  for (const slug of categorySlugs) {
    categories[slug] = `category-dryrun-${slug}`;
  }

  const reviews: Record<string, string> = {};
  for (const slug of reviewSlugs) {
    reviews[slug] = `review-dryrun-${slug}`;
  }

  referenceMappings = { brands, categories, reviews };
  return referenceMappings;
}

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that all required references exist
 */
export function validateReferences(
  brandSlug: string,
  categorySlugs: string[],
  reviewSlugs: string[],
): {
  valid: boolean;
  missing: { brands: string[]; categories: string[]; reviews: string[] };
} {
  const missing = {
    brands: [] as string[],
    categories: [] as string[],
    reviews: [] as string[],
  };

  if (!referenceMappings) {
    return { valid: false, missing };
  }

  // Check brand
  if (!referenceMappings.brands[brandSlug]) {
    missing.brands.push(brandSlug);
  }

  // Check categories
  for (const slug of categorySlugs) {
    if (!referenceMappings.categories[slug]) {
      missing.categories.push(slug);
    }
  }

  // Check reviews
  for (const slug of reviewSlugs) {
    if (!referenceMappings.reviews[slug]) {
      missing.reviews.push(slug);
    }
  }

  const valid =
    missing.brands.length === 0 &&
    missing.categories.length === 0 &&
    missing.reviews.length === 0;

  return { valid, missing };
}

/**
 * Print reference statistics
 */
export function printReferenceStats(): void {
  if (!referenceMappings) {
    console.log("   No reference mappings loaded");
    return;
  }

  console.log("\n📊 Reference Statistics:");
  console.log(`   Brands: ${Object.keys(referenceMappings.brands).length}`);
  console.log(
    `   Categories: ${Object.keys(referenceMappings.categories).length}`,
  );
  console.log(`   Reviews: ${Object.keys(referenceMappings.reviews).length}`);
}
