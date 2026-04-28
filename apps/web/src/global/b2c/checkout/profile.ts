import type { Json } from '@/src/global/supabase/database.types';

import type {
  CheckoutCustomerSnapshot,
  CheckoutDraft,
  CheckoutInvoiceAddressInput,
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

export type CheckoutCustomerProfileDefaultsRow = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  default_shipping_address: Json;
  default_invoice_data: Json | null;
};

function isRecord(
  value: Json | null | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNullableString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseCheckoutProfileInvoiceAddress(
  value: Json | undefined | null,
): CheckoutInvoiceAddressInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const streetName = getNullableString(value.streetName);
  const buildingNumber = getNullableString(value.buildingNumber);
  const apartmentNumber = getNullableString(value.apartmentNumber);
  const postalCode = getNullableString(value.postalCode);
  const city = getNullableString(value.city);
  const country = getNullableString(value.country);

  if (
    !streetName ||
    !buildingNumber ||
    !postalCode ||
    !city ||
    country !== 'PL'
  ) {
    return null;
  }

  return {
    streetName,
    buildingNumber,
    apartmentNumber,
    postalCode,
    city,
    country: 'PL',
  };
}

export function parseCheckoutProfileShippingDefaults(
  value: Json | null,
): CheckoutProfileShippingDefaults | null {
  if (!isRecord(value)) {
    return null;
  }

  const firstName = getNullableString(value.firstName);
  const lastName = getNullableString(value.lastName);
  const streetName = getNullableString(value.streetName);
  const buildingNumber = getNullableString(value.buildingNumber);
  const apartmentNumber = getNullableString(value.apartmentNumber);
  const postalCode = getNullableString(value.postalCode);
  const city = getNullableString(value.city);
  const country = getNullableString(value.country);

  if (
    !firstName ||
    !lastName ||
    !streetName ||
    !buildingNumber ||
    !postalCode ||
    !city ||
    country !== 'PL'
  ) {
    return null;
  }

  return {
    firstName,
    lastName,
    phone: getNullableString(value.phone),
    streetName,
    buildingNumber,
    apartmentNumber,
    postalCode,
    city,
    country: 'PL',
  };
}

export function parseCheckoutProfileInvoiceDefaults(
  value: Json | null,
): CheckoutProfileInvoiceDefaults | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const recipientType = getNullableString(value.recipientType);

  if (recipientType === 'private') {
    return {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    };
  }

  if (recipientType !== 'company') {
    return null;
  }

  return {
    recipientType: 'company',
    companyName: getNullableString(value.companyName),
    taxId: getNullableString(value.taxId),
    invoiceAddress: parseCheckoutProfileInvoiceAddress(value.invoiceAddress),
  };
}

export function mapCheckoutCustomerProfileRowToDefaults(
  row: CheckoutCustomerProfileDefaultsRow,
): CheckoutProfileDefaults | null {
  const defaultShippingAddress = parseCheckoutProfileShippingDefaults(
    row.default_shipping_address,
  );

  if (!defaultShippingAddress) {
    return null;
  }

  return {
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    defaultShippingAddress,
    defaultInvoiceData: parseCheckoutProfileInvoiceDefaults(
      row.default_invoice_data,
    ),
  };
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
  return createCheckoutProfileShippingDefaultsFromAddress(
    input.shippingAddress,
  );
}

export function createCheckoutProfileShippingDefaultsFromAddress(
  shippingAddress: CheckoutShippingAddressSnapshot,
): CheckoutProfileShippingDefaults {
  return {
    firstName: shippingAddress.firstName,
    lastName: shippingAddress.lastName,
    phone: shippingAddress.phone,
    streetName: shippingAddress.streetName,
    buildingNumber: shippingAddress.buildingNumber,
    apartmentNumber: shippingAddress.apartmentNumber,
    postalCode: shippingAddress.postalCode,
    city: shippingAddress.city,
    country: shippingAddress.country,
  };
}

export function createCheckoutProfileInvoiceDefaults(
  input: CheckoutSubmitInput,
): CheckoutProfileInvoiceDefaults | null {
  return createCheckoutProfileInvoiceDefaultsFromInvoice(input.invoice);
}

export function createCheckoutProfileInvoiceDefaultsFromInvoice(
  invoice: CheckoutInvoiceInput,
): CheckoutProfileInvoiceDefaults | null {
  if (invoice.recipientType === 'private') {
    return null;
  }

  return {
    recipientType: invoice.recipientType,
    companyName: invoice.companyName,
    taxId: invoice.taxId,
    invoiceAddress: invoice.invoiceAddress,
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
