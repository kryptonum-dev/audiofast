import { describe, expect, it } from 'vitest';

import {
  buildCustomerAccountProfileFormValues,
  buildCustomerAccountProfileSubmitInput,
  type CustomerAccountProfileFormValues,
} from './account-profile-form';

function createFormValues(
  overrides: Partial<CustomerAccountProfileFormValues> = {},
): CustomerAccountProfileFormValues {
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
    shippingRecipientDiffers: false,
    buyerType: 'private',
    provideSeparateBillingAddress: false,
    invoiceCompanyName: '',
    invoiceTaxId: '',
    invoiceAddress: {
      streetName: '',
      buildingNumber: '',
      apartmentNumber: null,
      postalCode: '',
      city: '',
      country: 'PL',
    },
    ...overrides,
  };
}

describe('buildCustomerAccountProfileFormValues', () => {
  it('builds account form values from reusable profile defaults', () => {
    const result = buildCustomerAccountProfileFormValues({
      contact: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
      },
      defaultShippingAddress: {
        firstName: 'Anna',
        lastName: 'Nowak',
        phone: '987987987',
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

    expect(result).toEqual({
      contact: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
      },
      shippingAddress: {
        firstName: 'Anna',
        lastName: 'Nowak',
        phone: '987987987',
        streetName: 'Testowa',
        buildingNumber: '1',
        apartmentNumber: null,
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'PL',
      },
      shippingRecipientDiffers: true,
      buyerType: 'company',
      provideSeparateBillingAddress: true,
      invoiceCompanyName: 'Audiofast',
      invoiceTaxId: '1234567890',
      invoiceAddress: {
        streetName: 'Firmowa',
        buildingNumber: '2',
        apartmentNumber: null,
        postalCode: '00-002',
        city: 'Warszawa',
        country: 'PL',
      },
    });
  });

  it('seeds blank address fields from contact data when defaults are missing', () => {
    const result = buildCustomerAccountProfileFormValues({
      contact: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
      },
      defaultShippingAddress: null,
      defaultInvoiceData: null,
    });

    expect(result.shippingAddress).toEqual({
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      streetName: '',
      buildingNumber: '',
      apartmentNumber: null,
      postalCode: '',
      city: '',
      country: 'PL',
    });
    expect(result.shippingRecipientDiffers).toBe(false);
    expect(result.buyerType).toBe('private');
  });
});

describe('buildCustomerAccountProfileSubmitInput', () => {
  it('collapses shipping recipient fields to contact when recipient does not differ', () => {
    const result = buildCustomerAccountProfileSubmitInput(
      createFormValues({
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
          firstName: 'Anna',
          lastName: 'Nowak',
          phone: '987987987',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: null,
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
      }),
    );

    expect(result.shippingAddress).toEqual({
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      streetName: 'Testowa',
      buildingNumber: '1',
      apartmentNumber: null,
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    });
  });

  it('builds company invoice input with shipping address when billing address is shared', () => {
    const result = buildCustomerAccountProfileSubmitInput(
      createFormValues({
        buyerType: 'company',
        invoiceCompanyName: ' Audiofast ',
        invoiceTaxId: ' 123-456-78-90 ',
        provideSeparateBillingAddress: false,
      }),
    );

    expect(result.invoice).toEqual({
      recipientType: 'company',
      companyName: 'Audiofast',
      taxId: '123-456-78-90',
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
});
