import { Box, Card, Flex, Heading, Spinner, Stack, Text } from "@sanity/ui";
import type { ReactNode } from "react";

type AdminStateCardProps = {
  heading: string;
  description: string;
  action?: ReactNode;
  loading?: boolean;
  tone?: "default" | "critical" | "caution" | "positive";
};

export function AdminStateCard({
  action,
  description,
  heading,
  loading = false,
  tone = "default",
}: AdminStateCardProps) {
  return (
    <Box padding={3}>
      <Card border padding={4} radius={2} tone={tone}>
        <Flex align="center" gap={3}>
          {loading ? <Spinner muted /> : null}
          <Stack space={3}>
            <Heading as="h2" size={1}>
              {heading}
            </Heading>
            <Text muted size={1}>
              {description}
            </Text>
            {action ? <Box>{action}</Box> : null}
          </Stack>
        </Flex>
      </Card>
    </Box>
  );
}
