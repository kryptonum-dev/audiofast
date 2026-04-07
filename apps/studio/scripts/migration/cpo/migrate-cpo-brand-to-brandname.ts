/**
 * One-time migration: copy brand from legacy reference / otherBrandName / denorm
 * into `brandName` (string) and remove obsolete fields.
 *
 *   SANITY_API_TOKEN or MIGRATION_TOKEN — write access
 *   SANITY_PROJECT_ID (default fsw3likv), SANITY_DATASET (default production)
 *
 *   bun run scripts/migration/cpo/migrate-cpo-brand-to-brandname.ts
 *   bun run scripts/migration/cpo/migrate-cpo-brand-to-brandname.ts --dry-run
 */

import { createClient, type SanityClient } from "@sanity/client";

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? "fsw3likv";
const DATASET = process.env.SANITY_DATASET ?? "production";
const API_VERSION = "2025-02-10";

const DRY_RUN = process.argv.includes("--dry-run");

type CpoRow = {
  _id: string;
  brandName: string | null;
  brand: { _ref: string; _type: "reference" } | null;
  brandDoc: { name: string } | null;
  otherBrandName: string | null;
  brandType: string | null;
  denormBrandName: string | null;
  denormBrandSlug: string | null;
};

function token(): string {
  const t =
    process.env.SANITY_API_TOKEN ||
    process.env.MIGRATION_TOKEN ||
    "";
  if (!t) {
    throw new Error(
      "Set SANITY_API_TOKEN or MIGRATION_TOKEN for write access.",
    );
  }
  return t;
}

function resolveBrandName(doc: CpoRow): string {
  if (typeof doc.brandName === "string" && doc.brandName.trim() !== "") {
    return doc.brandName.trim();
  }
  if (doc.brandDoc?.name) return String(doc.brandDoc.name).trim();
  if (doc.otherBrandName) return String(doc.otherBrandName).trim();
  if (doc.denormBrandName) return String(doc.denormBrandName).trim();
  return "";
}

function legacyUnsetPaths(doc: CpoRow): string[] {
  const paths: string[] = [];
  if (doc.brand != null) paths.push("brand");
  if (doc.brandType != null) paths.push("brandType");
  if (doc.otherBrandName != null) paths.push("otherBrandName");
  if (doc.denormBrandName != null) paths.push("denormBrandName");
  if (doc.denormBrandSlug != null) paths.push("denormBrandSlug");
  return paths;
}

async function main() {
  const client: SanityClient = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token: token(),
    useCdn: false,
  });

  const q = `*[_type == "cpoProduct"] | order(_id asc) {
    _id,
    brandName,
    brand,
    "brandDoc": brand->{ name },
    otherBrandName,
    brandType,
    denormBrandName,
    denormBrandSlug
  }`;

  const docs = await client.fetch<CpoRow[]>(q);

  for (const doc of docs) {
    const resolved = resolveBrandName(doc);
    if (!resolved) {
      console.error(`❌ Skip ${doc._id}: could not resolve brand name`);
      continue;
    }

    const unset = legacyUnsetPaths(doc);
    const nameMismatch =
      typeof doc.brandName !== "string" ||
      doc.brandName.trim() === "" ||
      doc.brandName.trim() !== resolved;

    if (!nameMismatch && unset.length === 0) {
      console.log(`⏭  ${doc._id} already clean`);
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${doc._id} → brandName="${resolved}" unset=[${unset.join(", ")}]`,
      );
      continue;
    }

    let patch = client.patch(doc._id).set({ brandName: resolved });
    if (unset.length > 0) {
      patch = patch.unset(unset);
    }
    await patch.commit({ visibility: "sync" });
    console.log(`✓ ${doc._id} → "${resolved}"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
