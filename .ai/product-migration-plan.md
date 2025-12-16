# Product Migration Plan

## Overview

This document outlines the comprehensive strategy for migrating products from the legacy **SilverStripe CMS** MySQL database to the new **Sanity CMS** platform. The migration involves transferring product data, images, content boxes, technical specifications, category relationships, and review associations.

> **Note:** Store/dealer availability is managed at the **brand level**, not the product level. Products inherit store availability from their associated brand.

---

## 1. Source System Analysis

### 1.1 Database Tables

| Table                  | Purpose                                   | Key Fields                                                                                                                          |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Product`              | Main product data                         | `ID`, `name`, `producttitle_desc`, `URLSegment`, `archived`, `ProductImageID`, `ProductTypeID`, `ProducerPageID`, `MetaDescription` |
| `Box`                  | Content boxes (details, galleries, specs) | `ID`, `ProductID`, `box_type`, `Content`, `BoxTitle`, `Sort`                                                                        |
| `Box_GridImage`        | Gallery images for boxes                  | `BoxID`, `ImageID`, `Sort`                                                                                                          |
| `Tabs`                 | Technical specifications                  | `ID`, `BoxID`, `Title`, `Content`, `Sort`                                                                                           |
| `File`                 | Image/file assets                         | `ID`, `FileFilename`, `Name`                                                                                                        |
| `ProductType`          | Category data                             | `ID`, `TypeDescription`                                                                                                             |
| `SiteTree`             | Page metadata (for categories/brands)     | `ID`, `URLSegment`, `Title`, `ClassName`                                                                                            |
| `Product_ProductTypes` | Product-Category many-to-many             | `ProductID`, `ProductTypeID`                                                                                                        |
| `Dealer_ProducerPage`  | Brand-Dealer relationships                | `DealerID`, `ProducerPageID`                                                                                                        |
| `ReviewProduct`        | Product-Review relationships              | `ProductID`, `ReviewID`                                                                                                             |
| `BoxReviews`           | Reviews in product boxes                  | `ProductID`, `ReviewPageID`, `BoxID`                                                                                                |
| `ProducerPage`         | Brand data                                | `ID` (links to SiteTree)                                                                                                            |

### 1.2 Product Table Structure

```sql
CREATE TABLE `Product` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `URLSegment` varchar(100),           -- URL slug
  `name` varchar(100),                  -- Product name
  `archived` tinyint(1) unsigned,       -- Archive status (0/1)
  `ProductImageID` int(11),             -- Main image reference → File
  `ProductTypeID` int(11),              -- Primary category → ProductType/SiteTree
  `ProducerPageID` int(11),             -- Brand reference → ProducerPage/SiteTree
  `producttitle_desc` varchar(200),     -- Subtitle (category description)
  `MetaDescription` mediumtext,         -- SEO description
  `MetaTitle` varchar(200),             -- SEO title
  `ProductHeaderImageID` int(11),       -- Header image (optional)
  `publish` tinyint(1) unsigned,        -- Publish status
  `hide` tinyint(1) unsigned            -- Hidden flag
);
```

### 1.3 Box Table Structure (Content Boxes)

```sql
CREATE TABLE `Box` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ProductID` int(11),                  -- Product reference
  `BoxedPageID` int(11),                -- Page reference (for brands/articles)
  `box_type` varchar(20),               -- Type: 'text', 'slider', 'youtube', 'vimeo', 'line', 'tabs'
  `Content` mediumtext,                 -- HTML content
  `BoxTitle` varchar(100),              -- Section title
  `Sort` int(11),                       -- Order within product
  `Youtube` varchar(255)                -- YouTube video ID
);
```

### 1.4 Key Relationships

```
Product
├── → ProducerPage (brand via ProducerPageID)
│   └── → SiteTree (URLSegment for brand slug)
├── → ProductType (primary category via ProductTypeID)
│   └── → SiteTree (URLSegment for category slug)
├── → File (main image via ProductImageID)
├── ← Product_ProductTypes (additional categories, many-to-many)
├── ← Box (content boxes via Box.ProductID)
│   ├── ← Box_GridImage (gallery images)
│   └── ← Tabs (technical specifications)
├── ← ReviewProduct (product-review associations)
├── ← BoxReviews (reviews shown in product boxes)
└── → Dealer_ProducerPage (dealers via brand relationship)
```

---

## 2. Target System (Sanity CMS)

### 2.1 Product Schema Fields

| #   | Field                | Type                    | Source                                                  | Migration Notes                                     |
| --- | -------------------- | ----------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | `name`               | string                  | `Product.name`                                          | Direct copy                                         |
| 2   | `subtitle`           | string (optional)       | `Product.producttitle_desc`                             | Direct copy (can be null)                           |
| 3   | `slug`               | slug                    | `Product.URLSegment`                                    | Prefix: `/produkty/` (no brand in URL)              |
| 4   | `basePriceCents`     | number                  | **SKIP**                                                | From Supabase (not migrated)                        |
| 5   | `lastPricingSync`    | datetime                | **SKIP**                                                | From Supabase (not migrated)                        |
| 6   | `previewImage`       | image                   | `File` via `ProductImageID`                             | Upload to Sanity CDN (WebP, 2x upscale if < 1400px) |
| 7   | `imageGallery`       | array[image]            | `Box` (`box_type='gallery'`) → `Box_GridImage` → `File` | Upload images from gallery boxes                    |
| 8   | `shortDescription`   | portableText            | **SKIP**                                                | Optional field, not migrated                        |
| 9   | `isArchived`         | boolean                 | `Product.archived`                                      | Convert 0/1 to boolean                              |
| 10  | `isCPO`              | boolean                 | **ALWAYS FALSE**                                        | New functionality                                   |
| 11  | `brand`              | reference               | `ProducerPageID` → Sanity brand                         | Map via brand slug                                  |
| 12  | `categories`         | array[reference]        | `ProductTypeID` + `Product_ProductTypes`                | Map via category slug to `productCategorySub`       |
| 13  | `customFilterValues` | array[object]           | **EMPTY**                                               | New functionality                                   |
| 14  | `details.heading`    | portableText            | **SKIP**                                                | Hardcoded in frontend                               |
| 15  | `details.content`    | **array[contentBlock]** | `Box.Content` (all text boxes)                          | **Array of content blocks** (not raw Portable Text) |
| 16  | `technicalData`      | object                  | `Tabs.Content`                                          | HTML table → structured data (with line breaks)     |
| 17  | `availableInStores`  | array[reference]        | **SKIP**                                                | Managed at brand level, not product                 |
| 18  | `reviews`            | array[reference]        | `ReviewProduct` + `BoxReviews`                          | All types: page (by slug), PDF/external (by ID)     |
| 19  | `relatedProducts`    | array[reference]        | **SKIP**                                                | Not migrated, manual curation only                  |
| 20  | `pageBuilder`        | pageBuilder             | **EMPTY**                                               | Optional custom sections                            |
| 21  | `seo.title`          | string                  | `Product.name`                                          | Brand + Product name                                |
| 22  | `seo.description`    | string                  | **EMPTY**                                               | Left empty, can be added manually later             |
| 23  | `doNotIndex`         | boolean                 | **FALSE**                                               | Always false                                        |
| 24  | `hideFromList`       | boolean                 | **FALSE**                                               | Always false                                        |

### 2.2 Slug Generation

Product slugs follow the pattern: `/produkty/{product-slug}/`

Example:

- Product: `vivaldi-dac` (from Product.URLSegment)
- Result: `/produkty/vivaldi-dac/`

**Note:** Brand is NOT included in the URL. The slug is simply the product's URLSegment with the `/produkty/` prefix.

---

## 3. Data Extraction (CSV Files)

We need **6 CSV files** to be extracted from phpMyAdmin:

### 3.1 CSV #1: Main Product Data (`products-main.csv`)

**Purpose:** Core product information

**SQL Query:**

```sql
SELECT
  p.ID as ProductID,
  p.name as ProductName,
  p.producttitle_desc as Subtitle,
  p.URLSegment as ProductSlug,
  p.archived as IsArchived,
  p.publish as IsPublished,
  p.hide as IsHidden,
  p.MetaDescription,
  p.MetaTitle,
  p.ProductImageID,
  f_main.FileFilename as MainImageFilename,
  p.ProductTypeID as PrimaryCategoryID,
  st_cat.URLSegment as PrimaryCategorySlug,
  st_cat.Title as PrimaryCategoryName,
  p.ProducerPageID as BrandID,
  st_brand.URLSegment as BrandSlug,
  st_brand.Title as BrandName
FROM Product p
LEFT JOIN File f_main ON p.ProductImageID = f_main.ID
LEFT JOIN SiteTree st_cat ON p.ProductTypeID = st_cat.ID
LEFT JOIN SiteTree st_brand ON p.ProducerPageID = st_brand.ID
WHERE p.publish = 1 OR p.archived = 1
ORDER BY st_brand.Title, p.name;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| ProductID | Legacy product ID |
| ProductName | Product name |
| Subtitle | Product subtitle/category description |
| ProductSlug | URL segment |
| IsArchived | 0 or 1 |
| IsPublished | 0 or 1 |
| IsHidden | 0 or 1 |
| MetaDescription | SEO description |
| MetaTitle | SEO title |
| ProductImageID | Main image file ID |
| MainImageFilename | Main image path |
| PrimaryCategoryID | Primary category ID |
| PrimaryCategorySlug | Primary category URL segment |
| PrimaryCategoryName | Primary category name |
| BrandID | Brand ID |
| BrandSlug | Brand URL segment |
| BrandName | Brand name |

---

### 3.2 CSV #2: Product Categories (`products-categories.csv`)

**Purpose:** Many-to-many product-category relationships

**SQL Query:**

```sql
SELECT
  ppt.ProductID,
  ppt.ProductTypeID as CategoryID,
  st.URLSegment as CategorySlug,
  st.Title as CategoryName
FROM Product_ProductTypes ppt
JOIN SiteTree st ON ppt.ProductTypeID = st.ID
JOIN Product p ON ppt.ProductID = p.ID
WHERE p.publish = 1 OR p.archived = 1
ORDER BY ppt.ProductID, ppt.ProductTypeID;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| ProductID | Legacy product ID |
| CategoryID | Category ID |
| CategorySlug | Category URL segment |
| CategoryName | Category name |

---

### 3.3 CSV #3: Product Content Boxes (`products-content-boxes.csv`)

**Purpose:** Content boxes for product details (text, videos, horizontal lines)

**SQL Query:**

```sql
SELECT
  b.ID as BoxID,
  b.ProductID,
  p.name as ProductName,
  b.Sort as BoxSort,
  b.box_type as BoxType,
  b.BoxTitle,
  b.Content as BoxContent,
  b.Youtube as YoutubeId
FROM Box b
JOIN Product p ON b.ProductID = p.ID
WHERE b.ProductID > 0
  AND b.box_type IN ('text', 'youtube', 'vimeo', 'line', 'hr', 'gallery')
  AND (p.publish = 1 OR p.archived = 1)
ORDER BY b.ProductID, b.Sort;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| BoxID | Box ID |
| ProductID | Legacy product ID |
| ProductName | Product name (for reference) |
| BoxSort | Order within product |
| BoxType | 'text', 'youtube', 'vimeo', 'line', 'hr', 'gallery' |
| BoxTitle | Section title |
| BoxContent | HTML content |
| YoutubeId | YouTube video ID (if applicable) |

**Note:** `gallery` boxes are included to identify them, but their content goes to `imageGallery` field (not details).

---

### 3.4 CSV #4: Product Gallery Images (`products-gallery-images.csv`)

**Purpose:** Gallery images from gallery boxes

**SQL Query:**

```sql
SELECT
  bgi.BoxID,
  b.ProductID,
  p.name as ProductName,
  bgi.ImageID,
  bgi.Sort as ImageSort,
  f.FileFilename as ImageFilename,
  f.Name as ImageName
FROM Box_GridImage bgi
JOIN Box b ON bgi.BoxID = b.ID
JOIN Product p ON b.ProductID = p.ID
JOIN File f ON bgi.ImageID = f.ID
WHERE b.ProductID > 0
  AND b.box_type = 'gallery'
  AND (p.publish = 1 OR p.archived = 1)
ORDER BY b.ProductID, bgi.Sort;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| BoxID | Parent box ID |
| ProductID | Legacy product ID |
| ProductName | Product name (for reference) |
| ImageID | File ID |
| ImageSort | Image order |
| ImageFilename | Image path |
| ImageName | Image name |

---

### 3.5 CSV #5: Product Technical Data (`products-technical-data.csv`)

**Purpose:** Technical specifications from tabs

**SQL Query:**

```sql
SELECT
  t.ID as TabID,
  t.BoxID,
  b.ProductID,
  p.name as ProductName,
  t.Sort as TabSort,
  t.Title as TabTitle,
  t.Content as TabContent
FROM Tabs t
JOIN Box b ON t.BoxID = b.ID
JOIN Product p ON b.ProductID = p.ID
WHERE b.ProductID > 0
  AND (p.publish = 1 OR p.archived = 1)
ORDER BY b.ProductID, t.Sort;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| TabID | Tab ID |
| BoxID | Parent box ID |
| ProductID | Legacy product ID |
| ProductName | Product name (for reference) |
| TabSort | Tab order |
| TabTitle | Tab/section title |
| TabContent | HTML table content |

---

### 3.6 CSV #6: Product-Review Relationships (`products-reviews.csv`)

**Purpose:** Reviews associated with products

**SQL Query:**

```sql
SELECT
  rp.ProductID,
  p.name as ProductName,
  rp.ReviewID,
  st.URLSegment as ReviewSlug,
  st.Title as ReviewTitle,
  rp.Sort as ReviewSort
FROM ReviewProduct rp
JOIN Product p ON rp.ProductID = p.ID
JOIN SiteTree st ON rp.ReviewID = st.ID AND st.ClassName = 'ReviewPage'
WHERE (p.publish = 1 OR p.archived = 1)

UNION

SELECT
  br.ProductID,
  p.name as ProductName,
  br.ReviewPageID as ReviewID,
  st.URLSegment as ReviewSlug,
  st.Title as ReviewTitle,
  br.Sort as ReviewSort
FROM BoxReviews br
JOIN Product p ON br.ProductID = p.ID
JOIN SiteTree st ON br.ReviewPageID = st.ID AND st.ClassName = 'ReviewPage'
WHERE br.ProductID > 0
  AND (p.publish = 1 OR p.archived = 1)

ORDER BY ProductID, ReviewSort;
```

**Expected Columns:**
| Column | Description |
|--------|-------------|
| ProductID | Legacy product ID |
| ProductName | Product name |
| ReviewID | Review ID |
| ReviewSlug | Review URL segment |
| ReviewTitle | Review title |
| ReviewSort | Review order |

---

## 4. Migration Phases

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Prerequisites                                         │
│  • Verify all brands migrated to Sanity                         │
│  • Verify all categories migrated to Sanity                     │
│  • Verify all reviews migrated to Sanity                        │
│  • Extract all 6 CSV files from phpMyAdmin                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Build Reference Mappings                              │
│  • Load brand slug → Sanity ID mapping                          │
│  • Load category slug → Sanity ID mapping                       │
│  • Load review slug → Sanity ID mapping                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Single Product Migration (Testing)                    │
│  • Select one product with all features (images, reviews, etc.) │
│  • Run migration with --dry-run                                 │
│  • Verify all fields populated correctly                        │
│  • Fix any issues before batch migration                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Batch Product Migration                               │
│  • Migrate all products in batches of 10-20                     │
│  • Upload images to Sanity CDN                                  │
│  • Convert HTML → Portable Text                                 │
│  • Parse technical data tables                                  │
│  • Create reference links                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Validation & Cleanup                                  │
│  • Verify product counts match                                  │
│  • Check for broken references                                  │
│  • Validate images uploaded successfully                        │
│  • Manual review of sample products                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Field Transformation Details

### 5.1 Name

**Source:** `Product.name`

```
'Vivaldi DAC' → name: 'Vivaldi DAC'
```

### 5.2 Subtitle

**Source:** `Product.producttitle_desc`

```
'Przetwornik cyfrowo-analogowy' → subtitle: 'Przetwornik cyfrowo-analogowy'
```

### 5.3 Slug

**Source:** `Product.URLSegment`

```
Product slug: 'vivaldi-dac'
→ slug: '/produkty/vivaldi-dac/'
```

**Note:** Brand is NOT part of the URL. Only the product's URLSegment with `/produkty/` prefix.

### 5.4 Preview Image

**Source:** `File.FileFilename` via `Product.ProductImageID`

```
FileFilename: 'produkty/dcs/vivaldi-dac-main.jpg'
→ Upload from: https://audiofast.pl/assets/produkty/dcs/vivaldi-dac-main.jpg
→ Returns: Sanity image asset reference
```

### 5.5 Image Gallery

**Source:** `Box` with `box_type = 'gallery'` → `Box_GridImage` → `File`

When a product has a `Box` with `box_type = 'gallery'`, all images from that gallery box (via `Box_GridImage` junction table) are extracted and uploaded to the product's `imageGallery` array in Sanity.

**Note:** `slider` box type is SKIPPED - we don't have sliders in products.

Process:

1. Find all `Box` records where `ProductID = product.ID` AND `box_type = 'gallery'`
2. For each gallery box, get all images via `Box_GridImage` (ordered by `Sort`)
3. Upload each image to Sanity CDN
4. Add all image references to the product's `imageGallery` array

### 5.6 Short Description

**Source:** **SKIP** (optional field)

This field is **optional** in the Sanity schema. During migration, we skip this field entirely.
The frontend will not display the description section if this field is empty.

If needed later, short descriptions can be manually added through Sanity Studio.

### 5.7 Is Archived

**Source:** `Product.archived`

```
archived = 1 → isArchived: true
archived = 0 → isArchived: false
```

### 5.8 Is CPO

**Always:** `false` (new functionality)

### 5.9 Brand Reference

**Source:** `Product.ProducerPageID` → `SiteTree.URLSegment`

Lookup in Sanity: Find brand where `slug.current` matches `/marki/{brand-slug}/`

### 5.10 Categories

**Source:**

1. Primary: `Product.ProductTypeID` → `SiteTree.URLSegment`
2. Additional: `Product_ProductTypes.ProductTypeID` → `SiteTree.URLSegment`

Lookup in Sanity: Find categories where `slug.current` matches `/kategoria/{category-slug}/`

### 5.11 Custom Filter Values

**Always:** `[]` (empty array - new functionality)

### 5.12 Details Content

**Source:** ALL `Box` records where `ProductID = product.ID` (sorted by `Sort`)

**IMPORTANT:** The `details.content` field is an **array of content blocks**, not raw Portable Text. This structure matches the brand schema (`brandContentBlocks`).

This is the most complex transformation. Each box type is processed differently:

#### Box Type → Content Block Mapping

| Box Type      | Sanity Content Block                  | Notes                                     |
| ------------- | ------------------------------------- | ----------------------------------------- |
| `text`        | `contentBlockText` with Portable Text | Main content - see HTML conversion below  |
| `hr` / `line` | `contentBlockHorizontalLine`          | Horizontal separator                      |
| `youtube`     | `contentBlockYoutube`                 | Standalone YouTube video                  |
| `vimeo`       | `contentBlockVimeo`                   | Standalone Vimeo video                    |
| `gallery`     | → `imageGallery` field                | Images go to product gallery, NOT details |
| `slider`      | **SKIP**                              | Not used in products                      |
| `dealers`     | **SKIP**                              | Not relevant for products                 |
| `bigImg`      | **SKIP**                              | Not used in products                      |

#### Content Block Structure

```typescript
// details.content is an array of:
type DetailsContent = Array<
  | { _type: "contentBlockText"; _key: string; content: PortableTextBlock[] }
  | { _type: "contentBlockYoutube"; _key: string; videoId: string }
  | { _type: "contentBlockVimeo"; _key: string; videoId: string }
  | { _type: "contentBlockHorizontalLine"; _key: string }
>;
```

#### Text Box → contentBlockText Conversion

For `text` box type, HTML content is wrapped in a `contentBlockText` block:

| HTML Element                                                   | Portable Text                         | Notes                       |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------- |
| `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>`                 | Block with `style: 'h3'`              | **All headings become h3**  |
| `<p>`                                                          | Block with `style: 'normal'`          | Regular paragraphs          |
| `<ul>`                                                         | List blocks with `listItem: 'bullet'` | Unordered lists             |
| `<ol>`                                                         | List blocks with `listItem: 'number'` | Ordered lists               |
| `<strong>`, `<b>`                                              | Mark: `strong`                        | Bold text                   |
| `<em>`, `<i>`                                                  | Mark: `em`                            | Italic text                 |
| `<br>`                                                         | Newline in text span                  | Line breaks preserved       |
| `<a href="...">`                                               | `customLink` annotation               | See link resolution below   |
| `<img>` or `[image src="..."]`                                 | `ptMinimalImage` component            | Block-level images          |
| `<img class="left/right">` or `[image ... class="left/right"]` | `ptInlineImage` component             | **Floating inline images**  |
| `<iframe>` (YouTube)                                           | `ptYoutubeVideo` component            | Embedded YouTube            |
| `<iframe>` (Vimeo)                                             | `ptVimeoVideo` component              | Embedded Vimeo              |
| `<!-- pagebreak -->`                                           | `ptPageBreak` component               | **Column divider**          |
| `[recenzja id=X]`                                              | `ptReviewEmbed` component             | **Inline review card**      |
| `<hr>` (within text)                                           | `ptHorizontalLine` component          | **Horizontal line in text** |

#### Page Break (ptPageBreak)

The `<!-- pagebreak -->` HTML comment is converted to a `ptPageBreak` block, which creates a two-column layout:

- Content **before** the pagebreak displays in the **left column**
- Content **after** the pagebreak displays in the **right column**

```typescript
{
  _type: 'ptPageBreak',
  _key: 'xxx',
  style: 'columnBreak'
}
```

#### Inline Review Embed (ptReviewEmbed)

The `[recenzja id=X]` shortcode is converted to a `ptReviewEmbed` component that displays an inline review card:

**Resolution Process:**

1. Extract legacy review ID from `[recenzja id=X]` shortcode
2. Look up review slug in `products-reviews.csv` (which maps ProductID → ReviewID → ReviewSlug)
3. Query Sanity for review with matching slug
4. Create `ptReviewEmbed` block with review reference

```typescript
{
  _type: 'ptReviewEmbed',
  _key: 'xxx',
  review: {
    _type: 'reference',
    _ref: 'review-document-id'
  }
}
```

**Frontend Rendering:**

- Review title
- Short description excerpt (first 2-3 paragraphs)
- Review image (small, floating right)
- "Czytaj dalej..." button linking to full review

#### Inline Images (ptInlineImage)

Images with `class="left"` or `class="right"` in the legacy HTML become floating inline images with text wrapping:

```html
<!-- Legacy HTML -->
<img src="/assets/image.jpg" class="left" width="90" />

<!-- Or shortcode -->
[image src="/assets/image.jpg" class="left" width="90"]
```

Becomes:

```typescript
{
  _type: 'ptInlineImage',
  _key: 'xxx',
  image: { _type: 'image', asset: { _ref: 'image-xxx' } },
  float: 'left',  // or 'right'
  width: 90       // Fixed width from shortcode (optional)
}
```

**Key Features:**

- Float left or right with text wrapping
- Optional fixed width from legacy `width` attribute
- No 2x upscaling (inline images stay small intentionally)
- Max 300px width in optimizer
- On mobile: constrained to 40% width

**Frontend Component:** `apps/web/src/components/portableText/InlineImage/`

#### Link Resolution (customLink)

**IMPORTANT:** Links are preserved as **original legacy URLs** to allow future redirect setup. We do NOT convert them to new Sanity slugs.

```typescript
// SilverStripe shortcodes resolved using CSV mappings:
// [product_link,id=X] → https://www.audiofast.pl/{brand}/{product}
//   Uses: product-brand-slug-map.csv (ProductID → BrandSlug/ProductSlug)
//
// [sitetree_link,id=X] → https://www.audiofast.pl/{urlSegment}
//   Uses: sitetree-map.csv (SiteTreeID → URLSegment)

// Relative URLs prefixed with base:
// /kontakt → https://www.audiofast.pl/kontakt
// blog/article → https://www.audiofast.pl/blog/article

// External URLs kept as-is:
// https://example.com → https://example.com
```

Links are converted to `customLink` annotation with structure:

```typescript
{
  _type: 'customLink',
  _key: 'link-xxx',
  customLink: {
    type: 'external',
    openInNewTab: true,
    external: 'https://www.audiofast.pl/audioresearch/ref160m'  // Original legacy URL
  }
}
```

### 5.13 Technical Data

**Source:** `Tabs.Content` (HTML tables)

Parse HTML tables into structured data:

```typescript
{
  variants: ['Model A', 'Model B'],  // Column headers (if multi-variant)
  groups: [
    {
      title: 'Specyfikacja techniczna',  // Section title from Tab or first cell
      rows: [
        {
          title: 'Impedancja',
          values: [
            { content: [{ _type: 'block', children: [{ text: '8Ω' }] }] }
          ]
        }
      ]
    }
  ]
}
```

**Key Features:**

| Feature                         | Description                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------- |
| **Simple tables**               | 2-column tables: parameter name + single value                                   |
| **Multi-column tables**         | 3+ columns become variants                                                       |
| **Grouped variants**            | Two-row headers with group names are flattened (e.g., "Atmosphere SX Alive")     |
| **Group title from first cell** | If first cell of first row contains non-variant text, it becomes the group title |
| **Colspan handling**            | Values spanning multiple columns are duplicated for each variant                 |
| **Line breaks**                 | `<br>` tags in cells are preserved as `\n` in text spans                         |

**Example - Grouped Variants:**

```html
<tr>
  <td></td>
  <td colspan="3"><strong>Atmosphere SX</strong></td>
</tr>
<tr>
  <td>Parameter</td>
  <td><strong>Alive</strong></td>
  <td><strong>Excite</strong></td>
</tr>
```

Results in: `variants: ["Atmosphere SX Alive", "Atmosphere SX Excite"]`

### 5.14 Available In Stores

**Source:** **SKIP** (managed at brand level)

Store/dealer availability is managed at the **brand level**, not the product level. This field is left empty during product migration. Products inherit store availability from their associated brand.

### 5.15 Reviews

**Source:** `ReviewProduct` + `BoxReviews`

Reviews are resolved using a **two-step fallback process** to handle all review types:

| Review Type | Has Slug | Resolution Method                          |
| ----------- | -------- | ------------------------------------------ |
| Page        | Yes      | Matched by slug `/recenzje/{review-slug}/` |
| PDF         | No       | Matched by ID pattern `review-{legacyId}`  |
| External    | No       | Matched by ID pattern `review-{legacyId}`  |

**Resolution Process:**

1. **Primary:** Try to resolve by `ReviewSlug` from CSV
2. **Fallback:** If no slug found, resolve by `ReviewID` using pattern `review-{legacyId}`

This ensures all review types are correctly linked to products, not just page-type reviews with slugs.

### 5.16 SEO Title

**Source:** Generated from brand + product name

```
seo.title: 'dCS Vivaldi DAC'
```

### 5.17 SEO Description

**Source:** **EMPTY**

SEO description is left empty during migration. It can be manually added later through Sanity Studio if needed.

---

## 6. Migration Script Architecture

```
apps/studio/scripts/migration/products/
├── index.ts                      # Main orchestrator
├── migrate-products.ts           # Main migration script
├── migrate-single-product.ts     # Single product migration (testing)
├── parser/
│   ├── csv-parser.ts             # CSV parsing utilities
│   ├── html-to-portable-text.ts  # HTML → PT conversion
│   └── technical-data-parser.ts  # HTML table → structured data
├── transformers/
│   ├── product-transformer.ts    # Main transformation logic
│   ├── image-transformer.ts      # Image upload & reference
│   └── reference-resolver.ts     # Brand/category/review lookups
├── utils/
│   ├── asset-uploader.ts         # Upload images to Sanity CDN
│   ├── image-optimizer.ts        # WebP conversion & optimization (Sharp)
│   ├── sanity-client.ts          # Sanity client setup
│   └── id-mapping.ts             # Legacy ID → Sanity ID mapping
├── types.ts                      # TypeScript interfaces
├── mappings/
│   ├── brand-mapping.json        # Brand slug → Sanity ID
│   ├── category-mapping.json     # Category slug → Sanity ID
│   └── review-mapping.json       # Review slug → Sanity ID
├── image-cache.json              # Cached image uploads (resumable)
└── README.md                     # Usage documentation
```

### 6.1 Key Dependencies

```json
{
  "dependencies": {
    "sharp": "^0.33.x", // Image processing & WebP conversion
    "csv-parse": "^5.x", // CSV parsing
    "node-html-parser": "^6.x", // HTML parsing for content conversion
    "@sanity/client": "^6.x" // Sanity client
  },
  "devDependencies": {
    "@types/sharp": "^0.x"
  }
}
```

---

## 7. Usage Commands

```bash
# Dry run - preview single product
bun run apps/studio/scripts/migration/products/migrate-single-product.ts \
  --id=826 \
  --dry-run

# Migrate single product
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-single-product.ts \
  --id=826

# Dry run - all products
bun run apps/studio/scripts/migration/products/migrate-products.ts --dry-run

# Migrate all products
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-products.ts

# With options
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/products/migrate-products.ts \
  --skip-existing \
  --batch-size=10 \
  --limit=50 \
  --verbose

# Rollback all products
bun run apps/studio/scripts/migration/products/migrate-products.ts --rollback
```

---

## 8. ID Patterns

| Entity  | ID Pattern            | Example       |
| ------- | --------------------- | ------------- |
| Product | `product-{legacy-id}` | `product-826` |

---

## 9. Asset Upload Strategy

### 9.1 Image Sources

```
Main image: https://audiofast.pl/assets/{MainImageFilename}
Gallery images: https://audiofast.pl/assets/{ImageFilename}
```

### 9.2 Image Optimization Pipeline

All images are **converted to WebP** during migration for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│  DOWNLOAD                                                       │
│  • Fetch from legacy server (with SSL bypass)                   │
│  • Accept: JPG, PNG, JPEG, GIF                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROCESS (using Sharp)                                          │
│  • Convert to WebP format                                       │
│  • Resize if exceeds max dimensions (2400px width)              │
│  • Apply quality compression (80-85%)                           │
│  • Strip EXIF metadata (preserve color profile)                 │
│  • Maintain aspect ratio                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  UPLOAD TO SANITY CDN                                           │
│  • Upload optimized WebP buffer                                 │
│  • Set filename with .webp extension                            │
│  • Cache asset ID for deduplication                             │
└─────────────────────────────────────────────────────────────────┘
```

#### Why WebP?

| Format   | Avg Size (1920px) | Quality       | Browser Support |
| -------- | ----------------- | ------------- | --------------- |
| JPEG     | ~400KB            | Good          | 100%            |
| PNG      | ~1.2MB            | Lossless      | 100%            |
| **WebP** | **~150KB**        | **Excellent** | **97%+**        |

WebP provides **50-80% smaller file sizes** compared to JPEG/PNG with equivalent visual quality.

#### Sharp Configuration

```typescript
import sharp from "sharp";

interface ImageOptimizationConfig {
  format: "webp";
  quality: number; // 80-85 for photos, 90 for graphics
  maxWidth: number; // 2400px for main images, 1920px for gallery
  maxHeight: number; // 1600px max
  stripMetadata: boolean; // true - remove EXIF, keep color profile
  progressive: boolean; // true - progressive loading
}

const DEFAULT_CONFIG: ImageOptimizationConfig = {
  format: "webp",
  quality: 82,
  maxWidth: 2400,
  maxHeight: 1600,
  stripMetadata: true,
  progressive: true,
};

async function optimizeImage(
  buffer: Buffer,
  config: ImageOptimizationConfig = DEFAULT_CONFIG,
): Promise<Buffer> {
  return sharp(buffer)
    .resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: "inside", // Maintain aspect ratio
      withoutEnlargement: true, // Don't upscale small images
    })
    .webp({
      quality: config.quality,
      effort: 4, // Compression effort (0-6)
      smartSubsample: true, // Better chroma subsampling
    })
    .toBuffer();
}
```

#### Image Type-Specific Settings

| Image Type           | Max Width | Quality | Notes                         |
| -------------------- | --------- | ------- | ----------------------------- |
| Preview Image (main) | 2400px    | 82      | Hero/header images            |
| Gallery Images       | 1920px    | 80      | Product gallery carousel      |
| Content Images (PT)  | 1600px    | 80      | Images within details content |

#### Filename Transformation

```typescript
// Original: produkty/dcs/vivaldi-dac-main.jpg
// Optimized: produkty/dcs/vivaldi-dac-main.webp

function getOptimizedFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  return originalFilename.replace(ext, ".webp");
}
```

### 9.3 SSL Bypass

The legacy server has SSL certificate issues. Use:

```typescript
import * as https from "node:https";

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});
```

### 9.4 Image Processing Function

Complete image download → optimize → upload pipeline:

```typescript
import sharp from "sharp";
import * as https from "node:https";

async function processAndUploadImage(
  sourceUrl: string,
  sanityClient: SanityClient,
  options: { maxWidth?: number; quality?: number } = {},
): Promise<SanityImageAsset | null> {
  const { maxWidth = 2400, quality = 82 } = options;

  try {
    // 1. Download image (with SSL bypass)
    const response = await fetch(sourceUrl, {
      agent: new https.Agent({ rejectUnauthorized: false }),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch image: ${sourceUrl}`);
      return null;
    }

    const originalBuffer = Buffer.from(await response.arrayBuffer());

    // 2. Optimize image
    const optimizedBuffer = await sharp(originalBuffer)
      .resize({
        width: maxWidth,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, smartSubsample: true })
      .toBuffer();

    // 3. Get optimized filename
    const originalFilename =
      new URL(sourceUrl).pathname.split("/").pop() || "image";
    const optimizedFilename = originalFilename.replace(
      /\.(jpe?g|png|gif)$/i,
      ".webp",
    );

    // 4. Upload to Sanity
    const asset = await sanityClient.assets.upload("image", optimizedBuffer, {
      filename: optimizedFilename,
      contentType: "image/webp",
    });

    // Log size reduction
    const reduction = (
      (1 - optimizedBuffer.length / originalBuffer.length) *
      100
    ).toFixed(1);
    console.log(
      `✓ ${optimizedFilename}: ${formatBytes(originalBuffer.length)} → ${formatBytes(optimizedBuffer.length)} (-${reduction}%)`,
    );

    return asset;
  } catch (error) {
    console.error(`Error processing image ${sourceUrl}:`, error);
    return null;
  }
}
```

### 9.5 Image Caching

Cache uploaded images to avoid duplicates and re-processing:

```typescript
// In-memory cache during migration run
const imageCache = new Map<string, string>(); // sourceUrl → Sanity asset ID

// Persistent cache file for resumable migrations
interface ImageCacheFile {
  [sourceUrl: string]: {
    assetId: string;
    originalSize: number;
    optimizedSize: number;
    uploadedAt: string;
  };
}

// Cache file location
const CACHE_FILE = "apps/studio/scripts/migration/products/image-cache.json";
```

### 9.6 Expected Optimization Results

Based on typical product images:

| Metric                          | Before (Legacy) | After (Optimized) |
| ------------------------------- | --------------- | ----------------- |
| Average main image              | ~800KB          | ~200KB            |
| Average gallery image           | ~600KB          | ~150KB            |
| Total image data (~4000 images) | ~2.5GB          | ~600MB            |
| **Estimated reduction**         | -               | **~75%**          |

### 9.7 Dependencies

Add Sharp to the studio package:

```bash
cd apps/studio
bun add sharp
bun add -D @types/sharp
```

### 9.8 Fallback Strategy

If image optimization fails for a specific image:

1. **Log the error** with source URL
2. **Upload original** without optimization
3. **Mark for manual review** in migration report

```typescript
async function processImageWithFallback(
  sourceUrl: string,
  client: SanityClient,
): Promise<SanityImageAsset | null> {
  try {
    // Try optimized upload
    return await processAndUploadImage(sourceUrl, client);
  } catch (optimizationError) {
    console.warn(`Optimization failed for ${sourceUrl}, uploading original...`);

    try {
      // Fallback: upload original
      const response = await fetch(sourceUrl, {
        agent: new https.Agent({ rejectUnauthorized: false }),
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      return await client.assets.upload("image", buffer, {
        filename: sourceUrl.split("/").pop(),
      });
    } catch (uploadError) {
      console.error(`Failed to upload image ${sourceUrl}:`, uploadError);
      return null;
    }
  }
}
```

---

## 10. Validation Queries

### Post-Migration Checks (Sanity GROQ)

```groq
// Count all products
count(*[_type == "product"])

// Products by brand
*[_type == "product"] | group(brand->name) | {brand: brand->name, count: count(*)}

// Products with missing brand
*[_type == "product" && !defined(brand)]

// Products with no categories
*[_type == "product" && count(categories) == 0]

// Products with no image
*[_type == "product" && !defined(previewImage)]

// Products with no details content
*[_type == "product" && !defined(details.content)]

// Archived products
*[_type == "product" && isArchived == true]
```

---

## 11. Expected Results

| Metric                   | Expected                          |
| ------------------------ | --------------------------------- |
| Total products           | ~190-200                          |
| Products with images     | 100%                              |
| Products with brand      | 100%                              |
| Products with categories | 100%                              |
| Products with details    | 100%                              |
| Products with reviews    | Variable (depends on legacy data) |
| Archived products        | ~10-20%                           |

---

## 12. Rollback Strategy

### Document ID Pattern

All products use predictable IDs: `product-{legacy-id}`

### Rollback Command

```bash
bun run apps/studio/scripts/migration/products/migrate-products.ts --rollback
```

### GROQ Rollback Query

```groq
// Delete all migrated products
*[_type == "product" && _id match "product-*"] | delete
```

---

## 13. CSV Export Checklist

Before running migration, export these CSVs from phpMyAdmin:

### Required CSVs

- [ ] `products-main.csv` - Main product data (~200 rows)
- [ ] `products-categories.csv` - Product-category relationships
- [ ] `products-content-boxes.csv` - Content boxes (~1000+ rows)
- [ ] `products-gallery-images.csv` - Gallery images
- [ ] `products-technical-data.csv` - Technical specifications
- [ ] `products-reviews.csv` - Product-review relationships (also used for `[recenzja id=X]` resolution)

### Link Resolution CSVs

- [ ] `product-brand-slug-map.csv` - Maps ProductID → BrandSlug/ProductSlug (for `[product_link,id=X]`)
- [ ] `sitetree-map.csv` - Maps SiteTreeID → URLSegment (for `[sitetree_link,id=X]`)

### SQL for product-brand-slug-map.csv

```sql
SELECT
  p.ID as ProductID,
  st_brand.URLSegment as BrandSlug,
  p.URLSegment as ProductSlug
FROM Product p
JOIN SiteTree st_brand ON p.ProducerPageID = st_brand.ID
WHERE p.publish = 1 OR p.archived = 1
ORDER BY p.ID;
```

### SQL for sitetree-map.csv

```sql
SELECT
  ID as SiteTreeID,
  URLSegment,
  ClassName
FROM SiteTree
WHERE ClassName IN ('Page', 'ProductPage', 'ReviewPage', 'ArticlePage', 'ProducerPage')
ORDER BY ID;
```

---

## 14. Dependencies Check

Before migration, verify these entities exist in Sanity:

- [ ] All brands migrated (check `*[_type == "brand"]`)
- [ ] All categories migrated (check `*[_type == "productCategorySub"]`)
- [ ] All reviews migrated (check `*[_type == "review"]`)

### Brand Slug Matching

Ensure legacy brand slugs match Sanity slugs. Known mismatches that were fixed:

| Legacy Slug     | Sanity Slug      | Action            |
| --------------- | ---------------- | ----------------- |
| `audioresearch` | `audio-research` | Updated in Sanity |
| `avm`           | `avm-audio`      | Updated in Sanity |
| `sonusfaber`    | `sonus-faber`    | Updated in Sanity |
| `wilsonaudio`   | `wilson-audio`   | Updated in Sanity |

---

## 15. Success Criteria

### Quantitative

- [ ] 100% of published products migrated
- [ ] 100% of products have brand reference
- [ ] 100% of products have at least one category
- [ ] 100% of products have preview image
- [ ] 100% of products have details content
- [ ] <1% broken references

### Qualitative

- [ ] Product pages render correctly on frontend
- [ ] Images display properly (including 2x upscaled)
- [ ] Inline images float correctly with text wrap
- [ ] Technical data tables render correctly (with line breaks)
- [ ] Category filtering works
- [ ] Brand pages show all products
- [ ] All review types linked correctly (page, PDF, external)

---

**Document Version**: 2.1  
**Created**: 2025-12-01  
**Updated**: 2025-12-02  
**Status**: Ready for Migration

### Version 2.1 Changes (2025-12-02)

- Added `ptInlineImage` component for floating inline images with text wrap
- Added `width` field to inline images for fixed sizing from legacy shortcode
- Enhanced review resolution to handle all types (page, PDF, external) using ID pattern fallback
- Added 2x image upscaling for small images (< 1400px width)
- Disabled upscaling for inline images (intentionally small)
- Added line break preservation in technical data table cells
- Enhanced table header parsing for grouped variants (e.g., "Atmosphere SX Alive")
- Added group title extraction from first cell of first row
- Fixed first letter edge case (big letter styling merged with strong)
- Fixed images in headings edge case (skip heading if only image)
- Removed `relatedProducts` from migration (left for manual curation)
- Added `ptHorizontalLine` for horizontal lines within text blocks
- Fixed bold/italic/line break preservation in HTML parsing

### Version 2.0 Changes (2025-12-01)

- Updated `details.content` from raw Portable Text to **array of content blocks** (matching brand schema)
- Added `ptReviewEmbed` component for inline review embeds (`[recenzja id=X]` shortcode)
- Updated link resolution to preserve **original legacy URLs** (for future redirects)
- Added `product-brand-slug-map.csv` and `sitetree-map.csv` for link resolution
- Fixed category reference resolution to use `productCategorySub` schema type
- Added image extraction from nested `<p>` tags
- Tested migration with product ID 315 (Reference 80S)
