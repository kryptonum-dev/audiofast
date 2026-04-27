import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { redirectsMap } from './generated/redirects';

function isProtectedCustomerPanelPath(pathname: string) {
  return (
    pathname === '/konto-klienta/zamowienia' ||
    pathname.startsWith('/konto-klienta/zamowienia/') ||
    pathname === '/konto-klienta/dane-konta' ||
    pathname.startsWith('/konto-klienta/dane-konta/')
  );
}

function shouldRefreshSupabaseSession(pathname: string) {
  return (
    pathname === '/konto-klienta' ||
    pathname.startsWith('/konto-klienta/') ||
    pathname.startsWith('/koszyk/')
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const redirectMatch =
    redirectsMap.get(pathname) ||
    redirectsMap.get(
      pathname.endsWith('/') ? pathname.slice(0, -1) : `${pathname}/`,
    );

  if (redirectMatch) {
    const url = request.nextUrl.clone();
    url.pathname = redirectMatch.destination;

    return NextResponse.redirect(url, redirectMatch.permanent ? 308 : 307);
  }

  if (!shouldRefreshSupabaseSession(pathname)) {
    return NextResponse.next({
      request,
    });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedCustomerPanelPath(pathname)) {
    const url = request.nextUrl.clone();
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}${request.nextUrl.hash}`;

    url.pathname = '/konto-klienta/';
    url.search = `?returnTo=${encodeURIComponent(returnTo)}`;

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.[a-zA-Z0-9]+$).*)'],
};
