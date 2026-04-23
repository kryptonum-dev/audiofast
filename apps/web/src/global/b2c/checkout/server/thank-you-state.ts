import type { MockP24ScenarioId } from '../mock-payment-scenarios';
import type { CheckoutOrderStatus } from '../order-draft';

export type CheckoutThankYouStateId =
  | 'awaiting_payment'
  | 'paid'
  | 'expired'
  | 'invalid_access';

export type CheckoutThankYouStateDefinition = {
  id: CheckoutThankYouStateId;
  title: string;
  description: string;
  shouldPoll: boolean;
  showSupportContact: boolean;
};

export type CheckoutThankYouResolvableOrderStatus = Extract<
  CheckoutOrderStatus,
  'awaiting_payment' | 'paid'
>;

const CHECKOUT_THANK_YOU_STATE_DEFINITIONS: Record<
  CheckoutThankYouStateId,
  CheckoutThankYouStateDefinition
> = {
  awaiting_payment: {
    id: 'awaiting_payment',
    title: 'Oczekujemy na potwierdzenie płatności',
    description:
      'Zamówienie nadal pozostaje w stanie oczekiwania na płatność. Jeśli środki zostały już pobrane, odśwież stronę za chwilę lub skontaktuj się z obsługą.',
    shouldPoll: true,
    showSupportContact: true,
  },
  paid: {
    id: 'paid',
    title: 'Dziękujemy za złożenie zamówienia',
    description:
      'Zamówienie zostało potwierdzone w naszym systemie. O kolejnych etapach jego realizacji będziemy informować Cię mailowo.',
    shouldPoll: false,
    showSupportContact: false,
  },
  expired: {
    id: 'expired',
    title: 'Okno płatności wygasło',
    description:
      'Zamówienie pozostaje w bazie, ale pierwotna próba płatności nie jest już aktywna. Do ponownego zakupu potrzebny jest nowy checkout.',
    shouldPoll: false,
    showSupportContact: true,
  },
  invalid_access: {
    id: 'invalid_access',
    title: 'Nie możemy pokazać tego zamówienia',
    description:
      'Nie znaleźliśmy poprawnego dostępu do zamówienia albo dane powrotu nie pozwalają jeszcze ustalić, co pokazać klientowi.',
    shouldPoll: false,
    showSupportContact: true,
  },
};

export const MOCK_P24_SCENARIO_TO_THANK_YOU_STATE: Record<
  MockP24ScenarioId,
  CheckoutThankYouStateId
> = {
  success_status_before_return: 'paid',
  success_return_before_status: 'paid',
};

function isExpired(args: {
  payableUntil: string | null;
  now: string;
}): boolean {
  if (args.payableUntil === null) {
    return false;
  }

  const payableUntilTime = Date.parse(args.payableUntil);
  const nowTime = Date.parse(args.now);

  if (Number.isNaN(payableUntilTime) || Number.isNaN(nowTime)) {
    return false;
  }

  return nowTime > payableUntilTime;
}

export function getCheckoutThankYouStateDefinition(
  stateId: CheckoutThankYouStateId,
): CheckoutThankYouStateDefinition {
  return CHECKOUT_THANK_YOU_STATE_DEFINITIONS[stateId];
}

export function shouldRenderCheckoutConfirmationPage(
  stateId: CheckoutThankYouStateId,
): boolean {
  return stateId === 'awaiting_payment' || stateId === 'paid';
}

export function resolveCheckoutThankYouState(args: {
  hasOrderAccess: boolean;
  currentOrderStatus: CheckoutThankYouResolvableOrderStatus | null;
  payableUntil: string | null;
  now?: string;
}): CheckoutThankYouStateDefinition {
  if (!args.hasOrderAccess || args.currentOrderStatus === null) {
    return getCheckoutThankYouStateDefinition('invalid_access');
  }

  if (args.currentOrderStatus === 'paid') {
    return getCheckoutThankYouStateDefinition('paid');
  }

  const now = args.now ?? new Date().toISOString();

  if (isExpired({ payableUntil: args.payableUntil, now })) {
    return getCheckoutThankYouStateDefinition('expired');
  }

  return getCheckoutThankYouStateDefinition('awaiting_payment');
}

export function mapMockP24ScenarioToThankYouState(
  scenarioId: MockP24ScenarioId,
): CheckoutThankYouStateDefinition {
  return getCheckoutThankYouStateDefinition(
    MOCK_P24_SCENARIO_TO_THANK_YOU_STATE[scenarioId],
  );
}
