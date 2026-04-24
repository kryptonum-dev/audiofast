import { describe, expect, it } from 'vitest';

import {
  isValidCustomerAuthEmail,
  normalizeCustomerAuthEmail,
} from './email';

describe('customer auth email helpers', () => {
  it('normalizes customer auth emails by trimming and lowercasing them', () => {
    expect(normalizeCustomerAuthEmail('  Jan.Kowalski@Example.COM  ')).toBe(
      'jan.kowalski@example.com',
    );
  });

  it('accepts valid emails after normalization', () => {
    expect(isValidCustomerAuthEmail('  Jan.Kowalski@Example.COM  ')).toBe(true);
  });

  it('rejects empty or malformed email values', () => {
    expect(isValidCustomerAuthEmail('   ')).toBe(false);
    expect(isValidCustomerAuthEmail('not-an-email')).toBe(false);
  });
});
