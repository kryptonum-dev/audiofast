import 'server-only';

import {
  createCheckoutProfileInvoiceDefaultsFromInvoice,
  createCheckoutProfileShippingDefaultsFromAddress,
  parseCheckoutProfileInvoiceDefaults,
  parseCheckoutProfileShippingDefaults,
} from '@/src/global/b2c/checkout/profile';
import type {
  CheckoutContactInput,
  CheckoutProfileInvoiceDefaults,
  CheckoutProfileShippingDefaults,
} from '@/src/global/b2c/checkout/types';
import {
  type CheckoutSubmitErrors,
  validateCheckoutContact,
  validateCheckoutInvoice,
  validateCheckoutShippingAddress,
} from '@/src/global/b2c/checkout/validation';
import type { CustomerAccountProfileSubmitInput } from '@/src/global/b2c/customer-auth/account-profile-form';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

type CustomerProfilesRow =
  Database['public']['Tables']['customer_profiles']['Row'];
type CustomerProfilesUpdate =
  Database['public']['Tables']['customer_profiles']['Update'];

export type CustomerAccountProfileRow = Pick<
  CustomerProfilesRow,
  | 'auth_user_id'
  | 'created_at'
  | 'default_invoice_data'
  | 'default_shipping_address'
  | 'email'
  | 'first_name'
  | 'id'
  | 'last_name'
  | 'phone'
  | 'updated_at'
>;

export type CustomerAccountProfile = {
  id: string;
  email: string;
  authUserId: string | null;
  contact: CheckoutContactInput;
  defaultShippingAddress: CheckoutProfileShippingDefaults | null;
  defaultInvoiceData: CheckoutProfileInvoiceDefaults | null;
  hasUsableCheckoutDefaults: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoadCustomerAccountProfileForPanelInput = {
  authUserId: string;
  normalizedEmail: string;
};

export type LoadCustomerAccountProfileForPanelResult =
  | {
      kind: 'loaded';
      profile: CustomerAccountProfile;
    }
  | {
      kind: 'not_found';
    };

export type CustomerAccountProfileValidationErrors = Pick<
  CheckoutSubmitErrors,
  'contact' | 'shippingAddress' | 'invoice' | 'formErrors'
>;

export type ValidateCustomerAccountProfileInputResult =
  | {
      isValid: true;
      value: CustomerAccountProfileSubmitInput;
      errors: CustomerAccountProfileValidationErrors;
    }
  | {
      isValid: false;
      value: null;
      errors: CustomerAccountProfileValidationErrors;
    };

export type UpdateCustomerAccountProfileInput = {
  authUserId: string;
  normalizedEmail: string;
  input: CustomerAccountProfileSubmitInput;
  now?: Date;
};

export type UpdateCustomerAccountProfileResult =
  | {
      kind: 'updated';
      profile: CustomerAccountProfile;
    }
  | {
      kind: 'validation_error';
      errors: CustomerAccountProfileValidationErrors;
    }
  | {
      kind: 'not_found';
    }
  | {
      kind: 'ownership_mismatch';
    };

export const CUSTOMER_ACCOUNT_PROFILE_SELECT =
  'id, email, auth_user_id, first_name, last_name, phone, default_shipping_address, default_invoice_data, created_at, updated_at';

function createEmptyValidationErrors(): CustomerAccountProfileValidationErrors {
  return {
    formErrors: [],
  };
}

function mergeCustomerAccountProfileErrors(
  ...parts: CheckoutSubmitErrors[]
): CustomerAccountProfileValidationErrors {
  return parts.reduce<CustomerAccountProfileValidationErrors>(
    (accumulator, part) => {
      if (part.contact) {
        accumulator.contact = {
          ...accumulator.contact,
          ...part.contact,
        };
      }

      if (part.shippingAddress) {
        accumulator.shippingAddress = {
          ...accumulator.shippingAddress,
          ...part.shippingAddress,
        };
      }

      if (part.invoice) {
        accumulator.invoice = {
          ...(accumulator.invoice ?? {}),
          ...part.invoice,
          invoiceAddress: {
            ...(accumulator.invoice?.invoiceAddress ?? {}),
            ...(part.invoice.invoiceAddress ?? {}),
          },
        };
      }

      accumulator.formErrors.push(...part.formErrors);

      return accumulator;
    },
    createEmptyValidationErrors(),
  );
}

function hasValidationErrors(
  errors: CustomerAccountProfileValidationErrors,
): boolean {
  return Boolean(
    errors.formErrors.length > 0 ||
      errors.contact ||
      errors.shippingAddress ||
      errors.invoice,
  );
}

function verifyCustomerAccountProfileOwnership(args: {
  profile: CustomerAccountProfile;
  authUserId: string;
  normalizedEmail: string;
}): boolean {
  if (args.profile.email.toLowerCase() !== args.normalizedEmail) {
    return false;
  }

  return (
    args.profile.authUserId === null ||
    args.profile.authUserId === args.authUserId
  );
}

export function mapCustomerAccountProfileRow(
  row: CustomerAccountProfileRow,
): CustomerAccountProfile {
  const defaultShippingAddress = parseCheckoutProfileShippingDefaults(
    row.default_shipping_address,
  );

  return {
    id: row.id,
    email: row.email,
    authUserId: row.auth_user_id,
    contact: {
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
    },
    defaultShippingAddress,
    defaultInvoiceData: parseCheckoutProfileInvoiceDefaults(
      row.default_invoice_data,
    ),
    hasUsableCheckoutDefaults: defaultShippingAddress !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateCustomerAccountProfileInput({
  input,
  normalizedEmail,
}: {
  authUserId: string;
  customerProfileId: string | null;
  input: CustomerAccountProfileSubmitInput;
  normalizedEmail: string;
}): ValidateCustomerAccountProfileInputResult {
  const contactResult = validateCheckoutContact(input.contact);
  const shippingResult = validateCheckoutShippingAddress(input.shippingAddress);
  const invoiceResult = validateCheckoutInvoice(input.invoice);
  const errors = mergeCustomerAccountProfileErrors(
    contactResult.errors,
    shippingResult.errors,
    invoiceResult.errors,
  );

  if (
    contactResult.isValid &&
    contactResult.value.email !== normalizedEmail.toLowerCase()
  ) {
    errors.contact = {
      ...errors.contact,
      email: 'Adres e-mail konta klienta nie może zostać zmieniony.',
    };
  }

  if (
    hasValidationErrors(errors) ||
    !contactResult.isValid ||
    !shippingResult.isValid ||
    !invoiceResult.isValid
  ) {
    errors.formErrors.push(
      'Nie udało się zapisać danych konta, ponieważ formularz zawiera błędy.',
    );

    return {
      isValid: false,
      value: null,
      errors,
    };
  }

  return {
    isValid: true,
    value: {
      contact: contactResult.value,
      shippingAddress: shippingResult.value,
      invoice: invoiceResult.value,
    },
    errors,
  };
}

export async function loadCustomerAccountProfileForPanel({
  authUserId,
  normalizedEmail,
}: LoadCustomerAccountProfileForPanelInput): Promise<LoadCustomerAccountProfileForPanelResult> {
  const supabase = createAdminClient();

  const { data: profileByAuthUserId, error: authLookupError } = await supabase
    .from('customer_profiles')
    .select(CUSTOMER_ACCOUNT_PROFILE_SELECT)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (authLookupError) {
    throw authLookupError;
  }

  if (profileByAuthUserId) {
    return {
      kind: 'loaded',
      profile: mapCustomerAccountProfileRow(
        profileByAuthUserId as CustomerAccountProfileRow,
      ),
    };
  }

  const { data: profileByEmail, error: emailLookupError } = await supabase
    .from('customer_profiles')
    .select(CUSTOMER_ACCOUNT_PROFILE_SELECT)
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (emailLookupError) {
    throw emailLookupError;
  }

  if (!profileByEmail) {
    return {
      kind: 'not_found',
    };
  }

  return {
    kind: 'loaded',
    profile: mapCustomerAccountProfileRow(
      profileByEmail as CustomerAccountProfileRow,
    ),
  };
}

export async function updateCustomerAccountProfile({
  authUserId,
  input,
  normalizedEmail,
  now = new Date(),
}: UpdateCustomerAccountProfileInput): Promise<UpdateCustomerAccountProfileResult> {
  const currentProfileResult = await loadCustomerAccountProfileForPanel({
    authUserId,
    normalizedEmail,
  });

  if (currentProfileResult.kind === 'not_found') {
    return {
      kind: 'not_found',
    };
  }

  if (
    !verifyCustomerAccountProfileOwnership({
      authUserId,
      normalizedEmail,
      profile: currentProfileResult.profile,
    })
  ) {
    return {
      kind: 'ownership_mismatch',
    };
  }

  const validationResult = validateCustomerAccountProfileInput({
    authUserId,
    customerProfileId: currentProfileResult.profile.id,
    input,
    normalizedEmail,
  });

  if (!validationResult.isValid) {
    return {
      kind: 'validation_error',
      errors: validationResult.errors,
    };
  }

  const updatePayload: CustomerProfilesUpdate = {
    first_name: validationResult.value.contact.firstName,
    last_name: validationResult.value.contact.lastName,
    phone: validationResult.value.contact.phone,
    default_shipping_address: createCheckoutProfileShippingDefaultsFromAddress(
      validationResult.value.shippingAddress,
    ),
    default_invoice_data: createCheckoutProfileInvoiceDefaultsFromInvoice(
      validationResult.value.invoice,
    ),
    updated_at: now.toISOString(),
  };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .update(updatePayload)
    .eq('id', currentProfileResult.profile.id)
    .select(CUSTOMER_ACCOUNT_PROFILE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return {
    kind: 'updated',
    profile: mapCustomerAccountProfileRow(data as CustomerAccountProfileRow),
  };
}
