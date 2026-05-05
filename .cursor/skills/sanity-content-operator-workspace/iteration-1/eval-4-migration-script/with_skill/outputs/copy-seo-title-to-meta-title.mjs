#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const ENV_FILES = [".env", ".env.development", ".env.development.local", ".env.local"];
const ENV_ALIASES = {
  projectId: [
    "SANITY_PROJECT_ID",
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
    "PUBLIC_SANITY_PROJECT_ID",
    "VITE_SANITY_PROJECT_ID",
    "SANITY_STUDIO_PROJECT_ID",
  ],
  dataset: [
    "SANITY_DATASET",
    "NEXT_PUBLIC_SANITY_DATASET",
    "PUBLIC_SANITY_DATASET",
    "VITE_SANITY_DATASET",
    "SANITY_STUDIO_DATASET",
  ],
  apiVersion: [
    "SANITY_API_VERSION",
    "NEXT_PUBLIC_SANITY_API_VERSION",
    "PUBLIC_SANITY_API_VERSION",
    "VITE_SANITY_API_VERSION",
    "SANITY_CLI_QUERY_API_VERSION",
  ],
  token: [
    "SANITY_AUTH_TOKEN",
    "SANITY_API_TOKEN",
    "SANITY_API_WRITE_TOKEN",
    "SANITY_WRITE_TOKEN",
    "SANITY_SECRET_TOKEN",
    "SANITY_API_READ_TOKEN",
    "SANITY_READ_TOKEN",
  ],
};

const DEFAULTS = {
  documentType: "post",
  sourceField: "seo.title",
  targetField: "metaTitle",
  apiVersion: "v2025-02-10",
  batchSize: 100,
  mutationFile: "copy-seo-title-to-meta-title.mutations.json",
};

const USAGE = `
Copy one Sanity field into another for documents missing the target field.

Default migration:
  node copy-seo-title-to-meta-title.mjs --env-file apps/web/.env.local

Execute writes explicitly:
  node copy-seo-title-to-meta-title.mjs --env-file apps/web/.env.local --execute

Reusable examples:
  node copy-seo-title-to-meta-title.mjs --document-type blog-article --source-field seo.title --target-field metaTitle
  node copy-seo-title-to-meta-title.mjs --limit 25 --mutation-file ./migration-preview.json

Options:
  --env-file <path>          Load repo env values from a specific file.
  --project-id <id>          Override SANITY project id.
  --dataset <name>           Override SANITY dataset.
  --api-version <version>    Override API version.
  --token <token>            Override token. Prefer env vars instead of this flag.
  --document-type <type>     Document type to migrate. Default: post.
  --source-field <path>      Field to copy from. Default: seo.title.
  --target-field <path>      Field to copy into. Default: metaTitle.
  --limit <count>            Limit matched documents for preview/testing.
  --batch-size <count>       Mutation batch size for execute mode. Default: 100.
  --mutation-file <path>     Where to write the dry-run mutation payload.
  --execute                  Submit mutations. Without this flag, this is a dry run.
  --help                     Show this help.
`;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const options = normalizeOptions(args);
const config = loadSanityEnv(options);

validateConfig(config, { requireToken: options.execute });
validateFieldPath(options.sourceField, "source-field");
validateFieldPath(options.targetField, "target-field");

const targetDocuments = await fetchTargetDocuments(config, options);
const mutations = targetDocuments.map((document) => ({
  patch: {
    id: document._id,
    ifRevisionID: document._rev,
    set: {
      [options.targetField]: document.sourceValue,
    },
  },
}));

const preview = {
  dryRun: !options.execute,
  documentType: options.documentType,
  sourceField: options.sourceField,
  targetField: options.targetField,
  projectId: config.projectId,
  dataset: config.dataset,
  apiVersion: config.apiVersion,
  tokenPresent: Boolean(config.token),
  matchedCount: targetDocuments.length,
  sampleDocuments: targetDocuments.slice(0, 10).map((document) => ({
    _id: document._id,
    _rev: document._rev,
    sourceValue: document.sourceValue,
    currentTargetValue: document.targetValue ?? null,
  })),
  mutationCount: mutations.length,
};

writeJsonFile(options.mutationFile, { mutations });

if (!options.execute) {
  printJson({
    ...preview,
    mutationFile: resolve(options.mutationFile),
    message: "Dry run only. Re-run with --execute to submit these mutations.",
  });
  process.exit(0);
}

const results = [];
for (const batch of chunk(mutations, options.batchSize)) {
  results.push(await submitMutationBatch(config, batch));
}

printJson({
  ...preview,
  mutationFile: resolve(options.mutationFile),
  executed: true,
  batchCount: results.length,
  resultIds: results.flatMap((result) => result.results?.map((item) => item.id) ?? []),
});

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

    if (inlineValue !== undefined && inlineValue !== "") {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function normalizeOptions(rawArgs) {
  return {
    envFile: rawArgs.envFile ? resolve(String(rawArgs.envFile)) : undefined,
    projectId: rawArgs.projectId,
    dataset: rawArgs.dataset,
    apiVersion: rawArgs.apiVersion,
    token: rawArgs.token,
    documentType: String(rawArgs.documentType || DEFAULTS.documentType),
    sourceField: String(rawArgs.sourceField || DEFAULTS.sourceField),
    targetField: String(rawArgs.targetField || DEFAULTS.targetField),
    limit: rawArgs.limit ? Number(rawArgs.limit) : undefined,
    batchSize: rawArgs.batchSize ? Number(rawArgs.batchSize) : DEFAULTS.batchSize,
    mutationFile: String(rawArgs.mutationFile || DEFAULTS.mutationFile),
    execute: Boolean(rawArgs.execute),
  };
}

function loadSanityEnv(options) {
  const fileEnv = {};
  for (const filePath of options.envFile ? [options.envFile] : findNearbyEnvFiles(process.cwd())) {
    if (existsSync(filePath)) {
      Object.assign(fileEnv, parseEnvFile(filePath));
    }
  }

  const env = { ...fileEnv, ...process.env };

  return {
    projectId: options.projectId || getEnvValue(env, ENV_ALIASES.projectId),
    dataset: options.dataset || getEnvValue(env, ENV_ALIASES.dataset),
    apiVersion: normalizeApiVersion(options.apiVersion || getEnvValue(env, ENV_ALIASES.apiVersion) || DEFAULTS.apiVersion),
    token: options.token || getEnvValue(env, ENV_ALIASES.token),
  };
}

function findNearbyEnvFiles(startDir) {
  const directories = [];
  let current = resolve(startDir);

  for (let depth = 0; depth < 4; depth += 1) {
    directories.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return directories.flatMap((directory) => ENV_FILES.map((fileName) => resolve(directory, fileName)));
}

function parseEnvFile(filePath) {
  const parsed = {};
  const body = readFileSync(filePath, "utf8");

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    parsed[match[1]] = stripQuotes(match[2].trim());
  }

  return parsed;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function getEnvValue(env, names) {
  for (const name of names) {
    if (env[name]) return env[name];
  }

  return undefined;
}

function normalizeApiVersion(apiVersion) {
  if (!apiVersion) return undefined;
  return String(apiVersion).startsWith("v") ? String(apiVersion) : `v${apiVersion}`;
}

function validateConfig(config, { requireToken }) {
  const missing = [];
  if (!config.projectId) missing.push("SANITY_PROJECT_ID");
  if (!config.dataset) missing.push("SANITY_DATASET");
  if (!config.apiVersion) missing.push("SANITY_API_VERSION");
  if (requireToken && !config.token) missing.push("SANITY_AUTH_TOKEN");

  if (missing.length > 0) {
    throw new Error(`Missing required Sanity configuration: ${missing.join(", ")}`);
  }
}

function validateFieldPath(path, label) {
  const validPath = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
  if (!validPath.test(path)) {
    throw new Error(`Invalid ${label}: "${path}". Use a simple dotted field path, for example "seo.title".`);
  }
}

async function fetchTargetDocuments(config, options) {
  const query = `*[
    _type == $documentType &&
    defined(${options.sourceField}) &&
    ${options.sourceField} != "" &&
    (!defined(${options.targetField}) || ${options.targetField} == "")
  ] | order(_id asc)${options.limit ? `[0...${options.limit}]` : ""} {
    _id,
    _rev,
    "sourceValue": ${options.sourceField},
    "targetValue": ${options.targetField}
  }`;

  const url = new URL(`https://${config.projectId}.api.sanity.io/${config.apiVersion}/data/query/${config.dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("$documentType", JSON.stringify(options.documentType));

  const response = await fetch(url, {
    headers: authHeaders(config),
  });

  if (!response.ok) {
    throw new Error(redact(`Sanity query failed (${response.status}): ${await response.text()}`));
  }

  const body = await response.json();
  return body.result || [];
}

async function submitMutationBatch(config, mutations) {
  const url = new URL(`https://${config.projectId}.api.sanity.io/${config.apiVersion}/data/mutate/${config.dataset}`);
  url.searchParams.set("returnIds", "true");
  url.searchParams.set("returnDocuments", "false");
  url.searchParams.set("visibility", "sync");

  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({ mutations }),
  });

  if (!response.ok) {
    throw new Error(redact(`Sanity mutation failed (${response.status}): ${await response.text()}`));
  }

  return response.json();
}

function authHeaders(config) {
  const headers = { "content-type": "application/json" };
  if (config.token) {
    headers.authorization = `Bearer ${config.token}`;
  }

  return headers;
}

function writeJsonFile(filePath, value) {
  const resolvedPath = resolve(filePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function redact(value) {
  return String(value)
    .replace(/Bearer\s+[-._~+/=A-Za-z0-9]+/g, "Bearer [REDACTED]")
    .replace(/("token"\s*:\s*")([^"]+)(")/g, "$1[REDACTED]$3");
}
