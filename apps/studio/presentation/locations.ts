import { map } from 'rxjs';
import type {
  DocumentLocationResolver,
  DocumentLocationsState,
} from 'sanity/presentation';

import {
  paginatedParentConfig,
  parentPaginationProjection,
  resolvePaginatedParent,
} from './pagination';
import {
  HREF_EXPRESSIONS,
  LISTED_WITHOUT_OWN_PAGE,
  NO_HREF_MESSAGE,
  NO_HREF_MESSAGES,
  PARENT_LOCATIONS,
  TITLE_EXPRESSIONS,
} from './routes';

/**
 * Presentation's "used on" resolver: document → the pages it appears on.
 * (URL → document lives in `main-documents.ts`.)
 */

const SITE_WIDE_MESSAGE =
  'Używane w elementach globalnych (nawigacja, stopka lub ustawienia) — widoczne na całej witrynie.';

/**
 * Documents that own no URL and whose computed answer would mislead.
 *
 * They need an explicit message, because the honest computed answer — an
 * empty location list — renders as "not used on any pages", which is
 * technically true of the navbar document and completely misleading.
 *
 * Exported, like `REFERENCED_ONLY_TYPES`, for `locations.test.ts` — the gate
 * that proves every document type lands in exactly one of the three lists.
 */
export const STATIC_LOCATIONS: Record<string, DocumentLocationsState> = {
  settings: {
    message:
      'Ustawienia globalne wpływają na każdą stronę serwisu (dane kontaktowe, SEO, dane strukturalne).',
  },
  navbar: { message: 'Nawigacja pojawia się na każdej stronie serwisu.' },
  footer: { message: 'Stopka pojawia się na każdej stronie serwisu.' },
  socialMedia: {
    message:
      'Profile społecznościowe pojawiają się w stopce i w danych strukturalnych każdej strony.',
  },
  redirects: {
    message: 'Przekierowania działają przed stroną — nie mają podglądu.',
  },
  notFound: {
    message:
      'Strona 404 — otwórz dowolny nieistniejący adres, aby ją podejrzeć.',
  },
  // The comparator page renders this config only around products picked in
  // the visitor's own comparison (cookie-driven), so there is no stable page
  // to list. `/porownaj` still resolves to it in `mainDocuments`.
  comparatorConfig: {
    message:
      'Konfiguracja porównywarki steruje tabelą na stronie /porownaj/ — dodaj produkty do porównania, aby ją podejrzeć.',
  },
};

/**
 * Documents that own no URL but DO surface on pages through references. Their
 * locations come from a reverse-reference query (plus any `PARENT_LOCATIONS`
 * rows of their own — an award's products).
 *
 * ⚠️ HAND-KEPT. A reference-data type left out of every list makes the
 * resolver return `null`, and the "used on" panel is silently absent — no
 * error, just nothing. The completeness test is the guard.
 */
export const REFERENCED_ONLY_TYPES = [
  'store',
  'award',
  'teamMember',
  'faq',
  'reviewAuthor',
  'youtubeVideo',
  'productCategoryParent',
];

/**
 * Chrome singletons. A reference from one of these means "visible site-wide",
 * not "visible on a page", so they are kept out of the referrer list and
 * turned into a message instead.
 */
const SITE_WIDE_TYPES = ['navbar', 'footer', 'settings'];

function quoteList(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

/**
 * Every routed type as a GROQ list literal — the `_type in …` the referrer
 * queries filter by. Exported, with `REFERRER_HREF`, for `preview-target.ts`,
 * whose referrer fallback must list pages in the same order and by the same
 * rule as the panel here.
 */
export const ROUTED_TYPES = quoteList(Object.keys(HREF_EXPRESSIONS));
const SITE_WIDE = quoteList(SITE_WIDE_TYPES);

/**
 * `select()` mapping a document's `_type` to its href through the route
 * table. Type-agnostic: evaluated in ANY document's scope it yields that
 * document's own href (`null` for a non-routed type or a missing slug).
 */
export const REFERRER_HREF = `select(${Object.entries(HREF_EXPRESSIONS)
  .map(([type, href]) => `_type == ${JSON.stringify(type)} => ${href}`)
  .join(', ')})`;

const REFERRER_TITLE = `select(${Object.entries(TITLE_EXPRESSIONS)
  .map(([type, title]) => `_type == ${JSON.stringify(type)} => ${title}`)
  .join(', ')}, "Strona")`;

/**
 * Every routed document referencing `$id`, projected to `{title, href}`.
 *
 * `references()` matches a reference ANYWHERE in the document, so a reference
 * buried in a page-builder block counts — which is the whole reason this panel
 * is useful. Post-filters: `[defined(href)]` drops referrers without a page;
 * the exclusion list removes hrefs already emitted as parent rows; the order
 * keeps the panel stable across refetches.
 */
function referrersExpression(excludeHrefs: readonly string[]): string {
  const exclude = excludeHrefs.length
    ? ` && !(href in ${quoteList(excludeHrefs)})`
    : '';

  return `(*[_type in ${ROUTED_TYPES} && references($id)]{
      "title": ${REFERRER_TITLE},
      "href": ${REFERRER_HREF}
    })[defined(href)${exclude}] | order(href asc)`;
}

/** A type's `PARENT_LOCATIONS` as one GROQ array expression (or `[]`). */
export function parentRowsExpression(type: string): string {
  const parents = PARENT_LOCATIONS[type] ?? [];
  return parents.length
    ? `(${parents.map((parent) => parent.rows).join(' + ')})[defined(href)]`
    : '[]';
}

function parentHrefVariants(type: string): string[] {
  return (PARENT_LOCATIONS[type] ?? []).flatMap(
    (parent) => parent.hrefVariants,
  );
}

/**
 * The query for a routed type, whose RESULT already is a
 * `DocumentLocationsState`: `[own page, …parent listings, …referring pages]`.
 */
export function routedLocationsQuery(type: string): string {
  const href = HREF_EXPRESSIONS[type];
  const title = TITLE_EXPRESSIONS[type];
  const parents = parentRowsExpression(type);
  const parentConfig = paginatedParentConfig(type);
  const withoutOwnPage = LISTED_WITHOUT_OWN_PAGE.has(type) ? parents : '[]';
  const noHrefMessage =
    NO_HREF_MESSAGES[type] ?? JSON.stringify(NO_HREF_MESSAGE);

  return `*[_id == $id][0]{
    ${parentConfig ? parentPaginationProjection(parentConfig) : ''}
    "locations": select(
      defined(${href}) => [{"title": ${title}, "href": ${href}}] + ${parents},
      ${withoutOwnPage}
    ) + ${referrersExpression(parentHrefVariants(type))},
    "message": select(!defined(${href}) => ${noHrefMessage}),
    "tone": select(!defined(${href}) && ${noHrefMessage} == ${JSON.stringify(NO_HREF_MESSAGE)} => "caution")
  }`;
}

/**
 * Referenced-only types list their parent rows, then the pages that embed
 * them. When nothing lists the document and the only referrers are chrome
 * singletons — a team member used solely in settings — the routed list is
 * legitimately empty and would render as "not used anywhere", so the
 * site-wide message takes over.
 */
export function referencedLocationsQuery(type: string): string {
  const parents = parentRowsExpression(type);

  return `*[_id == $id][0]{
    "locations": ${parents} + ${referrersExpression(parentHrefVariants(type))},
    "message": select(
      count(${parents}) == 0
        && count(*[_type in ${ROUTED_TYPES} && references($id)]) == 0
        && count(*[_type in ${SITE_WIDE} && references($id)]) > 0
        => ${JSON.stringify(SITE_WIDE_MESSAGE)}
    )
  }`;
}

/** The Listen API filter for a type: broad, because only the filter counts. */
export function listenQuery(type: string): string {
  const parentConfig = paginatedParentConfig(type);
  const collections = parentConfig
    ? ` || _type in ${quoteList(parentConfig.listenTypes)}`
    : '';
  return `*[_id in [$id, $draftId] || references($id)${collections}]`;
}

/**
 * "Used on" resolution for every document type.
 *
 * The FUNCTION form, not a `defineLocations` record: record resolvers go
 * through the preview `select` machinery, which can follow a forward
 * reference but cannot run real GROQ — and this panel needs `references($id)`.
 *
 * The query is split into `{fetch, listen}` because the Listen API only
 * honours a query's TOP-LEVEL FILTER; projections and subqueries are ignored.
 * So the listen half matches the document, its draft (references point at
 * published ids, but the editor mutates `drafts.*`) and anything referencing
 * it, and each event refetches the full projection.
 */
export const locations: DocumentLocationResolver = (params, context) => {
  const staticState = STATIC_LOCATIONS[params.type];
  if (staticState) return staticState;

  const isRouted = params.type in HREF_EXPRESSIONS;
  if (!isRouted && !REFERENCED_ONLY_TYPES.includes(params.type)) return null;

  const result = context.documentStore.listenQuery(
    {
      fetch: isRouted
        ? routedLocationsQuery(params.type)
        : referencedLocationsQuery(params.type),
      listen: listenQuery(params.type),
    },
    { id: params.id, draftId: `drafts.${params.id}` },
    {
      // Resolve against whatever the iframe is rendering, so the panel matches
      // the page the editor is looking at. Falls back to drafts, not
      // published: editors browse drafts.
      perspective: params.perspectiveStack.length
        ? params.perspectiveStack
        : 'drafts',
      tag: 'presentation.locations',
    },
  );

  return paginatedParentConfig(params.type)
    ? result.pipe(map(resolvePaginatedParent))
    : result;
};
