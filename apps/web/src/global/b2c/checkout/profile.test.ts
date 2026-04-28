import { describe, expect, it } from 'vitest';

import {
  buildCheckoutProfileDefaultsFromOrder,
  type CheckoutCustomerProfileDefaultsRow,
  decideCheckoutProfilePersistence,
  mapCheckoutCustomerProfileRowToDefaults,
} from './profile';
import type { CheckoutSessionContext, CheckoutSubmitInput } from './types';

const guestSession: CheckoutSessionContext = {
  isAuthenticated: false,
  authUserId: null,
  authenticatedEmail: null,
  customerProfileId: null,
};

const authenticatedSession: CheckoutSessionContext = {
  isAuthenticated: true,
  authUserId: 'user-1',
  authenticatedEmail: 'jan@example.com',
  customerProfileId: 'profile-1',
};

function createSubmitInput(): CheckoutSubmitInput {
  return {
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
      companyName: 'Audiofast',
      taxId: '1234567890',
      invoiceAddress: {
        streetName: 'Firmowa',
        buildingNumber: '2',
        apartmentNumber: null,
        postalCode: '00-002',
        city: 'Warszawa',
        country: 'PL',
      },
    },
    consents: {
      termsAccepted: true,
      privacyPolicyAccepted: true,
    },
    newsletterOptIn: false,
    saveToProfile: true,
  };
}

function createCustomerProfileDefaultsRow(
  overrides: Partial<CheckoutCustomerProfileDefaultsRow> = {},
): CheckoutCustomerProfileDefaultsRow {
  return {
    email: 'jan@example.com',
    first_name: 'Jan',
    last_name: 'Kowalski',
    phone: '123123123',
    default_shipping_address: {
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
    default_invoice_data: {
      recipientType: 'company',
      companyName: 'Audiofast',
      taxId: '1234567890',
      invoiceAddress: {
        streetName: 'Firmowa',
        buildingNumber: '2',
        apartmentNumber: null,
        postalCode: '00-002',
        city: 'Warszawa',
        country: 'PL',
      },
    },
    ...overrides,
  };
}

describe('decideCheckoutProfilePersistence', () => {
  it('does not allow guests to store reusable defaults', () => {
    const result = decideCheckoutProfilePersistence(
      guestSession,
      null,
      createSubmitInput(),
    );

    expect(result).toEqual({
      shouldEnsureProfileAfterSuccessfulPayment: true,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
      reason: 'create_profile_without_defaults',
    });
  });

  it('allows authenticated customers to store defaults when requested', () => {
    const result = decideCheckoutProfilePersistence(
      authenticatedSession,
      {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
        defaultShippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
          streetName: 'Stara',
          buildingNumber: '3',
          apartmentNumber: null,
          postalCode: '00-003',
          city: 'Warszawa',
          country: 'PL',
        },
        defaultInvoiceData: null,
      },
      createSubmitInput(),
    );

    expect(result).toEqual({
      shouldEnsureProfileAfterSuccessfulPayment: true,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: true,
      reason: 'update_profile_with_defaults',
    });
  });
});

describe('buildCheckoutProfileDefaultsFromOrder', () => {
  it('maps paid-order snapshots into reusable profile defaults', () => {
    const result = buildCheckoutProfileDefaultsFromOrder({
      customerEmail: 'jan@example.com',
      customerSnapshot: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
      },
      shippingAddressSnapshot: {
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
      invoiceData: {
        recipientType: 'company',
        companyName: 'Audiofast',
        taxId: '1234567890',
        invoiceAddress: {
          streetName: 'Firmowa',
          buildingNumber: '2',
          apartmentNumber: null,
          postalCode: '00-002',
          city: 'Warszawa',
          country: 'PL',
        },
        storagePath: null,
        attachedAt: null,
      },
    });

    expect(result).toEqual({
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
        companyName: 'Audiofast',
        taxId: '1234567890',
        invoiceAddress: {
          streetName: 'Firmowa',
          buildingNumber: '2',
          apartmentNumber: null,
          postalCode: '00-002',
          city: 'Warszawa',
          country: 'PL',
        },
      },
    });
  });
});

describe('mapCheckoutCustomerProfileRowToDefaults', () => {
  it('maps customer_profiles reusable JSON into checkout profile defaults', () => {
    const result = mapCheckoutCustomerProfileRowToDefaults(
      createCustomerProfileDefaultsRow(),
    );

    expect(result).toEqual({
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
        companyName: 'Audiofast',
        taxId: '1234567890',
        invoiceAddress: {
          streetName: 'Firmowa',
          buildingNumber: '2',
          apartmentNumber: null,
          postalCode: '00-002',
          city: 'Warszawa',
          country: 'PL',
        },
      },
    });
  });

  it('returns null when stored shipping defaults are not usable', () => {
    expect(
      mapCheckoutCustomerProfileRowToDefaults(
        createCustomerProfileDefaultsRow({
          default_shipping_address: {
            firstName: 'Jan',
            country: 'PL',
          },
        }),
      ),
    ).toBeNull();
  });

  it('normalizes private invoice defaults to null invoice details', () => {
    const result = mapCheckoutCustomerProfileRowToDefaults(
      createCustomerProfileDefaultsRow({
        default_invoice_data: {
          recipientType: 'private',
          companyName: 'Should be ignored',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Firmowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      }),
    );

    expect(result?.defaultInvoiceData).toEqual({
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    });
  });
});
