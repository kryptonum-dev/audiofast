import { isAssetType } from './assets.js';
import {
  documentLabel,
  documentTypeLabel,
  eventActionLabel,
} from './labels.js';
import { studioEditUrl } from './documents.js';
import { formatIsoLocal } from './time.js';
import type { ResolvedDocument, SessionedEvent } from './types.js';

export const CSV_SEPARATOR = ';';
const CRLF = '\r\n';
const BOM = '\uFEFF';

export const CSV_HEADER = [
  'Data i godzina',
  'Redaktor',
  'Dokument',
  'Typ',
  'Link',
  'Akcja',
  'Zmienione pola',
  'Zapisy',
  'Sesja',
] as const;

const NUMERIC_RE = /^-?\d+(?:[.,]\d+)?$/;
/** Leading characters Excel may evaluate as a formula. */
const FORMULA_START_RE = /^[=+\-@\t\r]/;

/**
 * Escape one cell: neutralise formula-like text (Excel / CSV injection) with a
 * leading apostrophe, then quote when it contains the separator, a quote or
 * a line break.
 */
export function csvCell(value: string): string {
  let cell = value;
  if (FORMULA_START_RE.test(cell) && !NUMERIC_RE.test(cell)) {
    cell = `'${cell}`;
  }
  if (/[";\r\n]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Excel (pl-PL) friendly CSV: `;` separator, CRLF line endings, UTF-8 BOM so
 * Polish diacritics survive a double-click open.
 */
export function buildCsv(rows: readonly (readonly string[])[]): string {
  return (
    BOM +
    rows.map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join(CRLF) +
    CRLF
  );
}

export type CsvContext = {
  authorName: string;
  documents: ReadonlyMap<string, ResolvedDocument>;
  studioUrl: string;
  timeZone: string;
};

/**
 * Header plus one row per event. "Typ" is the Polish type label; image and
 * file uploads read "Obraz"/"Plik" with "Dodanie obrazu/pliku" and no fields.
 */
export function eventsToCsvRows(
  events: readonly SessionedEvent[],
  context: CsvContext,
): string[][] {
  const rows: string[][] = [[...CSV_HEADER]];
  for (const event of events) {
    const doc = context.documents.get(event.documentId);
    const type = doc?.type ?? event.docType ?? '';
    const link =
      type && !doc?.deleted
        ? studioEditUrl(context.studioUrl, event.documentId, type)
        : '';
    const asset = isAssetType(type);
    rows.push([
      formatIsoLocal(event.at, context.timeZone),
      context.authorName,
      documentLabel(event.documentId, doc),
      documentTypeLabel(type),
      link,
      eventActionLabel({ ...event, docType: type }),
      asset ? '' : event.changedFields.join(', '),
      String(event.mergedCount),
      String(event.sessionIndex),
    ]);
  }
  return rows;
}

/** ASCII file-name slug: Polish diacritics folded, everything else dashed. */
export function slugify(value: string): string {
  const slug = value
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'redaktor' : slug;
}

/** `raport-pracy-<slug(author)>-<from>-<to>.csv` */
export function csvFileName(
  authorName: string,
  from: string,
  to: string,
): string {
  return `raport-pracy-${slugify(authorName)}-${from}-${to}.csv`;
}
