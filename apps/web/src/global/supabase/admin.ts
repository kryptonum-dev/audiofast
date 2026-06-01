import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

/**
 * Create a Supabase client that authenticates with the service role key.
 *
 * This client bypasses Row Level Security and must never be imported from a
 * Client Component or exposed to the browser. Reserve it for server-side
 * system operations that policies intentionally deny to anon/authenticated
 * roles (order persistence, coupon usage increments, payment webhooks,
 * admin-panel writes, etc.).
 *
 * Callers should pick the least-privileged Supabase factory that can satisfy
 * the query:
 * - Public reads → `createClient` from `./server`.
 * - User-scoped reads → `createAuthServerClient` from `./server-auth`.
 * - RLS-bypassing writes → this factory.
 *
 * The function throws eagerly when the service role key is missing so that
 * misconfigured environments fail fast instead of silently degrading to the
 * anon key (which would then be silently denied by RLS, surfacing as opaque
 * `database_error` responses at the top of the stack).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Set it in the server environment before invoking protected commerce operations.',
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. The admin Supabase client requires a service-role key to bypass RLS for protected commerce operations. Add it to the server-only environment variables (never expose it to the browser).',
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
