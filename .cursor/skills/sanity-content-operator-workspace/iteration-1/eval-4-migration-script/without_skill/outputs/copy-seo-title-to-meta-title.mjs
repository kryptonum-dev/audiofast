#!/usr/bin/env bun
/**
 * One-off Sanity migration: copy seo.title into metaTitle for posts missing metaTitle.
 *
 * Dry run is the default. Add --execute to write mutations.
 *
 * Examples:
 *   bun .cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/copy-seo-title-to-meta-title.mjs
 *   bun .cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/copy-seo-title-to-meta-title.mjs --execute
 *
 * Reusable options:
 *   --type=blog-article
 *   --source-field=seo.title
 *   --target-field=metaTitle
 *   --batch-size=25
 *   --limit=1000
 *   --include-drafts
 *   --sample-out=mutation-sample.generated.json
 *   --env-file=apps/studio/.env.local
 */

import { createClient } from "@sanity/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_PROJECT_ID = "fsw3likv";
const DEFAULT_DATASET = "production";
const DEFAULT_API_VERSION = "2024-01-01";

const DEFAULT_ENV_FILES = [
  "apps/studio/.env.local",
  "apps/studio/.env",
  "apps/web/.env.local",
  "apps/web/.env",
  ".env.local",
  ".env",
];

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    documentType: "blog-article",
    sourceField: "seo.title",
    targetField: "metaTitle",
    apiVersion: undefined,
    batchSize: 25,
    limit: 10000,
    includeDrafts: false,
    execute: false,
    verbose: false,
    sampleOut: undefined,
    envFiles: [],
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--execute") options.execute = true;
    else if (arg === "--dry-run") options.execute = false;
    else if (arg === "--include-drafts") options.includeDrafts = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg.startsWith("--repo-root=")) {
      options.repoRoot = arg.replace("--repo-root=", "");
    } else if (arg.startsWith("--type=")) {
      options.documentType = arg.replace("--type=", "");
    } else if (arg.startsWith("--source-field=")) {
      options.sourceField = arg.replace("--source-field=", "");
    } else if (arg.startsWith("--target-field=")) {
      options.targetField = arg.replace("--target-field=", "");
    } else if (arg.startsWith("--api-version=")) {
      options.apiVersion = arg.replace("--api-version=", "");
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = parsePositiveInt(arg.replace("--batch-size=", ""), "batch-size");
    } else if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveInt(arg.replace("--limit=", ""), "limit");
    } else if (arg.startsWith("--sample-out=")) {
      options.sampleOut = arg.replace("--sample-out=", "");
    } else if (arg.startsWith("--env-file=")) {
      options.envFiles.push(arg.replace("--env-file=", ""));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  assertSafeFieldPath(options.sourceField, "source-field");
  assertSafeFieldPath(options.targetField, "target-field");
  return options;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function assertSafeFieldPath(fieldPath, name) {
  const valid = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(fieldPath);
  if (!valid) {
    throw new Error(`--${name} must be a simple Sanity field path like seo.title or metaTitle`);
  }
}

function printUsage() {
  console.log(`
Usage:
  bun copy-seo-title-to-meta-title.mjs [options]

Default behavior:
  Dry run only. Fetches blog-article documents where seo.title is present and metaTitle is missing.

Write behavior:
  Add --execute to commit mutations. SANITY_API_TOKEN or MIGRATION_TOKEN is required.

Env precedence:
  SANITY_PROJECT_ID, then SANITY_STUDIO_PROJECT_ID, then NEXT_PUBLIC_SANITY_PROJECT_ID
  SANITY_DATASET, then SANITY_STUDIO_DATASET, then NEXT_PUBLIC_SANITY_DATASET
  SANITY_API_TOKEN, then MIGRATION_TOKEN
`);
}

function loadEnvFiles(repoRoot, requestedEnvFiles) {
  const envFiles = requestedEnvFiles.length > 0 ? requestedEnvFiles : DEFAULT_ENV_FILES;

  for (const envFile of envFiles) {
    const path = resolve(repoRoot, envFile);
    if (!existsSync(path)) continue;

    const contents = readFileSync(path, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      process.env[key] = unquoteEnvValue(rawValue.trim());
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function getConfig(options) {
  const projectId =
    process.env.SANITY_PROJECT_ID ||
    process.env.SANITY_STUDIO_PROJECT_ID ||
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    DEFAULT_PROJECT_ID;

  const dataset =
    process.env.SANITY_DATASET ||
    process.env.SANITY_STUDIO_DATASET ||
    process.env.NEXT_PUBLIC_SANITY_DATASET ||
    DEFAULT_DATASET;

  const token = process.env.SANITY_API_TOKEN || process.env.MIGRATION_TOKEN;

  if (options.execute && !token) {
    throw new Error("SANITY_API_TOKEN or MIGRATION_TOKEN is required when --execute is used");
  }

  return {
    projectId,
    dataset,
    token,
    apiVersion:
      options.apiVersion ||
      process.env.SANITY_API_VERSION ||
      process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
      DEFAULT_API_VERSION,
  };
}

function createMigrationClient(config) {
  return createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion,
    token: config.token,
    useCdn: false,
  });
}

function buildFetchQuery(options) {
  const draftClause = options.includeDrafts ? "" : '&& !(_id in path("drafts.**"))';

  return `
    *[
      _type == $documentType
      ${draftClause}
      && defined(${options.sourceField})
      && ${options.sourceField} != ""
      && (!defined(${options.targetField}) || ${options.targetField} == "")
    ] | order(_updatedAt asc) [0...$limit] {
      _id,
      _type,
      _updatedAt,
      "sourceValue": ${options.sourceField},
      "targetValue": ${options.targetField},
      "label": coalesce(name, slug.current, _id)
    }
  `;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toMutation(doc, options) {
  return {
    patch: {
      id: doc._id,
      set: {
        [options.targetField]: doc.sourceValue,
      },
    },
  };
}

function writeSample(sampleOut, docs, options) {
  const sample =
    docs.length > 0
      ? docs.slice(0, 5).map((doc) => toMutation(doc, options))
      : [
          {
            patch: {
              id: "<blog-article-document-id>",
              set: {
                [options.targetField]: "<copied seo.title value>",
              },
            },
          },
        ];

  const payload = {
    note: "Sample only. Run the migration script with --execute to write real patches.",
    documentType: options.documentType,
    sourceField: options.sourceField,
    targetField: options.targetField,
    mutations: sample,
  };

  writeFileSync(resolve(options.repoRoot, sampleOut), `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFiles(options.repoRoot, options.envFiles);
  const config = getConfig(options);
  const client = createMigrationClient(config);

  console.log("Sanity migration: copy source field into missing target field");
  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Project: ${config.projectId}`);
  console.log(`Dataset: ${config.dataset}`);
  console.log(`Token present: ${Boolean(config.token)}`);
  console.log(`Document type: ${options.documentType}`);
  console.log(`Source field: ${options.sourceField}`);
  console.log(`Target field: ${options.targetField}`);
  console.log("");

  const docs = await client.fetch(buildFetchQuery(options), {
    documentType: options.documentType,
    limit: options.limit,
  });

  console.log(`Matched documents: ${docs.length}`);

  if (options.sampleOut) {
    writeSample(options.sampleOut, docs, options);
    console.log(`Wrote sample mutations to: ${options.sampleOut}`);
  }

  if (!options.execute) {
    for (const doc of docs.slice(0, 10)) {
      console.log(`[dry-run] ${doc._id}: set ${options.targetField} from ${options.sourceField}`);
      if (options.verbose) {
        console.log(`  label: ${doc.label}`);
        console.log(`  value: ${JSON.stringify(doc.sourceValue)}`);
      }
    }

    if (docs.length > 10) {
      console.log(`[dry-run] ...and ${docs.length - 10} more`);
    }

    console.log("");
    console.log("No mutations executed. Re-run with --execute to commit patches.");
    return;
  }

  let patched = 0;
  for (const batch of chunk(docs, options.batchSize)) {
    let transaction = client.transaction();
    for (const doc of batch) {
      transaction = transaction.patch(doc._id, (patch) =>
        patch.set({ [options.targetField]: doc.sourceValue }),
      );
    }

    await transaction.commit({ visibility: "async" });
    patched += batch.length;
    console.log(`Patched ${patched}/${docs.length}`);
  }

  console.log(`Done. Patched ${patched} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
