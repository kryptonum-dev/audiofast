/**
 * The pure half of the „Otwórz w podglądzie" action
 * (`plugins/presentation-url.ts`), split out so `presentation-url.test.ts`
 * runs without a Studio.
 */

export type HrefResolution = {
  href: string | null;
  key: string;
};

export type OpenInPresentationOptions = {
  isCurrent: () => boolean;
  /** Receives the resolved page href; the component turns it into an intent. */
  navigate: (href: string) => void;
  onError: () => void;
  onMissing: () => void;
  resolveHref: () => Promise<string | null>;
};

/** A missing href is settled and clickable so the action can explain the fix. */
export function isOpenInPresentationDisabled(
  resolution: HrefResolution | null,
  currentKey: string,
  opening: boolean,
): boolean {
  return opening || resolution?.key !== currentKey;
}

/**
 * Resolve at activation time instead of trusting the action menu's rendered
 * snapshot. Sanity can keep that snapshot mounted across an async slug save.
 */
export async function resolveAndOpenInPresentation({
  isCurrent,
  navigate,
  onError,
  onMissing,
  resolveHref,
}: OpenInPresentationOptions): Promise<
  'error' | 'missing' | 'opened' | 'stale'
> {
  try {
    const href = await resolveHref();
    if (!isCurrent()) return 'stale';

    if (!href) {
      onMissing();
      return 'missing';
    }

    navigate(href);
    return 'opened';
  } catch {
    if (!isCurrent()) return 'stale';
    onError();
    return 'error';
  }
}
