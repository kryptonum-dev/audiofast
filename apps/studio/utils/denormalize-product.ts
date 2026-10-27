/**
 * Denormalized product fields written by the Studio publish wrapper
 * (`actions/wrap-publish-with-denorm.ts`) for zero-lag denorm on publish.
 *
 * The server-side owner is the `denormalize-products` Sanity Function
 * (`apps/functions/denormalize-products/denorm.ts`), which computes the SAME
 * three fields with the same rules; during the parallel run both writers must
 * agree, or every publish would flip a product's primary category back and
 * forth. Keep the two in lockstep.
 *
 * `denormParentCategorySlugs` (always empty: parents have no slug) and
 * `denormFilterKeys` (never read by the web) are no longer written.
 */
export type DenormalizedProductFields = {
  denormBrandSlug: string | null;
  denormBrandName: string | null;
  denormCategorySlugs: string[];
  denormLastSync: string;
};

type DenormalizeClient = {
  fetch: <T>(query: string, params?: Record<string, unknown>) => Promise<T>;
};

/**
 * Computes denormalized fields for a product document.
 * Call this when a product is created or updated.
 *
 * These fields are used to optimize GROQ queries by avoiding
 * expensive dereferencing operations at query time.
 */
export async function computeDenormalizedFields(
  client: DenormalizeClient,
  document: {
    brand?: { _ref: string };
    categories?: Array<{ _ref: string }>;
  },
): Promise<DenormalizedProductFields> {
  const now = new Date().toISOString();

  let brandSlug: string | null = null;
  let brandName: string | null = null;
  let categorySlugs: string[] = [];

  if (document.brand?._ref) {
    const brand = await client.fetch<{ name: string; slug: string } | null>(
      `*[_id == $id][0]{ name, "slug": slug.current }`,
      { id: document.brand._ref },
    );

    if (brand) {
      // Extract slug without prefix: "/marki/yamaha/" -> "yamaha"
      brandSlug = brand.slug?.replace('/marki/', '').replace(/\/$/, '') || null;
      brandName = brand.name || null;
    }
  }

  if (document.categories?.length) {
    const categoryRefs = document.categories.map((c) => c._ref).filter(Boolean);

    const categories = await client.fetch<
      Array<{ _id: string; slug: string | null }>
    >(`*[_id in $ids]{ _id, "slug": slug.current }`, { ids: categoryRefs });

    // `*[_id in $ids]` returns INDEX order, not the product's `categories[]`
    // order — and `denormCategorySlugs[0]` is the product's primary category
    // on listings. Re-sort by the editor's order.
    const slugById = new Map(categories.map((c) => [c._id, c.slug]));
    categorySlugs = categoryRefs
      .map((ref) => slugById.get(ref))
      .filter((slug): slug is string => Boolean(slug));
  }

  return {
    denormBrandSlug: brandSlug,
    denormBrandName: brandName,
    denormCategorySlugs: categorySlugs,
    denormLastSync: now,
  };
}
