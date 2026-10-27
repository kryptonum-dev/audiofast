// @vitest-environment node
/**
 * Gate: draft not-found status (failure classes G and M, research/03 §3.4).
 *
 * A document that has never been published must render in draft mode (200)
 * and stay not-found on the published site. That holds when every
 * slug-addressed route:
 *
 *   - dispatches through `renderDraftAware(Cached…)` (`global/sanity/
 *     draft-aware.tsx`), so a draft session resolves the Presentation
 *     perspective before the cached component runs, and never calls
 *     `notFound()` itself before that dispatch;
 *   - decides not-found ONLY inside the cached component, from fetches that
 *     receive the threaded `perspective`, never from a published-pinned read
 *     (`PUBLISHED`, `sanityFetchMetadata`, `sanityFetchPublished`) made
 *     before the last `notFound()`. Such a lookup would 404 the draft;
 *   - and the published branch of `renderDraftAware` renders the cached
 *     component directly, outside any Suspense boundary, so a published miss
 *     stays the route's own not-found.
 *
 * The live half (a real never-published draft answering 200 in draft mode
 * and not-found when published) runs in `check-stega-leaks.ts --mode both`,
 * which probes the dataset's draft-only documents. Adapted from lsse-www's
 * catch-all-only source assertion to every slug route.
 */
import { describe, expect, test } from 'vitest';

import { read, relative, repoPath, stripComments, walk } from './source';

const APP = repoPath('apps/web/src/app/');
const DRAFT_AWARE = repoPath('apps/web/src/global/sanity/draft-aware.tsx');

/** Draft-capable routes addressed by a slug segment. */
const routes = walk(APP, (name) => name === 'page.tsx')
  .filter((path) => /\/\[(?:slug|category)\]\//.test(path))
  .filter((path) => read(path).includes('renderDraftAware('));

/** The body of `function <name>(` up to the next top-level closing brace. */
function functionBody(source: string, opener: RegExp): string | null {
  const start = opener.exec(source);
  if (!start) return null;
  const end = source.indexOf('\n}\n', start.index);
  return source.slice(start.index, end === -1 ? undefined : end + 2);
}

describe('draft not-found status', () => {
  test('the slug routes were found', () => {
    const names = routes.map(relative);
    for (const expected of [
      'app/[slug]/page.tsx',
      'app/produkty/[slug]/page.tsx',
      'app/marki/[slug]/page.tsx',
      'app/blog/[slug]/page.tsx',
      'app/recenzje/[slug]/page.tsx',
      'app/certyfikowany-sprzet-uzywany/[slug]/page.tsx',
    ])
      expect(
        names.some((name) => name.endsWith(expected)),
        expected,
      ).toBe(true);
  });

  test('the published branch renders the cached component outside Suspense', () => {
    const source = stripComments(read(DRAFT_AWARE));
    expect(source).toMatch(
      /if \(!isDraft\) \{\s*return createElement\(Cached[\s\S]*?\.\.\.PUBLISHED,\s*\}\);\s*\}/,
    );
    expect(source).toMatch(
      /createElement\(Cached, \{ \.\.\.props, \.\.\.options, isDraft: true \}\)/,
    );
  });

  for (const route of routes) {
    const name = relative(route);

    test(`${name}: dispatches before any not-found`, () => {
      const source = stripComments(read(route));
      const page = functionBody(source, /export default async function \w+\(/);
      expect(page, 'no default-exported async page').not.toBeNull();
      expect(page).toMatch(/return renderDraftAware\(Cached\w+,/);
      expect(page).not.toContain('notFound(');
    });

    test(`${name}: not-found is decided on the threaded perspective`, () => {
      const source = stripComments(read(route));
      const cachedName = /return renderDraftAware\((Cached\w+),/.exec(
        source,
      )?.[1];
      expect(cachedName).toBeTruthy();
      const cached = functionBody(
        source,
        new RegExp(`async function ${cachedName}\\(`),
      );
      expect(cached, `${cachedName} not found`).not.toBeNull();
      expect(cached).toContain("'use cache'");
      expect(cached).toContain('notFound()');
      // A published-pinned read AFTER the last not-found (JSON-LD publisher
      // data, say) cannot hide a draft; one before it can.
      const decided = cached!.slice(0, cached!.lastIndexOf('notFound()'));
      expect(decided).not.toMatch(
        /\bPUBLISHED\b|sanityFetchMetadata|sanityFetchPublished/,
      );
      // Destructured from props AND passed on to a fetch.
      expect(
        (cached!.match(/\bperspective\b/g) ?? []).length,
      ).toBeGreaterThanOrEqual(2);
    });
  }
});
