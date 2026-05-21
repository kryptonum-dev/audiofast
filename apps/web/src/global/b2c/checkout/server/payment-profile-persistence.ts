import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import {
  buildCheckoutProfileDefaultsFromOrder,
  parseCheckoutOrderProfilePersistence,
} from '../profile';
import type {
  CheckoutCustomerSnapshot,
  CheckoutInvoiceAddressInput,
  CheckoutInvoiceDataSnapshot,
  CheckoutProfileDefaults,
  CheckoutShippingAddressSnapshot,
} from '../types';

type PaidOrderProfilePersistenceRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'customer_email'
  | 'customer_profile_id'
  | 'customer_snapshot'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'paid_at'
  | 'profile_persistence'
  | 'shipping_address_snapshot'
>;

type CustomerProfileRow =
  Database['public']['Tables']['customer_profiles']['Row'];
type CustomerProfilesInsert =
  Database['public']['Tables']['customer_profiles']['Insert'];
type CustomerProfilesUpdate =
  Database['public']['Tables']['customer_profiles']['Update'];
type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export class CheckoutPaymentProfilePersistenceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'database_error'
      | 'invalid_order_payload'
      | 'invalid_order_state'
      | 'not_found',
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'CheckoutPaymentProfilePersistenceError';
  }
}

export type PersistPaidOrderProfileResult = {
  orderId: string;
  orderNumber: string;
  profileId: string | null;
  createdProfile: boolean;
  updatedProfile: boolean;
  linkedAuthUser: boolean;
  linkedOrderToProfile: boolean;
  skippedReason:
    | 'profile_persistence_disabled'
    | 'profile_persistence_missing'
    | null;
};

function isRecord(
  value: Json | null | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRequiredString(value: Json | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new CheckoutPaymentProfilePersistenceError(
      `Checkout order payload is missing required field ${fieldName}.`,
      'invalid_order_payload',
    );
  }

  return value;
}

function getNullableString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeCustomerEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order email is missing.',
      'invalid_order_payload',
    );
  }

  return normalized;
}

function parseCheckoutInvoiceAddress(
  value: Json | undefined | null,
): CheckoutInvoiceAddressInput | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order invoice address snapshot is invalid.',
      'invalid_order_payload',
    );
  }

  const streetName = getRequiredString(
    value.streetName,
    'invoiceAddress.streetName',
  );
  const buildingNumber = getRequiredString(
    value.buildingNumber,
    'invoiceAddress.buildingNumber',
  );
  const postalCode = getRequiredString(
    value.postalCode,
    'invoiceAddress.postalCode',
  );
  const city = getRequiredString(value.city, 'invoiceAddress.city');
  const country = getRequiredString(value.country, 'invoiceAddress.country');

  if (country !== 'PL') {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order invoice address must use PL country code.',
      'invalid_order_payload',
    );
  }

  return {
    streetName,
    buildingNumber,
    apartmentNumber: getNullableString(value.apartmentNumber),
    postalCode,
    city,
    country: 'PL',
  };
}

function parseCheckoutCustomerSnapshot(value: Json): CheckoutCustomerSnapshot {
  if (!isRecord(value)) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order customer snapshot is invalid.',
      'invalid_order_payload',
    );
  }

  return {
    email: getRequiredString(value.email, 'customerSnapshot.email'),
    firstName: getRequiredString(value.firstName, 'customerSnapshot.firstName'),
    lastName: getRequiredString(value.lastName, 'customerSnapshot.lastName'),
    phone: getNullableString(value.phone),
  };
}

function parseCheckoutShippingAddressSnapshot(
  value: Json,
): CheckoutShippingAddressSnapshot {
  if (!isRecord(value)) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order shipping address snapshot is invalid.',
      'invalid_order_payload',
    );
  }

  const country = getRequiredString(
    value.country,
    'shippingAddressSnapshot.country',
  );

  if (country !== 'PL') {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order shipping address must use PL country code.',
      'invalid_order_payload',
    );
  }

  return {
    firstName: getRequiredString(
      value.firstName,
      'shippingAddressSnapshot.firstName',
    ),
    lastName: getRequiredString(
      value.lastName,
      'shippingAddressSnapshot.lastName',
    ),
    phone: getNullableString(value.phone),
    streetName: getRequiredString(
      value.streetName,
      'shippingAddressSnapshot.streetName',
    ),
    buildingNumber: getRequiredString(
      value.buildingNumber,
      'shippingAddressSnapshot.buildingNumber',
    ),
    apartmentNumber: getNullableString(value.apartmentNumber),
    postalCode: getRequiredString(
      value.postalCode,
      'shippingAddressSnapshot.postalCode',
    ),
    city: getRequiredString(value.city, 'shippingAddressSnapshot.city'),
    country: 'PL',
  };
}

function parseCheckoutInvoiceDataSnapshot(
  value: Json | null,
): CheckoutInvoiceDataSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order invoice snapshot is invalid.',
      'invalid_order_payload',
    );
  }

  const recipientType = getRequiredString(
    value.recipientType,
    'invoiceData.recipientType',
  );

  if (recipientType !== 'private' && recipientType !== 'company') {
    throw new CheckoutPaymentProfilePersistenceError(
      'Checkout order invoice snapshot has unsupported recipient type.',
      'invalid_order_payload',
    );
  }

  return {
    recipientType,
    companyName: getNullableString(value.companyName),
    taxId: getNullableString(value.taxId),
    invoiceAddress: parseCheckoutInvoiceAddress(value.invoiceAddress),
    storagePath: getNullableString(value.storagePath),
    attachedAt: getNullableString(value.attachedAt),
  };
}

function buildProfileDefaultsFromPaidOrder(
  order: PaidOrderProfilePersistenceRow,
): CheckoutProfileDefaults {
  return buildCheckoutProfileDefaultsFromOrder({
    customerEmail: normalizeCustomerEmail(order.customer_email),
    customerSnapshot: parseCheckoutCustomerSnapshot(order.customer_snapshot),
    shippingAddressSnapshot: parseCheckoutShippingAddressSnapshot(
      order.shipping_address_snapshot,
    ),
    invoiceData: parseCheckoutInvoiceDataSnapshot(order.invoice_data),
  });
}

function canStoreCheckoutDefaultsAfterSuccessfulPayment(args: {
  authUserIdAtCheckout: string | null;
  shouldStoreCheckoutDefaultsAfterSuccessfulPayment: boolean;
}): boolean {
  return (
    args.authUserIdAtCheckout !== null &&
    args.shouldStoreCheckoutDefaultsAfterSuccessfulPayment
  );
}

function shouldSeedNewProfileDefaults(args: {
  authUserIdAtCheckout: string | null;
  shouldStoreCheckoutDefaultsAfterSuccessfulPayment: boolean;
}): boolean {
  if (args.authUserIdAtCheckout === null) {
    return true;
  }

  return args.shouldStoreCheckoutDefaultsAfterSuccessfulPayment;
}

function areJsonValuesEqual(left: Json | null, right: Json | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isDuplicateCustomerProfileError(error: PostgrestError): boolean {
  return error.code === '23505';
}

async function loadPaidOrderProfilePersistenceData(
  orderId: string,
): Promise<PaidOrderProfilePersistenceRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'current_status, customer_email, customer_profile_id, customer_snapshot, id, invoice_data, order_number, paid_at, profile_persistence, shipping_address_snapshot',
    )
    .eq('id', orderId)
    .single();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      error.code === 'PGRST116'
        ? 'Checkout order not found for paid profile persistence.'
        : 'Failed to load checkout order for paid profile persistence.',
      error.code === 'PGRST116' ? 'not_found' : 'database_error',
      error,
    );
  }

  return data;
}

async function loadCustomerProfileById(
  profileId: string,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to load customer profile by id.',
      'database_error',
      error,
    );
  }

  return data;
}

async function loadCustomerProfileByAuthUserId(
  authUserId: string,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to load customer profile by auth user id.',
      'database_error',
      error,
    );
  }

  return data;
}

async function loadCustomerProfileByEmail(
  email: string,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to load customer profile by email.',
      'database_error',
      error,
    );
  }

  return data;
}

async function resolveTargetCustomerProfile(args: {
  order: PaidOrderProfilePersistenceRow;
  authUserIdAtCheckout: string | null;
  normalizedEmail: string;
}): Promise<CustomerProfileRow | null> {
  if (args.order.customer_profile_id) {
    const linkedProfile = await loadCustomerProfileById(
      args.order.customer_profile_id,
    );

    if (linkedProfile) {
      return linkedProfile;
    }
  }

  if (args.authUserIdAtCheckout) {
    const authLinkedProfile = await loadCustomerProfileByAuthUserId(
      args.authUserIdAtCheckout,
    );

    if (authLinkedProfile) {
      return authLinkedProfile;
    }
  }

  return loadCustomerProfileByEmail(args.normalizedEmail);
}

function buildCustomerProfileInsertPayload(args: {
  normalizedEmail: string;
  profileDefaults: CheckoutProfileDefaults;
  authUserIdAtCheckout: string | null;
  shouldStoreDefaults: boolean;
}): CustomerProfilesInsert {
  return {
    auth_user_id: args.authUserIdAtCheckout,
    email: args.normalizedEmail,
    first_name: args.profileDefaults.firstName,
    last_name: args.profileDefaults.lastName,
    phone: args.profileDefaults.phone,
    default_shipping_address: args.shouldStoreDefaults
      ? args.profileDefaults.defaultShippingAddress
      : {},
    default_invoice_data: args.shouldStoreDefaults
      ? args.profileDefaults.defaultInvoiceData
      : null,
  };
}

async function createCustomerProfile(
  payload: CustomerProfilesInsert,
): Promise<CustomerProfileRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to create customer profile after paid checkout.',
      'database_error',
      error,
    );
  }

  return data;
}

async function createOrResolveCustomerProfile(args: {
  normalizedEmail: string;
  profileDefaults: CheckoutProfileDefaults;
  authUserIdAtCheckout: string | null;
  shouldStoreDefaults: boolean;
}): Promise<{
  profile: CustomerProfileRow;
  wasCreated: boolean;
}> {
  try {
    return {
      profile: await createCustomerProfile(
        buildCustomerProfileInsertPayload({
          normalizedEmail: args.normalizedEmail,
          profileDefaults: args.profileDefaults,
          authUserIdAtCheckout: args.authUserIdAtCheckout,
          shouldStoreDefaults: args.shouldStoreDefaults,
        }),
      ),
      wasCreated: true,
    };
  } catch (error) {
    if (
      error instanceof CheckoutPaymentProfilePersistenceError &&
      error.causeError &&
      'code' in error.causeError &&
      isDuplicateCustomerProfileError(error.causeError as PostgrestError)
    ) {
      const resolvedProfile = await resolveTargetCustomerProfile({
        order: {
          current_status: 'paid',
          customer_email: args.normalizedEmail,
          customer_profile_id: null,
          customer_snapshot: {},
          id: 'recovery',
          invoice_data: null,
          order_number: 'recovery',
          paid_at: new Date(0).toISOString(),
          profile_persistence: null,
          shipping_address_snapshot: {},
        },
        normalizedEmail: args.normalizedEmail,
        authUserIdAtCheckout: args.authUserIdAtCheckout,
      });

      if (resolvedProfile) {
        return {
          profile: resolvedProfile,
          wasCreated: false,
        };
      }
    }

    throw error;
  }
}

function buildCustomerProfileUpdatePayload(args: {
  existingProfile: CustomerProfileRow;
  profileDefaults: CheckoutProfileDefaults | null;
  normalizedEmail: string;
  authUserIdAtCheckout: string | null;
  shouldStoreDefaults: boolean;
  orderNumber: string;
}): {
  payload: CustomerProfilesUpdate;
  linkedAuthUser: boolean;
} {
  const payload: CustomerProfilesUpdate = {};
  let linkedAuthUser = false;

  if (args.authUserIdAtCheckout !== null) {
    if (args.existingProfile.auth_user_id === null) {
      payload.auth_user_id = args.authUserIdAtCheckout;
      linkedAuthUser = true;
    } else if (
      args.existingProfile.auth_user_id !== args.authUserIdAtCheckout
    ) {
      console.warn(
        'Skipping checkout profile auth link because the existing profile already belongs to another auth user.',
        {
          orderNumber: args.orderNumber,
          profileId: args.existingProfile.id,
          existingAuthUserId: args.existingProfile.auth_user_id,
          checkoutAuthUserId: args.authUserIdAtCheckout,
        },
      );
    }
  }

  if (!args.shouldStoreDefaults || args.profileDefaults === null) {
    return {
      payload,
      linkedAuthUser,
    };
  }

  if (args.existingProfile.email !== args.normalizedEmail) {
    payload.email = args.normalizedEmail;
  }
  if (args.existingProfile.first_name !== args.profileDefaults.firstName) {
    payload.first_name = args.profileDefaults.firstName;
  }
  if (args.existingProfile.last_name !== args.profileDefaults.lastName) {
    payload.last_name = args.profileDefaults.lastName;
  }
  if (args.existingProfile.phone !== args.profileDefaults.phone) {
    payload.phone = args.profileDefaults.phone;
  }
  if (
    !areJsonValuesEqual(
      args.existingProfile.default_shipping_address,
      args.profileDefaults.defaultShippingAddress,
    )
  ) {
    payload.default_shipping_address =
      args.profileDefaults.defaultShippingAddress;
  }
  if (
    !areJsonValuesEqual(
      args.existingProfile.default_invoice_data,
      args.profileDefaults.defaultInvoiceData,
    )
  ) {
    payload.default_invoice_data = args.profileDefaults.defaultInvoiceData;
  }

  return {
    payload,
    linkedAuthUser,
  };
}

async function updateCustomerProfile(args: {
  profileId: string;
  payload: CustomerProfilesUpdate;
}): Promise<CustomerProfileRow> {
  const supabase = createAdminClient();
  const payload: CustomerProfilesUpdate = {
    ...args.payload,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('customer_profiles')
    .update(payload)
    .eq('id', args.profileId)
    .select('*')
    .single();

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to update customer profile after paid checkout.',
      'database_error',
      error,
    );
  }

  return data;
}

async function maybeUpdateExistingCustomerProfile(args: {
  existingProfile: CustomerProfileRow;
  profileDefaults: CheckoutProfileDefaults | null;
  normalizedEmail: string;
  authUserIdAtCheckout: string | null;
  shouldStoreDefaults: boolean;
  orderNumber: string;
}): Promise<{
  profile: CustomerProfileRow;
  updatedProfile: boolean;
  linkedAuthUser: boolean;
}> {
  const profileUpdate = buildCustomerProfileUpdatePayload({
    existingProfile: args.existingProfile,
    profileDefaults: args.profileDefaults,
    normalizedEmail: args.normalizedEmail,
    authUserIdAtCheckout: args.authUserIdAtCheckout,
    shouldStoreDefaults: args.shouldStoreDefaults,
    orderNumber: args.orderNumber,
  });

  if (Object.keys(profileUpdate.payload).length === 0) {
    return {
      profile: args.existingProfile,
      updatedProfile: false,
      linkedAuthUser: profileUpdate.linkedAuthUser,
    };
  }

  return {
    profile: await updateCustomerProfile({
      profileId: args.existingProfile.id,
      payload: profileUpdate.payload,
    }),
    updatedProfile: true,
    linkedAuthUser: profileUpdate.linkedAuthUser,
  };
}

async function ensureOrderCustomerProfileLink(args: {
  order: PaidOrderProfilePersistenceRow;
  profileId: string;
}): Promise<boolean> {
  if (args.order.customer_profile_id === args.profileId) {
    return false;
  }

  const supabase = createAdminClient();
  const payload: OrdersUpdate = {
    customer_profile_id: args.profileId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', args.order.id);

  if (error) {
    throw new CheckoutPaymentProfilePersistenceError(
      'Failed to link the paid checkout order to a customer profile.',
      'database_error',
      error,
    );
  }

  return true;
}

export async function persistPaidCheckoutOrderProfile(args: {
  orderId: string;
}): Promise<PersistPaidOrderProfileResult> {
  const order = await loadPaidOrderProfilePersistenceData(args.orderId);

  if (order.paid_at === null) {
    throw new CheckoutPaymentProfilePersistenceError(
      `Checkout order ${order.order_number} has no confirmed payment timestamp.`,
      'invalid_order_state',
    );
  }

  const profilePersistence = parseCheckoutOrderProfilePersistence(
    order.profile_persistence,
  );

  if (profilePersistence === null) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      profileId: order.customer_profile_id,
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: 'profile_persistence_missing',
    };
  }

  if (!profilePersistence.shouldEnsureProfileAfterSuccessfulPayment) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      profileId: order.customer_profile_id,
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: 'profile_persistence_disabled',
    };
  }

  const normalizedEmail = normalizeCustomerEmail(order.customer_email);
  const shouldStoreExistingProfileDefaults =
    canStoreCheckoutDefaultsAfterSuccessfulPayment({
      authUserIdAtCheckout: profilePersistence.authUserIdAtCheckout,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment:
        profilePersistence.shouldStoreCheckoutDefaultsAfterSuccessfulPayment,
    });
  const shouldStoreNewProfileDefaults = shouldSeedNewProfileDefaults({
    authUserIdAtCheckout: profilePersistence.authUserIdAtCheckout,
    shouldStoreCheckoutDefaultsAfterSuccessfulPayment:
      profilePersistence.shouldStoreCheckoutDefaultsAfterSuccessfulPayment,
  });
  let targetProfile = await resolveTargetCustomerProfile({
    order,
    authUserIdAtCheckout: profilePersistence.authUserIdAtCheckout,
    normalizedEmail,
  });
  let createdProfile = false;
  let updatedProfile = false;
  let linkedAuthUser = false;
  let profileDefaults: CheckoutProfileDefaults | null = null;

  const getProfileDefaults = () => {
    if (profileDefaults === null) {
      profileDefaults = buildProfileDefaultsFromPaidOrder(order);
    }

    return profileDefaults;
  };

  if (targetProfile === null) {
    const createdProfileResult = await createOrResolveCustomerProfile({
      normalizedEmail,
      profileDefaults: getProfileDefaults(),
      authUserIdAtCheckout: profilePersistence.authUserIdAtCheckout,
      shouldStoreDefaults: shouldStoreNewProfileDefaults,
    });
    targetProfile = createdProfileResult.profile;
    createdProfile = createdProfileResult.wasCreated;
    linkedAuthUser =
      createdProfileResult.wasCreated &&
      profilePersistence.authUserIdAtCheckout !== null;
  }

  if (!createdProfile) {
    const existingProfileResult = await maybeUpdateExistingCustomerProfile({
      existingProfile: targetProfile,
      profileDefaults: shouldStoreExistingProfileDefaults
        ? getProfileDefaults()
        : null,
      normalizedEmail,
      authUserIdAtCheckout: profilePersistence.authUserIdAtCheckout,
      shouldStoreDefaults: shouldStoreExistingProfileDefaults,
      orderNumber: order.order_number,
    });
    targetProfile = existingProfileResult.profile;
    updatedProfile = existingProfileResult.updatedProfile;
    linkedAuthUser = existingProfileResult.linkedAuthUser;
  }

  const linkedOrderToProfile = await ensureOrderCustomerProfileLink({
    order,
    profileId: targetProfile.id,
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    profileId: targetProfile.id,
    createdProfile,
    updatedProfile,
    linkedAuthUser,
    linkedOrderToProfile,
    skippedReason: null,
  };
}
