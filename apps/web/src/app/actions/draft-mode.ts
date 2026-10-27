'use server';

import { draftMode } from 'next/headers';

/**
 * Turns draft mode off for the current browser.
 *
 * A Server Action rather than a route handler: the preview bar is a client
 * component that awaits the result and then calls `router.refresh()`, and an
 * action gives it that without a fetch, a URL to protect, or a redirect. It
 * takes no input, so nothing a visitor sends can reach the fetch layer.
 *
 * The matching enable half is `/api/draft-mode/enable/`, a route handler,
 * because Presentation navigates the browser to it.
 */
export async function disableDraftMode(): Promise<void> {
  const draft = await draftMode();
  draft.disable();
}
