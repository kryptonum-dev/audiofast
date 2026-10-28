/**
 * The Presentation resolver gates.
 *
 *   1. COMPLETENESS. `locations()` returns `null` for a type in none of its
 *      three lists (routed, `STATIC_LOCATIONS`, `REFERENCED_ONLY_TYPES`), and a
 *      `null` resolver is a "used on" panel that is silently absent. Every
 *      registered document type must land in exactly one list.
 *   2. The resolver queries EVALUATED over a fixture dataset with groq-js —
 *      a valid query resolving to the wrong shape passes every other gate.
 */
import { of } from 'rxjs';
import type { DocumentLocationsState } from 'sanity/presentation';
import { describe, expect, test } from 'vitest';

import { documents } from '../schemaTypes/documents';
import {
  listenQuery,
  locations,
  REFERENCED_ONLY_TYPES,
  referencedLocationsQuery,
  routedLocationsQuery,
  STATIC_LOCATIONS,
} from './locations';
import { resolvePaginatedParent } from './pagination';
import { HREF_EXPRESSIONS, PARENT_LOCATIONS } from './routes';
import { query } from './test-dataset';

const documentTypeNames = documents.map((type) => type.name as string);

describe('locations resolver — completeness', () => {
  test('the registry was read', () => {
    expect(documentTypeNames.length).toBeGreaterThanOrEqual(29);
  });

  for (const name of documentTypeNames) {
    test(`${name} resolves to exactly one list`, () => {
      const routed = name in HREF_EXPRESSIONS;
      const isStatic = name in STATIC_LOCATIONS;
      const referenced = REFERENCED_ONLY_TYPES.includes(name);
      expect(
        routed || isStatic || referenced,
        `${name}: in none of HREF_EXPRESSIONS, STATIC_LOCATIONS, REFERENCED_ONLY_TYPES — the "used on" panel is silently absent`,
      ).toBe(true);
      expect(
        [routed, isStatic, referenced].filter(Boolean).length,
        `${name}: listed more than once`,
      ).toBe(1);
    });
  }

  test('no list names a type the schema does not register', () => {
    const known = new Set(documentTypeNames);
    for (const name of [
      ...Object.keys(HREF_EXPRESSIONS),
      ...Object.keys(STATIC_LOCATIONS),
      ...REFERENCED_ONLY_TYPES,
      ...Object.keys(PARENT_LOCATIONS),
    ]) {
      expect(known.has(name), `${name}: not a registered document`).toBe(true);
    }
  });

  test('every static message is Polish copy, not empty', () => {
    for (const [type, state] of Object.entries(STATIC_LOCATIONS)) {
      expect(state.message, type).toMatch(/\S{3,}/);
    }
  });
});

type State = DocumentLocationsState & Record<string, unknown>;

async function routed(type: string, id: string) {
  const state = await query<State>(routedLocationsQuery(type), { id });
  return resolvePaginatedParent(state);
}

const hrefs = (state: DocumentLocationsState | null) =>
  (state?.locations ?? []).map((location) => location.href);

describe('routed locations, evaluated', () => {
  test('a product: own page, listing, category, brand, then referrers', async () => {
    const state = await routed('product', 'product.1');
    expect(hrefs(state)).toEqual([
      '/produkty/p1/',
      '/produkty/',
      '/produkty/kategoria/wzmacniacze/',
      '/marki/accuphase/',
    ]);
    expect(state?.message).toBeNull();
  });

  test('a product on the second listing page points at ?page=2', async () => {
    // 13+ fixture products in price order (no prices: ties keep dataset
    // order): index 12 sits on page 2.
    const state = await routed('product', 'product.12');
    expect(hrefs(state)).toContain('/produkty/?page=2');
    expect(hrefs(state)).not.toContain('/produkty/');
  });

  test('a product in two categories lists both', async () => {
    const state = await routed('product', 'product.two-cats');
    // Each category row is paged on its own (`?page=N` dropped here).
    expect(hrefs(state).map((href) => href.split('?')[0])).toEqual(
      expect.arrayContaining([
        '/produkty/kategoria/przetworniki/',
        '/produkty/kategoria/wzmacniacze/',
      ]),
    );
  });

  test('an archived product is on the archive, not the listings', async () => {
    const state = await routed('product', 'product.archived');
    expect(hrefs(state)).toEqual(['/produkty/stary/', '/produkty/archiwalne/']);
  });

  test('a product of a hidden brand is on the archive only', async () => {
    const state = await routed('product', 'product.hidden-brand');
    expect(hrefs(state)).toEqual([
      '/produkty/ukryty/',
      '/produkty/archiwalne/',
    ]);
  });

  test('a product without a slug asks for one, in caution tone', async () => {
    const state = await routed('product', 'product.noslug');
    expect(hrefs(state)).toEqual([]);
    expect(state?.message).toContain('Uzupełnij adres URL');
    expect(state?.tone).toBe('caution');
  });

  test('a PDF review explains itself and lists the products showing it', async () => {
    const state = await routed('review', 'review.pdf');
    expect(state?.message).toContain('Recenzja PDF');
    expect(state?.tone).toBeNull();
    expect(hrefs(state)).toEqual(['/produkty/p0/']);
  });

  test('a page review no visible product links to is on the archive', async () => {
    expect(hrefs(await routed('review', 'review.orphan'))).toEqual([
      '/recenzje/sierota/',
      '/recenzje/archiwalne/',
    ]);
    expect(hrefs(await routed('review', 'review.page'))).toEqual([
      '/recenzje/test/',
      '/produkty/p0/',
    ]);
  });

  test('an external CPO product has no page but sits in the CPO listing', async () => {
    const state = await routed('cpoProduct', 'cpo.external');
    expect(hrefs(state)).toEqual(['/certyfikowany-sprzet-uzywany/']);
    expect(state?.message).toContain('Produkt zewnętrzny');
  });

  test('a hidden blog article keeps its page but leaves the listings', async () => {
    expect(hrefs(await routed('blog-article', 'article.visible'))).toEqual([
      '/blog/widoczny/',
      '/blog/',
      '/blog/kategoria/nowosci/',
    ]);
    expect(hrefs(await routed('blog-article', 'article.hidden'))).toEqual([
      '/blog/ukryty/',
    ]);
  });

  test('a brand lists its page, /marki/ and the products naming it', async () => {
    const state = await routed('brand', 'brand.a');
    expect(hrefs(state).slice(0, 2)).toEqual(['/marki/accuphase/', '/marki/']);
    expect(hrefs(state)).toContain('/produkty/p1/');
    expect(hrefs(await routed('brand', 'brand.h'))).not.toContain('/marki/');
  });

  test('a sub-category lists its own page and the product listing', async () => {
    const state = await routed('productCategorySub', 'cat.amp');
    expect(hrefs(state).slice(0, 2)).toEqual([
      '/produkty/kategoria/wzmacniacze/',
      '/produkty/',
    ]);
  });
});

describe('referenced-only locations, evaluated', () => {
  const referenced = (type: string, id: string) =>
    query<State>(referencedLocationsQuery(type), { id });

  test('a FAQ lists the pages embedding it, deduplicated and ordered', async () => {
    expect(hrefs(await referenced('faq', 'faq.1'))).toEqual([
      '/kontakt/',
      '/o-nas/',
    ]);
  });

  test('a team member used on a page and in settings lists the page', async () => {
    const state = await referenced('teamMember', 'team.anna');
    expect(hrefs(state)).toEqual(['/o-nas/']);
    expect(state.message).toBeNull();
  });

  test('an award lists the products it names (a forward reference)', async () => {
    expect(hrefs(await referenced('award', 'award.1'))).toEqual([
      '/produkty/p1/',
      '/produkty/p2/',
    ]);
  });

  test('a store lists the brand pages that carry it', async () => {
    expect(hrefs(await referenced('store', 'store.1'))).toEqual([
      '/marki/accuphase/',
    ]);
  });

  test('a category group lists its sub-categories', async () => {
    expect(hrefs(await referenced('productCategoryParent', 'cat.p'))).toEqual([
      '/produkty/kategoria/przetworniki/',
      '/produkty/kategoria/wzmacniacze/',
    ]);
  });

  test('an unreferenced document has an empty list and no message', async () => {
    const state = await referenced('faq', 'faq.unused');
    expect(hrefs(state)).toEqual([]);
    expect(state.message).toBeNull();
  });
});

describe('the resolver itself', () => {
  function run(type: string, emitted: unknown) {
    let seen: { fetch: string; listen: string } | undefined;
    let options: { perspective?: unknown } | undefined;
    const context = {
      documentStore: {
        listenQuery(
          value: { fetch: string; listen: string },
          _params: unknown,
          opts: { perspective?: unknown },
        ) {
          seen = value;
          options = opts;
          return of(emitted);
        },
      },
    } as unknown as Parameters<typeof locations>[1];
    const result = locations(
      { id: 'x', type, version: undefined, perspectiveStack: [] },
      context,
    );
    return { result, seen: () => seen, options: () => options };
  }

  test('static types answer without a query', () => {
    const { result, seen } = run('navbar', null);
    expect(result).toBe(STATIC_LOCATIONS.navbar);
    expect(seen()).toBeUndefined();
  });

  test('an unknown type answers null', () => {
    expect(run('sanity.imageAsset', null).result).toBeNull();
  });

  test('defaults to the drafts perspective and listens on listing types', () => {
    const { result, seen, options } = run('product', {
      locations: [{ title: 'Produkty', href: '/produkty/' }],
      parentPagination: {
        id: 'x',
        pageSize: 1,
        lists: [{ href: '/produkty/', ids: ['a', 'x'] }],
      },
    });
    const values: unknown[] = [];
    if (result && 'subscribe' in result)
      result.subscribe((v) => values.push(v));
    expect(values).toEqual([
      {
        locations: [
          { title: 'Produkty — strona 2', href: '/produkty/?page=2' },
        ],
      },
    ]);
    expect(options()?.perspective).toBe('drafts');
    expect(seen()?.listen).toBe(listenQuery('product'));
    expect(listenQuery('product')).toContain('"brand"');
    expect(listenQuery('faq')).toBe(
      '*[_id in [$id, $draftId] || references($id)]',
    );
  });
});
