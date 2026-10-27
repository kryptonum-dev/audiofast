/**
 * The preview-target ladder — own page → parent rows → first referrer → home
 * page — evaluated, not read: `PREVIEW_TARGET_QUERY` runs through groq-js over
 * the fixture dataset, and the resolvers get a fake client whose `fetch` is
 * groq-js.
 */
import { describe, expect, test } from 'vitest';

import {
  PREVIEW_TARGET_QUERY,
  type PreviewTargetClient,
  resolveOwnHref,
  resolvePreviewTarget,
} from './preview-target';
import { query } from './test-dataset';

const fakeClient = {
  fetch: <T>(groq: string, params?: Record<string, unknown>) =>
    query<T>(groq, params),
} as unknown as PreviewTargetClient;

const target = (id: string) =>
  query<{ type: string; href: string } | null>(PREVIEW_TARGET_QUERY, { id });

describe('PREVIEW_TARGET_QUERY', () => {
  test('a routed document gets its own page', async () => {
    expect(await target('product.1')).toEqual({
      type: 'product',
      href: '/produkty/p1/',
    });
    expect((await target('cat.amp'))?.href).toBe(
      '/produkty/kategoria/wzmacniacze/',
    );
  });

  test('a referenced-only document gets the first referring page', async () => {
    expect((await target('faq.1'))?.href).toBe('/kontakt/');
    expect((await target('store.1'))?.href).toBe('/marki/accuphase/');
  });

  test('an award opens the first product it names, before any referrer', async () => {
    expect((await target('award.1'))?.href).toBe('/produkty/p1/');
  });

  test('a PDF review falls through to the product showing it', async () => {
    expect((await target('review.pdf'))?.href).toBe('/produkty/p0/');
  });

  test('an unreferenced document, or one only chrome uses, gets the home page', async () => {
    expect((await target('faq.unused'))?.href).toBe('/');
    expect((await target('social.fb'))?.href).toBe('/');
    expect((await target('settings'))?.href).toBe('/');
  });

  test('a non-document id resolves to null', async () => {
    expect(await target('nope')).toBeNull();
  });
});

describe('resolvePreviewTarget', () => {
  test('normalises draft and release ids to the published id', async () => {
    for (const id of ['drafts.faq.1', 'versions.r1.faq.1', 'faq.1']) {
      expect(await resolvePreviewTarget(fakeClient, id)).toEqual({
        type: 'faq',
        href: '/kontakt/',
      });
    }
  });

  test('a non-document id is null', async () => {
    expect(await resolvePreviewTarget(fakeClient, 'drafts.nope')).toBeNull();
  });
});

describe('resolveOwnHref', () => {
  test('a routed document resolves its own page from any id form', async () => {
    expect(await resolveOwnHref(fakeClient, 'drafts.brand.a', 'brand')).toBe(
      '/marki/accuphase/',
    );
  });

  test('no own page means no href — never a fallback', async () => {
    expect(
      await resolveOwnHref(fakeClient, 'product.noslug', 'product'),
    ).toBeNull();
    expect(await resolveOwnHref(fakeClient, 'cpo.external', 'cpoProduct')).toBe(
      null,
    );
  });
});
