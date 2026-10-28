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
