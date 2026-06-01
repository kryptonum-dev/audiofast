import { REGEX } from '@/src/global/constants';

export function normalizeCustomerAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidCustomerAuthEmail(value: string): boolean {
  const normalizedEmail = normalizeCustomerAuthEmail(value);

  return normalizedEmail.length > 0 && REGEX.email.test(normalizedEmail);
}
