import { useTheme_v2 } from '@sanity/ui';
import { useEffect } from 'react';

/**
 * Mirrors the active Sanity UI card theme onto `<html>`: background, text
 * colour and `color-scheme` (so the page never shows a white strip past the
 * content or on overscroll), plus a few CSS variables for the plain CSS in
 * `App.css`.
 */
export function ThemeDocument({ scheme }: { scheme: 'light' | 'dark' }) {
  const theme = useTheme_v2();
  const { color, font } = theme;

  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = {
      '--app-bg': color.bg,
      '--app-fg': color.fg,
      '--app-muted-fg': color.muted.fg,
      '--app-border': color.border,
      '--app-accent': color.link.fg,
      '--app-font': font.text.family,
    };
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.style.colorScheme = scheme;
    root.style.backgroundColor = color.bg;
    root.style.color = color.fg;
  }, [color, font, scheme]);

  return null;
}
