/**
 * The pure half of `slug-preview-navigation.tsx`, split out so its test runs
 * without a Studio.
 */

/** Keep query parameters (including perspective) while moving an owned route. */
export function renamedPreviewUrl(
  preview: string | undefined,
  previousPath: string,
  nextPath: string,
): string | null {
  if (!preview || previousPath === nextPath) return null;
  const url = new URL(preview, 'https://preview.invalid');
  if (url.pathname !== previousPath) return null;
  return `${nextPath}${url.search}${url.hash}`;
}

export type SavedRoute = { segment: string | null; href: string | null } | null;

/** The route must exist in the perspective actually displayed by the iframe. */
export async function isSavedPreviewRoute<Perspective>(
  resolve: (perspective: Perspective) => Promise<SavedRoute>,
  perspective: Perspective,
  segment: string,
  pathname: string,
): Promise<boolean> {
  const saved = await resolve(perspective);
  return saved?.segment === segment && saved.href === pathname;
}
