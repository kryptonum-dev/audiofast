/**
 * Pure half of the `denormalize-products` Function: what a product's `denorm*`
 * fields SHOULD be, and which products need a patch to get there. No I/O, so
 * the handler, the one-time backfill script and the unit tests share it.
 *
 * Only the three fields the web reads are maintained:
 * - `denormBrandSlug` — `brand->slug.current` without the `/marki/` prefix and
 *   trailing slash (`"/marki/yamaha/"` → `"yamaha"`);
 * - `denormBrandName` — `brand->name`;
 * - `denormCategorySlugs` — `categories[]->slug.current`, FULL paths, in the
 *   editor's `categories[]` order. Index `[0]` is the product's primary
 *   category on listings (`query.ts` `categorySlug`), so the order is data, not
 *   cosmetics: the old writers resolved refs with `*[_id in $ids]`, which
 *   returns index order and silently swapped the primary category.
 *
 * `denormParentCategorySlugs` (always empty: parents have no slug) and
 * `denormFilterKeys` (never read) are deliberately NOT written any more.
 *
 * ⚠️ Function bundles cannot import workspace packages, so this file is the
 * single copy for `apps/functions`. The Studio publish wrapper
 * (`apps/studio/utils/denormalize-product.ts`) computes the same three fields
 * during the parallel run; `denorm.test.ts` pins the shared rules.
 */

/** Pinned Content Lake API version for every client in this layer. */
export const API_VERSION = '2026-10-01';

/** Transaction size for brand/category fan-out (the largest brand has ~186 products). */
export const PATCH_BATCH_SIZE = 50;

/**
 * Every published product affected by a change to document `$id`: the product
 * itself, every product of a brand, or every product in a sub-category. Denorm
 * inputs are dereferenced here, in ONE query — `categories[]->slug.current`
 * keeps array order, which is the whole point (see the file header).
 */
export const AFFECTED_PRODUCTS_QUERY = `*[_type == "product" && !(_id in path("drafts.**")) && (_id == $id || brand._ref == $id || $id in categories[]._ref)]{
  _id,
  _rev,
  "brandSlug": brand->slug.current,
  "brandName": brand->name,
  "categorySlugs": categories[]->slug.current,
  denormBrandSlug,
  denormBrandName,
  denormCategorySlugs
}`;

/** Same projection over the whole catalogue, for the backfill script. */
export const ALL_PRODUCTS_QUERY = `*[_type == "product" && !(_id in path("drafts.**"))]{
  _id,
  _rev,
  "slug": slug.current,
  "brandSlug": brand->slug.current,
  "brandName": brand->name,
  "categorySlugs": categories[]->slug.current,
  denormBrandSlug,
  denormBrandName,
  denormCategorySlugs
}`;

export interface ProductDenormSource {
  _id: string;
  _rev: string;
  slug?: string | null;
  brandSlug?: string | null;
  brandName?: string | null;
  categorySlugs?: Array<string | null> | null;
  denormBrandSlug?: string | null;
  denormBrandName?: string | null;
  denormCategorySlugs?: string[] | null;
}

export interface DenormFields {
  denormBrandSlug: string | null;
  denormBrandName: string | null;
  denormCategorySlugs: string[];
}

export interface DenormPatch {
  _id: string;
  _rev: string;
  set: DenormFields & { denormLastSync: string };
}

/** `"/marki/yamaha/"` → `"yamaha"`; empty → `null`. Same rule as the Studio helper. */
export function stripBrandSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return slug.replace('/marki/', '').replace(/\/$/, '') || null;
}

export function computeDenormFields(source: ProductDenormSource): DenormFields {
  return {
    denormBrandSlug: stripBrandSlug(source.brandSlug),
    denormBrandName: source.brandName || null,
    denormCategorySlugs: (source.categorySlugs ?? []).filter(
      (slug): slug is string => typeof slug === 'string' && slug.length > 0,
    ),
  };
}

function sameStringArray(
  stored: string[] | null | undefined,
  computed: string[],
): boolean {
  // A MISSING array is not equal to an empty one: writing `[]` once is what
  // stops the blueprint filter's `!defined(after().denormCategorySlugs)`
  // branch from matching this product on every later mutation.
  if (!Array.isArray(stored)) return false;
  return (
    stored.length === computed.length &&
    stored.every((value, index) => value === computed[index])
  );
}

/**
 * The fields to write, or `null` when the stored values already match —
 * the idempotency guard: a redelivered event, or the Function's own patch
 * coming back around, diffs to `null` and writes nothing.
 */
export function diffDenormFields(
  source: ProductDenormSource,
): DenormFields | null {
  const computed = computeDenormFields(source);
  const unchanged =
    (source.denormBrandSlug ?? null) === computed.denormBrandSlug &&
    (source.denormBrandName ?? null) === computed.denormBrandName &&
    sameStringArray(source.denormCategorySlugs, computed.denormCategorySlugs);
  return unchanged ? null : computed;
}

/** One patch per product whose stored fields drift from the computed ones. */
export function planDenormPatches(
  products: ProductDenormSource[],
  now: string,
): DenormPatch[] {
  const patches: DenormPatch[] = [];
  for (const product of products) {
    const fields = diffDenormFields(product);
    if (fields) {
      patches.push({
        _id: product._id,
        _rev: product._rev,
        set: { ...fields, denormLastSync: now },
      });
    }
  }
  return patches;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
