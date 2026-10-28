'use client';

import type { VisualEditingProps } from 'next-sanity/visual-editing';
import { VisualEditing } from 'next-sanity/visual-editing';

import { isRscFlightScript } from './isRscFlightScript';

/**
 * The Presentation overlay mount, and nothing else. Rendered by the root
 * layout in draft mode only, so published HTML carries no overlay code.
 *
 * A CLIENT component only because `onSuspiciousStega` is a callback: a
 * function cannot cross the server → client boundary as a prop. The import
 * stays static: `next-sanity` already wraps `VisualEditing` in its own
 * `dynamic(..., { ssr: false })`, so no shim of ours is needed.
 *
 * `onSuspiciousStega` is Sanity's runtime audit of stega markers where a
 * machine reads them (attributes, `<head>`, scripts, form values, the URL). In
 * development every report lands on `window.__stegaReports` so a walkthrough
 * can read them as a DOM probe, plus one `console.warn` per batch; production
 * passes no callback.
 *
 * Refreshing on content change is `<SanityLive>`'s job (mounted beside this):
 * its events are document-agnostic, so they also cover chrome singletons.
 * `basePath=""` + `trailingSlash` keep overlay hrefs aligned with the site's
 * trailing-slash URLs.
 */

type SuspiciousStegaReports = Parameters<
  NonNullable<VisualEditingProps['onSuspiciousStega']>
>[0];

/** One report, DOM references replaced by the element's tag name. */
export type StegaReportRecord = {
  kind: SuspiciousStegaReports[number]['kind'];
  element?: string;
  attribute?: string;
  value: string;
  cleaned: string;
};

declare global {
  interface Window {
    /** Every suspicious-stega report of this page load, in order. Dev only. */
    __stegaReports?: StegaReportRecord[];
  }
}

function reportSuspiciousStega(reports: SuspiciousStegaReports): void {
  const leaks = reports.filter(
    (report) =>
      !(report.kind === 'script' && isRscFlightScript(report.element)),
  );
  if (leaks.length === 0) return;
  const records: StegaReportRecord[] = leaks.map((report) => ({
    kind: report.kind,
    element: report.element?.tagName.toLowerCase(),
    attribute: report.attribute,
    value: report.value,
    cleaned: report.cleaned,
  }));
  window.__stegaReports = [...(window.__stegaReports ?? []), ...records];
  console.warn(
    `[stega] ${records.length} suspicious value(s): ` +
      records
        .map(
          (record) =>
            `${record.kind}${record.attribute ? ` ${record.attribute}` : ''}${record.element ? `@${record.element}` : ''}`,
        )
        .join(', '),
  );
}

const onSuspiciousStega =
  process.env.NODE_ENV !== 'production' ? reportSuspiciousStega : undefined;

export default function LiveVisualEditing() {
  return (
    <VisualEditing
      basePath=""
      trailingSlash
      onSuspiciousStega={onSuspiciousStega}
    />
  );
}
