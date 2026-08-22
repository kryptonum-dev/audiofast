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
  if (!fullSlug || typeof fullSlug !== 'string') return null;
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
  'cpoProduct',
  'review',
  'blog-article',
  'productCategorySub',
  'productCategoryParent',
  // Stores are referenced by brand documents ("Gdzie kupić"), so a store edit
  // has to reach the brand pages that list it — via `brand:<slug>` rather than
  // the broad `brand` tag.
  'store',
]);

/**
 * Tags produced by a lookup, split by how the cache should be invalidated.
 *
 * - `self`: tags that address the edited document's *own* page. The first
 *   visitor after the publish is almost always the editor verifying their
 *   change, and the blast radius is a single page — these get immediate
 *   expiration so that visit is guaranteed fresh.
 * - `related`: collateral fan-out (a product publish touching its brand page,
 *   the shared filter sidebar, home-page carousels, …). These face real public
 *   traffic and are also triggered by automated price-sync runs, so they get
 *   stale-while-revalidate instead of a blocking expiry.
 */
type LookupTags = {
  self: string[];
  related: string[];
};

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
): Promise<LookupTags> {
  const client = getSanityClient();
  if (!client) return { self: [], related: [] };

  const self: string[] = [];
  const tags: string[] = [];

  // 1. Add specific tag for the edited document itself
  if (docSlug) {
    const slug = extractSlug(docSlug);
    if (slug) {
      switch (docType) {
        case 'product':
          self.push(`product:${slug}`);
          self.push(`product-pricing:${slug}`);
          break;
        case 'cpoProduct':
          self.push(`cpoProduct:${slug}`);
          break;
        case 'blog-article':
          self.push(`blog-article:${slug}`);
          break;
        case 'review':
          self.push(`review:${slug}`);
          break;
        case 'page':
          self.push(`page:${slug}`);
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
      `*[references($id) && _type in ["product", "cpoProduct", "page", "homePage", "cpoPage", "review", "blog-article", "brand"] && !(_id in path("drafts.**"))]{ _type, "slug": slug.current }`,
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
        case 'cpoProduct':
          tags.push(`cpoProduct:${refSlug}`);
          tags.push('cpoPage');
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
        case 'brand':
          // Brand pages embed stores and featured reviews — invalidate only
          // the brands that actually reference the edited document.
          tags.push(`brand:${refSlug}`);
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

  return { self, related: tags };
}

/**
 * For category changes, find all products in that category and return their specific tags.
 * This ensures product pages show updated category information.
 */
async function getProductsInCategoryTags(
  categoryId: string,
): Promise<LookupTags> {
  const client = getSanityClient();
  if (!client) return { self: [], related: [] };

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

    return { self: [], related: tags };
  } catch (error) {
    console.error(
      `[ReverseLookup] Error querying products for category ${categoryId}:`,
      error,
    );
    return { self: [], related: [] };
  }
}

/**
 * When a product is edited, find its brand and return a slug-specific brand tag.
 * This replaces the broad "brand" tag on product edits — only the product's
 * own brand page gets invalidated instead of all ~30 brand pages.
 */
async function getProductBrandTag(productId: string): Promise<LookupTags> {
  const client = getSanityClient();
  if (!client) return { self: [], related: [] };

  try {
    const result = await client.fetch<{ brandSlug: string | null } | null>(
      `*[_type == "product" && _id == $productId && !(_id in path("drafts.**"))][0]{
        "brandSlug": brand->slug.current
      }`,
      { productId },
    );

    if (!result?.brandSlug) return { self: [], related: [] };

    const slug = extractSlug(result.brandSlug);
    if (slug) {
      console.log(
        `[BrandLookup] Product ${productId} belongs to brand "${slug}"`,
      );
      // Collateral, not the edited document: automated price-sync runs patch
      // products in bulk, and blocking one brand page per patched product is
      // exactly the cold-shell problem we are fixing.
      return { self: [], related: [`brand:${slug}`] };
    }

    return { self: [], related: [] };
  } catch (error) {
    console.error(
      `[BrandLookup] Error querying brand for product ${productId}:`,
      error,
    );
    return { self: [], related: [] };
  }
}

/**
 * When a brand is edited, resolve its slug so only that brand's page is
 * invalidated (`brand:<slug>`) instead of every brand page via the broad
 * `brand` tag.
 *
 * The webhook payload normally carries the slug; when it does not (or the
 * document is gone, e.g. an unpublish/delete) we fall back to the broad
 * `brand` tag so nothing can silently keep serving removed content.
 */
async function getBrandOwnTags(
  brandId: string,
  docSlug: string | null | undefined,
): Promise<LookupTags> {
  const payloadSlug = extractSlug(docSlug);
  if (payloadSlug) {
    return { self: [`brand:${payloadSlug}`], related: [] };
  }

  const client = getSanityClient();
  if (!client) return { self: [], related: ['brand'] };

  try {
    const result = await client.fetch<{ slug: string | null } | null>(
      `*[_type == "brand" && _id == $brandId && !(_id in path("drafts.**"))][0]{
        "slug": slug.current
      }`,
      { brandId },
    );

    const slug = extractSlug(result?.slug);
    if (slug) {
      console.log(`[BrandLookup] Brand ${brandId} resolved to "${slug}"`);
      return { self: [`brand:${slug}`], related: [] };
    }

    console.warn(
      `[BrandLookup] Could not resolve slug for brand ${brandId} - falling back to the broad "brand" tag`,
    );
    return { self: [], related: ['brand'] };
  } catch (error) {
    console.error(
      `[BrandLookup] Error querying slug for brand ${brandId}:`,
      error,
    );
    return { self: [], related: ['brand'] };
  }
}

/**
 * Static dependency map - defines which cache tags should be revalidated
 * when a document of a given type changes.
 *
 * SIMPLIFIED FOR ISR COST REDUCTION:
 * - Product edits invalidate listings + the specific brand page (via lookup)
 * - Brand edits invalidate the brand listing + the edited brand's own page
 *   (via lookup) — never all brand pages
 * - Home page, CMS pages, reviews, blog articles handled by reverse lookup
 *
 * Tag breadth is the thing to watch here: every tag listed for a type is
 * applied to every cache entry carrying it, and tags propagate from nested
 * `use cache` entries up into the page's static shell. A broad tag therefore
 * cools every shell that touches it, which is what kept all ~41 brand pages
 * permanently cold. Prefer a narrow tag plus a targeted lookup.
 */
const TYPE_DEPENDENCY_MAP: Record<string, string[]> = {
  // ============================================================================
  // CORE CONTENT TYPES - Simplified for ISR cost reduction
  // ============================================================================

  // Products: Invalidate listings + homePage (latest/featured publication blocks use dynamic queries)
  // `filter-metadata` is the shared filter-sidebar dataset, which genuinely
  // derives from every product — it is listed explicitly here rather than
  // being invalidated as a side effect of the broad `products` tag.
  // Brand page handled by targeted lookup below; CMS pages, reviews, blog articles handled by reverse lookup
  product: ['products', 'homePage', 'filter-metadata'],

  // Brands: brand listing + the shared filter sidebar (which lists brands).
  // The edited brand's own page is invalidated through `brand:<slug>` added by
  // getBrandOwnTags() — deliberately NOT the broad `brand` tag, which would
  // expire all ~41 brand shells for a single-brand edit.
  brand: ['brands', 'filter-metadata'],

  // Reviews: Also invalidate homePage (latest/featured publication blocks use dynamic queries)
  review: ['homePage'],

  // Blog articles: Blog listing + homePage (latest/featured publication blocks use dynamic queries)
  'blog-article': ['blog', 'homePage'],

  // ============================================================================
  // CATEGORY & ORGANIZATION TYPES
  // ============================================================================

  productCategorySub: ['products', 'productCategorySub', 'filter-metadata'],
  productCategoryParent: ['products', 'filter-metadata'],
  'blog-category': ['blog', 'blog-category'],

  // ============================================================================
  // PEOPLE & ORGANIZATION TYPES
  // ============================================================================

  teamMember: ['teamMember'],
  reviewAuthor: ['reviewAuthor'],
  faq: ['faq'],
  // Stores appear on brand pages, but only on the brands that reference them —
  // resolved to `brand:<slug>` by the reverse lookup instead of the broad tag.
  store: ['store'],
  award: ['award'],

  // ============================================================================
  // SINGLETON PAGES
  // ============================================================================

  homePage: ['homePage'],
  cpoPage: ['cpoPage'],
  cpoProduct: ['cpoProduct', 'cpoPage'],
  blog: ['blog'],
  products: ['products'],
  brands: ['brands'],
  page: [], // Slug-specific tag added dynamically above — no broad tag

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

// ============================================================================
// INVALIDATION PROFILES
// ============================================================================

/**
 * `updateTag` is Server-Action-only (it throws in a Route Handler) and
 * `expireTag` does not exist, so `revalidateTag(tag, profile)` is the only
 * legal API here. The single-argument form is deprecated in Next 16.
 *
 * Two profiles, chosen per tag rather than in bulk:
 *
 * - IMMEDIATE (`{ expire: 0 }`) expires matching entries on the spot, so the
 *   very next request blocks on a full regeneration. Correct when the tag
 *   points at the document that was just published: the first visitor is
 *   nearly always the editor checking their own change, and exactly one page
 *   pays the cost. Also used for explicit `tags` in a manual payload — that is
 *   the operator's deliberate "make this fresh now" lever.
 *
 * - SWR (`'max'`) marks entries stale and serves them while a fresh copy is
 *   built in the background. Correct for collateral fan-out — broad tags such
 *   as `products`, `brands` or `filter-metadata`, and slug tags reached
 *   through a reference lookup. These cover many prerendered shells at once,
 *   face real public traffic, and are re-triggered by automated price-sync
 *   runs; expiring them is what made every visitor after a publish pay a cold
 *   render. The trade-off is one extra request before the new content shows.
 */
const IMMEDIATE_EXPIRATION = { expire: 0 } as const;
const STALE_WHILE_REVALIDATE = 'max';

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
  // Subset of `tags` that addresses the edited documents themselves and is
  // therefore expired immediately instead of being served stale.
  const immediateTags = new Set<string>();
  const paths = new Set<string>();

  // Track denormalization tasks to run in parallel
  const denormTasks: Promise<void>[] = [];

  // Track reverse lookup tasks
  const reverseLookupTasks: Promise<LookupTags>[] = [];

  for (const doc of documents) {
    // =========================================================================
    // Handle Sanity webhook payload (_type)
    // =========================================================================
    if (doc._type) {
      // Add all transitive dependencies from the static map
      const transitiveDeps = getTransitiveDependencies(doc._type);
      transitiveDeps.forEach((tag) => {
        addTag(tags, tag);

        // A tag equal to the document type is that document's own surface
        // (`homePage` for a homePage edit, `store` for a store edit, …), as
        // opposed to the collateral entries listed alongside it.
        if (tag === doc._type) {
          addTag(immediateTags, tag);
        }
      });

      // =========================================================================
      // Slug-specific CMS page tag
      // =========================================================================
      // When a CMS page is edited, add a slug-specific tag so only that
      // page is invalidated instead of all CMS pages.
      if (doc._type === 'page' && doc.slug) {
        const pageSlug = extractSlug(doc.slug);
        if (pageSlug) {
          addTag(tags, `page:${pageSlug}`);
          addTag(immediateTags, `page:${pageSlug}`);
        }
      }

      // =========================================================================
      // CPO path safety-net revalidation
      // =========================================================================
      // The CPO Excel sync uses the Sanity HTTP API. Tags are the primary mechanism,
      // but we also explicitly revalidate the listing page and the touched detail
      // path so the first visit after sync always reflects the latest state.
      if (doc._type === 'cpoPage') {
        addPath(paths, '/certyfikowany-sprzet-uzywany/');
      }

      if (doc._type === 'cpoProduct') {
        addPath(paths, '/certyfikowany-sprzet-uzywany/');

        if (doc.slug) {
          addPath(paths, doc.slug);
        }
      }

      // =========================================================================
      // Targeted brand lookup for product edits
      // =========================================================================
      // When a product is edited, find its brand and invalidate only that
      // brand page instead of all ~30 brand pages.
      if (doc._id && doc._type === 'product') {
        reverseLookupTasks.push(getProductBrandTag(doc._id));
      }

      // =========================================================================
      // Targeted own-page lookup for brand edits
      // =========================================================================
      // Resolve the edited brand's slug so only `brand:<slug>` is invalidated
      // instead of the broad `brand` tag (which covers every brand shell).
      if (doc._type === 'brand') {
        if (doc._id) {
          reverseLookupTasks.push(getBrandOwnTags(doc._id, doc.slug));
        } else {
          // No document id to look the slug up with — use whatever the payload
          // carries, and fall back to the broad tag rather than leave the
          // brand's page pinned to stale content.
          const brandSlug = extractSlug(doc.slug);
          if (brandSlug) {
            addTag(tags, `brand:${brandSlug}`);
            addTag(immediateTags, `brand:${brandSlug}`);
          } else {
            addTag(tags, 'brand');
          }
        }
      }

      // =========================================================================
      // Reverse Lookup for precise invalidation
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
        // Explicit tags are a deliberate operator request ("refresh this
        // now"), and the only way to force a blocking refresh through this
        // endpoint — keep them on immediate expiration.
        addTag(tags, tag);
        addTag(immediateTags, tag);
      }
    }

    // =========================================================================
    // Handle explicit paths (for specific route revalidation)
    // =========================================================================
    if (doc.paths && Array.isArray(doc.paths)) {
      for (const path of doc.paths) {
        addPath(paths, path);
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
        for (const tag of resultTags.self) {
          addTag(tags, tag);
          addTag(immediateTags, tag);
        }
        for (const tag of resultTags.related) {
          addTag(tags, tag);
        }
      }
    } catch (error) {
      console.error('[ReverseLookup] Error in reverse lookup tasks:', error);
    }
  }

  // Revalidate all collected tags, per-tag profile (see IMMEDIATE_EXPIRATION /
  // STALE_WHILE_REVALIDATE above): the edited document's own surface expires
  // immediately so the editor sees their change on the first visit, everything
  // else is served stale while it regenerates in the background.
  for (const tag of tags) {
    revalidateTag(
      tag,
      immediateTags.has(tag) ? IMMEDIATE_EXPIRATION : STALE_WHILE_REVALIDATE,
    );
    revalidatedTags.push(tag);
  }

  for (const path of paths) {
    revalidatePath(path);
    revalidatedPaths.push(path);
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
      logParts.push(
        `Tags: ${revalidatedTags
          .map((tag) => (immediateTags.has(tag) ? `${tag} (immediate)` : tag))
          .join(', ')}`,
      );
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
    immediateTags: revalidatedTags.filter((tag) => immediateTags.has(tag)),
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
      "Invalidates the Next.js cache: the edited document's own page expires immediately, dependent content is served stale while it regenerates",
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
      perTagInvalidationProfile:
        "Tags addressing the edited document (and explicit tags in a manual payload) use revalidateTag(tag, { expire: 0 }); collateral tags use revalidateTag(tag, 'max') so visitors get a stale page instantly while it regenerates in the background",
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

function addPath(pathSet: Set<string>, path?: string | null) {
  if (!path || typeof path !== 'string') {
    return;
  }

  const trimmed = path.trim();

  if (trimmed.length === 0 || !trimmed.startsWith('/')) {
    return;
  }

  pathSet.add(trimmed);
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
