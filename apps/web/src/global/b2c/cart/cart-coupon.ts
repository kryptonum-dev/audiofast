import { isCartLineDiscountEligible } from './cart-selectors';
import type {
  CartCouponDefinition,
  CartCouponState,
  CartLine,
  CartState,
} from './types';

function getLineSubtotalCents(line: CartLine): number {
  return line.unitPriceCents * line.quantity;
}

function createInvalidCouponState(
  code: string,
  message: string,
): CartCouponState {
  return {
    code,
    couponId: null,
    discountType: null,
    discountValueCents: null,
    discountPercent: null,
    productKeys: null,
    matchedProductKeys: [],
    isValid: false,
    message,
    totalDiscountCents: 0,
    lineDiscounts: {},
  };
}

function normalizeCouponCode(code: string): string {
  return code.trim();
}

function getEligibleLines(
  lines: CartLine[],
  coupon: Pick<CartCouponDefinition, 'discountType' | 'productKeys'>,
): CartLine[] {
  const discountEligibleLines = lines.filter(isCartLineDiscountEligible);

  if (
    coupon.discountType === 'fixed_order' ||
    coupon.discountType === 'percent_order'
  ) {
    return discountEligibleLines;
  }

  const productKeys = new Set(coupon.productKeys ?? []);

  return discountEligibleLines.filter((line) =>
    productKeys.has(line.productKey),
  );
}

function distributeDiscountAcrossLines(
  lines: CartLine[],
  totalDiscountCents: number,
): Record<string, number> {
  const subtotals = lines.map((line) => getLineSubtotalCents(line));
  const subtotalTotal = subtotals.reduce((sum, value) => sum + value, 0);

  if (totalDiscountCents <= 0 || subtotalTotal <= 0) {
    return {};
  }

  if (totalDiscountCents >= subtotalTotal) {
    return Object.fromEntries(
      lines.map((line, index) => [line.lineId, subtotals[index] ?? 0]),
    );
  }

  const provisional = lines.map((line, index) => {
    const subtotal = subtotals[index] ?? 0;
    const rawShare = (totalDiscountCents * subtotal) / subtotalTotal;
    const floorShare = Math.floor(rawShare);

    return {
      lineId: line.lineId,
      subtotal,
      floorShare,
      remainder: rawShare - floorShare,
    };
  });

  let remainderCents =
    totalDiscountCents -
    provisional.reduce((sum, item) => sum + item.floorShare, 0);

  provisional.sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }

    return left.lineId.localeCompare(right.lineId);
  });

  const result = Object.fromEntries(
    provisional.map((item) => [item.lineId, item.floorShare]),
  );

  while (remainderCents > 0) {
    for (const item of provisional) {
      if (remainderCents === 0) break;

      const currentValue = result[item.lineId] ?? 0;

      if (currentValue < item.subtotal) {
        result[item.lineId] = currentValue + 1;
        remainderCents -= 1;
      }
    }
  }

  return result;
}

function calculateLineDiscounts(
  lines: CartLine[],
  coupon: CartCouponDefinition,
): Record<string, number> {
  const eligibleLines = getEligibleLines(lines, coupon);

  if (eligibleLines.length === 0) {
    return {};
  }

  switch (coupon.discountType) {
    case 'fixed_order': {
      const subtotal = eligibleLines.reduce(
        (sum, line) => sum + getLineSubtotalCents(line),
        0,
      );
      const totalDiscount = Math.min(coupon.discountValueCents ?? 0, subtotal);

      return distributeDiscountAcrossLines(eligibleLines, totalDiscount);
    }
    case 'percent_order': {
      const subtotal = eligibleLines.reduce(
        (sum, line) => sum + getLineSubtotalCents(line),
        0,
      );
      const totalDiscount = Math.floor(
        subtotal * ((coupon.discountPercent ?? 0) / 100),
      );

      return distributeDiscountAcrossLines(eligibleLines, totalDiscount);
    }
    case 'fixed_product': {
      return Object.fromEntries(
        eligibleLines.map((line) => {
          const subtotal = getLineSubtotalCents(line);
          const totalDiscount = Math.min(
            subtotal,
            (coupon.discountValueCents ?? 0) * line.quantity,
          );

          return [line.lineId, totalDiscount];
        }),
      );
    }
    case 'percent_product': {
      return Object.fromEntries(
        eligibleLines.map((line) => [
          line.lineId,
          Math.floor(
            getLineSubtotalCents(line) * ((coupon.discountPercent ?? 0) / 100),
          ),
        ]),
      );
    }
    default:
      return {};
  }
}

function isCouponWithinWindow(
  coupon: CartCouponDefinition,
  now: Date,
): boolean {
  const timestamp = now.getTime();
  const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
  const expiresAt = coupon.expiresAt
    ? new Date(coupon.expiresAt).getTime()
    : null;

  if (startsAt && timestamp < startsAt) {
    return false;
  }

  if (expiresAt && timestamp > expiresAt) {
    return false;
  }

  return true;
}

function buildCouponState(
  coupon: CartCouponDefinition,
  lineDiscounts: Record<string, number>,
  lines: CartLine[],
): CartCouponState {
  const matchedProductKeys = Array.from(
    new Set(
      lines
        .filter((line) => (lineDiscounts[line.lineId] ?? 0) > 0)
        .map((line) => line.productKey),
    ),
  );

  return {
    code: coupon.code,
    couponId: coupon.id,
    discountType: coupon.discountType,
    discountValueCents: coupon.discountValueCents,
    discountPercent: coupon.discountPercent,
    productKeys: coupon.productKeys,
    matchedProductKeys,
    isValid: true,
    message: null,
    totalDiscountCents: Object.values(lineDiscounts).reduce(
      (sum, value) => sum + value,
      0,
    ),
    lineDiscounts,
  };
}

export function clearCoupon(state: CartState): CartState {
  return {
    ...state,
    coupon: null,
  };
}

export function applyInvalidCouponToCart(
  state: CartState,
  code: string,
  message: string,
): CartState {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return clearCoupon(state);
  }

  return {
    ...state,
    coupon: createInvalidCouponState(normalizedCode, message),
  };
}

export function syncCouponWithCart(state: CartState): CartState {
  if (!state.coupon || !state.coupon.discountType) {
    return state;
  }

  const snapshot: CartCouponDefinition = {
    id: state.coupon.couponId ?? 'unknown',
    code: state.coupon.code,
    isActive: true,
    discountType: state.coupon.discountType,
    discountValueCents: state.coupon.discountValueCents,
    discountPercent: state.coupon.discountPercent,
    productKeys: state.coupon.productKeys,
    usageLimit: null,
    usageCount: 0,
    startsAt: null,
    expiresAt: null,
  };

  const lineDiscounts = calculateLineDiscounts(state.lines, snapshot);

  if (Object.keys(lineDiscounts).length === 0) {
    return applyInvalidCouponToCart(
      state,
      state.coupon.code,
      'Kod rabatowy nie pasuje już do produktów w koszyku.',
    );
  }

  return {
    ...state,
    coupon: buildCouponState(snapshot, lineDiscounts, state.lines),
  };
}

export function applyCouponToCart(
  state: CartState,
  coupon: CartCouponDefinition,
  now: Date = new Date(),
): CartState {
  if (!coupon.isActive) {
    return applyInvalidCouponToCart(
      state,
      coupon.code,
      'Kod rabatowy jest nieaktywny.',
    );
  }

  if (!isCouponWithinWindow(coupon, now)) {
    return applyInvalidCouponToCart(
      state,
      coupon.code,
      'Kod rabatowy jest poza aktywnym oknem czasowym.',
    );
  }

  if (
    typeof coupon.usageLimit === 'number' &&
    coupon.usageCount >= coupon.usageLimit
  ) {
    return applyInvalidCouponToCart(
      state,
      coupon.code,
      'Kod rabatowy przekroczył limit użyć.',
    );
  }

  const lineDiscounts = calculateLineDiscounts(state.lines, coupon);

  if (Object.keys(lineDiscounts).length === 0) {
    return applyInvalidCouponToCart(
      state,
      coupon.code,
      'Kod rabatowy nie pasuje do żadnego produktu w koszyku.',
    );
  }

  return {
    ...state,
    coupon: buildCouponState(coupon, lineDiscounts, state.lines),
  };
}
