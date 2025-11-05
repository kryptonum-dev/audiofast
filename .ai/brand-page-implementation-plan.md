# Brand Detail Page Implementation Plan

## Recent Progress (Completed)

### Completed Tasks - TwoColumnContent & Portable Text Components

**Date:** November 5, 2025

#### 1. ✅ Updated `ptHeading` Portable Text Component

- **File:** `apps/studio/schemaTypes/portableText/heading.ts`
- Removed `iconPicker` field entirely
- Added new `image` field (type: `image`) that accepts only SVG files (`.svg`)
- Made the icon field required with validation
- Updated title and description to reflect it's a "Heading with SVG icon"
- **Component:** `apps/web/src/components/portableText/Heading/index.tsx`
  - Converted from client component to **async server component**
  - Removed `'use client'` directive, `useState`, and `useEffect`
  - Implemented server-side SVG fetching using `svgToInlineString` utility
  - Updated type definitions to match new icon structure
  - Improved performance by eliminating client-side hydration for SVG icons

#### 2. ✅ Enhanced Brand Schema with Portable Text Features

- **File:** `apps/studio/schemaTypes/documents/collections/brand.ts`
- Added `h3` and `h4` heading styles to `brandDescription` portable text
- Created new `brandDescriptionHeading` field:
  - Portable text field placed above `brandDescription`
  - Supports only `strong` decorator (bold text)
  - Acts as a heading/introduction for the two-column content
- Updated `distributionStartYear` → `distributionYear` object structure:
  - Changed from simple number field to object containing:
    - `year` (number): The distribution start year
    - `backgroundImage` (image): Background image for the year badge
  - Implemented mutual validation:
    - If `year` is set, `backgroundImage` must be set
    - If `backgroundImage` is set, `year` must be set
    - Both fields are optional together, but required when one is present
  - Added descriptive Polish labels and descriptions

#### 3. ✅ Created `ptMinimalImage` Portable Text Component

- **Schema:** `apps/studio/schemaTypes/portableText/minimal-image.ts`
  - New portable text component with single `image` field
  - No caption or layout options (simpler alternative to `ptImage`)
  - Required image field with validation
  - Polish labels: "Minimalny obraz"
- **Component:** `apps/web/src/components/portableText/MinimalImage/index.tsx`
  - Server component that renders single image
  - Uses shared `Image` component with proper sizing
  - Responsive sizing with custom `sizes` prop
  - Lazy loading enabled for performance
- **Styles:** `apps/web/src/components/portableText/MinimalImage/styles.module.scss`
  - Rounded corners (0.5rem border-radius)
  - Responsive margin using `clamp()`
  - Max-height constraint for better layout
  - Full width responsive design
- Registered in `ALL_CUSTOM_COMPONENTS` and schema exports
- Added to `brandDescription` portable text in brand schema
- Integrated into main PortableText renderer

#### 4. ✅ Updated TwoColumnContent Component

- **File:** `apps/web/src/components/ui/TwoColumnContent/index.tsx`
- Removed separate `distributionYearBackgroundImage` prop
- Updated `distributionYear` prop to accept full object with `year` and `backgroundImage`
- Moved DistributionYearBadge JSX directly inline (no separate component file)
- Simplified type definitions using `QueryBrandBySlugResult` type
- Updated component to properly handle nullable `distributionYear` fields
- **Styles:** `apps/web/src/components/ui/TwoColumnContent/styles.module.scss`
  - Integrated distribution year badge styles directly into this file
  - Added `.distributionYearBadge`, `.backgroundImage`, `.overlay`, `.badgeContent`, `.badgeText` classes
  - Properly nested styles following repository SCSS guidelines
  - Responsive styles for mobile (adjusted padding, font sizes)

#### 5. ✅ Updated GROQ Queries and Types

- **File:** `apps/web/src/global/sanity/query.ts`
- Updated `portableTextFragmentExtended` to include `ptMinimalImage`
- Updated `ptHeading` fragment to project:
  - `level` (h3 or h4)
  - `icon` (using `imageFragment` for proper asset projection)
  - `text` (using `portableTextFragment`)
- Added `brandDescriptionHeading` to `queryBrandBySlug`
- Updated `distributionYear` query to fetch object with:
  - `year` (number)
  - `backgroundImage` (using `imageFragment`)
- **Ran typegen** to update TypeScript types in `sanity.types.ts`

#### 6. ✅ Updated Brand Page Implementation

- **File:** `apps/web/src/app/marki/[slug]/page.tsx`
- Simplified `TwoColumnContent` props passing
- Removed complex conditional logic for `distributionYear` construction
- Now passes `brand.distributionYear` object directly from query
- Removed unnecessary type casting and null checks (handled at component level)
- Cleaner, more maintainable code structure

#### 7. ✅ Code Quality & Best Practices

- Fixed all linter errors (import sorting, formatting)
- Resolved TypeScript type errors with proper type definitions
- Converted client component to server component for better performance
- Followed repository SCSS guidelines (nesting, rem units, responsive design)
- Implemented proper null handling and optional chaining
- Used semantic HTML and accessible markup

### Technical Improvements

- **Performance**: SVG icons now render server-side (zero client JS for icons)
- **Type Safety**: Stronger type definitions using generated types from queries
- **Maintainability**: Simplified component structure and prop passing
- **Validation**: Mutual field validation ensures data consistency in Sanity
- **Flexibility**: New minimal image component provides simpler content option

---

### Completed Tasks - Featured Reviews & Carousel Optimization

**Date:** November 5, 2025

#### 8. ✅ CSS Media Query Fix for TwoColumnContent

- **Issue:** Global media query from `global.scss` was overriding component-specific media query
- **Root Cause:** Equal CSS specificity with global styles loading after component styles
- **Solution:** Understood cascade order - global styles always override module styles when specificity is equal
- **Learning:** Increased specificity within CSS modules using `&.className` pattern when needed

#### 9. ✅ Created `stringToPortableText` Utility Function

- **File:** `apps/web/src/global/utils.ts`
- **Purpose:** Convert plain strings to PortableText block structure
- **Function Signature:** `stringToPortableText(text: string, style?: string): PortableTextProps`
- **Features:**
  - Accepts plain text string and optional style parameter
  - Returns properly formatted PortableText block array
  - Includes all required PortableText properties (`_type`, `_key`, `children`, `style`, etc.)
  - Default style: `'normal'`
- **Usage:** Simplifies PortableText creation for headings and simple text blocks

#### 10. ✅ Updated Brand Page with Utility Function

- **File:** `apps/web/src/app/marki/[slug]/page.tsx`
- **Changes:**
  - Imported `stringToPortableText` utility
  - Replaced manual PortableText array creation with utility function
  - Applied to `HeroStatic` heading: `stringToPortableText(brand.name || '')`
  - Applied to `FeaturedPublications` heading: `stringToPortableText('Recenzje Marki')`
  - Added type assertions (`as any`) to resolve strict type compatibility issues
  - Explicitly defined `button` properties for `FeaturedPublications` component
- **Type Handling:** Used type assertions to bypass strict component prop types when needed

#### 11. ✅ Enhanced Brand Schema - Featured Reviews Filtering

- **File:** `apps/studio/schemaTypes/documents/collections/brand.ts`
- **Feature:** Smart filtering for `featuredReviews` array field
- **Implementation:**
  - Added dynamic GROQ filter to show only reviews of products belonging to the current brand
  - Filter query: `_id in *[_type == "product" && brand._ref == $brandId].reviews[]._ref`
  - Handles draft document IDs properly (strips `drafts.` prefix)
  - Returns empty results if brand ID is not available
- **UX Improvement:** Content editors only see relevant reviews for their brand

#### 12. ✅ Prevented Duplicate Review Selection

- **File:** `apps/studio/schemaTypes/documents/collections/brand.ts`
- **Feature:** Unique review selection in `featuredReviews` array
- **Implementation:**
  - Extract already selected review IDs from `featuredReviews` array
  - Add `!(_id in $selectedIds)` condition to GROQ filter
  - Pass `selectedIds` array as query parameter
  - Combines with brand filter: must be from brand's products AND not already selected
- **UX Improvement:** Selected reviews immediately disappear from dropdown, preventing duplicates

#### 13. ✅ Created 10 Dummy Reviews for PrimaLuna Brand

- **Tool:** Sanity MCP Server (`create_document`, `update_document`, `publish_document`)
- **Process:**
  1. Queried existing PrimaLuna products to link reviews properly
  2. Created 10 review documents with:
     - Product references to PrimaLuna products (unique distribution)
     - Authors from existing author documents
     - Images from existing review images
     - Proper slugs (`primaluna-{product-name}-review`)
     - SEO fields (title and description)
  3. Generated detailed review content using AI-powered `update_document` tool
  4. Published all 10 reviews to make them live
- **Products Covered:** EVO 400 Power, Dialog Floor, ProLogue Classic, EVO 100 Tube, EVO 300, etc.
- **Content Quality:** Each review includes detailed analysis, technical specifications, and user insights

#### 14. ✅ Optimized FeaturedPublications Carousel

- **File:** `apps/web/src/components/pageBuilder/FeaturedPublications/PublicationsCarousel.tsx`
- **Problem:** Carousel was always active even when content fit within container
- **Solution - Manual Overflow Detection:**
  - Added `viewportRef` and `containerRef` to measure DOM elements
  - Implemented `checkOverflow()` function comparing viewport width vs container scroll width
  - Sets `canScroll` state based on actual overflow detection
  - Passes `watchDrag: canScroll` directly to `useEmblaCarousel` options
  - Conditionally assigns Embla ref only when carousel is needed
- **Dynamic Viewport Handling:**
  - Added resize event listener to recalculate overflow on viewport changes
  - Carousel dynamically enables/disables as viewport size changes
  - Smooth transition between desktop (no overflow) and mobile (overflow)
- **Performance Fix:**
  - Removed `api.reInit()` calls that caused infinite loop
  - Separated overflow detection from carousel button state management
  - Proper cleanup with `emblaApi.off()` event listeners

#### 15. ✅ Fixed Carousel Wrapping Issue

- **File:** `apps/web/src/components/pageBuilder/FeaturedPublications/styles.module.scss`
- **Problem:** Publications were wrapping to next row instead of overflowing
- **Root Cause:** `flex-wrap: wrap` in disabled carousel state
- **Solution:** Removed `flex-wrap: wrap` from `&[data-carousel-enabled='false']` state
- **Result:** Container now always stays in single row, allowing proper overflow detection

#### 16. ✅ Smart Publication Duplication for Smooth Carousel

- **File:** `apps/web/src/components/pageBuilder/FeaturedPublications/PublicationsCarousel.tsx`
- **Feature:** Duplicate items when there are 4 or 5 publications for smoother looping
- **Logic:**
  ```typescript
  const displayPublications = (() => {
    const count = publications?.length || 0;
    if (count === 4 || count === 5) {
      return [...publications!, ...publications!];
    }
    return publications!;
  })();
  ```
- **Behavior:**
  - 3 or fewer publications: No duplication
  - 4 or 5 publications: Duplicate array (8 or 10 items total)
  - 6 or more publications: No duplication
- **UX Improvement:** Smoother infinite loop experience with mid-range item counts

#### 17. ✅ Added Layout Prop to PublicationsCarousel

- **File:** `apps/web/src/components/pageBuilder/FeaturedPublications/PublicationsCarousel.tsx`
- **Change:** Added optional `publicationLayout` prop
- **Type:** `'vertical' | 'horizontal'` (defaults to `'horizontal'`)
- **Purpose:** Allow flexible card layout for different page contexts
- **Usage:** Props pass through to `PublicationCard` component's `layout` prop

### Key Technical Decisions

1. **Type Assertions vs Strict Types:**
   - Used `as any` assertions for PortableText compatibility issues
   - Acknowledged technical debt for future type definition improvements
   - Prioritized functionality over perfect type safety in this iteration

2. **Manual vs API-Based Overflow Detection:**
   - Chose manual DOM measurement over Embla's `canScrollPrev/Next` API
   - Prevents infinite reInit loops
   - Follows ProductGallery component pattern (proven approach)
   - More reliable viewport change detection

3. **Component Duplication Strategy:**
   - Only duplicate when count is 4 or 5 (sweet spot for loop smoothness)
   - Avoids unnecessary duplication for small (≤3) or large (≥6) sets
   - Uses spread operator for efficient array cloning
   - Updates overflow detection dependency to track `displayPublications`

4. **GROQ Query Optimization:**
   - Combined multiple filters in single query for performance
   - Used parameterized queries to prevent injection
   - Proper reference resolution with `[]._ref` syntax
   - Draft document ID normalization with `.replace('drafts.', '')`

### Testing & Verification

- ✅ CSS specificity issues resolved
- ✅ PortableText utility function works correctly
- ✅ Brand page renders with proper headings
- ✅ Featured reviews filter shows only brand-specific reviews
- ✅ Duplicate review selection prevented in Sanity Studio
- ✅ 10 reviews created, enriched, and published successfully
- ✅ Carousel disables when content fits container
- ✅ Carousel enables when content overflows
- ✅ Drag functionality properly disabled when carousel is inactive
- ✅ Viewport resize dynamically updates carousel state
- ✅ No layout shift or wrapping issues
- ✅ Smooth carousel loop with 4-5 item duplication
- ✅ No linter errors in modified files

### Files Modified

1. `apps/web/src/global/utils.ts` - Added `stringToPortableText` utility
2. `apps/web/src/app/marki/[slug]/page.tsx` - Updated to use utility function
3. `apps/studio/schemaTypes/documents/collections/brand.ts` - Enhanced review filtering
4. `apps/web/src/components/pageBuilder/FeaturedPublications/PublicationsCarousel.tsx` - Carousel optimization
5. `apps/web/src/components/pageBuilder/FeaturedPublications/styles.module.scss` - Removed flex-wrap

### Sanity Content Changes

- Created 10 new review documents for PrimaLuna brand
- All reviews properly linked to products
- Complete metadata (authors, images, slugs, SEO)
- Generated detailed review content
- Published and made live

---

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

3. **Distribution Year Field** ✅ COMPLETED

   ```typescript
   defineField({
     name: 'distributionYear',
     title: 'Rok rozpoczęcia dystrybucji (opcjonalny)',
     type: 'object',
     description:
       'Rok i obraz tła dla odznaki roku rozpoczęcia dystrybucji. Jeśli ustawisz rok, musisz również ustawić obraz tła i odwrotnie.',
     group: GROUP.MAIN_CONTENT,
     fields: [
       defineField({
         name: 'year',
         title: 'Rok',
         type: 'number',
         description:
           'Rok, w którym AudioFast rozpoczął dystrybucję tej marki (np. 2005)',
         validation: (Rule) =>
           Rule.min(1900)
             .max(new Date().getFullYear())
             .error('Podaj prawidłowy rok'),
       }),
       defineField({
         name: 'backgroundImage',
         title: 'Obraz tła',
         type: 'image',
         description: 'Obraz tła wyświetlany za tekstem odznaki roku',
         options: {
           hotspot: true,
         },
       }),
     ],
     validation: (Rule) =>
       Rule.custom((value) => {
         if (!value) return true; // Optional field
         const hasYear = value.year !== undefined && value.year !== null;
         const hasImage =
           value.backgroundImage !== undefined &&
           value.backgroundImage !== null;
         if (hasYear && !hasImage) {
           return 'Jeśli ustawisz rok, musisz również ustawić obraz tła';
         }
         if (hasImage && !hasYear) {
           return 'Jeśli ustawisz obraz tła, musisz również ustawić rok';
         }
         return true;
       }),
   });
   ```

4. **Two-Column Content Field** ✅ COMPLETED

   ```typescript
   // Brand Description Heading (added above main content)
   customPortableText({
     name: 'brandDescriptionHeading',
     title: 'Nagłówek opisu marki',
     description:
       'Nagłówek wyświetlany nad opisem marki w sekcji dwukolumnowej',
     group: GROUP.MAIN_CONTENT,
     include: {
       styles: ['normal'],
       decorators: ['strong'], // Only bold decorator
       annotations: [],
       lists: [],
     },
     components: [],
   });

   // Brand Description (main content)
   customPortableText({
     name: 'brandDescription',
     title: 'Opis marki',
     description: 'Szczegółowy opis marki wyświetlany w sekcji dwukolumnowej',
     group: GROUP.MAIN_CONTENT,
     include: {
       styles: ['normal', 'h3', 'h4'], // Added h3 and h4
       lists: ['bullet', 'number'],
       decorators: ['strong', 'em'],
       annotations: ['customLink'],
     },
     components: ['ptImage', 'ptMinimalImage', 'ptHeading'], // Added new components
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

## Phase 1.5: Custom Portable Text Components ✅ COMPLETED

### Step 1.5.1: Update ptHeading Component

**Schema**: `apps/studio/schemaTypes/portableText/heading.ts`

- Replaced `iconPicker` field with `image` field (accepts only SVG files)
- Made icon required
- Updated titles and descriptions

**Component**: `apps/web/src/components/portableText/Heading/index.tsx`

- Converted to async server component (removed 'use client')
- Server-side SVG fetching using `svgToInlineString` utility
- Improved performance by eliminating client-side hydration

### Step 1.5.2: Create ptMinimalImage Component

**Schema**: `apps/studio/schemaTypes/portableText/minimal-image.ts`

- New portable text component
- Single required `image` field
- No caption or layout options (simpler than ptImage)

**Component**: `apps/web/src/components/portableText/MinimalImage/index.tsx`

- Server component rendering single image
- Responsive sizing with lazy loading
- Rounded corners and responsive margins

**Styles**: `apps/web/src/components/portableText/MinimalImage/styles.module.scss`

- Full width responsive design
- Border radius: 0.5rem
- Responsive margin using clamp()
- Max-height: 700px

---

## Recent Progress - Store Locations Implementation (Completed)

**Date:** November 5, 2025

### 18. ✅ Installed Leaflet & React Leaflet

- **Libraries:**
  - `leaflet@1.9.4` - Core mapping library
  - `react-leaflet@5.0.0` - React bindings
  - `@types/leaflet@1.9.21` - TypeScript types
- **Installation:** Used Bun package manager
- **Choice:** Selected Leaflet + OpenStreetMap over Mapbox/Google Maps (free, no API keys, excellent Poland coverage)

### 19. ✅ Updated Store Schema with Address Fields Only

- **File:** `apps/studio/schemaTypes/documents/collections/store.ts`
- **No geopoint field** - coordinates calculated automatically on client-side
- Content editors only need to provide:
  - Postal code (validated format: xx-xxx)
  - City name (used for geocoding)
  - Street and number
- Grid layout for address fields:
  - Row 1: Postal code (6 cols) + City (6 cols)
  - Row 2: Street and number (12 cols)
- **Advantage:** Zero manual coordinate setup, fully automatic

### 20. ✅ Updated Brand Query to Fetch Stores

- **File:** `apps/web/src/global/sanity/query.ts`
- Query: `*[_type == "store" && _id in array::unique(*[_type == "product" && brand._ref == ^._id].availableInStores[]._ref)]`
- Fetches unique stores from all products of the brand
- Projects: name, address (postal code, city, street), phone, website
- **No location field** - coordinates generated client-side from city name
- Generated TypeScript types properly capture store array structure

### 20a. ✅ Created Geocoding Utility

- **File:** `apps/web/src/lib/geocoding.ts`
- Uses **Nominatim (OpenStreetMap)** free geocoding API
- **No API keys required** - completely free service
- Features:
  - `geocodeCity(city, country)` - Convert city name to coordinates
  - `geocodeCities(cities)` - Batch geocode with rate limiting (1 req/sec)
  - In-memory caching to prevent repeated API calls
  - Nominatim rate limit compliance (1 request/second)
  - Error handling with fallback to null
- **User-Agent header** required by Nominatim (set to "Audiofast-Website/1.0")
- **Poland-specific**: Uses `countrycodes=pl` parameter for accurate results
- **Cache strategy**: Results stored in Map for session duration

### 21. ✅ Created StoreLocations Component with Client-Side Geocoding

- **Location:** `apps/web/src/components/ui/StoreLocations/`
- **Features:**
  - Two-column layout: Map (left) + Store list (right)
  - **Automatic geocoding on mount** - converts city names to coordinates
  - Interactive map with custom markers
  - Click store in list → map centers on location
  - Click map marker → store highlighted in list + scrolls into view
  - Selected store visual feedback (red border, background tint)
  - Responsive: Stack vertically on mobile
- **Geocoding Flow:**
  1. Component mounts → extracts city names from stores
  2. Calls `geocodeCity()` for each unique city
  3. Caches results in memory
  4. Updates `storesWithLocations` state
  5. Map renders with calculated coordinates
- **Loading States:**
  - `isGeocoding` state tracks geocoding progress
  - Shows "Ładowanie lokalizacji..." placeholder during geocoding
  - Shows "Nie znaleziono lokalizacji..." if all geocoding fails
- **Map Implementation:**
  - Dynamic import to avoid SSR issues
  - OpenStreetMap tiles (free)
  - Custom SVG markers (red for selected, gray for others)
  - Popups with store details
  - Auto-center based on geocoded locations
  - Zoom level: 13 for single store, 7 for multiple
- **Store List:**
  - Store name, full address
  - Phone (clickable tel: link)
  - Website (opens in new tab)
  - Keyboard accessible (Enter/Space to select)
  - Click-through on contact links (stopPropagation)

### 22. ✅ Created StoreMap Component

- **File:** `apps/web/src/components/ui/StoreLocations/StoreMap.tsx`
- **Client-side only** (Leaflet requires DOM)
- **Features:**
  - MapContainer with react-leaflet
  - Custom markers using L.divIcon with inline SVG
  - Marker color changes based on selection state
  - Popups with formatted store information
  - MapUpdater component for centering on selection
  - Smooth animated transitions when selecting stores
- **Styling:**
  - Border radius: 0.5rem
  - Scroll wheel zoom disabled (better UX)
  - Attribution to OpenStreetMap

### 23. ✅ Styled StoreLocations Component

- **File:** `apps/web/src/components/ui/StoreLocations/styles.module.scss`
- **Layout:**
  - Gray background container (#F8F8F8)
  - Two-column flex layout with 3rem gap
  - Map: min-height 31.25rem (500px)
  - Border radius: 0.5rem
- **Store List:**
  - Store cards with bottom borders
  - Hover effect (light gray background)
  - Active state (red border, tinted background)
  - Padding: 1.25rem vertical, 1rem horizontal
  - Focus-visible outline for accessibility
- **Contact Items:**
  - Icon with red tinted circular background
  - Phone icon (clickable with tel: link)
  - Globe icon (clickable to website)
  - Hover transitions on links
- **Mobile (≤899px):**
  - Stack map above list
  - Reduced min-height for map (18.75rem)
  - Full-width store cards
  - Contact items aligned left
  - Smaller font sizes and spacing

### 24. ✅ Integrated into Brand Page

- **File:** `apps/web/src/app/marki/[slug]/page.tsx`
- Added import: `StoreLocations`
- Conditional rendering: Only shows if `brand.stores` exists and has items
- Positioned after Featured Reviews section
- Automatically fetches stores from products of the brand
- Type-safe integration with generated types

### 25. ✅ Added Leaflet CSS to Global Styles

- **File:** `apps/web/src/global/global.scss`
- Imported Leaflet CSS at top of file
- Ensures map tiles and controls display correctly
- Custom marker icons styled globally

### Technical Decisions

1. **Leaflet over Mapbox/Google Maps:**
   - Free forever, no API keys or usage limits
   - Excellent OpenStreetMap coverage for Poland
   - Simple integration with React
   - No privacy/tracking concerns

2. **Dynamic Import for Map:**
   - Prevents SSR hydration errors (Leaflet requires `window`)
   - Shows loading placeholder during import
   - Improves initial page load performance

3. **Custom SVG Markers:**
   - No need for external marker image files
   - Inline SVG allows dynamic color changes
   - Red for selected (#C54E47), gray for others
   - Proper icon sizing (25x41) matching Leaflet defaults

4. **Client-Side Geocoding Strategy:**
   - No manual coordinate setup in Sanity
   - Content editors only provide city names
   - Coordinates calculated automatically on client-side
   - Uses free Nominatim API (no API keys)
   - In-memory caching prevents repeated requests
   - Perfect for city-level accuracy (map is zoomed out anyway)

5. **Store Query Strategy:**
   - Query stores via products (brand relationship)
   - `array::unique()` prevents duplicates
   - Single query fetches all necessary data
   - Type-safe with generated TypeScript definitions

### Files Created

1. `apps/web/src/components/ui/StoreLocations/index.tsx`
2. `apps/web/src/components/ui/StoreLocations/StoreMap.tsx`
3. `apps/web/src/components/ui/StoreLocations/styles.module.scss`
4. `apps/web/src/lib/geocoding.ts` - Nominatim geocoding utility

### Files Modified

1. `apps/studio/schemaTypes/documents/collections/store.ts` - Added location geopoint
2. `apps/web/src/global/sanity/query.ts` - Added stores query to brand
3. `apps/web/src/app/marki/[slug]/page.tsx` - Integrated StoreLocations
4. `apps/web/src/global/global.scss` - Imported Leaflet CSS
5. `apps/web/src/global/sanity/sanity.types.ts` - Generated types (auto)

### Testing Checklist

- ✅ Store schema requires only city/address (no manual coordinates)
- ✅ Brand query fetches unique stores from products
- ✅ TypeScript types properly generated
- ✅ Geocoding API converts city names to coordinates
- ✅ In-memory cache prevents repeated API calls
- ✅ Loading state shows "Ładowanie lokalizacji..." during geocoding
- ✅ Map renders without SSR errors after geocoding completes
- ✅ Custom markers display correctly at geocoded positions
- ✅ Click store → map centers on location
- ✅ Click marker → store highlighted and scrolled into view
- ✅ Phone and website links work correctly
- ✅ Keyboard navigation works (Tab, Enter, Space)
- ✅ Mobile layout stacks vertically
- ✅ Responsive font sizes and spacing
- ✅ No linter errors
- ✅ Proper error handling for failed geocoding
- ✅ Nominatim rate limiting respected (1 req/sec)

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

### Step 2.2: Create TwoColumnContent Component ✅ COMPLETED

**Location**: `apps/web/src/components/ui/TwoColumnContent/`

**Purpose**: Two-column layout section displaying brand story with optional gallery and distribution year badge

**Features**:

- Two-column responsive layout
- Renders portable text content
- Supports images within content
- Gray background (#F8F8F8)
- Vertical divider between columns on desktop
- **Includes distribution year badge inline** (not a separate component)
- **Includes product gallery** (if 4+ images provided)

**TypeScript Interface** (Actual Implementation):

```typescript
export interface TwoColumnContentProps {
  content: PortableTextProps;
  customId?: string;
  headingContent?: PortableTextProps; // NEW: Heading above content
  distributionYear?: NonNullable<QueryBrandBySlugResult>['distributionYear']; // Object with year & backgroundImage
  gallery?: SanityRawImage[];
}
```

**SCSS Structure**:

```scss
.twoColumnContent {
  // Gray background container
  // Padding and border-radius

  .container {
    .heading {
      // Main heading styles
    }

    .contentWrapper {
      // Two-column grid layout

      .column {
        // Individual column styles

        .content {
          // Portable text content
        }
      }

      .divider {
        // Vertical divider between columns (desktop only)
      }
    }

    .galleryWrapper {
      // Gallery section (rendered if 4+ images)
      // Includes scroll anchor #galeria
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Stack columns vertically

    .container {
      .contentWrapper {
        // Single column layout

        .divider {
          // Hide divider on mobile
        }
      }

      .galleryWrapper {
        // Mobile gallery spacing
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
- **DistributionYearBadge renders inside container** if `distributionYear` prop provided
- **ProductGallery renders inside container** if `gallery` prop has 4+ images
- Gallery section includes `id="galeria"` for sticky nav scroll targeting

---

### Step 2.3: Distribution Year Badge ✅ COMPLETED (Inline Implementation)

**Location**: Inline within `apps/web/src/components/ui/TwoColumnContent/index.tsx`

**Purpose**: Display year AudioFast started distributing the brand

**Note**: This is **NOT a separate component** - it's rendered inline within TwoColumnContent component.

**Implementation**: JSX rendered directly in TwoColumnContent when `distributionYear` prop is provided with both `year` and `backgroundImage` fields.

**Features**:

- Background image with gradient overlay
- Centered text with year
- Responsive sizing
- Styles integrated into TwoColumnContent's SCSS file

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
- Rendered within TwoColumnContent component (after content columns, before gallery)
- Margin top: 2rem on desktop, 1.5rem on mobile

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
    { id: 'o-marce', label: 'O marce', visible: !!brand.brandDescription },
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

      {/* Brand Story Section with Distribution Year and Gallery */}
      {brand.brandDescription && brand.brandDescription.length > 0 && (
        <div id="o-marce">
          <TwoColumnContent
            content={brand.brandDescription}
            customId="o-marce"
            headingContent={brand.brandDescriptionHeading}
            distributionYear={brand.distributionYear} // Object with year & backgroundImage
            gallery={brand.imageGallery}
          />
        </div>
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

// Brand detail query (UPDATED)
const brandDetailQuery = groq`
  *[_type == "brand" && slug.current == $slug][0] {
    _id,
    name,
    slug,
    logo,
    description,
    heroImage,
    bannerImage,
    brandDescriptionHeading, // NEW: Heading above content
    brandDescription, // Main content with h3, h4, ptMinimalImage, ptHeading
    distributionYear { // NEW: Object structure
      year,
      backgroundImage {
        // imageFragment projection
      }
    },
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

### Step 6.3: DistributionYearBadge Styles ✅ COMPLETED

**File**: `apps/web/src/components/ui/TwoColumnContent/styles.module.scss` (integrated inline)

**Note**: These styles are now part of TwoColumnContent's SCSS file, not a separate file.

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

### Step 7.4: Test TwoColumnContent Section (with Distribution Year and Gallery)

**Verification**:

- [ ] Two-column layout displays correctly on desktop
- [ ] Vertical divider appears between columns
- [ ] Portable text renders correctly
- [ ] Images display with proper aspect ratio
- [ ] Links are styled and functional
- [ ] Mobile: Columns stack vertically

**Distribution Year Badge (within TwoColumnContent)**:

- [ ] Badge displays when `distributionYear` prop is provided
- [ ] Badge appears after content columns, before gallery
- [ ] Background image loads correctly from `bannerImage`
- [ ] Gradient overlay is visible
- [ ] Year text is centered and readable
- [ ] Text: "Jesteśmy oficjalnym dystrybutorem tej marki od {year} roku."
- [ ] Mobile: Text adjusts size appropriately
- [ ] Proper spacing: margin-top 2rem desktop, 1.5rem mobile

**Image Gallery (within TwoColumnContent)**:

- [ ] Gallery only shows when `gallery` prop has 4+ images
- [ ] Gallery appears after distribution year badge
- [ ] Gallery section has `id="galeria"` for sticky nav targeting
- [ ] ProductGallery component renders correctly
- [ ] Images are clickable with carousel navigation
- [ ] Thumbnails display below main image
- [ ] Navigation arrows work
- [ ] Mobile: Gallery is responsive
- [ ] Proper spacing: margin-top 2rem desktop, 1.5rem mobile

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
- [ ] Brand has no banner image → Hide banner section (but year badge still shows if year provided)
- [ ] Brand has no brand description → Hide entire TwoColumnContent section (including year badge and gallery)
- [ ] Brand has no image gallery → Hide gallery within TwoColumnContent
- [ ] Brand has no reviews → Hide reviews section
- [ ] Brand has no distribution year → Hide year badge within TwoColumnContent
- [ ] Brand has < 4 gallery images → Don't show gallery within TwoColumnContent
- [ ] Brand has description but no year/gallery → Show only two-column content

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
