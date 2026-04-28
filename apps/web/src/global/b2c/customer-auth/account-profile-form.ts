import {
  CHECKOUT_DEFAULT_COUNTRY,
  type CheckoutBuyerType,
  createEmptyCheckoutAddress,
} from '@/src/global/b2c/checkout/form';
import type {
  CheckoutAddress,
  CheckoutContactInput,
  CheckoutInvoiceInput,
  CheckoutProfileInvoiceDefaults,
  CheckoutProfileShippingDefaults,
  CheckoutShippingAddressInput,
} from '@/src/global/b2c/checkout/types';

export type CustomerAccountProfileFormSource = {
  contact: CheckoutContactInput;
  defaultShippingAddress: CheckoutProfileShippingDefaults | null;
  defaultInvoiceData: CheckoutProfileInvoiceDefaults | null;
};

export type CustomerAccountProfileFormValues = {
  contact: CheckoutContactInput;
  shippingAddress: CheckoutShippingAddressInput;
  shippingRecipientDiffers: boolean;
  buyerType: CheckoutBuyerType;
  provideSeparateBillingAddress: boolean;
  invoiceCompanyName: string;
  invoiceTaxId: string;
  invoiceAddress: CheckoutAddress;
};

export type CustomerAccountProfileSubmitInput = {
  contact: CheckoutContactInput;
  shippingAddress: CheckoutShippingAddressInput;
  invoice: CheckoutInvoiceInput;
};

function createShippingAddressFromContact(
  contact: CheckoutContactInput,
): CheckoutShippingAddressInput {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    streetName: '',
    buildingNumber: '',
    apartmentNumber: null,
    postalCode: '',
    city: '',
    country: CHECKOUT_DEFAULT_COUNTRY,
  };
}

function normalizeNullableValue(value: string | null): string {
  return value?.trim() ?? '';
}

function doShippingRecipientDefaultsDiffer(args: {
  contact: CheckoutContactInput;
  shippingAddress: CheckoutShippingAddressInput;
}): boolean {
  return (
    args.shippingAddress.firstName.trim() !== args.contact.firstName.trim() ||
    args.shippingAddress.lastName.trim() !== args.contact.lastName.trim() ||
    normalizeNullableValue(args.shippingAddress.phone) !==
      normalizeNullableValue(args.contact.phone)
  );
}

export function buildCustomerAccountProfileFormValues(
  source: CustomerAccountProfileFormSource,
): CustomerAccountProfileFormValues {
  const shippingAddress =
    source.defaultShippingAddress ??
    createShippingAddressFromContact(source.contact);
  const invoiceData = source.defaultInvoiceData;

  return {
    contact: source.contact,
    shippingAddress,
    shippingRecipientDiffers: doShippingRecipientDefaultsDiffer({
      contact: source.contact,
      shippingAddress,
    }),
    buyerType: invoiceData?.recipientType === 'company' ? 'company' : 'private',
    provideSeparateBillingAddress:
      invoiceData?.recipientType === 'company' &&
      invoiceData.invoiceAddress !== null,
    invoiceCompanyName: invoiceData?.companyName ?? '',
    invoiceTaxId: invoiceData?.taxId ?? '',
    invoiceAddress: invoiceData?.invoiceAddress ?? createEmptyCheckoutAddress(),
  };
}

export function buildCustomerAccountProfileSubmitInput(
  values: CustomerAccountProfileFormValues,
): CustomerAccountProfileSubmitInput {
  const shippingAddress: CheckoutShippingAddressInput = {
    ...values.shippingAddress,
    firstName: values.shippingRecipientDiffers
      ? values.shippingAddress.firstName
      : values.contact.firstName,
    lastName: values.shippingRecipientDiffers
      ? values.shippingAddress.lastName
      : values.contact.lastName,
    phone: values.shippingRecipientDiffers
      ? values.shippingAddress.phone
      : values.contact.phone,
  };

  return {
    contact: values.contact,
    shippingAddress,
    invoice:
      values.buyerType === 'company'
        ? {
            recipientType: 'company',
            companyName: values.invoiceCompanyName.trim() || null,
            taxId: values.invoiceTaxId.trim() || null,
            invoiceAddress: values.provideSeparateBillingAddress
              ? values.invoiceAddress
              : {
                  streetName: shippingAddress.streetName,
                  buildingNumber: shippingAddress.buildingNumber,
                  apartmentNumber: shippingAddress.apartmentNumber,
                  postalCode: shippingAddress.postalCode,
                  city: shippingAddress.city,
                  country: shippingAddress.country,
                },
          }
        : {
            recipientType: 'private',
            companyName: null,
            taxId: null,
            invoiceAddress: null,
          },
  };
}
