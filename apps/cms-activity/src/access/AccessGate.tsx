import { useCurrentUser } from '@sanity/sdk-react';
import { Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui';
import type { ReactNode } from 'react';

import { appConfig } from '../config.js';
import { isAllowedUser } from './is-allowed.js';

type AccessGateProps = {
  children: ReactNode;
};

/**
 * Renders children only for allowlisted users. Children (and any data hooks
 * inside them) are never mounted for anyone else, so denied users trigger no
 * History API request.
 */
export function AccessGate({ children }: AccessGateProps) {
  const user = useCurrentUser();

  // `useCurrentUser` returns null until the SDK has resolved the user.
  if (!user) {
    return (
      <Flex
        align="center"
        aria-label="Wczytywanie"
        className="appCentered"
        justify="center"
        role="status"
      >
        <Spinner muted />
      </Flex>
    );
  }

  if (!isAllowedUser(user, appConfig.allowedUsers)) {
    return (
      <Flex align="center" className="appCentered" justify="center" padding={4}>
        <Card padding={5} radius={3} shadow={1} tone="caution">
          <Stack space={4}>
            <Heading as="h1" size={2}>
              Brak dostępu do raportu
            </Heading>
            <Text muted size={2}>
              Twoje konto nie ma uprawnień do tego raportu. Jeśli potrzebujesz
              dostępu, skontaktuj się z administratorem.
            </Text>
          </Stack>
        </Card>
      </Flex>
    );
  }

  return <>{children}</>;
}
