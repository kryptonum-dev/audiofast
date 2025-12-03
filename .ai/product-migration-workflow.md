# Product Migration Workflow (Brand-by-Brand)

> **Purpose**: Step-by-step workflow for migrating products from legacy SilverStripe CMS to Sanity, one brand at a time.

---

## ✅ MIGRATION COMPLETE

**Completed**: December 3, 2025

| Metric                         | Value   |
| ------------------------------ | ------- |
| **Total Products Migrated**    | **816** |
| **Total Brands**               | **35**  |
| **Products Missing Images**    | 8       |
| **Migration Success Rate**     | 100%    |

All products have been successfully migrated from the legacy SilverStripe CMS to Sanity. Only 8 products are missing preview images due to NULL image paths in the source CSV (no source images available).

---

## Overview

This workflow ensures data integrity by:

1. **Pre-migration verification** - Comparing expected vs actual counts
2. **Migration execution** - Running the migration script
3. **Post-migration verification** - Confirming successful migration
4. **Issue tracking** - Documenting any warnings or missing data

---

## Pre-Migration Checklist

Before starting any migration:

- [ ] Sanity API token is available
- [ ] CSV files are up-to-date in `/csv/products/`
- [ ] Migration scripts are tested with `--dry-run`
- [ ] Brand exists in Sanity with correct slug

---

## Step 1: Pre-Migration Verification

### 1.1 Get Product Count from CSV

```bash
# Replace "Brand Name" with the actual brand name
grep -i "Brand Name" csv/products/products-main.csv | wc -l
```

Or use grep to see all matching products:

```bash
grep -i "Brand Name" csv/products/products-main.csv
```

### 1.2 Get Current Count from Sanity

Query Sanity to check existing non-DUMMY products for the brand:

```groq
// Replace brand-slug with actual slug (e.g., "audioresearch", "ayre", "dcs")
count(*[
  _type == "product" &&
  brand->slug.current == "/marki/brand-slug/" &&
  !(name match "[DUMMY]") &&
  !(_id match "drafts.*")
])
```

### 1.3 Document Pre-Migration State

| Metric                           | Count                     |
| -------------------------------- | ------------------------- |
| **Products in CSV**              | X                         |
| **Non-DUMMY products in Sanity** | Y                         |
| **To be migrated**               | X - Y (or X if replacing) |

---

## Step 2: Run Migration

### 2.1 Execute Migration Script

```bash
cd /path/to/audiofast

SANITY_API_TOKEN="your-token-here" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Brand Name"
```

### 2.2 Migration Options

| Flag              | Description                         |
| ----------------- | ----------------------------------- |
| `--brand="Name"`  | **Required**. Brand name to migrate |
| `--dry-run`       | Simulate without making changes     |
| `--skip-existing` | Skip products that already exist    |
| `--verbose`       | Show detailed processing logs       |
| `--batch-size=N`  | Products per batch (default: 10)    |

### 2.3 Monitor Output

Watch for:

- ✅ Successful products
- ⚠️ Missing preview images
- ⚠️ Missing/skipped reviews
- ❌ Errors

---

## Step 3: Post-Migration Verification

### 3.1 Verify Final Count in Sanity

```groq
count(*[
  _type == "product" &&
  brand->slug.current == "/marki/brand-slug/" &&
  !(name match "[DUMMY]") &&
  !(_id match "drafts.*")
])
```

### 3.2 Compare Results

| Metric             | Expected (CSV) | Actual (Sanity) | Status  |
| ------------------ | -------------- | --------------- | ------- |
| **Total Products** | X              | X               | ✅ / ❌ |

### 3.3 Check for Issues

Query products missing preview images:

```groq
*[
  _type == "product" &&
  brand->slug.current == "/marki/brand-slug/" &&
  !defined(previewImage)
]{ _id, name, slug }
```

---

## Step 4: Document Results

### Migration Log Template

```markdown
## [Brand Name] - Migration Log

**Date**: YYYY-MM-DD
**Migrated by**: [Name]

### Pre-Migration

- CSV Count: X
- Sanity Count (before): Y

### Migration Results

- Created: X
- Updated: Y
- Skipped: Z
- Errors: N
- Duration: Xs

### Issues

- [ ] Missing preview images: [list product names]
- [ ] Skipped reviews: [list legacy IDs]
- [ ] Other warnings: [describe]

### Post-Migration

- Sanity Count (after): X
- Status: ✅ Match / ❌ Mismatch
```

---

## Brand Migration Progress Tracker

**✅ ALL 35 BRANDS MIGRATED - 816 TOTAL PRODUCTS**

| Brand                  | Sanity Count | Status | Date       | Notes                            |
| ---------------------- | ------------ | ------ | ---------- | -------------------------------- |
| Synergistic Research   | 180          | ✅     | 2025-12-03 | 5 missing images (NULL in CSV)   |
| Shunyata Research      | 131          | ✅     | 2025-12-03 | 3 missing images (NULL in CSV)   |
| Audio Research         | 67           | ✅     | 2025-12-02 |                                  |
| Gryphon Audio Designs  | 53           | ✅     | 2025-12-02 | Images fixed (alt path)          |
| Goldenear Technology   | 42           | ✅     | 2025-12-03 |                                  |
| Usher Audio Technology | 29           | ✅     | 2025-12-03 |                                  |
| Wilson Audio           | 27           | ✅     | 2025-12-02 |                                  |
| Dan D'Agostino         | 25           | ✅     | 2025-12-02 |                                  |
| Aurender               | 25           | ✅     | 2025-12-02 |                                  |
| PrimaLuna              | 25           | ✅     | 2025-12-02 |                                  |
| Stealth Audio          | 24           | ✅     | 2025-12-02 |                                  |
| Keces Audio            | 22           | ✅     | 2025-12-02 |                                  |
| Symposium              | 20           | ✅     | 2025-12-02 |                                  |
| dCS                    | 18           | ✅     | 2025-12-02 |                                  |
| Rogue Audio            | 17           | ✅     | 2025-12-02 |                                  |
| Artesania Audio        | 16           | ✅     | 2025-12-02 |                                  |
| Ayre Acoustics         | 14           | ✅     | 2025-12-02 |                                  |
| Soundsmith             | 12           | ✅     | 2025-12-02 |                                  |
| Vandersteen            | 11           | ✅     | 2025-12-02 |                                  |
| Grimm Audio            | 9            | ✅     | 2025-12-02 |                                  |
| Bricasti               | 9            | ✅     | 2025-12-02 |                                  |
| Thixar                 | 9            | ✅     | 2025-12-02 |                                  |
| Weiss Engineering      | 4            | ✅     | 2025-12-02 |                                  |
| Acoustic Signature     | 4            | ✅     | 2025-12-02 | Images fixed (alt path)          |
| Spiral Groove          | 4            | ✅     | 2025-12-02 |                                  |
| Mutec                  | 4            | ✅     | 2025-12-02 |                                  |
| Roon Labs              | 3            | ✅     | 2025-12-02 |                                  |
| Grand Prix Audio       | 2            | ✅     | 2025-12-02 |                                  |
| Moonriver Audio        | 2            | ✅     | 2025-12-02 |                                  |
| Exogal                 | 2            | ✅     | 2025-12-02 | Images fixed (alt path)          |
| Vibrapod               | 2            | ✅     | 2025-12-02 |                                  |
| Taiko Audio            | 1            | ✅     | 2025-12-02 |                                  |
| Dutch & Dutch          | 1            | ✅     | 2025-12-02 |                                  |
| VIV Laboratory         | 1            | ✅     | 2025-12-02 |                                  |
| KLH Audio              | 1            | ✅     | 2025-12-02 |                                  |
| **TOTAL**              | **816**      | ✅     |            |                                  |

### Products Missing Preview Images (8 total)

These products have NULL image paths in the source CSV - requires manual upload:

| Product ID  | Brand                | Name                    |
| ----------- | -------------------- | ----------------------- |
| product-201 | Synergistic Research | Galileo UEF Interconnect|
| product-203 | Synergistic Research | Galileo UEF AC          |
| product-205 | Synergistic Research | Galileo UEF             |
| product-340 | Synergistic Research | Transporter Ultra       |
| product-408 | Synergistic Research | Galileo UEF Phono       |
| product-295 | Shunyata Research    | Hydra Triton 3          |
| product-296 | Shunyata Research    | Hydra Typhon            |
| product-297 | Shunyata Research    | Hydra DPC-6             |

---

## Common Issues & Solutions

### Issue: Missing Preview Image

**Cause**: Image file doesn't exist on legacy server (404)
**Solution**: Manually upload image in Sanity Studio

### Issue: Review Not Found

**Cause**: Review document doesn't exist in Sanity
**Solution**: Either migrate the review first, or skip it (automatic)

### Issue: Category Not Found

**Cause**: Category hasn't been migrated to Sanity
**Solution**: Migrate categories first using category migration script

### Issue: Slug Case Sensitivity

**Cause**: Legacy slugs may have uppercase characters
**Solution**: Fixed in script - slugs are automatically lowercased

---

## Quick Reference Commands

### Full migration (replace existing):

```bash
SANITY_API_TOKEN="token" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Brand Name"
```

### Dry run (test without changes):

```bash
SANITY_API_TOKEN="token" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Brand Name" --dry-run
```

### Skip existing products:

```bash
SANITY_API_TOKEN="token" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Brand Name" --skip-existing
```

### Verbose output:

```bash
SANITY_API_TOKEN="token" bun run apps/studio/scripts/migration/products/migrate-products-by-brand.ts --brand="Brand Name" --verbose
```

---

## All Available Brands

To see all brands in the CSV:

```bash
cut -d',' -f17 csv/products/products-main.csv | sort | uniq -c | sort -rn
```

To see brands in Sanity:

```groq
*[_type == "brand"]{ name, slug } | order(name asc)
```

---

## Related Documentation

- [Product Migration Plan](./product-migration-plan.md) - Technical implementation details
- [Brand Migration Flow](./brand-migration-flow.md) - Brand migration strategy
- [Data Migration Strategy](./data-migration-strategy.md) - Overall migration approach
