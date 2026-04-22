export const MOCK_P24_SCENARIO_IDS = [
  'success_status_before_return',
  'success_return_before_status',
] as const;

export type MockP24ScenarioId = (typeof MOCK_P24_SCENARIO_IDS)[number];

export const DEFAULT_MOCK_P24_SCENARIO_ID: MockP24ScenarioId =
  'success_status_before_return';

export const MOCK_P24_SCENARIO_OPTIONS: Array<{
  id: MockP24ScenarioId;
  label: string;
}> = [
  {
    id: 'success_status_before_return',
    label: 'Sukces: status przed powrotem',
  },
  {
    id: 'success_return_before_status',
    label: 'Sukces: powrót przed statusem',
  },
];
