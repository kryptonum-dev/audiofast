#!/usr/bin/env bun
/**
 * Migration Script: Legacy blog articles CSV → Sanity `blog-article` documents
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/blog/migrate-blog-articles.ts --csv=/path/to/articles.csv
 *
 * Add --dry-run to preview payloads without touching Sanity.
 */

import { readFileSync } from "node:fs";
import * as https from "node:https";
import { resolve } from "node:path";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";
import slugify from "slugify";

type CliOptions = {
  csvPath: string;
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  skip?: number;
};

type ArticleRow = {
  BlogPageID: string;
  Slug: string;
  PageTitle: string;
  NavTitle?: string;
  PublishDate: string;
  Description?: string;
  LeadingImageID?: string;
  ImageFilename?: string;
  PageContent?: string;
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

type BlogArticleDocument = {
  _id: string;
  _type: "blog-article";
  name: string;
  slug: { _type: "slug"; current: string };
  title: PortableTextBlock[];
  description?: PortableTextBlock[];
  publishedDate?: string;
  image?: {
    _type: "image";
    asset: { _type: "reference"; _ref: string };
  };
  content: PortableTextBlock[];
  category: { _type: "reference"; _ref: string };
  author: { _type: "reference"; _ref: string };
  seo?: {
    title: string;
    description: string;
  };
};

const DEFAULT_CSV_PATH = "/Users/oliwiersellig/Desktop/articles.csv";
const DEFAULT_PROJECT_ID = "fsw3likv";
const DEFAULT_DATASET = "production";
const LEGACY_ASSETS_BASE_URL = "https://www.audiofast.pl/assets/";

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const csvArg = args.find((arg) => arg.startsWith("--csv="));
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const skipArg = args.find((arg) => arg.startsWith("--skip="));

  return {
    csvPath: csvArg ? csvArg.replace("--csv=", "") : DEFAULT_CSV_PATH,
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    limit: limitArg
      ? parseInt(limitArg.replace("--limit=", ""), 10)
      : undefined,
    skip: skipArg ? parseInt(skipArg.replace("--skip=", ""), 10) : undefined,
  };
}

function readCsvRows(csvPath: string): ArticleRow[] {
  const resolved = resolve(process.cwd(), csvPath);
  const file = readFileSync(resolved, "utf-8");
  return parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ArticleRow[];
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

async function uploadAsset(
  client: SanityClient,
  type: "image" | "file",
  url: string,
  filename: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const cacheKey = `${type}:${url}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  console.log(`   📤 Uploading ${type}: ${filename}`);

  try {
    // Use https.get with insecure agent to bypass SSL verification
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : require("http");
      const request = protocol.get(
        url,
        { agent: insecureAgent },
        (response: any) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`,
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        },
      );
      request.on("error", reject);
    });

    const stream = Readable.from(buffer);

    const asset = await client.assets.upload(type, stream, {
      filename,
    });

    cache.set(cacheKey, asset._id);
    console.log(`   ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (err) {
    console.error(
      `   ✗ Failed to upload asset ${filename}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function ensureBlogSlug(
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
    slug = `/blog/${slug}`;
  } else if (!slug.startsWith("/blog/")) {
    slug = `/blog${slug}`;
  }
  if (!slug.endsWith("/")) {
    slug = `${slug}/`;
  }
  return slug.toLowerCase();
}

async function fetchBlogCategories(
  client: SanityClient,
): Promise<Map<string, string>> {
  const docs = await client.fetch<Array<{ _id: string; name: string }>>(
    '*[_type == "blog-category"]{_id, name}',
  );
  const map = new Map<string, string>();
  docs.forEach((doc) => {
    map.set(doc.name.toLowerCase(), doc._id);
  });
  console.log(
    `   📚 Found ${docs.length} blog categories:`,
    docs.map((d) => d.name).join(", "),
  );
  return map;
}

async function fetchTeamMembers(
  client: SanityClient,
): Promise<Map<string, string>> {
  const docs = await client.fetch<Array<{ _id: string; name: string }>>(
    '*[_type == "teamMember"]{_id, name}',
  );
  const map = new Map<string, string>();
  docs.forEach((doc) => {
    map.set(doc.name.toLowerCase(), doc._id);
  });
  console.log(
    `   👥 Found ${docs.length} team members:`,
    docs.map((d) => d.name).join(", "),
  );
  return map;
}

async function ensureDefaultCategory(
  client: SanityClient | null,
  dryRun: boolean,
): Promise<string> {
  const defaultCategoryId = "blog-category-general";
  const defaultCategoryName = "Ogólne";

  if (dryRun) {
    return defaultCategoryId;
  }

  if (!client) {
    return defaultCategoryId;
  }

  // Check if category exists
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "blog-category" && _id == $id][0]{_id}`,
    { id: defaultCategoryId },
  );

  if (existing) {
    console.log(
      `   ✓ Default category "${defaultCategoryName}" already exists`,
    );
    return defaultCategoryId;
  }

  // Create default category
  console.log(`   📝 Creating default blog category: ${defaultCategoryName}`);
  await client.createOrReplace({
    _id: defaultCategoryId,
    _type: "blog-category",
    name: defaultCategoryName,
  });

  return defaultCategoryId;
}

async function ensureDefaultAuthor(
  client: SanityClient | null,
  dryRun: boolean,
): Promise<string> {
  const defaultAuthorId = "team-member-audiofast";
  const defaultAuthorName = "Audiofast";

  if (dryRun) {
    return defaultAuthorId;
  }

  if (!client) {
    return defaultAuthorId;
  }

  // Check if author exists
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "teamMember" && _id == $id][0]{_id}`,
    { id: defaultAuthorId },
  );

  if (existing) {
    console.log(`   ✓ Default author "${defaultAuthorName}" already exists`);
    return defaultAuthorId;
  }

  // Check if any team member exists
  const anyMember = await client.fetch<{ _id: string; name: string } | null>(
    `*[_type == "teamMember"][0]{_id, name}`,
  );

  if (anyMember) {
    console.log(
      `   ✓ Using existing team member as default author: ${anyMember.name}`,
    );
    return anyMember._id;
  }

  // Create default author
  console.log(`   📝 Creating default team member: ${defaultAuthorName}`);
  await client.createOrReplace({
    _id: defaultAuthorId,
    _type: "teamMember",
    name: defaultAuthorName,
    position: "Zespół Audiofast",
  });

  return defaultAuthorId;
}

function truncateText(value: string, max = 130): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

async function buildBlogArticleDocument(
  row: ArticleRow,
  client: SanityClient | null,
  defaultCategoryId: string,
  defaultAuthorId: string,
  assetCache: Map<string, string>,
  dryRun: boolean,
): Promise<BlogArticleDocument | null> {
  const id = parseInt(row.BlogPageID, 10);
  if (!id) {
    console.warn("   ⚠️  Skipping row without numeric ID:", row.BlogPageID);
    return null;
  }

  const titleSource = cleanString(row.PageTitle);
  if (!titleSource) {
    console.warn(`   ⚠️  Article ${id} has no title, skipping`);
    return null;
  }

  const titleBlocks = createPortableTextFromString(titleSource, {
    style: "normal",
  });
  if (titleBlocks.length === 0) {
    console.warn(
      `   ⚠️  Article ${id} could not create title blocks, skipping`,
    );
    return null;
  }

  const slug = ensureBlogSlug(row.Slug, titleSource);
  if (!slug) {
    console.warn(`   ⚠️  Article ${id} missing slug, skipping`);
    return null;
  }

  // Handle description
  const descriptionText = cleanString(row.Description);
  const descriptionBlocks = descriptionText
    ? createPortableTextFromString(descriptionText)
    : createPortableTextFromString("Brak opisu");

  // Handle image
  let imageAssetId: string | null = null;
  const imageFilename = cleanString(row.ImageFilename);
  const imageId = cleanString(row.LeadingImageID);

  if (imageFilename && imageId !== "0") {
    const imageUrl = `${LEGACY_ASSETS_BASE_URL}${imageFilename}`;
    if (dryRun) {
      imageAssetId = `image-dryrun-${slugify(imageFilename, { lower: true, strict: true })}`;
    } else if (client) {
      imageAssetId = await uploadAsset(
        client,
        "image",
        imageUrl,
        imageFilename,
        assetCache,
      );
    }
  }

  // Handle publish date
  const articleDate = cleanString(row.PublishDate);
  const parsedDate = articleDate ? new Date(articleDate) : null;

  // Create dummy content for now
  const contentBlocks = createPortableTextFromString(
    "Treść artykułu w przygotowaniu.",
    { style: "normal" },
  );

  // SEO
  const seoTitle = titleSource;
  const seoDescription = truncateText(descriptionText || titleSource, 130);

  const document: BlogArticleDocument = {
    _id: `blog-article-${id}`,
    _type: "blog-article",
    name: titleSource,
    slug: { _type: "slug", current: slug },
    title: titleBlocks,
    description: descriptionBlocks,
    publishedDate:
      parsedDate && !Number.isNaN(parsedDate.valueOf())
        ? parsedDate.toISOString()
        : undefined,
    content: contentBlocks,
    category: { _type: "reference", _ref: defaultCategoryId },
    author: { _type: "reference", _ref: defaultAuthorId },
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
  };

  // Only add image if we have one
  if (imageAssetId) {
    document.image = {
      _type: "image",
      asset: { _type: "reference", _ref: imageAssetId },
    };
  }

  return document;
}

async function migrateBlogArticles(
  rows: ArticleRow[],
  options: CliOptions,
): Promise<void> {
  if (rows.length === 0) {
    console.log("ℹ️  No articles to migrate.");
    return;
  }

  console.log(`Found ${rows.length} article(s) to migrate.`);

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

  // Ensure default category and author exist
  const defaultCategoryId = await ensureDefaultCategory(client, options.dryRun);
  const defaultAuthorId = await ensureDefaultAuthor(client, options.dryRun);

  console.log(`   Using category: ${defaultCategoryId}`);
  console.log(`   Using author: ${defaultAuthorId}`);

  const assetCache = new Map<string, string>();
  const preparedDocuments: BlogArticleDocument[] = [];

  for (const row of rows) {
    console.log(
      `\n📝 Processing: ${cleanString(row.PageTitle) || row.BlogPageID}`,
    );
    const doc = await buildBlogArticleDocument(
      row,
      client,
      defaultCategoryId,
      defaultAuthorId,
      assetCache,
      options.dryRun,
    );
    if (doc) {
      preparedDocuments.push(doc);
      console.log(`   ✓ Prepared document: ${doc._id}`);
    }
  }

  if (preparedDocuments.length === 0) {
    console.log(
      "\nℹ️  No valid blog article documents to migrate after validation.",
    );
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

  console.log("\n✅ Blog article migration complete.");
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
    "║            Blog Articles                                      ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.log("");
  console.log(`CSV Path: ${resolve(process.cwd(), options.csvPath)}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
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

  await migrateBlogArticles(rows, options);
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
