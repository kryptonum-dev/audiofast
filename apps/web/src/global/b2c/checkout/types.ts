import type {
  CartCouponDiscountType,
  CartLineType,
} from '../cart/types';

export type CheckoutCountryCode = 'PL';

export type CheckoutInvoiceRecipientType = 'private' | 'company';

export type CheckoutContactInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export type CheckoutAddress = {
  street: string;
  postalCode: string;
  city: string;
  country: CheckoutCountryCode;
};

export type CheckoutShippingAddressInput = CheckoutAddress & {
  firstName: string;
  lastName: string;
  phone: string | null;
};

export type CheckoutInvoiceAddressInput = CheckoutAddress;

export type CheckoutInvoiceInput = {
  recipientType: CheckoutInvoiceRecipientType;
  companyName: string | null;
  taxId: string | null;
  invoiceAddress: CheckoutInvoiceAddressInput | null;
};

export type CheckoutConsentsInput = {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
};

export type CheckoutSubmitInput = {
  contact: CheckoutContactInput;
  shippingAddress: CheckoutShippingAddressInput;
  invoice: CheckoutInvoiceInput;
  consents: CheckoutConsentsInput;
  saveToProfile: boolean;
};

export type CheckoutDraft = CheckoutSubmitInput & {
  updatedAt: string | null;
};

export type CheckoutCustomerSnapshot = CheckoutContactInput;

export type CheckoutShippingAddressSnapshot = CheckoutShippingAddressInput;

export type CheckoutInvoiceDataSnapshot = {
  recipientType: CheckoutInvoiceRecipientType;
  companyName: string | null;
  taxId: string | null;
  invoiceAddress: CheckoutInvoiceAddressInput | null;
  storagePath: string | null;
  attachedAt: string | null;
};

export type CheckoutProfileInvoiceDefaults = {
  recipientType: CheckoutInvoiceRecipientType;
  companyName: string | null;
  taxId: string | null;
  invoiceAddress: CheckoutInvoiceAddressInput | null;
};

export type CheckoutProfileShippingDefaults = CheckoutShippingAddressInput;

export type CheckoutProfileDefaults = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  defaultShippingAddress: CheckoutProfileShippingDefaults;
  defaultInvoiceData: CheckoutProfileInvoiceDefaults | null;
};

export type CheckoutSessionContext = {
  isAuthenticated: boolean;
  authUserId: string | null;
  authenticatedEmail: string | null;
  customerProfileId: string | null;
};

export type CheckoutUsedDiscountSnapshot = {
  couponId: string;
  couponCode: string;
  discountType: CartCouponDiscountType;
  discountValueCents: number | null;
  discountPercent: number | null;
  matchedProductKeys: string[];
  totalDiscountCents: number;
};

export type CheckoutStandardItemOptionSnapshot = {
  groupName: string;
  inputType: string;
  valueName: string | null;
  numericValue: number | null;
  unit: string | null;
  parentGroupName: string | null;
  parentValueName: string | null;
};

export type CheckoutStandardItemSnapshot = {
  model: string | null;
  selectedOptions: CheckoutStandardItemOptionSnapshot[];
};

export type CheckoutCpoItemSnapshot = {
  availabilityStatusAtPurchase: string | null;
  archivedAtPurchase: boolean | null;
};

export type CheckoutOrderItemSnapshot =
  | CheckoutStandardItemSnapshot
  | CheckoutCpoItemSnapshot;

export type CheckoutOrderLineDraft = {
  lineId: string;
  lineType: CartLineType;
  linePosition: number;
  productId: string;
  productKey: string;
  productName: string;
  brandName: string;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  lineDiscountTotalCents: number;
  lineTotalCents: number;
  isReturnable: boolean;
  itemSnapshot: CheckoutOrderItemSnapshot;
};

export type CheckoutOrderTotals = {
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  itemCount: number;
  lineCount: number;
};

export type CheckoutOrderSummary = CheckoutOrderTotals & {
  lines: CheckoutOrderLineDraft[];
  usedDiscount: CheckoutUsedDiscountSnapshot | null;
};
