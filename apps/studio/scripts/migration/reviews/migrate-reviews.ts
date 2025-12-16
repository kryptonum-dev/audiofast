#!/usr/bin/env bun
/**
 * Migration Script: Legacy reviews CSV → Sanity `review` documents
 *
 * Supported modes:
 *   1. Migrate a single review by title/name
 *      bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --title="Test MU2"
 *
 *   2. Migrate every review for a specific author
 *      bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts --author="The Absolute Sound"
 *
 *   3. Migrate everything
 *      bun run apps/studio/scripts/migration/reviews/migrate-reviews.ts
 *
 * Add --dry-run to preview payloads without touching Sanity.
 */

import { readFileSync } from "node:fs";
import * as https from "node:https";
import { resolve } from "node:path";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";
import { JSDOM } from "jsdom";
import slugify from "slugify";

type CliOptions = {
  csvPath: string;
  dryRun: boolean;
  verbose: boolean;
  titleFilter?: string;
  authorFilter?: string;
  limit?: number;
  skip?: number;
};

type ReviewRow = {
  ID: string;
  Slug?: string;
  PageTitle?: string;
  MenuTitle?: string;
  Content?: string;
  AuthorName?: string;
  CoverID?: string;
  CoverFilename?: string;
  ArticleDate?: string;
  ExternalLink?: string;
  PDFFileID?: string;
  PDFFilename?: string;
  ReviewType?: "page" | "pdf" | "external";
  PageSections?: string;
};

type PortableTextSpan = {
  _type: "span";
  _key: string;
  text: string;
  marks?: string[];
};

type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3";
  markDefs: any[];
  children: PortableTextSpan[];
};

type PortableTextImage = {
  _type: "ptImage";
  _key: string;
  layout: "single" | "double";
  image: {
    _type: "image";
    asset: { _type: "reference"; _ref: string };
  };
};

type PortableTextNode = PortableTextBlock | PortableTextImage;

type MarkDef = {
  _key: string;
  _type: "customLink";
  customLink: {
    type: "external";
    openInNewTab: boolean;
    external: string;
  };
};

type ReviewDocument = {
  _id: string;
  _type: "review";
  destinationType: "page" | "pdf" | "external";
  publishedDate?: string;
  slug?: { _type: "slug"; current: string };
  author?: { _type: "reference"; _ref: string };
  title: PortableTextBlock[];
  description?: PortableTextBlock[];
  content?: PortableTextNode[];
  image?: {
    _type: "image";
    asset: { _type: "reference"; _ref: string };
  };
  pdfFile?: {
    _type: "file";
    asset: { _type: "reference"; _ref: string };
  };
  externalUrl?: string;
  seo?: {
    title: string;
    description: string;
  };
};

const generateKey = () => Math.random().toString(36).slice(2, 10);

type LegacySection = {
  sort?: number;
  type?: string;
  title?: string;
  content?: string;
  publish?: number;
};

const SITE_TREE_LINK_REGEX = /\[sitetree_link,id=(\d+)\]/gi;

const DEFAULT_CSV_PATH = "./all-reviews.csv";
const DEFAULT_PROJECT_ID = "fsw3likv";
const DEFAULT_DATASET = "production";
const LEGACY_ASSETS_BASE_URL = "https://www.audiofast.pl/assets/";

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const csvArg = args.find((arg) => arg.startsWith("--csv="));
  const titleArg = args.find((arg) => arg.startsWith("--title="));
  const authorArg = args.find((arg) => arg.startsWith("--author="));
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const skipArg = args.find((arg) => arg.startsWith("--skip="));

  return {
    csvPath: csvArg ? csvArg.replace("--csv=", "") : DEFAULT_CSV_PATH,
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    titleFilter: titleArg ? titleArg.replace("--title=", "").trim() : undefined,
    authorFilter: authorArg
      ? authorArg.replace("--author=", "").trim()
      : undefined,
    limit: limitArg
      ? parseInt(limitArg.replace("--limit=", ""), 10)
      : undefined,
    skip: skipArg ? parseInt(skipArg.replace("--skip=", ""), 10) : undefined,
  };
}

function readCsvRows(csvPath: string): ReviewRow[] {
  const resolved = resolve(process.cwd(), csvPath);
  const file = readFileSync(resolved, "utf-8");
  return parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ReviewRow[];
}

function replaceSiteTreeLinks(input?: string | null): string {
  if (!input) return "";
  return input.replace(
    SITE_TREE_LINK_REGEX,
    (_match, id) => `/recenzje/${id}/`,
  );
}

function cleanString(value?: string | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  const cleaned = value.replace(/\u00a0/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.toLowerCase() === "null") return "";
  return cleaned;
}

function createPortableTextFromString(
  text: string,
  options: { style?: "normal" | "h2" | "h3" } = {},
): PortableTextBlock[] {
  const clean = cleanString(text);
  if (!clean) return [];
  return [
    {
      _type: "block",
      _key: `block-${Math.random().toString(36).slice(2, 8)}`,
      style: options.style ?? "normal",
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: `span-${Math.random().toString(36).slice(2, 8)}`,
          text: clean,
        },
      ],
    },
  ];
}

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .trim();
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type SerializedResult = {
  spans: PortableTextSpan[];
  markDefs: MarkDef[];
};

function serializeNode(
  node: any,
  activeMarks: string[] = [],
): SerializedResult {
  const spans: PortableTextSpan[] = [];
  const markDefs: MarkDef[] = [];

  if (!node) {
    return { spans, markDefs };
  }

  if (node.nodeType === TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    if (!text.trim()) {
      spans.push({
        _type: "span",
        _key: `span-${generateKey()}`,
        text: " ",
        ...(activeMarks.length ? { marks: [...activeMarks] } : {}),
      });
      return { spans, markDefs };
    }
    const span: PortableTextSpan = {
      _type: "span",
      _key: `span-${generateKey()}`,
      text,
    };
    if (activeMarks.length > 0) {
      span.marks = [...activeMarks];
    }
    spans.push(span);
    return { spans, markDefs };
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return { spans, markDefs };
  }

  const element = node as any;
  const tag = element.tagName.toLowerCase();

  if (tag === "br") {
    spans.push({
      _type: "span",
      _key: `span-${generateKey()}`,
      text: "\n",
      ...(activeMarks.length ? { marks: [...activeMarks] } : {}),
    });
    return { spans, markDefs };
  }

  let marksForChildren = activeMarks;
  if (tag === "a") {
    const href = cleanString(element.getAttribute("href"));
    if (href) {
      const markKey = `mark-${generateKey()}`;
      markDefs.push({
        _key: markKey,
        _type: "customLink",
        customLink: {
          type: "external",
          openInNewTab: true,
          external: href,
        },
      });
      marksForChildren = [...marksForChildren, markKey];
    }
  }

  if (tag === "strong" || tag === "b") {
    if (!marksForChildren.includes("strong")) {
      marksForChildren = [...marksForChildren, "strong"];
    }
  }

  if (tag === "em" || tag === "i") {
    if (!marksForChildren.includes("em")) {
      marksForChildren = [...marksForChildren, "em"];
    }
  }

  for (const child of Array.from(element.childNodes)) {
    const result = serializeNode(child, marksForChildren);
    spans.push(...result.spans);
    markDefs.push(...result.markDefs);
  }

  return { spans, markDefs };
}

function convertHtmlSnippetToBlocks(html?: string | null): PortableTextBlock[] {
  if (!html) return [];
  const sanitized = html.replace(/&nbsp;/gi, " ");
  const dom = new JSDOM(`<body>${sanitized}</body>`);
  const { document } = dom.window;
  const blocks: PortableTextBlock[] = [];

  const pushBlockFromNode = (node: any, style: "normal" | "h2" | "h3") => {
    const serialized = serializeNode(node);
    const markDefsMap = new Map<string, MarkDef>();
    serialized.markDefs.forEach((def) => {
      if (def && def._key && !markDefsMap.has(def._key)) {
        markDefsMap.set(def._key, def);
      }
    });

    const cleanedSpans: PortableTextSpan[] = [];
    serialized.spans.forEach((span) => {
      if (span.text === "\n") {
        const newlineSpan = { ...span };
        if (!newlineSpan.marks || newlineSpan.marks.length === 0) {
          delete newlineSpan.marks;
        }
        cleanedSpans.push(newlineSpan);
        return;
      }
      const originalText = span.text;
      const normalizedSpace = originalText.replace(/\s+/g, " ");
      if (!normalizedSpace.trim()) {
        const whitespaceSpan: PortableTextSpan = {
          ...span,
          text: " ",
        };
        if (!whitespaceSpan.marks || whitespaceSpan.marks.length === 0) {
          delete whitespaceSpan.marks;
        }
        cleanedSpans.push(whitespaceSpan);
        return;
      }

      const hasLeadingSpace = /^\s/.test(originalText);
      const hasTrailingSpace = /\s$/.test(originalText);
      let text = normalizedSpace.trim();
      if (!text) {
        text = " ";
      } else {
        if (hasLeadingSpace) text = ` ${text}`;
        if (hasTrailingSpace) text = `${text} `;
      }

      const normalizedSpan: PortableTextSpan = {
        ...span,
        text,
      };
      if (!normalizedSpan.marks || normalizedSpan.marks.length === 0) {
        delete normalizedSpan.marks;
      }
      cleanedSpans.push(normalizedSpan);
    });

    if (cleanedSpans.length === 0) {
      return;
    }

    blocks.push({
      _type: "block",
      _key: `block-${generateKey()}`,
      style,
      markDefs: Array.from(markDefsMap.values()),
      children: cleanedSpans,
    });
  };

  const removeAnchorsFromHeading = (node: HTMLElement) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("a").forEach((anchor) => {
      anchor.replaceWith(anchor.textContent || "");
    });
    return clone;
  };

  for (const child of Array.from(document.body.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      const text = cleanString(child.textContent);
      if (!text) continue;
      blocks.push({
        _type: "block",
        _key: `block-${generateKey()}`,
        style: "normal",
        markDefs: [],
        children: [
          {
            _type: "span",
            _key: `span-${generateKey()}`,
            text,
          },
        ],
      });
      continue;
    }

    if (child.nodeType !== ELEMENT_NODE) {
      continue;
    }

    const element = child as any;
    const tag = element.tagName.toLowerCase();

    if (tag === "img" || tag === "script" || tag === "style") {
      continue;
    }

    if (tag === "h1" || tag === "h2") {
      pushBlockFromNode(removeAnchorsFromHeading(element), "h2");
      continue;
    }

    if (["h3", "h4", "h5", "h6"].includes(tag)) {
      pushBlockFromNode(removeAnchorsFromHeading(element), "h2");
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.querySelectorAll("li"));
      if (items.length === 0) {
        continue;
      }
      items.forEach((li) => pushBlockFromNode(li, "normal"));
      continue;
    }

    pushBlockFromNode(element, "normal");
  }

  return blocks;
}

async function fetchInsecure(url: string): Promise<Buffer | null> {
  return new Promise((resolvePromise) => {
    https
      .get(url, { agent: insecureAgent }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error(
            `   ✗ Failed to download ${url} (status ${res.statusCode})`,
          );
          resolvePromise(null);
          return;
        }

        const buffers: Buffer[] = [];
        res.on("data", (chunk) => buffers.push(chunk));
        res.on("end", () => resolvePromise(Buffer.concat(buffers)));
        res.on("error", (err) => {
          console.error(`   ✗ Error downloading ${url}:`, err);
          resolvePromise(null);
        });
      })
      .on("error", (err) => {
        console.error(`   ✗ Request error for ${url}:`, err);
        resolvePromise(null);
      });
  });
}

async function uploadAsset(
  client: SanityClient,
  type: "image" | "file",
  url: string,
  filename: string,
  cache: Map<string, string>,
): Promise<string | null> {
  if (cache.has(filename)) {
    return cache.get(filename)!;
  }

  const buffer = await fetchInsecure(url);
  if (!buffer || buffer.length === 0) {
    console.warn(`   ⚠️  Empty or missing file: ${url}`);
    return null;
  }

  try {
    const asset = await client.assets.upload(type, Readable.from(buffer), {
      filename,
    });

    cache.set(filename, asset._id);
    return asset._id;
  } catch (err) {
    console.error(
      `   ✗ Failed to upload asset ${filename}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function ensureReviewSlug(
  rawSlug: string | undefined,
  fallbackTitle: string,
): string | null {
  let slugSource = cleanString(rawSlug);

  if (!slugSource) {
    const fallback = cleanString(fallbackTitle);
    if (!fallback) return null;
    slugSource = slugify(fallback, { lower: true, strict: true, trim: true });
  }

  let slug = slugSource;
  if (!slug.startsWith("/")) {
    slug = `/recenzje/${slug}`;
  }
  if (!slug.endsWith("/")) {
    slug = `${slug}/`;
  }
  return slug.toLowerCase();
}

async function fetchAuthorMap(
  client: SanityClient,
): Promise<Map<string, string>> {
  const docs = await client.fetch<Array<{ _id: string; name: string }>>(
    '*[_type == "reviewAuthor"]{_id, name}',
  );
  const map = new Map<string, string>();
  docs.forEach((doc) => {
    const slug = slugify(cleanString(doc.name), {
      lower: true,
      strict: true,
      trim: true,
    });
    map.set(slug, doc._id);
  });
  return map;
}

function resolveAuthorName(row: ReviewRow): string | undefined {
  const explicit = cleanString(row.AuthorName);
  if (explicit) {
    return explicit;
  }

  const title = cleanString(row.PageTitle) || cleanString(row.MenuTitle);
  if (!title) return undefined;

  const marker = " w ";
  const idx = title.lastIndexOf(marker);
  if (idx === -1) return undefined;

  let candidate = title.slice(idx + marker.length).trim();
  candidate = candidate
    .replace(/^[„"']+/, "")
    .replace(/[”"']+$/, "")
    .trim();

  return candidate || undefined;
}

function findAuthorReference(
  authorName: string | undefined,
  authorMap: Map<string, string>,
): { _type: "reference"; _ref: string } | undefined {
  if (!authorName) return undefined;
  const slug = slugify(cleanString(authorName), {
    lower: true,
    strict: true,
    trim: true,
  });
  const ref = authorMap.get(slug);
  if (!ref) {
    console.warn(
      `   ⚠️  Author "${authorName}" not found in Sanity (expected _id review-author-${slug})`,
    );
    return undefined;
  }
  return { _type: "reference", _ref: ref };
}

function getHtmlContent(html?: string | null): string | undefined {
  if (!html) return undefined;
  const trimmed = html.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === "null") return undefined;
  return replaceSiteTreeLinks(html);
}

function parseLegacySections(raw?: string): LegacySection[] {
  const value = cleanString(raw);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((section) => ({
          sort:
            typeof section.sort === "number"
              ? section.sort
              : parseInt(section.sort ?? "0", 10) || 0,
          type: cleanString(section.type) || "text",
          title: cleanString(section.title),
          content:
            typeof section.content === "string"
              ? section.content.replace(
                  SITE_TREE_LINK_REGEX,
                  (_match: string, id: string) => `/recenzje/${id}/`,
                )
              : "",
          publish:
            typeof section.publish === "number"
              ? section.publish
              : parseInt(section.publish ?? "1", 10) || 0,
        }))
        .filter((section) => section.publish !== 0);
    }
  } catch (error) {
    console.warn("   ⚠️  Could not parse page builder sections JSON:", error);
  }
  return [];
}

async function buildContentNodesFromSections(
  sections: LegacySection[],
  client: SanityClient | null,
  assetCache: Map<string, string>,
  dryRun: boolean,
): Promise<PortableTextNode[]> {
  if (sections.length === 0) return [];
  const nodes: PortableTextNode[] = [];
  const sortedSections = [...sections].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
  );

  for (const section of sortedSections) {
    const heading = cleanString(section.title);
    if (heading) {
      nodes.push({
        _type: "block",
        _key: `section-heading-${Math.random().toString(36).slice(2, 8)}`,
        style: "h2",
        markDefs: [],
        children: [
          {
            _type: "span",
            _key: `section-span-${Math.random().toString(36).slice(2, 8)}`,
            text: heading,
          },
        ],
      });
    }

    const html = getHtmlContent(section.content);
    if (html) {
      const sectionNodes = await buildContentNodesFromHtml(
        html,
        client,
        assetCache,
        dryRun,
      );
      nodes.push(...sectionNodes);
    }
  }

  return nodes;
}

function buildDescriptionText(
  row: ReviewRow,
  sections: LegacySection[],
): string {
  const html = getHtmlContent(row.Content);
  if (html) {
    return stripHtml(html).split(/\n+/).filter(Boolean).slice(0, 2).join(" ");
  }
  for (const section of sections) {
    const sectionHtml = getHtmlContent(section.content);
    if (sectionHtml) {
      return stripHtml(sectionHtml)
        .split(/\n+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");
    }
  }
  return "";
}

function truncateText(value: string, max = 130): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

type ContentToken =
  | { type: "text"; value: string }
  | { type: "image"; src: string };

function extractContentTokens(html?: string | null): ContentToken[] {
  if (!html) return [];
  const cleaned = html.replace(/&nbsp;/gi, " ").replace(/<hr\s*\/?>/gi, "");
  const regex =
    /(<img[^>]*src=["']([^"']+)["'][^>]*>)|(\[image[^\]]*src=["']([^"']+)["'][^\]]*\])/gi;
  const tokens: ContentToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      tokens.push({ type: "text", value: cleaned.slice(lastIndex, start) });
    }
    const src = match[2] || match[4];
    if (src) {
      tokens.push({ type: "image", src });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    tokens.push({ type: "text", value: cleaned.slice(lastIndex) });
  }

  return tokens;
}

function resolveImageSource(
  src: string,
): { url: string; filename: string } | null {
  if (!src) return null;
  let cleaned = src.replace(/&amp;/g, "&").trim();
  if (!cleaned) return null;

  if (!/^https?:\/\//i.test(cleaned)) {
    let relative = cleaned.replace(/^\/+/, "");
    if (relative.toLowerCase().startsWith("assets/")) {
      relative = relative.slice("assets/".length);
    }
    cleaned = `${LEGACY_ASSETS_BASE_URL}${relative}`;
  } else if (/audiofast\.pl\/assets\//i.test(cleaned)) {
    cleaned = cleaned.replace(
      /(https?:\/\/(www\.)?audiofast\.pl\/assets\/)/i,
      LEGACY_ASSETS_BASE_URL,
    );
  }

  let filename = cleaned.split("/").pop() || "";
  filename = filename.split("?")[0];
  if (!filename) return null;

  return { url: cleaned, filename };
}

async function buildContentNodesFromHtml(
  html: string | undefined,
  client: SanityClient | null,
  assetCache: Map<string, string>,
  dryRun: boolean,
): Promise<PortableTextNode[]> {
  if (!html) return [];

  const tokens = extractContentTokens(html);

  // If no images were found, fall back to simple text conversion
  if (tokens.length === 0) {
    return convertHtmlSnippetToBlocks(html);
  }

  const nodes: PortableTextNode[] = [];

  for (const token of tokens) {
    if (token.type === "text") {
      nodes.push(...convertHtmlSnippetToBlocks(token.value));
      continue;
    }

    const resolved = resolveImageSource(token.src);
    if (!resolved) {
      console.warn(
        `   ⚠️  Could not resolve inline image source "${token.src}"`,
      );
      continue;
    }

    let assetId: string | null;
    if (dryRun) {
      assetId = `image-dryrun-${slugify(resolved.filename, {
        lower: true,
        strict: true,
        trim: true,
      })}`;
    } else if (client) {
      assetId = await uploadAsset(
        client,
        "image",
        resolved.url,
        resolved.filename,
        assetCache,
      );
    } else {
      assetId = null;
    }

    if (!assetId) {
      console.warn(`   ⚠️  Failed to upload inline image ${resolved.filename}`);
      continue;
    }

    nodes.push({
      _type: "ptImage",
      _key: `ptimage-${Math.random().toString(36).slice(2, 8)}`,
      layout: "single",
      image: {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: assetId,
        },
      },
    });
  }

  return nodes;
}

function determineDestinationType(row: ReviewRow): "page" | "pdf" | "external" {
  const explicit = cleanString(row.ReviewType).toLowerCase();
  if (explicit === "external" || explicit === "pdf" || explicit === "page") {
    return explicit as "page" | "pdf" | "external";
  }

  if (cleanString(row.ExternalLink)) return "external";
  const pdfId = parseInt(cleanString(row.PDFFileID) || "0", 10);
  if (pdfId > 0) return "pdf";
  return "page";
}

async function buildReviewDocument(
  row: ReviewRow,
  client: SanityClient | null,
  authorMap: Map<string, string>,
  assetCache: Map<string, string>,
  dryRun: boolean,
): Promise<ReviewDocument | null> {
  const id = parseInt(row.ID, 10);
  if (!id) {
    console.warn("   ⚠️  Skipping row without numeric ID:", row.ID);
    return null;
  }

  const destinationType = determineDestinationType(row);
  const titleSource =
    cleanString(row.PageTitle) || cleanString(row.MenuTitle) || `Review ${id}`;
  const titleBlocks = createPortableTextFromString(titleSource, {
    style: "normal",
  });

  if (titleBlocks.length === 0) {
    console.warn(`   ⚠️  Review ${id} has no title, skipping`);
    return null;
  }

  const sections = parseLegacySections(row.PageSections);
  const contentHtml = getHtmlContent(row.Content);
  const contentNodes =
    destinationType === "page"
      ? sections.length > 0
        ? await buildContentNodesFromSections(
            sections,
            client,
            assetCache,
            dryRun,
          )
        : await buildContentNodesFromHtml(
            contentHtml,
            client,
            assetCache,
            dryRun,
          )
      : [];

  if (destinationType === "page" && contentNodes.length === 0) {
    console.warn(
      `   ⚠️  Review ${id} is a page but has empty content, skipping`,
    );
    return null;
  }

  const slug =
    destinationType === "page" ? ensureReviewSlug(row.Slug, titleSource) : null;
  if (destinationType === "page" && !slug) {
    console.warn(`   ⚠️  Review ${id} missing slug, skipping`);
    return null;
  }

  const authorName = resolveAuthorName(row);
  const authorRef = findAuthorReference(authorName, authorMap);
  if (!authorRef) {
    console.warn(
      `   ⚠️  Review ${id} has unknown author "${authorName || row.AuthorName}", skipping`,
    );
    return null;
  }

  let imageAssetId: string | null = null;
  const coverFilename = cleanString(row.CoverFilename);
  if (coverFilename) {
    const imageUrl = `${LEGACY_ASSETS_BASE_URL}${coverFilename}`;
    if (dryRun) {
      imageAssetId = `image-dryrun-${slugify(coverFilename, { lower: true, strict: true })}`;
    } else if (client) {
      imageAssetId = await uploadAsset(
        client,
        "image",
        imageUrl,
        coverFilename,
        assetCache,
      );
    }
  }

  if (!imageAssetId) {
    console.warn(`   ⚠️  Review ${id} has no cover image, skipping`);
    return null;
  }

  let pdfAssetId: string | null = null;
  const pdfFilename = cleanString(row.PDFFilename);
  if (destinationType === "pdf" && pdfFilename) {
    const pdfUrl = `${LEGACY_ASSETS_BASE_URL}${pdfFilename}`;
    if (dryRun) {
      pdfAssetId = `file-dryrun-${slugify(pdfFilename, { lower: true, strict: true })}`;
    } else if (client) {
      pdfAssetId = await uploadAsset(
        client,
        "file",
        pdfUrl,
        pdfFilename,
        assetCache,
      );
    }
    if (!pdfAssetId) {
      console.warn(
        `   ⚠️  Review ${id} PDF missing (filename: ${pdfFilename || row.PDFFilename}), skipping`,
      );
      return null;
    }
  }

  const descriptionText = buildDescriptionText(row, sections);
  const descriptionBlocks = descriptionText
    ? createPortableTextFromString(descriptionText)
    : [];

  const seoTitle = titleSource;
  const seoDescription = truncateText(descriptionText || titleSource, 130);

  const articleDate = cleanString(row.ArticleDate);
  const parsedDate = articleDate ? new Date(articleDate) : null;

  const externalLink = cleanString(row.ExternalLink);

  const document: ReviewDocument = {
    _id: `review-${id}`,
    _type: "review",
    destinationType,
    publishedDate:
      parsedDate && !Number.isNaN(parsedDate.valueOf())
        ? parsedDate.toISOString()
        : undefined,
    slug: slug ? { _type: "slug", current: slug } : undefined,
    author: authorRef,
    title: titleBlocks,
    description: descriptionBlocks,
    content: destinationType === "page" ? contentNodes : undefined,
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: imageAssetId },
    },
    pdfFile:
      destinationType === "pdf" && pdfAssetId
        ? {
            _type: "file",
            asset: { _type: "reference", _ref: pdfAssetId },
          }
        : undefined,
    externalUrl:
      destinationType === "external" && externalLink ? externalLink : undefined,
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
  };

  return document;
}

async function migrateReviews(
  rows: ReviewRow[],
  options: CliOptions,
): Promise<void> {
  const titleFilter = options.titleFilter
    ? options.titleFilter.trim().toLowerCase()
    : undefined;
  const authorFilter = options.authorFilter
    ? options.authorFilter.trim().toLowerCase()
    : undefined;

  const filtered = rows.filter((row) => {
    if (titleFilter) {
      const rowTitle = (
        cleanString(row.PageTitle) || cleanString(row.MenuTitle)
      ).toLowerCase();
      if (rowTitle !== titleFilter) {
        return false;
      }
    }
    if (authorFilter) {
      const authorName = resolveAuthorName(row);
      if (!authorName || authorName.toLowerCase() !== authorFilter) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    console.log("ℹ️  No reviews matched the provided filters.");
    return;
  }

  console.log(`Found ${filtered.length} review(s) to migrate.`);

  const client = options.dryRun
    ? null
    : createClient({
        projectId: process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID,
        dataset: process.env.SANITY_DATASET || DEFAULT_DATASET,
        apiVersion: "2024-01-01",
        token: process.env.SANITY_API_TOKEN,
        useCdn: false,
      });

  if (!options.dryRun && !process.env.SANITY_API_TOKEN) {
    throw new Error("SANITY_API_TOKEN env var is required for live migration.");
  }

  const authorMap = client ? await fetchAuthorMap(client) : new Map();
  const assetCache = new Map<string, string>();

  const preparedDocuments: ReviewDocument[] = [];

  for (const row of filtered) {
    const doc = await buildReviewDocument(
      row,
      client,
      authorMap,
      assetCache,
      options.dryRun,
    );
    if (doc) {
      preparedDocuments.push(doc);
    }
  }

  if (preparedDocuments.length === 0) {
    console.log("ℹ️  No valid review documents to migrate after validation.");
    return;
  }

  if (options.dryRun) {
    console.log("\n🧪 DRY RUN OUTPUT:");
    preparedDocuments.forEach((doc) => {
      console.log(`\n${doc._id}:`);
      console.log(JSON.stringify(doc, null, 2));
    });
    return;
  }

  console.log(
    `\n🚀 Migrating ${preparedDocuments.length} documents to Sanity in a single transaction...`,
  );
  const liveClient = client!;

  // Use transaction to batch all createOrReplace operations
  const transaction = liveClient.transaction();
  for (const doc of preparedDocuments) {
    transaction.createOrReplace(doc);
  }

  try {
    const result = await transaction.commit();
    console.log(
      `   ✓ Successfully migrated ${result.documentIds?.length ?? preparedDocuments.length} documents`,
    );
    preparedDocuments.forEach((doc) => console.log(`      - ${doc._id}`));
  } catch (error) {
    console.error(
      "   ❌ Transaction failed:",
      error instanceof Error ? error.message : error,
    );
    console.log("\n   Falling back to individual document migration...");

    // Fallback to individual calls if transaction fails
    for (const doc of preparedDocuments) {
      try {
        await liveClient.createOrReplace(doc);
        console.log(`   ✓ ${doc._id}`);
      } catch (err) {
        console.error(
          `   ❌ Failed to migrate ${doc._id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  console.log("\n✅ Review migration complete.");
}

async function main() {
  const options = parseArgs();

  console.log("");
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║            AUDIOFAST DATA MIGRATION                           ║",
  );
  console.log(
    "║            Reviews                                            ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");
  console.log(`CSV Path: ${resolve(process.cwd(), options.csvPath)}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  if (options.titleFilter) console.log(`Title Filter: ${options.titleFilter}`);
  if (options.authorFilter)
    console.log(`Author Filter: ${options.authorFilter}`);
  if (options.skip) console.log(`Skip: ${options.skip}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  console.log("");

  let rows = readCsvRows(options.csvPath);
  console.log(`Total CSV rows: ${rows.length}`);

  if (options.skip && options.skip > 0) {
    rows = rows.slice(options.skip);
    console.log(`Skipping first ${options.skip} rows`);
  }

  if (options.limit && options.limit > 0) {
    rows = rows.slice(0, options.limit);
    console.log(`Limiting to ${options.limit} rows`);
  }

  await migrateReviews(rows, options);
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
