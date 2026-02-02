import { createClient } from '@sanity/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Request payload types for the revalidation API.
 *
 * Supports multiple use cases:
 * - Sanity webhooks: { _type, _id, slug, operation }
 * - Manual/programmatic: { tags: [...], paths: [...] }
 * - Combined: All fields can be used together
 */
type RevalidateRequest = {
  // Sanity webhook payload
  _id?: string;
  _type?: string;
  slug?: string | null;
  operation?: 'create' | 'update' | 'delete';
  // Manual/programmatic revalidation
  tags?: string[];
  paths?: string[];
};

// ============================================================================
// SANITY CLIENT FOR DENORMALIZATION
// ============================================================================

/**
 * Sanity client for denormalization operations.
 * Uses a write token to update product documents when brands/categories change.
 */
function getSanityClient() {
  const token = process.env.NEXT_REVALIDATE_TOKEN;

  if (!token) {
    console.warn(
      '[Denorm] SANITY_WEBHOOK_WRITE_TOKEN not set - denormalization disabled',
    );
    return null;
  }

  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  });
}

const TAG_DENYLIST = new Set(['sanity.imageAsset', 'sanity.fileAsset']);

// ============================================================================
// REVERSE LOOKUP UTILITIES
// ============================================================================

/**
 * Extract the slug portion from a full Sanity slug path.
 * Examples:
 *   "/produkty/yamaha-thr10ii/" -> "yamaha-thr10ii"
 *   "/blog/nowy-artykul/" -> "nowy-artykul"
 *   "/kontakt/" -> "kontakt"
 */
function extractSlug(fullSlug: string | null | undefined): string | null {
  if (!fullSlug) return null;
  // Remove leading path segment and trailing slash
  const slug = fullSlug.replace(/^\/[^/]+\//, '').replace(/\/$/, '');
  // Handle root-level pages like "/kontakt/" -> "kontakt"
  if (!slug && fullSlug.startsWith('/')) {
    return fullSlug.replace(/^\//, '').replace(/\/$/, '') || null;
  }
  return slug || null;
}

/**
 * Types that should trigger reverse lookup to find referencing documents.
 * These types can be embedded/referenced in other documents via PageBuilder,
 * portable text, or direct references.
 */
const REVERSE_LOOKUP_TYPES = new Set([
  'product',
  'review',
  'blog-article',
  'productCategorySub',
  'productCategoryParent',
]);

/**
 * Perform reverse lookup to find all documents that reference a given document,
 * then return the specific cache tags for those documents.
 *
 * This enables precise invalidation: when Product X changes, we find all documents
 * that reference Product X (related products, home page carousels, etc.) and
 * invalidate only those specific pages instead of broad categories.
 */
async function getReferencingDocumentTags(
  docId: string,
  docType: string,
  docSlug: string | null | undefined,
): Promise<string[]> {
  const client = getSanityClient();
  if (!client) return [];

  const tags: string[] = [];

  // 1. Add specific tag for the edited document itself
  if (docSlug) {
    const slug = extractSlug(docSlug);
    if (slug) {
      switch (docType) {
        case 'product':
          tags.push(`product:${slug}`);
          break;
        case 'blog-article':
          tags.push(`blog-article:${slug}`);
          break;
        case 'review':
          tags.push(`review:${slug}`);
          break;
        case 'page':
          tags.push(`page:${slug}`);
          break;
      }
    }
  }

  // 2. Find all documents that reference this document
  try {
    const references = await client.fetch<
      Array<{
        _type: string;
        slug: string | null;
      }>
    >(
      `*[references($id) && !(_id in path("drafts.**"))]{ _type, "slug": slug.current }`,
      { id: docId },
    );

    for (const ref of references) {
      // Handle singleton types (no slug needed)
      if (ref._type === 'homePage') {
        tags.push('homePage');
        continue;
      }
      if (ref._type === 'cpoPage') {
        tags.push('cpoPage');
        continue;
      }

      // Handle document types with slugs
      const refSlug = extractSlug(ref.slug);
      if (!refSlug) continue;

      switch (ref._type) {
        case 'product':
          tags.push(`product:${refSlug}`);
          break;
        case 'page':
          tags.push(`page:${refSlug}`);
          break;
        case 'review':
          tags.push(`review:${refSlug}`);
          break;
        case 'blog-article':
          tags.push(`blog-article:${refSlug}`);
          break;
      }
    }

    if (references.length > 0) {
      console.log(
        `[ReverseLookup] Found ${references.length} documents referencing ${docType} ${docId}`,
      );
    }
  } catch (error) {
    console.error(
      `[ReverseLookup] Error querying references for ${docId}:`,
      error,
    );
  }

  return tags;
}

/**
 * For category changes, find all products in that category and return their specific tags.
 * This ensures product pages show updated category information.
 */
async function getProductsInCategoryTags(
  categoryId: string,
): Promise<string[]> {
  const client = getSanityClient();
  if (!client) return [];

  try {
    const products = await client.fetch<Array<{ slug: string | null }>>(
      `*[_type == "product" && $categoryId in categories[]._ref && !(_id in path("drafts.**"))]{ "slug": slug.current }`,
      { categoryId },
    );

    const tags: string[] = [];
    for (const product of products) {
      const slug = extractSlug(product.slug);
      if (slug) {
        tags.push(`product:${slug}`);
      }
    }

    if (products.length > 0) {
      console.log(
        `[ReverseLookup] Found ${products.length} products in category ${categoryId}`,
      );
    }

    return tags;
  } catch (error) {
    console.error(
      `[ReverseLookup] Error querying products for category ${categoryId}:`,
      error,
    );
    return [];
  }
}

/**
 * Static dependency map - defines which cache tags should be revalidated
 * when a document of a given type changes.
 *
 * SIMPLIFIED FOR ISR COST REDUCTION (Hybrid Approach):
 * - Product/brand edits only invalidate listings + all brand pages
 * - Home page, CMS pages, reviews, blog articles are NOT auto-invalidated
 * - Those will be handled by reverse lookup in the webhook handler (Phase 3)
 *
 * Why "brand" for all brand pages (hybrid approach)?
 * When a product's brand changes (e.g., from Suniata to Yamaha), we need to
 * invalidate BOTH the old and new brand pages. But the webhook only tells us
 * the NEW brand. By using a broad "brand" tag, all ~30 brand pages are invalidated,
 * ensuring correct data without needing to track the old brand.
 */
const TYPE_DEPENDENCY_MAP: Record<string, string[]> = {
  // ============================================================================
  // CORE CONTENT TYPES - Simplified for ISR cost reduction
  // ============================================================================

  // Products: Only invalidate listings and ALL brand pages (hybrid approach)
  // Home page, CMS pages, reviews, blog articles handled by reverse lookup (Phase 3)
  product: ['products', 'brand'],

  // Brands: Invalidate brand listings, product filters, and all brand pages
  brand: ['brands', 'products', 'brand'],

  // Reviews: No automatic cascade - handled by reverse lookup
  review: [],

  // Blog articles: Only blog listing
  'blog-article': ['blog'],

  // ============================================================================
  // CATEGORY & ORGANIZATION TYPES
  // ============================================================================

  productCategorySub: ['products', 'productCategorySub'],
  productCategoryParent: ['products'],
  'blog-category': ['blog', 'blog-category'],

  // ============================================================================
  // PEOPLE & ORGANIZATION TYPES
  // ============================================================================

  teamMember: ['teamMember'],
  reviewAuthor: ['reviewAuthor'],
  faq: ['faq'],
  store: ['store', 'brand'], // Stores appear on brand pages
  award: ['award'],

  // ============================================================================
  // SINGLETON PAGES
  // ============================================================================

  homePage: ['homePage'],
  cpoPage: ['cpoPage'],
  blog: ['blog'],
  products: ['products'],
  brands: ['brands'],
  page: ['page'],

  // ============================================================================
  // GLOBAL/LAYOUT TYPES
  // ============================================================================

  settings: ['settings'],
  navbar: ['navbar'],
  footer: ['footer'],
  socialMedia: ['socialMedia', 'footer'],

  // ============================================================================
  // CONFIGURATION TYPES
  // ============================================================================

  comparatorConfig: ['comparatorConfig'],
  newsletterSettings: ['newsletterSettings'],

  // ============================================================================
  // LEGAL/STATIC PAGES
  // ============================================================================

  privacyPolicy: ['privacyPolicy'],
  termsAndConditions: ['termsAndConditions'],
  notFound: ['notFound'],
  redirects: [],
};

/**
 * Get all tags that should be revalidated when a document type changes.
 * Falls back to just the type itself if not in the map.
 */
function getTransitiveDependencies(documentType: string): string[] {
  return TYPE_DEPENDENCY_MAP[documentType] ?? [documentType];
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const revalidateToken = process.env.NEXT_REVALIDATE_TOKEN;

  if (!revalidateToken) {
    console.error(
      '[Revalidation] Missing NEXT_REVALIDATE_TOKEN environment variable.',
    );
    return NextResponse.json(
      { revalidated: false, message: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  const authorizationHeader = request.headers.get('authorization');

  if (authorizationHeader !== `Bearer ${revalidateToken}`) {
    return NextResponse.json(
      { revalidated: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: RevalidateRequest | RevalidateRequest[];

  try {
    payload = (await request.json()) as RevalidateRequest | RevalidateRequest[];
  } catch (error) {
    console.error('[Revalidation] Invalid webhook payload', error);
    return NextResponse.json(
      { revalidated: false, message: 'Invalid payload' },
      { status: 400 },
    );
  }

  // Normalize to array for unified processing
  const documents = Array.isArray(payload) ? payload : [payload];

  const revalidatedTags: string[] = [];
  const revalidatedPaths: string[] = [];
  const tags = new Set<string>();

  // Track denormalization tasks to run in parallel
  const denormTasks: Promise<void>[] = [];

  // Track reverse lookup tasks
  const reverseLookupTasks: Promise<string[]>[] = [];

  for (const doc of documents) {
    // =========================================================================
    // Handle Sanity webhook payload (_type)
    // =========================================================================
    if (doc._type) {
      // Add all transitive dependencies from the static map
      const transitiveDeps = getTransitiveDependencies(doc._type);
      transitiveDeps.forEach((tag) => addTag(tags, tag));

      // =========================================================================
      // Reverse Lookup for precise invalidation (Phase 3)
      // =========================================================================
      // For certain types, find documents that reference this document and
      // invalidate their specific cache tags instead of broad categories.
      if (doc._id && REVERSE_LOOKUP_TYPES.has(doc._type)) {
        reverseLookupTasks.push(
          getReferencingDocumentTags(doc._id, doc._type, doc.slug),
        );

        // For category changes, also find products in that category
        if (
          doc._type === 'productCategorySub' ||
          doc._type === 'productCategoryParent'
        ) {
          reverseLookupTasks.push(getProductsInCategoryTags(doc._id));
        }
      }

      // =========================================================================
      // Denormalization for brand/category changes
      // =========================================================================
      // When a brand or category is updated (not deleted), update the
      // denormalized fields on all products referencing it.
      if (doc._id && doc.operation !== 'delete') {
        if (doc._type === 'brand') {
          denormTasks.push(updateProductsForBrand(doc._id));
        } else if (doc._type === 'productCategorySub') {
          denormTasks.push(updateProductsForCategory(doc._id));
        }
      }
    }

    // =========================================================================
    // Handle explicit tags (for manual/programmatic revalidation)
    // =========================================================================
    if (doc.tags && Array.isArray(doc.tags)) {
      for (const tag of doc.tags) {
        addTag(tags, tag);
      }
    }

    // =========================================================================
    // Handle explicit paths (for specific route revalidation)
    // =========================================================================
    if (doc.paths && Array.isArray(doc.paths)) {
      for (const path of doc.paths) {
        if (typeof path === 'string' && path.startsWith('/')) {
          revalidatePath(path);
          revalidatedPaths.push(path);
        }
      }
    }
  }

  // =========================================================================
  // Wait for reverse lookup tasks and add their tags
  // =========================================================================
  if (reverseLookupTasks.length > 0) {
    try {
      const reverseLookupResults = await Promise.all(reverseLookupTasks);
      for (const resultTags of reverseLookupResults) {
        for (const tag of resultTags) {
          addTag(tags, tag);
        }
      }
    } catch (error) {
      console.error('[ReverseLookup] Error in reverse lookup tasks:', error);
    }
  }

  // Revalidate all collected tags
  // Using { expire: 0 } for immediate cache expiration instead of stale-while-revalidate.
  // This ensures clients see fresh content on the FIRST visit after publishing in Sanity,
  // rather than needing a second visit/refresh with 'max' profile.
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
    revalidatedTags.push(tag);
  }

  // Wait for denormalization tasks to complete (fire-and-forget style)
  // We don't block the response on these, but we log any errors
  if (denormTasks.length > 0) {
    Promise.all(denormTasks).catch((error) => {
      console.error('[Denorm] Error in denormalization tasks:', error);
    });
  }

  // Log what was revalidated
  const documentTypes = documents
    .map((d) => d._type)
    .filter(Boolean)
    .join(', ');

  if (revalidatedTags.length > 0 || revalidatedPaths.length > 0) {
    const logParts = [`[Revalidation] ${timestamp}`];
    if (documentTypes) logParts.push(`Types: ${documentTypes}`);
    if (revalidatedTags.length > 0) {
      logParts.push(`Tags: ${revalidatedTags.join(', ')}`);
    }
    if (revalidatedPaths.length > 0) {
      logParts.push(`Paths: ${revalidatedPaths.join(', ')}`);
    }
    console.log(logParts.join(' | '));
  }

  // Return success even if no actions (valid for health checks with empty payload)
  return NextResponse.json({
    revalidated: revalidatedTags.length > 0 || revalidatedPaths.length > 0,
    tags: revalidatedTags,
    paths: revalidatedPaths,
    timestamp,
  });
}

/**
 * Health check endpoint.
 * Useful for monitoring and understanding the API capabilities.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Cache Revalidation API',
    description:
      'Invalidates Next.js cache with immediate expiration for instant content updates',
    supportedPayloads: {
      sanityWebhook: {
        description: 'Sanity document change webhook',
        example: { _type: 'product', _id: 'abc123' },
      },
      explicitTags: {
        description: 'Manually revalidate specific cache tags',
        example: { tags: ['product', 'homePage'] },
      },
      explicitPaths: {
        description: 'Manually revalidate specific routes',
        example: { paths: ['/produkty/', '/'] },
      },
      combined: {
        description: 'All options can be combined in one request',
        example: {
          _type: 'product',
          _id: 'abc123',
          tags: ['extra-tag'],
          paths: ['/custom/'],
        },
      },
    },
    features: {
      transitiveRevalidation:
        'Automatically revalidates dependent content (e.g., brand → products → pages)',
      immediateExpiration:
        'Uses revalidateTag with { expire: 0 } for immediate cache invalidation - visitors see fresh content on first visit after publishing',
      staticDependencyMap:
        'Pre-defined content relationships for instant, zero-latency revalidation',
      reverseLookup:
        'Queries Sanity to find documents referencing the edited document, enabling precise specific-tag invalidation instead of broad categories',
    },
    authentication:
      'Bearer token via NEXT_REVALIDATE_TOKEN environment variable',
  });
}

function addTag(tagSet: Set<string>, tag?: string | null) {
  if (!tag || TAG_DENYLIST.has(tag)) {
    return;
  }

  const trimmed = tag.trim();

  if (trimmed.length === 0 || trimmed.length > 256) {
    return;
  }

  tagSet.add(trimmed);
}
// ============================================================================
// DENORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Updates denormalized brand fields on all products referencing a brand.
 * Called when a brand document is created or updated.
 */
async function updateProductsForBrand(brandId: string): Promise<void> {
  const client = getSanityClient();
  if (!client) return;

  try {
    // Fetch brand data
    const brand = await client.fetch<{ name: string; slug: string } | null>(
      `*[_id == $id][0]{ name, "slug": slug.current }`,
      { id: brandId },
    );

    if (!brand) {
      console.log(`[Denorm] Brand ${brandId} not found, skipping`);
      return;
    }

    // Extract slug without prefix: "/marki/yamaha/" -> "yamaha"
    const brandSlug =
      brand.slug?.replace('/marki/', '').replace(/\/$/, '') || null;

    // Find all products referencing this brand (published only)
    const productIds = await client.fetch<string[]>(
      `*[_type == "product" && brand._ref == $brandId && !(_id in path("drafts.**"))]._id`,
      { brandId },
    );

    if (productIds.length === 0) {
      console.log(`[Denorm] No products found for brand ${brand.name}`);
      return;
    }

    console.log(
      `[Denorm] Updating ${productIds.length} products for brand ${brand.name}`,
    );

    // Update products in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batch = productIds.slice(i, i + BATCH_SIZE);
      const transaction = client.transaction();

      for (const id of batch) {
        transaction.patch(id, (p) =>
          p.set({
            denormBrandSlug: brandSlug,
            denormBrandName: brand.name,
            denormLastSync: new Date().toISOString(),
          }),
        );
      }

      await transaction.commit({ visibility: 'async' });
    }

    console.log(
      `[Denorm] Successfully updated ${productIds.length} products for brand ${brand.name}`,
    );
  } catch (error) {
    console.error(
      `[Denorm] Error updating products for brand ${brandId}:`,
      error,
    );
  }
}

/**
 * Updates denormalized category fields on all products referencing a category.
 * Called when a category document is created or updated.
 */
async function updateProductsForCategory(categoryId: string): Promise<void> {
  const client = getSanityClient();
  if (!client) return;

  try {
    // Fetch category data
    const category = await client.fetch<{
      slug: string;
      parentSlug: string | null;
    } | null>(
      `*[_id == $id][0]{
        "slug": slug.current,
        "parentSlug": parentCategory->slug.current
      }`,
      { id: categoryId },
    );

    if (!category) {
      console.log(`[Denorm] Category ${categoryId} not found, skipping`);
      return;
    }

    // Find all products referencing this category (published only)
    const products = await client.fetch<
      Array<{
        _id: string;
        categories: Array<{ _ref: string }>;
      }>
    >(
      `*[_type == "product" && $categoryId in categories[]._ref && !(_id in path("drafts.**"))]{
        _id,
        categories
      }`,
      { categoryId },
    );

    if (products.length === 0) {
      console.log(`[Denorm] No products found for category ${category.slug}`);
      return;
    }

    console.log(
      `[Denorm] Updating ${products.length} products for category ${category.slug}`,
    );

    // For each product, recompute all category slugs
    for (const product of products) {
      const categoryRefs = product.categories.map((c) => c._ref);

      const categories = await client.fetch<
        Array<{ slug: string; parentSlug: string | null }>
      >(
        `*[_id in $ids]{
          "slug": slug.current,
          "parentSlug": parentCategory->slug.current
        }`,
        { ids: categoryRefs },
      );

      const categorySlugs = categories.map((c) => c.slug).filter(Boolean);
      const parentCategorySlugs = categories
        .map((c) => c.parentSlug)
        .filter((s): s is string => Boolean(s));

      await client
        .patch(product._id)
        .set({
          denormCategorySlugs: categorySlugs,
          denormParentCategorySlugs: parentCategorySlugs,
          denormLastSync: new Date().toISOString(),
        })
        .commit({ visibility: 'async' });
    }

    console.log(
      `[Denorm] Successfully updated ${products.length} products for category ${category.slug}`,
    );
  } catch (error) {
    console.error(
      `[Denorm] Error updating products for category ${categoryId}:`,
      error,
    );
  }
}
