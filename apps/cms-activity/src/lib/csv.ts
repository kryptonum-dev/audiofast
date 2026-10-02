import { assetKind } from './assets.js';
import {
  documentLabel,
  documentTypeLabel,
  eventActionLabel,
} from './labels.js';
import { studioEditUrl } from './documents.js';
import { assetFileUrl, type ImageCdnTarget } from './images.js';
import { RECONSTRUCTION_FAILED } from './reconstruct.js';
import { dateKey, formatTime } from './time.js';
import type { ResolvedDocument, Session, SessionedEvent } from './types.js';

export const CSV_SEPARATOR = ';';
const CRLF = '\r\n';
const BOM = '\uFEFF';

/** One row per session: how long the editor worked and on what. */
export const SESSIONS_CSV_HEADER = [
  'Data',
  'Sesja',
  'Od',
  'Do',
  'Czas (min)',
  'Dokumenty',
  'Publikacje',
  'Obrazy',
  'Redaktor',
] as const;

/** One row per changed field: what the editor did. */
export const CHANGES_CSV_HEADER = [
  'Data',
  'Godzina',
  'Sesja',
  'Dokument',
  'Typ',
  'Akcja',
  'Pole',
  'Element',
  'Redaktor',
  'Link',
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
  cdn: ImageCdnTarget;
};

/**
 * Header plus one row per session, chronological. Every cell holds one
 * value: the date and the start / end times are separate, the duration is
 * whole minutes (so a column sum is the total active time), and the counts
 * are distinct documents (uploads excluded), publishes and uploaded images.
 */
export function sessionsToCsvRows(
  sessions: readonly Session[],
  events: readonly SessionedEvent[],
  context: CsvContext,
): string[][] {
  const stats = new Map<
    number,
    { documents: Set<string>; publishes: number; images: Set<string> }
  >();
  for (const event of events) {
    let entry = stats.get(event.sessionIndex);
    if (!entry) {
      entry = { documents: new Set(), publishes: 0, images: new Set() };
      stats.set(event.sessionIndex, entry);
    }
    const asset = assetKind(event.docType);
    if (asset === 'image') entry.images.add(event.documentId);
    if (asset) continue;
    entry.documents.add(event.documentId);
    if (event.action === 'publish') entry.publishes += 1;
  }

  const rows: string[][] = [[...SESSIONS_CSV_HEADER]];
  for (const session of sessions) {
    const entry = stats.get(session.index);
    rows.push([
      dateKey(session.start, context.timeZone),
      String(session.index),
      formatTime(session.start, context.timeZone),
      formatTime(session.end, context.timeZone),
      String(Math.round(session.durationMinutes)),
      String(entry?.documents.size ?? 0),
      String(entry?.publishes ?? 0),
      String(entry?.images.size ?? 0),
      context.authorName,
    ]);
  }
  return rows;
}

/**
 * Header plus one row per changed field, chronological. An edit (or a
 * create) of three fields is three rows; a changed section, slide or other
 * array item goes in "Element" (one row per item). Publish, unpublish,
 * delete and discard are one row with "Pole" empty: their fields already
 * show on the edits that changed them. Uploads are one row too, reading
 * "Obraz"/"Plik" with their file name and a link to the file itself.
 */
export function changesToCsvRows(
  events: readonly SessionedEvent[],
  context: CsvContext,
): string[][] {
  const rows: string[][] = [[...CHANGES_CSV_HEADER]];
  for (const event of events) {
    const doc = context.documents.get(event.documentId);
    const type = doc?.type ?? event.docType ?? '';
    const asset = assetKind(type);
    let link = '';
    if (!doc?.deleted) {
      if (asset) link = assetFileUrl(event.documentId, context.cdn) ?? '';
      else if (type) {
        link = studioEditUrl(context.studioUrl, event.documentId, type);
      }
    }

    const listsFields =
      !asset && (event.action === 'edit' || event.action === 'create');
    const fields: [string, string][] = listsFields
      ? event.fieldChanges.map((change) => [change.field, change.item ?? ''])
      : [];
    if (listsFields && event.changedFields.includes(RECONSTRUCTION_FAILED)) {
      fields.push([RECONSTRUCTION_FAILED, '']);
    }
    if (fields.length === 0) fields.push(['', '']);

    const cells = [
      dateKey(event.at, context.timeZone),
      formatTime(event.at, context.timeZone),
      String(event.sessionIndex),
      documentLabel(event.documentId, doc),
      documentTypeLabel(type),
      eventActionLabel({ ...event, docType: type }),
    ];
    for (const [field, item] of fields) {
      rows.push([...cells, field, item, context.authorName, link]);
    }
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

export type CsvKind = 'sessions' | 'changes';

const FILE_SUFFIX: Record<CsvKind, string> = {
  sessions: 'sesje',
  changes: 'zmiany',
};

/** `raport-pracy-<slug(author)>-<from>-<to>-<sesje|zmiany>.csv` */
export function csvFileName(
  authorName: string,
  from: string,
  to: string,
  kind: CsvKind,
): string {
  return `raport-pracy-${slugify(authorName)}-${from}-${to}-${FILE_SUFFIX[kind]}.csv`;
}
