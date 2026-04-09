import type { CartLine, CartState, CartTotals } from './types';

function getLineDiscounts(state: CartState): Record<string, number> {
  return state.coupon?.lineDiscounts ?? {};
}

export function getCartLineSubtotalCents(line: CartLine): number {
  return line.unitPriceCents * line.quantity;
}

export function getCartLineDiscountCents(
  state: CartState,
  lineId: string,
): number {
  return getLineDiscounts(state)[lineId] ?? 0;
}

export function getCartLineTotalCents(state: CartState, line: CartLine): number {
  return Math.max(
    0,
    getCartLineSubtotalCents(line) - getCartLineDiscountCents(state, line.lineId),
  );
}

export function getCartSubtotalCents(state: CartState): number {
  return state.lines.reduce(
    (total, line) => total + getCartLineSubtotalCents(line),
    0,
  );
}

export function getCartDiscountTotalCents(state: CartState): number {
  return state.coupon?.totalDiscountCents ?? 0;
}

export function getCartGrandTotalCents(state: CartState): number {
  return Math.max(0, getCartSubtotalCents(state) - getCartDiscountTotalCents(state));
}

export function getCartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function getCartLineCount(state: CartState): number {
  return state.lines.length;
}

export function getInvalidCartLines(state: CartState): CartLine[] {
  return state.lines.filter((line) =>
    line.issues.some((issue) => issue.blocking),
  );
}

export function getValidCartLines(state: CartState): CartLine[] {
  return state.lines.filter(
    (line) => !line.issues.some((issue) => issue.blocking),
  );
}

export function isCartCheckoutBlocked(state: CartState): boolean {
  return getInvalidCartLines(state).length > 0;
}

export function getCartTotals(state: CartState): CartTotals {
  return {
    subtotalCents: getCartSubtotalCents(state),
    discountTotalCents: getCartDiscountTotalCents(state),
    grandTotalCents: getCartGrandTotalCents(state),
    itemCount: getCartItemCount(state),
    lineCount: getCartLineCount(state),
  };
}
