# Audiofast Data Migration Strategy

## Overview

This document outlines the comprehensive strategy for migrating data from the legacy **SilverStripe CMS** MySQL database to the new **Sanity CMS** platform. The migration involves transferring products, brands, categories, articles, reviews, stores, and related content while preserving data integrity and relationships.

---

## 1. Source System Analysis

### 1.1 Database Platform
- **CMS**: SilverStripe CMS (PHP-based)
- **Database**: MySQL (MyISAM/InnoDB mixed)
- **Character Set**: Mixed (latin2, utf8)
- **File**: `20250528_audiofast.sql` (~162 MB)

### 1.2 Key Tables Identified

| Table Group | Tables | Records (approx) | Purpose |
|-------------|--------|------------------|---------|
| **Products** | `Product`, `Product_Localised`, `Product_ProductTypes` | ~190 | Audio equipment catalog |
| **Brands** | `ProducerPage`, `ProducerPage_Localised`, `SiteTree` | ~60 | Brand/manufacturer pages |
| **Categories** | `DeviceType`, `ProductType`, `ProductType_Localised` | ~40 | Product categorization |
| **Articles/Blog** | `ArticlePage`, `ArticlePage_Localised`, `ArticleCategory` | ~300 | News and blog content |
| **Reviews** | `ReviewPage`, `ReviewPage_Localised`, `ReviewProduct` | ~200 | Product reviews |
| **Stores/Dealers** | `Dealer`, `Dealer_ProducerPage` | 49 | Physical store locations |
| **Awards** | `Awards`, `BoxAwards` | ~340 | Product awards/accolades |
| **Content Boxes** | `Box`, `Box_Localised`, `Box_GridImage`, `Tabs` | ~4800 | Product details, galleries, specs |
| **Files/Assets** | `File`, `File_Live` | ~14000 | Images, PDFs, documents |
| **Pages** | `SiteTree`, `SiteTree_Localised` | ~2800 | Page metadata, URLs, content |

### 1.3 Data Characteristics

#### Content Format
- **Rich Text**: HTML stored in `Content` fields
- **Localization**: Polish (`pl_PL`) primary, English (`en_US`) secondary
- **Serialized Data**: PHP `serialize()` format in some fields (e.g., `product_limiter`)

#### Relationships
```
Product
├── → ProducerPage (brand via ProducerPageID)
├── → ProductType (category via ProductTypeID)
├── → File (images via ProductImageID, ProductHeaderImageID)
├── ← Box (details via Box.ProductID)
│   ├── ← Box_GridImage (gallery images)
│   ├── ← Tabs (technical specifications)
│   └── ← BoxAwards (product awards)
└── ← Product_ProductTypes (additional categories, many-to-many)

ProducerPage
├── → SiteTree (page metadata via ID join)
├── → File (logos via LogoID, Logo2ID)
└── ← Dealer_ProducerPage (dealer relationships)

ArticlePage
├── → SiteTree (page metadata via ID join)
├── → File (images via LeadingImageID)
├── → ArticleCategory (via ArticlePage_ArticleCategory junction)
└── → Product (optional link via ProductLinkID)

ReviewPage
├── → SiteTree (page metadata via ID join)
├── → File (cover image via CoverID, PDF via PDFFileID)
└── ← ReviewProduct (product relationships)
```

#### Image Storage
- Images stored as files in `/assets/` directory on legacy server
- Referenced in `File` table via `FileFilename` column
- Paths like: `galeria/product-name.jpg`, `produkty/brand/image.png`

---

## 2. Target System (Sanity CMS)

### 2.1 Document Types

| Sanity Type | Source Tables | Status |
|-------------|---------------|--------|
| `store` | `Dealer` | ✅ **MIGRATED** (49 records) |
| `productCategoryParent` | `DeviceType` | 🔲 Pending |
| `productCategorySub` | `ProductType` + `SiteTree` | 🔲 Pending |
| `brand` | `ProducerPage` + `SiteTree` | 🔲 Pending |
| `product` | `Product` + `Box` + `Tabs` + `SiteTree` | 🔲 Pending |
| `blogCategory` | `ArticleCategory` | 🔲 Pending |
| `blogArticle` | `ArticlePage` + `SiteTree` | 🔲 Pending |
| `reviewAuthor` | Extracted from `ReviewPage.Author` | 🔲 Pending |
| `review` | `ReviewPage` + `SiteTree` | 🔲 Pending |
| `award` | `Awards` | 🔲 Pending |
| `teamMember` | Manual/existing | ⏭️ Skip (manual entry) |
| `faq` | Manual/existing | ⏭️ Skip (manual entry) |

### 2.2 Schema Considerations

#### Portable Text Conversion
All HTML content must be converted to Sanity's Portable Text format:
- `<p>` → `block` with `normal` style
- `<h2>`, `<h3>` → `block` with heading style
- `<strong>`, `<em>` → marks/decorators
- `<a href>` → `customLink` annotation
- `<ul>`, `<ol>` → list blocks
- `<img>` → `ptImage` or `ptMinimalImage` components
- `<table>` → Custom handling or `ptTwoColumnTable`

#### Reference Resolution
- Old IDs must be mapped to new Sanity UUIDs
- References created after dependent documents exist
- Cross-references (e.g., related products) applied in final pass

---

## 3. Migration Order (Dependency Graph)

Migration must follow dependency order to ensure references can be resolved:

```
Phase 1: Independent Entities (No Dependencies)
┌─────────────────────────────────────────────────────┐
│  ✅ store (Dealer)                    - COMPLETED   │
│  🔲 productCategoryParent (DeviceType)              │
│  🔲 blogCategory (ArticleCategory)                  │
│  🔲 reviewAuthor (extracted from ReviewPage)        │
│  🔲 award (Awards)                                  │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
Phase 2: Single-Reference Entities
┌─────────────────────────────────────────────────────┐
│  🔲 productCategorySub (→ productCategoryParent)    │
│  🔲 brand (→ images)                                │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
Phase 3: Multi-Reference Entities
┌─────────────────────────────────────────────────────┐
│  🔲 product (→ brand, categories, stores, images)   │
│  🔲 review (→ reviewAuthor, images)                 │
│  🔲 blogArticle (→ blogCategory, teamMember, images)│
└─────────────────────────────────────────────────────┘
                          │
                          ▼
Phase 4: Cross-References (Updates)
┌─────────────────────────────────────────────────────┐
│  🔲 product.reviews (→ review[])                    │
│  🔲 product.relatedProducts (→ product[])           │
│  🔲 brand.featuredReviews (→ review[])              │
└─────────────────────────────────────────────────────┘
```

---

## 4. Entity Migration Details

### 4.1 Product Category Parent (DeviceType)

**Source**: `DeviceType` table
**Target**: `productCategoryParent`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ID` | `_id` | Generate UUID |
| `Title` | `name` | Direct copy |

**Sample Data**:
```
ID=1: "Źródła cyfrowe i analogowe"
ID=2: "Zasilanie i uziemianie"
ID=3: "Głośniki i subwoofery"
ID=4: "Wzmacniacze i przedwzmacniacze"
ID=5: "Przewody audio"
ID=6: "Akcesoria"
```

**Estimated Records**: ~6-12

---

### 4.2 Product Category Sub (ProductType)

**Source**: `ProductType` + `SiteTree` + `ProductType_Localised`
**Target**: `productCategorySub`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ProductType.ID` | `_id` | Generate UUID |
| `SiteTree.Title` | `name` | Direct copy |
| `SiteTree.URLSegment` | `slug` | Add `/kategoria/` prefix |
| `ProductType.TypeDescription` | `description` | HTML → Portable Text |
| `DeviceType_ProductType` | `parentCategory` | Reference via mapping |

**Complexity**: Medium (requires SiteTree join, HTML conversion)
**Estimated Records**: ~35

---

### 4.3 Brand (ProducerPage)

**Source**: `ProducerPage` + `SiteTree` + `ProducerPage_Localised` + `File`
**Target**: `brand`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ProducerPage.ID` | `_id` | Generate UUID |
| `SiteTree.Title` | `name` | Direct copy |
| `SiteTree.URLSegment` | `slug` | Add `/marki/` prefix |
| `ProducerPage.motto` | `description` | HTML → Portable Text |
| `ProducerPage.ProducerDescription` | `brandDescription` | HTML → Portable Text |
| `ProducerPage.LogoID` | `logo` | Upload asset, create reference |
| `File` via `LogoID` | `logo` | Fetch from legacy server |
| `ProducerGridImage` | `imageGallery` | Upload assets |

**Complexity**: High (multiple joins, image uploads, HTML conversion)
**Estimated Records**: ~55

---

### 4.4 Product

**Source**: `Product` + `Box` + `Tabs` + `Box_GridImage` + `SiteTree` + `File`
**Target**: `product`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `Product.ID` | `_id` | Generate UUID |
| `Product.name` | `name` | Direct copy |
| `Product.producttitle_desc` | `subtitle` | Direct copy |
| `Product.URLSegment` | `slug` | Add `/produkty/` prefix |
| `Product.ProductImageID` | `previewImage` | Upload asset |
| `Product.ProducerPageID` | `brand` | Reference via mapping |
| `Product.ProductTypeID` | `categories[0]` | Reference via mapping |
| `Product_ProductTypes` | `categories[]` | Additional category refs |
| `Product.archived` | `isArchived` | Boolean conversion |
| `Box.Content` | `details.content` | HTML → Portable Text |
| `Box_GridImage` → `File` | `imageGallery` | Upload assets |
| `Tabs.Content` | `technicalData` | HTML table → structured data |
| `Dealer_ProducerPage` | `availableInStores` | Reference via mapping |
| `BoxAwards` | (separate award refs) | Reference via mapping |
| `SiteTree.MetaDescription` | `seo.metaDescription` | Direct copy |

**Complexity**: Very High (multiple joins, image uploads, HTML conversion, technical specs parsing)
**Estimated Records**: ~190

---

### 4.5 Blog Category (ArticleCategory)

**Source**: `ArticleCategory` + `ArticleCategory_Localised`
**Target**: `blogCategory`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ID` | `_id` | Generate UUID |
| `Name` | `name` | Direct copy |

**Complexity**: Low
**Estimated Records**: ~10-15

---

### 4.6 Blog Article (ArticlePage)

**Source**: `ArticlePage` + `SiteTree` + `ArticlePage_Localised` + `File`
**Target**: `blogArticle`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ArticlePage.ID` | `_id` | Generate UUID |
| `SiteTree.Title` | `title` | HTML → Portable Text |
| `SiteTree.URLSegment` | `slug` | Add `/blog/` prefix |
| `ArticlePage.ArticleDate` | `publishedDate` | Date conversion |
| `ArticlePage.LeadingText` | `description` | HTML → Portable Text |
| `ArticlePage.LeadingImageID` | `image` | Upload asset |
| `SiteTree.Content` | `content` | HTML → Portable Text |
| `ArticlePage_ArticleCategory` | `category` | Reference via mapping |

**Complexity**: High (HTML conversion, image uploads)
**Estimated Records**: ~250-300

---

### 4.7 Review Author

**Source**: Extracted from `ReviewPage.Author` field
**Target**: `reviewAuthor`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| Unique `Author` values | `name` | Deduplicate and create |

**Process**:
1. Extract all unique `Author` values from `ReviewPage`
2. Create `reviewAuthor` documents for each unique name
3. Build mapping for review migration

**Complexity**: Low (extraction and deduplication)
**Estimated Records**: ~30-50 unique authors

---

### 4.8 Review (ReviewPage)

**Source**: `ReviewPage` + `SiteTree` + `ReviewPage_Localised` + `File`
**Target**: `review`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `ReviewPage.ID` | `_id` | Generate UUID |
| `SiteTree.Title` | `title` | HTML → Portable Text |
| `SiteTree.URLSegment` | `slug` | Add `/recenzje/` prefix |
| `ReviewPage.Author` | `author` | Reference to reviewAuthor |
| `ReviewPage.LeadingText` | `content` | HTML → Portable Text |
| `ReviewPage.CoverID` | `image` | Upload asset |
| `ReviewPage.PDFFileID` | `pdfFile` | Upload asset |
| `ReviewPage.ExternalLink` | `externalUrl` | Direct copy |
| `ReviewPage.ArticleDate` | (implicit) | For ordering |

**Destination Type Logic**:
- If `PDFFileID` present → `destinationType: 'pdf'`
- If `ExternalLink` present → `destinationType: 'external'`
- Otherwise → `destinationType: 'page'`

**Complexity**: High (multiple destination types, image/PDF uploads)
**Estimated Records**: ~150-200

---

### 4.9 Award

**Source**: `Awards` + `Awards_Localised` + `File`
**Target**: `award`

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `Awards.ID` | `_id` | Generate UUID |
| `Awards.Name` | `name` | Direct copy |
| `Awards.LogoID` | `logo` | Upload asset |

**Complexity**: Low (simple structure, single image)
**Estimated Records**: ~340

---

## 5. Technical Implementation

### 5.1 Migration Script Architecture

```
apps/studio/scripts/migration/
├── index.ts                    # Main orchestrator
├── utils/
│   ├── sanity-client.ts        # Sanity client setup
│   ├── sql-parser.ts           # Generic SQL parsing
│   ├── html-to-portable-text.ts # HTML → PT conversion
│   ├── asset-uploader.ts       # Image/file upload handler
│   ├── id-mapping.ts           # Old ID → New UUID mapping
│   └── logger.ts               # Migration logging
├── stores/                     # ✅ COMPLETED
│   ├── migrate-stores.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
├── categories/
│   ├── migrate-categories.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
├── brands/
│   ├── migrate-brands.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
├── products/
│   ├── migrate-products.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
├── articles/
│   ├── migrate-articles.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
├── reviews/
│   ├── migrate-reviews.ts
│   ├── migrate-authors.ts
│   ├── parser.ts
│   ├── transformer.ts
│   └── types.ts
└── awards/
    ├── migrate-awards.ts
    ├── parser.ts
    ├── transformer.ts
    └── types.ts
```

### 5.2 Shared Utilities

#### HTML to Portable Text Converter
```typescript
// html-to-portable-text.ts
import { htmlToBlocks } from '@sanity/block-tools';
import { Schema } from '@sanity/schema';

export function convertHtmlToPortableText(html: string, schemaType: string): PortableTextBlock[] {
  // Handle common SilverStripe HTML patterns
  // - [sitetree_link,id=XX] shortcodes
  // - Inline styles
  // - Legacy class names
  // - Table structures
}
```

#### Asset Uploader
```typescript
// asset-uploader.ts
export async function uploadImageFromUrl(
  client: SanityClient,
  imageUrl: string,
  filename: string
): Promise<SanityImageAsset> {
  // 1. Fetch image from legacy server
  // 2. Upload to Sanity CDN
  // 3. Return asset reference
}
```

#### ID Mapping Store
```typescript
// id-mapping.ts
export class IdMappingStore {
  private mappings: Map<string, Map<number, string>> = new Map();
  
  set(entityType: string, oldId: number, newId: string): void;
  get(entityType: string, oldId: number): string | undefined;
  save(filePath: string): void;  // Persist for multi-run migrations
  load(filePath: string): void;
}
```

### 5.3 Environment Configuration

```bash
# .env.migration (do not commit)
SANITY_PROJECT_ID=fsw3likv
SANITY_DATASET=production
SANITY_API_TOKEN=sk...

# Legacy server access (for images)
LEGACY_ASSETS_BASE_URL=https://old-audiofast.pl/assets/
# OR local path if assets downloaded
LEGACY_ASSETS_LOCAL_PATH=/path/to/downloaded/assets/
```

### 5.4 Command Interface

```bash
# Individual entity migrations
bun run migrate:categories --dry-run
bun run migrate:brands --dry-run
bun run migrate:products --dry-run
bun run migrate:articles --dry-run
bun run migrate:reviews --dry-run
bun run migrate:awards --dry-run

# Full migration (respects dependency order)
bun run migrate:all --dry-run

# With options
bun run migrate:products --limit=10 --verbose
bun run migrate:products --skip-images  # For testing without asset uploads

# Rollback
bun run migrate:products --rollback
bun run migrate:all --rollback
```

---

## 6. Image/Asset Migration Strategy

### 6.1 Asset Source Options

**Option A: Direct URL Fetch (Recommended if server accessible)**
```
https://audiofast.pl/assets/galeria/product-image.jpg
       ↓
Fetch via HTTP
       ↓
Upload to Sanity CDN
       ↓
Store asset reference
```

**Option B: Local Assets (If downloaded beforehand)**
```
/local/assets/galeria/product-image.jpg
       ↓
Read from filesystem
       ↓
Upload to Sanity CDN
       ↓
Store asset reference
```

### 6.2 Asset Mapping

```typescript
interface AssetMapping {
  oldFileId: number;
  oldPath: string;
  sanityAssetId: string;
  sanityAssetUrl: string;
}

// Store mapping for reuse across entities
const assetMap = new Map<number, AssetMapping>();
```

### 6.3 Image Migration Order

1. **Pre-migration**: Optionally download all assets locally
2. **During entity migration**: Upload as needed, cache asset IDs
3. **Deduplication**: Same file ID → reuse existing Sanity asset

---

## 7. Validation Strategy

### 7.1 Pre-Migration Validation

- [ ] SQL file integrity check
- [ ] Required tables exist
- [ ] Character encoding verification
- [ ] Sample data extraction test

### 7.2 During Migration

- [ ] Field validation against Sanity schema
- [ ] Required field presence
- [ ] Reference integrity (target document exists)
- [ ] Image upload success verification

### 7.3 Post-Migration Validation

```typescript
interface MigrationValidation {
  // Count verification
  sourceCount: number;
  targetCount: number;
  countMatch: boolean;
  
  // Sample verification
  sampleIds: string[];
  sampleValidation: ValidationResult[];
  
  // Reference integrity
  brokenReferences: BrokenReference[];
  
  // Asset verification
  missingAssets: MissingAsset[];
}
```

### 7.4 Validation Queries (Sanity)

```groq
// Count all products
count(*[_type == "product"])

// Find products with missing brand reference
*[_type == "product" && !defined(brand)]

// Find products with no images
*[_type == "product" && count(imageGallery) == 0]

// Find broken category references
*[_type == "product" && count(categories[!defined(@->)]) > 0]
```

---

## 8. Rollback Strategy

### 8.1 Document ID Pattern

All migrated documents use predictable ID patterns for easy rollback:

| Entity | ID Pattern | Example |
|--------|------------|---------|
| Store | UUID (deterministic from dealer ID) | `e4bb9175-adb8-00b1-1070-64510e0b3cb1` |
| Category Parent | `cat-parent-{oldId}` | `cat-parent-1` |
| Category Sub | `cat-sub-{oldId}` | `cat-sub-26` |
| Brand | `brand-{oldId}` | `brand-46` |
| Product | `product-{oldId}` | `product-826` |
| Article | `article-{oldId}` | `article-17` |
| Review | `review-{oldId}` | `review-77` |
| Award | `award-{oldId}` | `award-1` |

### 8.2 Rollback Commands

```bash
# Rollback specific entity type
bun run migrate:products --rollback

# Rollback with pattern matching
// In Sanity: Delete all documents matching pattern
*[_id match "product-*"] → delete
```

### 8.3 Rollback Script

```typescript
async function rollback(entityType: string, idPattern: string): Promise<void> {
  const query = `*[_type == "${entityType}" && _id match "${idPattern}"]._id`;
  const ids = await client.fetch(query);
  
  // Batch delete
  const transaction = client.transaction();
  ids.forEach(id => transaction.delete(id));
  await transaction.commit();
}
```

---

## 9. Migration Timeline

### Phase 1: Foundation (Week 1) ✅ COMPLETED
- [x] Migration strategy document
- [x] Store schema updates
- [x] Store migration script
- [x] Store migration execution (49 records)
- [x] Validation

### Phase 2: Categories & Brands (Week 2)
- [ ] Category parent migration (~6 records)
- [ ] Category sub migration (~35 records)
- [ ] Brand migration (~55 records)
- [ ] Image upload pipeline testing

### Phase 3: Products (Week 3-4)
- [ ] Product migration script development
- [ ] HTML → Portable Text converter
- [ ] Technical specs parser
- [ ] Gallery image migration
- [ ] Product migration execution (~190 records)
- [ ] Cross-reference updates (related products)

### Phase 4: Content (Week 5)
- [ ] Blog category migration
- [ ] Blog article migration (~300 records)
- [ ] Review author extraction
- [ ] Review migration (~200 records)
- [ ] Award migration (~340 records)

### Phase 5: Validation & Cleanup (Week 6)
- [ ] Full validation pass
- [ ] Broken reference fixes
- [ ] Missing asset resolution
- [ ] URL redirect mapping
- [ ] Documentation update

---

## 10. Risk Assessment

### High Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Image server inaccessible | Cannot migrate product images | Download assets beforehand |
| HTML conversion failures | Broken content formatting | Manual review queue |
| Character encoding issues | Corrupted Polish characters | UTF-8 normalization |

### Medium Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing references | Broken links in Sanity | Validation queries, null checks |
| Duplicate content | Redundant documents | Idempotent migrations with `createOrReplace` |
| Rate limiting | Slow migration | Batch operations, delays |

### Low Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema changes mid-migration | Script updates needed | Version lock schema |
| Partial migration failure | Incomplete data | Transaction batching, resume capability |

---

## 11. Success Criteria

### Quantitative
- [ ] 100% of published products migrated
- [ ] 100% of brands migrated
- [ ] 100% of published articles migrated
- [ ] 100% of reviews migrated
- [ ] <1% broken references
- [ ] <5% content formatting issues

### Qualitative
- [ ] Product pages render correctly on new site
- [ ] Brand pages show all products
- [ ] Blog articles display with proper formatting
- [ ] Review links function correctly
- [ ] Search indexes properly

---

## 12. Post-Migration Tasks

### Immediate
- [ ] Update DNS/routing to new site
- [ ] Set up URL redirects from old URLs
- [ ] Disable old CMS write access
- [ ] Monitor error logs

### Short-term (1-2 weeks)
- [ ] Manual content review
- [ ] Fix formatting issues
- [ ] Add missing images manually
- [ ] Update internal links

### Long-term
- [ ] Decommission old server
- [ ] Archive SQL backup
- [ ] Document lessons learned
- [ ] Remove migration scripts from production

---

## Appendix A: SQL Table Reference

### Core Content Tables
```sql
-- Products
Product, Product_Localised, Product_ProductTypes, Product_Attachment

-- Brands
ProducerPage, ProducerPage_Localised, ProducerPage_ProducerGridImage

-- Categories  
DeviceType, DeviceTypeItem, DeviceType_ProductType
ProductType, ProductType_Localised

-- Articles
ArticlePage, ArticlePage_Localised, ArticlePage_ArticleCategory
ArticleCategory, ArticleCategory_Localised

-- Reviews
ReviewPage, ReviewPage_Localised, ReviewPage_ProducerPage, ReviewProduct

-- Stores
Dealer, Dealer_ProducerPage

-- Awards
Awards, Awards_Localised, BoxAwards

-- Content Details
Box, Box_Localised, Box_GridImage, BoxReviews
Tabs, Tabs_Localised
```

### Supporting Tables
```sql
-- Assets
File, File_Live, FileLink

-- Pages
SiteTree, SiteTree_Localised, SiteTree_Live

-- Relationships
SimilarProduct (related products)
TechnicalProduct (technical specs links)
```

---

## Appendix B: ID Mapping File Format

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-25T06:57:24.633Z",
  "mappings": {
    "store": {
      "1": "e4bb9175-adb8-00b1-1070-64510e0b3cb1",
      "2": "43f8bc61-34a5-4fc6-0bb1-4823fc90fc62"
    },
    "brand": {
      "46": "brand-46-uuid-here",
      "47": "brand-47-uuid-here"
    },
    "product": {
      "826": "product-826-uuid-here"
    }
  }
}
```

---

## Appendix C: Environment Setup

```bash
# 1. Install dependencies
cd apps/studio
bun install

# 2. Set environment variables
export SANITY_PROJECT_ID=fsw3likv
export SANITY_DATASET=production
export SANITY_API_TOKEN=sk...

# 3. Verify connection
bun run apps/studio/scripts/migration/verify-connection.ts

# 4. Run dry-run
bun run migrate:all --dry-run

# 5. Execute migration
bun run migrate:all
```

---

**Document Version**: 1.0  
**Created**: 2025-11-25  
**Last Updated**: 2025-11-25  
**Author**: Migration Team  
**Status**: In Progress - Phase 1 Complete

