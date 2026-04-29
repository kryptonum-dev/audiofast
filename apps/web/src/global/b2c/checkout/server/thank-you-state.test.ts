import { describe, expect, it } from 'vitest';

import {
  getCheckoutThankYouStateDefinition,
  shouldRenderCheckoutConfirmationPage,
} from './thank-you-state';

describe('thank-you-state', () => {
  it('allows only paid and active awaiting_payment states to render confirmation UI', () => {
    expect(shouldRenderCheckoutConfirmationPage('paid')).toBe(true);
    expect(shouldRenderCheckoutConfirmationPage('awaiting_payment')).toBe(true);
    expect(shouldRenderCheckoutConfirmationPage('expired')).toBe(false);
    expect(shouldRenderCheckoutConfirmationPage('invalid_access')).toBe(false);
  });

  it('exposes stable definitions for the paid state', () => {
    expect(getCheckoutThankYouStateDefinition('paid')).toEqual({
      id: 'paid',
      title: 'Dziękujemy za złożenie zamówienia',
      description:
        'Zamówienie zostało potwierdzone w naszym systemie. O kolejnych etapach jego realizacji będziemy informować Cię mailowo.',
      shouldPoll: false,
      showSupportContact: false,
    });
  });

  it('exposes stable definitions for the awaiting_payment state', () => {
    expect(getCheckoutThankYouStateDefinition('awaiting_payment')).toEqual({
      id: 'awaiting_payment',
      title: 'Oczekujemy na potwierdzenie płatności',
      description:
        'Zamówienie nadal pozostaje w stanie oczekiwania na płatność. Jeśli środki zostały już pobrane, odśwież stronę za chwilę lub skontaktuj się z obsługą.',
      shouldPoll: true,
      showSupportContact: true,
    });
  });
});
