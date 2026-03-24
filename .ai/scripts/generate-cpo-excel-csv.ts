/**
 * One-off / repeatable: export current Sanity CPO products to a CSV matching
 * the CPO sheet layout (SyncCpoToSupabase.ts + cpo-phase-2 plan).
 *
 *   bun --env-file=apps/web/.env.local run .ai/scripts/generate-cpo-excel-csv.ts
 */

import { createClient } from "@sanity/client";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../cpo-arkusz-CPO-szablon.csv");

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? "fsw3likv",
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: "2025-02-10",
  token:
    process.env.MIGRATION_TOKEN ||
    process.env.SANITY_API_TOKEN ||
    process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN ||
    "",
  useCdn: false,
});

type PtBlock = {
  _type?: string;
  children?: Array<{ text?: string; _type?: string }>;
};

function ptToPlain(blocks: PtBlock[] | null | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .map((b) => {
      if (b._type !== "block") return "";
      return (b.children ?? []).map((c) => c.text ?? "").join("");
    })
    .join("\n")
    .trim();
}

/** Same idea as plan normalizeKey — Klucz for Excel column C */
function slugToKlucz(slug: string | null | undefined): string | null {
  if (!slug) return null;
  let key = slug.trim();
  key = key.replace(/^\/?certyfikowany-sprzet-uzywany\//i, "");
  key = key.replace(/^\/+|\/+$/g, "");
  return key || null;
}

function stripPathSegments(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/^\/+|\/+$/g, "").replace(/^\w+\//, ""); // drop first segment like marki/ or produkty/
}

/** URL column: internal path brand/product, https for external, empty if none */
function buildUrlColumn(
  productType: string | undefined,
  externalUrl: string | null | undefined,
  internalProduct: {
    brand?: { brandSlug?: string | null } | null;
    productSlug?: string | null;
  } | null,
): string {
  if (productType === "external" && externalUrl) return externalUrl;
  if (!internalProduct?.productSlug) return "";
  const brandRaw = internalProduct.brand?.brandSlug ?? "";
  const brand = brandRaw.replace(/^\/marki\//, "").replace(/\/$/, "");
  const prodRaw = internalProduct.productSlug ?? "";
  const product = prodRaw.replace(/^\/produkty\//, "").replace(/\/$/, "");
  if (!brand || !product) return "";
  return `${brand}/${product}`;
}

/** Cena w PLN (grosze z Sanity → zł); jawne locale pl-PL + ISO 4217 PLN (nie USD/EUR) */
function formatPricePln(priceCents: number | undefined): string {
  if (priceCents == null || Number.isNaN(priceCents)) return "";
  const plnWhole = Math.round(priceCents / 100);
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(plnWhole);
}

/** Zawsze w cudzysłowie — Excel nie traktuje komórki jako waluty obcej ($/€) */
function escapeCsvPriceCell(formatted: string): string {
  if (!formatted) return "";
  return `"${formatted.replace(/"/g, '""')}"`;
}

/** ASCII-ish slug for fallback Klucz when Sanity has no slug (external products) */
function polishToAsciiSlugPart(s: string): string {
  const map: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
  };
  return s
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}

/** Klucz in Excel: always /segment/ (leading + trailing slash) */
function excelKeyPath(raw: string): string {
  const inner = raw.trim().replace(/^\/+|\/+$/g, "");
  return inner ? `/${inner}/` : "";
}

/** URL column: https? unchanged; internal brand/product paths as /a/b/ */
function excelUrlColumn(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const inner = t.replace(/^\/+|\/+$/g, "");
  return inner ? `/${inner}/` : "";
}

function escapeCsvCell(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const q = `*[_type == "cpoProduct" && !(_id in path("drafts.**"))] | order(brandName asc, name asc) {
    _id,
    brandName,
    name,
    "slug": slug.current,
    priceCents,
    productType,
    externalUrl,
    internalProduct->{
      "productSlug": slug.current,
      brand->{ "brandSlug": slug.current }
    },
    shortDescription
  }`;

  const rows = await client.fetch<
    Array<{
      _id: string;
      brandName?: string;
      name?: string;
      slug?: string | null;
      priceCents?: number;
      productType?: string;
      externalUrl?: string | null;
      internalProduct?: {
        productSlug?: string | null;
        brand?: { brandSlug?: string | null } | null;
      } | null;
      shortDescription?: PtBlock[] | null;
    }>
  >(q);

  const header = ["Marka", "Nazwa", "Klucz", "Cena", "URL", "Opis"];

  const lines: string[] = [];
  lines.push(header.map(escapeCsvCell).join(","));

  for (const r of rows) {
    let klucz = slugToKlucz(r.slug ?? null);
    if (!klucz) {
      const base = polishToAsciiSlugPart(`${r.brandName ?? ""} ${r.name ?? ""}`)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 96);
      klucz = base || r._id.replace(/^cpo-/, "");
    }

    const url = buildUrlColumn(r.productType, r.externalUrl, r.internalProduct);
    const opis = ptToPlain(r.shortDescription ?? undefined);
    lines.push(
      [
        escapeCsvCell(r.brandName ?? ""),
        escapeCsvCell(r.name ?? ""),
        escapeCsvCell(excelKeyPath(klucz)),
        escapeCsvPriceCell(formatPricePln(r.priceCents)),
        escapeCsvCell(excelUrlColumn(url)),
        escapeCsvCell(opis),
      ].join(","),
    );
  }

  // UTF-8 BOM so Excel (Windows) opens Polish characters correctly
  writeFileSync(OUT, "\uFEFF" + lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length} rows (+ header) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
