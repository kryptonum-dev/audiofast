# Award Migration Plan

## Overview

This document outlines the strategy for migrating awards from the legacy **SilverStripe CMS** MySQL database to the new **Sanity CMS** platform. The migration involves transferring award data, logo images, and product relationships.

---

## 1. Source System Analysis

### 1.1 Database Tables

| Table       | Purpose                     | Key Fields                           |
| ----------- | --------------------------- | ------------------------------------ |
| `Awards`    | Main award data             | `ID`, `Name`, `LogoID`, `Name_pl_PL` |
| `BoxAwards` | Award-Product relationships | `AwardsID`, `ProductID`              |
| `File`      | Logo image files            | `ID`, `FileFilename`                 |

### 1.2 Awards Table Structure

```sql
CREATE TABLE `Awards` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(200),              -- Award name (English/default)
  `LogoID` int(11),                 -- Reference to File table
  `Name_pl_PL` varchar(200),        -- Polish name (used as primary)
  `Name_en_US` varchar(200)         -- English name
);
```

### 1.3 BoxAwards Table Structure (Junction Table)

```sql
CREATE TABLE `BoxAwards` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `AwardsID` int(11),               -- Reference to Awards table
  `ProductID` int(11),              -- Reference to Product table
  `Sort` int(11)                    -- Order (not used in migration)
);
```

### 1.4 Data Statistics (from CSV)

| Metric                        | Count             |
| ----------------------------- | ----------------- |
| Total Awards                  | **314**           |
| Award IDs Range               | 1-339 (with gaps) |
| Total Award-Product Relations | **1,922**         |
| Unique Products with Awards   | ~350+             |
| Awards with Logos             | 314 (100%)        |

### 1.5 Logo File Formats

| Format | Count | Notes                                   |
| ------ | ----- | --------------------------------------- |
| PNG    | ~290  | Primary format                          |
| JPG    | ~15   | Will convert to WebP                    |
| GIF    | ~5    | Animated not supported, convert to WebP |

---

## 2. Target System (Sanity CMS)

### 2.1 Award Schema

```typescript
// apps/studio/schemaTypes/documents/collections/award.ts
{
  name: 'award',
  title: 'Nagroda',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Nazwa nagrody',
      type: 'string',
      validation: Rule.required()
    },
    {
      name: 'logo',
      title: 'Logo nagrody',
      type: 'image'
      // Accepts any image format: PNG, JPG, SVG, WebP
    },
    {
      name: 'products',
      title: 'Produkty z tą nagrodą',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }]
    }
  ]
}
```

### 2.2 Field Mapping

| #   | Sanity Field | Type             | Source                          | Transformation                 |
| --- | ------------ | ---------------- | ------------------------------- | ------------------------------ |
| 1   | `name`       | string           | `AwardName` (from CSV)          | Direct copy, trim whitespace   |
| 2   | `logo`       | image            | `LogoFilename` → File upload    | Convert to WebP, upload to CDN |
| 3   | `products`   | array[reference] | `awards-products-relations.csv` | Map ProductID → `product-{id}` |

### 2.3 Document ID Pattern

```
award-{legacy-id}
```

Examples:

- Legacy ID `1` → Sanity ID `award-1`
- Legacy ID `339` → Sanity ID `award-339`

---

## 3. CSV Files

### 3.1 awards-all.csv (314 rows)

| Column         | Description                   | Example                                   |
| -------------- | ----------------------------- | ----------------------------------------- |
| `AwardID`      | Legacy award ID               | `1`                                       |
| `AwardName`    | Award name (Polish preferred) | `The Absolute Sound Editors' Choice 2016` |
| `LogoID`       | File ID for logo              | `119`                                     |
| `LogoFilename` | Path to logo file             | `awards/TAS-EDS-CHOICE-2016.png`          |

### 3.2 awards-products-relations.csv (1,922 rows)

| Column      | Description       | Example |
| ----------- | ----------------- | ------- |
| `AwardID`   | Legacy award ID   | `1`     |
| `ProductID` | Legacy product ID | `38`    |

---

## 4. Migration Strategy

### 4.1 Prerequisites

Before running the award migration:

- [ ] All products must be migrated to Sanity (pattern: `product-{legacyId}`)
- [ ] Product migration verified and complete
- [ ] Legacy image server accessible (`https://audiofast.pl/assets/`)

### 4.2 Migration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Load Data                                              │
│  • Parse awards-all.csv                                          │
│  • Parse awards-products-relations.csv                           │
│  • Build award → products mapping                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Verify Product References                              │
│  • Query existing products in Sanity                             │
│  • Build list of valid product IDs                               │
│  • Log warnings for missing product references                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Process Awards                                         │
│  For each award:                                                 │
│  • Download logo from legacy server                              │
│  • Convert to WebP (no upscaling)                                │
│  • Upload to Sanity CDN                                          │
│  • Build product references array                                │
│  • Create award document                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Validation                                             │
│  • Verify award count matches                                    │
│  • Check for missing logos                                       │
│  • Validate product references                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Product Reference Resolution

Products are referenced using the pattern `product-{legacyId}`:

```typescript
// For ProductID = 38
const productRef = {
  _type: "reference",
  _ref: "product-38",
  _key: "product-38", // Unique key for array item
};
```

**Important:** Only include product references that exist in Sanity. Log warnings for missing products but continue migration.

---

## 5. Image Processing

### 5.1 Logo Source

```
Base URL: https://audiofast.pl/assets/
Example: https://audiofast.pl/assets/awards/TAS-EDS-CHOICE-2016.png
```

### 5.2 Image Optimization

| Setting       | Value  | Notes                           |
| ------------- | ------ | ------------------------------- |
| Output Format | WebP   | Smaller file size, good quality |
| Quality       | 85%    | Higher quality for logos        |
| Max Width     | 800px  | Logos don't need to be large    |
| Max Height    | 800px  | Maintain aspect ratio           |
| Upscaling     | **NO** | Don't upscale small logos       |

### 5.3 Processing Pipeline

```typescript
async function processLogo(logoFilename: string): Promise<SanityImageAsset> {
  const sourceUrl = `https://audiofast.pl/assets/${logoFilename}`;

  // 1. Download image (with SSL bypass)
  const response = await fetch(sourceUrl, {
    agent: new https.Agent({ rejectUnauthorized: false }),
  });
  const originalBuffer = Buffer.from(await response.arrayBuffer());

  // 2. Convert to WebP (no upscaling)
  const optimizedBuffer = await sharp(originalBuffer)
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true, // No upscaling
    })
    .webp({ quality: 85 })
    .toBuffer();

  // 3. Upload to Sanity
  const filename = logoFilename.replace(/\.[^.]+$/, ".webp");
  return await sanityClient.assets.upload("image", optimizedBuffer, {
    filename,
    contentType: "image/webp",
  });
}
```

### 5.4 GIF Handling

Some logos are animated GIFs (e.g., `golden_ear.gif`). Sharp will convert the first frame to WebP. This is acceptable for award logos.

---

## 6. Migration Script Architecture

```
apps/studio/scripts/migration/awards/
├── migrate-awards.ts             # Main migration script
├── types.ts                      # TypeScript interfaces
├── parser/
│   └── csv-parser.ts             # CSV parsing utilities
├── utils/
│   ├── image-processor.ts        # Logo optimization
│   └── product-resolver.ts       # Product reference lookup
├── image-cache.json              # Cached logo uploads (auto-generated)
└── README.md                     # Usage documentation
```

### 6.1 Type Definitions

```typescript
// types.ts
interface LegacyAward {
  awardId: number;
  awardName: string;
  logoId: number;
  logoFilename: string;
}

interface AwardProductRelation {
  awardId: number;
  productId: number;
}

interface SanityAward {
  _id: string;
  _type: "award";
  name: string;
  logo?: {
    _type: "image";
    asset: { _type: "reference"; _ref: string };
  };
  products: Array<{
    _type: "reference";
    _ref: string;
    _key: string;
  }>;
}
```

### 6.2 Dependencies

```json
{
  "dependencies": {
    "sharp": "^0.33.x",
    "csv-parse": "^5.x",
    "@sanity/client": "^6.x"
  }
}
```

---

## 7. Usage Commands

```bash
# Dry run - preview all awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --dry-run

# Dry run with verbose output
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --dry-run --verbose

# Migrate all awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts

# Skip awards that already exist in Sanity
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --skip-existing

# Limit migration (for testing)
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --limit=10

# Rollback - delete all migrated awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --rollback
```

### 7.1 Command Options

| Option            | Description                              |
| ----------------- | ---------------------------------------- |
| `--dry-run`       | Preview changes without saving to Sanity |
| `--verbose`       | Show detailed output for each award      |
| `--skip-existing` | Skip awards that already exist in Sanity |
| `--limit=N`       | Process only first N awards              |
| `--rollback`      | Delete all migrated awards               |

---

## 8. Validation Queries

### 8.1 Post-Migration Checks (GROQ)

```groq
// Count all migrated awards
count(*[_type == "award" && _id match "award-*"])

// Awards without logo
*[_type == "award" && !defined(logo)]{name, _id}

// Awards without products
*[_type == "award" && count(products) == 0]{name, _id}

// Awards with most products
*[_type == "award"] | order(count(products) desc)[0...10]{
  name,
  "productCount": count(products)
}

// Check for broken product references
*[_type == "award" && count(products[!defined(@->)]) > 0]{
  name,
  _id,
  "brokenRefs": count(products[!defined(@->)])
}

// Total product references
{
  "totalAwards": count(*[_type == "award"]),
  "totalProductRefs": count(*[_type == "award"].products[])
}
```

---

## 9. Expected Results

| Metric                     | Expected                       |
| -------------------------- | ------------------------------ |
| Total awards               | 314                            |
| Awards with logos          | 314 (100%)                     |
| Awards with products       | ~290+                          |
| Total product references   | 1,922 (minus missing products) |
| Average products per award | ~6.5                           |

### 9.1 Awards with Most Products (from CSV analysis)

| Award                                | ProductID Count |
| ------------------------------------ | --------------- |
| Award 203 (TAS Editors Choice 2020)  | ~100+           |
| Award 238 (TAS Editor's Choice 2021) | ~80+            |
| Award 139 (TAS Editors Choice 2018)  | ~70+            |
| Award 261 (TAS Editor's Choice 2022) | ~80+            |

---

## 10. Edge Cases & Handling

### 10.1 Missing Products

Some ProductIDs in relationships may not exist in Sanity (not migrated or archived):

```typescript
// Log warning but continue
if (!productExists(productId)) {
  console.warn(`⚠️  Product ${productId} not found for award ${awardId}`);
  continue; // Skip this reference
}
```

### 10.2 Duplicate Award Names

Some awards have similar names (e.g., multiple years of same award). Each has a unique ID, so no deduplication needed.

### 10.3 Special Characters in Names

Award names may contain special characters (apostrophes, quotes):

- `The Absolute Sound Editors' Choice` → Keep as-is
- Trim leading/trailing whitespace

### 10.4 Missing Logo Files

If logo download fails:

1. Log error
2. Create award without logo
3. Add to manual review list

---

## 11. Rollback Strategy

### 11.1 Document ID Pattern

All awards use predictable IDs: `award-{legacy-id}`

### 11.2 Rollback Command

```bash
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --rollback
```

### 11.3 GROQ Rollback Query

```groq
// Delete all migrated awards
*[_type == "award" && _id match "award-*"] | delete
```

---

## 12. Image Caching

### 12.1 Cache File Structure

```json
// image-cache.json
{
  "awards/TAS-EDS-CHOICE-2016.png": {
    "assetId": "image-abc123",
    "originalSize": 45000,
    "optimizedSize": 12000,
    "uploadedAt": "2025-12-02T10:30:00.000Z"
  }
}
```

### 12.2 Cache Benefits

- Avoid re-uploading same images on retry
- Resume migration after interruption
- Track optimization statistics

---

## 13. Migration Checklist

### Pre-Migration

- [ ] Products migrated and verified
- [ ] CSV files in `csv/awards/` folder
- [ ] `SANITY_API_TOKEN` environment variable set
- [ ] Legacy server accessible for image download
- [ ] Sharp dependency installed

### Migration

- [ ] Run dry-run first
- [ ] Review dry-run output
- [ ] Execute live migration
- [ ] Monitor for errors

### Post-Migration

- [ ] Verify award count matches (314)
- [ ] Run validation GROQ queries
- [ ] Check awards with broken references
- [ ] Verify logos display correctly in Studio
- [ ] Test product filtering by award (if applicable)

---

## 14. Success Criteria

### Quantitative

- [ ] 314 awards migrated
- [ ] 100% of awards have logos
- [ ] <5% broken product references
- [ ] All logos converted to WebP

### Qualitative

- [ ] Awards display correctly in Sanity Studio
- [ ] Product pages show associated awards
- [ ] Award logos render properly
- [ ] No duplicate awards created

---

**Document Version**: 1.0  
**Created**: 2025-12-02  
**Status**: Ready for Review

### Dependencies

- Product migration must be complete before running award migration
- Uses same image optimization pipeline as product migration (without upscaling)
