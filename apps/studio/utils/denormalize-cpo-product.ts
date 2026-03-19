import type { SanityClient } from "sanity";

export type DenormalizedCpoProductFields = {
  denormBrandSlug: string | null;
  denormBrandName: string | null;
};

/**
 * Computes denormalized brand fields for a CPO product document.
 *
 * - Audiofast brand: resolves the brand reference and extracts the clean slug
 *   (e.g. "/marki/aurender/" → "aurender"), mirroring product.denormBrandSlug.
 * - External brand: lowercases otherBrandName (e.g. "Naim Audio" → "naim audio").
 *
 * These flat strings are used in GROQ filters and the ProductsAside brand
 * filter, avoiding live brand→ dereferences at query time.
 */
export async function computeCpoDenormalizedFields(
  client: SanityClient,
  document: {
    brandType?: string;
    brand?: { _ref: string };
    otherBrandName?: string;
  },
): Promise<DenormalizedCpoProductFields> {
  let denormBrandSlug: string | null = null;
  let denormBrandName: string | null = null;

  if (document.brandType === "audiofast" && document.brand?._ref) {
    const brand = await client.fetch<{ name: string; slug: string } | null>(
      `*[_id == $id][0]{ name, "slug": slug.current }`,
      { id: document.brand._ref },
    );

    if (brand) {
      // Strip "/marki/" prefix and trailing slash — same logic as product denorm
      denormBrandSlug =
        brand.slug?.replace("/marki/", "").replace(/\/$/, "") || null;
      denormBrandName = brand.name || null;
    }
  } else if (
    document.brandType === "external" &&
    document.otherBrandName?.trim()
  ) {
    denormBrandSlug = document.otherBrandName.trim().toLowerCase();
    denormBrandName = document.otherBrandName.trim();
  }

  return { denormBrandSlug, denormBrandName };
}
