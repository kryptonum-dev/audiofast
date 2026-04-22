import type { User } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';
import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import {
  canPrefillOrderFormFromProfile,
  shouldLockOrderFormEmail,
} from '../profile';
import type {
  CheckoutInvoiceAddressInput,
  CheckoutProfileDefaults,
  CheckoutProfileInvoiceDefaults,
  CheckoutProfileShippingDefaults,
  CheckoutSessionContext,
} from '../types';
import type { CheckoutAuthContext } from './types';

type CustomerProfileRow =
  Database['public']['Tables']['customer_profiles']['Row'];

function createGuestCheckoutSessionContext(): CheckoutSessionContext {
  return {
    isAuthenticated: false,
    authUserId: null,
    authenticatedEmail: null,
    customerProfileId: null,
  };
}

function isRecord(
  value: Json | null | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNullableString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function parseCheckoutInvoiceAddress(
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

function parseCheckoutProfileShippingDefaults(
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
    !city
  ) {
    return null;
  }

  if (country !== 'PL') {
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

function parseCheckoutProfileInvoiceDefaults(
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

  const invoiceAddress = parseCheckoutInvoiceAddress(value.invoiceAddress);

  return {
    recipientType: 'company',
    companyName: getNullableString(value.companyName),
    taxId: getNullableString(value.taxId),
    invoiceAddress,
  };
}

function mapCustomerProfileRowToDefaults(
  row: CustomerProfileRow,
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

async function lookupCustomerProfile(
  user: User,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();

  const { data: profileByAuthId, error: authLookupError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (authLookupError) {
    throw authLookupError;
  }

  if (profileByAuthId) {
    return profileByAuthId;
  }

  if (!user.email) {
    return null;
  }

  const { data: profileByEmail, error: emailLookupError } = await supabase
    .from('customer_profiles')
    .select('*')
    .ilike('email', user.email)
    .maybeSingle();

  if (emailLookupError) {
    throw emailLookupError;
  }

  return profileByEmail;
}

export async function loadCheckoutAuthContext(): Promise<CheckoutAuthContext> {
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return {
        sessionContext: createGuestCheckoutSessionContext(),
        customerProfile: null,
        canPrefillFromProfile: false,
        isEmailLocked: false,
      };
    }

    const profileRow = await lookupCustomerProfile(data.user);
    const customerProfile = profileRow
      ? mapCustomerProfileRowToDefaults(profileRow)
      : null;
    const sessionContext: CheckoutSessionContext = {
      isAuthenticated: true,
      authUserId: data.user.id,
      authenticatedEmail: data.user.email?.toLowerCase() ?? null,
      customerProfileId: profileRow?.id ?? null,
    };

    return {
      sessionContext,
      customerProfile,
      canPrefillFromProfile: canPrefillOrderFormFromProfile(
        sessionContext,
        customerProfile,
      ),
      isEmailLocked: shouldLockOrderFormEmail(sessionContext),
    };
  } catch (error) {
    console.error('Failed to load checkout auth context.', error);

    return {
      sessionContext: createGuestCheckoutSessionContext(),
      customerProfile: null,
      canPrefillFromProfile: false,
      isEmailLocked: false,
    };
  }
}
