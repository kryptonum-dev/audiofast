import type { MockP24ScenarioId } from './mock-payment-scenarios';
import type {
  CheckoutAddress,
  CheckoutDraft,
  CheckoutSubmitInput,
} from './types';

export type CheckoutBuyerType = 'private' | 'company';

export type CheckoutFormValues = {
  contact: CheckoutDraft['contact'];
  shippingAddress: CheckoutDraft['shippingAddress'];
  shippingRecipientDiffers: boolean;
  buyerType: CheckoutBuyerType;
  provideSeparateBillingAddress: boolean;
  invoiceCompanyName: string;
  invoiceTaxId: string;
  invoiceAddress: CheckoutAddress;
  acceptRequiredConsents: boolean;
  newsletterOptIn: boolean;
  saveToProfile: boolean;
  mockPaymentScenarioId: MockP24ScenarioId | null;
};

export const CHECKOUT_DEFAULT_COUNTRY: CheckoutAddress['country'] = 'PL';

export function createEmptyCheckoutAddress(): CheckoutAddress {
  return {
    streetName: '',
    buildingNumber: '',
    apartmentNumber: null,
    postalCode: '',
    city: '',
    country: CHECKOUT_DEFAULT_COUNTRY,
  };
}

export function buildCheckoutFormValues(
  draft: CheckoutDraft,
): CheckoutFormValues {
  const shippingRecipientDiffers =
    draft.shippingAddress.firstName.trim() !== draft.contact.firstName.trim() ||
    draft.shippingAddress.lastName.trim() !== draft.contact.lastName.trim();

  return {
    contact: draft.contact,
    shippingAddress: draft.shippingAddress,
    shippingRecipientDiffers,
    buyerType:
      draft.invoice.recipientType === 'company' ? 'company' : 'private',
    provideSeparateBillingAddress:
      draft.invoice.recipientType === 'company' &&
      draft.invoice.invoiceAddress !== null,
    invoiceCompanyName: draft.invoice.companyName ?? '',
    invoiceTaxId: draft.invoice.taxId ?? '',
    invoiceAddress:
      draft.invoice.invoiceAddress ?? createEmptyCheckoutAddress(),
    acceptRequiredConsents:
      draft.consents.termsAccepted && draft.consents.privacyPolicyAccepted,
    newsletterOptIn: draft.newsletterOptIn,
    saveToProfile: draft.saveToProfile,
    mockPaymentScenarioId: draft.mockPaymentScenarioId ?? null,
  };
}

export function buildCheckoutSubmitInput(
  values: CheckoutFormValues,
): CheckoutSubmitInput {
  const shippingAddress = {
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
                  streetName: values.shippingAddress.streetName,
                  buildingNumber: values.shippingAddress.buildingNumber,
                  apartmentNumber: values.shippingAddress.apartmentNumber,
                  postalCode: values.shippingAddress.postalCode,
                  city: values.shippingAddress.city,
                  country: values.shippingAddress.country,
                },
          }
        : {
            recipientType: 'private',
            companyName: null,
            taxId: null,
            invoiceAddress: null,
          },
    consents: {
      termsAccepted: values.acceptRequiredConsents,
      privacyPolicyAccepted: values.acceptRequiredConsents,
    },
    newsletterOptIn: values.newsletterOptIn,
    saveToProfile: values.saveToProfile,
    mockPaymentScenarioId: values.mockPaymentScenarioId ?? null,
  };
}
