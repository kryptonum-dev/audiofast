# Brand Migration Flow - CSV-based

This document describes the data mapping and migration flow for brand data from the CSV export to Sanity CMS.

---

## Quick Reference: What to Migrate

| Field                   | Source in CSV                                       | Required |
| ----------------------- | --------------------------------------------------- | -------- |
| Name                    | `Name` column                                       | ✅       |
| Slug                    | Generated from `Slug` column                        | ✅       |
| Logo                    | `LogoFilename` column → upload asset                | ✅       |
| Hero Description        | `HeroDescription` column                            | ✅       |
| Hero Image              | **Always PrimaLuna ref**                            | ✅       |
| Banner Image            | `BannerImageFilename` column → upload asset         | Optional |
| **Content Blocks**      | ALL `TextBoxContent` rows → array of content blocks | ✅       |
| Images in Description   | `[image src="..."]` shortcodes → `ptMinimalImage`   | Optional |
| Headings in Description | H3/H4 → `h3` style blocks                           | Optional |
| YouTube Videos          | Extracted from `<iframe>` in `TextBoxContent`       | Optional |
| **Vimeo Videos**        | Extracted from `<iframe>` in `TextBoxContent`       | Optional |
| **Horizontal Lines**    | `<hr>` tags → `contentBlockHorizontalLine`          | Optional |
| Distribution Year       | **OMIT**                                            | ❌       |
| Image Gallery           | **OMIT** (unless "slider" block → use for gallery)  | ❌       |
| Featured Reviews        | **OMIT**                                            | ❌       |
| SEO Title               | Brand name only                                     | ✅       |
| SEO Description         | Generated, 110-140 chars                            | ✅       |

---

## Content Blocks Architecture (NEW)

### Overview

The `brandDescription` field has been replaced with `brandContentBlocks` - an array of content block types that mirrors the SilverStripe page builder structure.

### Block Types

| Block Type      | Sanity Type                  | Purpose                                                          |
| --------------- | ---------------------------- | ---------------------------------------------------------------- |
| Text Block      | `contentBlockText`           | Rich text with images, links, videos, and **two-column support** |
| YouTube Video   | `contentBlockYoutube`        | Standalone YouTube video embed                                   |
| Vimeo Video     | `contentBlockVimeo`          | Standalone Vimeo video embed                                     |
| Horizontal Line | `contentBlockHorizontalLine` | Visual separator between sections                                |

### Schema Structure

```typescript
// apps/studio/schemaTypes/definitions/content-blocks.ts

// Text block with rich content
contentBlockText: {
  content: PortableText  // Can include ptPageBreak for two columns
}

// Standalone video blocks
contentBlockYoutube: {
  youtubeId: string
  title?: string
  thumbnail?: image
}

contentBlockVimeo: {
  vimeoId: string
  title?: string
  thumbnail?: image
}

// Visual separator
contentBlockHorizontalLine: {
  style: 'horizontalLine' (hidden)
}
```

### Two-Column Layout with ptPageBreak

Within a `contentBlockText`, you can add a `ptPageBreak` component to split content into two columns:

```
[Content before ptPageBreak] | [Content after ptPageBreak]
         Left Column         |       Right Column
```

**Rules:**

- **Max 1 ptPageBreak** per text block (validation enforced)
- Columns size **naturally based on content amount** (not 50/50)
- If 3/4 content before break, 1/4 after → columns reflect that ratio
- On mobile, columns stack vertically

### Portable Text Components (inside contentBlockText)

| Component     | Type             | Purpose                         |
| ------------- | ---------------- | ------------------------------- |
| Page Break    | `ptPageBreak`    | Splits content into two columns |
| YouTube Video | `ptYoutubeVideo` | Inline YouTube within text      |
| Vimeo Video   | `ptVimeoVideo`   | Inline Vimeo within text        |
| Minimal Image | `ptMinimalImage` | Inline image                    |
| Heading       | `ptHeading`      | Custom heading                  |

---

## CSV Data Structure

### Source File

Export from phpMyAdmin with this query:

```sql
SELECT
  s.ID,
  s.Title as Name,
  s.URLSegment as Slug,
  p.LogoID,
  f.FileFilename as LogoFilename,
  p.ProducerDescription as HeroDescription,
  b_img.ID as BannerBoxID,
  b_img.BigPictureID,
  f_banner.FileFilename as BannerImageFilename,
  b_text.ID as TextBoxID,
  b_text.Content as TextBoxContent,
  b_text.box_type as BoxType
FROM SiteTree s
JOIN ProducerPage p ON s.ID = p.ID
LEFT JOIN File f ON p.LogoID = f.ID
LEFT JOIN Box b_img ON b_img.BoxedPageID = s.ID AND b_img.box_type = 'bigimg'
LEFT JOIN File f_banner ON b_img.BigPictureID = f_banner.ID
LEFT JOIN Box b_text ON b_text.BoxedPageID = s.ID
WHERE s.ClassName = 'ProducerPage'
ORDER BY s.Title, b_text.Sort;
```

### CSV Columns

| Column                | Description              | Example                                       |
| --------------------- | ------------------------ | --------------------------------------------- |
| `ID`                  | Brand ID                 | `58`                                          |
| `Name`                | Brand name               | `Bricasti`                                    |
| `Slug`                | URL segment              | `bricasti`                                    |
| `LogoID`              | File ID for logo         | `10617`                                       |
| `LogoFilename`        | Logo file path           | `producer-logo/Bricasti-250-v5.png`           |
| `HeroDescription`     | "Opis marki w menu" HTML | `<p>Bricasti to firma...</p>`                 |
| `BannerBoxID`         | Box ID for banner        | `733` or `NULL`                               |
| `BigPictureID`        | File ID for banner       | `10757` or `NULL`                             |
| `BannerImageFilename` | Banner file path         | `bigpicture/Bricasti-banner-v3.jpg` or `NULL` |
| `TextBoxID`           | Box ID for text          | `734`                                         |
| `TextBoxContent`      | Text or video HTML       | `<p>Bricasti Design...</p>`                   |
| `BoxType`             | Type of box              | `text`, `youtube`, `vimeo`, `line`, `slider`  |

### Important: Multiple Rows per Brand

A brand may have **multiple rows** in the CSV because:

- It has multiple content boxes (text, video, line sections)
- Each box creates a separate row
- Rows are ordered by `Sort` field

The migration script groups rows by `ID` and processes each box as a separate content block.

---

## SilverStripe Box Types → Sanity Content Blocks

| SilverStripe BoxType | Sanity Block Type            | Notes                                   |
| -------------------- | ---------------------------- | --------------------------------------- |
| `text`               | `contentBlockText`           | Rich text content                       |
| `youtube`            | `contentBlockYoutube`        | Standalone YouTube                      |
| `vimeo`              | `contentBlockVimeo`          | Standalone Vimeo                        |
| `line` / `<hr>`      | `contentBlockHorizontalLine` | Visual separator                        |
| `slider`             | → `imageGallery` field       | Images go to brand's imageGallery array |

---

## Field Mapping Details

### 1. Name

**Source:** `Name` column

```
'Bricasti' → name: 'Bricasti'
```

### 2. Slug

**Source:** `Slug` column with prefix/suffix

```
'bricasti' → slug: '/marki/bricasti/'
```

- Prefix with `/marki/`
- Suffix with `/`

### 3. Logo

**Source:** `LogoFilename` column

```
LogoFilename: 'producer-logo/Bricasti-250-v5.png'
→ Upload from: https://audiofast.pl/assets/producer-logo/Bricasti-250-v5.png
→ Returns: Sanity asset reference
```

### 4. Hero Description

**Source:** `HeroDescription` column

This is the "Opis marki w menu" - the simple description shown in brand cards/menus.

```html
<p>
  Bricasti to firma, której współzałożycielami są dwie amerykańskie legendy
  branży pro audio, Brian Zolner i Casey Dowdell...
</p>
```

→ Convert to Portable Text

### 5. Hero Image

**Source:** **ALWAYS use PrimaLuna reference**

```javascript
heroImage: {
  _type: 'image',
  asset: {
    _type: 'reference',
    _ref: 'image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp'
  }
}
```

### 6. Banner Image

**Source:** `BannerImageFilename` column (if not NULL)

```
BannerImageFilename: 'bigpicture/Bricasti-banner-v3.jpg'
→ Upload from: https://audiofast.pl/assets/bigpicture/Bricasti-banner-v3.jpg
→ Returns: Sanity asset reference
```

### 7. Content Blocks (brandContentBlocks)

**Note:** The section heading is always "O marce" (hardcoded in frontend). No need to migrate heading content.

**Source:** ALL `TextBoxContent` rows + box types

Each row in CSV becomes a content block based on its type:

#### 8a. Text Box → contentBlockText

```javascript
{
  _type: 'contentBlockText',
  _key: 'unique-key',
  content: [
    // Portable Text blocks
    { _type: 'block', style: 'normal', children: [...] },
    { _type: 'ptMinimalImage', ... },
    { _type: 'ptPageBreak', ... }, // Optional - creates two columns
    { _type: 'block', style: 'h3', children: [...] },
    { _type: 'ptYoutubeVideo', youtubeId: '...' }, // Inline video
  ]
}
```

#### 8b. YouTube Box → contentBlockYoutube

When a box contains ONLY a YouTube iframe:

```html
<iframe src="https://www.youtube.com/embed/W2TbD6R7_ug"></iframe>
```

```javascript
{
  _type: 'contentBlockYoutube',
  _key: 'unique-key',
  youtubeId: 'W2TbD6R7_ug',
  title: null,
  thumbnail: null
}
```

#### 8c. Vimeo Box → contentBlockVimeo

When a box contains ONLY a Vimeo iframe:

```html
<iframe src="https://player.vimeo.com/video/328584595"></iframe>
```

```javascript
{
  _type: 'contentBlockVimeo',
  _key: 'unique-key',
  vimeoId: '328584595',
  title: null,
  thumbnail: null
}
```

#### 8d. Line/HR → contentBlockHorizontalLine

When encountering `<hr>` tag or `line` box type:

```javascript
{
  _type: 'contentBlockHorizontalLine',
  _key: 'unique-key',
  style: 'horizontalLine'
}
```

#### 8e. Slider Box → imageGallery

When encountering a `slider` box type, extract all images and add to brand's `imageGallery` field:

```javascript
// Don't create a content block
// Instead, add images to:
imageGallery: [
  { _type: "image", asset: { _ref: "image-1-xxx" } },
  { _type: "image", asset: { _ref: "image-2-xxx" } },
  // ...
];
```

### 8. Image Handling in Text Blocks

Images in text blocks use SilverStripe shortcode format:

```html
[image src="/assets/produkty/GrimmAudio/Eelco-Grimm.jpg" id="8089" width="550"
height="364" class="leftAlone ss-htmleditorfield-file image"]
```

**Migration behavior:**

1. Extract image shortcodes from text content
2. Upload image from `https://audiofast.pl/assets/{path}` to Sanity
3. Convert to `ptMinimalImage` block inside contentBlockText:

```javascript
{
  _type: 'ptMinimalImage',
  _key: 'unique-key',
  image: {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: 'image-xxx-550x364-jpg'
    }
  }
}
```

### 9. Heading Styles in Text Blocks

HTML headings are mapped to Portable Text styles:

| Source HTML                | Portable Text Style | Notes                                                             |
| -------------------------- | ------------------- | ----------------------------------------------------------------- |
| `<h1>`                     | `h3`                | All H1 become H3 in content (section heading is always "O marce") |
| `<h2 class="left-border">` | `h3`                | Left-border headings become H3                                    |
| `<h2>`                     | `h3`                | Regular H2 maps to H3 in content                                  |
| `<h3>`                     | `h3`                | Preserved as H3                                                   |
| `<h4>`                     | `h3`                | Mapped to H3                                                      |
| `<p>`                      | `normal`            | Regular paragraphs                                                |
| `<blockquote>`             | `blockquote`        | Preserved                                                         |

### 10. Video Detection in Mixed Content

When a text box contains BOTH text AND video iframes:

```html
<p>Some text about the video...</p>
<iframe src="https://www.youtube.com/embed/W2TbD6R7_ug"></iframe>
<p>More text after the video...</p>
```

**Migration behavior:**

- Create single `contentBlockText`
- Video becomes inline `ptYoutubeVideo` or `ptVimeoVideo` within the content
- Text flows around/after the video

### 11-13. OMIT These Fields

- **Distribution Year** - Skip entirely
- **Image Gallery** - Only populate from `slider` boxes
- **Featured Reviews** - Skip entirely

### 14. SEO

**SEO Title:** Just the brand name

```
seo.title: 'Bricasti'
```

**SEO Description:** Generate 110-140 characters

```
seo.description: 'Bricasti to firma, której współzałożycielami są dwie amerykańskie legendy branży pro audio, Brian Zolner i Casey Dowdell, a nazwa firmy p...'
```

---

## Complete Example: Audio Research (ID 73)

### CSV Rows for Audio Research

```
Row 1 (text):
  ID: 73, Name: Audio Research, Slug: audio-research
  BoxType: text
  TextBoxContent: <p>Audio Research description...</p>
                  [image src="/assets/ar-image.jpg"]
                  <p>More text with page break marker...</p>

Row 2 (line):
  ID: 73, BoxType: line
  TextBoxContent: <hr>

Row 3 (text):
  ID: 73, BoxType: text
  TextBoxContent: <h3>Historia</h3><p>W 1951 roku...</p>

Row 4 (youtube):
  ID: 73, BoxType: youtube
  TextBoxContent: <iframe src="youtube.com/embed/hZWfULX9pC0">
```

### Resulting Sanity Document

```javascript
{
  _id: 'brand-73',
  _type: 'brand',
  name: 'Audio Research',
  slug: {
    _type: 'slug',
    current: '/marki/audio-research/'
  },
  logo: {
    _type: 'image',
    asset: { _type: 'reference', _ref: 'image-xxx-250x76-png' }
  },
  description: [
    {
      _type: 'block',
      children: [{ _type: 'span', text: 'Audio Research to firma...' }],
      style: 'normal'
    }
  ],
  heroImage: {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: 'image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp'
    }
  },
  bannerImage: {
    _type: 'image',
    asset: { _type: 'reference', _ref: 'image-yyy-1196x333-jpg' }
  },
  // Content Blocks Array (heading is always "O marce" in frontend)
  brandContentBlocks: [
    // Row 1 - Text block (with image and possible ptPageBreak)
    {
      _type: 'contentBlockText',
      _key: 'block-1',
      content: [
        { _type: 'block', style: 'normal', children: [{ text: 'Audio Research description...' }] },
        { _type: 'ptMinimalImage', _key: 'img-1', image: { asset: { _ref: '...' } } },
        { _type: 'ptPageBreak', _key: 'break-1', style: 'columnBreak' }, // Two columns!
        { _type: 'block', style: 'normal', children: [{ text: 'More text...' }] },
      ]
    },

    // Row 2 - Horizontal line
    {
      _type: 'contentBlockHorizontalLine',
      _key: 'block-2',
      style: 'horizontalLine'
    },

    // Row 3 - Text block (single column, no page break)
    {
      _type: 'contentBlockText',
      _key: 'block-3',
      content: [
        { _type: 'block', style: 'h3', children: [{ text: 'Historia' }] },
        { _type: 'block', style: 'normal', children: [{ text: 'W 1951 roku...' }] },
      ]
    },

    // Row 4 - Standalone YouTube
    {
      _type: 'contentBlockYoutube',
      _key: 'block-4',
      youtubeId: 'hZWfULX9pC0',
      title: null,
      thumbnail: null
    }
  ],

  seo: {
    title: 'Audio Research',
    description: 'Audio Research kojarzy się z prestiżem, doskonałym brzmieniem i wieloletnią trwałością wśród miłośników muzyki na całym świecie...'
  },
  doNotIndex: false,
  hideFromList: false
}
```

---

## Frontend Rendering

### ContentBlocks Component

Location: `apps/web/src/components/ui/ContentBlocks/index.tsx`

The component iterates through `brandContentBlocks` and renders each block type:

```tsx
blocks.map((block) => {
  switch (block._type) {
    case "contentBlockText":
      // Check if content has ptPageBreak
      // If yes → render in two-column grid layout
      // If no → render as single column
      return <TextBlockRenderer content={block.content} />;

    case "contentBlockYoutube":
      return <YoutubeBlock youtubeId={block.youtubeId} />;

    case "contentBlockVimeo":
      return <VimeoBlock vimeoId={block.vimeoId} />;

    case "contentBlockHorizontalLine":
      return <HorizontalLineBlock />;
  }
});
```

### Two-Column Detection

```typescript
function hasPageBreak(content: PortableTextProps): boolean {
  return content.some((item) => item._type === "ptPageBreak");
}

function splitContentAtPageBreak(content) {
  const index = content.findIndex((item) => item._type === "ptPageBreak");
  if (index === -1) return null;

  return [
    content.slice(0, index), // Left column
    content.slice(index + 1), // Right column (skip ptPageBreak)
  ];
}
```

### Two-Column Styling

```scss
.textBlockTwoColumn {
  display: grid;
  grid-template-columns: 1fr auto 1fr;

  .leftColumn {
    /* natural sizing */
  }
  .columnDivider {
    width: 1px;
    background: var(--neutral-400);
  }
  .rightColumn {
    /* natural sizing */
  }

  @media (max-width: 56.1875rem) {
    flex-direction: column;
    .columnDivider {
      width: 100%;
      height: 1px;
    }
  }
}
```

---

## Migration Script

### Location

```
apps/studio/scripts/migration/brands/migrate-brand-csv.ts
```

### Prerequisites

1. CSV file at project root: `brandsall.csv`
2. Environment variable: `SANITY_API_TOKEN`

### Usage

```bash
# Dry run (preview without changes)
bun run apps/studio/scripts/migration/brands/migrate-brand-csv.ts --name="Bricasti" --dry-run

# Migrate single brand by name
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/migrate-brand-csv.ts --name="Bricasti"

# Migrate single brand by ID
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/migrate-brand-csv.ts --id=58
```

### What the Script Does

1. **Read CSV** - Parse `brandsall.csv`
2. **Group by Brand** - Combine multiple rows with same ID, preserve order
3. **Find Target** - Locate brand by name or ID
4. **Upload Assets** - Logo and banner images (with SSL bypass)
5. **Process Each Box** - Convert to appropriate content block type
6. **Handle Sliders** - Extract images to imageGallery
7. **Transform Data** - Convert to Sanity document format
8. **Create Document** - Upload to Sanity with `createOrReplace`

---

## Asset Upload

### SSL Certificate Bypass

The legacy site `audiofast.pl` has SSL certificate issues. The script uses:

```javascript
import * as https from "node:https";

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Use with https.get()
https.get(imageUrl, { agent: insecureAgent }, callback);
```

### Asset URLs

```
Logo: https://audiofast.pl/assets/{LogoFilename}
Banner: https://audiofast.pl/assets/{BannerImageFilename}
```

---

## Handling YouTube vs Vimeo

### YouTube (Supported ✅)

```html
<iframe src="https://www.youtube.com/embed/W2TbD6R7_ug"></iframe>
```

→ Creates `contentBlockYoutube` (standalone) or `ptYoutubeVideo` (inline)

Extract ID:

```javascript
const match = content.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
```

### Vimeo (Supported ✅)

```html
<iframe src="https://player.vimeo.com/video/328584595"></iframe>
```

→ Creates `contentBlockVimeo` (standalone) or `ptVimeoVideo` (inline)

Extract ID:

```javascript
const match = content.match(/vimeo\.com\/video\/(\d+)/);
```

---

## Available Brands (from CSV)

| ID   | Name                 |
| ---- | -------------------- |
| 46   | Acoustic Signature   |
| 47   | Artesania Audio      |
| 52   | dCS                  |
| 55   | Exogal               |
| 56   | Dan D'Agostino       |
| 57   | Goldenear Technology |
| 58   | Bricasti             |
| 59   | PrimaLuna            |
| 60   | Rogue Audio          |
| 61   | Shunyata Research    |
| 62   | Soundsmith           |
| 63   | Spiral Groove        |
| 64   | Symposium            |
| 65   | Synergistic Research |
| 67   | Vandersteen          |
| 69   | Vibrapod             |
| 70   | Wilson Audio         |
| 71   | Gryphon Audio        |
| 73   | Audio Research       |
| 79   | Mutec                |
| 232  | Aurender             |
| 235  | Grand Prix Audio     |
| 237  | Moonriver Audio      |
| 242  | Usher                |
| 456  | KLH Audio            |
| 458  | Roon Labs            |
| 489  | Keces Audio          |
| 739  | Thixar               |
| 1543 | Grimm Audio          |
| 1669 | Taiko Audio          |
| 1747 | Dutch & Dutch        |
| 1903 | Stealth Audio        |
| 1982 | Ayre Acoustics       |
| 2049 | Weiss Engineering    |
| 2064 | VIV Laboratory       |

---

## Summary Checklist

For each brand migration, verify:

- [ ] Name extracted correctly
- [ ] Slug has `/marki/` prefix and `/` suffix
- [ ] Logo uploaded (if available)
- [ ] Hero description converted to Portable Text
- [ ] Hero image = PrimaLuna reference
- [ ] Banner image uploaded (if available)
- [ ] Section heading is hardcoded as "O marce" (no migration needed)
- [ ] **Content blocks array** created with correct block types
- [ ] **Text blocks** have proper Portable Text content
- [ ] **ptPageBreak** used for two-column layouts (max 1 per text block)
- [ ] **Images** in text blocks converted to `ptMinimalImage` and uploaded
- [ ] **Headings** (H3/H4) in text blocks have `h3` style
- [ ] **YouTube videos** → `contentBlockYoutube` (standalone) or `ptYoutubeVideo` (inline)
- [ ] **Vimeo videos** → `contentBlockVimeo` (standalone) or `ptVimeoVideo` (inline)
- [ ] **Horizontal lines** → `contentBlockHorizontalLine`
- [ ] **Slider images** → brand's `imageGallery` field
- [ ] SEO title = brand name
- [ ] SEO description = 110-140 chars
