import type {
  CartCouponDefinition,
  CartCouponDiscountType,
} from '@/src/global/b2c/cart/types';

export type CouponDefinitionRow = {
  code: string;
  discount_percent: number | null;
  discount_type: string;
  discount_value_cents: number | null;
  expires_at: string | null;
  id: string;
  is_active: boolean;
  product_keys: string[] | null;
  starts_at: string | null;
  usage_count: number;
  usage_limit: number | null;
};

export const B2C_COUPON_DISCOUNT_TYPES = [
  'fixed_order',
  'fixed_product',
  'percent_order',
  'percent_product',
] as const satisfies CartCouponDiscountType[];

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isSupportedCouponDiscountType(
  discountType: string,
): discountType is CartCouponDiscountType {
  return B2C_COUPON_DISCOUNT_TYPES.includes(
    discountType as CartCouponDiscountType,
  );
}

export function isFixedCouponDiscountType(
  discountType: CartCouponDiscountType,
): boolean {
  return discountType === 'fixed_order' || discountType === 'fixed_product';
}

export function isPercentCouponDiscountType(
  discountType: CartCouponDiscountType,
): boolean {
  return discountType === 'percent_order' || discountType === 'percent_product';
}

export function isProductScopedCouponDiscountType(
  discountType: CartCouponDiscountType,
): boolean {
  return discountType === 'fixed_product' || discountType === 'percent_product';
}

export function mapCouponRowToDefinition(
  row: CouponDefinitionRow,
  normalizedCode = normalizeCouponCode(row.code),
): CartCouponDefinition | null {
  if (!isSupportedCouponDiscountType(row.discount_type)) {
    return null;
  }

  if (
    isFixedCouponDiscountType(row.discount_type) &&
    typeof row.discount_value_cents !== 'number'
  ) {
    return null;
  }

  if (
    isPercentCouponDiscountType(row.discount_type) &&
    typeof row.discount_percent !== 'number'
  ) {
    return null;
  }

  return {
    id: row.id,
    code: normalizedCode,
    isActive: row.is_active,
    discountType: row.discount_type,
    discountValueCents: row.discount_value_cents,
    discountPercent: row.discount_percent,
    productKeys: row.product_keys,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
  };
}
