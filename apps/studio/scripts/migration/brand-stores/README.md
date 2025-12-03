# Brand-Stores Migration

This migration script populates the `stores` array field on brand documents using dealer-brand relationships from the legacy database.

## Prerequisites

1. **Stores must be migrated first** - Run the stores migration before this script:

   ```bash
   bun run apps/studio/scripts/migration/stores/migrate-stores.ts
   ```

2. **CSV file required** - The migration reads from:

   ```
   csv/dealers/dealer-brand-relations.csv
   ```

3. **Environment variables**:
   ```bash
   export SANITY_PROJECT_ID="your-project-id"
   export SANITY_DATASET="production"  # or your dataset
   export SANITY_API_TOKEN="your-token-with-write-access"
   ```

## Usage

### Dry Run (Preview)

See what changes would be made without actually updating anything:

```bash
bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts --dry-run
```

### Verbose Dry Run

Include detailed logging of each brand and store mapping:

```bash
bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts --dry-run --verbose
```

### Production Run

Actually apply the changes:

```bash
bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts
```

### Rollback

Remove all store references from brands:

```bash
bun run apps/studio/scripts/migration/brand-stores/migrate-brand-stores.ts --rollback
```

## How It Works

1. **Parses CSV** - Reads `dealer-brand-relations.csv` and groups dealers by brand slug
2. **Fetches Sanity data** - Gets all brands and stores from Sanity
3. **Maps relationships** - For each brand:
   - Finds the brand in Sanity by slug
   - Converts dealer IDs to store document IDs (`store-dealer-{dealerId}`)
   - Verifies each store exists in Sanity
4. **Updates brands** - Sets the `stores` array with references to store documents

## Data Flow

```
Legacy Database                    CSV                          Sanity
┌──────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│ Dealer_ProducerPage │ → │ dealer-brand-relations │ → │ brand.stores[]   │
│ (DealerID,       │      │ (DealerID, BrandSlug) │      │ (references to   │
│  ProducerPageID) │      └─────────────────────┘      │  store documents)│
└──────────────────┘                                    └──────────────────┘
```

## Store ID Pattern

Stores in Sanity use the ID pattern: `store-dealer-{DealerID}`

For example:

- Dealer ID `5` → Sanity store ID `store-dealer-5`
- Dealer ID `38` → Sanity store ID `store-dealer-38`

## Expected Output

```
═══════════════════════════════════════════════════════════════
           BRAND-STORES MIGRATION REPORT
═══════════════════════════════════════════════════════════════

Date: 2025-12-03T12:00:00.000Z

───────────────────────────────────────────────────────────────
SUMMARY
───────────────────────────────────────────────────────────────
Total Brands Processed:      35
Brands Updated:              33
Brands Skipped (no stores):  0
Brands Failed:               2
Total Store References:      291
```

## Troubleshooting

### "Brand not found in Sanity"

The brand slug from the CSV doesn't match any brand in Sanity. Check:

- Brand slug matches exactly (case-sensitive)
- Brand exists and is published

### "Store not found"

The store hasn't been migrated. Run the stores migration first:

```bash
bun run apps/studio/scripts/migration/stores/migrate-stores.ts
```

### Missing environment variables

Ensure all required env vars are set:

```bash
echo $SANITY_PROJECT_ID
echo $SANITY_DATASET
echo $SANITY_API_TOKEN
```
