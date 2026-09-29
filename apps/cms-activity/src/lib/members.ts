import { chunk } from './concurrency.js';
import type { HistoryRequestClient } from './history-client.js';
import type { ProjectMember, UserProfile } from './types.js';

/** Sanity's system author (migrations, internal writes). */
export const SYSTEM_AUTHOR_ID = 'god';

const USERS_BATCH_SIZE = 50;

/** People only: robots (API tokens) and the system author are excluded. */
export function selectHumanMembers<T extends ProjectMember>(
  members: readonly T[],
): T[] {
  return members.filter(
    (member) => member.isRobot === false && member.id !== SYSTEM_AUTHOR_ID,
  );
}

type UserResponse = {
  id?: unknown;
  displayName?: unknown;
  email?: unknown;
};

function toProfileEntry(user: UserResponse): [string, UserProfile] | null {
  if (typeof user.id !== 'string') return null;
  const email = typeof user.email === 'string' ? user.email : null;
  const displayName =
    typeof user.displayName === 'string' && user.displayName.trim() !== ''
      ? user.displayName
      : (email ?? user.id);
  return [user.id, { displayName, email }];
}

/**
 * Look up display names and emails via `GET /users/{ids}` on the project
 * host. Unknown ids are simply absent from the returned map.
 */
export async function resolveUserProfiles(
  client: HistoryRequestClient,
  ids: readonly string[],
  options: { signal?: AbortSignal } = {},
): Promise<Map<string, UserProfile>> {
  const unique = [...new Set(ids)].filter(
    (id) => id !== '' && id !== SYSTEM_AUTHOR_ID,
  );
  const profiles = new Map<string, UserProfile>();

  for (const batch of chunk(unique, USERS_BATCH_SIZE)) {
    const raw = await client.request<unknown>({
      uri: `/users/${batch.map((id) => encodeURIComponent(id)).join(',')}`,
      signal: options.signal,
    });
    // One id returns an object, several return an array.
    const users = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const user of users) {
      if (!user || typeof user !== 'object') continue;
      const entry = toProfileEntry(user as UserResponse);
      if (entry) profiles.set(entry[0], entry[1]);
    }
  }

  return profiles;
}

/** Human-readable author name with fallbacks for robots and the system. */
export function authorLabel(
  id: string,
  profiles: ReadonlyMap<string, UserProfile>,
): string {
  if (id === SYSTEM_AUTHOR_ID) return 'System';
  const profile = profiles.get(id);
  if (profile) return profile.displayName;
  return `Robot (${id})`;
}
