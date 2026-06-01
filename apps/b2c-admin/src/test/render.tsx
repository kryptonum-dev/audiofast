import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react";
import { ThemeProvider } from "@sanity/ui";
import { buildTheme } from "@sanity/ui/theme";
import type { ReactElement, ReactNode } from "react";

const theme = buildTheme();

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider scheme="light" theme={theme}>
      {children}
    </ThemeProvider>
  );
}

export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: Providers,
    ...options,
  });
}

export * from "@testing-library/react";
