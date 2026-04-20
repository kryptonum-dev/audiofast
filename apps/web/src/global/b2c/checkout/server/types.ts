import type { CartState } from '../../cart/types';
import type { CheckoutDomainError, CheckoutDomainResult } from '../errors';
import type { CheckoutOrderDraft } from '../order-draft';
import type { P24TransactionRegistrationInput } from '../payment-contracts';
import type {
  CheckoutDraft,
  CheckoutProfileDefaults,
  CheckoutSessionContext,
  CheckoutSubmitInput,
} from '../types';

export type CheckoutAuthContext = {
  sessionContext: CheckoutSessionContext;
  customerProfile: CheckoutProfileDefaults | null;
  canPrefillFromProfile: boolean;
  isEmailLocked: boolean;
};

export type LoadCheckoutPageData = {
  initialDraft: CheckoutDraft;
  isEmailLocked: boolean;
  sessionContext: CheckoutSessionContext;
  customerProfile: CheckoutProfileDefaults | null;
  canPrefillFromProfile: boolean;
};

export type LoadCheckoutPageResult = CheckoutDomainResult<LoadCheckoutPageData>;

export type PersistCheckoutOrderResult = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  orderDraft: CheckoutOrderDraft;
  insertedItemCount: number;
};

export type CheckoutSubmitSuccessValue = PersistCheckoutOrderResult & {
  input: CheckoutSubmitInput;
  revalidatedCart: CartState;
  paymentRegistrationInput: P24TransactionRegistrationInput;
};

export type CheckoutSubmitFailure = {
  ok: false;
  error: CheckoutDomainError;
  revalidatedCart: CartState | null;
};

export type CheckoutSubmitSuccess = {
  ok: true;
  value: CheckoutSubmitSuccessValue;
};

export type CheckoutSubmitResult =
  | CheckoutSubmitSuccess
  | CheckoutSubmitFailure;

export function createCheckoutSubmitFailure(
  error: CheckoutDomainError,
  revalidatedCart: CartState | null = null,
): CheckoutSubmitFailure {
  return {
    ok: false,
    error,
    revalidatedCart,
  };
}
