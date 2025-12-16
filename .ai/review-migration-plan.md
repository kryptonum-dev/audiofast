# Review Migration Plan

## Overview

This document outlines the comprehensive strategy for migrating reviews from the legacy **SilverStripe CMS** MySQL database to the new **Sanity CMS** platform. The migration involves transferring review authors, review content, images, PDFs, and external links while preserving data integrity.

---

## 1. Source System Analysis

### 1.1 Database Tables

| Table        | Purpose                      | Key Fields                                                                           |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------ |
| `ReviewPage` | Review content and metadata  | `ID`, `LeadingText`, `Author`, `CoverID`, `ArticleDate`, `ExternalLink`, `PDFFileID` |
| `SiteTree`   | Page metadata (titles, URLs) | `ID`, `URLSegment`, `Title`, `ClassName='ReviewPage'`                                |
| `File`       | Image and PDF assets         | `ID`, `FileFilename`, `ClassName`                                                    |

### 1.2 ReviewPage Table Structure

```sql
CREATE TABLE `ReviewPage` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `LeadingText_pl_PL` mediumtext,        -- Polish content (legacy)
  `LeadingText` mediumtext,               -- Content HTML
  `Author_pl_PL` varchar(200),            -- Author name (legacy)
  `Author` varchar(200),                  -- Author name (e.g., "Hi-Fi Plus", "Wojciech Pacuła")
  `CoverID` int(11),                      -- Reference to File table (cover image)
  `ShowTitle` tinyint(1),                 -- Display title flag
  `ArticleDate` date,                     -- Publication date
  `ExternalLink_pl_PL` varchar(255),      -- External URL (legacy)
  `ExternalLink` varchar(255),            -- External URL (for external type reviews)
  `PDFFileID` int(11)                     -- Reference to File table (PDF file)
);
```

### 1.3 SiteTree Table Structure (Review-related fields)

```sql
-- Key fields for ReviewPage entries:
`ID` int(11)                              -- Same as ReviewPage.ID
`ClassName` = 'ReviewPage'                -- Filter for reviews
`URLSegment` varchar(255)                 -- URL slug for the review
`Title` varchar(255)                      -- Full review title
`MenuTitle` varchar(100)                  -- Short title for menus
```

### 1.4 Review Types Detection

| Type              | Detection Logic                          | Sanity `destinationType` |
| ----------------- | ---------------------------------------- | ------------------------ |
| **External Link** | `ExternalLink` is NOT NULL and NOT empty | `'external'`             |
| **PDF Document**  | `PDFFileID` > 0                          | `'pdf'`                  |
| **Page Content**  | Neither external link nor PDF            | `'page'`                 |

### 1.5 Estimated Record Counts

| Entity          | Estimated Count                        |
| --------------- | -------------------------------------- |
| Reviews (total) | ~819-860                               |
| Unique Authors  | ~30-50 (extracted from `Author` field) |

---

## 2. Target System (Sanity CMS)

### 2.1 Document Types

| Sanity Type    | Description                | Source                           |
| -------------- | -------------------------- | -------------------------------- |
| `reviewAuthor` | Author/publication entity  | Extracted unique `Author` values |
| `review`       | Individual review document | `ReviewPage` + `SiteTree`        |

### 2.2 Review Author Schema (`reviewAuthor`)

```typescript
{
  name: 'reviewAuthor',
  fields: [
    { name: 'name', type: 'string' },        // Required: "Hi-Fi Plus", "Wojciech Pacuła"
    { name: 'websiteUrl', type: 'url' }      // Optional: External website URL
  ]
}
```

### 2.3 Review Schema (`review`)

```typescript
{
  name: 'review',
  fields: [
    { name: 'author', type: 'reference' },      // → reviewAuthor
    { name: 'destinationType', type: 'string' }, // 'page' | 'pdf' | 'external'
    { name: 'name', type: 'string' },           // Short name (breadcrumbs, URL generation)
    { name: 'slug', type: 'slug' },             // OPTIONAL for pdf/external types
    { name: 'title', type: 'array' },           // Portable Text title
    { name: 'image', type: 'image' },           // Cover image
    { name: 'content', type: 'array' },         // Portable Text content (for 'page' type)
    { name: 'pdfFile', type: 'file' },          // PDF file (for 'pdf' type)
    { name: 'externalUrl', type: 'url' },       // External URL (for 'external' type)
    { name: 'seo', type: 'object' }             // SEO metadata (for 'page' type)
  ]
}
```

---

## 3. Migration Phases

```
┌─────────────────────────────────────────────────────────────────┐
│  PRE-PHASE 1: Schema Updates                                    │
│  • Make slug field optional for pdf/external review types       │
│  • Verify schema validation rules                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Author Migration                                      │
│  • Extract unique authors from ReviewPage.Author                │
│  • Create reviewAuthor documents in Sanity                      │
│  • Build author name → Sanity ID mapping                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Single Author Review Migration (Testing)              │
│  • Migrate reviews for ONE author to test the flow              │
│  • Validate all three review types work                         │
│  • Fix any issues before batch migration                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Batch Review Migration                                │
│  • Migrate all remaining reviews                                │
│  • Skip already migrated reviews (idempotent)                   │
│  • Upload images and PDFs to Sanity CDN                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Validation & Cleanup                                  │
│  • Verify all reviews migrated correctly                        │
│  • Check broken references                                      │
│  • Validate assets uploaded successfully                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Pre-Phase 1: Schema Updates

### 4.1 Make Slug Optional for Non-Page Reviews

**File:** `apps/studio/schemaTypes/documents/collections/review.ts`

**Current Issue:** The `slug` field is always required, but it should be optional for `pdf` and `external` review types.

**Required Changes:**

1. Modify the slug field definition to be conditionally required
2. Update validation to only require slug when `destinationType === 'page'`

**Implementation:**

```typescript
// In defineSlugForDocument result, modify to make slug optional:
...(defineSlugForDocument({
  prefix: '/recenzje/',
  source: 'name',
  group: GROUP.MAIN_CONTENT,
}).map((field) => ({
  ...field,
  hidden: ({ document }: any) => document?.destinationType !== 'page',
  // Remove required validation for non-page types
  validation: field.name === 'slug'
    ? (Rule) => Rule.custom((value, context) => {
        const destinationType = (context.document as any)?.destinationType;
        if (destinationType === 'page' && !value?.current) {
          return 'Slug jest wymagany dla recenzji typu "Strona z treścią"';
        }
        return true;
      })
    : field.validation,
})) as FieldDefinition[]),
```

### 4.2 Verification

After schema update:

1. Run `sanity schema extract && sanity typegen generate --enforce-required-fields`
2. Create a test review with `destinationType: 'external'` without slug - should pass validation
3. Create a test review with `destinationType: 'page'` without slug - should fail validation

---

## 5. Phase 1: Author Migration

### 5.1 SQL Query for Author Extraction

```sql
SELECT DISTINCT
  TRIM(COALESCE(Author, Author_pl_PL)) as AuthorName
FROM ReviewPage
WHERE COALESCE(Author, Author_pl_PL) IS NOT NULL
  AND TRIM(COALESCE(Author, Author_pl_PL)) != ''
ORDER BY AuthorName;
```

**Export:** phpMyAdmin → Export as CSV → `review-authors.csv`

### 5.2 Expected Authors (Sample)

Based on the SQL data analysis:

| Author Name        | Type        |
| ------------------ | ----------- |
| The Absolute Sound | Publication |
| Hi-Fi Plus         | Publication |
| High Fidelity      | Publication |
| Stereophile        | Publication |
| HiFi i Muzyka      | Publication |
| Audio Video        | Publication |
| Hi-Fi News         | Publication |
| Hi-Fi Critic       | Publication |
| Audiotechnique     | Publication |
| Wojciech Pacuła    | Person      |
| Chris Thomas       | Person      |
| Michael Fremer     | Person      |
| Ken Kessler        | Person      |
| Alan Sircom        | Person      |
| Robert Harley      | Person      |
| ...                | ...         |

### 5.3 Script: `migrate-review-authors.ts`

**Location:** `apps/studio/scripts/migration/reviews/migrate-review-authors.ts`

**Functionality:**

1. Read authors from CSV (or parse from SQL directly)
2. Normalize author names (trim whitespace, fix encoding)
3. Create `reviewAuthor` documents with predictable IDs
4. Build and save ID mapping file

**ID Pattern:** `review-author-{normalized-name-slug}`

**Example:**

```javascript
{
  _id: 'review-author-hi-fi-plus',
  _type: 'reviewAuthor',
  name: 'Hi-Fi Plus',
  websiteUrl: null // Can be manually added later
}
```

### 5.4 Usage

```bash
# Dry run - preview authors to be created
bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --dry-run

# Execute migration
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts
```

### 5.5 Output

- Creates ~30-50 `reviewAuthor` documents
- Saves mapping file: `apps/studio/scripts/migration/reviews/author-mapping.json`

```json
{
  "Hi-Fi Plus": "review-author-hi-fi-plus",
  "Wojciech Pacuła": "review-author-wojciech-pacula",
  "The Absolute Sound": "review-author-the-absolute-sound"
}
```

---

## 6. Phase 2: Single Author Review Migration (Testing)

### 6.1 SQL Query for Reviews

```sql
SELECT
  r.ID,
  s.URLSegment as Slug,
  s.Title as PageTitle,
  s.MenuTitle,
  r.LeadingText as Content,
  TRIM(COALESCE(r.Author, r.Author_pl_PL)) as AuthorName,
  r.CoverID,
  f_cover.FileFilename as CoverFilename,
  r.ArticleDate,
  TRIM(COALESCE(r.ExternalLink, r.ExternalLink_pl_PL)) as ExternalLink,
  r.PDFFileID,
  f_pdf.FileFilename as PDFFilename
FROM ReviewPage r
JOIN SiteTree s ON r.ID = s.ID AND s.ClassName = 'ReviewPage'
LEFT JOIN File f_cover ON r.CoverID = f_cover.ID
LEFT JOIN File f_pdf ON r.PDFFileID = f_pdf.ID
WHERE TRIM(COALESCE(r.Author, r.Author_pl_PL)) = 'Hi-Fi Plus'
ORDER BY r.ArticleDate DESC;
```

**Export:** phpMyAdmin → Export as CSV → `reviews-hi-fi-plus.csv`

### 6.2 Script: `migrate-reviews-by-author.ts`

**Location:** `apps/studio/scripts/migration/reviews/migrate-reviews-by-author.ts`

**Functionality:**

1. Read reviews CSV for specific author
2. Determine review type (page/pdf/external)
3. Upload cover image to Sanity CDN
4. Upload PDF file if applicable
5. Convert HTML content to Portable Text
6. Create review document with author reference

### 6.3 Usage

```bash
# Dry run for specific author
bun run apps/studio/scripts/migration/reviews/migrate-reviews-by-author.ts \
  --author="Hi-Fi Plus" \
  --dry-run

# Execute migration for specific author
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews-by-author.ts \
  --author="Hi-Fi Plus"
```

### 6.4 Field Mapping

| Source Field                         | Target Field      | Transformation                                   |
| ------------------------------------ | ----------------- | ------------------------------------------------ |
| `r.ID`                               | `_id`             | `review-{ID}`                                    |
| `s.URLSegment`                       | `slug.current`    | `/recenzje/{URLSegment}/` (only for 'page' type) |
| `s.MenuTitle` or `s.Title`           | `name`            | Clean, truncate if needed                        |
| `s.Title`                            | `title`           | HTML → Portable Text                             |
| `r.LeadingText`                      | `content`         | HTML → Portable Text (only for 'page' type)      |
| `r.CoverID` → `f_cover.FileFilename` | `image`           | Upload to Sanity CDN                             |
| `r.ExternalLink`                     | `externalUrl`     | Direct copy (only for 'external' type)           |
| `r.PDFFileID` → `f_pdf.FileFilename` | `pdfFile`         | Upload to Sanity CDN (only for 'pdf' type)       |
| `AuthorName` → mapping               | `author._ref`     | Reference via author mapping                     |
| Logic-based                          | `destinationType` | 'external' / 'pdf' / 'page'                      |

### 6.5 Review Type Detection Logic

```typescript
function determineReviewType(row: CSVRow): "page" | "pdf" | "external" {
  // External link takes priority
  if (row.ExternalLink && row.ExternalLink.trim()) {
    return "external";
  }

  // PDF file
  if (row.PDFFileID && parseInt(row.PDFFileID) > 0 && row.PDFFilename) {
    return "pdf";
  }

  // Default to page content
  return "page";
}
```

---

## 7. Phase 3: Batch Review Migration

### 7.1 SQL Query for All Reviews

```sql
SELECT
  r.ID,
  s.URLSegment as Slug,
  s.Title as PageTitle,
  s.MenuTitle,
  r.LeadingText as Content,
  TRIM(COALESCE(r.Author, r.Author_pl_PL)) as AuthorName,
  r.CoverID,
  f_cover.FileFilename as CoverFilename,
  r.ArticleDate,
  TRIM(COALESCE(r.ExternalLink, r.ExternalLink_pl_PL)) as ExternalLink,
  r.PDFFileID,
  f_pdf.FileFilename as PDFFilename
FROM ReviewPage r
JOIN SiteTree s ON r.ID = s.ID AND s.ClassName = 'ReviewPage'
LEFT JOIN File f_cover ON r.CoverID = f_cover.ID
LEFT JOIN File f_pdf ON r.PDFFileID = f_pdf.ID
WHERE TRIM(COALESCE(r.Author, r.Author_pl_PL)) IS NOT NULL
  AND TRIM(COALESCE(r.Author, r.Author_pl_PL)) != ''
ORDER BY r.ArticleDate DESC;
```

**Export:** phpMyAdmin → Export as CSV → `reviews-all.csv`

### 7.2 Script: `migrate-all-reviews.ts`

**Location:** `apps/studio/scripts/migration/reviews/migrate-all-reviews.ts`

**Functionality:**

1. Read all reviews from CSV
2. Check existing reviews in Sanity (skip already migrated)
3. Process reviews in batches (to avoid rate limiting)
4. Upload assets and create documents
5. Generate migration report

### 7.3 Usage

```bash
# Dry run - see what would be migrated
bun run apps/studio/scripts/migration/reviews/migrate-all-reviews.ts --dry-run

# Execute full migration
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-all-reviews.ts

# With options
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-all-reviews.ts \
  --skip-existing \
  --batch-size=20 \
  --verbose

# Migrate specific range (for resuming)
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-all-reviews.ts \
  --start=100 \
  --limit=50
```

### 7.4 Idempotency

The script handles already-migrated reviews:

```typescript
async function shouldMigrateReview(
  reviewId: string,
  client: SanityClient,
): Promise<boolean> {
  const existing = await client.fetch(
    `*[_type == "review" && _id == $id][0]._id`,
    { id: `review-${reviewId}` },
  );
  return !existing;
}
```

### 7.5 Batch Processing

```typescript
const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
  const batch = reviews.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(migrateReview));
  await sleep(DELAY_BETWEEN_BATCHES);
}
```

---

## 8. Asset Migration

### 8.1 Cover Images

```
Source: https://www.audiofast.pl/assets/{CoverFilename}
Example: https://www.audiofast.pl/assets/recenzje/cover-image.jpg
Target: Sanity CDN
```

### 8.2 PDF Files

```
Source: https://www.audiofast.pl/assets/{PDFFilename}
Example: https://www.audiofast.pl/assets/pdf/review-document.pdf
Target: Sanity CDN (file asset)
```

### 8.3 SSL Bypass

The legacy server has SSL issues. Use the same approach as brand migration:

```typescript
import * as https from "node:https";

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});
```

---

## 9. HTML to Portable Text Conversion

### 9.1 Content Patterns

The `LeadingText` field contains HTML like:

```html
<p>
  Jest to ekstremalnie neutralny gramofon, czego dokładnie wszyscy sobie
  życzymy, jednak nie oczekiwałem tego od urządzenia w cenie 2395$. Spencer
  Holbert
</p>
```

### 9.2 Conversion Rules

| HTML              | Portable Text                |
| ----------------- | ---------------------------- |
| `<p>`             | Block with `style: 'normal'` |
| `<strong>`, `<b>` | Mark: `strong`               |
| `<em>`, `<i>`     | Mark: `em`                   |
| `<a href="...">`  | Annotation: `customLink`     |
| `<br>`            | Soft line break or new block |
| `<span>`          | Ignore wrapper, keep content |

### 9.3 Title Conversion

The `Title` field may contain HTML entities or formatting:

```typescript
function convertTitleToPortableText(title: string): PortableTextBlock[] {
  // Clean HTML entities
  const cleaned = title
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "") // Strip HTML tags
    .trim();

  return [
    {
      _type: "block",
      _key: generateKey(),
      style: "normal",
      children: [{ _type: "span", _key: generateKey(), text: cleaned }],
    },
  ];
}
```

---

## 10. Migration Script Structure

```
apps/studio/scripts/migration/reviews/
├── index.ts                      # Main orchestrator
├── migrate-review-authors.ts     # Phase 1: Authors
├── migrate-reviews-by-author.ts  # Phase 2: Single author testing
├── migrate-all-reviews.ts        # Phase 3: Batch migration
├── parser.ts                     # CSV parsing utilities
├── transformer.ts                # Data transformation logic
├── html-to-portable-text.ts      # HTML conversion
├── asset-uploader.ts             # Image/PDF upload
├── types.ts                      # TypeScript interfaces
├── author-mapping.json           # Generated author ID mapping
└── README.md                     # Usage documentation
```

---

## 11. Rollback Strategy

### 11.1 Document ID Patterns

| Entity        | ID Pattern             | Example                    |
| ------------- | ---------------------- | -------------------------- |
| Review Author | `review-author-{slug}` | `review-author-hi-fi-plus` |
| Review        | `review-{legacy-id}`   | `review-77`                |

### 11.2 Rollback Commands

```bash
# Rollback all reviews
bun run apps/studio/scripts/migration/reviews/migrate-all-reviews.ts --rollback

# Rollback reviews for specific author
bun run apps/studio/scripts/migration/reviews/migrate-reviews-by-author.ts \
  --author="Hi-Fi Plus" \
  --rollback

# Rollback authors
bun run apps/studio/scripts/migration/reviews/migrate-review-authors.ts --rollback
```

### 11.3 GROQ Rollback Queries

```groq
// Delete all migrated reviews
*[_type == "review" && _id match "review-*"] | delete

// Delete all migrated authors
*[_type == "reviewAuthor" && _id match "review-author-*"] | delete
```

---

## 12. Validation

### 12.1 Post-Migration Checks

```groq
// Count all reviews
count(*[_type == "review"])

// Reviews by type
{
  "page": count(*[_type == "review" && destinationType == "page"]),
  "pdf": count(*[_type == "review" && destinationType == "pdf"]),
  "external": count(*[_type == "review" && destinationType == "external"])
}

// Reviews with missing author
*[_type == "review" && !defined(author)]

// Reviews with missing image
*[_type == "review" && !defined(image)]

// Page reviews with missing content
*[_type == "review" && destinationType == "page" && count(content) == 0]

// PDF reviews with missing file
*[_type == "review" && destinationType == "pdf" && !defined(pdfFile)]

// External reviews with missing URL
*[_type == "review" && destinationType == "external" && !defined(externalUrl)]
```

### 12.2 Expected Results

| Check                     | Expected |
| ------------------------- | -------- |
| Total reviews             | ~819-860 |
| Reviews with author       | 100%     |
| Reviews with image        | ~95%+    |
| Page reviews with content | 100%     |
| PDF reviews with file     | 100%     |
| External reviews with URL | 100%     |

---

## 13. CSV Export Queries

### 13.1 Authors Export

```sql
SELECT DISTINCT
  TRIM(COALESCE(Author, Author_pl_PL)) as AuthorName,
  COUNT(*) as ReviewCount
FROM ReviewPage r
JOIN SiteTree s ON r.ID = s.ID AND s.ClassName = 'ReviewPage'
WHERE COALESCE(Author, Author_pl_PL) IS NOT NULL
  AND TRIM(COALESCE(Author, Author_pl_PL)) != ''
GROUP BY TRIM(COALESCE(Author, Author_pl_PL))
ORDER BY ReviewCount DESC, AuthorName;
```

### 13.2 Full Reviews Export

```sql
SELECT
  r.ID,
  s.URLSegment as Slug,
  s.Title as PageTitle,
  s.MenuTitle,
  r.LeadingText as Content,
  TRIM(COALESCE(r.Author, r.Author_pl_PL)) as AuthorName,
  r.CoverID,
  f_cover.FileFilename as CoverFilename,
  r.ArticleDate,
  TRIM(COALESCE(r.ExternalLink, r.ExternalLink_pl_PL)) as ExternalLink,
  r.PDFFileID,
  f_pdf.FileFilename as PDFFilename,
  CASE
    WHEN TRIM(COALESCE(r.ExternalLink, r.ExternalLink_pl_PL)) IS NOT NULL
         AND TRIM(COALESCE(r.ExternalLink, r.ExternalLink_pl_PL)) != '' THEN 'external'
    WHEN r.PDFFileID > 0 THEN 'pdf'
    ELSE 'page'
  END as ReviewType
FROM ReviewPage r
JOIN SiteTree s ON r.ID = s.ID AND s.ClassName = 'ReviewPage'
LEFT JOIN File f_cover ON r.CoverID = f_cover.ID
LEFT JOIN File f_pdf ON r.PDFFileID = f_pdf.ID
ORDER BY r.ArticleDate DESC;
```

---

## 14. Timeline

### Pre-Phase 1 (Day 1)

- [ ] Update review schema to make slug optional
- [ ] Test schema changes
- [ ] Extract and export author CSV
- [ ] Extract and export full reviews CSV

### Phase 1 (Day 1-2)

- [ ] Create author migration script
- [ ] Run author migration (dry-run first)
- [ ] Verify all authors created
- [ ] Generate author mapping file

### Phase 2 (Day 2-3)

- [ ] Create single-author review migration script
- [ ] Test with "Hi-Fi Plus" reviews
- [ ] Verify all three review types work
- [ ] Fix any issues

### Phase 3 (Day 3-5)

- [ ] Create batch migration script
- [ ] Run full migration (dry-run first)
- [ ] Monitor progress and handle errors
- [ ] Verify migration complete

### Phase 4 (Day 5-6)

- [ ] Run validation queries
- [ ] Fix any broken references
- [ ] Manual review of sample documents
- [ ] Documentation update

---

## 15. Success Criteria

### Quantitative

- [ ] 100% of reviews with valid authors migrated
- [ ] 100% of authors created
- [ ] <1% broken references
- [ ] <5% missing assets (images/PDFs)

### Qualitative

- [ ] Review pages render correctly
- [ ] PDF links work
- [ ] External links redirect properly
- [ ] Author grouping works in Sanity Studio

---

## 16. Files to Create

| File                           | Purpose                 |
| ------------------------------ | ----------------------- |
| `review-authors.csv`           | Exported unique authors |
| `reviews-all.csv`              | Exported all reviews    |
| `migrate-review-authors.ts`    | Phase 1 script          |
| `migrate-reviews-by-author.ts` | Phase 2 script          |
| `migrate-all-reviews.ts`       | Phase 3 script          |
| `author-mapping.json`          | Generated mapping       |

---

**Document Version**: 1.0  
**Created**: 2025-11-26  
**Status**: Planning Complete - Ready for Pre-Phase 1
