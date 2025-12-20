# Review Migration

Migrates reviews from legacy SilverStripe CMS (via CSV) to Sanity CMS.

## Overview

This migration handles three types of reviews:

1. **Page** - Internal review pages with full content
2. **PDF** - Reviews with downloadable PDF files
3. **External** - Reviews linking to external websites

## Prerequisites

1. Export `reviews-all.csv` from the legacy database:

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

2. Ensure review authors are already migrated (run `migrate-review-authors.ts` first)

3. Set `SANITY_API_TOKEN` environment variable

## Usage

### Dry Run (Preview)

```bash
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --dry-run
```

### Migrate with Skip Existing

Skip reviews that already exist in Sanity:

```bash
SANITY_API_TOKEN="your-token" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --skip-existing
```

### Full Migration

Migrate all reviews (createOrReplace - idempotent):

```bash
SANITY_API_TOKEN="your-token" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv
```

### Limit Migration

Test with a small subset:

```bash
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --dry-run \
  --limit=5
```

### Start from Minimum ID

Migrate only reviews newer than a specific ID:

```bash
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv=./csv/reviews/reviews-all.csv \
  --min-id=2845
```

### Rollback

Delete all migrated reviews:

```bash
SANITY_API_TOKEN="your-token" bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --rollback
```

## CLI Options

| Option            | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `--csv=PATH`      | Path to CSV file (default: `./csv/reviews/reviews-all.csv`) |
| `--dry-run`       | Preview without making changes                              |
| `--skip-existing` | Skip reviews that already exist in Sanity                   |
| `--limit=N`       | Migrate only first N reviews                                |
| `--min-id=N`      | Only migrate reviews with ID > N                            |
| `--batch-size=N`  | Transaction batch size (default: 50)                        |
| `--rollback`      | Delete all migrated reviews                                 |
| `--verbose`       | Show detailed output                                        |
| `--report=PATH`   | Save migration report to file                               |

## File Structure

```
reviews/
├── migrate-reviews.ts          # Main migration script
├── migrate-review-authors.ts   # Author migration (run first)
├── types.ts                    # Type definitions
├── utils/
│   ├── sanity-client.ts        # Sanity client configuration
│   ├── csv-parser.ts           # CSV parsing utilities
│   └── asset-uploader.ts       # Image/PDF upload utilities
├── parser/
│   └── html-to-portable-text.ts # HTML → Portable Text conversion
├── transformers/
│   ├── author-resolver.ts      # Author reference resolution
│   └── review-transformer.ts   # CSV → Sanity document transformation
├── image-cache.json            # Cached asset uploads (auto-generated)
└── README.md                   # This file
```

## Content Transformation

### Page Reviews

- **Slug**: `/recenzje/{legacy-slug}/`
- **Content**: BoxContent HTML → Portable Text
  - Headings (h1/h2 → h2, h3-h6 → h3)
  - Paragraphs with inline formatting (bold, italic, links)
  - Lists (bullet and numbered)
  - Images → `ptImage` blocks
  - Horizontal lines → `ptHorizontalLine`
  - **Page breaks are REMOVED** (not converted)
- **SEO**: Title = review title, description = auto-generated

### PDF Reviews

- **Slug**: `/recenzje/pdf/{legacy-slug}/`
- **PDF File**: Uploaded from legacy assets

### External Reviews

- **External URL**: Preserved as-is

## ID Mapping

Sanity review IDs follow the pattern `review-{legacyId}`:

| Legacy ID | Sanity ID     |
| --------- | ------------- |
| 77        | `review-77`   |
| 91        | `review-91`   |
| 2845      | `review-2845` |

This enables `--skip-existing` to efficiently check for existing reviews.

## Image Optimization

All images are automatically converted to **WebP format** using Sharp:

| Image Type       | Quality | Max Size  | Upscaling             |
| ---------------- | ------- | --------- | --------------------- |
| Cover            | 82%     | 1920×1280 | Yes (2x for < 1400px) |
| Content (inline) | 80%     | 1600×1200 | No (keep small)       |

**Example output:**

```
✓ The-Absolute-Sound-245.webp: 245.3 KB → 42.1 KB (-82.8%)
✓ HiFi+-130.webp: 189.7 KB → 31.4 KB (-83.4%) [↑2x: 800→1600px]
```

## Image Caching

Uploaded images are cached in `image-cache.json` to avoid re-uploading:

```json
{
  "image:https://www.audiofast.pl/assets/cover/example.jpg": {
    "assetId": "image-xxx",
    "uploadedAt": "2024-12-20T10:00:00.000Z",
    "originalSize": 251187,
    "optimizedSize": 43156
  }
}
```

## Error Handling

- Reviews without required fields are skipped with warnings
- Failed uploads are logged but don't stop migration
- Transaction failures fall back to individual document saves
- Reports are generated with all errors for debugging

## Migration Counts

| Metric             | Count |
| ------------------ | ----- |
| Existing in Sanity | 784   |
| Total in CSV       | 866   |
| New reviews        | ~82   |
