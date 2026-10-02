import {
  ChevronDownIcon,
  ClockIcon,
  DocumentsIcon,
  DownloadIcon,
} from '@sanity/icons';
import { Button, Menu, MenuButton, MenuItem } from '@sanity/ui';

import { appConfig } from '../config.js';
import {
  buildCsv,
  changesToCsvRows,
  type CsvContext,
  type CsvKind,
  csvFileName,
  sessionsToCsvRows,
} from '../lib/csv.js';
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

/**
 * Export menu with two Excel-friendly CSV files: sessions (working time)
 * and changes (one row per changed field). Two menu items rather than one
 * button, as browsers often block a second download from a single click.
 */
export function ExportButton({
  report,
  authorName,
  from,
  to,
  disabled,
}: ExportButtonProps) {
  const ready = !!report && report.events.length > 0 && !disabled;

  function handleExport(kind: CsvKind) {
    if (!report) return;
    const context: CsvContext = {
      authorName,
      documents: report.documents,
      studioUrl: appConfig.studioUrl,
      timeZone: appConfig.timeZone,
      cdn: { projectId: appConfig.projectId, dataset: appConfig.dataset },
    };
    const rows =
      kind === 'sessions'
        ? sessionsToCsvRows(report.sessions, report.events, context)
        : changesToCsvRows(report.events, context);
    downloadText(buildCsv(rows), csvFileName(authorName, from, to, kind));
  }

  return (
    <MenuButton
      button={
        <Button
          disabled={!ready}
          icon={DownloadIcon}
          iconRight={ChevronDownIcon}
          mode="ghost"
          text="Eksportuj CSV"
        />
      }
      id="export-csv"
      menu={
        <Menu>
          <MenuItem
            icon={ClockIcon}
            onClick={() => handleExport('sessions')}
            text="Sesje i czas pracy"
          />
          <MenuItem
            icon={DocumentsIcon}
            onClick={() => handleExport('changes')}
            text="Zmiany w dokumentach"
          />
        </Menu>
      }
      popover={{ placement: 'bottom-end', portal: true }}
    />
  );
}
