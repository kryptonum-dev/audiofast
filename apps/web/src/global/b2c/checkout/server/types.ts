import type { CartLineRevalidation, CartState } from '../../cart/types';
import type { CheckoutDomainError, CheckoutDomainResult } from '../errors';
import type { CheckoutOrderDraft } from '../order-draft';
import type {
  P24TransactionRegistrationInput,
  P24TransactionRegistrationResult,
} from '../payment-contracts';
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

export type PersistCheckoutOrderResult = {
  orderId: string;
  orderNumber: string;
  paymentSessionId: string;
  createdAt: string;
  orderDraft: CheckoutOrderDraft;
  insertedItemCount: number;
};

export type CheckoutSubmitSuccessValue = PersistCheckoutOrderResult & {
  input: CheckoutSubmitInput;
  revalidatedCart: CartState;
  paymentRegistrationInput: P24TransactionRegistrationInput | null;
  zeroTotalRedirectUrl: string | null;
};

export type StartCheckoutPaymentData = {
  orderId: string;
  orderNumber: string;
  redirectUrl: string;
  registration: P24TransactionRegistrationResult | null;
  wasAlreadyPaid: boolean;
};

export type StartCheckoutPaymentResult =
  CheckoutDomainResult<StartCheckoutPaymentData>;

export type CheckoutSubmitFailure = {
  ok: false;
  error: CheckoutDomainError;
  revalidatedCart: CartState | null;
  revalidationResults: CartLineRevalidation[] | null;
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
  revalidationResults: CartLineRevalidation[] | null = null,
): CheckoutSubmitFailure {
  return {
    ok: false,
    error,
    revalidatedCart,
    revalidationResults,
  };
}
