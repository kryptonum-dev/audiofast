import type { SanityRawImage } from '@/src/components/shared/Image';
import type { PricingSelection } from '@/src/global/supabase/types';

export type CartLineType = 'standard' | 'cpo';

export type CartLineIssueCode =
  | 'configuration_invalid'
  | 'cpo_unavailable'
  | 'not_buyable'
  | 'price_changed';

export type CartLineIssue = {
  code: CartLineIssueCode;
  blocking: boolean;
  message: string;
};

export type CartCouponDiscountType =
  | 'fixed_order'
  | 'fixed_product'
  | 'percent_order'
  | 'percent_product';

export type CartCouponDefinition = {
  id: string;
  code: string;
  isActive: boolean;
  discountType: CartCouponDiscountType;
  discountValueCents: number | null;
  discountPercent: number | null;
  productKeys: string[] | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
};

export type CartCouponState = {
  code: string;
  couponId: string | null;
  discountType: CartCouponDiscountType | null;
  discountValueCents: number | null;
  discountPercent: number | null;
  productKeys: string[] | null;
  matchedProductKeys: string[];
  isValid: boolean;
  message: string | null;
  totalDiscountCents: number;
  lineDiscounts: Record<string, number>;
};

export type CartProductConfigurationOption = {
  label: string;
  value: string;
  priceDelta: number;
};

export type CartProductSnapshot = {
  id: string;
  name: string;
  brandName: string;
  kind?: CartLineType;
  brandLogo?: SanityRawImage;
  image: SanityRawImage;
  basePrice: number;
  configurationOptions: CartProductConfigurationOption[];
  totalPrice: number;
};

export type StandardCartConfigurationSelection = Pick<
  PricingSelection,
  'variantId' | 'selectedOptions'
>;

export type StandardCartLine = {
  lineId: string;
  lineType: 'standard';
  productId: string;
  productKey: string;
  productName: string;
  brandName: string;
  quantity: number;
  unitPriceCents: number;
  isReturnable: boolean;
  configurationSelection?: StandardCartConfigurationSelection;
  configurationSummary: Array<{
    label: string;
    value: string;
  }>;
  configurationSignature: string;
  issues: CartLineIssue[];
  product: CartProductSnapshot;
};

export type CpoCartLine = {
  lineId: string;
  lineType: 'cpo';
  productId: string;
  productKey: string;
  productName: string;
  brandName: string;
  quantity: 1;
  unitPriceCents: number;
  isReturnable: boolean;
  availabilityStatus: string | null;
  issues: CartLineIssue[];
  product: CartProductSnapshot;
};

export type CartLine = StandardCartLine | CpoCartLine;

export type CartState = {
  version: number;
  lines: CartLine[];
  coupon: CartCouponState | null;
};

export type PersistedCartState = CartState;

export type CartTotals = {
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  itemCount: number;
  lineCount: number;
};

export type StandardLineRevalidation = {
  lineId: string;
  lineType: 'standard';
  isBuyable: boolean;
  isConfigurationValid: boolean;
  unitPriceCents: number | null;
};

export type CpoLineRevalidation = {
  lineId: string;
  lineType: 'cpo';
  isBuyable: boolean;
  availabilityStatus: string | null;
  unitPriceCents: number | null;
};

export type CartLineRevalidation =
  | StandardLineRevalidation
  | CpoLineRevalidation;
