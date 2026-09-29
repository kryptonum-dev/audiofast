import { useClient } from '@sanity/sdk-react';
import { Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { useState } from 'react';

import { appConfig } from '../config.js';
import { fetchTransactionsPage } from '../lib/history-client.js';

type TestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; count: number }
  | { status: 'error'; message: string };

const TEST_RANGE_DAYS = 7;
const TEST_LIMIT = 3;

/**
 * TEMPORARY (Phase 1 spike, removed in Phase 5): proves the SDK-issued token
 * can read the project-host History API. Requests limit=3 for the last 7 days.
 */
export function ConnectionTest() {
  const client = useClient({ apiVersion: appConfig.apiVersion });
  const [state, setState] = useState<TestState>({ status: 'idle' });

  async function runTest() {
    setState({ status: 'loading' });
    const toTime = new Date();
    const fromTime = new Date(
      toTime.getTime() - TEST_RANGE_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const transactions = await fetchTransactionsPage(client, {
        dataset: appConfig.dataset,
        fromTime: fromTime.toISOString(),
        toTime: toTime.toISOString(),
        limit: TEST_LIMIT,
      });
      setState({ status: 'ok', count: transactions.length });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Card border padding={4} radius={3}>
      <Stack space={3}>
        <Flex align="center" gap={3} wrap="wrap">
          <Button
            disabled={state.status === 'loading'}
            loading={state.status === 'loading'}
            mode="ghost"
            onClick={() => void runTest()}
            text="Test połączenia"
          />
          <Text muted size={1}>
            Pobiera maksymalnie {TEST_LIMIT} transakcje z ostatnich{' '}
            {TEST_RANGE_DAYS} dni.
          </Text>
        </Flex>
        {state.status === 'ok' ? (
          <Text size={1}>
            Połączenie działa. Pobrane transakcje: {state.count}.
          </Text>
        ) : null}
        {state.status === 'error' ? (
          <Card padding={3} radius={2} tone="critical">
            <Text size={1}>Błąd połączenia: {state.message}</Text>
          </Card>
        ) : null}
      </Stack>
    </Card>
  );
}
