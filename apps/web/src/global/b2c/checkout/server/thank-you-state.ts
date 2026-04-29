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
