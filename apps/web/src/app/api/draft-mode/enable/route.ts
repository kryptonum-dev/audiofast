import { defineEnableDraftMode } from 'next-sanity/draft-mode';

import { client, readToken } from '@/src/global/sanity/client';

/**
 * The handshake Presentation navigates to when it opens the preview iframe
 * (`/api/draft-mode/enable/`, trailing slash: the slashless form costs a 308).
 *
 * It validates the preview secret against the dataset, which is why it needs
 * the token-carrying client (the base client is anonymous) and why this cannot
 * be a static route, and then sets the draft cookie plus the
 * `sanity-preview-perspective` cookie `getDynamicFetchOptions()` reads.
 *
 * CHIPS: `next-sanity` adds the `Partitioned` attribute when the response is
 * delivered inside the Studio's cross-site iframe; without it Safari drops the
 * cookie outright and preview silently shows published content. The Safari
 * lane is deferred (D8), so verify there before relying on Safari editors.
 *
 * A route handler rather than a Server Action because the browser is NAVIGATED
 * here; the disable half is the action (`app/actions/draft-mode.ts`), because
 * the preview bar already has a client to await it.
 */
export const { GET } = defineEnableDraftMode({
  // Typed against next-sanity's own `@sanity/client` copy; the app's single
  // client is `@sanity/client` 8 (same runtime surface, see `live.ts`).
  client: client.withConfig({
    token: readToken,
    useCdn: false,
  }) as unknown as Parameters<typeof defineEnableDraftMode>[0]['client'],
});
