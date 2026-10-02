import { flushSync } from 'react-dom';

/** Longest wait for new images to decode before the transition starts. */
const IMAGE_WAIT_MS = 200;

/**
 * Valid `view-transition-name` from arbitrary parts (document ids contain
 * dots and may start with digits, so prefix and replace anything else).
 */
export function transitionName(
  prefix: string,
  ...parts: (string | number)[]
): string {
  return [prefix, ...parts].join('-').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply a React state update inside a same-document view transition, so
 * elements sharing a `view-transition-name` morph between their old and new
 * place. Falls back to a plain update without the API, with reduced motion,
 * or in a hidden tab.
 */
export function runViewTransition(
  update: () => void,
  scope?: Element | null,
): void {
  if (
    typeof document.startViewTransition !== 'function' ||
    document.visibilityState === 'hidden' ||
    prefersReducedMotion()
  ) {
    update();
    return;
  }

  document.startViewTransition(async () => {
    flushSync(update);
    if (!scope) return;
    // A thumbnail that is not decoded yet would be captured blank.
    const pending = [...scope.querySelectorAll('img')].filter(
      (img) => !img.complete,
    );
    if (pending.length === 0) return;
    await Promise.race([
      Promise.all(pending.map((img) => img.decode().catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, IMAGE_WAIT_MS)),
    ]);
  });
}
