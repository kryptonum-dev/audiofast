import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCheckoutAuthContext } from './auth-context';
import { loadCheckoutPageData } from './load-checkout';

vi.mock('./auth-context', () => ({
  loadCheckoutAuthContext: vi.fn(),
}));

describe('loadCheckoutPageData', () => {
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

    const result = await loadCheckoutPageData();

    expect(result).toEqual({
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
          streetName: '',
          buildingNumber: '',
          apartmentNumber: null,
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
        newsletterOptIn: false,
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
        phone: '123123123',
        defaultShippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: null,
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
        defaultInvoiceData: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Fakturowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      },
      canPrefillFromProfile: true,
      isEmailLocked: true,
    });

    const result = await loadCheckoutPageData();

    expect(result).toEqual({
      initialDraft: {
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: null,
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
        invoice: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Fakturowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
        consents: {
          termsAccepted: false,
          privacyPolicyAccepted: false,
        },
        newsletterOptIn: false,
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
        phone: '123123123',
        defaultShippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: null,
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
        defaultInvoiceData: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Fakturowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      },
      canPrefillFromProfile: true,
    });
  });

  it('falls back to a guest draft when auth context loading throws', async () => {
    vi.mocked(loadCheckoutAuthContext).mockRejectedValue(
      new Error('auth unavailable'),
    );

    const result = await loadCheckoutPageData();

    expect(result).toEqual({
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
          streetName: '',
          buildingNumber: '',
          apartmentNumber: null,
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
        newsletterOptIn: false,
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
    });
  });
});
