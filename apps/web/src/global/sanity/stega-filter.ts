import type { FilterDefault } from '@sanity/client/stega';

/**
 * Stega appends invisible marker characters to every string it encodes, so
 * Presentation can trace rendered text back to the field that produced it.
 * That is exactly wrong for machine-read values: the markers ride into `===`
 * comparisons, Map keys, CSS attribute selectors, `tel:`/`mailto:` hrefs, GROQ
 * params and server-action payloads and break them, but ONLY in draft mode, so
 * no published build ever catches it ("it stopped working in preview").
 *
 * `@sanity/client`'s `filterDefault` already skips a generic set (`_`-prefixed
 * keys, `*Id`, any `/type/i` segment, `slug.current`, `href`, `url`, `email`,
 * `website`, `link`, `unit`, `variant`, `layout`, `seo`/`openGraph`, URL- and
 * date-shaped values, …) but cannot know this project's fields.
 *
 * Rule for new schema fields: anything with `options.list` (an enum), anything
 * that ends up in an href, a `data-*`/class/id attribute, inline markup, a Map
 * key, a GROQ param or assistive-tech text belongs here, added in the same
 * commit as the field. Never add `name` or `title`: they are display copy
 * almost everywhere, so they are `stegaClean`ed at the render site instead.
 *
 * The filter matches the SOURCE path, never the GROQ alias: under
 * `"alt": asset->altText` the reported leaf is `altText`. A primitive-array
 * member reports its index as the leaf, so its array's name (one segment up)
 * stands in for the leaf. Source: research/09 §2.2–2.5.
 */
export const STEGA_LOGIC_ONLY_FIELDS: ReadonlySet<string> = new Set([
  // `options.list` enums the vendor default does not cover
  'displayMode', // faqSection: `===` + `data-display-mode` + SCSS selectors
  'float', // ptInlineImage: className compare
  'availabilityStatus', // cpoProduct: B2C buyability (getCpoProductBuyability)
  'brandsDisplayMode',
  'selectionMode',
  'newProductsMode',
  'priceRange', // settings.structuredData → Organization JSON-LD
  'level', // ptHeading (hidden constant)
  'style', // hidden PT/content-block style constants
  // contact values that become tel:/mailto: hrefs
  'tel',
  'phone',
  'phoneNumber',
  'customPhone',
  'customEmail',
  // inline markup, scripts, assistive-tech attributes
  'iconString', // socialMedia: inlined SVG markup in the footer
  'gtm_id', // `_id` is not `Id`, so the vendor rule misses these three
  'ga4_id',
  'googleAds_id',
  'metaConversionToken',
  'alt',
  'altText', // `"alt": asset->altText` reports the asset field name
  // filters and denormalized logic values (Map keys, GROQ params, `?brands=`)
  'filterName',
  'value',
  'denormBrandSlug',
  'denormBrandName',
  'denormCategorySlugs',
  'denormParentCategorySlugs',
  'denormFilterKeys',
  // primitive arrays (matched through the parent segment)
  'keywords',
  'supportEmails',
  'b2cTransactionalEmailCopyRecipients',
]);

/**
 * Subtrees where EVERY string is logic, matched anywhere in the source path:
 * the category filter definitions (`name` becomes a URL slug, a Map key and a
 * GROQ param), the products' filter values, and the analytics settings.
 */
export const STEGA_LOGIC_ONLY_PARENTS: ReadonlySet<string> = new Set([
  'customFilters',
  'customFilterValues',
  'analytics',
]);

type StegaFilterProps = Parameters<FilterDefault>[0];

/** The `stega.filter` of the one Sanity client (`client.ts`). */
export function stegaFilter(props: StegaFilterProps): boolean {
  const { sourcePath } = props;
  const leaf = sourcePath.at(-1);
  if (typeof leaf === 'string' && STEGA_LOGIC_ONLY_FIELDS.has(leaf)) {
    return false;
  }
  const parent = sourcePath.at(-2);
  if (
    typeof leaf === 'number' &&
    typeof parent === 'string' &&
    STEGA_LOGIC_ONLY_FIELDS.has(parent)
  ) {
    return false;
  }
  if (
    sourcePath.some(
      (segment) =>
        typeof segment === 'string' && STEGA_LOGIC_ONLY_PARENTS.has(segment),
    )
  ) {
    return false;
  }
  return props.filterDefault(props);
}
