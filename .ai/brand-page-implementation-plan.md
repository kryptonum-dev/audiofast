# Brand Detail Page Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for creating a brand detail page (`/marki/[slug]`) with the following key sections:

- Static Hero (similar to products page)
- Sticky navigation pills
- Product listing with sidebar filters
- Banner image
- Two-column content section with brand information
- Distribution year badge section
- Optional product gallery
- Featured reviews
- Store locations section

## Architecture Overview

```
/marki/[slug]/
├── page.tsx                 # Main brand page component
├── BrandStickyNav/          # Sticky navigation component
│   ├── index.tsx
│   └── styles.module.scss
├── BrandContent/            # Two-column content section
│   ├── index.tsx
│   └── styles.module.scss
└── StoreLocations/          # Store locations component
    ├── index.tsx
    └── styles.module.scss
```

---

## Phase 1: Sanity Studio Schema Updates

### Step 1.1: Update Brand Schema (`apps/studio/schemaTypes/documents/collections/brand.ts`)

**Objective**: Add all necessary fields for the brand detail page

**Fields to Add**:

1. **Hero Section Fields** (similar to products.ts)

   ```typescript
   // Update existing description field - name will be used as title
   customPortableText({
     name: 'description',
     title: 'Opis marki (Hero)',
     description:
       'Krótki opis wyświetlany pod nazwą marki w sekcji hero na stronie marki',
     group: GROUP.MAIN_CONTENT,
     include: {
       styles: ['normal'],
       decorators: ['strong', 'em'],
       annotations: ['customLink'],
       lists: ['bullet', 'number'],
     },
     validation: (Rule) => Rule.required().error('Opis marki jest wymagany'),
   });
   ```

   **Note**: The `name` field (created by `defineSlugForDocument`) will be used as the hero title.

   ```typescript
   defineField({
     name: 'heroImage',
     title: 'Obraz tła strony marki',
     type: 'image',
     description: 'Obraz wyświetlany w tle sekcji hero na stronie marki',
     group: GROUP.MAIN_CONTENT,
     options: {
       hotspot: true,
     },
     validation: (Rule) =>
       Rule.required().error('Obraz tła sekcji hero jest wymagany'),
   });
   ```

2. **Banner Image Field**

   ```typescript
   defineField({
     name: 'bannerImage',
     title: 'Obraz banera',
     type: 'image',
     description:
       'Duży obraz banera wyświetlany między listą produktów a sekcją o marce',
     group: GROUP.MAIN_CONTENT,
     options: {
       hotspot: true,
     },
   });
   ```

3. **Distribution Year Field**

   ```typescript
   defineField({
     name: 'distributionStartYear',
     title: 'Rok rozpoczęcia dystrybucji',
     type: 'number',
     description:
       'Rok, w którym AudioFast rozpoczął dystrybucję tej marki (np. 2005)',
     group: GROUP.MAIN_CONTENT,
     validation: (Rule) =>
       Rule.min(1900)
         .max(new Date().getFullYear())
         .error('Podaj prawidłowy rok'),
   });
   ```

4. **Two-Column Content Field**

   ```typescript
   customPortableText({
     name: 'brandStory',
     title: 'Historia marki',
     description: 'Szczegółowy opis marki wyświetlany w sekcji dwukolumnowej',
     group: GROUP.MAIN_CONTENT,
     include: {
       styles: ['normal', 'h2', 'h3'],
       lists: ['bullet', 'number'],
       decorators: ['strong', 'em'],
       annotations: ['customLink'],
     },
     components: ['ptImage', 'ptArrowList', 'ptCircleNumberedList'],
   });
   ```

5. **Optional Image Gallery** (similar to review.ts)

   ```typescript
   defineField({
     name: 'imageGallery',
     title: 'Galeria zdjęć marki',
     type: 'array',
     description:
       'Dodaj zdjęcia do galerii marki (opcjonalne, minimum 4 zdjęcia jeśli dodajesz)',
     group: GROUP.MAIN_CONTENT,
     of: [{ type: 'image' }],
     validation: (Rule) =>
       Rule.custom((value) => {
         if (
           value &&
           Array.isArray(value) &&
           value.length > 0 &&
           value.length < 4
         ) {
           return 'Galeria musi zawierać minimum 4 zdjęcia';
         }
         return true;
       }),
   });
   ```

6. **Review References Array**
   ```typescript
   defineField({
     name: 'featuredReviews',
     title: 'Wyróżnione recenzje',
     type: 'array',
     description: 'Wybierz recenzje związane z tą marką (maksymalnie 10)',
     group: GROUP.MAIN_CONTENT,
     of: [
       {
         type: 'reference',
         to: [{ type: 'review' }],
       },
     ],
     validation: (Rule) => Rule.max(10).error('Maksymalnie 10 recenzji'),
   });
   ```

**Implementation Details**:

- Keep existing fields: `orderRankField`, `slug`, `name`, `logo`
- The `name` field (from `defineSlugForDocument`) will be used as the hero title
- Update the `description` field to be used in the hero section (shown under name)
- Add all new fields after the logo field
- Keep existing SEO fields
- Update preview to use name as title

---

## Phase 2: Create Reusable UI Components

### Step 2.1: Create BrandStickyNav Component

**Location**: `apps/web/src/components/ui/BrandStickyNav/`

**Purpose**: Sticky navigation with pills that appear below the hero and stick below the Header

**Features**:

- Sticky positioning (sticks below Header when scrolling)
- Pills for: Produkty, O marce, Galeria (conditional), Recenzje (conditional), Gdzie kupić
- Smooth scroll to section on click
- Active state indicator for current section
- Responsive design for mobile

**TypeScript Interface**:

```typescript
export interface BrandStickyNavProps {
  sections: {
    id: string;
    label: string;
    visible: boolean;
  }[];
  activeSection?: string;
}
```

**SCSS Structure** (following repo guidelines):

```scss
.brandStickyNav {
  // Sticky positioning
  // Background with backdrop blur
  // Padding and layout

  .container {
    // Max-width container

    .pillsWrapper {
      // Pills container with scroll on mobile

      .pill {
        // Individual pill styling

        &.active {
          // Active state
        }

        &:hover {
          // Hover state
        }

        &:focus-visible {
          // Focus state for accessibility
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile overrides

    .container {
      // Mobile container

      .pillsWrapper {
        // Horizontal scroll on mobile

        .pill {
          // Mobile pill sizing
        }
      }
    }
  }
}
```

**Key Implementation Notes**:

- Use `position: sticky` with `top` value equal to Header height
- Use Intersection Observer API to detect active section
- Conditionally render pills based on data availability
- Use `scroll-behavior: smooth` for navigation
- Z-index: 100 (below modals, above content)

---

### Step 2.2: Create BrandContent Component

**Location**: `apps/web/src/components/ui/BrandContent/`

**Purpose**: Two-column layout section displaying brand story and images

**Features**:

- Two-column responsive layout
- Renders portable text content
- Supports images within content
- Gray background (#F8F8F8)
- Vertical divider between columns on desktop

**TypeScript Interface**:

```typescript
export interface BrandContentProps {
  content: PortableTextBlock[];
  heading?: string;
}
```

**SCSS Structure**:

```scss
.brandContent {
  // Gray background container
  // Padding and border-radius

  .heading {
    // Main heading styles
  }

  .contentWrapper {
    // Two-column grid layout

    .column {
      // Individual column styles

      .section {
        // Section within column

        .sectionTitle {
          // Section title with icon
        }

        .text {
          // Text content
        }

        .image {
          // Image styling
        }
      }
    }

    .divider {
      // Vertical divider between columns (desktop only)
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Stack columns vertically

    .contentWrapper {
      // Single column layout

      .divider {
        // Hide divider on mobile
      }
    }
  }
}
```

**Key Implementation Notes**:

- Use CSS Grid for two-column layout (`grid-template-columns: 1fr auto 1fr`)
- Parse and render portable text with custom components
- Support for images with proper aspect ratios
- Responsive: stack columns on mobile
- Background: `var(--neutral-200)` (#F8F8F8)
- Border radius: 8px

---

### Step 2.3: Create DistributionYearBadge Component

**Location**: `apps/web/src/components/ui/DistributionYearBadge/`

**Purpose**: Display year AudioFast started distributing the brand

**Features**:

- Background image with gradient overlay
- Centered text with year
- Responsive sizing

**TypeScript Interface**:

```typescript
export interface DistributionYearBadgeProps {
  year: number;
  backgroundImage?: string;
}
```

**SCSS Structure**:

```scss
.distributionYearBadge {
  // Background image container
  // Padding and border-radius
  // Position relative for overlay

  .backgroundImage {
    // Absolute positioned background
  }

  .overlay {
    // Gradient overlay
  }

  .content {
    // Centered content

    .text {
      // Year text styling
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Adjust padding and font sizes

    .content {
      .text {
        // Smaller text on mobile
      }
    }
  }
}
```

**Key Implementation Notes**:

- Text: "Jesteśmy oficjalnym dystrybutorem tej marki od {year} roku."
- Gradient: `linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)`
- Position within BrandContent section as a nested element

---

### Step 2.4: Create StoreLocations Component

**Location**: `apps/web/src/components/ui/StoreLocations/`

**Purpose**: Display store locations that carry the brand

**Features**:

- Map on left side
- Store list on right side
- Each store shows: name, address, phone, website
- Gray background container
- Responsive: stack map above list on mobile

**TypeScript Interface**:

```typescript
export interface Store {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface StoreLocationsProps {
  stores?: Store[];
}
```

**SCSS Structure**:

```scss
.storeLocations {
  // Outer container

  .container {
    // Gray background container
    // Two-column layout (map + stores)

    .mapContainer {
      // Map wrapper

      .map {
        // Map styling
      }
    }

    .storesContainer {
      // Stores list wrapper

      .heading {
        // "Gdzie kupić" heading
      }

      .storesList {
        // List of stores

        .store {
          // Individual store item
          // Border bottom

          .storeInfo {
            // Name and address

            .storeName {
              // Store name
            }

            .storeAddress {
              // Store address
            }
          }

          .storeContact {
            // Phone and website

            .contactItem {
              // Individual contact item

              .icon {
                // Phone/website icon
              }

              .contactText {
                // Contact text
              }
            }
          }
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Stack map above stores

    .container {
      // Single column layout

      .mapContainer {
        // Full width map
      }

      .storesContainer {
        // Full width stores list
      }
    }
  }
}
```

**Key Implementation Notes**:

- Use dummy text and placeholder data for now
- Gray background: `var(--neutral-200)` (#F8F8F8)
- Border radius: 8px
- Gap between map and stores: 32px
- No Sanity fields needed yet (as per requirements)
- Map placeholder: Use a static image or `<div>` with background color

---

## Phase 3: Update Product Listing Component

### Step 3.1: Modify ProductListing to Support Brand Context

**Location**: `apps/web/src/components/ui/ProductListing/` (assuming this exists)

**Objective**: Update the product listing to work on brand pages

**Changes Required**:

1. **Update Props Interface**:

```typescript
export interface ProductListingProps {
  // ... existing props
  brandSlug?: string; // Add brand context
  hideBrandFilter?: boolean; // Hide brand filter when on brand page
}
```

2. **Update Filter Sidebar**:
   - Keep: Categories filter
   - Keep: Price range filter
   - Remove: Brand filter (when `hideBrandFilter` is true)

3. **Update Query Logic**:
   - Filter products by `brandSlug` when provided
   - Pass `brandSlug` to the products API/query

4. **SCSS Updates**:

```scss
.productListing {
  // Existing styles

  .sidebar {
    // Existing sidebar styles

    .brandFilter {
      // Hide when on brand page

      &.hidden {
        display: none;
      }
    }
  }
}
```

---

## Phase 4: Create Brand Page Route

### Step 4.1: Create Dynamic Route File

**Location**: `apps/web/src/app/marki/[slug]/page.tsx`

**Objective**: Main page component for brand detail

**Page Structure**:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HeroStatic } from '@/components/pageBuilder/HeroStatic';
import { FeaturedPublications } from '@/components/pageBuilder/FeaturedPublications';
import { ProductGallery } from '@/components/ui/ProductGallery';
import { BrandStickyNav } from '@/components/ui/BrandStickyNav';
import { BrandContent } from '@/components/ui/BrandContent';
import { DistributionYearBadge } from '@/components/ui/DistributionYearBadge';
import { StoreLocations } from '@/components/ui/StoreLocations';
import { ProductListing } from '@/components/ui/ProductListing';

// Import Sanity query functions
import { getBrandBySlug } from '@/sanity/queries/brands';

interface BrandPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const brand = await getBrandBySlug(params.slug);

  if (!brand) {
    return {
      title: 'Marka nie znaleziona',
    };
  }

  return {
    title: brand.seo?.title || brand.name,
    description: brand.seo?.description,
    // ... other SEO fields
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const brand = await getBrandBySlug(params.slug);

  if (!brand) {
    notFound();
  }

  // Determine which sections are visible
  const sections = [
    { id: 'produkty', label: 'Produkty', visible: true },
    { id: 'o-marce', label: 'O marce', visible: !!brand.brandStory },
    {
      id: 'galeria',
      label: 'Galeria',
      visible: !!brand.imageGallery && brand.imageGallery.length >= 4
    },
    {
      id: 'recenzje',
      label: 'Recenzje',
      visible: !!brand.featuredReviews && brand.featuredReviews.length > 0
    },
    { id: 'gdzie-kupic', label: 'Gdzie kupić', visible: true },
  ].filter(section => section.visible);

  return (
    <>
      {/* Hero Section */}
      <HeroStatic
        title={brand.name}
        description={brand.description}
        backgroundImage={brand.heroImage}
        breadcrumbs={[
          { label: 'Strona główna', href: '/' },
          { label: 'Nasze marki', href: '/marki' },
          { label: brand.name, href: `/marki/${brand.slug.current}` },
        ]}
      />

      {/* Sticky Navigation */}
      <BrandStickyNav sections={sections} />

      {/* Products Section */}
      <section id="produkty">
        <ProductListing
          brandSlug={brand.slug.current}
          hideBrandFilter={true}
        />
      </section>

      {/* Banner Image */}
      {brand.bannerImage && (
        <section>
          <Image
            src={brand.bannerImage}
            alt={brand.name}
            width={2280}
            height={813}
            className="w-full rounded-lg"
          />
        </section>
      )}

      {/* Brand Story Section */}
      {brand.brandStory && (
        <section id="o-marce">
          <BrandContent
            content={brand.brandStory}
            heading={`O ${brand.name}`}
          />

          {/* Distribution Year Badge (inside BrandContent) */}
          {brand.distributionStartYear && (
            <DistributionYearBadge
              year={brand.distributionStartYear}
            />
          )}
        </section>
      )}

      {/* Image Gallery Section */}
      {brand.imageGallery && brand.imageGallery.length >= 4 && (
        <section id="galeria">
          <ProductGallery images={brand.imageGallery} />
        </section>
      )}

      {/* Reviews Section */}
      {brand.featuredReviews && brand.featuredReviews.length > 0 && (
        <section id="recenzje">
          <FeaturedPublications publications={brand.featuredReviews} />
        </section>
      )}

      {/* Store Locations Section */}
      <section id="gdzie-kupic">
        <StoreLocations />
      </section>
    </>
  );
}
```

---

## Phase 5: Create Sanity Queries

### Step 5.1: Create Brand Queries File

**Location**: `apps/web/src/sanity/queries/brands.ts`

**Objective**: GROQ queries for fetching brand data

```typescript
import { groq } from 'next-sanity';
import { sanityFetch } from '@/sanity/lib/client';

// Brand detail query
const brandDetailQuery = groq`
  *[_type == "brand" && slug.current == $slug][0] {
    _id,
    name,
    slug,
    logo,
    description,
    heroImage,
    bannerImage,
    distributionStartYear,
    brandStory,
    imageGallery[] {
      _key,
      asset->{
        _id,
        url,
        metadata {
          dimensions
        }
      }
    },
    featuredReviews[]->{
      _id,
      name,
      slug,
      title,
      description,
      image {
        asset->{
          _id,
          url,
          metadata {
            dimensions
          }
        }
      },
      author->{
        _id,
        name,
        image {
          asset->{
            _id,
            url
          }
        }
      }
    },
    seo {
      title,
      description,
      ogImage {
        asset->{
          _id,
          url
        }
      }
    }
  }
`;

export async function getBrandBySlug(slug: string) {
  return await sanityFetch({
    query: brandDetailQuery,
    params: { slug },
  });
}

// Get all brand slugs for static generation
const allBrandSlugsQuery = groq`
  *[_type == "brand" && defined(slug.current)] {
    "slug": slug.current
  }
`;

export async function getAllBrandSlugs() {
  return await sanityFetch({
    query: allBrandSlugsQuery,
  });
}
```

---

## Phase 6: Styling Implementation

### Step 6.1: BrandStickyNav Styles

**File**: `apps/web/src/components/ui/BrandStickyNav/styles.module.scss`

```scss
.brandStickyNav {
  position: sticky;
  top: 4.75rem; // Header height (76px)
  z-index: 100;
  padding: 1rem 2rem 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(0.625rem);
  transition: box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &.scrolled {
    box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.05);
  }

  .container {
    max-width: 80rem;
    margin: 0 auto;

    .pillsWrapper {
      display: flex;
      gap: 0.125rem;
      padding: 0.125rem;
      background: var(--neutral-200);
      border-radius: 31.25rem;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        display: none;
      }

      .pill {
        flex: 1;
        min-width: max-content;
        padding: 0.5rem 2rem;
        background: transparent;
        border: none;
        border-radius: 31.25rem;
        font-family: 'Poppins', sans-serif;
        font-size: 0.875rem;
        font-weight: 400;
        line-height: 1.5;
        letter-spacing: -0.02625rem;
        color: var(--neutral-black);
        text-align: center;
        cursor: pointer;
        transition:
          background-color 250ms cubic-bezier(0.4, 0, 0.2, 1),
          color 250ms cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        &:focus-visible {
          outline: 0.125rem solid var(--primary-red);
          outline-offset: 0.125rem;
        }

        &.active {
          background: var(--neutral-700);
          color: var(--neutral-200);
          border: 0.0625rem solid var(--primary-red);
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    top: 3.75rem; // Adjusted for mobile header
    padding: 0.75rem 1rem 0;

    .container {
      .pillsWrapper {
        gap: 0.5rem;
        padding: 0;
        background: transparent;

        .pill {
          flex: none;
          padding: 0.5rem 1.5rem;
          background: var(--neutral-200);
          font-size: 0.8125rem;

          &:hover {
            background: var(--neutral-300);
          }

          &.active {
            background: var(--neutral-700);
          }
        }
      }
    }
  }
}
```

---

### Step 6.2: BrandContent Styles

**File**: `apps/web/src/components/ui/BrandContent/styles.module.scss`

```scss
.brandContent {
  padding: 0 2rem;

  .container {
    background: var(--neutral-200);
    border-radius: 0.5rem;
    padding: 2rem;
    overflow: hidden;

    .heading {
      font-family: 'Switzer Variable', sans-serif;
      font-size: 1.5rem;
      font-weight: 500;
      line-height: 1.16;
      letter-spacing: -0.045rem;
      color: var(--neutral-700);
      margin-bottom: 2rem;
      text-align: center;
    }

    .contentWrapper {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 2rem;
      align-items: start;

      .column {
        display: flex;
        flex-direction: column;
        gap: 3rem;

        .section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;

          .sectionTitle {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-family: 'Poppins', sans-serif;
            font-size: 1.125rem;
            font-weight: 400;
            line-height: 1.16;
            color: var(--neutral-black);

            .icon {
              width: 2.0975rem;
              height: 2.0975rem;
            }
          }

          .text {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            font-family: 'Poppins', sans-serif;
            font-size: 0.875rem;
            font-weight: 300;
            line-height: 1.5;
            color: var(--neutral-600);

            strong {
              font-weight: 400;
              color: var(--neutral-black);
            }

            a {
              color: var(--neutral-600);
              text-decoration: underline;
              transition: color 250ms cubic-bezier(0.4, 0, 0.2, 1);

              &:hover {
                color: var(--primary-red);
              }
            }
          }

          .image {
            width: 100%;
            aspect-ratio: 605 / 340;
            border-radius: 0.5rem;
            overflow: hidden;
            background: var(--neutral-200);

            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
          }
        }
      }

      .divider {
        width: 0.0625rem;
        height: 100%;
        background: var(--neutral-400);
        transform: rotate(90deg);
        transform-origin: center;
      }
    }
  }

  @media (max-width: 56.1875rem) {
    padding: 0 1rem;

    .container {
      padding: 1.5rem 1rem;

      .heading {
        font-size: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .contentWrapper {
        grid-template-columns: 1fr;
        gap: 2rem;

        .column {
          gap: 2rem;

          .section {
            gap: 1rem;

            .sectionTitle {
              font-size: 1rem;
            }

            .text {
              font-size: 0.8125rem;
            }
          }
        }

        .divider {
          display: none;
        }
      }
    }
  }
}
```

---

### Step 6.3: DistributionYearBadge Styles

**File**: `apps/web/src/components/ui/DistributionYearBadge/styles.module.scss`

```scss
.distributionYearBadge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 2rem 3.5rem 2rem 2rem;
  border-radius: 0.5rem;
  overflow: hidden;
  margin-top: 2rem;

  .backgroundImage {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.85) 0%,
      rgba(0, 0, 0, 0) 100%
    );
    z-index: 1;
    border-radius: 0.5rem;
  }

  .content {
    position: relative;
    z-index: 2;
    flex: 1;

    .text {
      font-family: 'Switzer Variable', sans-serif;
      font-size: 1.5rem;
      font-weight: 500;
      line-height: 1.16;
      letter-spacing: -0.045rem;
      color: var(--neutral-white);
      text-align: center;
      max-width: 50%;
    }
  }

  @media (max-width: 56.1875rem) {
    padding: 1.5rem 2rem;
    margin-top: 1.5rem;

    .content {
      .text {
        font-size: 1.125rem;
        max-width: 100%;
      }
    }
  }
}
```

---

### Step 6.4: StoreLocations Styles

**File**: `apps/web/src/components/ui/StoreLocations/styles.module.scss`

```scss
.storeLocations {
  padding: 0 2rem;

  .container {
    display: flex;
    gap: 3rem;
    background: var(--neutral-200);
    padding: 1rem;
    border-radius: 0.5rem;

    .mapContainer {
      flex: 1;
      border-radius: 0.5rem;
      overflow: hidden;
      background: var(--neutral-300);

      .map {
        width: 100%;
        height: 100%;
        min-height: 20rem;
        object-fit: cover;
      }
    }

    .storesContainer {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;

      .heading {
        font-family: 'Switzer Variable', sans-serif;
        font-size: 1.5rem;
        font-weight: 500;
        line-height: 1.16;
        letter-spacing: -0.045rem;
        color: var(--neutral-700);
      }

      .storesList {
        display: flex;
        flex-direction: column;

        .store {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          border-bottom: 0.0625rem solid var(--neutral-400);

          &:last-child {
            border-bottom: none;
          }

          .storeInfo {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;

            .storeName {
              font-family: 'Poppins', sans-serif;
              font-size: 0.875rem;
              font-weight: 400;
              line-height: 1.5;
              letter-spacing: -0.02625rem;
              color: var(--neutral-black);
            }

            .storeAddress {
              font-family: 'Poppins', sans-serif;
              font-size: 0.875rem;
              font-weight: 300;
              line-height: 1.5;
              color: var(--neutral-600);
            }
          }

          .storeContact {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-end;

            .contactItem {
              display: flex;
              align-items: center;
              gap: 0.5rem;

              .icon {
                width: 1.25rem;
                height: 1.25rem;
                padding: 0.125rem;
                background: rgba(197, 78, 71, 0.25);
                border-radius: 26.0417rem;
                display: flex;
                align-items: center;
                justify-content: center;

                svg {
                  width: 0.875rem;
                  height: 0.875rem;
                  stroke: var(--primary-red);
                }
              }

              .contactText {
                font-family: 'Poppins', sans-serif;
                font-size: 0.875rem;
                font-weight: 300;
                line-height: 1.5;
                color: var(--neutral-600);
              }
            }
          }
        }
      }
    }
  }

  @media (max-width: 56.1875rem) {
    padding: 0 1rem;

    .container {
      flex-direction: column;
      gap: 1.5rem;
      padding: 0.75rem;

      .mapContainer {
        .map {
          min-height: 15rem;
        }
      }

      .storesContainer {
        .heading {
          font-size: 1.25rem;
        }

        .storesList {
          .store {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;

            .storeContact {
              align-items: flex-start;
              width: 100%;
            }
          }
        }
      }
    }
  }
}
```

---

## Phase 7: Integration and Testing

### Step 7.1: Update HeroStatic Component

**Location**: `apps/web/src/components/pageBuilder/HeroStatic/index.tsx`

**Changes**: Ensure HeroStatic supports breadcrumbs and can render portable text for title

**Verification**:

- [ ] Hero displays brand name correctly (as title)
- [ ] Hero displays brand description correctly
- [ ] Hero displays background image correctly
- [ ] Breadcrumbs show: Home → Nasze marki → Brand Name

---

### Step 7.2: Test Product Listing Integration

**Verification**:

- [ ] Products are filtered by brand slug
- [ ] Brand filter is hidden in sidebar
- [ ] Category filter works correctly
- [ ] Price range filter works correctly
- [ ] Product cards display correctly

---

### Step 7.3: Test Sticky Navigation

**Verification**:

- [ ] Navigation sticks below Header when scrolling
- [ ] Pills only show for available sections
- [ ] Clicking a pill scrolls to the correct section
- [ ] Active pill updates based on scroll position
- [ ] Smooth scrolling works
- [ ] Mobile: Horizontal scroll works for pills

---

### Step 7.4: Test Brand Content Section

**Verification**:

- [ ] Two-column layout displays correctly on desktop
- [ ] Vertical divider appears between columns
- [ ] Portable text renders correctly
- [ ] Images display with proper aspect ratio
- [ ] Section titles with icons display correctly
- [ ] Links are styled and functional
- [ ] Mobile: Columns stack vertically

---

### Step 7.5: Test Distribution Year Badge

**Verification**:

- [ ] Badge displays within BrandContent section
- [ ] Background image loads correctly
- [ ] Gradient overlay is visible
- [ ] Year text is centered and readable
- [ ] Mobile: Text adjusts size appropriately

---

### Step 7.6: Test Image Gallery

**Verification**:

- [ ] Gallery only shows when 4+ images are present
- [ ] ProductGallery component renders correctly
- [ ] Images are clickable and open in lightbox
- [ ] Thumbnails display below main image
- [ ] Navigation arrows work
- [ ] Mobile: Gallery is responsive

---

### Step 7.7: Test Featured Reviews

**Verification**:

- [ ] Reviews section only shows when reviews exist
- [ ] FeaturedPublications component renders correctly
- [ ] Review cards display correctly
- [ ] Carousel navigation works
- [ ] Links to review detail pages work
- [ ] Mobile: Carousel is swipeable

---

### Step 7.8: Test Store Locations

**Verification**:

- [ ] Map placeholder displays correctly
- [ ] Store list displays with dummy data
- [ ] Store information is formatted correctly
- [ ] Icons display next to contact info
- [ ] Mobile: Map and stores stack vertically

---

## Phase 8: Accessibility and Performance

### Step 8.1: Accessibility Checklist

- [ ] All interactive elements have focus states
- [ ] Sticky navigation is keyboard navigable
- [ ] Images have alt text
- [ ] Headings follow proper hierarchy (h1 → h2 → h3)
- [ ] ARIA labels for navigation
- [ ] Color contrast meets WCAG AA standards
- [ ] Skip to content link available

### Step 8.2: Performance Optimizations

- [ ] Images are optimized and lazy-loaded
- [ ] Use Next.js Image component for all images
- [ ] Implement proper image sizing and srcset
- [ ] Minimize layout shift (CLS)
- [ ] Optimize font loading
- [ ] Code splitting for components
- [ ] Minimize JavaScript bundle size

### Step 8.3: SEO Checklist

- [ ] Dynamic metadata generation works
- [ ] OG images are set
- [ ] Structured data for brand page
- [ ] Canonical URL is set
- [ ] Breadcrumb structured data
- [ ] Proper heading hierarchy

---

## Phase 9: Edge Cases and Validation

### Step 9.1: Handle Missing Data

**Scenarios to Test**:

- [ ] Brand has no hero image → Show placeholder or color
- [ ] Brand has no banner image → Hide banner section
- [ ] Brand has no brand story → Hide "O marce" section
- [ ] Brand has no image gallery → Hide gallery section
- [ ] Brand has no reviews → Hide reviews section
- [ ] Brand has no distribution year → Hide year badge
- [ ] Brand has < 4 gallery images → Don't show gallery

### Step 9.2: Validate Sanity Data

**Studio Validation**:

- [ ] Required fields are enforced
- [ ] Gallery has minimum 4 images (if present)
- [ ] Distribution year is between 1900 and current year
- [ ] Review references max 10 items
- [ ] All required portable text fields have content

---

## Phase 10: Documentation and Deployment

### Step 10.1: Update README

**Document**:

- Brand page structure
- Component usage
- Sanity schema changes
- Query patterns
- Styling conventions

### Step 10.2: Create Component Documentation

**For Each New Component**:

- Purpose and usage
- Props interface
- Example usage
- Styling guidelines
- Accessibility notes

### Step 10.3: Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] All linter errors resolved
- [ ] All SCSS follows repository guidelines
- [ ] All tests passing
- [ ] Sanity Studio changes deployed
- [ ] Environment variables configured
- [ ] Image CDN configured
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed

---

## Technical Notes

### Sticky Navigation Implementation

Use Intersection Observer to track section visibility:

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    },
    {
      rootMargin: '-100px 0px -80% 0px',
    }
  );

  sections.forEach((section) => {
    const element = document.getElementById(section.id);
    if (element) {
      observer.observe(element);
    }
  });

  return () => observer.disconnect();
}, [sections]);
```

### Smooth Scroll Implementation

```typescript
const handlePillClick = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    const headerHeight = 76; // Header height
    const navHeight = 96; // Sticky nav height
    const offset = headerHeight + navHeight;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
};
```

### Two-Column Content Parser

Parse portable text and split into two columns:

```typescript
const splitContentIntoColumns = (content: PortableTextBlock[]) => {
  const midpoint = Math.ceil(content.length / 2);
  return {
    leftColumn: content.slice(0, midpoint),
    rightColumn: content.slice(midpoint),
  };
};
```

---

## Summary

This implementation plan provides a comprehensive, step-by-step guide for creating a brand detail page with:

1. **Sanity Schema**: Updated brand schema with all necessary fields
2. **Reusable Components**: BrandStickyNav, BrandContent, DistributionYearBadge, StoreLocations
3. **Integration**: Product listing, image gallery, featured reviews
4. **Navigation**: Sticky navigation with conditional pills
5. **Styling**: Complete SCSS following repository guidelines
6. **Accessibility**: Focus states, keyboard navigation, ARIA labels
7. **Performance**: Image optimization, lazy loading, code splitting
8. **Testing**: Comprehensive test scenarios and edge cases

The implementation follows Next.js best practices, repository styling guidelines, and ensures a maintainable, scalable solution.

---

## Estimated Timeline

- **Phase 1** (Sanity Schema): 2-3 hours
- **Phase 2** (UI Components): 8-10 hours
- **Phase 3** (Product Listing): 2-3 hours
- **Phase 4** (Page Route): 2-3 hours
- **Phase 5** (Sanity Queries): 1-2 hours
- **Phase 6** (Styling): 6-8 hours
- **Phase 7** (Integration & Testing): 4-6 hours
- **Phase 8** (Accessibility & Performance): 3-4 hours
- **Phase 9** (Edge Cases): 2-3 hours
- **Phase 10** (Documentation): 2-3 hours

**Total Estimated Time**: 32-45 hours

---

## Next Steps

1. Review and approve this implementation plan
2. Begin with Phase 1 (Sanity schema updates)
3. Create UI components in Phase 2
4. Integrate and test each component progressively
5. Deploy to staging for final review
6. Deploy to production

---

_This document will be updated as implementation progresses._
