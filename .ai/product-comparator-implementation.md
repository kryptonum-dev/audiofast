# Product Comparator Implementation Plan

## Executive Summary

This document outlines the complete implementation of a product comparison feature for the Audiofast website. Users can compare 1-3 products from the same category, with comparison accessible via a floating box and a dedicated comparison page at `/porownaj`.

**Implementation Approach**: Option 2 - Keep `customFilterValues` and `technicalData` separate. Use `technicalData` array for comparison, matching by heading values across products. Display "----" for missing data.

**Key Features**:

- Add products to comparison from ProductCard, ProductHero, or comparison view
- Floating comparison box (bottom-right, collapsible)
- Dedicated comparison page at `/porownaj`
- Cookie-based persistence (no authentication required)
- Category validation (products must be from same sub-category)
- Technical data comparison with automatic heading alignment

---

## 1. Toast Notifications with Sonner

This implementation uses [Sonner](https://sonner.emilkowal.ski/) for user feedback when managing comparison state. Sonner is an opinionated, accessible toast component for React with excellent UX.

### 1.1 Installation

```bash
bun add sonner
```

### 1.2 Setup

Add the `<Toaster />` component to your root layout:

```typescript
// apps/web/src/app/layout.tsx
import { Toaster } from 'sonner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
```

### 1.3 Usage in Comparison Features

Replace all `alert()` calls with toast notifications:

```typescript
import { toast } from 'sonner';

// Success
toast.success('Produkt dodany do porównania');

// Error
toast.error('Możesz porównywać maksymalnie 3 produkty');

// Info
toast.info('Produkt usunięty z porównania');
```

### 1.4 Toast Configuration

**Position**: `bottom-right` (matches FloatingComparisonBox position)  
**Rich Colors**: Enabled for better visual hierarchy  
**Duration**: Default (4000ms for normal toasts, persists for errors)

---

## 2. Next.js 16 Compliance & Best Practices

This implementation follows Next.js 16 official guidelines and leverages the latest features:

### 1.1 Async Cookies API

**Key Change**: In Next.js 15+, the `cookies()` function is **async** and must be awaited.

```typescript
// ✅ CORRECT (Next.js 16)
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const value = cookieStore.get('name');
}

// ❌ INCORRECT (Legacy Next.js 14)
const cookieStore = cookies(); // Missing await
```

**Impact on Implementation**:

- Server Components must use `await cookies()` when reading cookies
- Cookie manager provides separate functions: `getComparisonCookie()` for client-side, `getComparisonCookieServer()` for server-side
- FloatingComparisonBox (Client Component) uses document.cookie directly
- Comparison page (Server Component) uses async `cookies()` from `next/headers`

### 1.2 Server vs Client Component Strategy

Following Next.js 16 best practices for component composition:

**Server Components** (Default):

- Comparison page (`/porownaj/page.tsx`)
- Product data fetching
- Initial cookie reading for SSR
- Static content and SEO optimization

**Client Components** (`'use client'`):

- FloatingComparisonBox (needs state, useEffect, browser APIs)
- ComparisonTable (interactive remove actions)
- AddToComparisonButton (event handlers, visual feedback states)

**Why This Matters**: Server Components reduce JavaScript bundle size and improve initial page load performance.

### 1.3 Caching & Revalidation (Next.js 16)

**Modern Caching Approach**:

- Use `cache: 'force-cache'` for Sanity queries (static data)
- Use `revalidatePath()` in Server Actions for on-demand revalidation
- **Optional**: Consider `'use cache'` directive (Cache Components feature in Next.js 16) for data fetching functions
- Avoid legacy `unstable_cache` (now deprecated in favor of Cache Components)

**Data Fetching Pattern**:

```typescript
// ✅ Recommended for Sanity queries
const products = await client.fetch(query, params, {
  cache: 'force-cache', // Static data
  next: { revalidate: 3600 }, // Or time-based revalidation
});

// ✅ Revalidate in Server Actions
('use server');
export async function updateProduct() {
  // ... update logic
  revalidatePath('/porownaj');
}
```

### 1.4 Serializable Props Requirement

All props passed from Server Components to Client Components must be **serializable**:

✅ **Allowed**: Strings, numbers, booleans, plain objects, arrays, null  
❌ **Not Allowed**: Functions, class instances, Symbols, undefined

**Implementation Impact**:

- Pass only plain product data objects as props
- Event handlers defined within Client Components (not passed as props)
- Cookie data stored as JSON-serializable objects

### 1.5 Dynamic Rendering with Cookies

**Important**: Using `cookies()` in a Server Component opts the route into **dynamic rendering** at request time.

```typescript
// This page will be dynamically rendered (not statically generated)
export default async function Page() {
  const cookieStore = await cookies(); // ← Dynamic API
  // ...
}
```

**For our implementation**: The `/porownaj` page reads cookies, so it will be dynamically rendered per-request. This is correct behavior for the comparison feature.

---

## 2. Architecture Overview

### 2.1 State Management Strategy

**Client-Side Cookie Storage** (No Context Provider Needed)

- Use cookies to persist comparison list across pages
- Maximum 3 products
- Store only product IDs and category slug
- Client components read/write cookies directly
- Server components read cookies for SSR

**Why Cookies Over Context:**

- Persistence across sessions/page reloads
- SSR compatibility (server can read comparison state)
- No need for global context wrapper
- Simpler implementation for this use case

### 2.2 Data Flow

```
User Action (Add to Comparison)
    ↓
Client Component updates cookie
    ↓
Floating box reads cookie & fetches product data
    ↓
Comparison page reads cookie & fetches full product details
```

---

## 2. Implementation Structure

### 2.1 New Files to Create

```
apps/web/src/
├── app/
│   └── porownaj/
│       ├── page.tsx (Comparison page - Server Component)
│       └── loading.tsx (Loading state)
│
├── components/
│   ├── comparison/
│   │   ├── FloatingComparisonBox.tsx (Client Component)
│   │   ├── ComparisonTable.tsx (Client Component)
│   │   ├── ComparisonProductCard.tsx (Client Component)
│   │   └── styles.module.scss
│   │
│   └── ui/ProductCard/
│       └── AddToComparisonButton.tsx (Client Component - NEW)
│
└── global/
    ├── comparison/
    │   ├── cookie-manager.ts (Cookie read/write utilities)
    │   ├── comparison-helpers.ts (Validation, data processing)
    │   └── types.ts (TypeScript types)
    │
    └── sanity/
        └── query.ts (Add comparison queries here - MODIFY EXISTING)
```

### 2.2 Files to Modify

```
apps/web/src/
├── components/
│   ├── ui/ProductCard/
│   │   └── index.tsx (Import and use AddToComparisonButton component)
│   │
│   └── products/ProductHero/
│       ├── AddToComparison.tsx (Wire up comparison logic)
│       └── index.tsx (Pass product data to AddToComparison)
│
└── global/
    ├── sanity/
    │   └── query.ts (Add comparison queries to existing file)
    │
    └── types.ts (Add ComparisonProduct type if needed)
```

---

## 3. Data Schema & Types

### 3.1 Comparison Cookie Structure

**Cookie Name**: `audiofast_comparison`

**Cookie Value** (JSON stringified):

```typescript
{
  categorySlug: string;           // Product category (validation)
  productIds: string[];           // Max 3 product IDs
  timestamp: number;              // Last updated (for expiry)
}
```

**Example**:

```json
{
  "categorySlug": "glosniki-wolnostojace",
  "productIds": ["product-id-1", "product-id-2"],
  "timestamp": 1705234567890
}
```

### 3.2 TypeScript Types

**`apps/web/src/global/comparison/types.ts`**:

```typescript
export type ComparisonCookie = {
  categorySlug: string;
  productIds: string[];
  timestamp: number;
};

export type ComparisonProduct = {
  _id: string;
  name: string;
  slug: string;
  subtitle: string;
  basePriceCents: number | null;
  brand: {
    name: string;
    logo: SanityImageType;
  };
  mainImage: SanityImageType;
  technicalData: Array<{
    title: string;
    value: PortableTextBlock[];
  }>;
  categories: Array<{
    slug: string;
  }>;
};

export type ComparisonTableData = {
  products: ComparisonProduct[];
  allHeadings: string[]; // Unique headings across all products
  comparisonRows: Array<{
    heading: string;
    values: Array<PortableTextBlock[] | null>; // null = missing data
  }>;
};
```

---

## 4. Cookie Manager Implementation

### 4.1 Cookie Utilities

**File**: `apps/web/src/global/comparison/cookie-manager.ts`

**Core Functions**:

```typescript
// Read comparison cookie (CLIENT-SIDE ONLY)
// Use in Client Components, useEffect, event handlers
export function getComparisonCookie(): ComparisonCookie | null;

// Read comparison cookie (SERVER-SIDE ONLY)
// Use in Server Components with async/await
// Pass the cookieStore from: await cookies()
export async function getComparisonCookieServer(
  cookieStore: Awaited<ReturnType<typeof import('next/headers').cookies>>
): Promise<ComparisonCookie | null>;

// Write comparison cookie (CLIENT-SIDE ONLY)
export function setComparisonCookie(data: ComparisonCookie): void;

// Add product to comparison (CLIENT-SIDE ONLY)
export function addProductToComparison(
  productId: string,
  categorySlug: string
): { success: boolean; error?: string };

// Remove product from comparison (CLIENT-SIDE ONLY)
export function removeProductFromComparison(productId: string): void;

// Clear all products from comparison (CLIENT-SIDE ONLY)
export function clearComparison(): void;

// Check if product is in comparison (CLIENT-SIDE ONLY)
export function isProductInComparison(productId: string): boolean;

// Get comparison count (CLIENT-SIDE ONLY)
export function getComparisonCount(): number;
```

**Implementation Details**:

- Cookie expiry: 7 days
- Max size validation (3 products)
- Category validation (all products must be from same category)
- Error handling for JSON parse failures
- **Next.js 16**: Separate client/server functions to handle async cookies() API

**Usage Examples**:

```typescript
// ✅ Client Component Usage
'use client';
import {
  getComparisonCookie,
  addProductToComparison,
} from '@/lib/comparison/cookie-manager';

function MyClientComponent() {
  const handleAdd = () => {
    const result = addProductToComparison('product-123', 'speakers');
    if (!result.success) {
      alert(result.error);
    }
  };

  const cookie = getComparisonCookie(); // Synchronous, works in browser
  // ...
}

// ✅ Server Component Usage
import { cookies } from 'next/headers';
import { getComparisonCookieServer } from '@/lib/comparison/cookie-manager';

async function MyServerComponent() {
  const cookieStore = await cookies(); // Next.js 16: async
  const cookie = await getComparisonCookieServer(cookieStore);
  // ...
}
```

---

## 5. Comparison Helpers

### 5.1 Data Processing Utilities

**File**: `apps/web/src/global/comparison/comparison-helpers.ts`

**Core Functions**:

```typescript
// Validate if product can be added to comparison
export function validateProductAddition(
  productId: string,
  categorySlug: string,
  currentComparison: ComparisonCookie | null
): { valid: boolean; error?: string };

// Process products into comparison table data
export function processComparisonData(
  products: ComparisonProduct[]
): ComparisonTableData;

// Extract all unique headings from products
export function extractAllHeadings(products: ComparisonProduct[]): string[];

// Create comparison rows with aligned data
export function createComparisonRows(
  products: ComparisonProduct[],
  allHeadings: string[]
): ComparisonTableData['comparisonRows'];
```

**Validation Rules**:

1. Maximum 3 products in comparison
2. All products must be from the same category
3. Cannot add the same product twice
4. Product must exist and have valid category

**Data Processing Logic**:

1. Extract all unique `title` values from `technicalData` across products
2. Sort headings alphabetically (or by custom order)
3. For each heading, create a row with values from each product
4. If a product doesn't have that heading, set value to `null`
5. Null values render as "----" in the UI

---

## 6. GROQ Queries

### 6.1 Comparison Queries

**File**: `apps/web/src/global/sanity/query.ts` (Add to existing file)

**Query 1: Get Products for Comparison (Minimal Data)**

```typescript
// Add to apps/web/src/global/sanity/query.ts

export const queryComparisonProductsMinimal = defineQuery(`
  *[_type == "product" && _id in $productIds] {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    brand->{
      name,
      ${imageFragment('logo')}
    },
    "categories": categories[]->{
      "slug": slug.current
    }
  }
`);
```

**Query 2: Get Full Product Details for Comparison Page**

```typescript
// Add to apps/web/src/global/sanity/query.ts

export const queryComparisonProductsFull = defineQuery(`
  *[_type == "product" && _id in $productIds] {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    brand->{
      name,
      ${imageFragment('logo')}
    },
    technicalData[] {
      title,
      ${portableTextFragment('value')}
    },
    "categories": categories[]->{
      "slug": slug.current
    }
  }
`);
```

**Usage**:

- `queryComparisonProductsMinimal`: For FloatingComparisonBox (minimal data, fast)
- `queryComparisonProductsFull`: For Comparison Page (full technical data)

**Note**: These queries use the existing `imageFragment` and `portableTextFragment` helpers already defined in `query.ts`.

---

## 7. Floating Comparison Box Component

### 7.1 Component Structure

**File**: `apps/web/src/components/comparison/FloatingComparisonBox.tsx`

**Component Type**: Client Component (`'use client'`)

**Props**: None (reads from cookie directly)

**State**:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [products, setProducts] = useState<ComparisonProduct[]>([]);
const [isLoading, setIsLoading] = useState(true);
```

**Behavior**:

1. Reads comparison cookie on mount
2. Fetches minimal product data from Sanity (Query 1)
3. Displays collapsed state by default (shows count only)
4. Expands to show product thumbnails when clicked
5. Provides "Remove" button for each product
6. Provides "Compare" button (links to `/porownaj`)
7. Provides "Clear All" button
8. Hides completely when comparison is empty

**UI States**:

- Empty: Hidden
- Collapsed (1-3 products): Shows count badge
- Expanded (1-3 products): Shows product thumbnails + actions

### 7.2 Component Layout

**Collapsed State**:

```
┌─────────────────────────┐
│  [Icon] Porównaj (2)   │  ← Clickable
└─────────────────────────┘
```

**Expanded State**:

```
┌─────────────────────────────────┐
│  Porównywarka (2)          [×]  │
├─────────────────────────────────┤
│  [Img] Brand Name    [×]        │
│  [Img] Brand Name    [×]        │
├─────────────────────────────────┤
│  [Porównaj]  [Wyczyść]          │
└─────────────────────────────────┘
```

### 7.3 Styling Requirements (SCSS)

**File**: `apps/web/src/components/comparison/styles.module.scss`

**Key Requirements**:

- Fixed positioning: `bottom: 1.5rem; right: 1.5rem`
- Z-index: 100 (below modals, above content)
- Box shadow for elevation
- Smooth transitions (250ms) for open/close
- Responsive: Adjust size on mobile (`@media (max-width: 56.1875rem)`)
- Hover states for interactive elements
- Focus states for accessibility

---

## 8. Comparison Page Implementation

### 8.1 Page Component

**File**: `apps/web/src/app/porownaj/page.tsx`

**Component Type**: Server Component (default)

**Metadata**:

```typescript
export const metadata: Metadata = {
  title: 'Porównaj produkty | Audiofast',
  description: 'Porównaj specyfikacje produktów audio wysokiej klasy',
};
```

**Flow** (Next.js 16):

1. Read comparison cookie (server-side with `await cookies()`)
2. If empty: Show empty state with CTA to browse products
3. If has products: Fetch full product data (Query 2)
4. Pass data to `ComparisonTable` client component
5. Handle product not found errors gracefully

**Important**: In Next.js 16, `cookies()` is async and must be awaited in Server Components.

**Empty State**:

- Heading: "Brak produktów do porównania"
- Description: "Dodaj produkty do porównania, aby zobaczyć ich specyfikacje obok siebie"
- CTA Button: "Przeglądaj produkty" → `/produkty/`

### 8.2 Comparison Table Component

**File**: `apps/web/src/components/comparison/ComparisonTable.tsx`

**Component Type**: Client Component (`'use client'`)

**Props**:

```typescript
type ComparisonTableProps = {
  products: ComparisonProduct[];
};
```

**Responsibilities**:

1. Process products into `ComparisonTableData` using helper
2. Render responsive comparison table
3. Handle "Remove from comparison" actions (client-side)
4. Display product cards at top of table
5. Display technical data rows below

**Table Structure**:

```
┌────────────────┬─────────────┬─────────────┬─────────────┐
│ (Empty cell)   │ Product 1   │ Product 2   │ Product 3   │
│                │ Image, Name │ Image, Name │ Image, Name │
│                │ Price       │ Price       │ Price       │
│                │ [×] Remove  │ [×] Remove  │ [×] Remove  │
├────────────────┼─────────────┼─────────────┼─────────────┤
│ Feature Name 1 │ Value 1     │ Value 1     │ ----        │
├────────────────┼─────────────┼─────────────┼─────────────┤
│ Feature Name 2 │ Value 2     │ ----        │ Value 2     │
├────────────────┼─────────────┼─────────────┼─────────────┤
│ ...            │ ...         │ ...         │ ...         │
└────────────────┴─────────────┴─────────────┴─────────────┘
```

**Responsive Behavior**:

- Desktop: Full table layout (as above)
- Tablet/Mobile: Switch to card-based layout (stack products vertically)

### 8.3 Comparison Product Card

**File**: `apps/web/src/components/comparison/ComparisonProductCard.tsx`

**Component Type**: Client Component (`'use client'`)

**Props**:

```typescript
type ComparisonProductCardProps = {
  product: ComparisonProduct;
  onRemove: (productId: string) => void;
};
```

**Layout**:

```
┌─────────────────────────┐
│      [Product Image]     │
│  [Brand Logo - Overlay]  │
├─────────────────────────┤
│  Brand Name              │
│  Product Name            │
│  Subtitle                │
├─────────────────────────┤
│  1 234 zł                │
├─────────────────────────┤
│  [Usuń]  [Zobacz]        │
└─────────────────────────┘
```

---

## 9. Integration with Existing Components

### 9.1 ProductCard Component

**File**: `apps/web/src/components/ui/ProductCard/index.tsx`

**Changes**:

1. Remove the inline button (lines 58-69)
2. Import the new `AddToComparisonButton` component
3. Pass necessary props to the button component
4. Remove `isClient` prop (button now always renders)

**Updated Structure**:

```typescript
// apps/web/src/components/ui/ProductCard/index.tsx
import AddToComparisonButton from './AddToComparisonButton';

// Remove isClient prop from ProductCardProps interface

export default function ProductCard({
  product,
  // ... other props (NO isClient)
}: ProductCardProps) {
  const { slug, name, subtitle, basePriceCents, brand, mainImage, _id, categories } = product;

  return (
    <article className={styles.productCard}>
      <a href={slug!} className={styles.link}>
        <div className={styles.imgBox}>
          <Image
            image={mainImage}
            sizes={imageSizes}
            fill
            priority={priority}
            loading={loading}
          />
          {brand?.logo && (
            <Image image={brand.logo} sizes="90px" loading={loading} />
          )}
          {/* ALWAYS render AddToComparisonButton */}
          <AddToComparisonButton
            productId={_id}
            productName={name}
            categorySlug={categories?.[0]?.slug}
          />
        </div>
        {/* ... rest of component */}
      </a>
    </article>
  );
}
```

### 9.2 AddToComparisonButton Component (NEW)

**File**: `apps/web/src/components/ui/ProductCard/AddToComparisonButton.tsx`

**Component Type**: Client Component (`'use client'`)

**Purpose**: Extracted button with comparison logic, always rendered

**Props**:

```typescript
type AddToComparisonButtonProps = {
  productId: string;
  productName: string;
  categorySlug?: string;
};
```

**Implementation**:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import {
  addProductToComparison,
  isProductInComparison,
} from '@/src/global/comparison/cookie-manager';
import styles from './styles.module.scss';

type AddToComparisonButtonProps = {
  productId: string;
  productName: string;
  categorySlug?: string;
};

export default function AddToComparisonButton({
  productId,
  productName,
  categorySlug,
}: AddToComparisonButtonProps) {
  const [isInComparison, setIsInComparison] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Check if product is already in comparison on mount
  useEffect(() => {
    setIsInComparison(isProductInComparison(productId));
  }, [productId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!categorySlug) {
      toast.error('Nie można dodać produktu bez kategorii');
      return;
    }

    if (isInComparison) {
      toast.info('Produkt jest już w porównaniu');
      return;
    }

    const result = addProductToComparison(productId, categorySlug);

    if (result.success) {
      setIsInComparison(true);
      setShowFeedback(true);
      toast.success('Produkt dodany do porównania');

      // Hide feedback after 2 seconds
      setTimeout(() => {
        setShowFeedback(false);
      }, 2000);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <button
      className={styles.addToComparison}
      onClick={handleClick}
      data-in-comparison={isInComparison}
      aria-label={
        isInComparison
          ? `${productName} jest w porównaniu`
          : `Dodaj ${productName} do porównania`
      }
    >
      <span>
        {showFeedback
          ? 'Dodano!'
          : isInComparison
            ? 'W porównaniu'
            : 'Dodaj do porównania'}
      </span>
      {isInComparison ? <CheckmarkIcon /> : <PlusIcon />}
    </button>
  );
}

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#a)"
    >
      <path d="M9 12.5h6M12 9.5v6M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const CheckmarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#009116"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#b)"
    >
      <path d="m7 12.5 3 3 7-7M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="b">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
```

**Visual Feedback States**:

- Default: "Dodaj do porównania" + Plus icon (red)
- Success (temporary): "Dodano!" + Checkmark icon (green) - 2 seconds
- Already added: "W porównaniu" + Checkmark icon (green) - permanent

### 9.3 ProductHero AddToComparison Component

**File**: `apps/web/src/components/products/ProductHero/AddToComparison.tsx`

**Changes**:

1. Add props for `productId` and `categorySlug`
2. Import cookie manager utilities
3. Replace `console.log` with actual logic (similar to ProductCard)
4. Add visual feedback for different states

**Updated Props**:

```typescript
type AddToComparisonProps = {
  Icon: React.ReactNode;
  productId: string;
  categorySlug: string;
};
```

---

## 10. UI/UX Specifications

### 10.1 Visual Design Requirements

**Floating Box**:

- Background: `var(--neutral-white)` from `global.scss`
- Border: `var(--neutral-400)` from `global.scss`
- Border radius: `0.5rem` (use `.br-md` utility from `global.scss`)
- Shadow: `0 0.25rem 1rem rgba(0, 0, 0, 0.1)`
- Padding: `1rem`
- Width (collapsed): `14rem`
- Width (expanded): `22rem`
- Gap between elements: `0.75rem`

**Comparison Table**:

- Header row: Background `var(--neutral-200)` from `global.scss`
- Alternating row colors: `var(--neutral-white)` / `var(--neutral-300)`
- Border: `0.0625rem solid var(--neutral-400)`
- Font size (headings): `var(--typography-body-m)` (0.875rem)
- Font size (values): `var(--typography-body-l)` (1rem)
- Cell padding: `1rem`

**Product Cards in Table**:

- Image aspect ratio: 1:1
- Max width: `18rem`
- Min width: `12rem`
- Gap: `0.75rem`

**Color Palette** (from `global.scss`):

- Primary: `var(--primary-red)` - #FE0140
- Success: `var(--primary-success)` - #009116
- Error: `var(--primary-error)` - #FF6A00
- Neutral backgrounds: `var(--neutral-200)`, `var(--neutral-300)`
- Text: `var(--neutral-600)`, `var(--neutral-700)`
- Borders: `var(--neutral-400)`, `var(--neutral-500)`

### 10.2 Interaction States

**Add to Comparison Button**:

1. **Default**: Gray background, primary color border
2. **Hover**: Primary color background, white text
3. **Active (in comparison)**: Primary color background, checkmark icon
4. **Disabled (max reached, different category)**: Gray background, disabled cursor

**Floating Box**:

1. **Collapsed**: Shows count badge, hover scales slightly
2. **Expanded**: Full product list, each product hoverable
3. **Animation**: Slide up from bottom + fade in (350ms)

### 10.3 Accessibility Requirements

**ARIA Labels**:

- Floating box: `aria-label="Porównywarka produktów"`
- Add button: `aria-label="Dodaj [Product Name] do porównania"`
- Remove button: `aria-label="Usuń [Product Name] z porównania"`
- Table: `role="table"` with proper `th` and `td` structure

**Keyboard Navigation**:

- Floating box: Toggle with `Enter` or `Space`
- Table: Keyboard focus for all interactive elements
- Focus visible states: `outline: 2px solid` primary color

**Screen Reader Announcements**:

- "Dodano produkt do porównania"
- "Usunięto produkt z porównania"
- "Porównujesz [X] produktów"

---

## 11. Error Handling & Edge Cases

### 11.1 Error Scenarios

**1. Different Category Error**

- **Trigger**: User tries to add product from different category
- **Message**: "Możesz porównywać tylko produkty z tej samej kategorii"
- **Action**: Show error toast, don't add product
- **Toast**: `toast.error('Możesz porównywać tylko produkty z tej samej kategorii')`

**2. Maximum Reached Error**

- **Trigger**: User tries to add 4th product
- **Message**: "Możesz porównywać maksymalnie 3 produkty"
- **Action**: Show error toast with suggestion
- **Toast**: `toast.error('Możesz porównywać maksymalnie 3 produkty. Usuń jeden, aby dodać nowy.')`

**3. Product Not Found Error**

- **Trigger**: Product in cookie was deleted from Sanity
- **Message**: Silent removal from cookie
- **Action**: Filter out missing products, show remaining ones
- **Toast**: `toast.info('Niektóre produkty zostały usunięte z porównania')` (only if products were removed)

**4. Cookie Parse Error**

- **Trigger**: Malformed cookie data
- **Message**: Silent clear of cookie
- **Action**: Reset comparison to empty state
- **Toast**: No toast (silent recovery)

**5. Empty Comparison on Page**

- **Trigger**: User navigates to `/porownaj` with no products
- **Message**: "Brak produktów do porównania"
- **Action**: Show empty state with CTA to browse products
- **Toast**: No toast (not an error)

### 11.2 Edge Case Handling

**Single Product Comparison**:

- Allow 1 product in comparison (not ideal, but not an error)
- Comparison page shows single column with all technical data
- Encourage adding more products with CTA

**Product Category Changed**:

- If admin changes product category after it's added to comparison
- Validation happens on new product addition
- Show warning if detected on comparison page: "Produkty z różnych kategorii"

**Cookie Expiry**:

- Cookie expires after 7 days
- User loses comparison data (expected behavior)
- No migration/backup needed

**Browser Without Cookies**:

- Feature won't work (expected limitation)
- Show warning toast on first comparison attempt: `toast.warning('Ta funkcja wymaga włączonych cookies')`

**Product Successfully Added**:

- Show success toast: `toast.success('Produkt dodany do porównania')`
- Button state changes to "W porównaniu"

**Product Successfully Removed**:

- Show info toast: `toast.info('Produkt usunięty z porównania')`
- Button returns to default state

**All Products Cleared**:

- Show info toast: `toast.info('Porównanie wyczyszczone')`
- Floating box hides automatically

---

## 12. Performance Optimization

### 12.1 Data Fetching Strategy

**Floating Box** (Client Component):

- Fetch minimal data only (Query 1) via client-side API call
- Use React state for data storage
- Refetch when cookie changes (useEffect dependency)
- Consider using SWR or React Query for automatic caching and revalidation

**Comparison Page** (Server Component):

- Server-side fetch (Query 2) with full technical data
- Leverage Next.js automatic static generation by default
- Add `revalidate` export if time-based revalidation is needed
- Use `revalidatePath('/porownaj')` in Server Actions when products are updated
- **Next.js 16 Alternative**: Wrap data fetching in `'use cache'` directive for Cache Components (if adopting)

### 12.2 Component Optimization

**FloatingComparisonBox**:

- Use `React.memo` to prevent unnecessary re-renders
- Debounce cookie read/write operations (50ms)
- Lazy load product images (`loading="lazy"`)

**ComparisonTable**:

- Use `React.memo` for individual product cards
- Virtualize table rows if >20 technical data rows (unlikely)
- Use `useMemo` for comparison data processing

### 12.3 Bundle Size Optimization

**Code Splitting**:

- Floating box: Always loaded (small component)
- Comparison page: Route-based code split (automatic)
- Cookie utilities: Shared, small bundle (~2KB)

**Image Optimization**:

- Use Next.js Image component throughout
- Sizes: `sizes="(max-width: 56.1875rem) 200px, 300px"`
- Format: WebP with PNG fallback (automatic)

---

## 13. Mobile Responsive Design

### 13.1 Floating Box (Mobile)

**Behavior**:

- Position: `bottom: 1rem; right: 1rem` (smaller margins)
- Width (collapsed): `12rem` (192px)
- Width (expanded): Full width minus margins (`calc(100vw - 2rem)`)
- Z-index: Same (100)

**Touch Interactions**:

- Tap to expand/collapse
- Swipe down to close (optional enhancement)
- Product removal: Swipe left (optional enhancement)

### 13.2 Comparison Page (Mobile)

**Layout Transformation**:

- Desktop: Horizontal table (products in columns)
- Mobile: Vertical cards (products stacked)

**Mobile Card Layout**:

```
┌─────────────────────────────┐
│  [Product Image]            │
│  Brand Name - Product Name  │
│  1 234 zł                   │
│  [×] Usuń                   │
├─────────────────────────────┤
│  Feature 1: Value 1         │
│  Feature 2: Value 2         │
│  ...                        │
└─────────────────────────────┘

┌─────────────────────────────┐
│  [Product Image]            │
│  Brand Name - Product Name  │
│  2 345 zł                   │
│  [×] Usuń                   │
├─────────────────────────────┤
│  Feature 1: Value 1         │
│  Feature 2: ----            │
│  ...                        │
└─────────────────────────────┘
```

**Breakpoints** (per SCSS guidelines):

```scss
.comparisonTable {
  // Desktop: table layout

  @media (max-width: 56.1875rem) {
    // Mobile: card layout
  }
}
```

---

## 14. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)

**Duration**: ~2 hours

**Tasks**:

1. Create cookie manager utilities (`global/comparison/cookie-manager.ts`)
2. Create comparison helpers (`global/comparison/comparison-helpers.ts`)
3. Create TypeScript types (`global/comparison/types.ts`)
4. Add GROQ queries to existing `global/sanity/query.ts`

**Deliverables**:

- Cookie read/write functions working
- Validation functions working
- Data processing functions working
- Queries tested in Sanity Vision

### Phase 2: Floating Box (UI Component)

**Duration**: ~3 hours

**Tasks**:

1. Create FloatingComparisonBox component
2. Implement collapsed/expanded states
3. Wire up cookie reading and product fetching
4. Add remove/clear actions
5. Style component (SCSS)
6. Test on multiple screen sizes

**Deliverables**:

- Floating box visible and functional
- Products display correctly
- Actions (remove, clear) work
- Responsive on mobile

### Phase 3: Integration (Add to Comparison)

**Duration**: ~2 hours

**Tasks**:

1. Install Sonner: `bun add sonner`
2. Add `<Toaster />` to root layout with proper configuration
3. Create AddToComparisonButton component (`ui/ProductCard/AddToComparisonButton.tsx`)
4. Update ProductCard component to use new button
5. Update ProductHero AddToComparison component
6. Update ProductHero index to pass product data
7. Implement toast notifications for all user actions
8. Implement visual feedback (success/error states with proper colors from global.scss)
9. Test validation (category, max products) with toast feedback
10. Test edge cases (duplicate, missing data) with appropriate toasts

**Deliverables**:

- Sonner installed and configured in root layout
- Toast notifications work for all comparison actions
- AddToComparisonButton component works independently
- Button always renders (no conditional logic)
- Add to comparison works from ProductCard with toast feedback
- Add to comparison works from ProductHero with toast feedback
- Visual feedback uses colors from global.scss
- All units are in rem (no px except images)
- Validation prevents errors and shows user-friendly toast messages
- No `alert()` calls - all feedback via toast

### Phase 4: Comparison Page (Full View)

**Duration**: ~4 hours

**Tasks**:

1. Create comparison page (`/porownaj/page.tsx`)
2. Create ComparisonTable component
3. Create ComparisonProductCard component
4. Implement data processing and rendering
5. Style table (desktop)
6. Style mobile layout (card-based)
7. Implement empty state
8. Test with 1, 2, 3 products

**Deliverables**:

- Comparison page loads correctly
- Technical data aligns properly
- Missing data shows "----"
- Responsive mobile layout works
- Empty state is clear

### Phase 5: Polish & Edge Cases

**Duration**: ~2 hours

**Tasks**:

1. Add loading states
2. Add error handling
3. Add accessibility attributes (ARIA labels)
4. Test keyboard navigation
5. Test with missing products (deleted from Sanity)
6. Test cookie expiry
7. Add animations/transitions

**Deliverables**:

- All error cases handled gracefully
- Accessibility requirements met
- Smooth animations
- Edge cases covered

---

## 15. Technical Specifications

### 15.1 Next.js 16 Optimizations

**Server Components** (Use by Default):

- Comparison page (`/porownaj/page.tsx`)
- Initial data fetching (GROQ queries)

**Client Components** (Use When Needed):

- FloatingComparisonBox (cookie reading, state management)
- ComparisonTable (interactive actions)
- Add to comparison buttons (event handlers, state)

**Data Fetching Pattern**:

```typescript
// Server Component (Comparison Page)
// ✅ CORRECT: Next.js 16 - cookies() is async
import { cookies } from 'next/headers';

export default async function ComparePage() {
  const cookieStore = await cookies();
  const comparisonCookie = cookieStore.get('audiofast_comparison')?.value;

  if (!comparisonCookie) {
    return <EmptyState />;
  }

  const { productIds } = JSON.parse(comparisonCookie);
  const products = await client.fetch(getComparisonProductsQuery, { productIds });

  return <ComparisonTable products={products} />;
}

// Client Component (Floating Box)
// ✅ CORRECT: Client-side cookie reading
'use client';
import { getComparisonCookie } from '@/lib/comparison/cookie-manager';

export default function FloatingComparisonBox() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const cookie = getComparisonCookie(); // Client-side only
    if (cookie) {
      fetchProducts(cookie.productIds).then(setProducts);
    }
  }, []);

  // ...
}
```

**Caching Strategy** (Next.js 16):

- **Sanity Queries**: Use `cache: 'force-cache'` in fetch options for static data
- **Revalidation**: Use `revalidatePath('/porownaj')` in Server Actions when products are updated
- **Cookie Reads**: Never cached (always fresh)
- **Route Caching**: Comparison page will be statically generated by default; use `dynamic = 'force-dynamic'` if needed
- **Alternative**: Consider using `'use cache'` directive (Next.js 16 Cache Components) for data fetching functions if you adopt Cache Components mode

### 15.2 Cookie Configuration

**Cookie Attributes**:

```typescript
const cookieOptions = {
  name: 'audiofast_comparison',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};
```

**Cookie Size Limit**:

- Max: 4KB (browser limit)
- Estimated size with 3 products: ~200 bytes
- Safe margin: ~2000 bytes (plenty of room)

### 15.3 SCSS Module Structure

**File**: `apps/web/src/components/comparison/styles.module.scss`

**Structure** (Following Guidelines - ALL UNITS IN REM):

```scss
// apps/web/src/components/comparison/styles.module.scss

// Floating Comparison Box
.floatingBox {
  // Desktop styles - ALL UNITS IN REM
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 100;
  background: var(--neutral-white);
  border: 0.0625rem solid var(--neutral-400);
  border-radius: 0.5rem; // or use .br-md utility
  box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.1);
  padding: 1rem;
  width: 14rem;
  transition:
    width 250ms cubic-bezier(0.4, 0, 0.2, 1),
    height 250ms cubic-bezier(0.4, 0, 0.2, 1);

  &.collapsed {
    width: 14rem;
    cursor: pointer;
  }

  &.expanded {
    width: 22rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    color: var(--neutral-700);
    font-size: var(--typography-body-l);
    font-weight: 500;
  }

  .productList {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.75rem;

    .productItem {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      background: var(--neutral-200);
      border-radius: 0.375rem;

      .productImage {
        width: 3rem;
        height: 3rem;
        border-radius: 0.25rem;
        overflow: hidden;
        flex-shrink: 0;
      }

      .productInfo {
        flex: 1;
        min-width: 0;
        font-size: var(--typography-body-m);
        color: var(--neutral-600);
      }

      .removeButton {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0.25rem;
        color: var(--primary-error);
        flex-shrink: 0;

        &:hover {
          color: var(--primary-red);
        }
      }
    }
  }

  .actions {
    display: flex;
    gap: 0.5rem;

    .compareButton,
    .clearButton {
      flex: 1;
      padding: 0.5rem 1rem;
      font-size: var(--typography-body-m);
      border-radius: 0.25rem;
      transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .compareButton {
      background: var(--primary-red);
      color: var(--neutral-white);

      &:hover {
        background: color-mix(in srgb, var(--primary-red) 90%, black);
      }
    }

    .clearButton {
      background: var(--neutral-300);
      color: var(--neutral-700);

      &:hover {
        background: var(--neutral-400);
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile styles (nested at end)
    bottom: 1rem;
    right: 1rem;
    width: calc(100vw - 2rem);
    max-width: 22rem;

    &.collapsed {
      width: 12rem;
    }

    &.expanded {
      width: calc(100vw - 2rem);
      max-width: 22rem;
    }

    .header {
      font-size: var(--typography-body-m);
    }

    .productList {
      gap: 0.5rem;

      .productItem {
        gap: 0.5rem;
        padding: 0.375rem;

        .productImage {
          width: 2.5rem;
          height: 2.5rem;
        }
      }
    }
  }
}

// Comparison Table
.comparisonTable {
  // Desktop table styles - ALL UNITS IN REM
  width: 100%;
  border-collapse: collapse;
  border: 0.0625rem solid var(--neutral-400);
  border-radius: 0.5rem;
  overflow: hidden;

  .tableHeader {
    background: var(--neutral-200);
    font-weight: 500;
  }

  .headerCell,
  .dataCell {
    padding: 1rem;
    border: 0.0625rem solid var(--neutral-400);
    text-align: left;
    vertical-align: top;
  }

  .productCard {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;

    .imageWrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 0.375rem;
      overflow: hidden;
      background: var(--neutral-200);
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .brandName {
        font-size: var(--typography-body-m);
        color: var(--neutral-600);
      }

      .productName {
        font-size: var(--typography-body-l);
        color: var(--neutral-700);
        font-weight: 500;
      }

      .price {
        font-size: var(--typography-body-xl);
        color: var(--neutral-700);
        font-weight: 500;
        margin-top: 0.25rem;
      }
    }
  }

  .dataRow {
    &:nth-child(even) {
      background: var(--neutral-300);
    }

    &:nth-child(odd) {
      background: var(--neutral-white);
    }

    .heading {
      font-weight: 500;
      color: var(--neutral-700);
      font-size: var(--typography-body-m);
      width: 15rem;
    }

    .value {
      font-size: var(--typography-body-l);
      color: var(--neutral-600);

      &.empty {
        color: var(--neutral-500);
        text-align: center;
      }
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile: Switch to card layout
    display: flex;
    flex-direction: column;
    border: none;

    .tableHeader {
      display: none;
    }

    .productCard {
      border: 0.0625rem solid var(--neutral-400);
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
      padding: 1rem;

      .imageWrapper {
        max-width: 12rem;
        margin: 0 auto;
      }

      .info {
        text-align: center;
      }
    }

    .dataRow {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 0.0625rem solid var(--neutral-400);

      &:last-child {
        border-bottom: none;
      }

      .heading {
        width: auto;
        flex: 1;
      }

      .value {
        flex: 1;
        text-align: right;
      }
    }
  }
}

// ProductCard AddToComparisonButton styles
// apps/web/src/components/ui/ProductCard/styles.module.scss
// (Add to existing file)

.addToComparison {
  // Existing styles preserved
  // Add new state styles

  &[data-in-comparison='true'] {
    background-color: rgba(0, 145, 22, 0.1);
    border-color: var(--primary-success);

    span {
      color: var(--primary-success);
    }

    svg {
      stroke: var(--primary-success);
    }
  }
}
```

---

## 16. File Checklist

### Files to Create

**Utilities & Helpers**:

- [x] `apps/web/src/global/comparison/types.ts`
- [x] `apps/web/src/global/comparison/cookie-manager.ts`
- [x] `apps/web/src/global/comparison/comparison-helpers.ts`

**Queries**:

- [x] `apps/web/src/global/sanity/query.ts` (add comparison queries)

**Components**:

- [ ] `apps/web/src/components/ui/ProductCard/AddToComparisonButton.tsx` (NEW)
- [ ] `apps/web/src/components/comparison/FloatingComparisonBox.tsx`
- [ ] `apps/web/src/components/comparison/ComparisonTable.tsx`
- [ ] `apps/web/src/components/comparison/ComparisonProductCard.tsx`
- [ ] `apps/web/src/components/comparison/styles.module.scss`

**Pages**:

- [ ] `apps/web/src/app/porownaj/page.tsx`
- [ ] `apps/web/src/app/porownaj/loading.tsx`

### Files to Modify

**Package Management**:

- [ ] Install Sonner: `bun add sonner`

**Existing Components**:

- [ ] `apps/web/src/app/layout.tsx` (add `<Toaster />` from Sonner + FloatingComparisonBox)
- [ ] `apps/web/src/components/ui/ProductCard/index.tsx`
- [ ] `apps/web/src/components/products/ProductHero/AddToComparison.tsx`
- [ ] `apps/web/src/components/products/ProductHero/index.tsx` (pass props to AddToComparison)

**Global Types** (Optional):

- [ ] `apps/web/src/global/types.ts` (add ComparisonProduct type if needed)

---

## 17. Success Criteria

### Functional Requirements

- [ ] User can add product to comparison from ProductCard
- [ ] User can add product to comparison from ProductHero
- [ ] User can add up to 3 products maximum
- [ ] Validation prevents products from different categories
- [ ] Toast notifications show for all user actions (add, remove, clear, errors)
- [ ] Floating box appears when comparison has products
- [ ] Floating box can expand/collapse
- [ ] User can remove products from floating box
- [ ] User can clear all products from floating box
- [ ] "Compare" button navigates to `/porownaj`
- [ ] Comparison page displays all products side-by-side
- [ ] Technical data aligns correctly by heading
- [ ] Missing data displays as "----"
- [ ] Comparison persists across page reloads
- [ ] Comparison expires after 7 days
- [ ] No `alert()` calls - all feedback via Sonner toast

### Non-Functional Requirements

- [ ] Comparison page loads in < 1 second
- [ ] Floating box animates smoothly (no jank)
- [ ] ARIA labels present for all interactive elements
- [ ] Keyboard navigation works for all actions
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] No console errors or warnings
- [ ] Cookie size stays under 1KB
- [ ] Component re-renders are optimized (React.memo where needed)

### Edge Cases Covered

- [ ] Adding same product twice (prevented)
- [ ] Adding 4th product (prevented with message)
- [ ] Adding product from different category (prevented with message)
- [ ] Product deleted from Sanity (silently removed from comparison)
- [ ] Malformed cookie data (silently reset)
- [ ] Empty comparison page (empty state with CTA)
- [ ] Single product comparison (allowed, shows single column)
- [ ] Browser without cookies (subtle message)

---

## 18. Implementation Example: Cookie Manager

Below is a complete implementation example for the cookie manager utility following Next.js 16 best practices:

```typescript
// apps/web/src/global/comparison/cookie-manager.ts
import type { ComparisonCookie } from './types';

const COOKIE_NAME = 'audiofast_comparison';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MAX_PRODUCTS = 3;

/**
 * Get comparison cookie (CLIENT-SIDE ONLY)
 * Use this in Client Components, useEffect, and event handlers
 */
export function getComparisonCookie(): ComparisonCookie | null {
  if (typeof window === 'undefined') {
    // Should never be called on server - throw helpful error
    throw new Error(
      'getComparisonCookie() is client-only. Use getComparisonCookieServer() in Server Components.'
    );
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];

  if (!cookieValue) return null;

  try {
    return JSON.parse(decodeURIComponent(cookieValue));
  } catch {
    return null;
  }
}

/**
 * Get comparison cookie (SERVER-SIDE ONLY)
 * Use this in Server Components - requires async/await
 * Import from 'next/headers' at call site
 */
export async function getComparisonCookieServer(
  cookieStore: Awaited<ReturnType<typeof import('next/headers').cookies>>
): Promise<ComparisonCookie | null> {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

/**
 * Set comparison cookie (CLIENT-SIDE ONLY)
 */
export function setComparisonCookie(data: ComparisonCookie): void {
  if (typeof window === 'undefined') {
    throw new Error('setComparisonCookie can only be called on the client');
  }

  const cookieValue = encodeURIComponent(JSON.stringify(data));
  const secure = window.location.protocol === 'https:';

  document.cookie = `${COOKIE_NAME}=${cookieValue}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax${secure ? '; secure' : ''}`;
}

/**
 * Add product to comparison
 */
export function addProductToComparison(
  productId: string,
  categorySlug: string
): { success: boolean; error?: string } {
  const current = getComparisonCookie();

  // Check if already in comparison
  if (current?.productIds.includes(productId)) {
    return { success: false, error: 'Ten produkt jest już w porównaniu' };
  }

  // Check max products
  if (current && current.productIds.length >= MAX_PRODUCTS) {
    return {
      success: false,
      error: 'Możesz porównywać maksymalnie 3 produkty',
    };
  }

  // Check category match
  if (current && current.categorySlug !== categorySlug) {
    return {
      success: false,
      error: 'Możesz porównywać tylko produkty z tej samej kategorii',
    };
  }

  // Add product
  const newData: ComparisonCookie = {
    categorySlug,
    productIds: current ? [...current.productIds, productId] : [productId],
    timestamp: Date.now(),
  };

  setComparisonCookie(newData);
  return { success: true };
}

/**
 * Remove product from comparison
 */
export function removeProductFromComparison(productId: string): void {
  const current = getComparisonCookie();
  if (!current) return;

  const newProductIds = current.productIds.filter((id) => id !== productId);

  if (newProductIds.length === 0) {
    clearComparison();
  } else {
    setComparisonCookie({
      ...current,
      productIds: newProductIds,
      timestamp: Date.now(),
    });
  }
}

/**
 * Clear all products from comparison
 */
export function clearComparison(): void {
  if (typeof window === 'undefined') {
    throw new Error('clearComparison can only be called on the client');
  }

  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
}

/**
 * Check if product is in comparison
 */
export function isProductInComparison(productId: string): boolean {
  const current = getComparisonCookie();
  return current?.productIds.includes(productId) ?? false;
}

/**
 * Get comparison count
 */
export function getComparisonCount(): number {
  const current = getComparisonCookie();
  return current?.productIds.length ?? 0;
}
```

---

## 19. Key Takeaways

### Why Option 2 (Separate Data Sources)?

1. **Simpler Implementation**: No schema changes, no complex merging logic
2. **Clear Separation of Concerns**: Filters for filtering, technical data for display
3. **Flexible**: Admins can have different data for filtering vs. comparison
4. **Easier Maintenance**: Changes to one don't affect the other
5. **Graceful Degradation**: Missing headings just show "----" (acceptable UX)

### Why Cookies Over Context?

1. **Persistence**: Survives page reloads and navigation
2. **SSR Compatibility**: Server can read comparison state
3. **Simpler State Management**: No global provider needed
4. **Standard Pattern**: Used by e-commerce sites everywhere
5. **No External Dependencies**: Built-in browser API

### Why Client Components Where Needed?

1. **FloatingBox**: Needs state, event listeners, cookie writes
2. **ComparisonTable**: Needs interactive remove actions
3. **Add Buttons**: Need event handlers, visual feedback
4. **Comparison Page Shell**: Server component for SEO, passes data to client children

### Performance Wins

1. **Server-side Rendering**: Comparison page is SSR (fast initial load)
2. **Minimal Data in Cookie**: Only IDs, not full product objects
3. **Code Splitting**: Comparison page is route-split (not in main bundle)
4. **Image Optimization**: Next.js Image component throughout
5. **React.memo**: Prevents unnecessary re-renders

---

## 20. Implementation Order Summary

1. **Foundation** → Cookie utilities, helpers, types, queries
2. **Floating Box** → UI component, styling, cookie integration
3. **Add to Comparison** → Wire up existing buttons in ProductCard and ProductHero
4. **Comparison Page** → Full page with table, mobile layout, empty state
5. **Polish** → Loading states, errors, accessibility, animations

**Total Estimated Time**: 13 hours (can be split across multiple sessions)

**Minimal Viable Product** (First 3 phases): 7 hours

- Basic functionality working (add, remove, floating box)
- Comparison page not yet implemented
- Can iterate and add full page later

---

## 21. Toast Notification Patterns

### Success Toasts (Green)

```typescript
toast.success('Produkt dodany do porównania');
toast.success('Porównanie zaktualizowane');
```

### Error Toasts (Red)

```typescript
toast.error('Możesz porównywać maksymalnie 3 produkty');
toast.error('Możesz porównywać tylko produkty z tej samej kategorii');
toast.error('Nie można dodać produktu bez kategorii');
```

### Info Toasts (Blue)

```typescript
toast.info('Produkt usunięty z porównania');
toast.info('Porównanie wyczyszczone');
toast.info('Produkt jest już w porównaniu');
```

### Warning Toasts (Orange)

```typescript
toast.warning('Ta funkcja wymaga włączonych cookies');
```

### Toast Best Practices

1. **Keep messages short** - Max 50 characters
2. **Use Polish language** - Match the rest of the UI
3. **Be action-oriented** - Tell users what happened
4. **Avoid technical jargon** - User-friendly language
5. **Position consistently** - Always bottom-right (matches FloatingBox)
6. **Rich colors enabled** - Better visual hierarchy
7. **Auto-dismiss** - Let Sonner handle timing (except errors)

### Import Pattern

Always import toast at the top of Client Components:

```typescript
'use client';
import { toast } from 'sonner';
```

---

## 22. Next.js 16 Updates Summary

This implementation plan has been reviewed and updated to comply with Next.js 16 best practices:

### Key Updates Made:

1. **✅ Async Cookies API**
   - Updated all cookie reading in Server Components to use `await cookies()`
   - Split cookie manager into client-only and server-only functions
   - Added clear usage examples for both environments

2. **✅ Component Strategy Clarification**
   - Explicitly defined which components are Server vs Client Components
   - Added reasoning for each `'use client'` boundary
   - Emphasized Server Components as default for better performance

3. **✅ Modern Caching Patterns**
   - Removed references to legacy `unstable_cache` (deprecated)
   - Recommended `cache: 'force-cache'` for Sanity queries
   - Added guidance on using `'use cache'` directive (Cache Components)
   - Clarified `revalidatePath()` usage in Server Actions

4. **✅ Serializable Props Enforcement**
   - Documented that only plain objects can be passed as props
   - Ensured all Client Component props are JSON-serializable
   - Event handlers defined within Client Components (not passed as props)

5. **✅ Dynamic Rendering Awareness**
   - Documented that `cookies()` opts routes into dynamic rendering
   - Clarified that `/porownaj` page will be dynamically rendered (correct behavior)

6. **✅ Data Fetching Best Practices**
   - Server Components for initial data fetching
   - Client Components for interactive updates
   - Proper use of React hooks (useEffect, useState) in Client Components

### Compliance Checklist:

- [x] Async `cookies()` API usage (Next.js 15+)
- [x] Proper Server vs Client Component boundaries
- [x] Modern caching and revalidation APIs
- [x] Serializable props between Server/Client Components
- [x] No use of deprecated APIs (`unstable_cache`)
- [x] Proper error handling for async operations
- [x] Dynamic rendering awareness with `cookies()`

### Performance Benefits of Next.js 16 Approach:

- **Smaller JavaScript bundles**: Server Components don't ship to client
- **Faster initial page load**: HTML pre-rendered on server
- **Better SEO**: Comparison page can be crawled and indexed
- **Optimized data fetching**: Server-side queries are faster (close to database)
- **Automatic code splitting**: Route-based splitting by default

---

**Document Version**: 2.0 (Next.js 16 Compliant)  
**Last Updated**: November 13, 2025  
**Implementation Status**: Ready to Begin  
**Next.js Version**: 16.0.2+
