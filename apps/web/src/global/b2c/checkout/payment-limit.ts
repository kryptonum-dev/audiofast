export const ONLINE_PAYMENT_LIMIT_CENTS = 5_000_000;

export const ONLINE_PAYMENT_LIMIT_MESSAGE =
  'Wartość zamówienia przekracza limit płatności online 50 000 zł. Skontaktuj się z Audiofast, aby sfinalizować zakup indywidualnie.';

export function isOnlinePaymentAmountOverLimit(amountCents: number): boolean {
  return amountCents > ONLINE_PAYMENT_LIMIT_CENTS;
}
