import type { CheckoutProfilePersistenceDecision } from './profile';
import type {
  CheckoutCustomerSnapshot,
  CheckoutInvoiceDataSnapshot,
  CheckoutOrderLineDraft,
  CheckoutOrderSummary,
  CheckoutSessionContext,
  CheckoutShippingAddressSnapshot,
  CheckoutSubmitInput,
} from './types';

export type CheckoutOrderStatus = 'awaiting_payment' | 'paid';

export type CheckoutStatusHistoryEntry = {
  status: CheckoutOrderStatus;
  changedAt: string;
  source: 'system';
};

export type CheckoutOrderDraft = {
  customerEmail: string;
  customerProfileId: string | null;
  customerSnapshot: CheckoutCustomerSnapshot;
  shippingAddressSnapshot: CheckoutShippingAddressSnapshot;
  invoiceData: CheckoutInvoiceDataSnapshot | null;
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  usedDiscount: CheckoutOrderSummary['usedDiscount'];
  currentStatus: CheckoutOrderStatus;
  statusHistory: CheckoutStatusHistoryEntry[];
  paymentProvider: 'przelewy24';
  paymentReference: string | null;
  paymentVerifiedAt: string | null;
  payableUntil: string;
  paidAt: string | null;
  shipmentData: null;
  items: CheckoutOrderLineDraft[];
  sessionContext: CheckoutSessionContext;
  profilePersistence: CheckoutProfilePersistenceDecision;
};

export const CHECKOUT_PAYMENT_WINDOW_MINUTES = 15;

export function buildCheckoutCustomerSnapshot(
  input: CheckoutSubmitInput,
): CheckoutCustomerSnapshot {
  return {
    firstName: input.contact.firstName,
    lastName: input.contact.lastName,
    email: input.contact.email,
    phone: input.contact.phone,
  };
}

export function buildCheckoutShippingAddressSnapshot(
  input: CheckoutSubmitInput,
): CheckoutShippingAddressSnapshot {
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

export function buildCheckoutInvoiceDataSnapshot(
  input: CheckoutSubmitInput,
): CheckoutInvoiceDataSnapshot | null {
  if (input.invoice.recipientType === 'private') {
    return null;
  }

  return {
    recipientType: input.invoice.recipientType,
    companyName: input.invoice.companyName,
    taxId: input.invoice.taxId,
    invoiceAddress: input.invoice.invoiceAddress,
    storagePath: null,
    attachedAt: null,
  };
}

export function buildInitialCheckoutStatusHistory(
  createdAt: string,
): CheckoutStatusHistoryEntry[] {
  return [
    {
      status: 'awaiting_payment',
      changedAt: createdAt,
      source: 'system',
    },
  ];
}

export function appendCheckoutStatusHistoryEntry(args: {
  history: CheckoutStatusHistoryEntry[];
  status: CheckoutOrderStatus;
  changedAt: string;
}): CheckoutStatusHistoryEntry[] {
  return [
    ...args.history,
    {
      status: args.status,
      changedAt: args.changedAt,
      source: 'system',
    },
  ];
}

export function buildCheckoutPayableUntil(
  createdAt: string,
  paymentWindowMinutes: number = CHECKOUT_PAYMENT_WINDOW_MINUTES,
): string {
  const payableUntil = new Date(createdAt);
  payableUntil.setMinutes(payableUntil.getMinutes() + paymentWindowMinutes);

  return payableUntil.toISOString();
}

export function buildCheckoutOrderDraft(args: {
  input: CheckoutSubmitInput;
  summary: CheckoutOrderSummary;
  sessionContext: CheckoutSessionContext;
  profilePersistence: CheckoutProfilePersistenceDecision;
  createdAt?: string;
}): CheckoutOrderDraft {
  const createdAt = args.createdAt ?? new Date().toISOString();

  return {
    customerEmail: args.input.contact.email,
    customerProfileId: args.sessionContext.customerProfileId,
    customerSnapshot: buildCheckoutCustomerSnapshot(args.input),
    shippingAddressSnapshot: buildCheckoutShippingAddressSnapshot(args.input),
    invoiceData: buildCheckoutInvoiceDataSnapshot(args.input),
    subtotalCents: args.summary.subtotalCents,
    discountTotalCents: args.summary.discountTotalCents,
    grandTotalCents: args.summary.grandTotalCents,
    usedDiscount: args.summary.usedDiscount,
    currentStatus: 'awaiting_payment',
    statusHistory: buildInitialCheckoutStatusHistory(createdAt),
    paymentProvider: 'przelewy24',
    paymentReference: null,
    paymentVerifiedAt: null,
    payableUntil: buildCheckoutPayableUntil(createdAt),
    paidAt: null,
    shipmentData: null,
    items: args.summary.lines,
    sessionContext: args.sessionContext,
    profilePersistence: args.profilePersistence,
  };
}
