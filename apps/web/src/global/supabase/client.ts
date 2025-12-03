import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Create a Supabase client for browser-side operations (Client Components)
 * This client automatically handles cookie-based sessions in the browser
 *
 * @returns Supabase client configured for client-side rendering
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
