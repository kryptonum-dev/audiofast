import { SanityApp, type SanityConfig } from "@sanity/sdk-react";
import { Box, Card, Spinner, ThemeProvider, usePrefersDark } from "@sanity/ui";
import { buildTheme } from "@sanity/ui/theme";

import { AdminApp } from "./admin/AdminApp.js";
import { sanityAppConfig } from "./config.js";
import "./App.css";

const sanityConfig: SanityConfig[] = [
  {
    projectId: sanityAppConfig.projectId,
    dataset: sanityAppConfig.dataset,
  },
];
const theme = buildTheme();

function AppFallback() {
  return (
    <Card className="adminLoadingRoot" height="fill">
      <Box padding={4}>
        <Spinner muted />
      </Box>
    </Card>
  );
}

export default function App() {
  const prefersDark = usePrefersDark();
  const scheme = prefersDark ? "dark" : "light";

  return (
    <ThemeProvider scheme={scheme} theme={theme}>
      <div className="adminThemeRoot">
        <SanityApp config={sanityConfig} fallback={<AppFallback />}>
          <AdminApp />
        </SanityApp>
      </div>
    </ThemeProvider>
  );
}
