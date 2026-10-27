import type { DocumentLocationsState } from 'sanity/presentation';

/**
 * Parent-listing pagination: for a listed document, rewrite its parent row
 * (`/blog/`, `/produkty/`, `/certyfikowany-sprzet-uzywany/`) to the page the
 * document actually sits on in the listing's DEFAULT view —
 * `<parent>?page=N`, the web's `?page=N` search param (page 1 stays the bare
 * URL). Other sorts and filters are not representable, and need not be: the
 * row names the default view an editor lands on.
 *
 * ⚠️ WEB MIRROR. The filters, orders and page sizes below mirror the web
 * listings exactly; `pagination.test.ts` reads `apps/web/src/global/sanity/
 * query.ts` and `constants.ts` and fails when either side drifts. A filter
 * that is looser than the web's advertises a page the document is not on.
 *
 * The filters are the web's listing filters WITHOUT their request params
 * (`$search`, `$category`, `$brands`, prices, custom filters) — every one of
 * those is a no-op in the default view.
 */

/** `blogArticlesFilterConditions` (query.ts), default sort `newest`. */
export const BLOG_LISTING_FILTER =
  '_type == "blog-article" && defined(slug.current) && hideFromList == false';

/** `productsFilterConditions` (query.ts), default sort `orderRank`. */
export const PRODUCT_LISTING_FILTER =
  '_type == "product" && defined(slug.current) && isArchived != true && defined(denormCategorySlugs) && count(denormCategorySlugs) > 0 && !(brand._ref in *[_type == "brand" && doNotShowBrand == true]._id)';

/** `cpoFilterConditions` (query.ts), default sort `newest`. */
export const CPO_LISTING_FILTER =
  '_type == "cpoProduct" && isArchived != true && (defined(previewImage.asset) || (defined(internalProduct) && defined(internalProduct->previewImage.asset)))';

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
};

export const PAGINATED_PARENTS: Record<string, PaginatedParent> = {
  'blog-article': {
    filter: BLOG_LISTING_FILTER,
    order: 'coalesce(publishedDate, _createdAt) desc',
    pageSize: LISTING_PAGE_SIZE,
    href: '/blog/',
    listenTypes: ['blog-article'],
  },
  product: {
    filter: PRODUCT_LISTING_FILTER,
    order: 'orderRank asc',
    pageSize: LISTING_PAGE_SIZE,
    href: '/produkty/',
    // A brand hidden or shown moves every product of it in or out.
    listenTypes: ['product', 'brand'],
  },
  cpoProduct: {
    filter: CPO_LISTING_FILTER,
    order: 'coalesce(publishedDate, _createdAt) desc',
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
  return `"parentPagination": {
    "id": _id,
    "ids": (*[${config.filter}] | order(${config.order}))[]._id,
    "href": ${JSON.stringify(config.href)},
    "pageSize": ${config.pageSize}
  },`;
}

export type ParentPaginationState = DocumentLocationsState & {
  parentPagination?: {
    id: string;
    ids: string[] | null;
    href: string;
    pageSize: number;
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
  const index = (parent.ids ?? []).findIndex(
    (id) => publishedId(id) === publishedId(parent.id),
  );
  const page = Math.floor(index / parent.pageSize) + 1;

  return {
    ...result,
    locations: result.locations?.flatMap((location) => {
      if (location.href !== parent.href) return [location];
      // Not in the listing (hidden, archived, no category yet): no parent row.
      if (index < 0) return [];
      if (page === 1) return [location];
      return [
        {
          ...location,
          title: `${location.title} — strona ${page}`,
          href: listingPageHref(parent.href, page),
        },
      ];
    }),
  };
}
