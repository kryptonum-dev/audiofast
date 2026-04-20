import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

function resolveSupabaseServerKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Create a Supabase client for protected server-side commerce operations.
 *
 * Prefer `SUPABASE_SERVICE_ROLE_KEY` for order/profile writes guarded by RLS.
 * Falls back to the anon key so local mocking and lower-privilege reads can
 * still run in development environments that have not been fully configured.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = resolveSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase server configuration for protected commerce operations.',
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
