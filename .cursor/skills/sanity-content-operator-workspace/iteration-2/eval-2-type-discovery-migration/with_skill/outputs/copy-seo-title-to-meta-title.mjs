#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import process from "node:process";

import {
  authHeaders,
  loadSanityEnv,
  parseArgs,
  printJson,
  queryUrl,
  redact,
  requireConfig,
} from "../../../../../sanity-content-operator/scripts/sanity-common.mjs";

const TARGET_TYPE = "blog-article";
const DEFAULT_LIMIT = 0;

const args = parseArgs(process.argv.slice(2));

if (args.execute) {
  process.stderr.write(
    "This migration is dry-run only. No --execute mode is implemented.\n",
  );
  process.exit(2);
}

const includeDrafts = Boolean(args.includeDrafts);
const limit = parsePositiveInt(args.limit, DEFAULT_LIMIT);
const config = loadSanityEnv(args);

try {
  requireConfig(config);

  const discovery = await discoverBlogType(config);
  const selector = [
    `_type == $type`,
    includeDrafts ? null : `!(_id in path("drafts.**"))`,
    `defined(seo.title)`,
    `!defined(metaTitle)`,
  ]
    .filter(Boolean)
    .join(" && ");
  const range = limit > 0 ? `[0...${limit}]` : "";
  const query = `*[${selector}] | order(_updatedAt desc) ${range}{
    _id,
    _rev,
    _type,
    name,
    "slug": slug.current,
    "seoTitle": seo.title
  }`;

  const documents = await sanityQuery(config, query, { type: TARGET_TYPE });
  const mutations = documents.map((doc) => ({
    patch: {
      id: doc._id,
      ifRevisionID: doc._rev,
      setIfMissing: {
        metaTitle: doc.seoTitle,
      },
    },
  }));

  const payload = { mutations };
  const result = {
    dryRun: true,
    message: "No mutations were submitted.",
    targetType: TARGET_TYPE,
    includeDrafts,
    limitApplied: limit > 0 ? limit : null,
    env: {
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: config.apiVersion,
      tokenPresent: Boolean(config.token),
      loadedEnvFiles: config.loadedFiles,
      sources: config.sources,
    },
    discovery,
    matchedDocumentCount: documents.length,
    sampleDocuments: documents.slice(0, 5),
    mutationPayload: payload,
  };

  if (args.mutationFile) {
    const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), args.mutationFile);
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    result.mutationFile = outputPath;
  }

  printJson(result);
} catch (error) {
  process.stderr.write(`${redact(error.message)}\n`);
  process.exit(1);
}

async function discoverBlogType(config) {
  const [uniqueTypes, candidateCounts, sample] = await Promise.all([
    sanityQuery(config, `array::unique(*[]._type) | order(@ asc)`),
    sanityQuery(
      config,
      `{
        "blogArticle": count(*[_type == "blog-article"]),
        "blogSingleton": count(*[_type == "blog"]),
        "post": count(*[_type == "post"])
      }`,
    ),
    sanityQuery(
      config,
      `*[_type == "blog-article"][0..2]{
        _id,
        _type,
        name,
        "slug": slug.current,
        "seoTitle": seo.title,
        "hasMetaTitle": defined(metaTitle)
      }`,
    ),
  ]);

  return {
    selectedType: TARGET_TYPE,
    evidence: [
      "Local Studio schema defines document type name \"blog-article\" in apps/studio/schemaTypes/documents/collections/blog-article.ts.",
      "Local web GROQ queries use _type == \"blog-article\" for blog routes and listings.",
      "Dataset candidate counts show blogArticle documents exist while post has zero documents.",
    ],
    uniqueTypes,
    candidateCounts,
    sample,
  };
}

async function sanityQuery(config, query, params = {}) {
  const response = await fetch(queryUrl(config, query, params), {
    headers: authHeaders(config),
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok) {
    throw new Error(`Sanity query failed (${response.status}): ${redact(JSON.stringify(body))}`);
  }

  return body.result;
}

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
