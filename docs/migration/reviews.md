# Review Migration Guide

This document explains how to export review data from the legacy SilverStripe database and import it into Sanity using the `migrate-reviews.ts` script.

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Bun** | The script is executed with `bun run`. |
| **Sanity API Token** | An editor/admin token with write access to the target dataset. |
| **CSV export** | A file containing review rows exported from the legacy database (see §2). |
| **Authors in Sanity** | The migration looks up authors by name; make sure they exist before running. |

---

## 2. Exporting Reviews from the Legacy Database

Run the following SQL query against the SilverStripe MariaDB/MySQL database. It returns one row per review with all required columns plus page-builder sections serialized as JSON.

```sql
SELECT
    rp.ID,
    st.URLSegment AS Slug,
    COALESCE(stl.Title, st.Title) AS PageTitle,
    COALESCE(stl.MenuTitle, st.MenuTitle) AS MenuTitle,
    COALESCE(rpl.Content, rp.Content) AS Content,
    rp.AuthorName,
    rp.CoverID,
    fc.FileFilename AS CoverFilename,
    rp.ArticleDate,
    rp.ExternalLink,
    rp.PDFFileID,
    fp.FileFilename AS PDFFilename,
    rp.ReviewType,
    -- Page-builder sections aggregated as JSON array
    (
        SELECT CONCAT('[', GROUP_CONCAT(
            CONCAT(
                '{"sort":', b.Sort,
                ',"type":"', IFNULL(b.Type, 'text'),
                '","title":"', REPLACE(REPLACE(IFNULL(bl.Title, b.Title), '"', '\\"'), '\n', '\\n'),
                '","content":"', REPLACE(REPLACE(IFNULL(bl.Content, b.Content), '"', '\\"'), '\n', '\\n'),
                '","publish":', IFNULL(b.Publish, 1), '}'
            )
            ORDER BY b.Sort
            SEPARATOR ','
        ), ']')
        FROM Box b
        LEFT JOIN Box_Localised bl ON bl.RecordID = b.ID AND bl.Locale = 'pl_PL'
        WHERE b.PageID = rp.ID
    ) AS PageSections
FROM ReviewPage rp
JOIN SiteTree st ON st.ID = rp.ID
LEFT JOIN SiteTree_Localised stl ON stl.RecordID = st.ID AND stl.Locale = 'pl_PL'
LEFT JOIN ReviewPage_Localised rpl ON rpl.RecordID = rp.ID AND rpl.Locale = 'pl_PL'
LEFT JOIN File fc ON fc.ID = rp.CoverID
LEFT JOIN File fp ON fp.ID = rp.PDFFileID
WHERE st.ClassName = 'ReviewPage'
ORDER BY rp.ID;
```

Export the result to CSV with headers. Example filename: `all-reviews.csv`.

---

## 3. CSV Columns Reference

| Column | Type | Description |
|--------|------|-------------|
| `ID` | integer | Legacy review ID – used to generate the Sanity `_id` (`review-{ID}`). |
| `Slug` | string | URL segment; used when `ReviewType = page`. |
| `PageTitle` | string | Primary title displayed on the review. |
| `MenuTitle` | string | Fallback title if `PageTitle` is empty. |
| `Content` | HTML | Legacy description/intro (used for SEO description). |
| `AuthorName` | string | Name of the publication/author (must exist in Sanity). |
| `CoverID` | integer | Legacy asset ID for cover image. |
| `CoverFilename` | string | Relative path to cover image in legacy assets folder. |
| `ArticleDate` | date | Publication date (`YYYY-MM-DD`). |
| `ExternalLink` | URL | External article URL (when `ReviewType = external`). |
| `PDFFileID` | integer | Legacy asset ID for PDF file. |
| `PDFFilename` | string | Relative path to PDF in legacy assets folder. |
| `ReviewType` | enum | `page`, `pdf`, or `external`. |
| `PageSections` | JSON | Serialized array of page-builder blocks (title, content, sort). |

---

## 4. Running the Migration

### Environment

Set the Sanity API token as an environment variable:

```bash
export SANITY_API_TOKEN="sk..."
```

Or pass it inline before the command.

### Commands

```bash
# Migrate ALL reviews
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv="./all-reviews.csv"

# Migrate a single review by title
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv="./all-reviews.csv" \
  --title="Test kondycjonera sieciowego Gryphon PowerZone 3 w The Absolute Sound"

# Migrate all reviews from a specific author/publication
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv="./all-reviews.csv" \
  --author="Audio"

# Dry-run (preview without writing to Sanity)
bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts \
  --csv="./all-reviews.csv" \
  --dry-run
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--csv=<path>` | Path to the CSV file (default: `./all-reviews.csv`). |
| `--title=<string>` | Filter to a single review by exact title match. |
| `--author=<string>` | Filter to reviews from a specific author/publication. |
| `--dry-run` / `-d` | Print payloads without writing to Sanity. |
| `--verbose` / `-v` | Enable extra logging. |

---

## 5. What the Script Does

1. **Reads the CSV** and parses each row.
2. **Determines destination type** (`page`, `pdf`, or `external`) from `ReviewType` column or by inspecting `ExternalLink`/`PDFFileID`.
3. **Resolves the author** by name against existing Sanity `author` documents.
4. **Uploads assets** (cover image, inline images, PDF) to Sanity and caches references.
5. **Parses HTML content** from `PageSections` (or fallback `Content`) into Portable Text blocks, preserving:
   - Headings (`h1`/`h2` → `h2`, `h3`+ → `h3`)
   - Bold (`<strong>`, `<b>`)
   - Italic (`<em>`, `<i>`)
   - Links (`<a href>` → `customLink` annotation)
   - Inline images (`<img>` → `ptImage` block)
6. **Builds the Sanity document** with SEO title/description.
7. **Creates or updates** the document via `createOrReplace`.

---

## 6. Destination Types

| Type | Required Fields | Notes |
|------|-----------------|-------|
| `page` | `slug`, `content`, `image` | Full article with Portable Text body. |
| `pdf` | `pdfFile`, `image` | Links to uploaded PDF asset. |
| `external` | `externalUrl`, `image` | Redirects to third-party URL. |

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| `Unknown author "XYZ"` | Create the author document in Sanity first. |
| `Review has no cover image` | Ensure `CoverFilename` is populated and the file exists at `https://www.audiofast.pl/assets/{CoverFilename}`. |
| `Page but has empty content` | Check that `PageSections` JSON or `Content` HTML is present. |
| `Missing slug` | Populate `Slug` column or ensure `PageTitle` can be slugified. |
| Asset upload fails | Verify the legacy asset URL is reachable and returns a valid file. |

---

## 8. Post-Migration Checklist

- [ ] Verify sample documents in Sanity Studio (one of each type).
- [ ] Confirm images display correctly.
- [ ] Confirm PDF downloads work.
- [ ] Confirm external links open in new tab.
- [ ] Spot-check Portable Text formatting (bold, links, headings).
- [ ] Validate SEO title/description populated.

---

## 9. Re-running / Updating

The script uses `createOrReplace`, so running it again with the same CSV will **overwrite** existing documents. This is safe for iterative migrations but be cautious in production.

To migrate only new reviews, filter the CSV to rows not yet in Sanity, or add a `--skip-existing` flag (not yet implemented).

