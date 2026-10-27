/**
 * The route table evaluated, not read: every href expression is run through
 * groq-js over the fixture dataset, and the TypeScript twin used by the slug
 * field is checked against it.
 */
import { describe, expect, test } from 'vitest';

import {
  HREF_EXPRESSIONS,
  hrefQuery,
  isRoutedType,
  publicPathForSlug,
  ROUTES,
} from './routes';
import { DATASET, query } from './test-dataset';

const hrefOf = (id: string) => {
  const doc = DATASET.find((d) => d._id === id);
  if (!doc) throw new Error(`no fixture ${id}`);
  return query<string | null>(hrefQuery(doc._type), { id });
};

describe('HREF_EXPRESSIONS', () => {
  test('full-path slugs are the href', async () => {
    expect(await hrefOf('product.1')).toBe('/produkty/p1/');
    expect(await hrefOf('brand.a')).toBe('/marki/accuphase/');
    expect(await hrefOf('page.o-nas')).toBe('/o-nas/');
    expect(await hrefOf('article.visible')).toBe('/blog/widoczny/');
    expect(await hrefOf('blog-category.news')).toBe('/blog/kategoria/nowosci/');
  });

  test('a sub-category is served under /produkty', async () => {
    expect(await hrefOf('cat.amp')).toBe('/produkty/kategoria/wzmacniacze/');
  });

  test('pinned singletons resolve to their fixed path', async () => {
    expect(await hrefOf('homePage')).toBe('/');
    expect(await hrefOf('products')).toBe('/produkty/');
  });

  test('only page reviews have a page', async () => {
    expect(await hrefOf('review.page')).toBe('/recenzje/test/');
    expect(await hrefOf('review.pdf')).toBeNull();
    expect(await hrefOf('review.external')).toBeNull();
  });

  test('only internal, unarchived CPO products have a page', async () => {
    expect(await hrefOf('cpo.internal')).toBe(
      '/certyfikowany-sprzet-uzywany/uzywany/',
    );
    expect(await hrefOf('cpo.external')).toBeNull();
    expect(await hrefOf('cpo.archived')).toBeNull();
  });

  test('a document without a slug has no href — the null is a contract', async () => {
    expect(await hrefOf('product.noslug')).toBeNull();
  });

  test('every routed type compiles to a parseable expression', async () => {
    for (const type of Object.keys(HREF_EXPRESSIONS)) {
      await expect(query(hrefQuery(type), { id: 'nope' })).resolves.toBeNull();
    }
  });
});

describe('publicPathForSlug — the slug field shares the table', () => {
  test('matches the GROQ href for every slug-routed fixture', async () => {
    for (const doc of DATASET) {
      const config = (ROUTES as Record<string, { kind: string }>)[doc._type];
      if (config?.kind !== 'slug') continue;
      const href = await query<string | null>(hrefQuery(doc._type), {
        id: doc._id,
      });
      if (href === null) continue;
      const stored = (doc.slug as { current: string }).current;
      expect(publicPathForSlug(doc._type, stored), doc._id).toBe(href);
    }
  });

  test('fixes the sub-category prefix and keeps stored full paths', () => {
    expect(publicPathForSlug('productCategorySub', '/kategoria/x/')).toBe(
      '/produkty/kategoria/x/',
    );
    expect(publicPathForSlug('review', '/recenzje/pdf/plik/')).toBe(
      '/recenzje/pdf/plik/',
    );
    expect(publicPathForSlug('homePage', '/')).toBe('/');
    expect(publicPathForSlug('page', undefined)).toBe('/');
  });

  test('isRoutedType', () => {
    expect(isRoutedType('product')).toBe(true);
    expect(isRoutedType('settings')).toBe(false);
  });
});
