import { describe, expect, it } from 'vitest';

import {
  getCheckoutThankYouStateDefinition,
  mapMockP24ScenarioToThankYouState,
  resolveCheckoutThankYouState,
} from './thank-you-state';

describe('thank-you-state', () => {
  it('treats paid orders as confirmed even if the browser return looked failed', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: 'paid',
      payableUntil: '2026-04-23T10:15:00.000Z',
      returnStatus: 'failure',
      now: '2026-04-23T10:05:00.000Z',
    });

    expect(state.id).toBe('paid');
    expect(state.shouldPoll).toBe(false);
    expect(state.showSupportContact).toBe(false);
  });

  it('shows awaiting_payment for active unpaid orders after a success-looking return', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: 'awaiting_payment',
      payableUntil: '2026-04-23T10:15:00.000Z',
      returnStatus: 'success',
      now: '2026-04-23T10:05:00.000Z',
    });

    expect(state.id).toBe('awaiting_payment');
    expect(state.shouldPoll).toBe(true);
    expect(state.showSupportContact).toBe(true);
  });

  it('keeps failure-looking returns inside the same awaiting_payment view', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: 'awaiting_payment',
      payableUntil: '2026-04-23T10:15:00.000Z',
      returnStatus: 'failure',
      now: '2026-04-23T10:05:00.000Z',
    });

    expect(state.id).toBe('awaiting_payment');
  });

  it('keeps cancelled returns inside the same awaiting_payment view', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: 'awaiting_payment',
      payableUntil: '2026-04-23T10:15:00.000Z',
      returnStatus: 'cancel',
      now: '2026-04-23T10:05:00.000Z',
    });

    expect(state.id).toBe('awaiting_payment');
  });

  it('shows expired when an unpaid order is no longer payable', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: 'awaiting_payment',
      payableUntil: '2026-04-23T10:15:00.000Z',
      returnStatus: 'pending',
      now: '2026-04-23T10:20:00.000Z',
    });

    expect(state.id).toBe('expired');
    expect(state.shouldPoll).toBe(false);
    expect(state.showSupportContact).toBe(true);
  });

  it('shows invalid access when the order cannot be resolved', () => {
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: false,
      currentOrderStatus: null,
      payableUntil: null,
      returnStatus: null,
    });

    expect(state.id).toBe('invalid_access');
    expect(state.showSupportContact).toBe(true);
  });

  it('maps mock scenarios into the accepted thank-you state model', () => {
    expect(
      mapMockP24ScenarioToThankYouState('success_return_before_status').id,
    ).toBe('paid');
    expect(
      mapMockP24ScenarioToThankYouState('success_status_before_return').id,
    ).toBe('paid');
  });

  it('exposes stable definitions for the paid state', () => {
    expect(getCheckoutThankYouStateDefinition('paid')).toEqual({
      id: 'paid',
      title: 'Dziękujemy za zamówienie',
      description:
        'Płatność została potwierdzona, a zamówienie jest już zapisane jako opłacone.',
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
