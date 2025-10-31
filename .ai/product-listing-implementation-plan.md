# Product Listing Pages Implementation Plan

## Overview

Create a product listing system similar to the existing blog structure, with two main pages:

- `/produkty/` - Main products listing page
- `/produkty/kategoria/[category]` - Dynamic category pages with custom filtering

## Implementation Steps

---

## Step 1: Sanity Schema Preparation

### 1.1 Update Products Singleton (`apps/studio/schemaTypes/documents/singletons/products.ts`)

Add the following fields to match the blog singleton structure:

- **Title** (`title`)
  - Type: `customPortableText`
  - Description: Main title displayed in the hero section on the products page
  - Include: styles ['normal'], decorators ['strong']
  - Validation: Required
  - Group: MAIN_CONTENT

- **Description** (`description`)
  - Type: `customPortableText`
  - Description: Short description displayed under the title in the hero section
  - Include: styles ['normal'], decorators ['strong', 'em']
  - Group: MAIN_CONTENT

- **Hero Image** (`heroImage`)
  - Type: `image`
  - Description: Background image displayed in the hero section on the products page
  - Options: hotspot: true
  - Validation: Required
  - Group: MAIN_CONTENT

- Keep existing `pageBuilder` field
- Keep existing SEO fields

### 1.2 Update Product Category Sub (`apps/studio/schemaTypes/documents/collections/product-category-sub.ts`)

Add optional override fields (similar to blog-category):

- **Custom Title** (`title`)
  - Type: `customPortableText`
  - Description: Custom title for the category page. If not set, the default title from the main products page will be used. Set this to override the default title.
  - Include: styles ['normal'], decorators ['strong']
  - Optional
  - Group: MAIN_CONTENT

- **Custom Description** (`description`)
  - Type: `customPortableText`
  - Description: Custom description for the category page. If not set, the default description from the main products page will be used. Set this to override the default description.
  - Include: styles ['normal'], decorators ['strong', 'em']
  - Optional
  - Group: MAIN_CONTENT

- **Hero Image** (`heroImage`)
  - Type: `image`
  - Description: Custom background image for the category page. If not set, the default image from the main products page will be used.
  - Optional
  - Group: MAIN_CONTENT
  - Options: hotspot: true

- **Page Builder** (`pageBuilder`)
  - Type: `pageBuilder`
  - Description: Custom sections for this category page. If not set, the page builder from the main products page will be used as fallback.
  - Optional
  - Group: MAIN_CONTENT

### 1.3 Add Custom Filters System to Product Category Sub

**SIMPLIFIED APPROACH:** Just an array of filter names (strings)

- **Custom Filters** (`customFilters`)
  - Type: `array`
  - Description: Define filter names for this category (e.g., "Długość kabla", "Moc wzmacniacza", "Impedancja"). Products can then provide values for these filters.
  - Group: MAIN_CONTENT
  - Of: `{ type: 'string' }`
  - Validation: unique (filter names must be unique)

**Example:**

- Category "Kable" defines filters: `["Długość kabla", "Typ złącza", "Kolor"]`
- Products in this category can then set: `{ "Długość kabla": "2m", "Typ złącza": "XLR", "Kolor": "Czarny" }`

### 1.4 Update Product Document (`apps/studio/schemaTypes/documents/collections/product.ts`)

Add category reference and custom filter values:

- **Categories** (`categories`)
  - Type: `array`
  - Description: Wybierz kategorie, do których należy ten produkt. Produkt może należeć do wielu kategorii.
  - Of: `{ type: 'reference', to: [{ type: 'productCategorySub' }] }`
  - Validation: Required, min 1
  - Group: MAIN_CONTENT
  - Add filter to prevent duplicates (same as awards/reviews pattern)

- **Custom Filter Values** (`customFilterValues`)
  - Type: `array`
  - Description: Provide values for filters defined in selected categories.
  - Group: MAIN_CONTENT
  - Hidden: Only show if categories are selected
  - Of:
    ```typescript
    {
      type: 'object',
      name: 'filterValue',
      title: 'Wartość filtra',
      fields: [
        {
          name: 'filterName',
          title: 'Nazwa filtra',
          type: 'string',
          description: 'Filter name from category (e.g., "Długość kabla", "Moc wzmacniacza")',
          validation: Required,
        },
        {
          name: 'value',
          title: 'Wartość',
          type: 'string',
          description: 'Value for this filter (e.g., "2m", "100W", "8Ω")',
          validation: Required,
        }
      ],
      preview: {
        select: {
          filterName: 'filterName',
          value: 'value',
        },
        prepare: ({ filterName, value }) => ({
          title: filterName || 'Filtr',
          subtitle: value || 'Brak wartości',
        })
      }
    }
    ```

**Much simpler!** No IDs, no types, no units, no category references. Just name + value pairs.

### 1.5 Update Sanity Studio Structure (`apps/studio/structure.ts`)

Update the products section to show:

- Products singleton (main page configuration)
- Product categories (parent + sub) - with proper ordering
- Individual products - ordered by rank

Follow the same pattern as the blog structure.

---

## ✅ Step 1 Complete Summary

**What was implemented:**

1. **Products Singleton** - Added title, description (both required), and heroImage fields
2. **Product Category Sub** - Added optional overrides for title, description, and heroImage
3. **Simplified Custom Filters** - Categories define filter names as simple strings (e.g., ["Długość kabla", "Moc"])
4. **Product Filter Values** - Products provide simple name-value pairs (e.g., { filterName: "Długość kabla", value: "2m" })
5. **Categories in Products** - Products can belong to multiple categories
6. **Studio Structure** - Added "Products by Category" view for better organization
7. **Page Builder Fallback** - Category pages can override pageBuilder, otherwise fallback to main products page

**Key Simplifications Made:**

- ✅ No filter IDs, slugs, or complex references
- ✅ No filter types (text/number/range) - all values are strings
- ✅ No units field - units are just part of the value string
- ✅ Straightforward name-value pairs

**Smart UI Enhancement:**

- ✅ Custom input component that automatically fetches filters from selected categories
- ✅ Dropdown shows only available filters (prevents typos!)
- ✅ Updates dynamically when categories change
- ✅ Shows helpful messages when no filters are available
- ✅ Clean UI with validation warnings

**Types Generated:** ✅ All TypeScript types successfully generated

---

## Step 2: Queries, Pages & Base Logic

### 2.1 Create GROQ Queries

Create new query file: `apps/web/src/global/sanity/query-products.ts`

**Main query: `queryProductsPageData`**

Parameters:

- `$category: string` - Category slug (empty string for main page)

Returns:

```typescript
{
  // Main products page data
  name: string,
  slug: string,
  title: portableText,
  description: portableText,
  heroImage: image,
  pageBuilder: array,
  seo: object,
  openGraph: object,

  // Selected category data (if category param provided)
  selectedCategory: {
    _id: string,
    name: string,
    slug: string,
    title: portableText (optional),
    description: portableText (optional),
    pageBuilder: array (optional),
    customFilters: array,
    seo: object,
    openGraph: object,
  },

  // All categories with counts
  categories: [
    {
      _id: string,
      name: string,
      slug: string,
      parentCategory: { name: string, slug: string },
      count: number, // Count of published products in this category
    }
  ],

  // Total count of published products (for main page or filtered by category)
  totalCount: number,
}
```

**Products listing query: `queryProductsListing`**

Parameters:

- `$category: string` - Category slug (empty for all)
- `$searchTerm: string` - Search query
- `$start: number` - Pagination start
- `$end: number` - Pagination end
- `$customFilters: array` - Array of filter objects `{ filterId: string, value: string }`

Returns:

```typescript
{
  products: [
    {
      _id: string,
      name: string,
      subtitle: string,
      slug: string,
      price: number,
      isArchived: boolean,
      imageGallery: [image],
      brand: {
        name: string,
        logo: image,
      },
      categories: [
        {
          _id: string,
          name: string,
          slug: string,
        }
      ],
      awards: [
        {
          name: string,
          logo: image,
        }
      ],
    }
  ],
  totalCount: number,
}
```

**Category filters query: `queryCategoryFilters`**

Parameters:

- `$category: string` - Category slug

Returns:

```typescript
{
  customFilters: string[], // Simple array of filter names
  // Available values grouped by filter name
  availableFilterValues: {
    [filterName: string]: Array<{
      value: string,
      count: number,
    }>
  }
}
```

**Example:**

```typescript
{
  customFilters: ["Długość kabla", "Moc wzmacniacza"],
  availableFilterValues: {
    "Długość kabla": [
      { value: "2m", count: 5 },
      { value: "5m", count: 3 }
    ],
    "Moc wzmacniacza": [
      { value: "100W", count: 4 },
      { value: "200W", count: 2 }
    ]
  }
}
```

### 2.2 Create Page Files

**Main products page: `apps/web/src/app/produkty/page.tsx`**

Structure similar to `apps/web/src/app/blog/(listing)/page.tsx`:

- Import necessary components
- `generateMetadata()` - Fetch products page data and generate SEO metadata
- `ProductsPage` component:
  - Get searchParams: `page`, `search`, custom filter params
  - Fetch products page data
  - Render:
    - CollectionPageSchema
    - Breadcrumbs
    - HeroStatic (with products page title, description, heroImage)
    - Products listing section with:
      - ProductsAside (categories + filters)
      - ProductsListing (with suspense)
    - PageBuilder (from products page)

**Category page: `apps/web/src/app/produkty/kategoria/[category]/page.tsx`**

Structure similar to `apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx`:

- `generateStaticParams()` - Generate params for all categories with products
- `generateMetadata()` - Fetch category data and generate SEO metadata
- `CategoryPage` component:
  - Get params: `category`
  - Get searchParams: `page`, `search`, custom filter params
  - Fetch products page data with category
  - Use category's custom title/description if available, fallback to main page
  - Render:
    - CollectionPageSchema
    - Breadcrumbs (including parent category if applicable)
    - HeroStatic (with category/fallback title, description, heroImage)
    - Products listing section with:
      - ProductsAside (categories + custom filters for this category)
      - ProductsListing (filtered by category, with suspense)
    - PageBuilder (from category or fallback to main products page)

### 2.3 Constants

Add to `apps/web/src/global/constants.ts`:

```typescript
export const PRODUCTS_ITEMS_PER_PAGE = 12; // Or appropriate number based on design
```

### 2.4 Testing Strategy

1. Test queries in Sanity Vision:
   - Query products page data without category
   - Query products page data with category
   - Query products listing with pagination
   - Query products listing with search
   - Query products listing with custom filters
   - Query category filters and available values

2. Test pages with console logging:
   - Log fetched data structure
   - Log search params
   - Log filter application
   - Verify pagination math
   - Test 404 cases (non-existent categories)

3. Test edge cases:
   - Category with no products
   - Product with multiple categories
   - Empty search results
   - Filter combinations

---

## ✅ Step 2 COMPLETE Summary

**What was implemented:**

1. **GROQ Queries Updated** (in `query.ts` - consolidated with all other queries)
   - ✅ `queryProductsPageData` - Fetches main page data + category data
   - ✅ `queryProductsListing` - Now supports ALL filters:
     - Category filtering
     - Search term
     - Sorting (orderRank, priceAsc, priceDesc, newest, oldest)
     - Brand filtering (multiple brands)
     - Price range (minPrice, maxPrice)
     - Note: Custom category filters applied client-side in page components
   - ✅ `queryCategoryFilters` - Enhanced to fetch:
     - Custom filter names for category
     - Available filter values with products
     - Available brands for filtering
     - Price range for the category/page
   - ✅ `queryProductBySlug` - For future product detail page

2. **Main Products Page** (`/produkty/page.tsx`)
   - ✅ Fetches products page data
   - ✅ Generates SEO metadata
   - ✅ Parses ALL search params:
     - `page` - pagination
     - `search` - search term
     - `sortBy` - sort order
     - `brands` - brand filter (single or array)
     - `minPrice` / `maxPrice` - price range
   - ✅ Renders HeroStatic with title, description, background
   - ✅ Shows breadcrumbs
   - ✅ Console logging for testing all params
   - ✅ Placeholder for ProductsListing component
   - ✅ PageBuilder integration

3. **Category Page** (`/produkty/kategoria/[category]/page.tsx`)
   - ✅ Dynamic route handling
   - ✅ `generateStaticParams` for build-time generation
   - ✅ Fetches category-specific data
   - ✅ Parses ALL search params (same as main page PLUS):
     - All standard params from main page
     - **Dynamic custom filters** (e.g., `Długość kabla=2m`, `Moc=100W`)
   - ✅ Extracts custom filters dynamically using helper function
   - ✅ Title/Description/HeroImage fallback logic working
   - ✅ PageBuilder fallback logic working
   - ✅ Parent category in breadcrumbs
   - ✅ Console logging for testing (including active custom filters)
   - ✅ Placeholder for ProductsListing component

4. **Utility Functions** (moved to `/global/utils.ts`)
   - ✅ `extractCustomFilters()` - Extracts dynamic filter params from searchParams
   - ✅ `customFiltersToArray()` - Converts Record to Array format for GROQ query
   - ✅ `parseBrands()` - Parses brand params (handles single/array)
   - ✅ `STANDARD_SEARCH_PARAMS` - List of known params to exclude from custom filters
   - ✅ All functions moved to global utils for reusability

5. **Constants**
   - ✅ `PRODUCTS_ITEMS_PER_PAGE = 12` added

6. **TypeScript Types**
   - ✅ Generated for 21 GROQ queries (4 new product queries)

**Filter Implementation Strategy:**

- ✅ **ALL filters applied in GROQ query** (including custom category filters!)
  - Standard filters: category, search, sort, brands, price
  - Custom category filters: passed as array to GROQ query
  - URL params use filter names as keys (URL-encoded automatically by Next.js)
  - Example: `/produkty/kategoria/kable/?Długość%20kabla=2m&Typ%20złącza=XLR`
  - Converted to: `[{filterName: "Długość kabla", value: "2m"}, {filterName: "Typ złącza", value: "XLR"}]`
  - GROQ query filters products where ALL custom filters match their `customFilterValues`

**URL Structure Examples:**

```
Main page:
/produkty/
/produkty/?page=2
/produkty/?search=wilson&sortBy=priceAsc
/produkty/?brands[]=brand-id-1&brands[]=brand-id-2
/produkty/?minPrice=5000&maxPrice=20000

Category page:
/produkty/kategoria/wzmacniacze/
/produkty/kategoria/wzmacniacze/?page=2&sortBy=priceDesc
/produkty/kategoria/kable/?Długość%20kabla=2m&Typ%20złącza=XLR
/produkty/kategoria/glosniki/?brands[]=wilson-audio&minPrice=10000
```

**Testing Ready:**

- ✅ Both pages can be visited to test data fetching
- ✅ Console logs show all parsed params and filters
- ✅ Can verify queries work correctly
- ✅ Can test all search params combinations
- ✅ Can test dynamic custom filter extraction
- ✅ Can verify fallback logic for category overrides
- ✅ Ready to receive fetched products and apply client-side filtering

**Next Step:** Create UI components (ProductsAside, ProductsListing, ProductCard)

---

## Step 3: UI Implementation

### 3.1 Create UI Components

**ProductsAside Component** (`apps/web/src/components/ui/ProductsAside/`)

Similar to `BlogAside`, but with additional features:

- Files: `index.tsx`, `styles.module.scss`
- Props:
  ```typescript
  {
    categories: Array<{
      _id: string;
      name: string;
      slug: string;
      parentCategory?: { name: string };
      count: number;
    }>;
    customFilters?: string[]; // Array of filter names
    availableFilterValues?: {
      [filterName: string]: Array<{ value: string; count: number }>;
    };
    totalCount: number;
    basePath: string;
    currentCategory: string | null;
    activeFilters?: Record<string, string>;
  }
  ```
- Features:
  - Search input (updates URL search param)
  - Categories list (grouped by parent category if applicable)
    - Show count next to each category
    - Highlight current category
  - Custom filters section (if category selected):
    - For each filter, show checkboxes/options with counts
    - Update URL with filter params on selection
    - Clear filters button
  - Price range filter (optional)
  - Sort options (optional: price, name, newest)

**ProductsListing Component** (`apps/web/src/components/ui/ProductsListing/`)

Similar to `BlogListing`:

- Files: `index.tsx`, `styles.module.scss`, `ProductsListingSkeleton.tsx`
- Props:
  ```typescript
  {
    currentPage: number;
    itemsPerPage: number;
    searchTerm?: string;
    category?: string;
    customFilters?: Record<string, string>;
    basePath: string;
  }
  ```
- Features:
  - Fetch products using `queryProductsListing`
  - Display grid of product cards
  - Show "no results" state
  - Pagination component
  - Loading skeleton

**ProductCard Component** (`apps/web/src/components/ui/ProductCard/`)

New component for displaying individual products:

- Files: `index.tsx`, `styles.module.scss`
- Props:
  ```typescript
  {
    product: {
      name: string;
      subtitle: string;
      slug: string;
      price: number;
      isArchived: boolean;
      imageGallery: [image];
      brand: { name: string; logo: image };
      categories: Array<{ name: string; slug: string }>;
      awards?: Array<{ name: string; logo: image }>;
    };
  }
  ```
- Design elements (based on Figma):
  - Product image (from imageGallery[0])
  - Brand logo overlay
  - Product name + subtitle
  - Price
  - "Archiwalny" badge if isArchived
  - Award badges if present
  - Category tags
  - Hover effects
  - Link to product detail page

### 3.2 Update Hero Component

Ensure `HeroStatic` component properly handles:

- Portable text for title and description
- Background image rendering
- Proper styling for products pages

### 3.3 Breadcrumbs

Update breadcrumbs to handle:

- Parent category → Sub category hierarchy
- Proper paths for nested categories

### 3.4 Responsive Design

Ensure all components are responsive:

- Aside: Collapsible on mobile (drawer/modal)
- Product grid: Adjust columns (4 → 3 → 2 → 1)
- Filters: Mobile-friendly interface

### 3.5 URL Search Params Structure

Example URLs:

```
/produkty/
/produkty/?page=2
/produkty/?search=wilson
/produkty/?page=2&search=wilson

/produkty/kategoria/wzmacniacze/
/produkty/kategoria/wzmacniacze/?page=2
/produkty/kategoria/wzmacniacze/?search=audio
/produkty/kategoria/wzmacniacze/?moc-wzmacniacza=100W
/produkty/kategoria/wzmacniacze/?moc-wzmacniacza=100W&impedancja=8
/produkty/kategoria/kable/?dlugosc-kabla=2m&page=2
```

Filter params use `filterId` from category's customFilters as the param key.

---

## ✅ Step 3 COMPLETE Summary

**What was implemented:**

1. **Layout & Structure**
   - ✅ Restructured products listing layout to match Figma design
   - ✅ CSS Grid layout with aside on left, content on right
   - ✅ Grid areas: `productsAside`, `sortDropdown`, `pagination-first`, `productsGrid`, `pagination-last`
   - ✅ Responsive breakpoints for tablet and mobile
   - ✅ Sticky aside with scrollable content

2. **ProductsAside Component**
   - ✅ Search input (manual mode with Searchbar component)
   - ✅ Categories list grouped by parent category
   - ✅ Expandable/collapsible parent categories with ChevronIcon
   - ✅ Active category highlighted and non-focusable
   - ✅ Brand filtering system:
     - Uses brand slugs (e.g., "aurender") instead of IDs
     - Initially shows 8 brands, dynamically expands if more are active
     - "Wczytaj wszystkie" button with count display
     - Active brands (from URL) sorted to top of list
     - Modern checkbox design with Apple-like aesthetic
     - SVG checkmark with subtle styling
   - ✅ PriceRange component integration
   - ✅ Filter and Clear Filter buttons (sticky at bottom)
   - ✅ Receives searchParams as props (no internal useSearchParams)
   - ✅ Clear Filters button only visible when filters applied in URL

3. **PriceRange Component** (NEW)
   - ✅ Dual range slider with two overlapping inputs
   - ✅ Clean visual design matching Figma
   - ✅ Editable min/max inputs with full validation:
     - No negative values
     - No decimals (integers only)
     - Min can't exceed max
     - Max can't go below min
     - Max must be at least 1
   - ✅ Dynamic maxPrice from Sanity query (not hardcoded)
   - ✅ Visual indicator showing max available price
   - ✅ Proper state synchronization with useEffect
   - ✅ Edge case handling for invalid URL params

4. **SortDropdown Component** (NEW)
   - ✅ Modern, Apple-like minimalistic design
   - ✅ Clean white dropdown with subtle shadows
   - ✅ Trigger shows current sorting value
   - ✅ Dropdown closes on focus out
   - ✅ Active option non-focusable and visually distinct
   - ✅ "Relevance" sorting only visible when search query present
   - ✅ Smooth animations with spring-like easing
   - ✅ Fixed text alignment (no jumping on hover)
   - ✅ Neutral gray active state (no red color)

5. **ProductsListing Component**
   - ✅ Server-side data fetching
   - ✅ Grid layout for product cards
   - ✅ Pagination at top and bottom
   - ✅ Empty state for no results
   - ✅ Suspense with skeleton loader
   - ✅ Proper URL params construction for pagination

6. **ProductCard Component** (NEW)
   - ✅ Product image with brand logo overlay
   - ✅ Product name and subtitle
   - ✅ Price display
   - ✅ Category badges
   - ✅ Award logos
   - ✅ Hover effects
   - ✅ Link to product detail page
   - ✅ Fade-in animation on load

7. **Pagination Component Updates**
   - ✅ Created reusable PaginationSkeleton component
   - ✅ Fixed URL params corruption issue
   - ✅ Proper URLSearchParams cloning
   - ✅ Preserves all filters when changing pages

8. **Button Component Updates**
   - ✅ Added `clearFilters` icon (filter with X)
   - ✅ Added `applyFilters` icon (filter with plus)
   - ✅ Single icon rendering (no duplicates)
   - ✅ Smooth translateX animations on hover/focus
   - ✅ Dynamic color with `currentColor`

9. **Utility Functions**
   - ✅ `parsePrice()` - Robust price validation with edge cases
   - ✅ `parseBrands()` - Updated to return clean slugs
   - ✅ All validation handles invalid inputs gracefully

10. **GROQ Query Updates**
    - ✅ `queryProductsPageData` now fetches `maxPrice`
    - ✅ Brand slug matching uses clean slugs (without `/marki/` prefix)
    - ✅ Proper filtering by brand slugs in GROQ

**Key Features Implemented:**

- ✅ **Smart Filtering**
  - All filters (search, brands, price, sort) work together
  - URL params properly encoded and decoded
  - Filters persist across pagination
  - Clear all filters functionality

- ✅ **Responsive Design**
  - Desktop: Aside + grid layout
  - Tablet: Adjusted grid columns
  - Mobile: Stacked layout
  - All components adapt to screen size

- ✅ **Accessibility**
  - Keyboard navigation supported
  - Active items non-focusable
  - ARIA labels on interactive elements
  - Screen reader friendly

- ✅ **Edge Case Handling**
  - Invalid price inputs ignored
  - Min > max price handled
  - Empty search results
  - No products in category
  - Malformed URL params

- ✅ **Performance**
  - Suspense boundaries
  - Skeleton loading states
  - Efficient re-renders
  - Optimized animations

**Design System Updates:**

- ✅ Modern, minimalistic Apple-like aesthetic
- ✅ Consistent spacing and typography
- ✅ Subtle shadows and borders
- ✅ Smooth animations with spring-like easing
- ✅ Neutral color palette with black/white/gray
- ✅ Clean, readable UI elements

**Testing & Validation:**

- ✅ All URL param combinations work
- ✅ Pagination preserves filters
- ✅ Search + filters + pagination work together
- ✅ Price range validates correctly
- ✅ Brand filtering by slugs works
- ✅ Sort dropdown properly filters "relevance"
- ✅ No linter errors

**Next Steps:**

- Product detail pages
- Advanced filtering (if needed)
- Performance optimizations
- SEO improvements
- Analytics integration

---

## Additional Considerations

### Sanity Studio Considerations

1. **Custom Input Component for Filter Values**
   - May need custom input component in `apps/studio/components/` to show available filters from selected categories
   - Component should fetch filters from referenced categories and show dropdown

2. **Validation**
   - Prevent products without categories
   - Ensure filter values reference valid filters from assigned categories
   - Validate that at least one product image exists

3. **Preview Improvements**
   - Update product preview to show categories
   - Update category preview to show product count

### Frontend Considerations

1. **Performance**
   - Use Suspense for products listing
   - Implement skeleton loading states
   - Consider virtual scrolling for large lists

2. **SEO**
   - Ensure proper meta tags for category pages
   - Add canonical URLs
   - Implement structured data (Product, BreadcrumbList)

3. **Accessibility**
   - Proper ARIA labels for filters
   - Keyboard navigation for product grid
   - Screen reader announcements for filter changes

4. **Error Handling**
   - 404 for non-existent categories
   - Empty states for no products
   - Search with no results
   - Failed queries

### Future Enhancements

1. **Advanced Filtering**
   - Multiple value selection per filter
   - Price range slider
   - Brand filter
   - Availability filter (in stock)

2. **Sorting**
   - By price (asc/desc)
   - By name (A-Z, Z-A)
   - By newest
   - By popularity

3. **Product Comparison**
   - Select products to compare
   - Side-by-side comparison view

4. **Wishlist/Favorites**
   - Save favorite products
   - Cookie-based storage

---

## File Checklist

### Sanity Studio Files to Modify

- [x] `apps/studio/schemaTypes/documents/singletons/products.ts`
- [x] `apps/studio/schemaTypes/documents/collections/product-category-sub.ts`
- [x] `apps/studio/schemaTypes/documents/collections/product.ts`
- [x] `apps/studio/structure.ts`

### Sanity Studio Files to Create

- [x] `apps/studio/components/custom-filter-value-input.tsx` - Smart dropdown that shows only filters from selected categories

### Web Files to Create

- ~~`apps/web/src/global/sanity/query-products.ts`~~ (Merged into `query.ts`)
- [x] `apps/web/src/app/produkty/page.tsx`
- [x] `apps/web/src/app/produkty/kategoria/[category]/page.tsx`
- [x] `apps/web/src/components/ui/ProductsAside/index.tsx`
- [x] `apps/web/src/components/ui/ProductsAside/styles.module.scss`
- [x] `apps/web/src/components/ui/ProductsListing/index.tsx`
- [x] `apps/web/src/components/ui/ProductsListing/styles.module.scss`
- [x] `apps/web/src/components/ui/ProductsListing/ProductsListingSkeleton.tsx`
- [x] `apps/web/src/components/ui/ProductCard/index.tsx`
- [x] `apps/web/src/components/ui/ProductCard/styles.module.scss`
- [x] `apps/web/src/components/ui/PriceRange/index.tsx`
- [x] `apps/web/src/components/ui/PriceRange/styles.module.scss`
- [x] `apps/web/src/components/ui/SortDropdown/index.tsx`
- [x] `apps/web/src/components/ui/SortDropdown/styles.module.scss`
- [x] `apps/web/src/components/ui/Pagination/PaginationSkeleton.tsx`

### Web Files to Modify

- [x] `apps/web/src/global/constants.ts` (add PRODUCTS_ITEMS_PER_PAGE)
- [x] `apps/web/src/global/utils.ts` (add parsePrice, update parseBrands)
- [x] `apps/web/src/global/sanity/query.ts` (add maxPrice queries, brand slug matching)
- [x] `apps/web/src/components/ui/Button/Button.tsx` (add clearFilters and applyFilters icons)
- [x] `apps/web/src/components/ui/Button/Button.module.scss` (add filter icon animations)
- [x] `apps/web/src/components/ui/Pagination/index.tsx` (fix URL params handling)

---

## Implementation Order

1. **Sanity Schema** (Step 1)
   - Start with products.ts (add title, description, heroImage)
   - Update product-category-sub.ts (add title, description, pageBuilder)
   - Add customFilters to product-category-sub.ts
   - Update product.ts (add categories, customFilterValues)
   - Update structure.ts
   - Run type generation

2. **Queries & Data** (Step 2)
   - Create query-products.ts with all queries
   - Test queries in Sanity Vision
   - Create page.tsx files with basic structure
   - Test data fetching with console logs
   - Verify search params handling
   - Test pagination logic

3. **UI Components** (Step 3)
   - Create skeleton ProductCard component
   - Create ProductsListing with skeleton
   - Create ProductsAside with basic categories
   - Add custom filters to ProductsAside
   - Implement full ProductCard styling
   - Add responsive design
   - Polish interactions and animations

4. **Testing & Refinement**
   - Test all edge cases
   - Check mobile responsiveness
   - Verify SEO metadata
   - Test accessibility
   - Performance optimization
