export type AllowedUser = {
  id: string;
  email: string;
};

export type UserIdentity = {
  id: string;
  email?: string | null;
};

/**
 * True when the user matches an allowlist entry by id or by email
 * (case-insensitive, surrounding whitespace ignored).
 */
export function isAllowedUser(
  user: UserIdentity,
  allowed: readonly AllowedUser[],
): boolean {
  const email = user.email?.trim().toLowerCase() || null;

  return allowed.some(
    (entry) =>
      (user.id !== '' && entry.id === user.id) ||
      (email !== null && entry.email.trim().toLowerCase() === email),
  );
}
