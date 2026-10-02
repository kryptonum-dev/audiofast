import { SanityApp, type SanityConfig } from '@sanity/sdk-react';
import {
  Card,
  Flex,
  LayerProvider,
  PortalProvider,
  Spinner,
  ThemeProvider,
  usePrefersDark,
} from '@sanity/ui';
import { buildTheme } from '@sanity/ui/theme';

import { AccessGate } from './access/AccessGate.js';
import { ReportApp } from './components/ReportApp.js';
import { ThemeDocument } from './components/ThemeDocument.js';
import { appConfig } from './config.js';
import './App.css';

const sanityConfig: SanityConfig[] = [
  {
    projectId: appConfig.projectId,
    dataset: appConfig.dataset,
  },
];
const theme = buildTheme();

function AppFallback() {
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

export default function App() {
  const prefersDark = usePrefersDark();
  const scheme = prefersDark ? 'dark' : 'light';

  return (
    <ThemeProvider scheme={scheme} theme={theme}>
      {/* Layers and a body portal for popovers (the export menu). */}
      <LayerProvider>
        <PortalProvider>
          <Card className="appRoot">
            <ThemeDocument scheme={scheme} />
            <SanityApp config={sanityConfig} fallback={<AppFallback />}>
              <AccessGate>
                <ReportApp />
              </AccessGate>
            </SanityApp>
          </Card>
        </PortalProvider>
      </LayerProvider>
    </ThemeProvider>
  );
}
