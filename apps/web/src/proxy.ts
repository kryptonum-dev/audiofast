import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { redirectsMap } from './generated/redirects';

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

  // Do not insert additional auth-dependent logic between client creation
  // and getUser(), otherwise refreshed cookies can drift from the request.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.[a-zA-Z0-9]+$).*)'],
};
