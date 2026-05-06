import { BarChartIcon, BasketIcon, TagsIcon } from "@sanity/icons";
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Stack,
  Tab,
  TabList,
  TabPanel,
} from "@sanity/ui";
import type { ReactNode } from "react";

import type { AdminArea } from "../types.js";

type AdminShellProps = {
  activeArea: AdminArea;
  children: ReactNode;
};

const ADMIN_AREAS: {
  id: AdminArea;
  label: string;
  icon: typeof BasketIcon;
  disabled?: boolean;
}[] = [
  {
    id: "orders",
    label: "Zamówienia",
    icon: BasketIcon,
  },
  {
    id: "coupons",
    label: "Kupony",
    icon: TagsIcon,
    disabled: true,
  },
  {
    id: "analytics",
    label: "Analityka",
    icon: BarChartIcon,
    disabled: true,
  },
];

export function AdminShell({ activeArea, children }: AdminShellProps) {
  return (
    <Card className="adminAppRoot" height="fill" tone="default">
      <Container width={4}>
        <Box paddingX={[3, 4, 5]} paddingY={[3, 4]} className="adminAppFrame">
          <Stack space={5}>
            <Box paddingX={3} paddingTop={3}>
              <TabList space={2}>
                {ADMIN_AREAS.map((area) => (
                  <Tab
                    key={area.id}
                    aria-controls={`${area.id}-panel`}
                    disabled={area.disabled}
                    icon={area.icon}
                    id={`${area.id}-tab`}
                    label={area.label}
                    selected={activeArea === area.id}
                  />
                ))}
              </TabList>
            </Box>

            <TabPanel
              aria-labelledby={`${activeArea}-tab`}
              id={`${activeArea}-panel`}
            >
              <Box padding={3} paddingTop={2} paddingBottom={4}>
                <Flex align="center" justify="space-between" wrap="wrap">
                  <Heading as="h1" size={3}>
                    Zamówienia
                  </Heading>
                </Flex>
              </Box>
              {children}
            </TabPanel>
          </Stack>
        </Box>
      </Container>
    </Card>
  );
}
