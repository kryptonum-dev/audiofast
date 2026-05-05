import {
  getInvalidCartLines,
  getValidCartLines,
  hasBlockingCartLineIssues,
} from '../cart/cart-selectors';
import type {
  CartLine,
  CartLineIssueCode,
  CartLineType,
  CartState,
} from '../cart/types';

export type CheckoutCartBlockingReasonCode =
  | 'empty_cart'
  | 'blocking_line_issues'
  | 'no_eligible_lines';

export type CheckoutCartBlockingLineIssue = {
  lineId: string;
  lineType: CartLineType;
  productKey: string;
  productName: string;
  issueCode: CartLineIssueCode;
  message: string;
};

export type CheckoutCartValidationResult = {
  isReady: boolean;
  blockingReasonCodes: CheckoutCartBlockingReasonCode[];
  validLines: CartLine[];
  invalidLines: CartLine[];
  blockingIssues: CheckoutCartBlockingLineIssue[];
};

function createBlockingIssue(
  line: CartLine,
  issueCode: CartLineIssueCode,
  message: string,
): CheckoutCartBlockingLineIssue {
  return {
    lineId: line.lineId,
    lineType: line.lineType,
    productKey: line.productKey,
    productName: line.productName,
    issueCode,
    message,
  };
}

export function getCheckoutValidLines(state: CartState): CartLine[] {
  return getValidCartLines(state);
}

export function getCheckoutInvalidLines(state: CartState): CartLine[] {
  return getInvalidCartLines(state);
}

export function getCheckoutBlockingLineIssues(
  state: CartState,
): CheckoutCartBlockingLineIssue[] {
  return state.lines.flatMap((line) =>
    line.issues
      .filter((issue) => issue.blocking)
      .map((issue) => createBlockingIssue(line, issue.code, issue.message)),
  );
}

export function isCheckoutCartEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

export function hasCheckoutEligibleLines(state: CartState): boolean {
  return getCheckoutValidLines(state).length > 0;
}

export function hasCheckoutBlockingLineIssues(state: CartState): boolean {
  return state.lines.some(hasBlockingCartLineIssues);
}

export function getCheckoutBlockingReasonCodes(
  state: CartState,
): CheckoutCartBlockingReasonCode[] {
  const reasonCodes: CheckoutCartBlockingReasonCode[] = [];

  if (isCheckoutCartEmpty(state)) {
    reasonCodes.push('empty_cart');
  }

  if (hasCheckoutBlockingLineIssues(state)) {
    reasonCodes.push('blocking_line_issues');
  }

  if (!hasCheckoutEligibleLines(state)) {
    reasonCodes.push('no_eligible_lines');
  }

  return reasonCodes;
}

export function validateCheckoutCart(
  state: CartState,
): CheckoutCartValidationResult {
  const validLines = getCheckoutValidLines(state);
  const invalidLines = getCheckoutInvalidLines(state);
  const blockingIssues = getCheckoutBlockingLineIssues(state);
  const blockingReasonCodes = getCheckoutBlockingReasonCodes(state);

  return {
    isReady: blockingReasonCodes.length === 0,
    blockingReasonCodes,
    validLines,
    invalidLines,
    blockingIssues,
  };
}
