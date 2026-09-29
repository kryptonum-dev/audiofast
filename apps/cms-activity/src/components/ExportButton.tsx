import { DownloadIcon } from '@sanity/icons';
import { Button } from '@sanity/ui';

import { appConfig } from '../config.js';
import { buildCsv, csvFileName, eventsToCsvRows } from '../lib/csv.js';
import type { Report } from '../lib/build-report.js';

type ExportButtonProps = {
  report: Report | null;
  authorName: string;
  from: string;
  to: string;
  disabled?: boolean;
};

function downloadText(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the browser has picked the download up.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Downloads the events of the loaded report as an Excel-friendly CSV. */
export function ExportButton({
  report,
  authorName,
  from,
  to,
  disabled,
}: ExportButtonProps) {
  const ready = !!report && report.events.length > 0 && !disabled;

  function handleExport() {
    if (!report) return;
    const rows = eventsToCsvRows(report.events, {
      authorName,
      documents: report.documents,
      studioUrl: appConfig.studioUrl,
      timeZone: appConfig.timeZone,
    });
    downloadText(buildCsv(rows), csvFileName(authorName, from, to));
  }

  return (
    <Button
      disabled={!ready}
      icon={DownloadIcon}
      mode="ghost"
      onClick={handleExport}
      text="Eksportuj CSV"
    />
  );
}
