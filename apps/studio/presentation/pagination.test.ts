/**
 * Parent-listing pagination: the page math, and SOURCE PARITY with the web —
 * the Studio's listing filters, orders and page sizes are compared with
 * `apps/web/src/global/sanity/query.ts`, `constants.ts` and the listing
 * components, so eligibility and ordering cannot drift silently.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
  BLOG_LISTING_FILTER,
  CPO_LISTING_FILTER,
  LISTING_PAGE_SIZE,
  listingPageHref,
  NEWEST_ORDER,
  PAGINATED_PARENTS,
  parentPaginationProjection,
  type ParentPaginationState,
  PRODUCT_LISTING_FILTER,
  PRODUCT_PRICE_ASC_ORDER,
  resolvePaginatedParent,
} from './pagination';
import { PARENT_LOCATIONS } from './routes';

function state(index: number, size: number): ParentPaginationState {
  return {
    locations: [
      { title: 'Own', href: '/own/' },
      { title: 'Produkty', href: '/produkty/' },
    ],
    parentPagination: {
      id: 'target',
      pageSize: size,
      lists: [
        {
          href: '/produkty/',
          ids: Array.from({ length: Math.max(index + 1, 0) }, (_, i) =>
            i === index ? 'target' : `item-${i}`,
          ),
        },
      ],
    },
  };
}

describe('paginated parent locations', () => {
  test('page 1 is the bare URL, later pages carry ?page=N', () => {
    expect(resolvePaginatedParent(state(11, 12))?.locations?.[1]?.href).toBe(
      '/produkty/',
    );
    expect(resolvePaginatedParent(state(12, 12))?.locations?.[1]).toEqual({
      title: 'Produkty — strona 2',
      href: '/produkty/?page=2',
    });
    expect(listingPageHref('/blog/', 1)).toBe('/blog/');
    expect(listingPageHref('/blog/', 4)).toBe('/blog/?page=4');
  });

  test('absent membership removes only the parent; drafts match published ids', () => {
    expect(resolvePaginatedParent(state(-1, 12))?.locations).toEqual([
      { title: 'Own', href: '/own/' },
    ]);
    const draft = state(0, 12);
    draft.parentPagination!.id = 'drafts.target';
    expect(resolvePaginatedParent(draft)?.locations).toHaveLength(2);
    expect(resolvePaginatedParent(draft)).not.toHaveProperty(
      'parentPagination',
    );
  });

  test('each listing row is paged by its own list; rows without a list stay', () => {
    const multi: ParentPaginationState = {
      locations: [
        { title: 'Own', href: '/own/' },
        { title: 'Produkty', href: '/produkty/' },
        { title: 'Głośniki', href: '/produkty/kategoria/glosniki/' },
        { title: 'Marka', href: '/marki/x/' },
        { title: 'Archiwum', href: '/produkty/archiwalne/' },
        { title: 'Ukryta', href: '/produkty/kategoria/ukryta/' },
      ],
      parentPagination: {
        id: 'drafts.t',
        pageSize: 12,
        lists: [
          { href: '/produkty/', ids: [...Array(271).fill('x'), 't'] },
          { href: '/produkty/kategoria/glosniki/', ids: ['a', 't'] },
          { href: '/marki/x/', ids: [...Array(38).fill('x'), 't'] },
          { href: '/produkty/kategoria/ukryta/', ids: ['a'] },
          { href: null, ids: null },
        ],
      },
    };
    expect(resolvePaginatedParent(multi)?.locations).toEqual([
      { title: 'Own', href: '/own/' },
      { title: 'Produkty — strona 23', href: '/produkty/?page=23' },
      { title: 'Głośniki', href: '/produkty/kategoria/glosniki/' },
      { title: 'Marka — strona 4', href: '/marki/x/?page=4' },
      { title: 'Archiwum', href: '/produkty/archiwalne/' },
    ]);
  });

  test('sub-listings use the category/brand filters and their page sorts', () => {
    const product = parentPaginationProjection(PAGINATED_PARENTS.product!);
    expect(product).toContain(
      `^.slug.current in denormCategorySlugs] | order(${PRODUCT_PRICE_ASC_ORDER})`,
    );
    expect(product).toContain(
      `denormBrandSlug == ^.denormBrandSlug] | order(${NEWEST_ORDER})`,
    );
    const blog = parentPaginationProjection(PAGINATED_PARENTS['blog-article']!);
    expect(blog).toContain(
      `category._ref == ^.category._ref] | order(${NEWEST_ORDER})`,
    );
    expect(
      parentPaginationProjection(PAGINATED_PARENTS.cpoProduct!),
    ).not.toContain('] + ');
  });

  test('every paginated parent has its literal row in PARENT_LOCATIONS', () => {
    for (const [type, config] of Object.entries(PAGINATED_PARENTS)) {
      const row = PARENT_LOCATIONS[type]?.find((parent) => parent.paginated);
      expect(row, type).toBeDefined();
      expect(row!.hrefVariants).toEqual([config.href]);
    }
  });
});

// ---------------------------------------------------------------------------
// Source parity with apps/web
// ---------------------------------------------------------------------------

const web = (path: string) =>
  readFileSync(new URL(`../../web/src/${path}`, import.meta.url), 'utf8');

const QUERY_SOURCE = web('global/sanity/query.ts');

/** A `const name = /* groq *\/ \`…\`;` template literal's body. */
function constantBody(name: string): string {
  const match = QUERY_SOURCE.match(
    new RegExp(`const ${name} = (?:/\\* groq \\*/ )?\`([^\`]+)\`;`),
  );
  if (!match) throw new Error(`query.ts: no template constant ${name}`);
  // Inline `${otherConstant}` interpolations, recursively.
  return match[1]!.replace(/\$\{(\w+)\}/g, (_, inner: string) =>
    constantBody(inner),
  );
}

/** Split on `&&` at paren/bracket depth 0 and normalise whitespace. */
function clauses(filter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < filter.length; i += 1) {
    const char = filter[i]!;
    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;
    if (depth === 0 && filter.startsWith('&&', i)) {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .map((part) =>
      // `(a || b)` at the top level reads the same without its parens.
      part.startsWith('(') && part.endsWith(')') && !part.includes('$')
        ? part.slice(1, -1).trim()
        : part,
    )
    .filter(Boolean);
}

/** The web filter in its DEFAULT view: clauses reading request params drop. */
function defaultViewClauses(name: string): string[] {
  return clauses(constantBody(name)).filter((clause) => !clause.includes('$'));
}

describe('source parity with the web listings', () => {
  test('blog: filter = blogArticlesFilterConditions without params', () => {
    expect(clauses(BLOG_LISTING_FILTER).sort()).toEqual(
      defaultViewClauses('blogArticlesFilterConditions').sort(),
    );
  });

  test('products: filter = productsFilterConditions without params', () => {
    expect(clauses(PRODUCT_LISTING_FILTER).sort()).toEqual(
      defaultViewClauses('productsFilterConditions').sort(),
    );
  });

  test('CPO: filter = cpoFilterConditions without params', () => {
    expect(clauses(CPO_LISTING_FILTER).sort()).toEqual(
      defaultViewClauses('cpoFilterConditions').sort(),
    );
  });

  test('default orders match the web default sorts', () => {
    expect(QUERY_SOURCE).toContain(
      `queryBlogArticlesNewest = defineQuery(\n  blogArticlesFragment('${PAGINATED_PARENTS['blog-article']!.order}'),`,
    );
    expect(QUERY_SOURCE).toContain(
      `queryProductsListingPriceAsc = defineQuery(\n  productsListingFragment('${PAGINATED_PARENTS.product!.order}'),`,
    );
    expect(QUERY_SOURCE).toContain(
      `queryProductsListingNewest = defineQuery(\n  productsListingFragment('${NEWEST_ORDER}'),`,
    );
    expect(QUERY_SOURCE).toContain(
      `queryCpoProductsListingNewest = defineQuery(\n  cpoListingFragment('${PAGINATED_PARENTS.cpoProduct!.order}'),`,
    );
    expect(web('components/blog/BlogListing/index.tsx')).toContain(
      "getBlogArticlesQuery('newest')",
    );
    // The pages override the component default (`orderRank`).
    expect(web('app/produkty/(listing)/page.tsx')).toContain(
      'defaultSortBy="priceAsc"',
    );
    expect(
      web('app/produkty/(listing)/kategoria/[category]/page.tsx'),
    ).toContain('defaultSortBy="priceAsc"');
    expect(web('app/marki/[slug]/page.tsx')).toContain(
      'defaultSortBy="newest"',
    );
    expect(
      web(
        'components/pageBuilder/CpoProductsListing/CpoProductsListingInner.tsx',
      ),
    ).toContain("defaultSortBy = 'newest'");
  });

  test('page sizes match the web constants', () => {
    const constants = web('global/constants.ts');
    for (const name of [
      'BLOG_ITEMS_PER_PAGE',
      'PRODUCTS_ITEMS_PER_PAGE',
      'CPO_ITEMS_PER_PAGE',
    ]) {
      expect(constants).toContain(
        `export const ${name}: number = ${LISTING_PAGE_SIZE};`,
      );
    }
  });
});
