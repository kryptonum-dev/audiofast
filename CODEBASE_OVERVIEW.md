# Audiofast — Codebase Overview

## What Is Audiofast?

Audiofast ([audiofast.pl](https://audiofast.pl)) is a Polish high-end audio equipment distributor based in Łódź, operating for over 20 years. They carry premium brands like Wilson Audio, dCS, Gryphon, Audio Research, Dan D'Agostino, Aurender, Shunyata, Ayre, PrimaLuna, Weiss Engineering, Usher Audio, GoldenEar, Keces Audio, and StromTank. Their offerings include amplifiers, speakers, DACs, streamers, cables, and power conditioners — products at the top tier of audiophile equipment.

The website serves as their digital storefront: a product catalog, brand showcase, blog/review hub, and contact point for potential buyers. It is **not** a traditional e-commerce store with a checkout flow — instead it presents products with pricing and provides inquiry forms for purchase consultation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo v2.6.0 |
| **Package Manager** | Bun v1.1.42 |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | SCSS Modules with CSS variables |
| **CMS** | Sanity v5 (GROQ queries, Portable Text) |
| **Database** | Supabase (PostgreSQL) — product pricing only |
| **Email** | Microsoft Graph API + React Email templates |
| **Newsletter** | Mailchimp |
| **Analytics** | Google Tag Manager + Meta Pixel (dual tracking) |
| **Maps** | Leaflet (react-leaflet) for store locators |
| **Deployment** | Vercel (web), Sanity hosting (studio) |
| **CI/CD** | GitHub Actions (Sanity deploy), Vercel (web auto-deploy) |

---

## Project Structure

```
audiofast/
├── apps/
│   ├── web/                    # Next.js 16 website (the public-facing site)
│   │   ├── src/
│   │   │   ├── app/            # App Router — pages, layouts, API routes
│   │   │   ├── components/     # All React components
│   │   │   ├── emails/         # React Email templates
│   │   │   ├── generated/      # Auto-generated files (redirects map)
│   │   │   └── global/         # Shared utilities, config, integrations
│   │   ├── public/             # Static assets
│   │   ├── scripts/            # Build-time scripts (redirect generation)
│   │   ├── next.config.ts      # Next.js configuration
│   │   └── vercel.json         # Vercel deployment config
│   │
│   └── studio/                 # Sanity CMS Studio (content management)
│       ├── schemaTypes/        # Content model (document, block, object schemas)
│       ├── plugins/            # Custom Sanity plugins (bulk-actions-table)
│       ├── tools/              # Custom studio tools (newsletter, comparator)
│       ├── components/         # Custom UI components (technical data editor, filters)
│       ├── scripts/            # Migration scripts (products, brands, reviews, etc.)
│       ├── actions/            # Custom document actions (denormalization, unpublish)
│       ├── structure.ts        # Studio desk structure definition
│       └── sanity.config.ts    # Sanity configuration
│
├── packages/
│   ├── eslint-config/          # Shared ESLint configurations
│   └── typescript-config/      # Shared TypeScript configurations
│
├── turbo.json                  # Turborepo pipeline configuration
├── package.json                # Root workspace config
├── tsconfig.json               # Root TypeScript config
└── .cursorrules                # SCSS/React coding guidelines
```

---

## The Web Application (`apps/web`)

### Routing Map

All routes use the Next.js App Router with trailing slashes.

| Route | Purpose |
|---|---|
| `/` | Homepage (Page Builder) |
| `/produkty/` | Products listing with filters |
| `/produkty/kategoria/[category]/` | Products filtered by category |
| `/produkty/[slug]/` | Product detail page |
| `/produkty/[slug]/pliki/[pdfKey]/` | Product PDF download |
| `/produkty/archiwalne/` | Archived products |
| `/marki/` | Brands listing |
| `/marki/[slug]/` | Brand detail page |
| `/blog/` | Blog listing |
| `/blog/kategoria/[category]/` | Blog filtered by category |
| `/blog/[slug]/` | Blog article page |
| `/recenzje/[slug]/` | Review page |
| `/recenzje/pdf/[slug]/` | Review PDF download |
| `/recenzje/archiwalne/` | Orphan reviews |
| `/porownaj/` | Product comparison tool |
| `/certyfikowany-sprzet-uzywany/` | Certified Pre-Owned page |
| `/polityka-prywatnosci/` | Privacy policy |
| `/regulamin/` | Terms and conditions |
| `/[slug]/` | Dynamic CMS pages (catch-all) |

**API Routes:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/revalidate/` | POST | Cache invalidation (Sanity webhooks) |
| `/api/newsletter/` | POST | Newsletter subscription (Mailchimp) |
| `/api/newsletter/generate/` | POST | Newsletter HTML generation |
| `/api/contact/` | POST | Contact & product inquiry forms |
| `/api/analytics/meta/` | GET | Analytics metadata |

**Generated Files:**
- `sitemap.ts` — dynamic sitemap from Sanity content
- `robots.ts` — robots.txt
- `manifest.ts` — web app manifest

---

### Component Architecture

Components are organized by domain, with a clear separation between page-level blocks, shared UI, and feature-specific components.

#### Page Builder Blocks (`components/pageBuilder/`)

The site uses a modular **Page Builder** pattern. Pages in Sanity are composed of an array of blocks, and the `PageBuilder` component (`components/shared/PageBuilder.tsx`) maps each block type to its React component. There are 20+ block types:

| Block | Purpose |
|---|---|
| `HeroCarousel` | Rotating hero banners with slides |
| `HeroStatic` | Static hero section |
| `LatestPublication` | Showcases the most recent content |
| `FeaturedPublications` | Carousel of selected articles/reviews |
| `FeaturedProducts` | Highlighted products grid |
| `ProductsCarousel` | Scrollable product carousel |
| `ProductsListing` | Full product listing (CPO page) |
| `BrandsMarquee` | Infinite-scrolling brand logo ticker |
| `BrandsList` | Grid of brand logos |
| `BrandsByCategoriesSection` | Brands organized by product category |
| `ImageTextColumns` | Image paired with text columns |
| `ImageWithVideo` | Image with embedded video |
| `ImageWithTextBoxes` | Image with overlaid text boxes |
| `BlurLinesTextImage` | Decorative blur-line effect with text/image |
| `GallerySection` | Image gallery |
| `ContactForm` | Contact form with email integration |
| `ContactMap` | Map showing store locations |
| `FaqSection` | Expandable FAQ accordion |
| `TeamSection` | Team member profiles |
| `PhoneImageCta` | CTA with phone/image |
| `StepList` | Step-by-step instructional content |

#### UI Components (`components/ui/`)

Reusable interface elements: `Header`, `Footer`, `Breadcrumbs`, `Button`, `Input`, `Checkbox`, `Switch`, `Accordion`, `Pagination`, `Searchbar`, `SortDropdown`, `ProductCard`, `PublicationCard`, `ProductGallery`, `ConfirmationModal`, `TableOfContent`, `PillsStickyNav`, `StoreLocations`, `BlogAside`, `EmptyState`, `Error`, and more.

#### Product Components (`components/products/`)

The full product browsing experience: `ProductHero`, `ProductsListing`, `ProductsListingContainer`, `ProductsAside` (filter sidebar), `TechnicalData` (specifications table), `DownloadSection`, `ProductInquiryModal`, `PriceRange`, `RangeFilter`, `CustomFiltersBar`.

#### Comparison Components (`components/comparison/`)

Product comparison feature: `ComparisonTable`, `ComparisonProductCard`, `ProductSelector`, `FloatingComparisonBox` (persistent widget).

#### Blog Components (`components/blog/`)

`ArticleBody` (rich content rendering), `BlogListing`.

#### Portable Text Components (`components/portableText/`)

Custom renderers for Sanity Portable Text: images (full/minimal/inline), videos (YouTube/Vimeo), buttons, headings, lists (arrow/circle-numbered), CTA sections, tables, quotes, page breaks, image sliders, review embeds.

#### Schema Components (`components/schema/`)

JSON-LD structured data generators: `OrganizationSchema`, `WebSiteSchema`, `ArticleSchema`, `BlogPostSchema`, `BrandSchema`, `CollectionPageSchema`.

---

### Data Architecture

The application uses a **dual-database** strategy:

#### Sanity CMS — Content & Metadata

All editorial content lives in Sanity:
- Product information (name, description, images, categories, brand, technical specs, reviews, related products, store availability)
- Brand pages (logo, description, hero images, content, galleries, featured reviews)
- Blog articles (content, categories, authors, publication dates)
- Reviews (content, authors, linked products)
- Pages (modular page builder content)
- Site configuration (navigation, footer, settings, FAQ, team, social media)
- Redirects (old URL → new URL mappings)

#### Supabase — Dynamic Pricing

Product pricing is stored separately in Supabase (PostgreSQL):
- `pricing_variants` — product models/variants with base prices
- `pricing_option_groups` — option groups (dropdown selects, numeric steppers)
- `pricing_option_values` — dropdown options with price deltas
- `pricing_numeric_rules` — numeric input rules (min, max, step, price-per-step)

This separation allows pricing to be managed independently from content, with its own update cadence.

#### Data Flow

```
┌─────────────────┐     GROQ Queries      ┌──────────────────┐
│   Sanity CMS    │ ◄────────────────────► │                  │
│  (Content data) │                        │   Next.js App    │
└─────────────────┘                        │   (Server Comp)  │
                                           │                  │
┌─────────────────┐     SQL Queries        │                  │
│    Supabase     │ ◄────────────────────► │                  │
│ (Pricing data)  │                        └──────────────────┘
└─────────────────┘                               │
                                                  │ HTML
                                                  ▼
                                           ┌──────────────────┐
                                           │     Browser      │
                                           │  (Client comps)  │
                                           └──────────────────┘
```

---

### Query System (GROQ)

Queries live in `src/global/sanity/query.ts` (~2400+ lines). They use a **fragment-based** pattern for reusability:

- **Fragments**: `imageFragment`, `imageFragmentLite`, `portableTextFragment`, `productFragment`, `brandFragment`, `publicationFragment` — reusable projections composed into larger queries
- **Page queries**: `queryHomePage`, `queryPageBySlug`, `queryBlogPostBySlug`, `queryReviewBySlug`, `queryProductBySlug`, `queryBrandBySlug`
- **Listing queries**: `queryProductsListing` with sort variants (newest, oldest, priceAsc, priceDesc, orderRank, relevance)
- **SEO-only queries**: lightweight variants (e.g., `queryProductSeoBySlug`) that fetch only metadata fields, reducing payload for `generateMetadata()`
- **Filter metadata**: `queryAllProductsFilterMetadata` — a single lightweight query (~80KB for 500+ products) powering client-side filter computation

#### Denormalization Strategy

Products store **denormalized fields** to avoid expensive dereferencing in GROQ:
- `denormBrandSlug`, `denormBrandName` — avoids `brand->slug` lookups
- `denormCategorySlugs`, `denormParentCategorySlugs` — avoids category reference resolution
- `denormFilterKeys` — pre-computed filter keys

These fields are automatically recomputed when a product is published (via a custom Sanity publish action) and when brands/categories change (via the revalidation webhook).

---

### Caching & Revalidation

The application uses **Next.js `use cache`** directive with a sophisticated invalidation strategy:

#### Cache Lifecycle
- **Development**: `cacheLife('seconds')` — fresh data on every request
- **Production**: `cacheLife('weeks')` — 30-day stale window, invalidated on demand

#### Tag-Based Invalidation
Every cached query is tagged with specific identifiers:
- `product:yamaha-thr10ii` — a specific product page
- `brand:wilson-audio` — a specific brand page
- `products` — the products listing page
- `blog-article:some-slug` — a specific blog post
- `product-pricing:slug` — pricing data for a product

#### Reverse Lookup Mechanism
When a Sanity document is edited, the `/api/revalidate/` endpoint performs a **reverse lookup** to find all pages that reference that document:
1. Receives webhook from Sanity with the edited document ID
2. Queries Sanity: `*[references($id) && _type in [...]]` to find referencing documents
3. Extracts slugs from those documents
4. Invalidates only the specific cache tags for affected pages

This avoids the naive approach of invalidating entire categories when a single product changes.

#### Denormalization Sync
When a brand or category is updated, the revalidation endpoint also triggers **denormalization updates** — it patches all referencing products with the new denormalized values, ensuring data consistency without manual intervention.

---

### Product Filtering System

Filtering uses a **client-side computation** approach for instant responsiveness:

1. **On page load**: A single lightweight query fetches filter metadata for all products (~150 bytes per product, ~80KB total for 500+ products)
2. **On filter change**: Client-side `computeFilters()` recalculates available options, counts, and price ranges in ~1-2ms
3. **Key rule**: Filter X does not reduce options for Filter X (e.g., selecting brand "Wilson Audio" doesn't hide other brands from the brand filter)

#### Filter Types
| Filter | Type | Logic |
|---|---|---|
| Category | Single select | Matches against denormalized category slugs |
| Brand | Multi-select | Array of brand slugs (OR within, AND with other filters) |
| Price | Range (min/max) | Cents-based comparison |
| Custom Dropdowns | Category-specific | Per-category configurable filters (e.g., "Cable Length") |
| Range Filters | Numeric range | Per-category numeric ranges (e.g., "Impedance: 4-12Ω") |
| CPO | Boolean | Certified Pre-Owned toggle |
| Search | Text | Matches product name; supports semantic search via embeddings |

---

### Product Comparison

A cookie-based comparison tool:

- **Storage**: `audiofast_comparison` cookie (7-day expiry)
- **Constraints**: Max 3 products, must be from the same category
- **Processing**: Technical data is aligned across products/variants into a comparison table
- **Configuration**: Per-category comparison parameters managed via the Comparator Tool in Sanity Studio
- **UI**: `FloatingComparisonBox` — persistent widget that appears when products are added

---

### Email System

**Outbound Email (Microsoft Graph API):**
- Contact form submissions → notification to Audiofast team + confirmation to user
- Product inquiry forms → same flow with product context
- Templates built with React Email (`src/emails/`)

**Newsletter (Mailchimp):**
- Subscription via `/api/newsletter/`
- Newsletter generation tool in Sanity Studio: select date range → auto-fetch articles/reviews/products → generate HTML → create Mailchimp draft

---

### Analytics

Dual-tracking with consent management:

- **Google Tag Manager**: standard GA4 events
- **Meta Pixel**: client-side pixel + server-side Conversion API
- **Consent**: Cookie consent banner controls `ad_storage`, `analytics_storage`, etc.
- **Event queue**: Events are queued until consent is granted
- **Advanced matching**: User data (email, phone, name) hashed for Meta Pixel
- **User storage**: LocalStorage for persistent user data, SessionStorage for UTM parameters

---

### SEO

- **Dynamic metadata**: Every page generates metadata via `generateMetadata()` using lightweight SEO-only queries
- **OpenGraph images**: 1200×630px from Sanity CDN
- **Structured data (JSON-LD)**: Organization, WebSite, Article, BlogPost, Brand, CollectionPage schemas
- **Dynamic sitemap**: Generated from all published Sanity documents
- **Robots.txt**: Standard configuration
- **`doNotIndex` flag**: Per-page control over indexing
- **Canonical URLs**: Auto-generated from `BASE_URL` + slug

---

### Styling

- **SCSS Modules**: Every component has a co-located `styles.module.scss`
- **Global styles**: `src/global/global.scss` — CSS variables, reset, typography
- **Design tokens**: Color palette (neutral grays, primary red `#fe0140`), spacing scale, z-index scale
- **Typography**: Poppins (headings) + Switzer (body), fluid sizing with `clamp()`
- **Breakpoints**: `56.1875rem` (899px tablet), `47.9375rem` (767px mobile), `35.9375rem` (575px small mobile)
- **Conventions**: Nested SCSS with BEM-like camelCase naming, media queries nested inside parent classes, rem units everywhere, transitions in milliseconds with explicit properties

---

## The Sanity Studio (`apps/studio`)

### Content Model

#### Document Types (Collections)

| Type | Purpose | Key Features |
|---|---|---|
| `product` | Products | Brand/category refs, denormalized fields, technical data, custom filter values, image gallery, PDFs, reviews, related products, page builder, CPO/archived flags, pricing sync |
| `brand` | Brands | Logo, description, hero/banner images, unified content, distribution year, image gallery, stores, featured reviews |
| `blog-article` | Blog articles | Category ref, portable text content, page builder, author (internal/external), keywords |
| `blog-category` | Blog categories | Orderable |
| `review` | Reviews | Multiple destination types (page, PDF, external), product links |
| `reviewAuthor` | Review authors | Orderable |
| `productCategoryParent` | Parent product categories | Orderable |
| `productCategorySub` | Sub product categories | Parent ref, custom filter definitions |
| `store` | Stores/salons | Location data for store finder |
| `teamMember` | Team members | Staff profiles |
| `award` | Awards | Product awards |
| `faq` | FAQs | Question/answer pairs |
| `socialMedia` | Social media links | Restricted actions |
| `page` | Generic CMS pages | Page builder, slug validation |

#### Singleton Types

| Type | Purpose |
|---|---|
| `homePage` | Homepage content |
| `settings` | Global settings (contact info, form config, Mailchimp, analytics, SEO, structured data) |
| `footer` | Footer content |
| `navbar` | Navigation bar |
| `redirects` | URL redirect mappings |
| `privacyPolicy` | Privacy policy content |
| `termsAndConditions` | Terms content |
| `notFound` | 404 page content |
| `blog` | Blog listing page config |
| `products` | Products listing page config |
| `brands` | Brands listing page config |
| `cpoPage` | Certified Pre-Owned page config |
| `comparatorConfig` | Product comparison parameters per category |

#### Page Builder Blocks (20+ types)

`heroCarousel`, `heroStatic`, `latestPublication`, `imageTextColumns`, `featuredPublications`, `featuredProducts`, `brandsMarquee`, `brandsList`, `brandsByCategoriesSection`, `faqSection`, `contactForm`, `contactMap`, `imageWithVideo`, `imageWithTextBoxes`, `blurLinesTextImage`, `gallerySection`, `teamSection`, `phoneImageCta`, `stepList`, `productsCarousel`, `productsListing`

#### Portable Text Components (18 types)

`ptImage`, `ptMinimalImage`, `ptInlineImage`, `ptImageSlider`, `ptArrowList`, `ptCircleNumberedList`, `ptCtaSection`, `ptTwoColumnTable`, `ptFeaturedProducts`, `ptQuote`, `ptButton`, `ptHeading`, `ptYoutubeVideo`, `ptVimeoVideo`, `ptPageBreak`, `ptTwoColumnLine`, `ptHorizontalLine`, `ptReviewEmbed`

---

### Studio Desk Structure

The studio desk is organized into logical sections:

```
├── Home Page (singleton)
├── Podstrony (generic pages)
├── Produkty
│   ├── Products listing singleton
│   ├── Tabela produktów (bulk actions table)
│   ├── Produkty według marek (by brand)
│   ├── Produkty według kategorii (parent → sub)
│   ├── Produkty według statusu (active / archived)
│   ├── Lista nagród (awards)
│   ├── Kategorie nadrzędne (parent categories)
│   └── Kategorie podrzędne (sub-categories by parent)
├── Marki
│   ├── Brands listing singleton
│   ├── Tabela marek (bulk actions table)
│   └── Lista marek (orderable)
├── Recenzje
│   ├── Tabela recenzji (bulk actions table)
│   ├── Recenzje według autorów (by author)
│   └── Lista autorów (orderable)
├── Blog
│   ├── Blog listing singleton
│   ├── Tabela artykułów (bulk actions table)
│   ├── Wpisy na blogu (by year)
│   └── Kategorie bloga (orderable)
├── Salony (stores)
├── CPO
│   ├── CPO Page singleton
│   └── Produkty CPO (filtered)
├── Zespół (team members)
├── FAQ
└── Konfiguracja strony
    ├── Navbar, Footer, Settings (singletons)
    ├── Social Media
    ├── NotFound, Terms, Privacy, Redirects (singletons)
```

### Custom Document Views

- **Product documents**: 3 tabs — Content, Technical Data (table editor), Filters (custom filter values)
- **Sub-category documents**: 2 tabs — Content, Filters Config (define available filters for the category)

---

### Custom Plugins

#### Bulk Actions Table (`plugins/bulk-actions-table/`)

A custom table interface for managing large collections:
- Bulk selection and editing
- Filtering and search
- Reference-based filters (e.g., filter products by brand)
- Column selection
- Pagination and sorting
- Used for: products, brands, reviews, blog articles

---

### Custom Tools

#### Newsletter Tool (`tools/newsletter/`)

Generates newsletters from CMS content:
1. Select date range
2. Auto-fetches matching blog articles, reviews, and products
3. Configure hero image
4. Enable/disable content sections
5. Generate HTML preview or create Mailchimp draft

#### Comparator Tool (`tools/comparator/`)

Configures the product comparison feature:
1. Discovers all technical data parameters from products
2. Category-based parameter configuration
3. Drag-and-drop parameter ordering
4. Custom display names
5. Parameter transformation (rename across products)
6. Saves to `comparatorConfig` singleton

---

### Custom Actions

#### Denormalization Wrapper (`actions/wrap-publish-with-denorm.ts`)

Wraps the standard publish action for products:
1. Before publishing, computes denormalized fields (brand slug/name, category slugs, filter keys)
2. Patches the draft with computed values
3. Then proceeds with the standard publish

#### Unpublish Action (`actions/unpublish-action.tsx`)

Restores the unpublish action for orderable document types (`product`, `brand`, `blog-category`) — which `@sanity/orderable-document-list` removes by default.

---

### Migration Scripts (`scripts/migration/`)

Comprehensive migration tooling for importing/transforming data:

| Domain | Scripts | Purpose |
|---|---|---|
| **Products** | 8+ scripts | Import, brand-based migration, PDF migration, unified content migration, date fixes, reference fixes |
| **Brands** | 10+ scripts | CSV import, content blocks migration, unified content, reviews, galleries |
| **Reviews** | 4+ scripts | Import, author resolution, HTML-to-Portable-Text conversion |
| **Blog** | 2+ scripts | Article import, content migration |
| **Categories** | 3+ scripts | Category import and transformation |
| **Stores** | 4+ scripts | Store import and transformation |
| **Awards** | 4+ scripts | Award import, image processing |
| **Brand-Stores** | 1 script | Brand-store relationship mapping |
| **Denormalization** | 1 script | Batch recomputation of all denormalized fields |

Each migration domain includes parsers (CSV/HTML), transformers, and Sanity client utilities.

---

## Shared Packages (`packages/`)

### `packages/eslint-config`

Shared ESLint configurations exported as:
- `base` — core TypeScript + Prettier rules
- `next-js` — Next.js specific rules
- `react-internal` — React library rules

### `packages/typescript-config`

Shared TypeScript configurations:
- `base.json` — strict mode, modern module resolution
- `nextjs.json` — extends base with Next.js settings
- `react-library.json` — extends base for React packages

---

## Environment Variables

### Web App (`apps/web`)

| Variable | Purpose |
|---|---|
| `SANITY_API_READ_TOKEN` | Sanity read access |
| `SANITY_API_WRITE_TOKEN` | Sanity write access (revalidation denorm) |
| `SANITY_WEBHOOK_SECRET` | Webhook authentication |
| `NEXT_REVALIDATE_TOKEN` | Cache revalidation auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `AZURE_TENANT_ID` | Microsoft Graph auth |
| `AZURE_CLIENT_ID` | Microsoft Graph auth |
| `AZURE_CLIENT_SECRET` | Microsoft Graph auth |
| `MS_GRAPH_SENDER_EMAIL` | Email sender address |
| `MS_GRAPH_REPLY_TO` | Email reply-to address |
| `MAILCHIMP_API_KEY` | Mailchimp API key |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp server prefix |
| `EMBEDDINGS_INDEX_BEARER_TOKEN` | Semantic search auth |
| `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_ENV` | Vercel environment |

### Sanity Studio (`apps/studio`)

| Variable | Purpose |
|---|---|
| `SANITY_STUDIO_PROJECT_ID` | Sanity project ID |
| `SANITY_STUDIO_DATASET` | Sanity dataset name |
| `SANITY_STUDIO_TITLE` | Studio title |

---

## Development

### Prerequisites
- Node.js ≥ 20
- Bun v1.1.42

### Commands

```bash
# Install dependencies
bun install

# Start all dev servers (Next.js + Sanity Studio)
bun run dev

# Build everything
bun run build

# Lint
bun run lint

# Type check
bun run check-types

# Format code
bun run format

# Generate Sanity TypeScript types
bun run typegen

# Generate redirects map
bun run generate:redirects   # (in apps/web)
```

### Key Architectural Decisions

1. **Partial Pre-Rendering (PPR)**: Static shell rendered at build time with dynamic islands hydrated on request — fastest possible Time to First Byte
2. **Dual database**: Content in Sanity (editorial flexibility) + pricing in Supabase (structured data with relational integrity)
3. **Client-side filter computation**: Lightweight metadata shipped to the browser enables instant filtering without server round-trips
4. **Denormalization**: Pre-computed fields on products avoid expensive joins in GROQ queries, maintained automatically via publish hooks and revalidation webhooks
5. **Granular cache invalidation**: Reverse lookup mechanism ensures only affected pages are invalidated when content changes, rather than purging entire categories
6. **Fragment-based queries**: GROQ query fragments are composed into larger queries, promoting reuse and consistency across ~2400 lines of query code
7. **Modular page builder**: 20+ block types allow content editors to compose pages freely without developer intervention
8. **Cookie-based comparison**: No authentication required — comparison state persists via cookies with a 7-day expiry
