import { type NextRequest, NextResponse } from 'next/server';

import { redirectsMap } from './generated/redirects';

/**
 * Proxy for handling legacy URL redirects.
 *
 * Uses a pre-built Map for O(1) lookup performance.
 * Regenerate from Sanity using: bun run generate:redirects
 * Only runs on initial page loads, not client-side navigations.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this path needs to be redirected
  // Try both with and without trailing slash to handle inconsistent data
  const redirect =
    redirectsMap.get(pathname) ||
    redirectsMap.get(
      pathname.endsWith('/') ? pathname.slice(0, -1) : `${pathname}/`,
    );

  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect.destination;

    // Use 308 for permanent (cacheable) or 307 for temporary
    return NextResponse.redirect(url, redirect.permanent ? 308 : 307);
  }

  // No redirect needed, continue to the app
  return NextResponse.next();
}

/**
 * Matcher config: Only run proxy on paths that could be legacy URLs.
 * This prevents proxy from running on static assets, API routes, etc.
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (Next.js internals)
     * - api (API routes)
     * - static files with extensions (.ico, .svg, .png, .jpg, .jpeg, .gif, .webp, .css, .js, .woff, .woff2)
     */
    '/((?!_next|api|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
