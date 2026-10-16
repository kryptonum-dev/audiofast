/**
 * Cache tag for a brand's dealer list ("Gdzie kupić") as embedded on product
 * pages. Product pages that inherit the brand's stores fetch them under this
 * tag, and /api/revalidate invalidates it on brand and store publishes.
 *
 * Keyed by the brand's document id (not its slug) so a product page can build
 * it straight from the `brand._ref` it already has, and so it survives a brand
 * slug change.
 */
export const BRAND_STORES_TAG = 'brand-stores';

export function getBrandStoresTag(brandId: string): string {
  return `${BRAND_STORES_TAG}:${toPublishedId(brandId)}`;
}

/** `drafts.abc` -> `abc`; published ids pass through unchanged. */
export function toPublishedId(id: string): string {
  return id.replace(/^drafts\./, '');
}

/**
 * Pick the dealer list a product page should show: the product's own
 * `availableInStores` when it has any, otherwise the brand's stores, otherwise
 * nothing.
 */
export function pickEffectiveStores<Store>(
  productStores: ReadonlyArray<Store | null> | null | undefined,
  brandStores: ReadonlyArray<Store | null> | null | undefined,
): Store[] | null {
  const own = (productStores ?? []).filter((s): s is Store => s !== null);
  if (own.length > 0) return own;

  const inherited = (brandStores ?? []).filter((s): s is Store => s !== null);
  if (inherited.length > 0) return inherited;

  return null;
}

/**
 * Whether the product page needs the brand's dealer list at all — i.e. the
 * product has no usable own stores (same rule as pickEffectiveStores).
 */
export function needsBrandStores(
  productStores: ReadonlyArray<unknown> | null | undefined,
): boolean {
  return !(productStores ?? []).some((s) => s !== null);
}
