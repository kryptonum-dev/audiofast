import { syncTagInvalidateEventHandler } from '@sanity/functions';

/**
 * The sync-tag relay: the correctness half of the live-content stack.
 *
 * Sanity invokes this after a publish with the sync tags the change
 * invalidated; the handler POSTs them to the web app's `/api/revalidate-tags/`,
 * which expires the matching `sanity:`-prefixed Next cache tags that
 * `defineLive`'s `sanityFetch` registered. It runs with zero connected
 * browsers, unlike the draft-only `<SanityLive>` mount.
 *
 * Idempotency is the safety mechanism (retry-on-throw semantics are
 * undocumented): expiring a tag twice, or a tag no entry carries, is a no-op.
 * The handler still throws on every failure so it surfaces in
 * `sanity functions logs invalidate-sync-tags`.
 *
 * Env, set imperatively per Function (`bunx sanity functions env add
 * invalidate-sync-tags <KEY> <value>`), never read from Vercel or `.env`:
 * - `REVALIDATE_ENDPOINT_URL` = `https://audiofast.pl/api/revalidate-tags/`.
 *   The TRAILING SLASH is load-bearing: the site runs `trailingSlash: true`
 *   and a slashless POST gets a 308 that drops the body.
 * - `SANITY_REVALIDATE_TAGS_SECRET` must be byte-identical to the Vercel value;
 *   a mismatch shows only as a 401 in these logs. It travels as a Bearer
 *   header, not a query string, so it never lands in Vercel request logs.
 *
 * `package.json` pins ONLY `@sanity/functions`: this is a bare `fetch`.
 */
export const handler = syncTagInvalidateEventHandler(
  async ({ event, done }) => {
    // `sanity functions test` delivers sync-tag events with no payload; POSTing
    // an empty list would be answered 200 — a successful invalidation of
    // nothing — so fail loudly instead.
    const { syncTags } = event.data ?? {};
    if (!Array.isArray(syncTags)) {
      throw new Error(
        `Sync-tag event carried no syncTags array: ${JSON.stringify(event.data ?? null).slice(0, 200)}`,
      );
    }

    const endpoint = process.env.REVALIDATE_ENDPOINT_URL;
    const secret = process.env.SANITY_REVALIDATE_TAGS_SECRET;
    if (!endpoint || !secret) {
      throw new Error(
        'Missing REVALIDATE_ENDPOINT_URL and/or SANITY_REVALIDATE_TAGS_SECRET. Set them with `bunx sanity functions env add invalidate-sync-tags <KEY> <value>`.',
      );
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tags: syncTags }),
      // A 3xx here means the URL lost its trailing slash; following it would
      // turn the POST into a body-less request and hide the misconfiguration.
      redirect: 'manual',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Revalidate endpoint responded ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    console.log(`Invalidated ${syncTags.length} sync tag(s) via ${endpoint}`);

    // Logs instead of throwing on purpose: the tags are already expired, so a
    // failed acknowledgement must not turn a successful invalidation into an
    // incident. `done()` only matters for `<SanityLive waitFor="function">`.
    try {
      await done(syncTags);
    } catch (error) {
      console.error(
        'Invalidation succeeded but acknowledging it to Sanity failed',
        error,
      );
    }
  },
);
