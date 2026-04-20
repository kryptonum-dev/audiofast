import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCheckoutPage } from './checkout-load';
import { loadCheckoutAuthContext } from '@/src/global/b2c/checkout/server/auth-context';

vi.mock('@/src/global/b2c/checkout/server/auth-context', () => ({
  loadCheckoutAuthContext: vi.fn(),
}));

describe('loadCheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty guest draft when no authenticated context exists', async () => {
    vi.mocked(loadCheckoutAuthContext).mockResolvedValue({
      sessionContext: {
        isAuthenticated: false,
        authUserId: null,
        authenticatedEmail: null,
        customerProfileId: null,
      },
      customerProfile: null,
      canPrefillFromProfile: false,
      isEmailLocked: false,
    });

    const result = await loadCheckoutPage();

    expect(result).toEqual({
      ok: true,
      value: {
        initialDraft: {
          contact: {
            email: '',
            firstName: '',
            lastName: '',
            phone: null,
          },
          shippingAddress: {
            firstName: '',
            lastName: '',
            phone: null,
            street: '',
            postalCode: '',
            city: '',
            country: 'PL',
          },
          invoice: {
            recipientType: 'private',
            companyName: null,
            taxId: null,
            invoiceAddress: null,
          },
          consents: {
            termsAccepted: false,
            privacyPolicyAccepted: false,
          },
          saveToProfile: false,
          updatedAt: null,
        },
        isEmailLocked: false,
        sessionContext: {
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        },
        customerProfile: null,
        canPrefillFromProfile: false,
      },
    });
  });

  it('prefills the checkout draft for authenticated customers with saved defaults', async () => {
    vi.mocked(loadCheckoutAuthContext).mockResolvedValue({
      sessionContext: {
        isAuthenticated: true,
        authUserId: 'user-1',
        authenticatedEmail: 'jan@example.com',
        customerProfileId: 'profile-1',
      },
      customerProfile: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '+48123123123',
        defaultShippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '+48123123123',
          street: 'Testowa 1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
        defaultInvoiceData: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            street: 'Fakturowa 2',
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      },
      canPrefillFromProfile: true,
      isEmailLocked: true,
    });

    const result = await loadCheckoutPage();

    expect(result).toEqual({
      ok: true,
      value: {
        initialDraft: {
          contact: {
            email: 'jan@example.com',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123123123',
          },
          shippingAddress: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123123123',
            street: 'Testowa 1',
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
          invoice: {
            recipientType: 'company',
            companyName: 'Audiofast Sp. z o.o.',
            taxId: '1234567890',
            invoiceAddress: {
              street: 'Fakturowa 2',
              postalCode: '00-002',
              city: 'Warszawa',
              country: 'PL',
            },
          },
          consents: {
            termsAccepted: false,
            privacyPolicyAccepted: false,
          },
          saveToProfile: false,
          updatedAt: null,
        },
        isEmailLocked: true,
        sessionContext: {
          isAuthenticated: true,
          authUserId: 'user-1',
          authenticatedEmail: 'jan@example.com',
          customerProfileId: 'profile-1',
        },
        customerProfile: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '+48123123123',
          defaultShippingAddress: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123123123',
            street: 'Testowa 1',
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
          defaultInvoiceData: {
            recipientType: 'company',
            companyName: 'Audiofast Sp. z o.o.',
            taxId: '1234567890',
            invoiceAddress: {
              street: 'Fakturowa 2',
              postalCode: '00-002',
              city: 'Warszawa',
              country: 'PL',
            },
          },
        },
        canPrefillFromProfile: true,
      },
    });
  });
});
