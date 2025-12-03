import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Create a Supabase client for server-side operations (Server Components, Route Handlers, Server Actions)
 * This is a simple client for public data access only - no authentication/session management needed
 * Perfect for static generation as it doesn't depend on cookies or request-time data
 *
 * @returns Supabase client configured for server-side rendering
 */
export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
