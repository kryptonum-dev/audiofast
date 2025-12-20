# Review Migration Implementation Plan

**Created**: December 20, 2025
**Status**: Planning Phase

---

## Executive Summary

This document outlines the restructuring of the review migration system to match the quality and structure of the products/awards migration scripts. The migration handles three distinct review types (page, PDF, external), each with specific field requirements.

---

## Current State Analysis

### Existing Reviews in Sanity

| Metric            | Count |
| ----------------- | ----- |
| **Total Reviews** | 784   |
| **Page Type**     | 347   |
| **PDF Type**      | 127   |
| **External Type** | 374   |

**Last Migrated Review ID**: `review-2845` (from May 2025 database snapshot)

### Up-to-Date Database (CSV Exported)

| Metric                   | Count |
| ------------------------ | ----- |
| **Total Reviews in CSV** | 866   |
| **New reviews to add**   | ~82   |

**ID Format in Sanity**: `review-{legacyId}` (e.g., ID 77 → `review-77`)

### Current Script Issues

The existing `migrate-reviews.ts` script works but lacks:

1. ❌ Proper folder structure (everything in one file)
2. ❌ Rollback functionality
3. ❌ Image caching with persistent storage
4. ❌ Batch processing with error recovery
5. ❌ Detailed migration report
6. ❌ `--skip-existing` flag
7. ❌ PDF slug handling (only page slug)
8. ❌ Proper separation of concerns (parsers, transformers, utils)

---

## Review Types & Field Requirements

### Common Fields (ALL Types)

| Field             | Type          | Required     | Notes                               |
| ----------------- | ------------- | ------------ | ----------------------------------- |
| `_id`             | string        | ✅           | Format: `review-{legacyId}`         |
| `author`          | reference     | ✅           | Reference to `reviewAuthor`         |
| `destinationType` | string        | ✅           | `"page"` \| `"pdf"` \| `"external"` |
| `publishedDate`   | datetime      | ⬜           | Override with `ArticleDate`         |
| `title`           | Portable Text | ✅           | Can contain formatting              |
| `description`     | Portable Text | ✅ (pdf/ext) | Short description for listings      |
| `image`           | image         | ✅           | Main cover image                    |

### Page Type Specific Fields

| Field              | Type          | Required | Notes                             |
| ------------------ | ------------- | -------- | --------------------------------- |
| `slug`             | slug          | ✅       | Prefix: `/recenzje/`              |
| `content`          | Portable Text | ✅       | Full rich text with components    |
| `overrideGallery`  | boolean       | ⬜       | Set to `false` for all migrated   |
| `imageGallery`     | array         | ❌       | Not used in migration             |
| `pageBuilder`      | array         | ❌       | Empty for migration               |
| `seo.title`        | string        | ⬜       | Same as review title (plain text) |
| `seo.description`  | string        | ⬜       | Leave empty                       |
| `seo.noIndex`      | boolean       | ⬜       | Set to `false`                    |
| `seo.hideFromList` | boolean       | ⬜       | Set to `false`                    |

### PDF Type Specific Fields

| Field     | Type | Required | Notes                    |
| --------- | ---- | -------- | ------------------------ |
| `pdfSlug` | slug | ✅       | Prefix: `/recenzje/pdf/` |
| `pdfFile` | file | ✅       | Uploaded PDF file        |

### External Type Specific Fields

| Field         | Type | Required | Notes             |
| ------------- | ---- | -------- | ----------------- |
| `externalUrl` | url  | ✅       | Full external URL |

---

## Slug Patterns

### Page Reviews

```
Legacy: /test-produktu-w-magazynie
New:    /recenzje/test-produktu-w-magazynie/
```

**Rules:**

- Always prefix with `/recenzje/`
- Always end with `/`
- Preserve original slug (no `/pl/` prefix from legacy)

### PDF Reviews

```
Legacy: /pdf-review-name
New:    /recenzje/pdf/pdf-review-name/
```

**Rules:**

- Always prefix with `/recenzje/pdf/`
- Always end with `/`
- Slug derived from PDF filename or title

---

## Content Transformation (Page Type)

### Supported Portable Text Elements

| Element          | Type               | Notes                     |
| ---------------- | ------------------ | ------------------------- |
| Text blocks      | `block`            | Styles: normal, h2, h3    |
| Bold/Italic      | marks              | `strong`, `em`            |
| Links            | `customLink`       | External links preserved  |
| Bullet lists     | `listItem: bullet` | From `<ul>` tags          |
| Numbered lists   | `listItem: number` | From `<ol>` tags          |
| Images           | `ptImage`          | Single or double layout   |
| YouTube videos   | `ptYoutubeVideo`   | Extracted from iframes    |
| Vimeo videos     | `ptVimeoVideo`     | Extracted from iframes    |
| Horizontal lines | `ptHorizontalLine` | From `<hr>` tags          |
| Column breaks    | `ptPageBreak`      | From `<!-- pagebreak -->` |

### HTML to Portable Text Conversion

The review content parser will handle:

1. **Headings**: All `<h1>` - `<h6>` → `h2` or `h3` (review schema supports both)
2. **Paragraphs**: `<p>` → `block` with style `normal`
3. **Lists**: `<ul>`/`<ol>` → list blocks with appropriate `listItem`
4. **Links**: `<a href="...">` → `customLink` annotation
5. **Images**: `<img>` and `[image ...]` → `ptImage` blocks
6. **Videos**: YouTube/Vimeo iframes → video blocks
7. **Line breaks**: `<br>` → preserved as `\n` in text spans
8. **Bold/Italic**: `<strong>`/`<b>`, `<em>`/`<i>` → marks

### Legacy Content Structure

Reviews have two content sources:

1. **`Content` field**: Simple HTML content
2. **`PageSections` field**: JSON array of sections with:
   - `sort`: Section order
   - `type`: Content type (text, etc.)
   - `title`: Section heading
   - `content`: HTML content
   - `publish`: Visibility flag

**Processing Priority:**

- If `PageSections` exists and has content → use sections
- Otherwise → use `Content` field

---

## New Folder Structure

```
apps/studio/scripts/migration/reviews/
├── index.ts                          # Main orchestrator
├── migrate-reviews.ts                # Batch migration script
├── migrate-single-review.ts          # Single review migration (testing)
├── migrate-review-authors.ts         # ✅ Already exists, working
├── types.ts                          # TypeScript interfaces
├── parser/
│   └── html-to-portable-text.ts      # HTML → Portable Text conversion
├── transformers/
│   ├── review-transformer.ts         # Main transformation logic
│   └── reference-resolver.ts         # Author lookups
├── utils/
│   ├── csv-parser.ts                 # CSV parsing utilities
│   ├── asset-uploader.ts             # Image/PDF upload with caching
│   └── sanity-client.ts              # Sanity client setup
├── image-cache.json                  # Cached image uploads (auto-generated)
├── pdf-cache.json                    # Cached PDF uploads (auto-generated)
└── README.md                         # Documentation
```

---

## CSV Requirements

### Required CSV File

**File**: `csv/reviews/reviews-all.csv`

**Columns (Exported):**

| Column          | Type   | Notes                                      |
| --------------- | ------ | ------------------------------------------ |
| `ID`            | number | Legacy review ID → `review-{ID}` in Sanity |
| `Slug`          | string | Legacy URL segment                         |
| `PageTitle`     | string | Review title                               |
| `MenuTitle`     | string | Fallback title (optional)                  |
| `BoxContent`    | string | Full HTML content from Box table           |
| `Description`   | string | Short excerpt from LeadingText             |
| `AuthorName`    | string | Author name                                |
| `CoverID`       | number | Legacy image ID (reference)                |
| `CoverFilename` | string | Cover image path (e.g., `cover/xxx.jpg`)   |
| `ArticleDate`   | date   | Publication date                           |
| `ExternalLink`  | string | External URL (for external type)           |
| `PDFFileID`     | number | Legacy PDF ID (reference)                  |
| `PDFFilename`   | string | PDF file path (e.g., `Uploads/xxx.pdf`)    |
| `ReviewType`    | string | `page` \| `pdf` \| `external`              |

### SQL Query for Export

✅ **EXPORTED**: `csv/reviews/reviews-all.csv` (866 reviews)

```sql
SELECT
  rp.ID,
  st.URLSegment as Slug,
  st.Title as PageTitle,
  st.MenuTitle,
  b.Content as BoxContent,
  rp.LeadingText as Description,
  COALESCE(NULLIF(TRIM(rp.Author), ''), 'Unknown') as AuthorName,
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
  END as ReviewType
FROM ReviewPage rp
JOIN SiteTree st ON rp.ID = st.ID
LEFT JOIN Box b ON b.BoxedPageID = rp.ID AND b.box_type = 'text'
LEFT JOIN File f_cover ON rp.CoverID = f_cover.ID
LEFT JOIN File f_pdf ON rp.PDFFileID = f_pdf.ID
WHERE st.ClassName = 'ReviewPage'
ORDER BY rp.ID;
```

**Key discoveries:**

- Content is stored in `Box` table (type = 'text'), NOT in `SiteTree.Content`
- Each review has a single Box containing full HTML content
- `LeadingText` in ReviewPage = short description/excerpt

---

## Migration Strategy

### Option A: Full Re-Migration (Recommended)

Delete all existing reviews and re-migrate from the up-to-date database.

**Pros:**

- Clean slate, no inconsistencies
- Ensures all data is current
- Simpler implementation

**Cons:**

- Temporarily removes all reviews
- Product-review references may need refresh

**Implementation:**

```bash
# 1. Rollback all existing reviews
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --rollback

# 2. Migrate all reviews from new CSV
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --csv=./csv/reviews/reviews-all.csv
```

### Option B: Incremental Migration

Only migrate reviews with IDs > 2845 (the highest in current Sanity).

**Pros:**

- Faster migration
- Preserves existing data

**Cons:**

- Existing reviews may have outdated content
- More complex logic

**Implementation:**

```bash
# Migrate only new reviews
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --min-id=2846
```

### Recommendation

**Use Option A (Full Re-Migration)** because:

1. Ensures all content reflects the up-to-date database
2. The current script already uses `createOrReplace` (idempotent)
3. Review IDs are deterministic (`review-{id}`), so references stay valid

---

## Implementation Tasks

### Phase 1: Setup (30 min)

- [ ] Create new folder structure
- [ ] Move `types.ts` with updated interfaces
- [ ] Create `utils/sanity-client.ts`
- [ ] Create `utils/csv-parser.ts`

### Phase 2: Core Utilities (1 hour)

- [ ] Create `utils/asset-uploader.ts` with:
  - Image upload with caching
  - PDF upload with caching
  - Cache persistence to JSON files
  - SSL bypass for legacy server

### Phase 3: Parsers (2 hours)

- [ ] Create `parser/html-to-portable-text.ts`:
  - Adapt from product migration parser
  - Handle all supported elements
  - Handle PageSections JSON parsing

### Phase 4: Transformers (2 hours)

- [ ] Create `transformers/reference-resolver.ts`:
  - Author reference resolution by slug
  - Cache author mappings in memory

- [ ] Create `transformers/review-transformer.ts`:
  - Transform CSV row to Sanity document
  - Handle all three review types
  - Generate appropriate slugs
  - Set SEO fields

### Phase 5: Migration Scripts (1.5 hours)

- [ ] Create `migrate-single-review.ts`:
  - Single review migration for testing
  - `--id=XXX` and `--dry-run` flags

- [ ] Create `migrate-reviews.ts`:
  - Batch migration with progress
  - `--dry-run` flag
  - `--rollback` flag
  - `--skip-existing` flag
  - `--limit=N` flag
  - `--min-id=N` flag
  - `--batch-size=N` flag (default: 10)
  - Migration report at end

### Phase 6: Documentation (30 min)

- [ ] Create `README.md` with:
  - Usage instructions
  - CSV requirements
  - Field mapping table
  - Validation queries

---

## CLI Interface

### Single Review Migration

```bash
# Dry run
bun run apps/studio/scripts/migration/reviews/migrate-single-review.ts --id=2837 --dry-run

# Live migration
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-single-review.ts --id=2837
```

### Batch Migration

```bash
# Dry run all
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --dry-run

# Live migration with limits
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --limit=10

# Skip existing reviews
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --skip-existing

# Only new reviews (ID > 2845)
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --min-id=2846

# Rollback
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --rollback
```

---

## Validation Queries (Post-Migration)

```groq
// Total count by type
{
  "total": count(*[_type == "review"]),
  "page": count(*[_type == "review" && destinationType == "page"]),
  "pdf": count(*[_type == "review" && destinationType == "pdf"]),
  "external": count(*[_type == "review" && destinationType == "external"])
}

// Reviews without author
*[_type == "review" && !defined(author)]{_id, title}

// Reviews without image
*[_type == "review" && !defined(image)]{_id, title}

// Page reviews without slug
*[_type == "review" && destinationType == "page" && !defined(slug)]{_id, title}

// PDF reviews without pdfSlug
*[_type == "review" && destinationType == "pdf" && !defined(pdfSlug)]{_id, title}

// PDF reviews without pdfFile
*[_type == "review" && destinationType == "pdf" && !defined(pdfFile)]{_id, title}

// External reviews without externalUrl
*[_type == "review" && destinationType == "external" && !defined(externalUrl)]{_id, title}

// Page reviews without content
*[_type == "review" && destinationType == "page" && (!defined(content) || count(content) == 0)]{_id, title}
```

---

## Error Handling

| Error Type           | Action                       |
| -------------------- | ---------------------------- |
| Missing author       | Log warning, skip review     |
| Missing cover image  | Log warning, skip review     |
| Failed image upload  | Log warning, skip review     |
| Failed PDF upload    | Log warning, skip PDF review |
| Empty page content   | Log warning, skip review     |
| Invalid HTML parsing | Log warning, use empty       |
| Sanity save error    | Log error, continue batch    |

---

## Migration Report Format

```
╔═══════════════════════════════════════════════════════════════╗
║            AUDIOFAST DATA MIGRATION                           ║
║            Reviews                                            ║
╚═══════════════════════════════════════════════════════════════╝

CSV Path: /path/to/reviews-all.csv
Mode: LIVE
Total CSV rows: 923
Skip Existing: false

Phase 1: Loading data...
   ✓ Loaded 923 review rows
   ✓ Loaded 193 author mappings

Phase 2: Processing reviews...
   [1/923] review-2837: Test kondycjonera... ✓
   [2/923] review-2845: Test przedwzmacniacza... ✓
   ...

═══════════════════════════════════════════════════════════════

MIGRATION COMPLETE

| Metric            | Count |
| ----------------- | ----- |
| Total Processed   | 923   |
| Successfully Migrated | 915 |
| Skipped (existing)| 0     |
| Skipped (errors)  | 8     |

| Type     | Migrated |
| -------- | -------- |
| Page     | 350      |
| PDF      | 128      |
| External | 437      |

Errors:
   - review-2816: Empty content (page type)
   - review-2789: Empty content (page type)
   ...

Time elapsed: 12m 34s
```

---

## Appendix: Type Definitions

```typescript
// types.ts

export interface ReviewRow {
  ID: string;
  Slug?: string;
  PageTitle?: string;
  MenuTitle?: string;
  Content?: string;
  AuthorName?: string;
  CoverID?: string;
  CoverFilename?: string;
  ArticleDate?: string;
  ExternalLink?: string;
  PDFFileID?: string;
  PDFFilename?: string;
  ReviewType?: 'page' | 'pdf' | 'external';
  PageSections?: string;
}

export interface SanityReviewDocument {
  _id: string;
  _type: 'review';
  destinationType: 'page' | 'pdf' | 'external';
  publishedDate?: string;
  slug?: { _type: 'slug'; current: string };
  pdfSlug?: { _type: 'slug'; current: string };
  author: { _type: 'reference'; _ref: string };
  title: PortableTextBlock[];
  description?: PortableTextBlock[];
  content?: PortableTextNode[];
  image: SanityImageRef;
  pdfFile?: SanityFileRef;
  externalUrl?: string;
  overrideGallery?: boolean;
  seo?: {
    title?: string;
    description?: string;
    noIndex?: boolean;
    hideFromList?: boolean;
  };
}

export interface MigrationResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{
    reviewId: string;
    reviewTitle: string;
    error: string;
  }>;
}

export interface AssetCache {
  [sourceUrl: string]: {
    assetId: string;
    originalSize: number;
    uploadedAt: string;
  };
}

export interface MigrationOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  reviewId?: string;
  skipExisting: boolean;
  minId?: number;
  batchSize: number;
  rollback: boolean;
}
```

---

## Next Steps

1. ✅ Get user confirmation on this plan
2. ⬜ Export `reviews-all.csv` from up-to-date database
3. ⬜ Implement Phase 1-6
4. ⬜ Test with single review (`--id=2837 --dry-run`)
5. ⬜ Run full migration
6. ⬜ Validate with GROQ queries
7. ⬜ Update strategy document with completion status
