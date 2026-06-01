import {
  getCartLineDiscountCents,
  getCartLineSubtotalCents,
} from '../cart/cart-selectors';
import type {
  CartLine,
  CartState,
  CpoCartLine,
  StandardCartLine,
} from '../cart/types';
import type {
  CheckoutCpoItemSnapshot,
  CheckoutOrderLineDraft,
  CheckoutOrderSummary,
  CheckoutOrderTotals,
  CheckoutStandardItemOptionSnapshot,
  CheckoutStandardItemSnapshot,
  CheckoutUsedDiscountSnapshot,
} from './types';

function buildUsedDiscountSnapshot(
  state: CartState,
): CheckoutUsedDiscountSnapshot | null {
  const coupon = state.coupon;

  if (!coupon?.isValid || !coupon.couponId || !coupon.discountType) {
    return null;
  }

  return {
    couponId: coupon.couponId,
    couponCode: coupon.code,
    discountType: coupon.discountType,
    discountValueCents: coupon.discountValueCents,
    discountPercent: coupon.discountPercent,
    matchedProductKeys: [...coupon.matchedProductKeys],
    totalDiscountCents: coupon.totalDiscountCents,
  };
}

function buildStandardItemSnapshot(
  line: StandardCartLine,
): CheckoutStandardItemSnapshot {
  const modelEntry = line.configurationSummary.find(
    (entry) => entry.label.toLowerCase() === 'model',
  );

  const selectedOptions: CheckoutStandardItemOptionSnapshot[] =
    line.configurationSummary.map((entry) => ({
      groupName: entry.label,
      inputType: 'select',
      valueName: entry.value,
      numericValue: null,
      unit: null,
      parentGroupName: null,
      parentValueName: null,
    }));

  return {
    model: modelEntry?.value ?? null,
    selectedOptions,
    productImage: line.product.image ?? null,
  };
}

function buildCpoItemSnapshot(line: CpoCartLine): CheckoutCpoItemSnapshot {
  return {
    availabilityStatusAtPurchase: line.availabilityStatus,
    archivedAtPurchase: null,
    productImage: line.product.image ?? null,
  };
}

export function buildCheckoutOrderLineDraft(
  state: CartState,
  line: CartLine,
  linePosition: number,
): CheckoutOrderLineDraft {
  const lineSubtotalCents = getCartLineSubtotalCents(line);
  const lineDiscountTotalCents = getCartLineDiscountCents(state, line.lineId);
  const lineTotalCents = Math.max(
    0,
    lineSubtotalCents - lineDiscountTotalCents,
  );

  return {
    lineId: line.lineId,
    lineType: line.lineType,
    linePosition,
    productId: line.productId,
    productKey: line.productKey,
    productName: line.productName,
    brandName: line.brandName,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    lineSubtotalCents,
    lineDiscountTotalCents,
    lineTotalCents,
    isReturnable: line.isReturnable,
    itemSnapshot:
      line.lineType === 'standard'
        ? buildStandardItemSnapshot(line)
        : buildCpoItemSnapshot(line),
  };
}

export function buildCheckoutOrderLineDrafts(
  state: CartState,
  lines: CartLine[],
): CheckoutOrderLineDraft[] {
  return lines.map((line, index) =>
    buildCheckoutOrderLineDraft(state, line, index + 1),
  );
}

export function buildCheckoutOrderTotals(
  lines: CheckoutOrderLineDraft[],
): CheckoutOrderTotals {
  return {
    subtotalCents: lines.reduce(
      (total, line) => total + line.lineSubtotalCents,
      0,
    ),
    discountTotalCents: lines.reduce(
      (total, line) => total + line.lineDiscountTotalCents,
      0,
    ),
    grandTotalCents: lines.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    ),
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    lineCount: lines.length,
  };
}

export function buildCheckoutOrderSummary(
  state: CartState,
  lines: CartLine[],
): CheckoutOrderSummary {
  const orderLines = buildCheckoutOrderLineDrafts(state, lines);
  const totals = buildCheckoutOrderTotals(orderLines);

  return {
    ...totals,
    lines: orderLines,
    usedDiscount: buildUsedDiscountSnapshot(state),
  };
}
