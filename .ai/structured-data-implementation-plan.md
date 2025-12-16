# Structured Data Implementation Plan

> **Business Context:** Audiofast is a product distributor based in Łódź, Poland. They have their own physical store and distribute audio equipment from various brands to other shops across Poland. This is an informational/catalog website, not an e-commerce store. The primary CTA is a contact form.

---

## Part 1: Current Structured Data Audit

### 1.1 OrganizationSchema ✅ Good

**Location:** `apps/web/src/components/schema/OrganizationSchema.tsx`
**Used in:** `apps/web/src/app/layout.tsx` (global)

**Current implementation:**

- Uses combined `@type: ["Organization", "LocalBusiness", "Store"]`
- Includes: name, description, url, logo, address, email, telephone, geo coordinates, social media links, price range, contact point

**Assessment:** ✅ **Well implemented** - Appropriate for a distributor with a physical store.

**Minor improvement (optional):**

- Could add `areaServed` to indicate distribution coverage (Poland)
- Could add `openingHours` for the Łódź store

---

### 1.2 BreadcrumbsSchema ✅ Good

**Location:** `apps/web/src/components/schema/BreadcrumbsSchema.tsx`
**Used in:** Most pages via `Breadcrumbs` component

**Current implementation:**

- Standard BreadcrumbList with position, name, item
- Includes `itemListOrder` and `numberOfItems`

**Assessment:** ✅ **Well implemented** - Follows Google guidelines.

**No changes needed.**

---

### 1.3 CollectionPageSchema ✅ Good

**Location:** `apps/web/src/components/schema/CollectionPageSchema.tsx`
**Used in:** `/produkty/`, `/blog/`, `/marki/`, category pages

**Current implementation:**

- Basic CollectionPage with name, url, description, inLanguage

**Assessment:** ✅ **Sufficient for a non-e-commerce site**

**No changes needed.** ItemList enhancement is not a priority for informational sites.

---

### 1.4 BlogPostSchema ✅ Good

**Location:** `apps/web/src/components/schema/BlogPostSchema.tsx`
**Used in:** `/blog/[slug]/`

**Current implementation:**

- Comprehensive BlogPosting schema
- Includes: headline, description, image, dates, author, publisher, category, keywords, wordCount, articleBody

**Assessment:** ✅ **Well implemented** - Very thorough.

**No changes needed.**

---

### 1.5 FaqSchema ✅ Good

**Location:** `apps/web/src/components/schema/FaqSchema.tsx`
**Used in:** Pages with FAQ sections (via PageBuilder)

**Current implementation:**

- FAQPage with Question/Answer pairs
- Converts Portable Text to HTML for answers

**Assessment:** ✅ **Well implemented** - Follows Google guidelines.

**No changes needed.**

---

## Part 2: Missing Structured Data (Recommended)

Based on Audiofast's business model as a **product distributor with informational content**, these schemas would be beneficial:

### 2.1 WebSite Schema 🔴 High Priority

**Purpose:** Establishes site identity for Google Knowledge Graph
**Effort:** Low (simple addition to layout)

**Where:** Global (layout.tsx, alongside OrganizationSchema)

**Why beneficial:**

- Establishes Audiofast as a recognized website entity
- Links website to organization
- Improves site name display in search results

---

### 2.2 Article Schema for Reviews 🔴 High Priority

**Purpose:** Mark review pages as editorial articles
**Effort:** Medium (new component + page integration)

**Where:** `/recenzje/[slug]/` pages

**Why beneficial:**

- Reviews are editorial content about products - this is where Audiofast provides VALUE
- Can qualify for article rich results
- Establishes authority as a product information source
- Better visibility for informational queries like "recenzja [product name]"

**Note:** Use `Article` or `NewsArticle`, NOT `Review` schema. Google prohibits self-written Review schema for products you sell/distribute.

---

### 2.3 Brand Schema 🟠 Medium Priority

**Purpose:** Establish brand pages as authoritative brand information
**Effort:** Low (new component + page integration)

**Where:** `/marki/[slug]/` pages

**Why beneficial:**

- Positions Audiofast as an authoritative source for brand information
- Helps with brand-related searches
- Links brand pages to Knowledge Graph entities

---

## Part 3: NOT Recommended

| Schema                            | Reason                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Product with Offer**            | Not e-commerce - no direct purchasing. Would be misleading.            |
| **ItemList for product listings** | Carousel results are for e-commerce. Not beneficial for catalog sites. |
| **VideoObject**                   | Low priority unless video content becomes a major feature.             |

---

## Part 4: Implementation Plan

### Phase 1: WebSite Schema (Quick Win)

**Files to create/modify:**

1. Create `apps/web/src/components/schema/WebSiteSchema.tsx`
2. Modify `apps/web/src/app/layout.tsx` to include it

**Schema structure:**

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://audiofast.pl/#website",
  "url": "https://audiofast.pl",
  "name": "Audiofast",
  "description": "Dystrybutor sprzętu audio wysokiej klasy w Polsce",
  "publisher": {
    "@id": "https://audiofast.pl/#organization"
  },
  "inLanguage": "pl-PL"
}
```

**Implementation steps:**

1. Create `WebSiteSchema.tsx` component
2. Add to `layout.tsx` after `OrganizationSchema`
3. Test with Google Rich Results Test

**Estimated time:** 30 minutes

---

### Phase 2: Article Schema for Reviews

**Files to create/modify:**

1. Create `apps/web/src/components/schema/ArticleSchema.tsx`
2. Modify `apps/web/src/app/recenzje/[slug]/page.tsx` to include it
3. May need to check/update `queryReviewBySlug` to ensure all needed fields are fetched

**Schema structure:**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "https://audiofast.pl/recenzje/review-slug/#article",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://audiofast.pl/recenzje/review-slug/"
  },
  "headline": "Review Title",
  "description": "Review excerpt...",
  "image": "https://cdn.sanity.io/images/.../image.jpg",
  "datePublished": "2024-01-15",
  "dateModified": "2024-01-20",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Audiofast",
    "logo": {
      "@type": "ImageObject",
      "url": "https://audiofast.pl/logo.png"
    }
  },
  "articleSection": "Recenzje",
  "inLanguage": "pl-PL"
}
```

**Implementation steps:**

1. Check what data is available in `queryReviewBySlug` (author, dates, content, etc.)
2. Create `ArticleSchema.tsx` component (can reuse logic from `BlogPostSchema.tsx`)
3. Add to review page after Breadcrumbs
4. Test with Google Rich Results Test

**Estimated time:** 1-2 hours

---

### Phase 3: Brand Schema

**Files to create/modify:**

1. Create `apps/web/src/components/schema/BrandSchema.tsx`
2. Modify `apps/web/src/app/marki/[slug]/page.tsx` to include it

**Schema structure:**

```json
{
  "@context": "https://schema.org",
  "@type": "Brand",
  "@id": "https://audiofast.pl/marki/brand-slug/#brand",
  "name": "Brand Name",
  "description": "Brand description...",
  "logo": "https://cdn.sanity.io/images/.../logo.jpg",
  "url": "https://audiofast.pl/marki/brand-slug/"
}
```

**Implementation steps:**

1. Create `BrandSchema.tsx` component
2. Add to brand page after Breadcrumbs
3. Pass brand data (name, description, logo, slug)
4. Test with Google Rich Results Test

**Estimated time:** 1 hour

---

## Part 5: Implementation Checklist

### Pre-Implementation

- [ ] Verify `BASE_URL` constant is correctly set
- [ ] Ensure Sanity queries return all needed fields

### Phase 1: WebSite Schema

- [x] Create `WebSiteSchema.tsx`
- [x] Add to `layout.tsx`
- [ ] Test with Rich Results Test
- [ ] Deploy and verify in Search Console

### Phase 2: Article Schema

- [x] Review `queryReviewBySlug` for available fields
- [x] Create `ArticleSchema.tsx`
- [x] Add to `/recenzje/[slug]/page.tsx`
- [ ] Test with Rich Results Test
- [ ] Deploy and verify in Search Console

### Phase 3: Brand Schema

- [x] Create `BrandSchema.tsx`
- [x] Add to `/marki/[slug]/page.tsx`
- [ ] Test with Rich Results Test
- [ ] Deploy and verify in Search Console

### Post-Implementation

- [ ] Monitor Search Console for structured data errors
- [ ] Check for rich results appearance after 1-2 weeks
- [ ] Document any issues encountered

---

## Part 6: Testing & Validation

**Tools to use:**

1. **Google Rich Results Test:** https://search.google.com/test/rich-results
2. **Schema Markup Validator:** https://validator.schema.org/
3. **Google Search Console:** Monitor structured data reports

**Test pages:**

- Homepage (WebSite + Organization)
- Any review page (Article)
- Any brand page (Brand)

---

## Summary

| Schema                | Priority  | Effort | Status  |
| --------------------- | --------- | ------ | ------- |
| Organization          | -         | -      | ✅ Done |
| Breadcrumbs           | -         | -      | ✅ Done |
| CollectionPage        | -         | -      | ✅ Done |
| BlogPosting           | -         | -      | ✅ Done |
| FAQPage               | -         | -      | ✅ Done |
| **WebSite**           | 🔴 High   | Low    | ✅ Done |
| **Article (Reviews)** | 🔴 High   | Medium | ✅ Done |
| **Brand**             | 🟠 Medium | Low    | ✅ Done |

**Total estimated implementation time:** 3-4 hours
