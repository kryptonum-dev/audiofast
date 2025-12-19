import { revalidatePath, revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Request payload types for the revalidation API.
 *
 * Supports multiple use cases:
 * - Sanity webhooks: { _type, _id, slug }
 * - Manual/programmatic: { tags: [...], paths: [...] }
 * - Combined: All fields can be used together
 */
type RevalidateRequest = {
  // Sanity webhook payload
  _id?: string;
  _type?: string;
  slug?: string | null;
  // Manual/programmatic revalidation
  tags?: string[];
  paths?: string[];
};

const TAG_DENYLIST = new Set(['sanity.imageAsset', 'sanity.fileAsset']);

/**
 * Static dependency map - defines which cache tags should be revalidated
 * when a document of a given type changes.
 *
 * This captures TRANSITIVE dependencies based on schema knowledge:
 * - Direct references (e.g., product → brand)
 * - PageBuilder embeds (e.g., page → featuredProducts → product)
 * - Portable text embeds (e.g., blog-article → ptFeaturedProducts → product)
 *
 * When a type on the left changes, ALL tags on the right are revalidated.
 * This ensures content using that type (even via PageBuilder sections) gets fresh data.
 *
 * NOTE: With stale-while-revalidate (revalidateTag with 'max'), over-revalidation
 * is acceptable - users still get instant responses while fresh data loads.
 */
const TYPE_DEPENDENCY_MAP: Record<string, string[]> = {
  // ============================================================================
  // CORE CONTENT TYPES
  // ============================================================================

  // Products are embedded in many places via PageBuilder sections:
  // - featuredProducts, productsCarousel, latestPublication, featuredPublications
  // - ptFeaturedProducts, ptCtaSection (portable text)
  // - productsListing, brandsByCategoriesSection
  product: [
    'product', // Product pages
    'products', // Product listing page & filter metadata
    'homePage', // Home page often has featured products
    'page', // Generic pages with PageBuilder (productsCarousel, featuredProducts, etc.)
    'cpoPage', // CPO page has product listings
    'review', // Reviews have related products
    'blog-article', // Blog articles can embed products via portable text
    'brand', // Brand pages show their products
    'comparatorConfig', // Comparator uses product data
  ],

  // Brands are displayed via PageBuilder sections:
  // - heroCarousel (brand marquee), brandsMarquee, brandsList, brandsByCategoriesSection
  brand: [
    'brand', // Brand pages
    'brands', // Brands listing page
    'product', // Products display their brand info
    'products', // Product listings show brand filters
    'homePage', // Home page often has brand sections
    'page', // Generic pages with brand PageBuilder sections
    'cpoPage', // CPO page may show brands
  ],

  // Reviews can be featured via PageBuilder:
  // - latestPublication, featuredPublications, ptReviewEmbed
  review: [
    'review', // Review pages
    'homePage', // Home page can feature reviews
    'page', // Generic pages can embed reviews
    'cpoPage', // CPO page can feature reviews
    'brand', // Brand pages have featured reviews
    'blog-article', // Blog can embed reviews
  ],

  // Blog articles can be featured via PageBuilder:
  // - latestPublication, featuredPublications
  'blog-article': [
    'blog-article', // Blog post pages
    'blog', // Blog listing page
    'blog-category', // Category pages list articles
    'homePage', // Home can feature blog posts
    'page', // Generic pages can show publications
  ],

  // ============================================================================
  // CATEGORY & ORGANIZATION TYPES
  // ============================================================================

  // Product categories affect product organization and filtering
  productCategorySub: [
    'productCategorySub', // Category pages
    'product', // Products are organized by category
    'products', // Product listings filter by category
    'homePage', // Home may show category navigation
    'page', // Pages with productsListing section
    'cpoPage', // CPO page categorizes products
  ],

  // Parent categories affect subcategories and brandsByCategoriesSection
  productCategoryParent: [
    'productCategoryParent',
    'productCategorySub', // Subcategories reference parent
    'products', // Filter metadata
    'homePage', // brandsByCategoriesSection
    'page', // Pages with brandsByCategoriesSection
  ],

  // Blog categories affect article organization
  'blog-category': [
    'blog-category', // Category pages
    'blog-article', // Articles show their category
    'blog', // Blog listing shows category counts
  ],

  // ============================================================================
  // PEOPLE & ORGANIZATION TYPES
  // ============================================================================

  // Team members appear in PageBuilder sections:
  // - teamSection, faqSection (contactPeople), contactForm (contactPeople)
  teamMember: [
    'teamMember',
    'homePage', // Home may have team section
    'page', // Pages with team/contact sections
    'cpoPage',
  ],

  // Review authors are displayed on reviews
  reviewAuthor: [
    'reviewAuthor',
    'review', // Reviews show author info
  ],

  // FAQ items are used in faqSection PageBuilder block
  faq: [
    'faq',
    'homePage', // Home may have FAQ section
    'page', // Pages with FAQ section
    'cpoPage',
  ],

  // Stores are displayed on brand pages
  store: [
    'store',
    'brand', // Brand pages list their stores
  ],

  // Awards are displayed on product pages
  award: [
    'award',
    'product', // Products show their awards
  ],

  // ============================================================================
  // SINGLETON PAGES
  // ============================================================================

  // Home page singleton - only affects itself
  homePage: ['homePage'],

  // CPO page singleton
  cpoPage: ['cpoPage'],

  // Blog listing singleton
  blog: ['blog', 'blog-article'], // Blog page affects article listings

  // Products listing singleton
  products: ['products', 'product'], // Products singleton affects listings

  // Brands listing singleton
  brands: ['brands', 'brand'], // Brands singleton affects brand pages

  // Generic pages - only affects page cache
  page: ['page'],

  // ============================================================================
  // GLOBAL/LAYOUT TYPES
  // ============================================================================

  // Settings affect multiple areas (contact info, SEO, analytics)
  settings: [
    'settings',
    'homePage', // Structured data, contact info
    'page', // Contact forms use settings
    'blog-article', // Structured data
    'product', // Structured data
  ],

  // Navigation affects all pages via layout
  navbar: ['navbar'],

  // Footer affects all pages via layout
  footer: ['footer'],

  // Social media links appear in footer
  socialMedia: [
    'socialMedia',
    'footer', // Footer displays social links
  ],

  // ============================================================================
  // CONFIGURATION TYPES
  // ============================================================================

  // Comparator config affects comparison functionality
  comparatorConfig: [
    'comparatorConfig',
    'product', // Comparator shows product data
  ],

  // Newsletter settings used in contact/FAQ sections
  newsletterSettings: [
    'newsletterSettings',
    'page', // Pages with faqSection or contactForm
    'homePage',
    'cpoPage',
  ],

  // ============================================================================
  // LEGAL/STATIC PAGES
  // ============================================================================

  privacyPolicy: ['privacyPolicy'],
  termsAndConditions: ['termsAndConditions'],
  notFound: ['notFound'],

  // Redirects don't need cache invalidation (handled at edge)
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

  for (const doc of documents) {
    // =========================================================================
    // Handle Sanity webhook payload (_type)
    // =========================================================================
    if (doc._type) {
      // Add all transitive dependencies from the static map
      const transitiveDeps = getTransitiveDependencies(doc._type);
      transitiveDeps.forEach((tag) => addTag(tags, tag));
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

  // Revalidate all collected tags
  for (const tag of tags) {
    revalidateTag(tag, 'max');
    revalidatedTags.push(tag);
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
      'Invalidates Next.js cache using stale-while-revalidate strategy',
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
      staleWhileRevalidate:
        'Uses revalidateTag with "max" profile for instant responses',
      staticDependencyMap:
        'Pre-defined content relationships for instant, zero-latency revalidation',
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
