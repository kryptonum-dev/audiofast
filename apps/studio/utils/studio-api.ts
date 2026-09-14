import type { Workspace } from 'sanity';

const PRODUCTION_NEWSLETTER_API_URL =
  'https://audiofast.pl/api/newsletter/generate/';
const LOCAL_NEWSLETTER_API_URL =
  'http://localhost:3000/api/newsletter/generate/';

export function resolveStudioApiUrl(path = '/api/newsletter/generate/') {
  // In local Studio development prefer local web API,
  // so newsletter HTML generation uses current code changes.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return new URL(path, LOCAL_NEWSLETTER_API_URL).href;
    }
  }

  return new URL(path, PRODUCTION_NEWSLETTER_API_URL).href;
}

function normalizeStoredSanityToken(value: string): string {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === 'string') {
      return parsed;
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'token' in parsed &&
      typeof parsed.token === 'string'
    ) {
      return parsed.token;
    }
  } catch {
    // Studio auth tokens are normally stored as plain strings.
  }

  return value;
}

// Sanity v5 keeps the session token in the workspace auth store (backed by
// the `__studio_auth_token_<projectId>` localStorage key). The store's token
// observable emits its current value synchronously on subscribe, so a
// subscribe-and-unsubscribe read is safe. Cookie-based sessions have no
// token — the observable emits null and the API call cannot be authorized.
function getAuthStoreToken(auth: Workspace['auth']): string | null {
  const result: { token: string | null } = { token: null };
  const subscription = auth.token?.subscribe((value) => {
    result.token = value;
  });
  subscription?.unsubscribe();

  return result.token;
}

// Pre-v5 Studios stored the token under `__sanity_auth_token_<projectId>` —
// kept only as a legacy fallback.
function getLegacyStoredToken(projectId: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedToken = window.localStorage.getItem(
    `__sanity_auth_token_${projectId}`,
  );

  return storedToken ? normalizeStoredSanityToken(storedToken) : null;
}

export function getStudioAuthToken({
  auth,
  projectId,
}: Pick<Workspace, 'auth' | 'projectId'>): string | null {
  return getAuthStoreToken(auth) ?? getLegacyStoredToken(projectId);
}
