import { Box, Container, Heading, Stack, Text } from '@sanity/ui';

import { ConnectionTest } from './ConnectionTest.js';

/**
 * Report screen shell. Phase 3 adds filters, tables and CSV export; the
 * temporary connection test is removed in Phase 5.
 */
export function ReportApp() {
  return (
    <Box padding={[3, 4, 5]}>
      <Container width={4}>
        <Stack space={5}>
          <Stack space={3}>
            <Heading as="h1" size={3}>
              Raport pracy CMS
            </Heading>
            <Text muted size={2}>
              Aktywność redaktorów w CMS na podstawie historii zmian Sanity.
            </Text>
          </Stack>
          <ConnectionTest />
        </Stack>
      </Container>
    </Box>
  );
}
