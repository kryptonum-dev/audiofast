import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MOCK_P24_SCENARIO_ID,
  getMockP24Scenario,
  listMockP24ScenarioIds,
} from './payment-mock-scenarios';

describe('payment-mock-scenarios', () => {
  it('uses a confirmed success flow as the default scenario', () => {
    const scenario = getMockP24Scenario(DEFAULT_MOCK_P24_SCENARIO_ID);

    expect(scenario.id).toBe('success_status_before_return');
    expect(scenario.providerNotificationStatus).toBe('done');
    expect(scenario.returnStatus).toBe('success');
    expect(scenario.eventOrder).toBe('status_before_return');
    expect(scenario.verificationMode).toBe('verified');
    expect(scenario.finalOrderStatus).toBe('paid');
  });

  it('supports the delayed confirmation success flow', () => {
    const scenario = getMockP24Scenario('success_return_before_status');

    expect(scenario.providerNotificationStatus).toBe('done');
    expect(scenario.returnStatus).toBe('success');
    expect(scenario.eventOrder).toBe('return_before_status');
    expect(scenario.finalOrderStatus).toBe('paid');
  });

  it('exposes only the two accepted step four browser scenarios', () => {
    expect(listMockP24ScenarioIds()).toEqual([
      'success_status_before_return',
      'success_return_before_status',
    ]);
  });
});
