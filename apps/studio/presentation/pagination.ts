import type { DocumentLocationsState } from 'sanity/presentation';

/**
 * Parent-listing pagination: for a listed document, rewrite each paginated
 * parent row to the page the document actually sits on in that listing's
 * DEFAULT view — `<parent>?page=N`, the web's `?page=N` search param (page 1
 * stays the bare URL). Other sorts and filters are not representable, and
 * need not be: the row names the default view an editor lands on.
 *
 * Paginated rows: the main listings (`/blog/`, `/produkty/`,
 * `/certyfikowany-sprzet-uzywany/`) and the per-document listings a product
 * or an article also sits in (its product categories, its brand's product
 * grid, its blog category). Each one is a `{href, ids}` list in the
 * projection, matched to its location row by href.
 *
 * ⚠️ WEB MIRROR. The filters, orders and page sizes below mirror the web
 * listings exactly; `pagination.test.ts` reads `apps/web/src/global/sanity/
 * query.ts`, `constants.ts` and the listing pages and fails when either side
 * drifts. A filter that is looser than the web's, or an order that is not the
 * page's default sort, advertises a page the document is not on (audit row
 * H3, run 2: `/produkty/` sorts by price, not `orderRank`).
 *
 * The filters are the web's listing filters WITHOUT their request params
 * (`$search`, `$category`, `$brands`, prices, custom filters) — every one of
 * those is a no-op in the default view.
 */

/** `blogArticlesFilterConditions` (query.ts), default sort `newest`. */
export const BLOG_LISTING_FILTER =
  '_type == "blog-article" && defined(slug.current) && hideFromList == false';

/**
 * `productsFilterConditions` (query.ts). Default sorts: `/produkty/` and its
 * category pages `priceAsc`, brand pages `newest` (the `defaultSortBy` the
 * pages pass to `ProductsListing`).
 */
export const PRODUCT_LISTING_FILTER =
  '_type == "product" && defined(slug.current) && isArchived != true && defined(denormCategorySlugs) && count(denormCategorySlugs) > 0 && !(brand._ref in *[_type == "brand" && doNotShowBrand == true]._id)';

/** `cpoFilterConditions` (query.ts), default sort `newest`. */
export const CPO_LISTING_FILTER =
  '_type == "cpoProduct" && isArchived != true && (defined(previewImage.asset) || (defined(internalProduct) && defined(internalProduct->previewImage.asset)))';

/** `queryProductsListingPriceAsc` — `/produkty/` and category pages. */
export const PRODUCT_PRICE_ASC_ORDER =
  'coalesce(basePriceCents, 999999999) asc';

/** `queryProductsListingNewest` / `queryBlogArticlesNewest` / CPO newest. */
export const NEWEST_ORDER = 'coalesce(publishedDate, _createdAt) desc';

/** `BLOG_ITEMS_PER_PAGE` = `PRODUCTS_ITEMS_PER_PAGE` = `CPO_ITEMS_PER_PAGE`. */
export const LISTING_PAGE_SIZE = 12;

export type PaginatedParent = {
  filter: string;
  order: string;
  pageSize: number;
  /** The parent row's literal href (`PARENT_LOCATIONS`, `paginated: true`). */
  href: string;
  /** Types whose mutations can shift the document's position. */
  listenTypes: string[];
  /**
   * GROQ, in the listed document's scope: an array of further `{href, ids}`
   * listings (category pages, the brand grid) whose rows `PARENT_LOCATIONS`
   * computes. A row with no matching list keeps its bare href.
   */
  subLists?: string;
};

const listIds = (filter: string, order: string) =>
  `(*[${filter}] | order(${order}))[]._id`;

export const PAGINATED_PARENTS: Record<string, PaginatedParent> = {
  'blog-article': {
    filter: BLOG_LISTING_FILTER,
    order: NEWEST_ORDER,
    pageSize: LISTING_PAGE_SIZE,
    href: '/blog/',
    listenTypes: ['blog-article'],
    // app/blog/(listing)/kategoria/[category]/page.tsx — same filter + its
    // category, newest first.
    subLists: `select(hideFromList == false && defined(category->slug.current) => [{"href": category->slug.current, "ids": ${listIds(`${BLOG_LISTING_FILTER} && category._ref == ^.category._ref`, NEWEST_ORDER)}}], [])`,
  },
  product: {
    filter: PRODUCT_LISTING_FILTER,
    order: PRODUCT_PRICE_ASC_ORDER,
    pageSize: LISTING_PAGE_SIZE,
    href: '/produkty/',
    // A brand hidden or shown moves every product of it in or out.
    listenTypes: ['product', 'brand'],
    // app/produkty/(listing)/kategoria/[category]/page.tsx (`$category in
    // denormCategorySlugs`, priceAsc) and app/marki/[slug]/page.tsx
    // (`denormBrandSlug in $brands`, newest).
    subLists: `coalesce(categories[]->{"href": "/produkty" + slug.current, "ids": ${listIds(`${PRODUCT_LISTING_FILTER} && ^.slug.current in denormCategorySlugs`, PRODUCT_PRICE_ASC_ORDER)}}, []) + select(defined(brand->slug.current) => [{"href": brand->slug.current, "ids": ${listIds(`${PRODUCT_LISTING_FILTER} && denormBrandSlug == ^.denormBrandSlug`, NEWEST_ORDER)}}], [])`,
  },
  cpoProduct: {
    filter: CPO_LISTING_FILTER,
    order: NEWEST_ORDER,
    pageSize: LISTING_PAGE_SIZE,
    href: '/certyfikowany-sprzet-uzywany/',
    listenTypes: ['cpoProduct', 'product'],
  },
};

export function paginatedParentConfig(
  type: string,
): PaginatedParent | undefined {
  return PAGINATED_PARENTS[type];
}

/** The GROQ projection field the resolver adds for a paginated type. */
export function parentPaginationProjection(config: PaginatedParent): string {
  const main = `[{"href": ${JSON.stringify(config.href)}, "ids": ${listIds(config.filter, config.order)}}]`;
  return `"parentPagination": {
    "id": _id,
    "pageSize": ${config.pageSize},
    "lists": ${config.subLists ? `${main} + ${config.subLists}` : main}
  },`;
}

export type PaginatedList = { href: string | null; ids: string[] | null };

export type ParentPaginationState = DocumentLocationsState & {
  parentPagination?: {
    id: string;
    pageSize: number;
    lists: PaginatedList[] | null;
  } | null;
};

/** `?page=N` on a listing href; page 1 is the bare URL. */
export function listingPageHref(href: string, page: number): string {
  return page <= 1 ? href : `${href}?page=${page}`;
}

export function resolvePaginatedParent(
  state: ParentPaginationState | null,
): DocumentLocationsState | null {
  if (!state) return state;
  const { parentPagination: parent, ...result } = state;
  if (!parent) return result;

  // Draft perspectives normally normalise ids, but compare either form safely.
  const publishedId = (id: string) => id.replace(/^drafts\./, '');
  const target = publishedId(parent.id);

  return {
    ...result,
    locations: result.locations?.flatMap((location) => {
      const list = parent.lists?.find((entry) => entry.href === location.href);
      if (!list) return [location];
      const index = (list.ids ?? []).findIndex(
        (id) => publishedId(id) === target,
      );
      // Not in the listing (hidden, archived, no category yet): no row.
      if (index < 0) return [];
      const page = Math.floor(index / parent.pageSize) + 1;
      if (page === 1) return [location];
      return [
        {
          ...location,
          title: `${location.title} — strona ${page}`,
          href: listingPageHref(location.href, page),
        },
      ];
    }),
  };
}
