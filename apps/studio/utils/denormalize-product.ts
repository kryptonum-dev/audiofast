import type { SanityClient } from "sanity";

export type DenormalizedProductFields = {
  denormBrandSlug: string | null;
  denormBrandName: string | null;
  denormCategorySlugs: string[];
  denormParentCategorySlugs: string[];
  denormFilterKeys: string[]; // Only dropdown filters, not range filters
  denormLastSync: string;
};

/**
 * Slugify a string for filter key matching.
 * Removes diacritics and converts to lowercase kebab-case.
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Computes denormalized fields for a product document.
 * Call this when a product is created or updated.
 *
 * These fields are used to optimize GROQ queries by avoiding
 * expensive dereferencing operations at query time.
 */
export async function computeDenormalizedFields(
  client: SanityClient,
  document: {
    brand?: { _ref: string };
    categories?: Array<{ _ref: string }>;
    customFilterValues?: Array<{
      filterName?: string;
      value?: string;
      numericValue?: number;
    }>;
  },
): Promise<DenormalizedProductFields> {
  const now = new Date().toISOString();

  // Default empty values
  let brandSlug: string | null = null;
  let brandName: string | null = null;
  let categorySlugs: string[] = [];
  let parentCategorySlugs: string[] = [];
  let filterKeys: string[] = []; // Only dropdown filters

  // Fetch brand data if brand reference exists
  if (document.brand?._ref) {
    const brand = await client.fetch<{ name: string; slug: string } | null>(
      `*[_id == $id][0]{ name, "slug": slug.current }`,
      { id: document.brand._ref },
    );

    if (brand) {
      // Extract slug without prefix: "/marki/yamaha/" -> "yamaha"
      brandSlug =
        brand.slug?.replace("/marki/", "").replace(/\/$/, "") || null;
      brandName = brand.name || null;
    }
  }

  // Fetch category data if categories exist
  if (document.categories?.length) {
    const categoryRefs = document.categories.map((c) => c._ref).filter(Boolean);

    const categories = await client.fetch<
      Array<{
        slug: string;
        parentSlug: string | null;
      }>
    >(
      `*[_id in $ids]{
        "slug": slug.current,
        "parentSlug": parentCategory->slug.current
      }`,
      { ids: categoryRefs },
    );

    categorySlugs = categories.map((c) => c.slug).filter(Boolean);
    parentCategorySlugs = categories
      .map((c) => c.parentSlug)
      .filter((s): s is string => Boolean(s));
  }

  // Compute filter keys from customFilterValues
  // ONLY for dropdown filters (string values), NOT range filters (numeric values)
  // Range filters still use customFilterValues[].numericValue for numeric comparison
  if (document.customFilterValues?.length) {
    filterKeys = document.customFilterValues
      .filter((fv) => {
        // Only include dropdown filters (have string value, not just numericValue)
        return fv.filterName && fv.value;
      })
      .map((fv) => {
        const slug = slugify(fv.filterName!);
        return `${slug}:${fv.value!.toLowerCase()}`;
      });
  }

  return {
    denormBrandSlug: brandSlug,
    denormBrandName: brandName,
    denormCategorySlugs: categorySlugs,
    denormParentCategorySlugs: parentCategorySlugs,
    denormFilterKeys: filterKeys, // Dropdown filters only
    denormLastSync: now,
  };
}

/**
 * Computes only the filter keys from customFilterValues.
 * Used when updating filter values from the CustomFiltersConfigView,
 * which bypasses normal document actions.
 */
export function computeFilterKeys(
  customFilterValues?: Array<{
    filterName?: string;
    value?: string;
    numericValue?: number;
  }>,
): string[] {
  if (!customFilterValues?.length) {
    return [];
  }

  return customFilterValues
    .filter((fv) => {
      // Only include dropdown filters (have string value, not just numericValue)
      return fv.filterName && fv.value;
    })
    .map((fv) => {
      const slug = slugify(fv.filterName!);
      return `${slug}:${fv.value!.toLowerCase()}`;
    });
}

