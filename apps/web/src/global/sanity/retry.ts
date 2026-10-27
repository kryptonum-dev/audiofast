// Shared by `live.ts` and `fetch.ts`. Kept in its own module so `live.ts`
// does not instantiate the fresh (token-bearing) client just to retry.

const SANITY_FETCH_ATTEMPTS = 3;
const SANITY_FETCH_RETRY_DELAY_MS = 500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Three attempts with 500/1000 ms backoff. Wraps the live fetch in `live.ts`
 * as well as the helpers in `fetch.ts`.
 */
export async function fetchSanityWithRetry<QueryResponse>(
  fetcher: () => Promise<QueryResponse>,
): Promise<QueryResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SANITY_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      if (attempt === SANITY_FETCH_ATTEMPTS) {
        break;
      }

      console.warn(
        `Sanity fetch failed; retrying (${attempt}/${SANITY_FETCH_ATTEMPTS}).`,
        error,
      );
      await wait(SANITY_FETCH_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}
