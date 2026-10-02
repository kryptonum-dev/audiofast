import { EnvelopeIcon, LockIcon } from '@sanity/icons';
import { useCurrentUser } from '@sanity/sdk-react';
import { Button, Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui';
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
    return <AccessDenied email={user.email ?? null} />;
  }

  return <>{children}</>;
}

function accessRequestHref(email: string | null): string {
  const { accessContact } = appConfig;
  const subject = 'Dostęp do raportu pracy CMS';
  const body = email
    ? `Cześć, proszę o dostęp do raportu pracy CMS dla konta ${email}.`
    : 'Cześć, proszę o dostęp do raportu pracy CMS.';
  return `mailto:${accessContact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Shown to signed-in users outside the allowlist; mounts no data hooks. */
function AccessDenied({ email }: { email: string | null }) {
  const { accessContact } = appConfig;
  return (
    <Flex align="center" className="appCentered" justify="center" padding={4}>
      <Card
        as="main"
        border
        className="accessDenied"
        padding={[5, 5, 6]}
        radius={4}
      >
        <Stack space={5}>
          <span aria-hidden="true" className="accessDenied__icon">
            <LockIcon />
          </span>
          <Stack space={4}>
            <Heading as="h1" size={3}>
              Raport pracy CMS jest dostępny tylko dla wybranych osób
            </Heading>
            <Text muted size={2}>
              Raport pokazuje aktywność redaktorów w CMS i widzą go wyłącznie
              osoby wskazane przez Audiofast. Twoje konto nie jest na tej
              liście.
            </Text>
            <Text muted size={2}>
              {`Jeśli potrzebujesz dostępu, napisz do: ${accessContact.name}.`}
            </Text>
          </Stack>
          <Flex align="center" gap={4} wrap="wrap">
            <Button
              as="a"
              href={accessRequestHref(email)}
              icon={EnvelopeIcon}
              mode="ghost"
              rel="noreferrer"
              target="_blank"
              text="Poproś o dostęp"
            />
            {email ? (
              <Text muted size={1}>
                {`Zalogowano jako ${email}`}
              </Text>
            ) : null}
          </Flex>
        </Stack>
      </Card>
    </Flex>
  );
}
