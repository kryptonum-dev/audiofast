/**
 * Presentation constants shared by `sanity.config.ts`, the action, the tool
 * menu and the slug field. Kept free of `sanity` imports so tests can read it.
 */

/** Matches `SANITY_API_VERSION` / `NEXT_PUBLIC_SANITY_API_VERSION` in apps/web. */
export const PRESENTATION_API_VERSION = '2025-02-10';

export const LOCAL_WEB_ORIGIN = 'http://localhost:3000';
export const PRODUCTION_WEB_ORIGIN = 'https://audiofast.pl';

/**
 * Origins the Presentation iframe may load.
 *
 * ⚠️ Each one also needs a Sanity CORS entry created WITH credentials allowed
 * (`sanity cors add <origin> --credentials`) — the iframe reads the dataset
 * using the editor's own session cookie, and the unattended `cors add`
 * default is `allowCredentials: false`. Symptom of a missing flag: the iframe
 * loads, but every draft renders as published.
 */
export const PRESENTATION_ORIGINS = [LOCAL_WEB_ORIGIN, PRODUCTION_WEB_ORIGIN];

/**
 * Where Presentation points its iframe.
 *
 * Resolved LAZILY (passed as a function to `previewUrl.initial`), so a Studio
 * built without the variable still builds and boots — it fails loudly the
 * moment someone opens the tool, instead of taking the whole Studio down for
 * everyone who only wanted to edit a document.
 *
 * `SANITY_STUDIO_*` values are inlined at BUILD time, so this is a decision
 * made before `sanity deploy` (`apps/studio/.env`), never at runtime.
 */
export function getPresentationUrl(): string {
  if (process.env.NODE_ENV !== 'production') return LOCAL_WEB_ORIGIN;

  const url = process.env.SANITY_STUDIO_PRESENTATION_URL;

  if (!url) {
    throw new Error(
      'SANITY_STUDIO_PRESENTATION_URL is not set — the Presentation tool has no site to preview. Set it in apps/studio/.env before running `sanity build` / `sanity deploy`.',
    );
  }

  return url;
}
