import { DownloadIcon } from '@sanity/icons';
import { Button } from '@sanity/ui';

import { appConfig } from '../config.js';
import type { Report } from '../lib/build-report.js';
import {
  changesTable,
  type ExportContext,
  exportFileName,
  sessionsTable,
} from '../lib/export-tables.js';
import { buildXlsx } from '../lib/xlsx.js';

type ExportButtonProps = {
  report: Report | null;
  authorName: string;
  from: string;
  to: string;
  disabled?: boolean;
};

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadFile(content: Uint8Array, fileName: string): void {
  const blob = new Blob([content as BlobPart], { type: XLSX_TYPE });
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

/**
 * Downloads the loaded report as one Excel workbook with two sheets:
 * "Sesje" (one row per session) and "Zmiany" (one row per changed field).
 */
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
    const context: ExportContext = {
      authorName,
      documents: report.documents,
      studioUrl: appConfig.studioUrl,
      timeZone: appConfig.timeZone,
      cdn: { projectId: appConfig.projectId, dataset: appConfig.dataset },
    };
    const workbook = buildXlsx([
      sessionsTable(report.sessions, report.events, context),
      changesTable(report.events, context),
    ]);
    downloadFile(workbook, exportFileName(authorName, from, to));
  }

  return (
    <Button
      disabled={!ready}
      icon={DownloadIcon}
      mode="ghost"
      onClick={handleExport}
      text="Eksportuj do Excela"
    />
  );
}
