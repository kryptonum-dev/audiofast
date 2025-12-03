# Award Migration Scripts

Migrates awards from legacy SilverStripe database to Sanity CMS.

## Prerequisites

1. **CSV Files Required** (in `csv/awards/`):

   - `awards-all.csv` - Main award data (ID, name, logo filename)
   - `awards-products-relations.csv` - Award-product relationships

2. **Environment Variables**:

   ```bash
   export SANITY_PROJECT_ID="fsw3likv"
   export SANITY_DATASET="production"
   export SANITY_API_TOKEN="your-token-here"
   ```

3. **Dependencies**:
   ```bash
   cd apps/studio
   bun add sharp csv-parse @sanity/client
   ```

4. **Prerequisites**:
   - Products must be migrated first (awards reference products)
   - Legacy server accessible for logo downloads

## Usage

### Single Award Migration

```bash
# Dry run (no changes to Sanity)
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --id=1 --dry-run

# Verbose dry run
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --id=1 --dry-run --verbose

# Live migration
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --id=1
```

### Batch Migration with Limit

```bash
# Migrate first 10 awards (dry run)
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --limit=10 --dry-run

# Migrate first 50 awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --limit=50

# Migrate first 100 awards with verbose output
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --limit=100 --verbose
```

### Full Migration

```bash
# Dry run all awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --dry-run

# Migrate all awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts

# Skip awards that already exist
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --skip-existing
```

### Rollback

```bash
# Delete all migrated awards
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --rollback
```

## Options

| Option            | Description                              |
| ----------------- | ---------------------------------------- |
| `--dry-run`       | Preview changes without saving to Sanity |
| `--id=<award-id>` | Migrate a single award by legacy ID      |
| `--limit=N`       | Migrate only first N awards              |
| `--skip-existing` | Skip awards that already exist in Sanity |
| `--batch-size=N`  | Process N awards per batch (default: 10) |
| `--verbose`       | Show detailed output                     |
| `--rollback`      | Delete all migrated awards               |
| `--help`          | Show help message                        |

## File Structure

```
apps/studio/scripts/migration/awards/
├── migrate-awards.ts         # Main migration script
├── types.ts                  # TypeScript interfaces
├── utils/
│   ├── csv-parser.ts         # CSV parsing utilities
│   ├── image-processor.ts    # Logo optimization
│   └── sanity-client.ts      # Sanity client setup
├── image-cache.json          # Cached logo uploads (auto-generated)
└── README.md                 # This file
```

## Migration Process

1. **Load CSV Data**: Parse award and relation CSV files
2. **Load Existing Products**: Query Sanity for migrated product IDs
3. **Transform Awards**: For each award:
   - Download logo from legacy server
   - Convert to WebP (no upscaling)
   - Upload to Sanity CDN
   - Resolve product references (only existing products)
4. **Save to Sanity**: Create or replace award documents

## Image Optimization

Award logos are converted to WebP format:

| Setting       | Value  | Notes                 |
| ------------- | ------ | --------------------- |
| Output Format | WebP   | Smaller file size     |
| Quality       | 85%    | Higher quality        |
| Max Width     | 800px  | Logos stay small      |
| Max Height    | 800px  | Maintain aspect ratio |
| Upscaling     | **NO** | Never upscale logos   |

## Document ID Pattern

All awards use predictable IDs: `award-{legacy-id}`

Examples:

- Legacy ID `1` → Sanity ID `award-1`
- Legacy ID `339` → Sanity ID `award-339`

## Product Reference Resolution

Products are referenced using the pattern `product-{legacyId}`:

- Only products that exist in Sanity are included
- Missing products are logged as warnings
- If a product wasn't migrated, its reference is skipped

## Field Mapping

| Sanity Field | Source                          | Notes                                       |
| ------------ | ------------------------------- | ------------------------------------------- |
| `name`       | `AwardName` from CSV            | Trimmed whitespace                          |
| `logo`       | `LogoFilename` → uploaded image | Converted to WebP                           |
| `products`   | `awards-products-relations.csv` | Only existing products referenced           |

## Image Caching

Uploaded logos are cached in `image-cache.json`:

```json
{
  "https://audiofast.pl/assets/awards/logo.png": {
    "assetId": "image-abc123",
    "originalSize": 45000,
    "optimizedSize": 12000,
    "uploadedAt": "2025-12-02T10:30:00.000Z"
  }
}
```

This allows resuming migration without re-uploading images.

## Validation

After migration, run these GROQ queries:

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
```

## Error Handling

- Failed logo downloads: Logged as warning, award created without logo
- Missing products: Logged as warning, reference skipped
- Transformation errors: Logged as error, award skipped
- Sanity save errors: Logged as error, included in final report

## Rollback

To delete all migrated awards:

```bash
bun run apps/studio/scripts/migration/awards/migrate-awards.ts --rollback
```

This deletes all documents with `_id` matching `award-*`.

## Expected Results

| Metric                     | Expected                       |
| -------------------------- | ------------------------------ |
| Total awards               | 314                            |
| Awards with logos          | 314 (100%)                     |
| Awards with products       | ~290+                          |
| Total product references   | 1,922 (minus missing products) |
| Average products per award | ~6.5                           |

