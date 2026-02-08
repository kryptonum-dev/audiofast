/**
 * Stage 1: Diagnostics — Stale Link Scanner
 *
 * Scans all Product, Blog Article, and Review documents in Sanity for links
 * that point to URLs present as sources in the redirects table. These are
 * "stale links" — old URLs that should have been updated to their redirect
 * destinations.
 *
 * This script is READ-ONLY. It does not modify any data.
 *
 * Usage:
 *   SANITY_API_TOKEN=<token> bun run apps/studio/scripts/migration/replace-stale-links/index.ts
 *
 * Options:
 *   --verbose        Show detailed per-field logging
 *   --limit N        Process only N documents per type (for testing)
 *   --type <type>    Process only a specific type: product, blog-article, review
 *   --json           Output results as JSON (for piping to a file)
 */

import { createClient } from "@sanity/client";

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "fsw3likv";
const DATASET = process.env.SANITY_DATASET || "production";
const API_VERSION = "2024-01-01";
const TOKEN = process.env.SANITY_API_TOKEN;

// Known domain variations for the audiofast.pl site
const KNOWN_DOMAINS = [
  "https://audiofast.pl",
  "https://www.audiofast.pl",
  "http://audiofast.pl",
  "http://www.audiofast.pl",
];

// CLI argument parsing
const args = process.argv.slice(2);
const isVerbose = args.includes("--verbose");
const isJson = args.includes("--json");
const limitIndex = args.indexOf("--limit");
const limit =
  limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;
const typeIndex = args.indexOf("--type");
const filterType = typeIndex !== -1 ? args[typeIndex + 1] : undefined;

// ============================================================================
// Types
// ============================================================================

interface RedirectEntry {
  source: string;
  destination: string;
}

interface StaleLink {
  documentId: string;
  documentType: string;
  documentName: string;
  fieldPath: string;
  oldUrl: string;
  matchedSource: string;
  newDestination: string;
  linkType:
    | "customUrl-external"
    | "customUrl-href"
    | "link-annotation"
    | "direct-url";
}

interface DiagnosticsReport {
  timestamp: string;
  config: { projectId: string; dataset: string };
  redirectsCount: number;
  documentsScanned: {
    product: number;
    "blog-article": number;
    review: number;
  };
  totalStaleLinks: number;
  staleLinks: StaleLink[];
  summary: {
    byDocumentType: Record<string, number>;
    byLinkType: Record<string, number>;
    uniqueDocumentsAffected: number;
    topRedirectsUsed: Array<{ source: string; destination: string; count: number }>;
  };
}

// ============================================================================
// URL Normalization & Matching
// ============================================================================

/**
 * Normalize a URL to a path-only format for matching against the redirects map.
 * Strips known domain prefixes and normalizes trailing slashes.
 *
 * Examples:
 *   "https://audiofast.pl/pl/o-nas/"  → "/pl/o-nas/"
 *   "https://www.audiofast.pl/pl/o-nas" → "/pl/o-nas/"
 *   "/pl/o-nas/"                       → "/pl/o-nas/"
 *   "/pl/o-nas"                        → "/pl/o-nas/"
 *   "https://external-site.com/page"   → null (not a local URL)
 */
function normalizeToPath(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  let path = url.trim();

  // If it starts with a known domain, strip it
  for (const domain of KNOWN_DOMAINS) {
    if (path.startsWith(domain)) {
      path = path.slice(domain.length);
      break;
    }
  }

  // If it still starts with http(s)://, it's an external URL — skip
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return null;
  }

  // Skip mailto, tel, and anchor links
  if (
    path.startsWith("mailto:") ||
    path.startsWith("tel:") ||
    path.startsWith("#")
  ) {
    return null;
  }

  // Ensure leading slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // Ensure trailing slash for consistency
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  // Lowercase for case-insensitive matching
  path = path.toLowerCase();

  return path;
}

/**
 * Check if a URL matches any redirect source. Returns the redirect entry if matched.
 */
function matchRedirect(
  url: string,
  redirectsMap: Map<string, RedirectEntry>,
): RedirectEntry | null {
  const normalized = normalizeToPath(url);
  if (!normalized) return null;

  // Direct match
  const match = redirectsMap.get(normalized);
  if (match) return match;

  // Try without trailing slash
  const withoutSlash = normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
  const matchNoSlash = redirectsMap.get(withoutSlash);
  if (matchNoSlash) return matchNoSlash;

  // Try with trailing slash
  const withSlash = normalized.endsWith("/")
    ? normalized
    : normalized + "/";
  const matchWithSlash = redirectsMap.get(withSlash);
  if (matchWithSlash) return matchWithSlash;

  return null;
}

// ============================================================================
// Recursive Document Walker
// ============================================================================

/**
 * Recursively walk a Sanity document and find all URLs that match redirect sources.
 *
 * Detects three patterns:
 * 1. customUrl objects (type: "external" + external/href string fields)
 *    Found in: portable text customLink annotations, button url fields, CTA url fields
 * 2. link annotations (_type: "link" + href field)
 *    Found in: product technical data portable text
 * 3. Direct URL fields (review.externalUrl)
 */
function findStaleLinks(
  doc: Record<string, any>,
  redirectsMap: Map<string, RedirectEntry>,
): StaleLink[] {
  const results: StaleLink[] = [];
  const docName =
    doc.name ||
    (doc.title && Array.isArray(doc.title)
      ? extractPlainText(doc.title)
      : "Unknown");

  // Check direct URL fields first
  if (doc._type === "review" && typeof doc.externalUrl === "string") {
    const redirect = matchRedirect(doc.externalUrl, redirectsMap);
    if (redirect) {
      results.push({
        documentId: doc._id,
        documentType: doc._type,
        documentName: docName,
        fieldPath: "externalUrl",
        oldUrl: doc.externalUrl,
        matchedSource: redirect.source,
        newDestination: redirect.destination,
        linkType: "direct-url",
      });
    }
  }

  // Recursive walk
  walkValue(doc, "", doc._id, doc._type, docName, redirectsMap, results, new Set());

  return results;
}

function walkValue(
  value: unknown,
  path: string,
  docId: string,
  docType: string,
  docName: string,
  redirectsMap: Map<string, RedirectEntry>,
  results: StaleLink[],
  visited: Set<unknown>,
): void {
  if (!value || typeof value !== "object") return;

  // Prevent circular references
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkValue(
        item,
        `${path}[${index}]`,
        docId,
        docType,
        docName,
        redirectsMap,
        results,
        visited,
      );
    });
    return;
  }

  const obj = value as Record<string, any>;

  // ---- Pattern 1: customUrl object (external type) ----
  // Detect objects with { type: "external", external: "..." }
  // These appear in: customLink annotations (.customLink), button URL fields (.url), etc.
  if (obj.type === "external" && typeof obj.external === "string") {
    const redirect = matchRedirect(obj.external, redirectsMap);
    if (redirect) {
      results.push({
        documentId: docId,
        documentType: docType,
        documentName: docName,
        fieldPath: path + ".external",
        oldUrl: obj.external,
        matchedSource: redirect.source,
        newDestination: redirect.destination,
        linkType: "customUrl-external",
      });
    }

    // Also check the href mirror field
    if (typeof obj.href === "string" && obj.href !== "#") {
      const hrefRedirect = matchRedirect(obj.href, redirectsMap);
      if (hrefRedirect) {
        results.push({
          documentId: docId,
          documentType: docType,
          documentName: docName,
          fieldPath: path + ".href",
          oldUrl: obj.href,
          matchedSource: hrefRedirect.source,
          newDestination: hrefRedirect.destination,
          linkType: "customUrl-href",
        });
      }
    }
  }

  // ---- Pattern 2: link annotation (technical data) ----
  // Detect objects with { _type: "link", href: "..." }
  if (obj._type === "link" && typeof obj.href === "string") {
    const redirect = matchRedirect(obj.href, redirectsMap);
    if (redirect) {
      results.push({
        documentId: docId,
        documentType: docType,
        documentName: docName,
        fieldPath: path + ".href",
        oldUrl: obj.href,
        matchedSource: redirect.source,
        newDestination: redirect.destination,
        linkType: "link-annotation",
      });
    }
  }

  // ---- Recurse into all properties ----
  for (const [key, val] of Object.entries(obj)) {
    // Skip Sanity metadata fields that can't contain URLs
    if (key === "_rev" || key === "_createdAt" || key === "_updatedAt") continue;
    walkValue(
      val,
      path ? `${path}.${key}` : key,
      docId,
      docType,
      docName,
      redirectsMap,
      results,
      visited,
    );
  }
}

/**
 * Extract plain text from a portable text array (simple version for display).
 */
function extractPlainText(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "Unknown";
  return blocks
    .filter((block) => block._type === "block")
    .map((block) =>
      (block.children || [])
        .filter((child: any) => child._type === "span")
        .map((span: any) => span.text || "")
        .join(""),
    )
    .join(" ")
    .trim()
    .slice(0, 80) || "Unknown";
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchRedirects(
  client: ReturnType<typeof createClient>,
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
    // Store with normalized key (lowercase, with trailing slash)
    const normalizedSource = r.source.toLowerCase();
    map.set(normalizedSource, {
      source: r.source,
      destination: r.destination,
    });
    // Also store with trailing slash if missing
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
  client: ReturnType<typeof createClient>,
  type: string,
  docLimit?: number,
): Promise<Record<string, any>[]> {
  // Fetch raw documents (no projection) to get all nested data
  // We exclude pure metadata and image/file assets to reduce payload
  const limitClause = docLimit ? `[0...${docLimit}]` : "";
  const query = `*[_type == "${type}" && !(_id in path("drafts.**"))]${limitClause}`;
  return client.fetch(query);
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(
  staleLinks: StaleLink[],
  redirectsCount: number,
  documentCounts: Record<string, number>,
): DiagnosticsReport {
  // Count by document type
  const byDocumentType: Record<string, number> = {};
  for (const link of staleLinks) {
    byDocumentType[link.documentType] =
      (byDocumentType[link.documentType] || 0) + 1;
  }

  // Count by link type
  const byLinkType: Record<string, number> = {};
  for (const link of staleLinks) {
    byLinkType[link.linkType] = (byLinkType[link.linkType] || 0) + 1;
  }

  // Unique documents affected
  const uniqueDocs = new Set(staleLinks.map((l) => l.documentId));

  // Top redirects used
  const redirectUsage = new Map<string, number>();
  for (const link of staleLinks) {
    const key = link.matchedSource;
    redirectUsage.set(key, (redirectUsage.get(key) || 0) + 1);
  }
  const topRedirectsUsed = Array.from(redirectUsage.entries())
    .map(([source, count]) => {
      const entry = staleLinks.find((l) => l.matchedSource === source)!;
      return { source, destination: entry.newDestination, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    timestamp: new Date().toISOString(),
    config: { projectId: PROJECT_ID, dataset: DATASET },
    redirectsCount,
    documentsScanned: documentCounts as any,
    totalStaleLinks: staleLinks.length,
    staleLinks,
    summary: {
      byDocumentType,
      byLinkType,
      uniqueDocumentsAffected: uniqueDocs.size,
      topRedirectsUsed,
    },
  };
}

function printReport(report: DiagnosticsReport): void {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STALE LINK DIAGNOSTICS REPORT");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log(`  Timestamp:    ${report.timestamp}`);
  console.log(`  Project:      ${report.config.projectId}`);
  console.log(`  Dataset:      ${report.config.dataset}`);
  console.log(`  Redirects:    ${report.redirectsCount} entries in table`);
  console.log("");

  console.log("─── Documents Scanned ──────────────────────────────────");
  console.log(
    `  Products:       ${report.documentsScanned.product ?? 0}`,
  );
  console.log(
    `  Blog Articles:  ${report.documentsScanned["blog-article"] ?? 0}`,
  );
  console.log(
    `  Reviews:        ${report.documentsScanned.review ?? 0}`,
  );
  console.log("");

  console.log("─── Results ────────────────────────────────────────────");
  console.log(`  Total stale links found:      ${report.totalStaleLinks}`);
  console.log(
    `  Unique documents affected:    ${report.summary.uniqueDocumentsAffected}`,
  );
  console.log("");

  if (report.totalStaleLinks === 0) {
    console.log("  ✅ No stale links found! All content links are clean.");
    console.log("");
    return;
  }

  console.log("─── Breakdown by Document Type ─────────────────────────");
  for (const [type, count] of Object.entries(report.summary.byDocumentType)) {
    console.log(`  ${type}: ${count} stale link(s)`);
  }
  console.log("");

  console.log("─── Breakdown by Link Type ─────────────────────────────");
  for (const [type, count] of Object.entries(report.summary.byLinkType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log("");

  console.log("─── Top Redirect Sources Found in Content ──────────────");
  for (const entry of report.summary.topRedirectsUsed) {
    console.log(`  ${entry.source}  →  ${entry.destination}  (${entry.count}x)`);
  }
  console.log("");

  console.log("─── Detailed Findings ──────────────────────────────────");
  console.log("");

  // Group by document
  const byDoc = new Map<string, StaleLink[]>();
  for (const link of report.staleLinks) {
    const key = `${link.documentType}:${link.documentId}`;
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(link);
  }

  let docIndex = 0;
  for (const [, links] of byDoc) {
    docIndex++;
    const first = links[0];
    console.log(
      `  ${docIndex}. [${first.documentType}] "${first.documentName}"`,
    );
    console.log(`     ID: ${first.documentId}`);
    for (const link of links) {
      console.log(`     ├─ Field: ${link.fieldPath}`);
      console.log(`     │  Type:  ${link.linkType}`);
      console.log(`     │  Old:   ${link.oldUrl}`);
      console.log(`     │  New:   ${link.newDestination}`);
      console.log(`     │`);
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!TOKEN) {
    console.error(
      "Error: SANITY_API_TOKEN environment variable is required.",
    );
    console.error(
      "Usage: SANITY_API_TOKEN=<token> bun run apps/studio/scripts/migration/replace-stale-links/index.ts",
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

  if (!isJson) {
    console.log("");
    console.log("🔍 Stale Link Scanner — Stage 1: Diagnostics");
    console.log(`   Project: ${PROJECT_ID}`);
    console.log(`   Dataset: ${DATASET}`);
    if (filterType) console.log(`   Filter:  ${filterType} only`);
    if (limit) console.log(`   Limit:   ${limit} documents per type`);
    console.log("");
  }

  // Step 1: Fetch redirects
  if (!isJson) console.log("📋 Fetching redirects table...");
  const redirectsMap = await fetchRedirects(client);
  if (!isJson)
    console.log(`   Found ${redirectsMap.size} redirect entries (incl. slash variants)`);
  if (!isJson) console.log("");

  // Step 2: Fetch and scan documents
  const documentTypes = filterType
    ? [filterType]
    : ["product", "blog-article", "review"];

  const allStaleLinks: StaleLink[] = [];
  const documentCounts: Record<string, number> = {};

  for (const type of documentTypes) {
    if (!isJson) console.log(`📦 Fetching ${type} documents...`);
    const docs = await fetchDocuments(client, type, limit);
    documentCounts[type] = docs.length;
    if (!isJson) console.log(`   Found ${docs.length} documents`);

    let typeStaleCount = 0;
    for (const doc of docs) {
      const staleLinks = findStaleLinks(doc, redirectsMap);
      if (staleLinks.length > 0) {
        typeStaleCount += staleLinks.length;
        allStaleLinks.push(...staleLinks);

        if (isVerbose && !isJson) {
          const docName =
            doc.name ||
            (doc.title && Array.isArray(doc.title)
              ? extractPlainText(doc.title)
              : doc._id);
          console.log(
            `   ⚠️  ${docName}: ${staleLinks.length} stale link(s)`,
          );
          for (const link of staleLinks) {
            console.log(
              `       ${link.fieldPath}: ${link.oldUrl} → ${link.newDestination}`,
            );
          }
        }
      }
    }

    if (!isJson)
      console.log(
        `   ${typeStaleCount > 0 ? "⚠️ " : "✅ "}${typeStaleCount} stale link(s) found in ${type} documents`,
      );
    if (!isJson) console.log("");
  }

  // Step 3: Generate report
  const report = generateReport(allStaleLinks, redirectsMap.size, documentCounts);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  // Exit with code 1 if stale links were found (useful for CI)
  if (report.totalStaleLinks > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("💥 Diagnostics failed:", error);
  process.exit(2);
});
