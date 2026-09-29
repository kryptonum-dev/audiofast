import { Button, Card, Flex, Stack, Text } from '@sanity/ui';

import { HistoryApiError } from '../lib/ndjson.js';

export const ERROR_FALLBACK = 'Nie udało się pobrać historii z Sanity.';
export const EMPTY_MESSAGE = 'Brak aktywności w wybranym okresie.';

/** Polish message for a failed report load. */
export function errorMessage(error: unknown): string {
  if (error instanceof HistoryApiError && error.message.trim() !== '') {
    return `${ERROR_FALLBACK} ${error.message}`;
  }
  return ERROR_FALLBACK;
}

/** Technical detail for non-History errors (network, 401/403), if any. */
function errorDetail(error: unknown): string | null {
  if (error instanceof HistoryApiError) return null;
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return null;
}

type StateCardProps =
  { kind: 'error'; error: unknown; onRetry?: () => void } | { kind: 'empty' };

export function StateCard(props: StateCardProps) {
  if (props.kind === 'empty') {
    return (
      <Card border padding={4} radius={3} tone="transparent">
        <Text muted size={2}>
          {EMPTY_MESSAGE}
        </Text>
      </Card>
    );
  }

  const detail = errorDetail(props.error);
  return (
    <Card padding={4} radius={3} role="alert" tone="critical">
      <Stack space={4}>
        <Text size={2}>{errorMessage(props.error)}</Text>
        {detail ? (
          <Text muted size={1}>
            Szczegóły: {detail}
          </Text>
        ) : null}
        {props.onRetry ? (
          <Flex>
            <Button
              mode="ghost"
              onClick={props.onRetry}
              text="Spróbuj ponownie"
              tone="critical"
            />
          </Flex>
        ) : null}
      </Stack>
    </Card>
  );
}
