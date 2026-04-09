import { syncCouponWithCart } from './cart-coupon';
import { CART_STORAGE_VERSION } from './constants';
import type { CartLine, CartState, StandardCartLine } from './types';

export function createEmptyCart(): CartState {
  return {
    version: CART_STORAGE_VERSION,
    lines: [],
    coupon: null,
  };
}

function mergeStandardLines(
  existingLine: StandardCartLine,
  incomingLine: StandardCartLine,
): StandardCartLine {
  return {
    ...existingLine,
    quantity: existingLine.quantity + incomingLine.quantity,
    unitPriceCents: incomingLine.unitPriceCents,
    isReturnable: incomingLine.isReturnable,
    configurationSummary: incomingLine.configurationSummary,
    configurationSignature: incomingLine.configurationSignature,
    issues: incomingLine.issues,
    product: incomingLine.product,
  };
}

export function addCartLine(state: CartState, line: CartLine): CartState {
  if (line.lineType === 'standard') {
    const existingLineIndex = state.lines.findIndex(
      (existingLine) =>
        existingLine.lineType === 'standard' &&
        existingLine.productKey === line.productKey &&
        existingLine.configurationSignature === line.configurationSignature,
    );

    if (existingLineIndex >= 0) {
      const mergedLines = [...state.lines];
      const existingLine = mergedLines[existingLineIndex] as StandardCartLine;

      mergedLines[existingLineIndex] = mergeStandardLines(existingLine, line);

      return syncCouponWithCart({
        ...state,
        lines: mergedLines,
      });
    }
  }

  if (line.lineType === 'cpo') {
    const existingLineIndex = state.lines.findIndex(
      (existingLine) =>
        existingLine.lineType === 'cpo' &&
        existingLine.productKey === line.productKey,
    );

    if (existingLineIndex >= 0) {
      const refreshedLines = [...state.lines];
      refreshedLines[existingLineIndex] = line;

      return syncCouponWithCart({
        ...state,
        lines: refreshedLines,
      });
    }
  }

  return syncCouponWithCart({
    ...state,
    lines: [...state.lines, line],
  });
}

export function removeCartLine(state: CartState, lineId: string): CartState {
  return syncCouponWithCart({
    ...state,
    lines: state.lines.filter((line) => line.lineId !== lineId),
  });
}

export function clearCart(): CartState {
  return createEmptyCart();
}

export function setStandardLineQuantity(
  state: CartState,
  lineId: string,
  quantity: number,
): CartState {
  const targetLine = state.lines.find((line) => line.lineId === lineId);

  if (!targetLine || targetLine.lineType !== 'standard') {
    return state;
  }

  if (quantity <= 0) {
    return removeCartLine(state, lineId);
  }

  return syncCouponWithCart({
    ...state,
    lines: state.lines.map((line) =>
      line.lineId === lineId && line.lineType === 'standard'
        ? {
            ...line,
            quantity: Math.max(1, Math.floor(quantity)),
          }
        : line,
    ),
  });
}

export function incrementStandardLineQuantity(
  state: CartState,
  lineId: string,
): CartState {
  const targetLine = state.lines.find((line) => line.lineId === lineId);

  if (!targetLine || targetLine.lineType !== 'standard') {
    return state;
  }

  return setStandardLineQuantity(state, lineId, targetLine.quantity + 1);
}

export function decrementStandardLineQuantity(
  state: CartState,
  lineId: string,
): CartState {
  const targetLine = state.lines.find((line) => line.lineId === lineId);

  if (!targetLine || targetLine.lineType !== 'standard') {
    return state;
  }

  return setStandardLineQuantity(state, lineId, targetLine.quantity - 1);
}

export function replaceStandardCartLine(
  state: CartState,
  lineId: string,
  nextLine: StandardCartLine,
): CartState {
  const targetLine = state.lines.find((line) => line.lineId === lineId);

  if (!targetLine || targetLine.lineType !== 'standard') {
    return state;
  }

  const matchingLineIndex = state.lines.findIndex(
    (line) =>
      line.lineType === 'standard' &&
      line.lineId !== lineId &&
      line.productKey === nextLine.productKey &&
      line.configurationSignature === nextLine.configurationSignature,
  );

  if (matchingLineIndex >= 0) {
    const matchingLine = state.lines[matchingLineIndex];

    if (matchingLine?.lineType !== 'standard') {
      return state;
    }

    const remainingLines = state.lines.filter(
      (line) => line.lineId !== lineId && line.lineId !== matchingLine.lineId,
    );

    const mergedLine = {
      ...matchingLine,
      quantity: matchingLine.quantity + nextLine.quantity,
      unitPriceCents: nextLine.unitPriceCents,
      isReturnable: nextLine.isReturnable,
      configurationSummary: nextLine.configurationSummary,
      configurationSignature: nextLine.configurationSignature,
      issues: nextLine.issues,
      product: nextLine.product,
    };

    return syncCouponWithCart({
      ...state,
      lines: [...remainingLines, mergedLine],
    });
  }

  return syncCouponWithCart({
    ...state,
    lines: state.lines.map((line) =>
      line.lineId === lineId && line.lineType === 'standard'
        ? {
            ...nextLine,
            lineId,
          }
        : line,
    ),
  });
}
