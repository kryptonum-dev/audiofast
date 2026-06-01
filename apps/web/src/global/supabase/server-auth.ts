import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from './database.types';

/**
 * Create a cookie-aware Supabase client for authenticated server reads.
 *
 * This should be used only when request-time auth/session context matters.
 */
export async function createAuthServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase auth configuration.');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components may expose a read-only cookie store.
        }
      },
    },
  });
}
