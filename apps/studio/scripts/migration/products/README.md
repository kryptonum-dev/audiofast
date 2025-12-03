# Product Migration Scripts

Migrates products from legacy SilverStripe database to Sanity CMS.

## ✅ Migration Complete

**Completed**: December 3, 2025

| Metric                      | Value   |
| --------------------------- | ------- |
| **Total Products Migrated** | **816** |
| **Total Brands**            | **35**  |
| **Products Missing Images** | 8       |
| **Success Rate**            | 100%    |

All products have been successfully migrated. See the [workflow documentation](../../../../../.ai/product-migration-workflow.md) for the complete brand-by-brand breakdown.

## Prerequisites

1. **CSV Files Required** (in `csv/products/`):
   - `products-main.csv` - Main product data
   - `products-categories.csv` - Product-category mappings
   - `products-gallery.csv` - Gallery images
   - `products-boxes.csv` - Content boxes (text, hr, video)
   - `products-reviews.csv` - Product-review mappings (also used for inline `[recenzja id=X]` resolution)
   - `products-technical-data.csv` - Technical specifications (HTML tables from Tabs)
   - `product-brand-slug-map.csv` - Legacy product ID → brand/product URL mapping (for `[product_link,id=X]`)
   - `sitetree-map.csv` - Legacy SiteTree ID → URL segment mapping (for `[sitetree_link,id=X]`)

2. **Environment Variables**:

   ```bash
   export SANITY_PROJECT_ID="fsw3likv"
   export SANITY_DATASET="production"
   export SANITY_API_TOKEN="your-token-here"
   ```

3. **Dependencies**:
   ```bash
   bun add sharp csv-parse @sanity/client
   ```

## Usage

### Single Product Migration (Testing)

```bash
# Dry run (no changes to Sanity)
bun run apps/studio/scripts/migration/products/migrate-single-product.ts --id=506 --dry-run

# Verbose dry run
bun run apps/studio/scripts/migration/products/migrate-single-product.ts --id=506 --dry-run --verbose

# Live migration
bun run apps/studio/scripts/migration/products/migrate-single-product.ts --id=506
```

### Batch Migration

```bash
# Dry run all products
bun run apps/studio/scripts/migration/products/migrate-products.ts --dry-run

# Migrate first 10 products
bun run apps/studio/scripts/migration/products/migrate-products.ts --limit=10

# Skip products that already exist
bun run apps/studio/scripts/migration/products/migrate-products.ts --skip-existing

# Full migration
bun run apps/studio/scripts/migration/products/migrate-products.ts

# Rollback (delete all migrated products)
bun run apps/studio/scripts/migration/products/migrate-products.ts --rollback
```

### Brand-Specific Migration

Migrate all products from a specific brand:

```bash
# Dry run for Wilson Audio (by name)
bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Wilson Audio" --dry-run

# Dry run by brand slug
bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand-slug=wilson-audio --dry-run

# Verbose dry run
bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand=dcs --dry-run --verbose

# Live migration for a brand
bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Wilson Audio"

# Skip existing products
bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand=dcs --skip-existing
```

**Options:**

- `--brand="<name>"` - Brand name (case-insensitive, handles spaces)
- `--brand-slug=<slug>` - Exact brand slug
- `--dry-run` - Preview without making changes
- `--skip-existing` - Skip products already in Sanity
- `--batch-size=N` - Process N products per batch (default: 10)
- `--verbose` - Show detailed output

If the brand is not found, the script lists all available brands with their product counts.

## File Structure

```
apps/studio/scripts/migration/products/
├── index.ts                          # Main orchestrator
├── migrate-products.ts               # Batch migration script
├── migrate-products-by-brand.ts      # Brand-specific migration script
├── migrate-single-product.ts         # Single product migration
├── fix-missing-images.ts             # Post-migration image fix script
├── fix-draft-brand-references.ts     # Fix products with draft brand refs
├── fix-final-images.ts               # One-off script for specific images
├── types.ts                          # TypeScript interfaces
├── parser/
│   ├── html-to-portable-text.ts      # HTML → Portable Text conversion
│   │                                 # - Handles [image], [product_link], [sitetree_link], [recenzja] shortcodes
│   │                                 # - Extracts images from <p> tags
│   │                                 # - Resolves links using CSV mappings
│   │                                 # - Inline images with float (left/right) and fixed width
│   │                                 # - Horizontal lines within text blocks
│   └── technical-data-parser.ts      # HTML tables → structured technical data
│                                     # - Extracts group titles from headings and first cells
│                                     # - Parses multi-column tables (variants)
│                                     # - Handles colspan by duplicating values
│                                     # - Preserves line breaks in table cells
│                                     # - Complex header structures (grouped variants)
├── transformers/
│   ├── product-transformer.ts        # Main transformation logic
│   │                                 # - Wraps content in contentBlockText
│   │                                 # - Resolves ptReviewEmbed references
│   │                                 # - Parses technical data
│   │                                 # - Creates ptInlineImage blocks
│   └── reference-resolver.ts         # Brand/category/review lookups
│                                     # - Queries productCategorySub for categories
│                                     # - Loads legacy review ID mappings
│                                     # - Resolves all review types (page, PDF, external)
├── utils/
│   ├── csv-parser.ts                 # CSV parsing utilities
│   ├── image-optimizer.ts            # WebP conversion (Sharp)
│   │                                 # - 2x upscaling for small images (< 1400px)
│   │                                 # - No upscaling for inline images
│   │                                 # - Alternative URL fallback for missing images
│   │                                 # - SSL certificate bypass for legacy server
│   └── sanity-client.ts              # Sanity client setup
├── image-cache.json                  # Cached image uploads (auto-generated)
└── README.md                         # This file
```

## Migration Process

1. **Load CSV Data**: Parse all 8 CSV files and index by ProductID
2. **Load Reference Mappings**: Fetch existing brand, category, and review IDs from Sanity
3. **Transform Products**: For each product:
   - Build basic fields (name, slug, subtitle, etc.)
   - Download, optimize (WebP), and upload main image (with 2x upscaling if needed)
   - Download, optimize, and upload gallery images
   - Parse HTML content boxes to Portable Text (including inline images)
   - Parse HTML tables to structured technical data (with line breaks preserved)
   - Resolve brand, category, and review references (all review types)
4. **Save to Sanity**: Create or replace product documents

## Image Optimization

All images are converted to WebP format during migration:

| Image Type | Max Width | Max Height | Quality | Upscale        |
| ---------- | --------- | ---------- | ------- | -------------- |
| Preview    | 2400px    | 1600px     | 82%     | 2x if < 1400px |
| Gallery    | 1920px    | 1280px     | 80%     | 2x if < 1400px |
| Content    | 1600px    | 1200px     | 80%     | 2x if < 1400px |
| Inline     | 300px     | -          | 80%     | No upscaling   |

Expected compression: ~75% reduction in file size

### Image Upscaling

Small images (width < 1400px) are upscaled by 2x to ensure crisp display on high-DPI screens. This is controlled by the `upscaleSmallImages` option in the optimizer config.

**Exception:** Inline images (with float) are NOT upscaled as they are intentionally small for text wrapping.

## Content Transformation

### Details Content Structure

The `details.content` field uses an **array of content blocks** (not raw Portable Text):

| Content Block Type           | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `contentBlockText`           | Text content with Portable Text (supports images, videos, links, review embeds) |
| `contentBlockYoutube`        | Standalone YouTube video block                                                  |
| `contentBlockVimeo`          | Standalone Vimeo video block                                                    |
| `contentBlockHorizontalLine` | Horizontal separator                                                            |

### Box Types → Content Blocks

| Legacy Box Type | Sanity Content Block                                            |
| --------------- | --------------------------------------------------------------- |
| text            | `contentBlockText` with Portable Text content                   |
| hr / line       | `contentBlockHorizontalLine`                                    |
| youtube         | `contentBlockYoutube` (standalone) or `ptYoutubeVideo` (inline) |
| vimeo           | `contentBlockVimeo` (standalone) or `ptVimeoVideo` (inline)     |
| gallery         | Images extracted to `imageGallery` field (not in details)       |

### HTML → Portable Text (inside contentBlockText)

- All headings (h1-h6) → h3 (product schema only supports h3)
- Paragraphs → normal blocks
- Lists (ul/ol) → bullet/number list blocks
- Links → customLink annotation (with legacy URL preserved)
- Images → ptMinimalImage component (extracted from `<p>` tags if nested)
- **Inline images** → ptInlineImage component (for images with `class="left"` or `class="right"`)
- YouTube iframes → ptYoutubeVideo component
- Vimeo iframes → ptVimeoVideo component
- Page breaks (`<!-- pagebreak -->`) → ptPageBreak component
- **Horizontal lines** → ptHorizontalLine component (within text blocks)
- **Bold/Italic** → Properly preserved with `strong` and `em` marks
- **Line breaks** → Preserved as newlines in text spans

### Inline Images (ptInlineImage)

Images with `class="left"` or `class="right"` in the legacy HTML are converted to floating inline images:

```html
<!-- Legacy HTML -->
<img src="/assets/image.jpg" class="left" width="90" />
```

Becomes:

```typescript
{
  _type: 'ptInlineImage',
  _key: 'xxx',
  image: { _type: 'image', asset: { _ref: 'image-xxx' } },
  float: 'left',
  width: 90  // Fixed width from shortcode
}
```

Frontend renders these as floating images with text wrapping around them.

**Width handling:**

- The `width` attribute from the legacy shortcode is preserved
- If set, the image displays at that exact width
- On mobile (< 56.1875rem), images are constrained to max 40% width

### SilverStripe Shortcodes

| Shortcode                        | Conversion       | Notes                                                                                       |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `[image src="..." title="..."]`  | `ptMinimalImage` | Block-level image component                                                                 |
| `[image ... class="left/right"]` | `ptInlineImage`  | Inline floating image with text wrap                                                        |
| `[product_link,id=X]`            | `customLink`     | Resolves to `https://www.audiofast.pl/{brand}/{product}` using `product-brand-slug-map.csv` |
| `[sitetree_link,id=X]`           | `customLink`     | Resolves to `https://www.audiofast.pl/{urlSegment}` using `sitetree-map.csv`                |
| `[recenzja id=X]`                | `ptReviewEmbed`  | Inline review card component referencing a Sanity review                                    |

### Link Handling

**Important:** Links are preserved as **original legacy URLs** (not converted to new Sanity slugs). This allows future redirect setup.

```
[product_link,id=123] → https://www.audiofast.pl/audioresearch/ref160m
[sitetree_link,id=456] → https://www.audiofast.pl/kontakt
/kontakt → https://www.audiofast.pl/kontakt
https://example.com → https://example.com (unchanged)
```

### Inline Review Embeds (ptReviewEmbed)

The `[recenzja id=X]` shortcode is converted to a `ptReviewEmbed` component:

1. Legacy review ID extracted from shortcode
2. `products-reviews.csv` maps legacy ID to review slug
3. Sanity review document resolved by slug
4. `ptReviewEmbed` block created with review reference

Frontend renders an inline review card with:

- Review title
- Short description excerpt
- Review image
- "Czytaj dalej" button linking to full review

## Review Resolution

Reviews are resolved using a two-step fallback process to handle all review types:

### Review Types

| Type     | Has Slug | Resolution Method                         |
| -------- | -------- | ----------------------------------------- |
| Page     | Yes      | Matched by slug                           |
| PDF      | No       | Matched by ID pattern `review-{legacyId}` |
| External | No       | Matched by ID pattern `review-{legacyId}` |

### Resolution Process

1. **Primary:** Try to resolve by `ReviewSlug` from CSV
2. **Fallback:** If no slug, resolve by `ReviewID` using pattern `review-{legacyId}`

This ensures all review types (page, PDF, external) are correctly linked to products.

## Technical Data Transformation

### Source Structure

Technical data comes from the `Tabs` table in the legacy database:

- Each product can have multiple tabs with technical specifications
- Tabs contain HTML with text headings (group titles) and `<table>` elements
- Tables can be simple (2 columns) or multi-column (with variants)

### SQL Query for Extraction

```sql
SELECT
  t.ID as TabID,
  t.BoxID,
  b.ProductID,
  p.name as ProductName,
  p.URLSegment as ProductSlug,
  t.Sort as TabSort,
  t.Title as TabTitle,
  t.Content as TabContent
FROM Tabs t
JOIN Box b ON t.BoxID = b.ID
JOIN Product p ON b.ProductID = p.ID
WHERE b.ProductID > 0
  AND t.Content IS NOT NULL
  AND t.Content != ''
  AND (p.publish = 1 OR p.archived = 1)
ORDER BY b.ProductID, t.Sort;
```

### Target Structure

```typescript
technicalData: {
  variants?: string[];  // Column headers for multi-variant tables
  groups?: [{
    _type: 'technicalDataGroup';
    title?: string;     // Section title (optional)
    rows: [{
      _type: 'technicalDataRow';
      title: string;    // Parameter name
      values: [{
        content: PortableTextBlock[];  // Rich text value (supports line breaks)
      }];
    }];
  }];
}
```

### Table Types

| Table Type             | Detection                      | Handling                                 |
| ---------------------- | ------------------------------ | ---------------------------------------- |
| **Simple (2 columns)** | 2 cells per row                | `variants: []`, one value per row        |
| **Multi-column**       | 3+ columns with header row     | All columns become variants              |
| **With colspan**       | `colspan` attribute on cells   | Value duplicated for each spanned column |
| **Grouped headers**    | First cell contains group name | Variants prefixed with group name        |

### Group Titles

Text elements (headings, paragraphs) before tables become group titles. Group titles can also come from the first cell of the first row in certain table structures:

```html
<p>Specyfikacja techniczna:</p>
<!-- Group title from heading -->
<table>
  ...
</table>

<!-- OR: Group title from first cell -->
<table>
  <tr>
    <td>Nośność</td>
    <!-- Group title -->
    <td><strong>3 poziomy</strong></td>
    <!-- Variant 1 -->
    <td><strong>4 poziomy</strong></td>
    <!-- Variant 2 -->
  </tr>
</table>
```

### Variants (Multi-Column Tables)

When tables have headers with variant names:

```html
<tr>
  <td>Parameter</td>
  <td><strong>Alive</strong></td>
  <td><strong>Excite</strong></td>
  <td><strong>Euphoria</strong></td>
</tr>
```

Results in: `variants: ["Alive", "Excite", "Euphoria"]`

**Grouped variants** are flattened with the group name prepended:

```html
<!-- Two-row header with group -->
<tr>
  <td></td>
  <td colspan="3"><strong>Atmosphere SX</strong></td>
</tr>
<tr>
  <td>Parameter</td>
  <td><strong>Alive</strong></td>
  <td><strong>Excite</strong></td>
  <td><strong>Euphoria</strong></td>
</tr>
```

Results in: `variants: ["Atmosphere SX Alive", "Atmosphere SX Excite", "Atmosphere SX Euphoria"]`

### Line Breaks in Table Cells

Line breaks (`<br>`) within table cells are preserved in the Portable Text output:

```html
<td>Black<br />Gold<br />Silver</td>
```

Becomes a text span with newlines: `"Black\nGold\nSilver"`

### Colspan Handling

When a cell spans multiple columns:

```html
<tr>
  <td>Color</td>
  <td colspan="3">Black</td>
  <!-- Same for all variants -->
</tr>
```

The value is duplicated for each variant column.

### Skipped Content

The parser skips non-table content:

- `<iframe>` elements (videos)
- `<video>` elements
- Empty paragraphs
- Images

## Field Mapping

| Sanity Field       | Source                      | Notes                                                                     |
| ------------------ | --------------------------- | ------------------------------------------------------------------------- |
| name               | ProductName                 | Direct copy                                                               |
| subtitle           | Subtitle                    | Optional, can be null                                                     |
| slug               | ProductSlug                 | Format: /produkty/{slug}/                                                 |
| previewImage       | MainImageFilename           | Optimized to WebP, upscaled if < 1400px                                   |
| imageGallery       | products-gallery.csv        | From gallery box type                                                     |
| isArchived         | IsArchived                  | Boolean                                                                   |
| isCPO              | -                           | Always false                                                              |
| brand              | BrandSlug                   | Reference to brand document                                               |
| categories         | products-categories.csv     | References to `productCategorySub` documents                              |
| customFilterValues | -                           | Empty array                                                               |
| details.content    | products-boxes.csv          | **Array of content blocks** (contentBlockText, contentBlockYoutube, etc.) |
| technicalData      | products-technical-data.csv | Structured data from HTML tables (variants, groups, rows)                 |
| reviews            | products-reviews.csv        | References to review documents (all types: page, PDF, external)           |
| pageBuilder        | -                           | Empty array                                                               |
| seo.title          | ProductName                 | Same as name                                                              |
| seo.description    | -                           | Empty string                                                              |
| doNotIndex         | -                           | false                                                                     |
| hideFromList       | IsHidden                    | Boolean                                                                   |

**Note:** `relatedProducts` field is NOT migrated (left empty for manual curation).

## Caching

### Image Cache

Uploaded images are cached in `image-cache.json` to avoid re-uploading:

```json
{
  "https://audiofast.pl/assets/path/to/image.jpg": {
    "assetId": "image-abc123",
    "originalSize": 800000,
    "optimizedSize": 200000,
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Reference Mappings

Brand, category, and review mappings are cached in memory during migration to minimize Sanity API calls.

## Error Handling

- Failed image downloads: Logged as warning, migration continues
- Missing references: Logged as warning, field left empty
- Transformation errors: Logged as error, product skipped
- Sanity save errors: Logged as error, included in final report

## Rollback

To delete all migrated products:

```bash
bun run apps/studio/scripts/migration/products/migrate-products.ts --rollback
```

This deletes all documents with `_id` matching `product-*`.

## Validation

After migration, run these GROQ queries to validate:

```groq
// Count migrated products
count(*[_type == "product" && _id match "product-*"])

// Products without preview image
*[_type == "product" && !defined(previewImage)]{name, _id}

// Products without brand reference
*[_type == "product" && !defined(brand)]{name, _id}

// Products without categories
*[_type == "product" && count(categories) == 0]{name, _id}

// Products with inline review embeds
*[_type == "product" && defined(details.content[].content[_type == "ptReviewEmbed"])]{name, _id}

// Products with inline images
*[_type == "product" && defined(details.content[].content[_type == "ptInlineImage"])]{
  name,
  _id,
  "inlineImages": count(details.content[].content[_type == "ptInlineImage"])
}

// Products with technical data
*[_type == "product" && defined(technicalData.groups)]{
  name,
  _id,
  "groupCount": count(technicalData.groups),
  "rowCount": count(technicalData.groups[].rows[]),
  "variants": technicalData.variants
}

// Products without technical data
*[_type == "product" && !defined(technicalData.groups)]{name, _id}
```

## Known Issues & Fixes

### Category Resolution

The migration queries `productCategorySub` documents (not `product-category`). Ensure your Sanity schema uses this type.

### Brand Slug Mismatches

Legacy brand slugs may differ from Sanity slugs. Known mismatches:

| Legacy          | Sanity           | Fix                |
| --------------- | ---------------- | ------------------ |
| `audioresearch` | `audio-research` | Update Sanity slug |
| `sonusfaber`    | `sonus-faber`    | Update Sanity slug |
| `wilsonaudio`   | `wilson-audio`   | Update Sanity slug |

### Link Preservation

Links are preserved as original legacy URLs (e.g., `https://www.audiofast.pl/audioresearch/ref160m`), not converted to new Sanity slugs. This allows setting up redirects later.

### First Letter Edge Case

Some legacy content has the first letter wrapped in a separate `<span>` with "big letter" styling, followed by the rest of the word in `<strong>`. The parser handles this by merging them into a single `<strong>` marked span.

### Images in Headings

If a heading contains only an image (no text), the heading is skipped and only the image is rendered. This prevents empty headings from appearing in the content.

### Frontend Cache

After migration, clear the Next.js cache:

```bash
cd apps/web && rm -rf .next
```

Then restart the dev server to see updated content.

## Changelog

### Version 2.2 (2025-12-03) - MIGRATION COMPLETE 🎉

- **All 816 products migrated across 35 brands**
- Added automatic alternative URL fallback for missing images
- Added `fix-missing-images.ts` script for post-migration image fixes
- Added `fix-draft-brand-references.ts` to correct draft reference issues
- Added SSL certificate bypass for legacy server image downloads
- Fixed image path resolution (handles `produkty/BrandFolder/file.png` → `produkty/file.png`)
- Integrated automatic image fix into brand migration workflow
- 8 products remain without images (NULL paths in source CSV - requires manual upload)

### Version 2.1 (2025-12-02)

- Added `ptInlineImage` component for floating inline images with text wrap
- Added `width` field to inline images for fixed sizing
- Enhanced review resolution to handle all types (page, PDF, external) using ID pattern fallback
- Added 2x image upscaling for small images (< 1400px width)
- Disabled upscaling for inline images
- Added line break preservation in technical data table cells
- Enhanced table header parsing for grouped variants (e.g., "Atmosphere SX Alive")
- Added group title extraction from first cell of first row
- Fixed first letter edge case (big letter styling)
- Fixed images in headings edge case
- Removed `relatedProducts` from migration (left for manual curation)
- Added `ptHorizontalLine` for horizontal lines within text blocks
- Fixed bold/italic/line break preservation in HTML parsing

### Version 2.0 (2025-12-01)

- Updated `details.content` from raw Portable Text to **array of content blocks**
- Added `ptReviewEmbed` component for inline review embeds
- Updated link resolution to preserve **original legacy URLs**
- Added `product-brand-slug-map.csv` and `sitetree-map.csv` for link resolution
- Fixed category reference resolution to use `productCategorySub` schema type
- Added image extraction from nested `<p>` tags
