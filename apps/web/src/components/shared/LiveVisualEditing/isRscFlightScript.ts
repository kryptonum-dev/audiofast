/**
 * Next.js streams the RSC payload as inline `self.__next_f.push(...)`
 * scripts. In draft mode it carries the stega strings handed to client
 * components as props: that is how those components render the overlays, and
 * nothing reads the payload as metadata. A report on one of these scripts is
 * expected, not a leak (Phase 11 decision), so it is left out of the audit.
 */
export function isRscFlightScript(element: Element | undefined): boolean {
  return (
    element?.tagName === 'SCRIPT' &&
    !element.hasAttribute('src') &&
    (element.textContent ?? '').trimStart().startsWith('self.__next_f')
  );
}
