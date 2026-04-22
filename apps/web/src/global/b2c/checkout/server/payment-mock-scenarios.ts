import {
  DEFAULT_MOCK_P24_SCENARIO_ID,
  type MockP24ScenarioId,
} from '../mock-payment-scenarios';
import type { CheckoutOrderStatus } from '../order-draft';
import type {
  P24ReturnStatus,
  P24TransactionNotificationStatus,
} from '../payment-contracts';

export {
  DEFAULT_MOCK_P24_SCENARIO_ID,
  type MockP24ScenarioId,
} from '../mock-payment-scenarios';

export type MockP24EventOrder = 'status_before_return' | 'return_before_status';

export type MockP24VerificationMode = 'verified';

export type MockP24Scenario = {
  id: MockP24ScenarioId;
  providerNotificationStatus: P24TransactionNotificationStatus | null;
  returnStatus: P24ReturnStatus;
  eventOrder: MockP24EventOrder;
  verificationMode: MockP24VerificationMode;
  finalOrderStatus: Extract<CheckoutOrderStatus, 'awaiting_payment' | 'paid'>;
  description: string;
};

export const MOCK_P24_SCENARIOS: Record<MockP24ScenarioId, MockP24Scenario> = {
  success_status_before_return: {
    id: 'success_status_before_return',
    providerNotificationStatus: 'done',
    returnStatus: 'success',
    eventOrder: 'status_before_return',
    verificationMode: 'verified',
    finalOrderStatus: 'paid',
    description:
      'Provider notification confirms payment before the browser returns.',
  },
  success_return_before_status: {
    id: 'success_return_before_status',
    providerNotificationStatus: 'done',
    returnStatus: 'success',
    eventOrder: 'return_before_status',
    verificationMode: 'verified',
    finalOrderStatus: 'paid',
    description:
      'Browser returns first, but backend confirmation arrives later and wins.',
  },
};

export function getMockP24Scenario(
  scenarioId: MockP24ScenarioId = DEFAULT_MOCK_P24_SCENARIO_ID,
): MockP24Scenario {
  return MOCK_P24_SCENARIOS[scenarioId];
}

export function listMockP24ScenarioIds(): MockP24ScenarioId[] {
  return Object.keys(MOCK_P24_SCENARIOS) as MockP24ScenarioId[];
}
