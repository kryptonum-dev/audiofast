/**
 * Stage 2: Patching — Stale Link Replacement
 *
 * Scans all Product, Blog Article, and Review documents in Sanity for links
 * that point to URLs present as sources in the redirects table, then replaces
 * them with the correct redirect destinations.
 *
 * Usage:
 *   SANITY_API_TOKEN=<token> bun run apps/studio/scripts/migration/replace-stale-links/patch.ts --dry-run
 *   SANITY_API_TOKEN=<token> bun run apps/studio/scripts/migration/replace-stale-links/patch.ts
 *
 * Options:
 *   --dry-run            Report what would be changed without writing (RECOMMENDED first)
 *   --verbose            Show detailed per-field logging
 *   --limit N            Process only N documents per type (for testing)
 *   --type <type>        Process only a specific type: product, blog-article, review
 *   --skip-homepage      Skip replacements where destination is "/" (homepage)
 *   --batch-size N       Number of documents per transaction batch (default: 10)
 */

import { createClient, type SanityClient } from "@sanity/client";

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "fsw3likv";
const DATASET = process.env.SANITY_DATASET || "production";
const API_VERSION = "2024-01-01";
const TOKEN = process.env.SANITY_API_TOKEN;

const KNOWN_DOMAINS = [
  "https://audiofast.pl",
  "https://www.audiofast.pl",
  "http://audiofast.pl",
  "http://www.audiofast.pl",
];

// CLI argument parsing
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const skipHomepage = args.includes("--skip-homepage");
const limitIndex = args.indexOf("--limit");
const limit =
  limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;
const typeIndex = args.indexOf("--type");
const filterType = typeIndex !== -1 ? args[typeIndex + 1] : undefined;
const batchSizeIndex = args.indexOf("--batch-size");
const BATCH_SIZE =
  batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 10) : 10;

// ============================================================================
// Types
// ============================================================================

interface RedirectEntry {
  source: string;
  destination: string;
}

interface ReplacementRecord {
  documentId: string;
  documentType: string;
  documentName: string;
  fieldPath: string;
  oldUrl: string;
  newUrl: string;
  linkType: string;
}

interface PatchOperation {
  documentId: string;
  documentType: string;
  documentName: string;
  fieldsToSet: Record<string, unknown>;
  replacements: ReplacementRecord[];
}

// ============================================================================
// URL Normalization & Matching (same as diagnostics)
// ============================================================================

function normalizeToPath(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  let path = url.trim();

  for (const domain of KNOWN_DOMAINS) {
    if (path.startsWith(domain)) {
      path = path.slice(domain.length);
      break;
    }
  }

  if (path.startsWith("http://") || path.startsWith("https://")) return null;
  if (
    path.startsWith("mailto:") ||
    path.startsWith("tel:") ||
    path.startsWith("#")
  )
    return null;

  if (!path.startsWith("/")) path = "/" + path;
  if (!path.endsWith("/")) path = path + "/";
  path = path.toLowerCase();
  return path;
}

function matchRedirect(
  url: string,
  redirectsMap: Map<string, RedirectEntry>,
): RedirectEntry | null {
  const normalized = normalizeToPath(url);
  if (!normalized) return null;

  const match = redirectsMap.get(normalized);
  if (match) return match;

  const withoutSlash = normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
  const matchNoSlash = redirectsMap.get(withoutSlash);
  if (matchNoSlash) return matchNoSlash;

  const withSlash = normalized.endsWith("/")
    ? normalized
    : normalized + "/";
  const matchWithSlash = redirectsMap.get(withSlash);
  if (matchWithSlash) return matchWithSlash;

  return null;
}

// ============================================================================
// Mutating Document Walker
// ============================================================================

/**
 * Recursively walk a document and REPLACE all stale URLs in-place.
 * Returns a list of all replacements made.
 *
 * IMPORTANT: This mutates the input object directly. Pass a deep clone.
 */
function replaceStaleLinks(
  obj: unknown,
  path: string,
  redirectsMap: Map<string, RedirectEntry>,
  replacements: ReplacementRecord[],
  docMeta: { id: string; type: string; name: string },
  visited: Set<unknown>,
): void {
  if (!obj || typeof obj !== "object") return;
  if (visited.has(obj)) return;
  visited.add(obj);

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      replaceStaleLinks(
        item,
        `${path}[${index}]`,
        redirectsMap,
        replacements,
        docMeta,
        visited,
      );
    });
    return;
  }

  const record = obj as Record<string, any>;

  // ---- Pattern 1: customUrl object (external type) ----
  if (record.type === "external" && typeof record.external === "string") {
    const redirect = matchRedirect(record.external, redirectsMap);
    if (redirect && (!skipHomepage || redirect.destination !== "/")) {
      const oldUrl = record.external;
      record.external = redirect.destination;
      replacements.push({
        documentId: docMeta.id,
        documentType: docMeta.type,
        documentName: docMeta.name,
        fieldPath: path + ".external",
        oldUrl,
        newUrl: redirect.destination,
        linkType: "customUrl-external",
      });

      // Also update the href mirror field to stay in sync
      if (typeof record.href === "string") {
        record.href = redirect.destination;
      }
    }
  }

  // ---- Pattern 2: link annotation (technical data) ----
  if (record._type === "link" && typeof record.href === "string") {
    const redirect = matchRedirect(record.href, redirectsMap);
    if (redirect && (!skipHomepage || redirect.destination !== "/")) {
      const oldUrl = record.href;
      record.href = redirect.destination;
      replacements.push({
        documentId: docMeta.id,
        documentType: docMeta.type,
        documentName: docMeta.name,
        fieldPath: path + ".href",
        oldUrl,
        newUrl: redirect.destination,
        linkType: "link-annotation",
      });
    }
  }

  // ---- Recurse into all properties ----
  for (const [key, val] of Object.entries(record)) {
    if (key === "_rev" || key === "_createdAt" || key === "_updatedAt") continue;
    replaceStaleLinks(
      val,
      path ? `${path}.${key}` : key,
      redirectsMap,
      replacements,
      docMeta,
      visited,
    );
  }
}

// ============================================================================
// Patch Builder
// ============================================================================

/**
 * Given a document, find all stale links and build the patch operation.
 * Returns null if no stale links found.
 */
function buildPatchForDocument(
  doc: Record<string, any>,
  redirectsMap: Map<string, RedirectEntry>,
): PatchOperation | null {
  const docName = extractPlainText(doc);
  const docMeta = { id: doc._id, type: doc._type, name: docName };

  // Deep clone the document so we can mutate safely
  const clone = structuredClone(doc);

  // Track all replacements
  const replacements: ReplacementRecord[] = [];

  // Handle direct URL fields (review.externalUrl)
  if (clone._type === "review" && typeof clone.externalUrl === "string") {
    const redirect = matchRedirect(clone.externalUrl, redirectsMap);
    if (redirect && (!skipHomepage || redirect.destination !== "/")) {
      const oldUrl = clone.externalUrl;
      clone.externalUrl = redirect.destination;
      replacements.push({
        documentId: docMeta.id,
        documentType: docMeta.type,
        documentName: docMeta.name,
        fieldPath: "externalUrl",
        oldUrl,
        newUrl: redirect.destination,
        linkType: "direct-url",
      });
    }
  }

  // Walk and mutate the clone
  replaceStaleLinks(clone, "", redirectsMap, replacements, docMeta, new Set());

  if (replacements.length === 0) return null;

  // Determine which top-level fields changed by comparing original vs clone
  const fieldsToSet: Record<string, unknown> = {};
  const topLevelFields = getAffectedTopLevelFields(replacements);

  for (const fieldName of topLevelFields) {
    if (fieldName === "externalUrl") {
      // Direct string field
      fieldsToSet[fieldName] = clone[fieldName];
    } else {
      // Complex field (object or array) — set the whole top-level field
      fieldsToSet[fieldName] = clone[fieldName];
    }
  }

  return {
    documentId: doc._id,
    documentType: doc._type,
    documentName: docName,
    fieldsToSet,
    replacements,
  };
}

/**
 * Extract unique top-level field names from replacement field paths.
 *
 * "details.content[0].markDefs[0].customLink.external" → "details"
 * "shortDescription[0].markDefs[0].customLink.external" → "shortDescription"
 * "content[9].markDefs[1].customLink.external" → "content"
 * "externalUrl" → "externalUrl"
 * "pageBuilder[0].slides[1].button.url.external" → "pageBuilder"
 */
function getAffectedTopLevelFields(
  replacements: ReplacementRecord[],
): Set<string> {
  const fields = new Set<string>();
  for (const r of replacements) {
    const match = r.fieldPath.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (match) {
      fields.add(match[1]);
    }
  }
  return fields;
}

function extractPlainText(doc: Record<string, any>): string {
  if (doc.name) return doc.name;
  if (doc.title && Array.isArray(doc.title)) {
    const text = doc.title
      .filter((block: any) => block._type === "block")
      .map((block: any) =>
        (block.children || [])
          .filter((child: any) => child._type === "span")
          .map((span: any) => span.text || "")
          .join(""),
      )
      .join(" ")
      .trim()
      .slice(0, 80);
    return text || "Unknown";
  }
  return "Unknown";
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchRedirects(
  client: SanityClient,
): Promise<Map<string, RedirectEntry>> {
  const doc = await client.fetch<{
    redirects: Array<{
      source: string;
      destination: string;
    }> | null;
  }>(`
    *[_type == "redirects"][0]{
      redirects[]{
        "source": source.current,
        "destination": destination.current
      }
    }
  `);

  if (!doc?.redirects) {
    throw new Error("No redirects document found in Sanity");
  }

  const map = new Map<string, RedirectEntry>();
  for (const r of doc.redirects) {
    const normalizedSource = r.source.toLowerCase();
    map.set(normalizedSource, {
      source: r.source,
      destination: r.destination,
    });
    if (!normalizedSource.endsWith("/")) {
      map.set(normalizedSource + "/", {
        source: r.source,
        destination: r.destination,
      });
    }
  }

  return map;
}

async function fetchDocuments(
  client: SanityClient,
  type: string,
  docLimit?: number,
): Promise<Record<string, any>[]> {
  const limitClause = docLimit ? `[0...${docLimit}]` : "";
  const query = `*[_type == "${type}" && !(_id in path("drafts.**"))]${limitClause}`;
  return client.fetch(query);
}

// ============================================================================
// Batch Patching
// ============================================================================

async function applyPatches(
  client: SanityClient,
  patches: PatchOperation[],
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE);
    const transaction = client.transaction();

    for (const patch of batch) {
      transaction.patch(patch.documentId, (p) => p.set(patch.fieldsToSet));
    }

    try {
      await transaction.commit({ visibility: "async" });
      success += batch.length;
    } catch (error) {
      console.error(
        `   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        error instanceof Error ? error.message : error,
      );
      // Fall back to individual patches for this batch
      for (const patch of batch) {
        try {
          await client
            .patch(patch.documentId)
            .set(patch.fieldsToSet)
            .commit({ visibility: "async" });
          success++;
        } catch (innerError) {
          console.error(
            `   ❌ Failed to patch ${patch.documentId} (${patch.documentName}):`,
            innerError instanceof Error ? innerError.message : innerError,
          );
          errors++;
        }
      }
    }

    const progress = Math.min(i + BATCH_SIZE, patches.length);
    const pct = Math.round((progress / patches.length) * 100);
    console.log(
      `   ${isDryRun ? "📋" : "✅"} ${progress}/${patches.length} documents (${pct}%)`,
    );

    // Small delay between batches
    if (i + BATCH_SIZE < patches.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { success, errors };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!TOKEN) {
    console.error("Error: SANITY_API_TOKEN environment variable is required.");
    console.error(
      "Usage: SANITY_API_TOKEN=<token> bun run apps/studio/scripts/migration/replace-stale-links/patch.ts --dry-run",
    );
    process.exit(1);
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token: TOKEN,
    useCdn: false,
  });

  console.log("");
  console.log("🔧 Stale Link Patcher — Stage 2: Replacement");
  console.log(`   Project:       ${PROJECT_ID}`);
  console.log(`   Dataset:       ${DATASET}`);
  console.log(`   Mode:          ${isDryRun ? "DRY RUN (no writes)" : "⚡ LIVE"}`);
  console.log(`   Batch size:    ${BATCH_SIZE}`);
  if (skipHomepage) console.log(`   Skip homepage: YES (skipping destination "/")`);
  if (filterType) console.log(`   Filter:        ${filterType} only`);
  if (limit) console.log(`   Limit:         ${limit} documents per type`);
  console.log("");

  if (!isDryRun) {
    console.log("   ⚠️  LIVE MODE — Changes will be written to Sanity!");
    console.log("   Press Ctrl+C within 5 seconds to abort...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log("   Proceeding with live patching...");
    console.log("");
  }

  // Step 1: Fetch redirects
  console.log("📋 Fetching redirects table...");
  const redirectsMap = await fetchRedirects(client);
  console.log(
    `   Found ${redirectsMap.size} redirect entries (incl. slash variants)`,
  );
  console.log("");

  // Step 2: Fetch documents and build patches
  const documentTypes = filterType
    ? [filterType]
    : ["product", "blog-article", "review"];

  const allPatches: PatchOperation[] = [];
  let totalReplacements = 0;
  let homepageSkipped = 0;

  for (const type of documentTypes) {
    console.log(`📦 Processing ${type} documents...`);
    const docs = await fetchDocuments(client, type, limit);
    console.log(`   Fetched ${docs.length} documents`);

    let typePatchCount = 0;
    let typeReplacementCount = 0;

    for (const doc of docs) {
      const patch = buildPatchForDocument(doc, redirectsMap);
      if (patch) {
        allPatches.push(patch);
        typePatchCount++;
        typeReplacementCount += patch.replacements.length;

        if (isVerbose) {
          console.log(
            `   📝 ${patch.documentName}: ${patch.replacements.length} replacement(s)`,
          );
          console.log(
            `      Fields to update: ${Object.keys(patch.fieldsToSet).join(", ")}`,
          );
          for (const r of patch.replacements) {
            console.log(`      ${r.fieldPath}`);
            console.log(`        "${r.oldUrl}" → "${r.newUrl}"`);
          }
        }
      }
    }

    totalReplacements += typeReplacementCount;
    console.log(
      `   ${typePatchCount > 0 ? "📝" : "✅"} ${typePatchCount} document(s) need patching (${typeReplacementCount} link replacements)`,
    );
    console.log("");
  }

  // Count homepage-destination links for informational purposes
  for (const patch of allPatches) {
    for (const r of patch.replacements) {
      if (r.newUrl === "/") homepageSkipped++;
    }
  }

  // Step 3: Summary before patching
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PATCH SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log(`  Documents to patch:     ${allPatches.length}`);
  console.log(`  Total link replacements: ${totalReplacements}`);
  if (homepageSkipped > 0 && !skipHomepage) {
    console.log(
      `  ⚠️  Links pointing to "/":  ${homepageSkipped} (use --skip-homepage to exclude)`,
    );
  }
  console.log("");

  if (allPatches.length === 0) {
    console.log("  ✅ Nothing to patch! All content links are clean.");
    console.log("");
    return;
  }

  // Group patches by document type for display
  const byType = new Map<string, PatchOperation[]>();
  for (const patch of allPatches) {
    if (!byType.has(patch.documentType)) byType.set(patch.documentType, []);
    byType.get(patch.documentType)!.push(patch);
  }

  for (const [type, patches] of byType) {
    const totalLinks = patches.reduce(
      (sum, p) => sum + p.replacements.length,
      0,
    );
    console.log(
      `  ${type}: ${patches.length} document(s), ${totalLinks} replacement(s)`,
    );
  }
  console.log("");

  // Step 4: Apply patches
  if (isDryRun) {
    console.log("📋 DRY RUN — No changes written to Sanity.");
    console.log(
      "   Run without --dry-run to apply these changes.",
    );
    console.log("");

    // In dry-run, show a condensed list of all affected documents
    console.log("─── Affected Documents ─────────────────────────────────");
    for (let i = 0; i < allPatches.length; i++) {
      const patch = allPatches[i];
      const fields = Object.keys(patch.fieldsToSet).join(", ");
      console.log(
        `  ${i + 1}. [${patch.documentType}] "${patch.documentName}" (${patch.replacements.length} links) — fields: ${fields}`,
      );
    }
    console.log("");
  } else {
    console.log("🔧 Applying patches...");
    console.log("");

    const result = await applyPatches(client, allPatches);

    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  PATCHING COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    console.log(`  ✅ Success: ${result.success} document(s)`);
    if (result.errors > 0) {
      console.log(`  ❌ Errors:  ${result.errors} document(s)`);
    }
    console.log(`  📊 Total link replacements: ${totalReplacements}`);
    console.log("");
    console.log(
      "  💡 Run the diagnostics script (index.ts) to verify no stale links remain.",
    );
    console.log("");
  }
}

main().catch((error) => {
  console.error("💥 Patching failed:", error);
  process.exit(2);
});
