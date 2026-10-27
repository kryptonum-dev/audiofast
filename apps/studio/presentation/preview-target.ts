import { getPublishedId, type SanityClient } from 'sanity';

import { parentRowsExpression, REFERRER_HREF, ROUTED_TYPES } from './locations';
import { hrefQuery, isRoutedType, PARENT_LOCATIONS } from './routes';

/**
 * "Which page should Presentation show for this document?" — answered once,
 * for every caller that opens Presentation on a document: the „Otwórz w
 * podglądzie" action (`plugins/presentation-url.ts`) and the „Podgląd" tab of
 * the tool menu (`contextual-tool-menu.tsx`). One module, so the two never
 * drift apart.
 *
 * The ladder, first hit wins — the order the "used on" panel lists a
 * document's pages (`locations.ts`):
 *
 *   1. the document's OWN page — a routed type with an href;
 *   2. for a referenced-only type, a page it appears on through its own
 *      `PARENT_LOCATIONS` rows (an award's products), which `references($id)`
 *      cannot see;
 *   3. the first ROUTED document that references it, in the panel's referrer
 *      order (`references($id)`, `[defined(href)]`, `order(href asc)`);
 *   4. the home page.
 *
 * Every read runs on the `drafts` perspective, off the CDN, against the
 * PUBLISHED id: an editor works on drafts, a slug typed seconds ago must
 * already count, and references always point at published ids.
 *
 * The query strings are exported as plain values so
 * `preview-target.test.ts` can evaluate them with groq-js — a valid query that
 * resolves to `null` passes every other gate.
 */

/** The part of `SanityClient` this module reads — a fake in tests. */
export type PreviewTargetClient = Pick<SanityClient, 'fetch'>;

export type PreviewTarget = {
  type: string;
  href: string;
};

/**
 * Step 2, evaluated in the document's own scope. Routed types are left out on
 * purpose: the panel shows their parent rows only beside an own href, which
 * step 1 has already resolved. `null` when no such row resolves, so the
 * `coalesce` moves on.
 */
const PARENT_HREF = (() => {
  const branches = Object.keys(PARENT_LOCATIONS)
    .filter((type) => !isRoutedType(type))
    .map(
      (type) =>
        `_type == ${JSON.stringify(type)} => ${parentRowsExpression(type)}[0].href`,
    );

  return branches.length > 0 ? `select(${branches.join(', ')})` : 'null';
})();

/** Step 3, evaluated in the document's scope. */
const FIRST_REFERRER_HREF = `((*[_type in ${ROUTED_TYPES} && references($id)]{"href": ${REFERRER_HREF}})[defined(href)] | order(href asc))[0].href`;

/**
 * The whole ladder in one round trip. Step 1 reuses `REFERRER_HREF` in the
 * document's OWN scope: the type-agnostic `select()` over every routed type's
 * href yields the document's own href for a routed type with a page and
 * `null` for anything else — `hrefQuery(type)` without knowing the type first.
 */
export const PREVIEW_TARGET_QUERY = `*[_id == $id][0]{
  "type": _type,
  "href": coalesce(
    ${REFERRER_HREF},
    ${PARENT_HREF},
    ${FIRST_REFERRER_HREF},
    "/"
  )
}`;

const fetchOptions = (tag: string) =>
  ({ perspective: 'drafts', useCdn: false, tag }) as const;

/**
 * Resolves `{type, href}` for a document id (draft, release or published form
 * — all normalise to the published id), or `null` when the id is not a
 * document.
 */
export async function resolvePreviewTarget(
  client: PreviewTargetClient,
  id: string,
): Promise<PreviewTarget | null> {
  const result = await client.fetch<{ type?: unknown; href?: unknown } | null>(
    PREVIEW_TARGET_QUERY,
    { id: getPublishedId(id) },
    fetchOptions('presentation.preview-target'),
  );

  if (typeof result?.type !== 'string' || typeof result.href !== 'string') {
    return null;
  }

  return { type: result.type, href: result.href };
}

/**
 * Step 1 alone: the document's own href, or `null` when it has none yet.
 *
 * The „Otwórz w podglądzie" action reads this rather than the whole ladder on
 * purpose: it is offered only on routed types, and for a routed document
 * without a page its job is the „Brak adresu strony" toast that tells the
 * editor what to fill in — a referrer or home-page fallback would hide that.
 */
export function resolveOwnHref(
  client: PreviewTargetClient,
  id: string,
  type: string,
): Promise<string | null> {
  return client.fetch<string | null>(
    hrefQuery(type),
    { id: getPublishedId(id) },
    fetchOptions('presentation.open-in'),
  );
}
