import { describe, expect, test } from 'vitest';

import { isSavedPreviewRoute, renamedPreviewUrl } from './slug-navigation';

describe('slug preview navigation', () => {
  test('keeps preview parameters when renaming a page', () => {
    expect(
      renamedPreviewUrl(
        'http://localhost:3000/produkty/stary/?sanity-preview-perspective=drafts#opis',
        '/produkty/stary/',
        '/produkty/nowy/',
      ),
    ).toBe('/produkty/nowy/?sanity-preview-perspective=drafts#opis');
  });

  test('does not redirect the host when a referenced document is renamed', () => {
    expect(
      renamedPreviewUrl('/marki/accuphase/', '/produkty/a/', '/produkty/b/'),
    ).toBeNull();
  });

  test('does not navigate on mount or without a preview', () => {
    expect(renamedPreviewUrl('/same/', '/same/', '/same/')).toBeNull();
    expect(renamedPreviewUrl(undefined, '/old/', '/new/')).toBeNull();
  });

  test('a sub-category follows under its /produkty path', () => {
    expect(
      renamedPreviewUrl(
        '/produkty/kategoria/stara/?page=2',
        '/produkty/kategoria/stara/',
        '/produkty/kategoria/nowa/',
      ),
    ).toBe('/produkty/kategoria/nowa/?page=2');
  });
});

describe('saved route perspective', () => {
  const published = { segment: '/stary/', href: '/stary/' };
  const draft = { segment: '/nowy/', href: '/nowy/' };

  test('an unpublished slug change cannot move a published preview', async () => {
    const perspectives: string[][] = [];
    const saved = await isSavedPreviewRoute(
      async (perspective: string[]) => {
        perspectives.push(perspective);
        return perspective.includes('drafts') ? draft : published;
      },
      ['published'],
      draft.segment,
      draft.href,
    );
    expect(perspectives).toEqual([['published']]);
    expect(saved).toBe(false);
  });

  test('a draft preview follows the saved draft slug', async () => {
    expect(
      await isSavedPreviewRoute(
        async (perspective: string[]) =>
          perspective.includes('drafts') ? draft : published,
        ['drafts'],
        draft.segment,
        draft.href,
      ),
    ).toBe(true);
  });
});
