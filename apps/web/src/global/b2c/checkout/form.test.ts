import { describe, expect, it } from 'vitest';

import type { CheckoutDraft } from './types';
import {
  buildCheckoutFormValues,
  buildCheckoutSubmitInput,
} from './form';

function createDraft(overrides?: Partial<CheckoutDraft>): CheckoutDraft {
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
    ...overrides,
  };
}

describe('checkout form helpers', () => {
  it('builds company invoice form values from a checkout draft', () => {
    const values = buildCheckoutFormValues(
      createDraft({
        invoice: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Fakturowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-950',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      }),
    );

    expect(values).toMatchObject({
      shippingRecipientDiffers: false,
      buyerType: 'company',
      provideSeparateBillingAddress: true,
      invoiceCompanyName: 'Audiofast Sp. z o.o.',
      invoiceTaxId: '1234567890',
      acceptRequiredConsents: false,
      newsletterOptIn: false,
      invoiceAddress: {
        streetName: 'Fakturowa',
        buildingNumber: '2',
        apartmentNumber: null,
        postalCode: '00-950',
        city: 'Warszawa',
        country: 'PL',
      },
    });
  });

  it('shows a separate delivery recipient flag when shipping name differs', () => {
    const values = buildCheckoutFormValues(
      createDraft({
        shippingAddress: {
          ...createDraft().shippingAddress,
          firstName: 'Anna',
          lastName: 'Nowak',
        },
      }),
    );

    expect(values.shippingRecipientDiffers).toBe(true);
  });

  it('maps same-as-shipping invoice data into the checkout submit payload', () => {
    const input = buildCheckoutSubmitInput({
      ...buildCheckoutFormValues(createDraft()),
      buyerType: 'company',
      provideSeparateBillingAddress: false,
      invoiceCompanyName: 'Audiofast Sp. z o.o.',
      invoiceTaxId: '1234567890',
    });

    expect(input.invoice).toEqual({
      recipientType: 'company',
      companyName: 'Audiofast Sp. z o.o.',
      taxId: '1234567890',
      invoiceAddress: {
        streetName: 'Testowa',
        buildingNumber: '1',
        apartmentNumber: null,
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'PL',
      },
    });
  });

  it('falls back to contact name and phone when a separate delivery recipient is not selected', () => {
    const input = buildCheckoutSubmitInput({
      ...buildCheckoutFormValues(createDraft()),
      contact: {
        ...createDraft().contact,
        firstName: 'Adam',
        lastName: 'Nowak',
        phone: '500500500',
      },
      shippingAddress: {
        ...createDraft().shippingAddress,
        firstName: 'Janina',
        lastName: 'Kowalska',
        phone: '999999999',
      },
      shippingRecipientDiffers: false,
      acceptRequiredConsents: true,
    });

    expect(input.shippingAddress.firstName).toBe('Adam');
    expect(input.shippingAddress.lastName).toBe('Nowak');
    expect(input.shippingAddress.phone).toBe('500500500');
  });

  it('keeps the separate recipient phone when shipping recipient differs', () => {
    const input = buildCheckoutSubmitInput({
      ...buildCheckoutFormValues(createDraft()),
      shippingAddress: {
        ...createDraft().shippingAddress,
        firstName: 'Janina',
        lastName: 'Kowalska',
        phone: '999999999',
      },
      shippingRecipientDiffers: true,
      acceptRequiredConsents: true,
    });

    expect(input.shippingAddress.phone).toBe('999999999');
  });

  it('maps the combined required consent into both checkout consent flags', () => {
    const input = buildCheckoutSubmitInput({
      ...buildCheckoutFormValues(createDraft()),
      acceptRequiredConsents: true,
      newsletterOptIn: true,
    });

    expect(input.consents).toEqual({
      termsAccepted: true,
      privacyPolicyAccepted: true,
    });
  });
});
