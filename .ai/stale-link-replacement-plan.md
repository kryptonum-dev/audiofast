# Stale Link Replacement Plan

## Context

The client (Jarek) reported that Google's crawler encounters broken links when indexing the site. Content documents (Products, Blog Articles, Reviews) contain links pointing to **old URLs** that exist as **sources** in the Sanity redirects table. When a user clicks these links, the redirect resolves them at runtime. However, Google sees the raw old URL in the rendered HTML, follows it, and finds a non-existent page — harming SEO.

The fix: scan all content documents in Sanity, find URLs that match redirect sources, and replace them with the correct destination URLs directly in the CMS data.

---

## Background: How Links Are Stored

### 1. `customLink` annotation in Portable Text (primary)

The main link system across Products, Blog Articles, and Reviews. Uses the `customUrl` type:

- **Internal mode** (`type: "internal"`): stores a Sanity document reference (`internal._ref`). Resolved dynamically via GROQ at query time — **not the problem**.
- **External mode** (`type: "external"`): stores a raw URL string in the `external` field + a mirrored `href` field. **This is where stale URLs live** — old internal site URLs were likely pasted as "external" links.

### 2. `link` annotation in Technical Data

Product technical data (`technicalData.rows[].values[].content[]`) uses a standard Sanity `link` annotation with a plain `href` string. May also contain stale URLs.

### 3. Button / CTA components in Portable Text

`ptButton` and `ptCtaSection` blocks embed a `customUrl` object directly (same external/internal structure as #1).

### 4. Direct URL fields

- `review.externalUrl` — string URL on Review documents
- `store.website` — string URL on Store documents
- `reviewAuthor.websiteUrl` — string URL on Review Author documents

---

## Documents & Fields to Scan

| Document Type    | Portable Text Fields (with `customLink`)             | Other Link Fields                                      |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| **Product**      | `shortDescription`, `details.heading`, `details.productDetailContent`, pageBuilder blocks | `technicalData.rows[].values[].content[]` (`link` annotation) |
| **Blog Article** | `title`, `description`, `content`, pageBuilder blocks | —                                                      |
| **Review**       | `title`, `description`, `content`, pageBuilder blocks | `externalUrl` (direct string field)                    |

> **PageBuilder blocks** are arrays of typed objects, each potentially containing their own portable text fields with links. The script must handle this recursively.

---

## Redirects Source

- **Sanity singleton**: `_type: "redirects"` containing `redirects[]` array
- **Each entry**: `source.current` (old path), `destination.current` (new path), `isPermanent` (boolean)
- **Volume**: ~3,163 redirect entries
- **Format**: paths with leading `/` (e.g., `/pl/old-page/` -> `/new-page/`)

---

## URL Matching Strategy

Redirect sources are stored as relative paths (e.g., `/pl/old-page/`). URLs in content may appear as:

- Relative paths: `/pl/old-page/`
- Full URLs: `https://audiofast.pl/pl/old-page/` or `https://www.audiofast.pl/pl/old-page/`
- With or without trailing slash

**Approach**: strip known domain prefixes (`https://audiofast.pl`, `https://www.audiofast.pl`, `http://...` variants) to normalize all URLs to path-only format, then match against the redirects map. Also handle trailing slash inconsistencies.

---

## Implementation Steps

### Step 1: Fetch Redirects Map

- Query the `redirects` singleton from Sanity
- Build a `Map<string, string>` of normalized source path -> destination path
- Include trailing-slash variants for robust matching

### Step 2: Fetch All Target Documents

- Query all documents of type `product`, `blog-article`, and `review` from Sanity
- Fetch raw document data (not GROQ-projected), so we get the actual stored portable text structures
- Include both published and draft documents (`_id` with and without `drafts.` prefix)

### Step 3: Build a Portable Text Walker

A recursive utility that traverses any portable text array and:

- Finds `markDefs` entries where `_type === "customLink"` and `customLink.type === "external"`
- Checks if `customLink.external` (and `customLink.href`) matches a redirect source
- Finds `markDefs` entries where `_type === "link"` (technical data) and checks `href`
- Finds inline blocks of type `ptButton` or `ptCtaSection` and checks their nested `customUrl.external` / `customUrl.href`
- Records the match and prepares the replacement value

### Step 4: Build a PageBuilder Walker

PageBuilder sections are arrays of typed objects. Each block type may contain portable text fields. The walker should:

- Iterate over all pageBuilder entries
- For each entry, identify which fields are portable text (based on known block type schemas)
- Run the Portable Text Walker from Step 3 on each identified field

### Step 5: Scan All Fields Per Document Type

For each document, run the walkers on the appropriate fields:

**Product:**
1. `shortDescription` -> PT walker
2. `details.heading` -> PT walker
3. `details.productDetailContent` -> PT walker
4. `technicalData.rows[].values[].content[]` -> PT walker (for `link` annotations)
5. `pageBuilder` -> PageBuilder walker

**Blog Article:**
1. `title` -> PT walker
2. `description` -> PT walker
3. `content` -> PT walker
4. `pageBuilder` -> PageBuilder walker

**Review:**
1. `title` -> PT walker
2. `description` -> PT walker
3. `content` -> PT walker
4. `externalUrl` -> direct string match against redirects map
5. `pageBuilder` -> PageBuilder walker

### Step 6: Generate Dry-Run Report

Before making any changes, output a report:

- Total documents scanned per type
- Total stale links found
- Per-document breakdown: document ID, name/title, field path, old URL, new URL
- Export as JSON or CSV for review

### Step 7: Apply Patches

After reviewing the dry-run report:

- For each document with stale links, fetch the full current field value
- Apply all URL replacements in memory
- Use `client.patch(docId).set({ fieldPath: updatedValue })` to write back
- Process in batches of 10-20 documents using transactions
- Log progress with counts and percentages

### Step 8: Post-Migration Verification

- Re-run the analysis script to confirm zero stale links remain
- Trigger cache revalidation for affected document types (`product`, `blog-article`, `review`)
- Spot-check a few pages on the live site to verify links resolve correctly

---

## Script Structure

Following established migration patterns in the project:

```
apps/studio/scripts/migration/replace-stale-links/
├── index.ts                        # Main entry point with CLI arg parsing
├── utils/
│   ├── sanity-client.ts            # Reuse existing migration client pattern
│   ├── url-matcher.ts              # URL normalization + redirect map matching
│   ├── portable-text-walker.ts     # Recursive PT traversal + mutation
│   └── page-builder-walker.ts      # PageBuilder field identification + PT delegation
```

**CLI flags** (following project conventions):
- `--dry-run` — report only, no writes
- `--verbose` — detailed per-field logging
- `--limit N` — process only N documents (for testing)
- `--type product|blog-article|review` — process only a specific document type

---

## Risks & Edge Cases

| Risk | Mitigation |
| ---- | ---------- |
| PageBuilder blocks have deeply nested portable text | Recursive walker must handle arbitrary depth; test with known complex pages |
| `href` field on `customUrl` is marked `readOnly` in schema | This is a Studio UI constraint, not an API constraint — patching via the Sanity client API will work |
| Some "external" links intentionally point to old-format paths | The dry-run report enables human review before committing changes |
| Draft vs Published documents | Fetch and patch both `drafts.*` and published document IDs |
| URL format variations (http/https, www/no-www, trailing slash) | Normalize all URLs to path-only before matching |
| Volume (~3,163 redirects x hundreds of documents) | Use a Map for O(1) lookups; batch processing prevents API rate limits |

---

## Separate Concern: Middleware

During research, it was discovered that `apps/web/src/proxy.ts` contains a fully implemented redirect proxy function, but **no `middleware.ts` exists** to wire it up. This means server-side redirects are not active at all — the redirects only work via the generated static map at build time (used in Next.js config or client-side).

**Recommendation**: After the stale link replacement is complete, create a `middleware.ts` that activates the proxy function. This provides a safety net for any external sites, bookmarks, or cached Google results still pointing to old URLs. This is a separate task and should not block the link replacement work.
