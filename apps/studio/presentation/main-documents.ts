import type { DocumentResolver } from 'sanity/presentation';
import { defineDocuments } from 'sanity/presentation';

import { type RoutedType, ROUTES } from './routes';

/**
 * Route → document resolution: which document the Presentation pane opens for
 * the page shown in the iframe.
 *
 * ⚠️ WEB MIRROR, like `routes.ts`: one pattern per `apps/web/src/app` route
 * that renders a CMS document. B2C routes (`/koszyk`, `/konto-klienta`,
 * `/podziekowania-za-zakup/:n`) are deliberately absent — they are not CMS
 * documents and never Presentation targets.
 *
 * Patterns are PATH-ONLY (URLPattern / path-to-regexp syntax, matched
 * non-strictly, so the trailing slash and `?page=N` match on their own).
 * Pinned types reuse their path from `ROUTES`; slug types compare the stored
 * FULL path (`/produkty/foo/`), rebuilt from the `:slug` param exactly the way
 * each web route rebuilds it.
 *
 * ⚠️ FIRST MATCH WINS. `getRouteContext` returns the first pattern that
 * matches, so ordering is not cosmetic: `/produkty/kategoria/:slug` must
 * precede `/produkty/:slug`, and the root `/:slug` catch-all goes last. The
 * sort below encodes that as a rule (deeper first, then more leading literal
 * segments) rather than as a hand-kept sequence.
 */

type MainDocumentRoute = {
  route: string;
  filter: string;
};

/** `/produkty/` → `/produkty`; `/` stays `/`. */
function withoutTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

function pinned(type: RoutedType): MainDocumentRoute {
  const config = ROUTES[type];
  if (config.kind !== 'pin') throw new Error(`${type} is not a pinned route`);
  return {
    route: withoutTrailingSlash(config.path),
    filter: `_type == ${JSON.stringify(type)}`,
  };
}

/**
 * A slug route: `routePrefix` is the URL segment(s) before `:slug`,
 * `storedPrefix` what `slug.current` starts with (they differ only for
 * `productCategorySub`, stored as `/kategoria/<x>/`).
 */
function bySlug(
  type: RoutedType,
  routePrefix: string,
  storedPrefix: string = routePrefix,
  extraFilter?: string,
): MainDocumentRoute {
  return {
    route: `${routePrefix}:slug`,
    filter: [
      `_type == ${JSON.stringify(type)}`,
      `slug.current == ${JSON.stringify(storedPrefix)} + $slug + "/"`,
      ...(extraFilter ? [extraFilter] : []),
    ].join(' && '),
  };
}

/** Every route → document pattern, in declaration order (sorted below). */
export const MAIN_DOCUMENT_ROUTES: MainDocumentRoute[] = [
  pinned('homePage'),
  pinned('products'),
  // app/produkty/(listing)/kategoria/[category]/page.tsx
  bySlug('productCategorySub', '/produkty/kategoria/', '/kategoria/'),
  // app/produkty/[slug]/page.tsx (`/produkty/archiwalne` is its own static
  // route with no document; it would match here and select nothing.)
  bySlug('product', '/produkty/'),
  pinned('brands'),
  bySlug('brand', '/marki/'),
  pinned('blog'),
  bySlug('blog-category', '/blog/kategoria/'),
  bySlug('blog-article', '/blog/'),
  // app/recenzje/[slug]/page.tsx renders page reviews only.
  bySlug('review', '/recenzje/', '/recenzje/', 'destinationType == "page"'),
  pinned('cpoPage'),
  bySlug('cpoProduct', '/certyfikowany-sprzet-uzywany/'),
  pinned('privacyPolicy'),
  pinned('termsAndConditions'),
  // app/porownaj/page.tsx renders around `comparatorConfig`, which has no
  // `ROUTES` row (`STATIC_LOCATIONS` explains why).
  { route: '/porownaj', filter: '_type == "comparatorConfig"' },
  // app/[slug]/page.tsx — the catch-all, sorted last by the rule below.
  bySlug('page', '/'),
];

function segments(route: string): string[] {
  return route.split('/').filter(Boolean);
}

/** Leading segments that are literal text rather than `:params`. */
function literalPrefixLength(route: string): number {
  const parts = segments(route);
  const firstParam = parts.findIndex((part) => part.startsWith(':'));
  return firstParam === -1 ? parts.length : firstParam;
}

/** Deeper patterns first; at equal depth, more leading literal segments first. */
export function sortMainDocumentRoutes<T extends { route: string }>(
  routes: readonly T[],
): T[] {
  return [...routes].sort((a, b) => {
    const depth = segments(b.route).length - segments(a.route).length;
    if (depth !== 0) return depth;
    return literalPrefixLength(b.route) - literalPrefixLength(a.route);
  });
}

export function buildMainDocuments(): DocumentResolver[] {
  return sortMainDocumentRoutes(MAIN_DOCUMENT_ROUTES).map(
    ({ route, filter }) => ({ route, filter }),
  );
}

export const mainDocuments = defineDocuments(buildMainDocuments());
