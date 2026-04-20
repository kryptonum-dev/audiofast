import type { CheckoutCartBlockingReasonCode } from './cart';
import type { CheckoutSubmitErrors } from './validation';

export type CheckoutDomainErrorCode =
  | 'form_invalid'
  | 'cart_invalid'
  | 'cart_empty'
  | 'cart_stale'
  | 'email_locked_mismatch'
  | 'order_draft_invalid'
  | 'payment_registration_failed'
  | 'payment_notification_invalid'
  | 'payment_verification_failed'
  | 'internal_error';

export type CheckoutDomainError =
  | {
      code: 'form_invalid';
      message: string;
      fieldErrors: CheckoutSubmitErrors;
    }
  | {
      code: 'cart_invalid';
      message: string;
      blockingReasonCodes: CheckoutCartBlockingReasonCode[];
    }
  | {
      code: 'cart_empty';
      message: string;
    }
  | {
      code: 'cart_stale';
      message: string;
    }
  | {
      code: 'email_locked_mismatch';
      message: string;
    }
  | {
      code: 'order_draft_invalid';
      message: string;
    }
  | {
      code: 'payment_registration_failed';
      message: string;
    }
  | {
      code: 'payment_notification_invalid';
      message: string;
    }
  | {
      code: 'payment_verification_failed';
      message: string;
    }
  | {
      code: 'internal_error';
      message: string;
    };

export type CheckoutDomainSuccess<T> = {
  ok: true;
  value: T;
};

export type CheckoutDomainFailure = {
  ok: false;
  error: CheckoutDomainError;
};

export type CheckoutDomainResult<T> =
  | CheckoutDomainSuccess<T>
  | CheckoutDomainFailure;

export function createCheckoutSuccess<T>(
  value: T,
): CheckoutDomainSuccess<T> {
  return {
    ok: true,
    value,
  };
}

export function createCheckoutFailure(
  error: CheckoutDomainError,
): CheckoutDomainFailure {
  return {
    ok: false,
    error,
  };
}

export function createCheckoutFormInvalidError(
  fieldErrors: CheckoutSubmitErrors,
): CheckoutDomainError {
  return {
    code: 'form_invalid',
    message: 'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
    fieldErrors,
  };
}

export function createCheckoutCartInvalidError(
  blockingReasonCodes: CheckoutCartBlockingReasonCode[],
): CheckoutDomainError {
  return {
    code: 'cart_invalid',
    message:
      'Nie udało się przejść dalej, ponieważ koszyk zawiera pozycje wymagające poprawy.',
    blockingReasonCodes,
  };
}

export function createCheckoutCartEmptyError(): CheckoutDomainError {
  return {
    code: 'cart_empty',
    message: 'Koszyk jest pusty.',
  };
}

export function createCheckoutCartStaleError(): CheckoutDomainError {
  return {
    code: 'cart_stale',
    message:
      'Dane koszyka są nieaktualne. Odśwież koszyk i spróbuj ponownie.',
  };
}

export function createCheckoutEmailLockedMismatchError(): CheckoutDomainError {
  return {
    code: 'email_locked_mismatch',
    message:
      'Adres e-mail zalogowanego klienta nie może zostać zmieniony podczas składania zamówienia.',
  };
}

export function createCheckoutOrderDraftInvalidError(): CheckoutDomainError {
  return {
    code: 'order_draft_invalid',
    message:
      'Nie udało się przygotować danych zamówienia. Spróbuj ponownie za chwilę.',
  };
}

export function createCheckoutPaymentRegistrationFailedError(): CheckoutDomainError {
  return {
    code: 'payment_registration_failed',
    message:
      'Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.',
  };
}

export function createCheckoutPaymentNotificationInvalidError(): CheckoutDomainError {
  return {
    code: 'payment_notification_invalid',
    message:
      'Odebrano nieprawidłowe potwierdzenie płatności.',
  };
}

export function createCheckoutPaymentVerificationFailedError(): CheckoutDomainError {
  return {
    code: 'payment_verification_failed',
    message:
      'Nie udało się potwierdzić płatności. Spróbuj ponownie za chwilę.',
  };
}

export function createCheckoutInternalError(): CheckoutDomainError {
  return {
    code: 'internal_error',
    message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
  };
}
