# Article Content Migration Script

> **Script:** `migrate-article-content.ts`  
> **Purpose:** Migrates HTML content from SilverStripe boxes/pagebuilder to Sanity Portable Text

---

## Overview

This script converts legacy SilverStripe article content (stored as HTML in "boxes") into Sanity's Portable Text format. It handles various content types including text, images, videos, and galleries.

---

## Usage

```bash
# Live migration (all articles)
SANITY_API_TOKEN="your-token" bun run apps/studio/scripts/migration/blog/migrate-article-content.ts

# Dry run (preview without making changes)
bun run apps/studio/scripts/migration/blog/migrate-article-content.ts --dry-run

# Migrate specific article by ID
bun run apps/studio/scripts/migration/blog/migrate-article-content.ts --article=392

# Limit to first N articles
bun run apps/studio/scripts/migration/blog/migrate-article-content.ts --limit=5

# Verbose output
bun run apps/studio/scripts/migration/blog/migrate-article-content.ts --verbose
```

---

## Input Data (CSV Files)

The script requires two CSV files extracted from the SilverStripe database:

### 1. `real-articles-text.csv` - Article Boxes
Contains the content boxes for each article.

| Column | Description |
|--------|-------------|
| `BoxID` | Unique box identifier |
| `BlogPageID` | Parent article ID |
| `ArticleSlug` | Article URL slug |
| `ArticleTitle` | Article title |
| `Sort` | Box order within article |
| `BoxType` | Type: `text`, `video`, `gallery`, `slider`, `tabs`, `hr` |
| `BoxTitle` | Optional heading for the box |
| `YoutubeId` | YouTube video ID (for video boxes) |
| `HtmlContent` | HTML content (for text/tabs boxes) |

### 2. `real-articles-gallery.csv` - Gallery Images
Contains image data for gallery/slider boxes.

| Column | Description |
|--------|-------------|
| `BoxID` | Parent box ID |
| `ImageID` | Image identifier |
| `ImageSort` | Image order |
| `ImageFilename` | Path to image file |

### 3. Supporting CSV Files
- `product-brand-slug-mapping.csv` - Maps product IDs to full URL paths (e.g., `dcs/vivaldi-dac`)
- `site-tree.csv` - Maps SiteTree IDs to URL segments

---

## Box Type Conversions

| SilverStripe Box Type | Sanity Component |
|----------------------|------------------|
| `text` | Portable Text blocks (paragraphs, headings, lists) |
| `video` | `ptYoutubeVideo` |
| `gallery` / `slider` | `ptImageSlider` (requires ≥4 images) |
| `tabs` | Portable Text blocks (content extracted) |
| `hr` | Skipped (page breaks ignored) |

---

## HTML to Portable Text Conversion

### Supported HTML Elements

| HTML Element | Portable Text Output |
|--------------|---------------------|
| `<h1>`, `<h2>` | `block` with style `h2` |
| `<h3>`, `<h4>`, `<h5>`, `<h6>` | `block` with style `h3` |
| `<p>` | `block` with style `normal` |
| `<ul>` / `<li>` | `block` with `listItem: 'bullet'` |
| `<ol>` / `<li>` | `block` with `listItem: 'number'` |
| `<a href="...">` | `customLink` mark definition |
| `<img>` | `ptImage` component |
| `<iframe>` (YouTube) | `ptYoutubeVideo` component |
| `<iframe>` (Vimeo) | `ptVimeoVideo` component |

### SilverStripe Shortcodes

| Shortcode | Conversion |
|-----------|------------|
| `[image src="..." class="..."]` | `ptImage` component |
| `[product_link,id=X]` | Resolved to `https://www.audiofast.pl/{brand}/{product}` |
| `[sitetree_link,id=X]` | Resolved to `https://www.audiofast.pl/{urlSegment}` |

---

## Special Features

### 1. Heading Hierarchy Normalization

**Problem:** Some articles only use `h4` headings, creating a hierarchy gap (H1 → H3, skipping H2).

**Solution:** The script automatically normalizes headings by shifting them up:

```
Article has only h4 headings:
  - min level = 4
  - shift = 4 - 2 = 2
  - h4 → h2 ✓

Article has h3 and h4:
  - min level = 3
  - shift = 3 - 2 = 1
  - h3 → h2, h4 → h3 ✓
```

### 2. Auto-Width Images

Images with CSS class `left` or `right` (but NOT `leftAlone`/`rightAlone`) get `autoWidth: true`, which renders them with `width: auto` instead of `width: 100%`.

### 3. Link Resolution

All SilverStripe shortcodes and relative URLs are converted to absolute URLs:

```
[product_link,id=71] → https://www.audiofast.pl/dcs/vivaldi-dac
[sitetree_link,id=123] → https://www.audiofast.pl/kontakt
/blog/article → https://www.audiofast.pl/blog/article
```

### 4. Image Upload

Images are:
1. Downloaded from the legacy server (`https://www.audiofast.pl/assets/...`)
2. Uploaded to Sanity CDN
3. Cached to avoid duplicate uploads

---

## Output: Sanity Portable Text Blocks

### Text Block
```json
{
  "_type": "block",
  "_key": "abc123",
  "style": "normal",
  "markDefs": [],
  "children": [
    { "_type": "span", "_key": "xyz789", "text": "Content here" }
  ]
}
```

### Image Block
```json
{
  "_type": "ptImage",
  "_key": "abc123",
  "layout": "single",
  "image": {
    "_type": "image",
    "asset": { "_type": "reference", "_ref": "image-xxx-jpg" }
  },
  "autoWidth": true
}
```

### YouTube Video Block
```json
{
  "_type": "ptYoutubeVideo",
  "_key": "abc123",
  "youtubeId": "dQw4w9WgXcQ"
}
```

### Vimeo Video Block
```json
{
  "_type": "ptVimeoVideo",
  "_key": "abc123",
  "vimeoId": "328584595"
}
```

### Image Slider Block
```json
{
  "_type": "ptImageSlider",
  "_key": "abc123",
  "images": [
    { "_type": "image", "_key": "img1", "asset": { "_type": "reference", "_ref": "image-xxx-jpg" } },
    { "_type": "image", "_key": "img2", "asset": { "_type": "reference", "_ref": "image-yyy-jpg" } }
  ]
}
```

---

## Document Matching

The script finds existing Sanity documents by matching the article slug:

```
SilverStripe slug: "audioshow-2018"
Sanity slug: "/blog/audioshow-2018/"
```

If a document is not found, the article is skipped with a warning.

---

## Error Handling

- **Missing product/sitetree mapping:** Logs warning, link becomes `#`
- **Image upload failure:** Logs error, continues without image
- **Document not found:** Logs warning, skips article
- **Invalid box type:** Logs warning, skips box

---

## Migration Summary

After completion, the script outputs:

```
═══════════════════════════════════════════════════════════════
                        MIGRATION SUMMARY                       
═══════════════════════════════════════════════════════════════
   Total articles processed: 11
   Successful: 10
   Errors: 0
   Images uploaded: 173
═══════════════════════════════════════════════════════════════
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SANITY_API_TOKEN` | Sanity write token | Yes (for live migration) |
| `SANITY_PROJECT_ID` | Sanity project ID | No (defaults to `fsw3likv`) |
| `SANITY_DATASET` | Sanity dataset | No (defaults to `production`) |

