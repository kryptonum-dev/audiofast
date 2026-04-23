import type { Json } from '@/src/global/supabase/database.types';

import type {
  CheckoutCustomerSnapshot,
  CheckoutDraft,
  CheckoutInvoiceDataSnapshot,
  CheckoutInvoiceInput,
  CheckoutProfileDefaults,
  CheckoutProfileInvoiceDefaults,
  CheckoutProfileShippingDefaults,
  CheckoutSessionContext,
  CheckoutShippingAddressSnapshot,
  CheckoutSubmitInput,
} from './types';
import { createEmptyCheckoutDraft } from './validation';

export type CheckoutProfilePersistenceReason =
  | 'create_profile_without_defaults'
  | 'create_profile_with_defaults'
  | 'update_profile_without_defaults'
  | 'update_profile_with_defaults';

export type CheckoutProfilePersistenceDecision = {
  shouldEnsureProfileAfterSuccessfulPayment: boolean;
  shouldStoreCheckoutDefaultsAfterSuccessfulPayment: boolean;
  reason: CheckoutProfilePersistenceReason;
};

export type CheckoutOrderProfilePersistence =
  CheckoutProfilePersistenceDecision & {
    authUserIdAtCheckout: string | null;
  };

function isRecord(
  value: Json | null | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCheckoutProfilePersistenceReason(
  value: Json | undefined,
): value is CheckoutProfilePersistenceReason {
  return (
    value === 'create_profile_without_defaults' ||
    value === 'create_profile_with_defaults' ||
    value === 'update_profile_without_defaults' ||
    value === 'update_profile_with_defaults'
  );
}

export function createCheckoutProfileShippingDefaults(
  input: CheckoutSubmitInput,
): CheckoutProfileShippingDefaults {
  return {
    firstName: input.shippingAddress.firstName,
    lastName: input.shippingAddress.lastName,
    phone: input.shippingAddress.phone,
    streetName: input.shippingAddress.streetName,
    buildingNumber: input.shippingAddress.buildingNumber,
    apartmentNumber: input.shippingAddress.apartmentNumber,
    postalCode: input.shippingAddress.postalCode,
    city: input.shippingAddress.city,
    country: input.shippingAddress.country,
  };
}

export function createCheckoutProfileInvoiceDefaults(
  input: CheckoutSubmitInput,
): CheckoutProfileInvoiceDefaults | null {
  if (input.invoice.recipientType === 'private') {
    return null;
  }

  return {
    recipientType: input.invoice.recipientType,
    companyName: input.invoice.companyName,
    taxId: input.invoice.taxId,
    invoiceAddress: input.invoice.invoiceAddress,
  };
}

export function buildCheckoutProfileDefaultsFromSubmit(
  input: CheckoutSubmitInput,
): CheckoutProfileDefaults {
  return {
    email: input.contact.email,
    firstName: input.contact.firstName,
    lastName: input.contact.lastName,
    phone: input.contact.phone,
    defaultShippingAddress: createCheckoutProfileShippingDefaults(input),
    defaultInvoiceData: createCheckoutProfileInvoiceDefaults(input),
  };
}

export function createCheckoutProfileInvoiceDefaultsFromSnapshot(
  invoiceData: CheckoutInvoiceDataSnapshot | null,
): CheckoutProfileInvoiceDefaults | null {
  if (!invoiceData) {
    return null;
  }

  return {
    recipientType: invoiceData.recipientType,
    companyName: invoiceData.companyName,
    taxId: invoiceData.taxId,
    invoiceAddress: invoiceData.invoiceAddress,
  };
}

export function buildCheckoutProfileDefaultsFromOrder(args: {
  customerEmail: string;
  customerSnapshot: CheckoutCustomerSnapshot;
  shippingAddressSnapshot: CheckoutShippingAddressSnapshot;
  invoiceData: CheckoutInvoiceDataSnapshot | null;
}): CheckoutProfileDefaults {
  return {
    email: args.customerEmail,
    firstName: args.customerSnapshot.firstName,
    lastName: args.customerSnapshot.lastName,
    phone: args.customerSnapshot.phone,
    defaultShippingAddress: {
      ...args.shippingAddressSnapshot,
    },
    defaultInvoiceData: createCheckoutProfileInvoiceDefaultsFromSnapshot(
      args.invoiceData,
    ),
  };
}

export function buildCheckoutDraftFromProfile(
  profile: CheckoutProfileDefaults,
): CheckoutDraft {
  const emptyDraft = createEmptyCheckoutDraft();

  return {
    ...emptyDraft,
    contact: {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    },
    shippingAddress: {
      ...profile.defaultShippingAddress,
    },
    invoice: buildCheckoutInvoiceFromProfile(profile.defaultInvoiceData),
  };
}

export function buildCheckoutInvoiceFromProfile(
  profileInvoiceData: CheckoutProfileInvoiceDefaults | null,
): CheckoutInvoiceInput {
  if (!profileInvoiceData) {
    return {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    };
  }

  return {
    recipientType: profileInvoiceData.recipientType,
    companyName: profileInvoiceData.companyName,
    taxId: profileInvoiceData.taxId,
    invoiceAddress: profileInvoiceData.invoiceAddress,
  };
}

export function canPrefillOrderFormFromProfile(
  sessionContext: CheckoutSessionContext,
  profile: CheckoutProfileDefaults | null,
): boolean {
  return Boolean(
    sessionContext.isAuthenticated &&
      sessionContext.authenticatedEmail &&
      profile &&
      profile.email.toLowerCase() ===
        sessionContext.authenticatedEmail.toLowerCase(),
  );
}

export function shouldLockOrderFormEmail(
  sessionContext: CheckoutSessionContext,
): boolean {
  return (
    sessionContext.isAuthenticated && Boolean(sessionContext.authenticatedEmail)
  );
}

export function buildCheckoutOrderProfilePersistence(
  sessionContext: CheckoutSessionContext,
  decision: CheckoutProfilePersistenceDecision,
): CheckoutOrderProfilePersistence {
  return {
    ...decision,
    authUserIdAtCheckout: sessionContext.authUserId,
  };
}

export function parseCheckoutOrderProfilePersistence(
  value: Json | null,
): CheckoutOrderProfilePersistence | null {
  if (!isRecord(value)) {
    return null;
  }

  const shouldEnsureProfileAfterSuccessfulPayment =
    value.shouldEnsureProfileAfterSuccessfulPayment;
  const shouldStoreCheckoutDefaultsAfterSuccessfulPayment =
    value.shouldStoreCheckoutDefaultsAfterSuccessfulPayment;
  const authUserIdAtCheckout = value.authUserIdAtCheckout;
  const reason = value.reason;

  if (
    typeof shouldEnsureProfileAfterSuccessfulPayment !== 'boolean' ||
    typeof shouldStoreCheckoutDefaultsAfterSuccessfulPayment !== 'boolean' ||
    !isCheckoutProfilePersistenceReason(reason)
  ) {
    return null;
  }

  if (
    authUserIdAtCheckout !== null &&
    typeof authUserIdAtCheckout !== 'string'
  ) {
    return null;
  }

  return {
    shouldEnsureProfileAfterSuccessfulPayment,
    shouldStoreCheckoutDefaultsAfterSuccessfulPayment,
    authUserIdAtCheckout,
    reason,
  };
}

export function decideCheckoutProfilePersistence(
  sessionContext: CheckoutSessionContext,
  existingProfile: CheckoutProfileDefaults | null,
  input: CheckoutSubmitInput,
): CheckoutProfilePersistenceDecision {
  const shouldStoreCheckoutDefaults =
    sessionContext.isAuthenticated && input.saveToProfile;

  if (!existingProfile) {
    return {
      shouldEnsureProfileAfterSuccessfulPayment: true,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment:
        shouldStoreCheckoutDefaults,
      reason: shouldStoreCheckoutDefaults
        ? 'create_profile_with_defaults'
        : 'create_profile_without_defaults',
    };
  }

  return {
    shouldEnsureProfileAfterSuccessfulPayment: true,
    shouldStoreCheckoutDefaultsAfterSuccessfulPayment:
      shouldStoreCheckoutDefaults,
    reason: shouldStoreCheckoutDefaults
      ? 'update_profile_with_defaults'
      : 'update_profile_without_defaults',
  };
}
