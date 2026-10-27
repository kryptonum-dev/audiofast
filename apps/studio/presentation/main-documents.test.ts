/**
 * `mainDocuments` is first-match-wins, so its order is a rule; and each
 * pattern's filter must actually find the document the web route renders —
 * evaluated here with groq-js against the fixture dataset, through a small
 * path matcher with Presentation's non-strict trailing-slash behaviour.
 */
import { describe, expect, test } from 'vitest';

import { buildMainDocuments, MAIN_DOCUMENT_ROUTES } from './main-documents';
import { ROUTES } from './routes';
import { query } from './test-dataset';

const resolvers = buildMainDocuments() as { route: string; filter: string }[];
const patterns = resolvers.map((resolver) => resolver.route);

function match(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean);
  const got = path.split('?')[0]!.split('/').filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of want.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = got[index]!;
    else if (part !== got[index]) return null;
  }
  return params;
}

/** First matching resolver → the `_id` its filter selects. */
async function documentFor(path: string): Promise<string | null> {
  for (const resolver of resolvers) {
    const params = match(resolver.route, path);
    if (!params) continue;
    return query<string | null>(`*[${resolver.filter}][0]._id`, params);
  }
  return null;
}

describe('mainDocuments — first match wins, so order is a rule', () => {
  const before = (a: string, b: string) => {
    expect(patterns).toContain(a);
    expect(patterns).toContain(b);
    expect(patterns.indexOf(a), `${a} must precede ${b}`).toBeLessThan(
      patterns.indexOf(b),
    );
  };

  test('category patterns precede their item patterns', () => {
    before('/produkty/kategoria/:slug', '/produkty/:slug');
    before('/blog/kategoria/:slug', '/blog/:slug');
  });

  test('the root catch-all is the last parameterised pattern', () => {
    const catchAll = patterns.indexOf('/:slug');
    for (const [index, pattern] of patterns.entries()) {
      if (pattern === '/:slug' || pattern === '/') continue;
      expect(index, `${pattern} sorts after /:slug`).toBeLessThan(catchAll);
    }
  });

  test('every routed type has a pattern', () => {
    const filters = MAIN_DOCUMENT_ROUTES.map((route) => route.filter);
    for (const type of Object.keys(ROUTES)) {
      expect(
        filters.some((filter) => filter.includes(`_type == "${type}"`)),
        type,
      ).toBe(true);
    }
  });

  test('B2C routes are never Presentation targets', () => {
    for (const path of [
      '/koszyk',
      '/konto-klienta',
      '/podziekowania-za-zakup',
    ]) {
      expect(patterns.some((pattern) => pattern.startsWith(path))).toBe(false);
    }
  });
});

describe('mainDocuments — each pattern finds its document', () => {
  const cases: [string, string | null][] = [
    ['/', 'homePage'],
    ['/produkty/', 'products'],
    ['/produkty/?page=3', 'products'],
    ['/produkty/p1/', 'product.1'],
    ['/produkty/kategoria/wzmacniacze/', 'cat.amp'],
    ['/produkty/archiwalne/', null],
    ['/marki/accuphase/', 'brand.a'],
    ['/blog/widoczny/', 'article.visible'],
    ['/blog/kategoria/nowosci/', 'blog-category.news'],
    ['/recenzje/test/', 'review.page'],
    ['/certyfikowany-sprzet-uzywany/uzywany/', 'cpo.internal'],
    ['/o-nas/', 'page.o-nas'],
    ['/nie-ma-takiej/', null],
  ];

  for (const [path, id] of cases) {
    test(`${path} → ${id ?? 'nothing'}`, async () => {
      expect(await documentFor(path)).toBe(id);
    });
  }
});
