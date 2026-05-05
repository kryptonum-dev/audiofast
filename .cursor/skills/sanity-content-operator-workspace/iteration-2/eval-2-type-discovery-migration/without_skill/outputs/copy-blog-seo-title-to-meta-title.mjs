#!/usr/bin/env node

/**
 * Dry-run migration for Audiofast blog articles.
 *
 * Discovers candidates of the locally verified blog document type
 * ("blog-article") where seo.title exists and metaTitle is missing, then
 * writes a Sanity patch payload sample. This script never commits mutations.
 *
 * Usage:
 *   node copy-blog-seo-title-to-meta-title.mjs
 *   node copy-blog-seo-title-to-meta-title.mjs --limit=25 --out-dir=./outputs
 *   node copy-blog-seo-title-to-meta-title.mjs --include-drafts
 */

import { createClient } from "@sanity/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const BLOG_DOCUMENT_TYPE = "blog-article";
const DEFAULT_API_VERSION = "2025-02-10";
const DEFAULT_OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ENV_FILES = [
  "apps/studio/.env",
  "apps/web/.env.local",
  ".env.local",
  ".env",
];

function parseArgs(argv) {
  const options = {
    limit: 100,
    outDir: DEFAULT_OUTPUT_DIR,
    includeDrafts: false,
  };

  for (const arg of argv) {
    if (arg === "--include-drafts") {
      options.includeDrafts = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--limit must be a positive integer");
      }
      options.limit = value;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      options.outDir = path.resolve(arg.slice("--out-dir=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

function loadLocalEnv() {
  for (const envFile of ENV_FILES) {
    loadEnvFile(path.resolve(process.cwd(), envFile));
  }
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function createSanityClient() {
  const projectId = firstEnv(
    "SANITY_PROJECT_ID",
    "SANITY_STUDIO_PROJECT_ID",
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
  );
  const dataset =
    firstEnv(
      "SANITY_DATASET",
      "SANITY_STUDIO_DATASET",
      "NEXT_PUBLIC_SANITY_DATASET",
    ) || "production";
  const apiVersion =
    firstEnv("SANITY_API_VERSION", "NEXT_PUBLIC_SANITY_API_VERSION") ||
    DEFAULT_API_VERSION;
  const token = firstEnv(
    "SANITY_READ_TOKEN",
    "SANITY_API_READ_TOKEN",
    "NEXT_PUBLIC_SANITY_API_READ_TOKEN",
    "SANITY_API_TOKEN",
    "MIGRATION_TOKEN",
  );

  if (!projectId) {
    throw new Error("Missing Sanity project ID env var");
  }

  return {
    client: createClient({
      projectId,
      dataset,
      apiVersion,
      token,
      useCdn: false,
      perspective: "raw",
    }),
    config: {
      projectId,
      dataset,
      apiVersion,
      tokenPresent: Boolean(token),
    },
  };
}

function candidateQuery(includeDrafts) {
  const draftFilter = includeDrafts ? "" : ' && !(_id in path("drafts.**"))';

  return `*[
  _type == $blogType
  && defined(seo.title)
  && !defined(metaTitle)${draftFilter}
] | order(_updatedAt desc) [0...$limit]{
  _id,
  _type,
  _rev,
  _updatedAt,
  name,
  "slug": slug.current,
  "seoTitle": seo.title,
  "hasMetaTitle": defined(metaTitle)
}`;
}

const typeDiscoveryQuery = `{
  "schemaEvidence": "apps/studio/schemaTypes/documents/collections/blog-article.ts defines name: blog-article",
  "blogArticleCount": count(*[_type == "blog-article" && defined(slug.current)]),
  "legacyPostCount": count(*[_type == "post" && defined(slug.current)]),
  "blogSingletonCount": count(*[_type == "blog"])
}`;

function toPatch(doc) {
  return {
    patch: {
      id: doc._id,
      setIfMissing: {
        metaTitle: doc.seoTitle,
      },
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadLocalEnv();

  const { client, config } = createSanityClient();
  mkdirSync(options.outDir, { recursive: true });

  const [typeDiscovery, candidates] = await Promise.all([
    client.fetch(typeDiscoveryQuery),
    client.fetch(candidateQuery(options.includeDrafts), {
      blogType: BLOG_DOCUMENT_TYPE,
      limit: options.limit,
    }),
  ]);

  const mutationSample = {
    dryRun: true,
    mutationExecuted: false,
    documentType: BLOG_DOCUMENT_TYPE,
    candidateCount: candidates.length,
    patches: candidates.map(toPatch),
  };

  writeFileSync(
    path.join(options.outDir, "type-discovery.query.groq"),
    `${typeDiscoveryQuery}\n`,
  );
  writeFileSync(
    path.join(options.outDir, "migration-candidates.query.groq"),
    `${candidateQuery(options.includeDrafts)}\n`,
  );
  writeFileSync(
    path.join(options.outDir, "type-discovery-result.json"),
    `${JSON.stringify(typeDiscovery, null, 2)}\n`,
  );
  writeFileSync(
    path.join(options.outDir, "migration-candidates.json"),
    `${JSON.stringify(candidates, null, 2)}\n`,
  );
  writeFileSync(
    path.join(options.outDir, "mutation-sample.json"),
    `${JSON.stringify(mutationSample, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        mutationExecuted: false,
        documentType: BLOG_DOCUMENT_TYPE,
        candidateCount: candidates.length,
        outputDir: options.outDir,
        config: {
          projectId: config.projectId,
          dataset: config.dataset,
          apiVersion: config.apiVersion,
          tokenPresent: config.tokenPresent,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
