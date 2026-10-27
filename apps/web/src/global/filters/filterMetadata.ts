// Pure derivations over filter-metadata rows. The GROQ queries return the
// product rows once; the global price bounds and the CPO brand list are
// computed here instead of re-scanning the same documents in the query.

export type GlobalPriceRange = {
  /** Highest listed price in cents, `null` when no row has a price. */
  globalMaxPrice: number | null;
  /** Lowest listed price in cents, `null` when no row has a price. */
  globalMinPrice: number | null;
};

/**
 * `math::max` / `math::min` over the rows' prices, in JS: rows without a
 * numeric price are skipped, and an empty set yields `null` (as GROQ does).
 */
export function getGlobalPriceRange(
  rows: ReadonlyArray<{ basePriceCents?: number | null }>,
): GlobalPriceRange {
  let globalMaxPrice: number | null = null;
  let globalMinPrice: number | null = null;

  for (const { basePriceCents } of rows) {
    if (typeof basePriceCents !== 'number' || Number.isNaN(basePriceCents)) {
      continue;
    }

    if (globalMaxPrice === null || basePriceCents > globalMaxPrice) {
      globalMaxPrice = basePriceCents;
    }

    if (globalMinPrice === null || basePriceCents < globalMinPrice) {
      globalMinPrice = basePriceCents;
    }
  }

  return { globalMaxPrice, globalMinPrice };
}

export type CpoFilterBrand = {
  _id: string;
  name: string;
  slug: string;
};

type CpoFilterRow = {
  brandSlug?: string | null;
  brandName?: string | null;
  basePriceCents?: number | null;
};

/**
 * The CPO sidebar data from the one CPO rows scan: the rows themselves, the
 * distinct brands (first occurrence wins, like GROQ `array::unique` over the
 * same rows) and the price bounds.
 */
export function deriveCpoFilterMetadata<TRow extends CpoFilterRow>(
  rows: readonly TRow[] | null | undefined,
): GlobalPriceRange & { products: TRow[]; brands: CpoFilterBrand[] } {
  const products = [...(rows ?? [])];
  const brands = new Map<string, CpoFilterBrand>();

  for (const { brandSlug, brandName } of products) {
    if (!brandSlug || !brandName) continue;

    const key = `${brandSlug}\u0000${brandName}`;
    if (!brands.has(key)) {
      brands.set(key, { _id: brandSlug, name: brandName, slug: brandSlug });
    }
  }

  return {
    products,
    brands: Array.from(brands.values()),
    ...getGlobalPriceRange(products),
  };
}
