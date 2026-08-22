# Product Detail Page Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for creating a product detail page (`/produkty/[slug]`) outside the listing layout, with the following key sections:

- Product hero with image gallery and product information
- Sticky navigation pills
- Two-column content section (product details/description)
- Technical data table
- Store locations with interactive map
- Featured reviews carousel
- Related products carousel (reusable page builder section)
- Optional custom page builder sections

## Architecture Overview

```
/produkty/[slug]/
├── page.tsx                 # Main product page component (outside listing layout)
└── Components (Reused/New):
    ├── PillsStickyNav/          # ✅ Reused from brand page
    ├── TwoColumnContent/        # ✅ Reused from brand page
    ├── StoreLocations/          # ✅ Reused from brand page
    ├── FeaturedPublications/    # ✅ Reused (for reviews)
    ├── ProductHero/             # 🆕 New component
    ├── TechnicalData/           # 🆕 New component
    └── ProductsCarousel/        # 🆕 New page builder section
```

---

## Phase 1: Sanity Studio Schema Updates

### Step 1.1: Review Existing Product Schema

**File**: `apps/studio/schemaTypes/documents/collections/product.ts`

**Existing fields to leverage:**

- ✅ `name` - Product name (used as hero title)
- ✅ `subtitle` - Product subtitle/category
- ✅ `price` - Product price
- ✅ `imageGallery` - Array of product images
- ✅ `shortDescription` - Short description (hero section)
- ✅ `brand` - Brand reference
- ✅ `categories` - Product categories
- ✅ `awards` - Product awards/badges
- ✅ `details` - Object with heading and content (two-column section)
- ✅ `technicalData` - Array of technical parameters
- ✅ `availableInStores` - Store references
- ✅ `reviews` - Review references (max 4)
- ✅ `relatedProducts` - Related products array (4-10 products)
- ✅ `pageBuilder` - Custom page builder sections

**Fields ready to use - no changes needed!**

The existing product schema already has all necessary fields for the product page implementation. We can proceed directly to component creation.

---

## Phase 2: Create New UI Components

### Step 2.1: Create ProductHero Component

**Location**: `apps/web/src/components/ui/ProductHero/`

**Purpose**: Hero section for product with large image gallery, product info, price, and CTA buttons

**Features**:

- Left side: Large product image gallery with thumbnails
- Right side: Product information card
  - Brand name + Product name
  - Product subtitle
  - Price (formatted with currency)
  - Awards badges (if available)
  - Short description (portable text)
  - Two CTA buttons: "Zapytaj o produkt" (primary) and "Zobacz w salonie" (secondary)
- Responsive: Stack vertically on mobile

**TypeScript Interface**:

```typescript
export interface ProductHeroProps {
  name: string;
  subtitle: string;
  brand?: {
    name: string;
    slug: string;
    logo?: SanityRawImage;
  };
  price?: number;
  imageGallery: SanityRawImage[];
  shortDescription?: PortableTextProps;
  awards?: AwardType[];
  customId?: string;
}
```

**SCSS Structure** (following repo guidelines):

```scss
.productHero {
  // Outer container with max-width and padding

  .container {
    // Two-column layout (image gallery + product info)

    .gallerySection {
      // Large image with thumbnails below

      .mainImage {
        // Main product image container
      }

      .thumbnails {
        // Thumbnail strip

        .thumbnail {
          // Individual thumbnail

          &.active {
            // Active thumbnail state
          }

          &:hover {
            // Hover state
          }
        }
      }
    }

    .infoSection {
      // Product information card

      .brandLogo {
        // Brand logo image
      }

      .productTitle {
        // Brand name + product name

        .brandName {
          // Brand name
        }

        .productName {
          // Product name
        }
      }

      .subtitle {
        // Product subtitle/category
      }

      .priceWrapper {
        // Price display

        .price {
          // Formatted price
        }
      }

      .awardsWrapper {
        // Awards badges

        .award {
          // Individual award badge
        }
      }

      .description {
        // Short description (portable text)
      }

      .buttons {
        // CTA buttons container

        .button {
          // Individual button
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Stack vertically

    .container {
      .gallerySection {
        // Full width gallery

        .thumbnails {
          // Horizontal scroll thumbnails
        }
      }

      .infoSection {
        // Full width info card

        .buttons {
          // Stack buttons vertically or horizontally based on space
        }
      }
    }
  }
}
```

**Key Implementation Notes**:

- Use existing `ProductGallery` component logic for image gallery
- Format price with currency using utility function
- Render awards as badge images
- Use portable text renderer for description
- Primary button: "Zapytaj o produkt" links to contact form or opens modal
- Secondary button: "Zobacz w salonie" scrolls to store locations section
- Border radius: 0.5rem (8px)
- Gap between sections: 3rem desktop, 2rem mobile

---

### Step 2.2: Create TechnicalData Component

**Location**: `apps/web/src/components/ui/TechnicalData/`

**Purpose**: Display technical specifications in a clean table format

**Features**:

- Gray background container matching TwoColumnContent style
- Title: "Dane techniczne"
- Table with alternating row colors (white/transparent)
- Parameter name (left) and value (right)
- Optional CTA button at bottom
- Responsive: Full width on mobile

**TypeScript Interface**:

```typescript
export interface TechnicalDataItem {
  title: string;
  value: string;
}

export interface TechnicalDataProps {
  data?: TechnicalDataItem[];
  customId?: string;
  button?: {
    text: string;
    href: string;
  };
}
```

**SCSS Structure** (following repo guidelines):

```scss
.technicalData {
  // Outer container with padding

  .container {
    // Gray background container
    // Same styling as TwoColumnContent

    .wrapper {
      // Inner wrapper for title + table

      .heading {
        // "Dane techniczne" heading
      }

      .table {
        // Table container

        .row {
          // Individual table row

          &:nth-child(odd) {
            // Odd rows (white background)
          }

          &:nth-child(even) {
            // Even rows (transparent background)
          }

          .label {
            // Parameter name (left column)
          }

          .value {
            // Parameter value (right column)
          }
        }
      }

      .buttonWrapper {
        // CTA button container
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile overrides

    .container {
      .wrapper {
        .heading {
          // Smaller heading
        }

        .table {
          .row {
            // Adjust padding

            .label {
              // Smaller font
            }

            .value {
              // Smaller font
            }
          }
        }
      }
    }
  }
}
```

**Key Implementation Notes**:

- Background: `var(--neutral-200)` (#F8F8F8)
- Border radius: 0.5rem (8px)
- Odd rows: White background (`var(--neutral-white)`)
- Even rows: Transparent background
- Label column: Fixed width 158px (9.875rem) desktop
- Label font: Poppins Light, 12px (0.75rem), neutral-700
- Value font: Poppins Light, 14px (0.875rem), neutral-black
- Row padding: 0.5rem (8px)
- Gap between title and table: 1.5rem (24px)
- Border radius for table: 0.5rem (8px) - rounded corners on first and last rows

---

### Step 2.3: Create ProductsCarousel Page Builder Section

**Location**: `apps/web/src/components/pageBuilder/ProductsCarousel/`

**Purpose**: Reusable carousel for displaying products (related products, featured products, etc.)

**Features**:

- Heading and description (portable text)
- Horizontal scrolling carousel
- Product cards with:
  - Product image
  - Brand name
  - Product name
  - Price
  - Optional "View" button
- Navigation arrows (prev/next)
- Responsive: Adjust number of visible cards based on viewport
- Auto-disable carousel when all items fit in viewport

**Sanity Schema** (following page builder section guide):

**File**: `apps/studio/schemaTypes/blocks/products-carousel.ts`

```typescript
import { PackageOpen } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = 'Karuzela produktów';

export const productsCarousel = defineType({
  name: 'productsCarousel',
  icon: PackageOpen,
  type: 'object',
  description:
    'Karuzela wyświetlająca produkty (np. powiązane produkty, nowości, bestsellery)',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description:
        'Główny nagłówek sekcji (np. "Powiązane produkty", "Polecane produkty")',
      type: 'heading',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description: 'Opcjonalny opis wyświetlany pod nagłówkiem',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    defineField({
      name: 'products',
      title: 'Produkty',
      type: 'array',
      description:
        'Wybierz produkty do wyświetlenia w karuzeli (minimum 4, maksimum 12)',
      of: [
        {
          type: 'reference',
          to: [{ type: 'product' }],
          options: {
            disableNew: true,
            filter: ({ parent, document }) => {
              // Prevent duplicate selections
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              // Exclude current product if on product detail page
              const currentProductId = document?._id?.replace(/^drafts\./, '');
              const excludedIds = currentProductId
                ? [...selectedIds, currentProductId]
                : selectedIds;

              return {
                filter: '!(_id in $excludedIds) && !(_id in path("drafts.**"))',
                params: { excludedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(4).error('Musisz wybrać co najmniej 4 produkty'),
        Rule.max(12).error('Możesz wybrać maksymalnie 12 produktów'),
        Rule.required().error('Produkty są wymagane'),
        Rule.unique().error('Każdy produkt może być wybrany tylko raz'),
      ],
    }),
    defineField({
      name: 'button',
      title: 'Przycisk CTA',
      type: 'button',
      description:
        'Opcjonalny przycisk wyświetlany pod karuzelą (np. "Zobacz wszystkie produkty")',
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      description: 'description',
      productsCount: 'products.length',
    },
    prepare: ({ heading, description, productsCount }) => {
      return {
        title,
        subtitle:
          toPlainText(heading) ||
          toPlainText(description) ||
          `${productsCount || 0} produktów`,
        media: PackageOpen,
      };
    },
  },
});
```

**Register in blocks index**:

**File**: `apps/studio/schemaTypes/blocks/index.ts`

```typescript
import { productsCarousel } from './products-carousel';
// ... other imports

export const pagebuilderBlocks = [
  // ... existing blocks
  productsCarousel,
];
```

**GROQ Query Fragment**:

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Products carousel block fragment
const productsCarouselBlock = /* groq */ `
  _type == "productsCarousel" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    products[]->{
      _id,
      name,
      subtitle,
      slug,
      price,
      "mainImage": imageGallery[0]{
        ${imageFragment()}
      },
      brand->{
        _id,
        name,
        slug
      }
    }
  }
`;

// Add to pageBuilderFragment
export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,
    ${existingBlocks},
    ${productsCarouselBlock}
  }
`;
```

**Component TypeScript Interface**:

```typescript
export interface ProductsCarouselProps {
  heading: PortableTextProps;
  description?: PortableTextProps;
  products: ProductCardType[];
  button?: ButtonType;
  index: number;
  _key: string;
  _type: 'productsCarousel';
  customId?: string;
}
```

**Component Structure**:

**File**: `apps/web/src/components/pageBuilder/ProductsCarousel/index.tsx`

```typescript
import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import ProductCard from '../../ui/ProductCard';
import ProductsCarouselWrapper from './ProductsCarouselWrapper';
import styles from './styles.module.scss';

type ProductsCarouselProps = Extract<
  PageBuilderBlock,
  { _type: 'productsCarousel' }
>;

export default function ProductsCarousel({
  heading,
  description,
  products,
  button,
  customId,
}: ProductsCarouselProps) {
  if (!products || products.length === 0) return null;

  return (
    <section
      className={`${styles.productsCarousel} max-width`}
      id={customId}
    >
      <div className={styles.header}>
        {heading && (
          <div className={styles.heading}>
            <PortableText content={heading} />
          </div>
        )}
        {description && (
          <div className={styles.description}>
            <PortableText content={description} />
          </div>
        )}
      </div>

      <ProductsCarouselWrapper products={products} />

      {button && (
        <div className={styles.buttonWrapper}>
          <Button {...button} />
        </div>
      )}
    </section>
  );
}
```

**Carousel Wrapper Component** (Client component for carousel logic):

**File**: `apps/web/src/components/pageBuilder/ProductsCarousel/ProductsCarouselWrapper.tsx`

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

import type { ProductCardType } from '../../ui/ProductCard';

interface ProductsCarouselWrapperProps {
  products: ProductCardType[];
}

export default function ProductsCarouselWrapper({
  products,
}: ProductsCarouselWrapperProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    watchDrag: canScroll,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Check if content overflows and needs carousel
  const checkOverflow = useCallback(() => {
    if (!viewportRef.current || !containerRef.current) return;

    const viewportWidth = viewportRef.current.offsetWidth;
    const containerWidth = containerRef.current.scrollWidth;
    const hasOverflow = containerWidth > viewportWidth;

    setCanScroll(hasOverflow);
  }, []);

  // Update scroll button states
  const updateScrollButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    checkOverflow();
    updateScrollButtons();

    emblaApi.on('select', updateScrollButtons);
    emblaApi.on('resize', checkOverflow);

    window.addEventListener('resize', checkOverflow);

    return () => {
      emblaApi.off('select', updateScrollButtons);
      emblaApi.off('resize', checkOverflow);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [emblaApi, checkOverflow, updateScrollButtons]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  return (
    <div className={styles.carouselWrapper}>
      <div
        className={styles.viewport}
        ref={canScroll ? emblaRef : viewportRef}
        data-carousel-enabled={canScroll}
      >
        <div className={styles.container} ref={containerRef}>
          {products.map((product) => (
            <div key={product._id} className={styles.slide}>
              <ProductCard product={product} layout="vertical" />
            </div>
          ))}
        </div>
      </div>

      {canScroll && (
        <>
          <button
            className={`${styles.navButton} ${styles.prevButton}`}
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label="Previous products"
          >
            <ChevronLeft />
          </button>
          <button
            className={`${styles.navButton} ${styles.nextButton}`}
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label="Next products"
          >
            <ChevronRight />
          </button>
        </>
      )}
    </div>
  );
}
```

**SCSS Structure**:

```scss
.productsCarousel {
  // Section outer container with max-width

  .header {
    // Header container for heading + description

    .heading {
      // Heading styles
    }

    .description {
      // Description styles
    }
  }

  .carouselWrapper {
    // Carousel wrapper with relative positioning for nav buttons

    .viewport {
      // Embla viewport

      &[data-carousel-enabled='false'] {
        // When carousel is disabled (all items fit)
      }
    }

    .container {
      // Embla container (flex)

      .slide {
        // Individual product card wrapper

        // Responsive sizing:
        // Desktop: 4 items (25% width with gap)
        // Tablet: 3 items
        // Mobile: 2 items or scroll
      }
    }

    .navButton {
      // Navigation button base styles

      &.prevButton {
        // Left button positioning
      }

      &.nextButton {
        // Right button positioning
      }

      &:disabled {
        // Disabled state
      }

      &:hover:not(:disabled) {
        // Hover state
      }

      &:focus-visible {
        // Focus state
      }
    }
  }

  .buttonWrapper {
    // CTA button wrapper
  }

  @media (max-width: 56.1875rem) {
    // Mobile overrides

    .header {
      .heading {
        // Smaller heading
      }

      .description {
        // Smaller description
      }
    }

    .carouselWrapper {
      .container {
        .slide {
          // Adjust slide width for mobile
        }
      }

      .navButton {
        // Smaller nav buttons on mobile
      }
    }
  }
}
```

**Key Implementation Notes**:

- Follow same overflow detection pattern as `FeaturedPublications`
- Responsive card widths:
  - Desktop (>899px): 4 cards visible (23% width with gaps)
  - Tablet (768-899px): 3 cards visible (31% width with gaps)
  - Mobile (<768px): 2 cards visible or enable horizontal scroll
- Gap between cards: 1.5rem (24px)
- Navigation buttons: Circular, white background, neutral-700 icon
- Nav button size: 2.5rem (40px) desktop, 2rem (32px) mobile
- Nav button positioning: Absolute, vertically centered, outside carousel
- Disable carousel when all items fit in viewport (no drag, no buttons)

---

## Phase 3: Create Product Page Route

### Step 3.1: Create Product Page File (Outside Listing Layout)

**Location**: `apps/web/src/app/produkty/[slug]/page.tsx`

**Important**: This file should be created at the root level of `/produkty/[slug]/`, NOT inside `(listing)` folder to avoid the listing layout.

**Objective**: Main product page component

**Page Structure**:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProductHero from '@/src/components/ui/ProductHero';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import TechnicalData from '@/src/components/ui/TechnicalData';
import StoreLocations from '@/src/components/ui/StoreLocations';
import FeaturedPublications from '@/src/components/pageBuilder/FeaturedPublications';
import ProductsCarousel from '@/src/components/pageBuilder/ProductsCarousel';
import PageBuilder from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { sanityFetch } from '@/src/global/sanity/client';
import {
  queryProductBySlug,
  queryAllProductSlugs,
} from '@/src/global/sanity/query';
import type {
  QueryProductBySlugResult,
  QueryAllProductSlugsResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import type { PortableTextProps } from '@/src/global/types';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

// Fetch product data
function fetchProductData(slug: string) {
  return sanityFetch<QueryProductBySlugResult>({
    query: queryProductBySlug,
    params: { slug: `/produkty/${slug}/` },
    tags: ['product', slug],
  });
}

export async function generateStaticParams() {
  const products = await sanityFetch<QueryAllProductSlugsResult>({
    query: queryAllProductSlugs,
    tags: ['product'],
  });

  return products
    .filter((product) => product.slug)
    .map((product) => ({
      slug: product.slug!.replace('/produkty/', '').replace(/\/$/, ''),
    }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductData(slug);

  if (!product) return getSEOMetadata();

  return getSEOMetadata({
    seo: product.seo,
    slug: product.slug,
    openGraph: product.openGraph,
  });
}

export default async function ProductPage(props: ProductPageProps) {
  const { slug } = await props.params;
  const product = await fetchProductData(slug);

  if (!product) {
    notFound();
  }

  // Breadcrumbs data
  const breadcrumbsData = [
    {
      name: 'Produkty',
      path: '/produkty',
    },
    {
      name: product.brand?.name || '',
      path: product.brand?.slug || '',
    },
    {
      name: product.name || '',
      path: product.slug || '',
    },
  ];

  // Determine which sections are visible for sticky navigation
  const sections = [
    { id: 'galeria', label: 'Galeria', visible: true },
    {
      id: 'szczegoly',
      label: 'Szczegóły',
      visible: !!product.details?.content,
    },
    {
      id: 'dane-techniczne',
      label: 'Dane techniczne',
      visible: !!product.technicalData && product.technicalData.length > 0,
    },
    {
      id: 'recenzje',
      label: 'Recenzje',
      visible: !!product.reviews && product.reviews.length > 0,
    },
    {
      id: 'powiazane-produkty',
      label: 'Powiązane produkty',
      visible: !!product.relatedProducts && product.relatedProducts.length >= 4,
    },
    {
      id: 'gdzie-kupic',
      label: 'Gdzie kupić',
      visible: !!product.availableInStores && product.availableInStores.length > 0,
    },
  ].filter((section) => section.visible);

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} />

      {/* Product Hero with Gallery */}
      <ProductHero
        name={product.name || ''}
        subtitle={product.subtitle || ''}
        brand={product.brand}
        price={product.price}
        imageGallery={product.imageGallery || []}
        shortDescription={product.shortDescription}
        awards={product.awards}
        customId="galeria"
      />

      {/* Sticky Navigation */}
      {sections.length > 1 && <PillsStickyNav sections={sections} />}

      {/* Product Details (Two-Column Content) */}
      {product.details?.content && (
        <TwoColumnContent
          content={product.details.content as PortableTextProps}
          customId="szczegoly"
          headingContent={product.details.heading}
          gallery={
            product.duplicateGalleryInDetails
              ? (product.imageGallery as SanityRawImage[])
              : undefined
          }
        />
      )}

      {/* Technical Data Table */}
      {product.technicalData && product.technicalData.length > 0 && (
        <TechnicalData
          data={product.technicalData}
          customId="dane-techniczne"
          button={{
            text: 'Pobierz specyfikację PDF',
            href: '#', // TODO: Add PDF download functionality
          }}
        />
      )}

      {/* Reviews Section */}
      {product.reviews && product.reviews.length > 0 && (
        <FeaturedPublications
          heading={[
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Recenzje produktu',
                  _key: 'recenzje-produktu',
                },
              ],
              style: 'normal',
              _key: '',
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          publications={product.reviews as unknown as PublicationType[]}
          button={{
            text: 'Zobacz wszystkie recenzje',
            href: '/recenzje',
            variant: 'primary' as const,
            _key: null,
            _type: 'button',
            openInNewTab: false,
          }}
          index={1}
          _key=""
          _type="featuredPublications"
          customId="recenzje"
          publicationLayout="horizontal"
        />
      )}

      {/* Related Products Carousel */}
      {product.relatedProducts && product.relatedProducts.length >= 4 && (
        <ProductsCarousel
          heading={[
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Powiązane produkty',
                  _key: 'powiazane-produkty',
                },
              ],
              style: 'normal',
              _key: '',
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          products={product.relatedProducts as unknown as ProductCardType[]}
          button={{
            text: 'Zobacz wszystkie produkty',
            href: '/produkty',
            variant: 'primary' as const,
            _key: null,
            _type: 'button',
            openInNewTab: false,
          }}
          index={2}
          _key=""
          _type="productsCarousel"
          customId="powiazane-produkty"
        />
      )}

      {/* Store Locations */}
      {product.availableInStores && product.availableInStores.length > 0 && (
        <StoreLocations
          customId="gdzie-kupic"
          stores={product.availableInStores.filter((s) => s !== null)}
        />
      )}

      {/* Custom Page Builder Sections */}
      {product.pageBuilder && product.pageBuilder.length > 0 && (
        <PageBuilder blocks={product.pageBuilder} />
      )}
    </main>
  );
}
```

**Key Implementation Notes**:

- Page file location: `apps/web/src/app/produkty/[slug]/page.tsx` (NOT in `(listing)` folder)
- Reuses breadcrumbs, sticky nav, and other UI components
- Conditionally renders sections based on data availability
- Gallery section is always visible (part of hero)
- Related products require minimum 4 products to display
- Custom page builder sections rendered at the bottom

---

## Phase 4: GROQ Queries

### Step 4.1: Create Product Detail Query

**File**: `apps/web/src/global/sanity/query.ts`

**Query**:

```typescript
// Product detail query
export const queryProductBySlug = defineQuery(/* groq */ `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    name,
    subtitle,
    slug,
    price,
    isArchived,
    
    // Image gallery
    imageGallery[]{
      ${imageFragment()}
    },
    
    // Short description (hero)
    ${portableTextFragment('shortDescription')},
    
    // Brand reference
    brand->{
      _id,
      name,
      slug,
      logo{
        ${imageFragment()}
      }
    },
    
    // Categories
    categories[]->{
      _id,
      name,
      slug
    },
    
    // Awards
    awards[]->{
      _id,
      name,
      image{
        ${imageFragment()}
      }
    },
    
    // Product details (two-column content)
    details{
      ${portableTextFragment('heading')},
      ${portableTextFragment('content')}
    },
    
    // Technical data
    technicalData[]{
      title,
      value
    },
    
    // Duplicate gallery in details flag
    duplicateGalleryInDetails,
    
    // Available in stores
    availableInStores[]->{
      _id,
      name,
      address{
        postalCode,
        city,
        street
      },
      phone,
      website
    },
    
    // Reviews (max 4)
    reviews[]->{
      _id,
      name,
      slug,
      title,
      description,
      image{
        ${imageFragment()}
      },
      author->{
        _id,
        name,
        image{
          ${imageFragment()}
        }
      }
    },
    
    // Related products (4-10)
    relatedProducts[]->{
      _id,
      name,
      subtitle,
      slug,
      price,
      "mainImage": imageGallery[0]{
        ${imageFragment()}
      },
      brand->{
        _id,
        name,
        slug
      }
    },
    
    // Custom page builder sections
    ${pageBuilderFragment},
    
    // SEO fields
    seo {
      title,
      description,
      ogImage{
        ${imageFragment()}
      }
    },
    openGraph {
      title,
      description,
      image{
        ${imageFragment()}
      }
    }
  }
`);

// Get all product slugs for static generation
export const queryAllProductSlugs = defineQuery(/* groq */ `
  *[_type == "product" && defined(slug.current)] {
    "slug": slug.current
  }
`);
```

**After adding queries, run type generation**:

```bash
cd apps/studio && bun run type
```

---

## Phase 5: Component Styling

### Step 5.1: ProductHero Styles

**File**: `apps/web/src/components/ui/ProductHero/styles.module.scss`

```scss
.productHero {
  padding: 0 2rem;
  margin-bottom: 3rem;

  .container {
    display: flex;
    gap: 3rem;
    align-items: flex-start;

    .gallerySection {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;

      .mainImage {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 0.5rem;
        overflow: hidden;
        background: var(--neutral-200);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .thumbnails {
        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;

        &::-webkit-scrollbar {
          height: 0.25rem;
        }

        &::-webkit-scrollbar-track {
          background: var(--neutral-200);
        }

        &::-webkit-scrollbar-thumb {
          background: var(--neutral-400);
          border-radius: 0.125rem;
        }

        .thumbnail {
          width: 5rem;
          height: 5rem;
          flex-shrink: 0;
          border-radius: 0.5rem;
          overflow: hidden;
          cursor: pointer;
          border: 0.125rem solid transparent;
          transition: border-color 250ms cubic-bezier(0.4, 0, 0.2, 1);

          &:hover {
            border-color: var(--neutral-400);
          }

          &.active {
            border-color: var(--primary-red);
          }

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
      }
    }

    .infoSection {
      flex: 1;
      background: var(--neutral-200);
      border-radius: 0.5rem;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;

      .brandLogo {
        width: 8rem;
        height: auto;

        img {
          width: 100%;
          height: auto;
          object-fit: contain;
        }
      }

      .productTitle {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        .brandName {
          font-family: 'Poppins', sans-serif;
          font-size: 0.875rem;
          font-weight: 400;
          line-height: 1.5;
          color: var(--neutral-600);
          letter-spacing: -0.02625rem;
        }

        .productName {
          font-family: 'Switzer Variable', sans-serif;
          font-size: 2.5rem;
          font-weight: 500;
          line-height: 1.16;
          color: var(--neutral-700);
          letter-spacing: -0.075rem;
        }
      }

      .subtitle {
        font-family: 'Poppins', sans-serif;
        font-size: 1rem;
        font-weight: 300;
        line-height: 1.5;
        color: var(--neutral-600);
      }

      .priceWrapper {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;

        .price {
          font-family: 'Switzer Variable', sans-serif;
          font-size: 2rem;
          font-weight: 500;
          line-height: 1.16;
          color: var(--neutral-black);
          letter-spacing: -0.06rem;
        }
      }

      .awardsWrapper {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;

        .award {
          width: 3rem;
          height: 3rem;

          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
      }

      .description {
        font-family: 'Poppins', sans-serif;
        font-size: 0.875rem;
        font-weight: 300;
        line-height: 1.5;
        color: var(--neutral-600);
      }

      .buttons {
        display: flex;
        gap: 1rem;
        margin-top: auto;

        .button {
          flex: 1;
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    padding: 0 1rem;
    margin-bottom: 2rem;

    .container {
      flex-direction: column;
      gap: 2rem;

      .gallerySection {
        .mainImage {
          aspect-ratio: 4 / 3;
        }

        .thumbnails {
          .thumbnail {
            width: 4rem;
            height: 4rem;
          }
        }
      }

      .infoSection {
        padding: 1.5rem;
        gap: 1rem;

        .brandLogo {
          width: 6rem;
        }

        .productTitle {
          .productName {
            font-size: 1.75rem;
            letter-spacing: -0.0525rem;
          }
        }

        .subtitle {
          font-size: 0.875rem;
        }

        .priceWrapper {
          .price {
            font-size: 1.5rem;
            letter-spacing: -0.045rem;
          }
        }

        .awardsWrapper {
          .award {
            width: 2.5rem;
            height: 2.5rem;
          }
        }

        .buttons {
          flex-direction: column;
          gap: 0.75rem;
        }
      }
    }
  }
}
```

---

### Step 5.2: TechnicalData Styles

**File**: `apps/web/src/components/ui/TechnicalData/styles.module.scss`

```scss
.technicalData {
  padding: 0 2rem;
  margin-bottom: 3rem;

  .container {
    background: var(--neutral-200);
    border-radius: 0.5rem;
    padding: 2rem;
    overflow: hidden;

    .wrapper {
      display: flex;
      gap: 3rem;
      align-items: flex-start;

      .heading {
        font-family: 'Switzer Variable', sans-serif;
        font-size: 1.5rem;
        font-weight: 500;
        line-height: 1.16;
        color: var(--neutral-700);
        letter-spacing: -0.045rem;
        flex-shrink: 0;
      }

      .table {
        flex: 1;
        display: flex;
        flex-direction: column;
        border-radius: 0.5rem;
        overflow: hidden;

        .row {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          min-height: 2.75rem;

          &:nth-child(odd) {
            background: var(--neutral-white);
          }

          &:nth-child(even) {
            background: transparent;
          }

          .label {
            width: 9.875rem;
            padding: 0.5rem;
            font-family: 'Poppins', sans-serif;
            font-size: 0.75rem;
            font-weight: 300;
            line-height: 1.5;
            color: var(--neutral-700);
          }

          .value {
            flex: 1;
            padding: 0.5rem;
            font-family: 'Poppins', sans-serif;
            font-size: 0.875rem;
            font-weight: 300;
            line-height: 1.5;
            color: var(--neutral-black);
          }
        }
      }

      .buttonWrapper {
        flex-shrink: 0;
        align-self: flex-end;
      }
    }
  }

  @media (max-width: 56.1875rem) {
    padding: 0 1rem;
    margin-bottom: 2rem;

    .container {
      padding: 1.5rem 1rem;

      .wrapper {
        flex-direction: column;
        gap: 1.5rem;

        .heading {
          font-size: 1.25rem;
          letter-spacing: -0.0375rem;
        }

        .table {
          .row {
            flex-direction: column;
            gap: 0.25rem;

            .label {
              width: 100%;
              font-size: 0.6875rem;
            }

            .value {
              width: 100%;
              font-size: 0.8125rem;
            }
          }
        }

        .buttonWrapper {
          width: 100%;
          align-self: stretch;
        }
      }
    }
  }
}
```

---

### Step 5.3: ProductsCarousel Styles

**File**: `apps/web/src/components/pageBuilder/ProductsCarousel/styles.module.scss`

```scss
.productsCarousel {
  padding: 0 2rem;
  margin-bottom: 3rem;

  .header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
    text-align: center;

    .heading {
      font-family: 'Switzer Variable', sans-serif;
      font-size: 2.5rem;
      font-weight: 500;
      line-height: 1.16;
      color: var(--neutral-700);
      letter-spacing: -0.075rem;
    }

    .description {
      font-family: 'Poppins', sans-serif;
      font-size: 1rem;
      font-weight: 300;
      line-height: 1.5;
      color: var(--neutral-600);
    }
  }

  .carouselWrapper {
    position: relative;

    .viewport {
      overflow: hidden;
      border-radius: 0.5rem;

      &[data-carousel-enabled='false'] {
        overflow: visible;
      }
    }

    .container {
      display: flex;
      gap: 1.5rem;

      .slide {
        flex: 0 0 23%;
        min-width: 0;

        @media (max-width: 56.1875rem) {
          flex: 0 0 31%;
        }

        @media (max-width: 47.9375rem) {
          flex: 0 0 48%;
        }
      }
    }

    .navButton {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: var(--neutral-white);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.1);
      transition:
        background-color 250ms cubic-bezier(0.4, 0, 0.2, 1),
        transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;

      svg {
        width: 1.5rem;
        height: 1.5rem;
        stroke: var(--neutral-700);
      }

      &.prevButton {
        left: -1.25rem;
      }

      &.nextButton {
        right: -1.25rem;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &:hover:not(:disabled) {
        background: var(--neutral-700);
        transform: translateY(-50%) scale(1.05);

        svg {
          stroke: var(--neutral-white);
        }
      }

      &:focus-visible {
        outline: 0.125rem solid var(--primary-red);
        outline-offset: 0.125rem;
      }
    }
  }

  .buttonWrapper {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  @media (max-width: 56.1875rem) {
    padding: 0 1rem;
    margin-bottom: 2rem;

    .header {
      margin-bottom: 1.5rem;

      .heading {
        font-size: 1.75rem;
        letter-spacing: -0.0525rem;
      }

      .description {
        font-size: 0.875rem;
      }
    }

    .carouselWrapper {
      .navButton {
        width: 2rem;
        height: 2rem;

        svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        &.prevButton {
          left: -0.5rem;
        }

        &.nextButton {
          right: -0.5rem;
        }
      }
    }

    .buttonWrapper {
      margin-top: 1.5rem;
    }
  }
}
```

---

## Phase 6: Integration and Testing

### Step 6.1: Add ProductsCarousel to PageBuilder

**File**: `apps/web/src/components/shared/PageBuilder.tsx`

**Add import**:

```typescript
import ProductsCarousel from '../pageBuilder/ProductsCarousel';
```

**Add case to switch statement**:

```typescript
case 'productsCarousel':
  return (
    <ProductsCarousel
      key={block._key}
      {...(block as BlockByType<'productsCarousel'>)}
    />
  );
```

---

### Step 6.2: Update ProductCard Component (If Needed)

**File**: `apps/web/src/components/ui/ProductCard/index.tsx`

**Ensure ProductCard supports**:

- Vertical and horizontal layouts
- Product image display
- Brand name + product name
- Price formatting
- Link to product detail page
- Optional "View" button

---

### Step 6.3: Verification Checklist

**Product Hero**:

- [ ] Image gallery displays correctly
- [ ] Thumbnails work and change main image
- [ ] Product info card shows all fields
- [ ] Brand logo displays
- [ ] Price is formatted correctly
- [ ] Awards badges display
- [ ] CTA buttons work correctly
- [ ] Mobile: Stacks vertically
- [ ] Mobile: Gallery is responsive

**Sticky Navigation**:

- [ ] Navigation sticks below Header
- [ ] Pills only show for available sections
- [ ] Clicking a pill scrolls to correct section
- [ ] Active pill updates on scroll
- [ ] Mobile: Compact expandable menu works
- [ ] Mobile: Animations are smooth

**Two-Column Content** (Product Details):

- [ ] Two columns on desktop
- [ ] Vertical divider appears
- [ ] Portable text renders correctly
- [ ] Optional gallery appears if `duplicateGalleryInDetails` is true
- [ ] Mobile: Stacks vertically

**Technical Data Table**:

- [ ] Gray background container
- [ ] Table displays with alternating row colors
- [ ] Label and value columns sized correctly
- [ ] Optional CTA button appears
- [ ] Mobile: Labels and values stack

**Featured Reviews**:

- [ ] Reviews section only shows when reviews exist
- [ ] Carousel works correctly
- [ ] Review cards display properly
- [ ] Layout prop works (horizontal/vertical)
- [ ] Mobile: Carousel is swipeable

**Related Products Carousel**:

- [ ] Carousel only shows with 4+ products
- [ ] Product cards display correctly
- [ ] Navigation arrows work
- [ ] Carousel disables when all items fit
- [ ] Responsive card widths
- [ ] Mobile: 2 cards visible or horizontal scroll

**Store Locations**:

- [ ] Map displays with geocoded locations
- [ ] Store list shows correct information
- [ ] Clicking store highlights on map
- [ ] Clicking map marker highlights store
- [ ] Mobile: Map and list stack vertically

**Custom Page Builder**:

- [ ] Custom sections render at bottom
- [ ] All page builder blocks work
- [ ] ProductsCarousel block works in page builder

**General**:

- [ ] Breadcrumbs work correctly
- [ ] SEO metadata is correct
- [ ] All links work
- [ ] Responsive design works on all breakpoints
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] All SCSS follows repository guidelines

---

## Phase 7: Edge Cases and Validation

### Step 7.1: Handle Missing Data

**Scenarios to Test**:

- [ ] Product has no images → Show placeholder
- [ ] Product has no brand → Hide brand logo
- [ ] Product has no price → Hide price section
- [ ] Product has no awards → Hide awards section
- [ ] Product has no short description → Hide description
- [ ] Product has no details → Hide two-column section
- [ ] Product has no technical data → Hide technical data section
- [ ] Product has no reviews → Hide reviews section
- [ ] Product has < 4 related products → Hide related products carousel
- [ ] Product has no stores → Hide store locations section
- [ ] Product has no page builder sections → Don't render PageBuilder

---

## Phase 8: Accessibility and Performance

### Step 8.1: Accessibility Checklist

- [ ] All interactive elements have focus states
- [ ] Image gallery is keyboard navigable
- [ ] Sticky navigation is keyboard navigable
- [ ] Carousel navigation has ARIA labels
- [ ] All images have alt text
- [ ] Headings follow proper hierarchy (h1 → h2 → h3)
- [ ] ARIA labels for navigation buttons
- [ ] Color contrast meets WCAG AA standards
- [ ] Form inputs (if any) have labels
- [ ] Skip to content link available

### Step 8.2: Performance Optimizations

- [ ] Images are optimized and lazy-loaded
- [ ] Use Next.js Image component for all images
- [ ] Implement proper image sizing and srcset
- [ ] Minimize layout shift (CLS)
- [ ] Optimize font loading
- [ ] Code splitting for components
- [ ] Minimize JavaScript bundle size
- [ ] Lazy load map component
- [ ] Carousel only initializes when needed

### Step 8.3: SEO Checklist

- [ ] Dynamic metadata generation works
- [ ] OG images are set
- [ ] Structured data for product page (schema.org/Product)
- [ ] Canonical URL is set
- [ ] Breadcrumb structured data
- [ ] Proper heading hierarchy
- [ ] Product schema includes: name, image, price, brand, description
- [ ] Review schema for product reviews

---

## Phase 9: Documentation

### Step 9.1: Component Documentation

**For Each New Component**:

- ProductHero: Purpose, props, usage examples
- TechnicalData: Purpose, props, usage examples
- ProductsCarousel: Purpose, props, usage examples (page builder)

### Step 9.2: Update README

**Document**:

- Product page structure
- Component usage
- Sanity schema notes
- Query patterns
- Styling conventions
- Page builder section creation

---

## Summary

This implementation plan provides a comprehensive, step-by-step guide for creating a product detail page with:

1. **Existing Schema**: Leverages existing product schema (no changes needed)
2. **New Components**: ProductHero, TechnicalData
3. **New Page Builder Section**: ProductsCarousel (reusable)
4. **Reused Components**: PillsStickyNav, TwoColumnContent, StoreLocations, FeaturedPublications
5. **Page Route**: Created outside listing layout at `/produkty/[slug]/page.tsx`
6. **Complete Styling**: SCSS following repository guidelines
7. **Accessibility**: Focus states, keyboard navigation, ARIA labels
8. **Performance**: Image optimization, lazy loading, code splitting
9. **Testing**: Comprehensive test scenarios and edge cases

The implementation follows Next.js best practices, repository styling guidelines, and ensures a maintainable, scalable solution similar to the brand page.

---

## Estimated Timeline

- **Phase 1** (Schema Review): 1 hour (no changes needed!)
- **Phase 2** (New UI Components): 12-16 hours
  - ProductHero: 6-8 hours
  - TechnicalData: 3-4 hours
  - ProductsCarousel (page builder): 3-4 hours
- **Phase 3** (Page Route): 2-3 hours
- **Phase 4** (GROQ Queries): 1-2 hours
- **Phase 5** (Component Styling): 8-10 hours
- **Phase 6** (Integration & Testing): 4-6 hours
- **Phase 7** (Edge Cases): 2-3 hours
- **Phase 8** (Accessibility & Performance): 3-4 hours
- **Phase 9** (Documentation): 2-3 hours

**Total Estimated Time**: 35-50 hours

---

## Next Steps

1. Review and approve this implementation plan
2. Begin with Phase 2 (create new UI components)
3. Implement ProductHero component first (most complex)
4. Create TechnicalData component
5. Create ProductsCarousel page builder section
6. Create product page route
7. Add GROQ queries and generate types
8. Style all components
9. Integrate and test progressively
10. Deploy to staging for final review
11. Deploy to production

---

## Key Differences from Brand Page

- **No Hero Static**: Product page uses custom ProductHero with image gallery
- **Technical Data Table**: New table component for technical specifications
- **ProductsCarousel**: New reusable page builder section for product listings
- **Product-specific data**: Price, awards, image gallery, technical specs
- **Related products**: Minimum 4 products required (vs. brand's featured reviews)
- **Simpler store locations**: Only shows stores where product is available (vs. brand's all stores)

---

_This document serves as a complete reference for the product detail page implementation._
