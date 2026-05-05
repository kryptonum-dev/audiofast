import { describe, expect, it } from 'vitest';

import {
  buildP24NotificationSign,
  buildP24RegistrationSign,
  buildP24VerificationSign,
} from './p24-sign';

describe('p24-sign', () => {
  it('builds deterministic REST registration signs', () => {
    expect(
      buildP24RegistrationSign({
        sessionId: 'AF-2026-00001',
        merchantId: 392337,
        amount: 230_00,
        currency: 'PLN',
        crc: 'test-crc',
      }),
    ).toBe(
      '1c94cfc5d95a3a734003b3abb3f6e0d1c15926430148d715177e44de8ea2ada18242a8c25508373f905720393ce4986e',
    );
  });

  it('builds deterministic REST verification signs', () => {
    expect(
      buildP24VerificationSign({
        sessionId: 'AF-2026-00001',
        orderId: 123456789,
        amount: 230_00,
        currency: 'PLN',
        crc: 'test-crc',
      }),
    ).toBe(
      '50c165702276314bf88f2e9502d73e779aac70bb515560e6a66479d9e7fb3cd48ca4174b6c1690670e64a63165a3a68d',
    );
  });

  it('builds deterministic notification signs for callback validation', () => {
    expect(
      buildP24NotificationSign({
        merchantId: 392337,
        posId: 392337,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        originAmount: 230_00,
        currency: 'PLN',
        orderId: 123456789,
        methodId: 241,
        statement: 'AF-2026-00001',
        crc: 'test-crc',
      }),
    ).toBe(
      'faef48ac9c730130370bae2a3baced73656b0b53e335b0af75c3bc2e4636a76270ec32fb6be46323c26f34a84a3a91b3',
    );
  });
});
