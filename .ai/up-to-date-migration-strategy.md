# Up-to-Date Database Migration Strategy

## Overview

This document outlines the comprehensive end-to-end strategy for migrating content from the **up-to-date legacy database** (as of December 2025) to Sanity CMS. This is a fresh migration to replace data from the May 2025 database copy.

> **Previous Migration**: In May 2025, we migrated 816 products, 314 awards, stores, reviews, categories, brands, and blog articles from a database snapshot. Now we need to refresh with the current up-to-date database.

---

## Migration Order & Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Preparation & Data Export                             │
│  • Export all required CSVs from up-to-date phpMyAdmin          │
│  • Place CSVs in /csv/ folder with proper subfolders            │
│  • Verify database server accessibility for image downloads     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Check for New Dealers/Stores (May 2025 → Now)         │
│  • ✅ VERIFIED: 49 dealers in DB = 49 stores in Sanity          │
│  • ✅ RESULT: No new dealers since May 2025                     │
│  • ✅ ACTION: SKIP store migration                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Review Authors Check & Migration                      │
│  • ✅ VERIFIED: 194 rows → 191 unique authors in CSV            │
│  • ✅ MIGRATED: 190 authors (1 failed - invalid data)           │
│  • ✅ RESULT: 193 total authors now in Sanity                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Reviews Migration                                     │
│  • Migrate all reviews (page, pdf, external)                    │
│  • Reviews have NO external references (independent)            │
│  • Status: Script exists but NEEDS RESTRUCTURING                │
│            (modeled after products/awards scripts)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Products Migration                                    │
│  • Products reference: reviews (yes), dealers (no - brand-level)│
│  • Status: FULLY WORKING end-to-end script                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Awards Migration                                      │
│  • Awards reference: products (yes)                             │
│  • Must run AFTER products are migrated                         │
│  • Status: FULLY WORKING end-to-end script                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Doesn't Need Re-Migration

Based on analysis, these haven't changed since May 2025:

| Content Type           | Status                 | Reason                  |
| ---------------------- | ---------------------- | ----------------------- |
| **Product Categories** | ✅ No migration needed | Static data, no changes |
| **Blog Articles**      | ✅ No migration needed | Static data, no changes |
| **Brands**             | ✅ No migration needed | Static data, no changes |

---

## What DOES Need Re-Migration

| Content Type       | Status              | Dependencies | Script Status        |
| ------------------ | ------------------- | ------------ | -------------------- |
| **Stores/Dealers** | ✅ SKIP (no change) | None         | N/A                  |
| **Review Authors** | ✅ DONE (193 total) | None         | ✅ Working           |
| **Reviews**        | 🔄 Migrate          | Authors      | ⚠️ Needs restructure |
| **Products**       | 🔄 Migrate          | Reviews      | ✅ Fully working     |
| **Awards**         | 🔄 Migrate          | Products     | ✅ Fully working     |

---

## Required CSV Files

All CSVs should be exported from **phpMyAdmin** and placed in the `/csv/` folder:

### Folder Structure

```
csv/
├── stores/
│   └── dealers.csv
├── reviews/
│   ├── reviews-all.csv
│   └── review-authors.csv
├── products/
│   ├── products-main.csv
│   ├── products-categories.csv
│   ├── products-content-boxes.csv
│   ├── products-gallery-images.csv
│   ├── products-technical-data.csv
│   ├── products-reviews.csv
│   ├── product-brand-slug-map.csv
│   └── sitetree-map.csv
└── awards/
    ├── awards-all.csv
    └── awards-products-relations.csv
```

---

## Phase 0: Data Export Preparation

### 0.1 Export Stores/Dealers CSV

```sql
-- dealers.csv
SELECT
  d.ID,
  d.Name,
  d.Street,
  d.PostalCode,
  d.City,
  d.Phone,
  d.Email,
  d.WWW as Website,
  d.Publish
FROM Dealer d
ORDER BY d.ID;
```

**Expected Columns**: `ID`, `Name`, `Street`, `PostalCode`, `City`, `Phone`, `Email`, `Website`, `Publish`

### 0.2 Export Review Authors CSV

```sql
-- review-authors.csv
SELECT
  COUNT(*) as ReviewCount,
  COALESCE(
    NULLIF(TRIM(rp.Author), ''),
    (SELECT
      SUBSTRING_INDEX(SUBSTRING_INDEX(st.Title, ' w ', -1), '"', 1)
      FROM SiteTree st
      WHERE st.ID = rp.ID
      LIMIT 1
    )
  ) as AuthorName
FROM ReviewPage rp
JOIN SiteTree st ON rp.ID = st.ID
WHERE st.ClassName = 'ReviewPage'
GROUP BY AuthorName
HAVING AuthorName IS NOT NULL AND AuthorName != ''
ORDER BY ReviewCount DESC;
```

### 0.3 Export Reviews CSV

```sql
-- reviews-all.csv
SELECT
  rp.ID,
  st.URLSegment as Slug,
  st.Title as PageTitle,
  st.MenuTitle,
  rp.Content,
  COALESCE(
    NULLIF(TRIM(rp.Author), ''),
    SUBSTRING_INDEX(SUBSTRING_INDEX(st.Title, ' w ', -1), '"', 1)
  ) as AuthorName,
  rp.CoverID,
  f_cover.FileFilename as CoverFilename,
  rp.ArticleDate,
  rp.ExternalLink,
  rp.PDFFileID,
  f_pdf.FileFilename as PDFFilename,
  CASE
    WHEN rp.ExternalLink IS NOT NULL AND rp.ExternalLink != '' THEN 'external'
    WHEN rp.PDFFileID > 0 THEN 'pdf'
    ELSE 'page'
  END as ReviewType,
  rp.PageSections
FROM ReviewPage rp
JOIN SiteTree st ON rp.ID = st.ID
LEFT JOIN File f_cover ON rp.CoverID = f_cover.ID
LEFT JOIN File f_pdf ON rp.PDFFileID = f_pdf.ID
WHERE st.ClassName = 'ReviewPage'
ORDER BY rp.ID;
```

### 0.4 Export Products CSVs

See [Product Migration Plan](./product-migration-plan.md) for all 8 product-related SQL queries.

### 0.5 Export Awards CSVs

See [Award Migration Plan](./award-migration-plan.md) for awards SQL queries.

---

## Phase 1: Stores/Dealers Check & Migration

### ✅ PHASE COMPLETE - NO MIGRATION NEEDED

**Verification Date**: 2025-12-20

| Source                  | Total | Published | Unpublished |
| ----------------------- | ----- | --------- | ----------- |
| **Up-to-date Database** | 49    | 44        | 5           |
| **Sanity CMS**          | 49    | -         | -           |

**Result**: Counts match exactly. No new dealers were added since May 2025.

**Action**: ✅ SKIP store migration - proceed directly to Phase 2 (Review Authors).

---

## Phase 2: Review Authors Check & Migration

### ✅ PHASE COMPLETE

**Migration Date**: 2025-12-20

| Metric                    | Count |
| ------------------------- | ----- |
| **CSV Rows**              | 194   |
| **Unique Authors**        | 191   |
| **Successfully Migrated** | 190   |
| **Failed (ID too long)**  | 1     |
| **Total in Sanity**       | 193   |

**Note**: The 1 failed author was garbage data - a review title that accidentally ended up in the author field ("Test przedwzmacniacza liniowego ze wzmacniaczem słuchawkowym..."). This can be ignored.

**Script Used**: `apps/studio/scripts/migration/reviews/migrate-review-authors.ts`

```bash
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --csv=./csv/reviews/review-authors.csv
```

---

## Phase 3: Reviews Migration

### 3.1 Current Script Status

**Location**: `apps/studio/scripts/migration/reviews/migrate-reviews.ts`

**Issues**:

- ❌ No proper rollback functionality
- ❌ No batch processing with proper error recovery
- ❌ No image caching (re-uploads on retry)
- ❌ No migration report
- ❌ No `--skip-existing` flag
- ⚠️ Less structured than products/awards scripts

### 3.2 Required Improvements

The reviews migration script should be restructured to match the quality of `migrate-products.ts` and `migrate-awards.ts`:

#### Structure to Match

```
apps/studio/scripts/migration/reviews/
├── migrate-reviews.ts          # Main migration script (restructured)
├── migrate-review-authors.ts   # ✅ Already working
├── types.ts                    # TypeScript interfaces
├── parser/
│   ├── csv-parser.ts           # CSV parsing utilities
│   └── html-to-portable-text.ts # HTML → PT conversion
├── utils/
│   ├── image-processor.ts      # Image optimization & upload
│   ├── pdf-uploader.ts         # PDF file upload
│   └── sanity-client.ts        # Sanity client setup
├── image-cache.json            # Cached image uploads
└── README.md                   # Usage documentation
```

#### Features to Add

1. **Rollback functionality**:

   ```bash
   bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --rollback
   ```

2. **Image caching**:
   - Cache uploaded images to `image-cache.json`
   - Resume-able migration on failures

3. **Batch processing**:
   - Process in batches of 10-20
   - Proper error handling per batch

4. **Migration report**:
   - Total reviews migrated
   - Failed reviews with reasons
   - Missing images/PDFs
   - Author resolution issues

5. **Skip existing**:
   ```bash
   bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --skip-existing
   ```

### 3.3 Review Document ID Pattern

```
review-{legacy-id}
```

Example: Legacy ID `123` → Sanity ID `review-123`

### 3.4 Migration Command (after restructuring)

```bash
# Dry run
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv --dry-run

# Live migration
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv

# With options
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --skip-existing \
  --batch-size=10 \
  --verbose

# Rollback
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --rollback
```

---

## Phase 4: Products Migration

### 4.1 Script Status

**Location**: `apps/studio/scripts/migration/products/`

- ✅ Fully working end-to-end
- ✅ Image optimization (WebP)
- ✅ Image caching
- ✅ Batch processing
- ✅ Migration reports
- ✅ Rollback support
- ✅ Review reference resolution

### 4.2 Pre-Migration Verification

Before migrating products:

1. ✅ All reviews migrated (Phase 3)
2. ✅ All brands exist in Sanity (no changes needed)
3. ✅ All categories exist in Sanity (no changes needed)

### 4.3 Migration Commands

```bash
# Dry run
bun run apps/studio/scripts/migration/products/migrate-products.ts --dry-run

# Migrate all products
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-products.ts

# Migrate by brand
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Wilson Audio"

# With options
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-products.ts \
  --skip-existing \
  --batch-size=10 \
  --verbose

# Rollback all products
bun run apps/studio/scripts/migration/products/migrate-products.ts --rollback
```

### 4.4 Product Document ID Pattern

```
product-{legacy-id}
```

### 4.5 Store/Dealer References in Products

> **Important**: Store availability is managed at the **brand level**, not product level.
> Products do NOT directly reference stores, so the store migration order doesn't affect products.

---

## Phase 5: Awards Migration

### 5.1 Script Status

**Location**: `apps/studio/scripts/migration/awards/`

- ✅ Fully working end-to-end
- ✅ Image optimization (WebP)
- ✅ Image caching
- ✅ Product reference resolution
- ✅ Rollback support

### 5.2 Pre-Migration Verification

Before migrating awards:

1. ✅ All products migrated (Phase 4)

### 5.3 Migration Commands

```bash
# Dry run
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --dry-run

# Migrate all awards
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/awards/migrate-awards.ts

# With options
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/awards/migrate-awards.ts \
  --skip-existing \
  --verbose

# Rollback all awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --rollback
```

### 5.4 Award Document ID Pattern

```
award-{legacy-id}
```

---

## Summary: Migration Execution Checklist

### Pre-Migration

- [ ] Export all CSVs from up-to-date phpMyAdmin
- [ ] Place CSVs in `/csv/` folder with proper structure
- [ ] Verify legacy image server is accessible
- [ ] Have `SANITY_API_TOKEN` ready
- [ ] Test all scripts with `--dry-run`

### Phase 1: Stores (if needed)

- [ ] Check dealer count (DB vs Sanity)
- [ ] If new dealers exist:
  - [ ] Update store migration script to use CSV
  - [ ] Run store migration
  - [ ] Verify store count

### Phase 2: Review Authors

- [ ] Export review authors CSV
- [ ] Run `--dry-run` to check for new authors
- [ ] Migrate new authors
- [ ] Verify author count

### Phase 3: Reviews

- [ ] Restructure reviews script (if not done)
- [ ] Export reviews CSV
- [ ] Run `--dry-run`
- [ ] Migrate all reviews
- [ ] Verify review counts by type (page, pdf, external)

### Phase 4: Products

- [ ] Export all 8 product CSVs
- [ ] Run `--dry-run`
- [ ] Migrate all products
- [ ] Verify product count
- [ ] Check for missing images

### Phase 5: Awards

- [ ] Export awards CSVs
- [ ] Run `--dry-run`
- [ ] Migrate all awards
- [ ] Verify award count
- [ ] Check product references

### Post-Migration

- [ ] Run validation GROQ queries for all content types
- [ ] Spot-check random documents in Sanity Studio
- [ ] Test frontend pages
- [ ] Monitor for 404s and broken links

---

## Validation Queries

### Stores

```groq
// Count all stores
count(*[_type == "store" && !(_id match "drafts.*")])

// Stores without phone
*[_type == "store" && !defined(phone)]{ name, _id }
```

### Reviews

```groq
// Count by type
{
  "total": count(*[_type == "review"]),
  "page": count(*[_type == "review" && destinationType == "page"]),
  "pdf": count(*[_type == "review" && destinationType == "pdf"]),
  "external": count(*[_type == "review" && destinationType == "external"])
}

// Reviews without author
*[_type == "review" && !defined(author)]{ title, _id }

// Reviews without image
*[_type == "review" && !defined(image)]{ title, _id }
```

### Products

```groq
// Count all products
count(*[_type == "product" && !(_id match "drafts.*")])

// Products without preview image
*[_type == "product" && !defined(previewImage)]{ name, _id }

// Products without brand
*[_type == "product" && !defined(brand)]{ name, _id }

// Products by brand
*[_type == "brand"] {
  name,
  "productCount": count(*[_type == "product" && brand._ref == ^._id])
} | order(productCount desc)
```

### Awards

```groq
// Count all awards
count(*[_type == "award" && !(_id match "drafts.*")])

// Awards without logo
*[_type == "award" && !defined(logo)]{ name, _id }

// Awards with broken product references
*[_type == "award" && count(products[!defined(@->)]) > 0]{
  name,
  _id,
  "brokenRefs": count(products[!defined(@->)])
}

// Awards with most products
*[_type == "award"] | order(count(products) desc)[0...10]{
  name,
  "productCount": count(products)
}
```

---

## Rollback Strategy

All migration scripts support rollback using document ID patterns:

| Content Type   | ID Pattern             | Rollback Query                                              |
| -------------- | ---------------------- | ----------------------------------------------------------- |
| Stores         | `store-dealer-{id}`    | `*[_type == "store" && _id match "store-dealer-*"]`         |
| Review Authors | `review-author-{slug}` | `*[_type == "reviewAuthor" && _id match "review-author-*"]` |
| Reviews        | `review-{id}`          | `*[_type == "review" && _id match "review-*"]`              |
| Products       | `product-{id}`         | `*[_type == "product" && _id match "product-*"]`            |
| Awards         | `award-{id}`           | `*[_type == "award" && _id match "award-*"]`                |

---

## Expected Migration Results

Based on legacy data analysis:

| Content Type       | Expected Count | Notes                    |
| ------------------ | -------------- | ------------------------ |
| Stores/Dealers     | ~15-20         | Check for new entries    |
| Review Authors     | ~50-60         | Deduplicated             |
| Reviews (page)     | ~350           | With full content        |
| Reviews (pdf)      | ~130           | With PDF files           |
| Reviews (external) | ~370           | External links           |
| Products           | ~820-850       | May include new products |
| Awards             | ~320-340       | May include new awards   |

---

## Document Versions

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0     | 2025-12-20 | Initial strategy document |

---

## Related Documentation

- [Product Migration Plan](./product-migration-plan.md) - Detailed product migration specs
- [Product Migration Workflow](./product-migration-workflow.md) - Brand-by-brand workflow
- [Award Migration Plan](./award-migration-plan.md) - Award migration specs
- [Legacy Redirect Implementation Plan](./legacy-redirect-implementation-plan.md) - URL redirects
