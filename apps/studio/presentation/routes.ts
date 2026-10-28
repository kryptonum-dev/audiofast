/**
 * The Studio's copy of the site's route table — the ONE source of truth for
 * "what URL does this document live at", used by:
 *
 *   • the Presentation `locations` resolver (`locations.ts`),
 *   • `mainDocuments` (`main-documents.ts`, through `ROUTE_PATTERNS`),
 *   • the „Otwórz w podglądzie" action and the tool menu (`preview-target.ts`),
 *   • the slug field's public URL line (`components/slug-field-component.tsx`,
 *     through `publicPathForSlug`).
 *
 * ⚠️ ROUTE-TABLE MIRROR. Change a route in `apps/web/src/app`, change it here
 * too. The completeness test (`locations.test.ts`) catches a document type
 * that lost its row; nothing can catch a row that points at the wrong path,
 * which is why every row below names the web route it mirrors.
 *
 * Audiofast stores FULL pathnames in `slug.current` (`/produkty/foo/`), so most
 * hrefs are the slug itself. The exceptions are spelled out in the table:
 *   • `productCategorySub` stores `/kategoria/<x>/` but is served at
 *     `/produkty/kategoria/<x>/` (`pathPrefix`);
 *   • `review` has a page only when `destinationType == "page"` (PDF reviews
 *     stream a file, external ones link out);
 *   • `cpoProduct` has a page only when `productType == "internal"` and it is
 *     not archived — exactly `queryCpoProductBySlug`'s filter.
 *
 * Expressed as GROQ EXPRESSION STRINGS rather than TypeScript builders: the
 * locations resolver composes them into one query whose result already is the
 * shape Presentation wants, and GROQ can dereference (`brand->name`) where the
 * preview `select` machinery cannot. An href expression evaluates to `null`
 * when the document has no URL yet — that `null` is a CONTRACT: the resolver's
 * `defined(href)` filters and its „Uzupełnij adres URL…" message key off it.
 */

type PinnedRoute = {
  kind: 'pin';
  /** The fixed public path of a singleton page, with trailing slash. */
  path: string;
  /** GROQ for the label shown next to the location. */
  title: string;
};

type SlugRoute = {
  kind: 'slug';
  /** Prepended to the stored `slug.current` (which already starts with `/`). */
  pathPrefix?: string;
  /** GROQ predicate the web route applies before it renders the document. */
  condition?: string;
  /** GROQ for the label shown next to the location. */
  title: string;
};

export type RouteConfig = PinnedRoute | SlugRoute;

function named(fallback: string, field = 'name'): string {
  return `coalesce(${field}, ${JSON.stringify(fallback)})`;
}

function pin(path: string, title: string): PinnedRoute {
  return { kind: 'pin', path, title: JSON.stringify(title) };
}

/**
 * Every routed document type. Membership of this record is the definition of
 * "routed type" for the whole Studio.
 */
export const ROUTES = {
  // app/page.tsx
  homePage: pin('/', 'Strona główna'),
  // app/[slug]/page.tsx — `slug.current == "/" + slug + "/"`
  page: { kind: 'slug', title: named('Podstrona') },
  // app/produkty/(listing)/page.tsx
  products: pin('/produkty/', 'Produkty'),
  // app/produkty/[slug]/page.tsx
  product: {
    kind: 'slug',
    title: 'coalesce(brand->name + " " + name, name, "Produkt")',
  },
  // app/produkty/(listing)/kategoria/[category]/page.tsx — stored without the
  // `/produkty` segment the route adds.
  productCategorySub: {
    kind: 'slug',
    pathPrefix: '/produkty',
    title: named('Kategoria produktów'),
  },
  // app/marki/page.tsx
  brands: pin('/marki/', 'Marki'),
  // app/marki/[slug]/page.tsx
  brand: { kind: 'slug', title: named('Marka') },
  // app/blog/(listing)/page.tsx
  blog: pin('/blog/', 'Blog'),
  // app/blog/[slug]/page.tsx
  'blog-article': { kind: 'slug', title: named('Artykuł') },
  // app/blog/(listing)/kategoria/[category]/page.tsx
  'blog-category': { kind: 'slug', title: named('Kategoria bloga') },
  // app/recenzje/[slug]/page.tsx — `queryReviewBySlug`
  review: {
    kind: 'slug',
    condition: 'destinationType == "page"',
    title: 'coalesce(name, pt::text(title), "Recenzja")',
  },
  // app/certyfikowany-sprzet-uzywany/page.tsx
  cpoPage: pin('/certyfikowany-sprzet-uzywany/', 'Sprzęt CPO'),
  // app/certyfikowany-sprzet-uzywany/[slug]/page.tsx — `queryCpoProductBySlug`
  cpoProduct: {
    kind: 'slug',
    condition: 'productType == "internal" && isArchived != true',
    title: 'coalesce(brandName + " " + name, name, "Produkt CPO")',
  },
  // app/polityka-prywatnosci/page.tsx
  privacyPolicy: pin('/polityka-prywatnosci/', 'Polityka prywatności'),
  // app/regulamin/page.tsx
  termsAndConditions: pin('/regulamin/', 'Regulamin'),
} satisfies Record<string, RouteConfig>;

export type RoutedType = keyof typeof ROUTES;

function routeOf(type: string): RouteConfig | undefined {
  return (ROUTES as Record<string, RouteConfig>)[type];
}

/** One type's href expression, compiled from its route config. */
export function hrefExpression(config: RouteConfig): string {
  if (config.kind === 'pin') return JSON.stringify(config.path);

  const path = config.pathPrefix
    ? `${JSON.stringify(config.pathPrefix)} + slug.current`
    : 'slug.current';
  return config.condition ? `select(${config.condition} => ${path})` : path;
}

/**
 * GROQ expressions evaluating to a document's public href, or `null` when the
 * document has no page (no slug yet, or the web route would reject it).
 */
export const HREF_EXPRESSIONS: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTES).map(([type, config]) => [
    type,
    hrefExpression(config),
  ]),
);

/** GROQ expressions for the human label shown next to a location. */
export const TITLE_EXPRESSIONS: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTES).map(([type, config]) => [type, config.title]),
);

export function isRoutedType(type: string): type is RoutedType {
  return routeOf(type) !== undefined;
}

/**
 * The public path for a stored slug value — the TypeScript twin of
 * `hrefExpression`, compiled from the same table so the slug field's URL line
 * and the Presentation locations can never disagree. Eligibility conditions
 * (`review.destinationType`, `cpoProduct.productType`) are not applied here:
 * the slug field shows where the slug WOULD live.
 *
 * Types without a route (and slug fields the table does not own, like
 * `review.pdfSlug`, whose stored value already is the full path) get the
 * stored value back unchanged.
 */
export function publicPathForSlug(
  type: string,
  slug: string | undefined,
): string {
  const config = routeOf(type);
  if (config?.kind === 'pin') return config.path;
  if (!slug) return '/';
  return config?.kind === 'slug' && config.pathPrefix
    ? `${config.pathPrefix}${slug}`
    : slug;
}

/** One listing page a document ALSO appears on — rows in the "used on" panel. */
export type ParentLocation = {
  /**
   * GROQ expression evaluating to an ARRAY of `{title, href}` rows, in the
   * listed document's scope. A row whose href is `null` is dropped by the
   * resolver's `defined(href)` filter, so eligibility lives in the expression.
   */
  rows: string;
  /** Literal hrefs of these rows, for de-duplicating the referrer list. */
  hrefVariants: string[];
  /**
   * Set on the row the parent-pagination helper rewrites to `?page=N`
   * (`pagination.ts`). Its href must be the literal below.
   */
  paginated?: boolean;
};

/** A single fixed listing page, optionally gated by a GROQ predicate. */
function listing(
  title: string,
  href: string,
  condition?: string,
  options: { paginated?: boolean } = {},
): ParentLocation {
  const hrefExpr = condition
    ? `select(${condition} => ${JSON.stringify(href)})`
    : JSON.stringify(href);
  return {
    rows: `[{"title": ${JSON.stringify(title)}, "href": ${hrefExpr}}]`,
    hrefVariants: [href],
    ...options,
  };
}

/** Rows computed from the document itself (references it holds). */
function computed(rows: string): ParentLocation {
  return { rows: `coalesce(${rows}, [])`, hrefVariants: [] };
}

/**
 * The web's "product is visible in listings" rule (`productsFilterConditions`
 * without its request params, minus the denorm checks that only the
 * paginated helper needs): not archived, brand not hidden.
 */
const PRODUCT_VISIBLE = 'isArchived != true && brand->doNotShowBrand != true';

/**
 * Listing pages a document ALSO appears on. Purely informational: they give an
 * editor a second click target in the "used on" panel.
 *
 * Hand-kept rather than derived, because these pages surface the document
 * through a COLLECTION query, not a reference — `references()` cannot see
 * them, so nothing can compute this list.
 *
 * ⚠️ EVERY ROW MUST BE TRUE FOR EVERY DOCUMENT OF ITS TYPE. A row naming a
 * page that does not show the document promises a placement that is not
 * there, which is worse than a missing row. Rows that only hold for some
 * documents carry the web's own predicate as a GROQ `select()`, so the row is
 * `null` (and dropped) where the web would not list the document.
 */
export const PARENT_LOCATIONS: Record<string, ParentLocation[]> = {
  product: [
    // app/produkty/(listing)/page.tsx — default sort `priceAsc`.
    listing('Produkty', '/produkty/', undefined, { paginated: true }),
    // app/produkty/(listing)/kategoria/[category]/page.tsx lists a product in
    // every category it carries (paginated: `pagination.ts` subLists).
    computed(
      `select(${PRODUCT_VISIBLE} => categories[]->{"title": coalesce(name, "Kategoria produktów"), "href": "/produkty" + slug.current})`,
    ),
    // app/marki/[slug]/page.tsx — the brand's own product grid (paginated:
    // `pagination.ts` subLists).
    computed(
      `select(${PRODUCT_VISIBLE} => [{"title": coalesce(brand->name, "Marka"), "href": brand->slug.current}])`,
    ),
    // app/produkty/archiwalne/page.tsx — `queryArchivedProducts`.
    listing(
      'Produkty archiwalne',
      '/produkty/archiwalne/',
      'isArchived == true || brand->doNotShowBrand == true',
    ),
  ],
  'blog-article': [
    // app/blog/(listing)/page.tsx — default sort newest first.
    listing('Blog', '/blog/', undefined, { paginated: true }),
    // app/blog/(listing)/kategoria/[category]/page.tsx — same listing filter.
    computed(
      `select(hideFromList == false => [{"title": coalesce(category->name, "Kategoria bloga"), "href": category->slug.current}])`,
    ),
  ],
  // app/blog/(listing)/page.tsx — the category nav lists every category with
  // a slug (`queryBlogPageContent` "categories").
  'blog-category': [listing('Blog', '/blog/')],
  // app/marki/page.tsx — the `brands` singleton's `brandsList` block runs in
  // `brandsDisplayMode: "all"` (a Lake fact, verified 2026-10-27), which lists
  // every brand with `doNotShowBrand != true`. If an editor switches that
  // block to a hand-picked list, the picked brands become referrers and this
  // row must go.
  brand: [listing('Marki', '/marki/', 'doNotShowBrand != true')],
  // The product listings' category sidebar.
  productCategorySub: [listing('Produkty', '/produkty/')],
  // app/certyfikowany-sprzet-uzywany/page.tsx — the `cpoProductsListing`
  // block, default sort newest first. External products are listed too (they
  // link out), which is why `LISTED_WITHOUT_OWN_PAGE` names this type.
  cpoProduct: [
    listing('Sprzęt CPO', '/certyfikowany-sprzet-uzywany/', undefined, {
      paginated: true,
    }),
  ],
  // app/recenzje/archiwalne/page.tsx — `queryOrphanReviews`: page reviews no
  // visible product links to.
  review: [
    listing(
      'Recenzje archiwalne',
      '/recenzje/archiwalne/',
      `destinationType == "page" && count(*[_type == "product" && defined(slug.current) && isArchived != true && !(brand._ref in *[_type == "brand" && doNotShowBrand == true]._id) && ^._id in reviews[]._ref]) == 0`,
    ),
  ],
  // An award renders on the product pages it names (`award.products[]`, read
  // by `queryProductBySlug` "awards") — a FORWARD reference, which
  // `references($id)` cannot see from the award's side.
  award: [
    computed(
      `products[]->{"title": coalesce(brand->name + " " + name, name, "Produkt"), "href": slug.current}`,
    ),
  ],
};

/**
 * Routed types that appear on a listing even when they have no page of their
 * own (an external CPO product links out, but sits in the CPO grid). For every
 * other routed type a document without an href is not listed either.
 */
export const LISTED_WITHOUT_OWN_PAGE: ReadonlySet<string> = new Set([
  'cpoProduct',
]);

/**
 * GROQ for the message shown when a routed document has no href. Defaults to
 * the "fill in the slug" prompt; types whose web route rejects some documents
 * by design explain why instead.
 */
export const NO_HREF_MESSAGE =
  'Uzupełnij adres URL, aby zobaczyć, gdzie ta strona żyje.';

export const NO_HREF_MESSAGES: Record<string, string> = {
  review: `select(
    destinationType == "pdf" => "Recenzja PDF otwiera plik, nie stronę — poniżej strony produktów, które ją pokazują.",
    destinationType == "external" => "Recenzja zewnętrzna prowadzi do innego serwisu — poniżej strony, które ją pokazują.",
    ${JSON.stringify(NO_HREF_MESSAGE)}
  )`,
  cpoProduct: `select(
    productType == "external" => "Produkt zewnętrzny nie ma własnej strony — na liście CPO prowadzi do sklepu zewnętrznego.",
    isArchived == true => "Zarchiwizowany produkt CPO nie ma strony.",
    ${JSON.stringify(NO_HREF_MESSAGE)}
  )`,
};

/**
 * One-shot query resolving a single document's href. Used by the "open in
 * preview" action, which needs the path before it can navigate.
 */
export function hrefQuery(type: string): string {
  return `*[_id == $id][0]{"href": ${HREF_EXPRESSIONS[type]}}.href`;
}
