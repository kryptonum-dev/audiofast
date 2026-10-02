import { assetKind } from './assets.js';
import { studioEditUrl } from './documents.js';
import { assetFileUrl, type ImageCdnTarget } from './images.js';
import {
  documentLabel,
  documentTypeLabel,
  eventActionLabel,
} from './labels.js';
import { RECONSTRUCTION_FAILED } from './reconstruct.js';
import { dateKey, minutesOfDay } from './time.js';
import type { ResolvedDocument, Session, SessionedEvent } from './types.js';

/**
 * The two export tables ("Sesje" and "Zmiany") as typed cells, so the
 * spreadsheet stores real dates, times and numbers. Every cell holds one
 * value; null is an empty cell.
 */
export type SheetCell =
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  /** Calendar date, `YYYY-MM-DD`. */
  | { type: 'date'; value: string }
  /** Time of day in whole minutes since midnight. */
  | { type: 'time'; value: number }
  | { type: 'link'; value: string; url: string }
  | null;

export type SheetTable = {
  name: string;
  header: readonly string[];
  rows: SheetCell[][];
};

export type ExportContext = {
  authorName: string;
  documents: ReadonlyMap<string, ResolvedDocument>;
  studioUrl: string;
  timeZone: string;
  cdn: ImageCdnTarget;
};

/** One row per session: how long the editor worked and on what. */
export const SESSIONS_HEADER = [
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
export const CHANGES_HEADER = [
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

const text = (value: string): SheetCell =>
  value === '' ? null : { type: 'text', value };
const number = (value: number): SheetCell => ({ type: 'number', value });
const date = (iso: string, timeZone: string): SheetCell => ({
  type: 'date',
  value: dateKey(iso, timeZone),
});
const time = (iso: string, timeZone: string): SheetCell => ({
  type: 'time',
  value: Math.floor(minutesOfDay(iso, timeZone)),
});

/**
 * One row per session, chronological: the date and the start / end times
 * as separate cells, the duration in whole minutes (so a column sum is the
 * total active time), and the counts of distinct documents (uploads
 * excluded), publishes and uploaded images.
 */
export function sessionsTable(
  sessions: readonly Session[],
  events: readonly SessionedEvent[],
  context: ExportContext,
): SheetTable {
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

  const rows = sessions.map((session): SheetCell[] => {
    const entry = stats.get(session.index);
    return [
      date(session.start, context.timeZone),
      number(session.index),
      time(session.start, context.timeZone),
      time(session.end, context.timeZone),
      number(Math.round(session.durationMinutes)),
      number(entry?.documents.size ?? 0),
      number(entry?.publishes ?? 0),
      number(entry?.images.size ?? 0),
      text(context.authorName),
    ];
  });
  return { name: 'Sesje', header: SESSIONS_HEADER, rows };
}

/**
 * One row per changed field, chronological. An edit (or a create) of three
 * fields is three rows; a changed section, slide or other array item goes
 * in "Element" (one row per item). Publish, unpublish, delete and discard
 * are one row with "Pole" empty: their fields already show on the edits
 * that changed them. Uploads are one row too, reading "Obraz"/"Plik" with
 * their file name and a link to the file itself.
 */
export function changesTable(
  events: readonly SessionedEvent[],
  context: ExportContext,
): SheetTable {
  const rows: SheetCell[][] = [];
  for (const event of events) {
    const doc = context.documents.get(event.documentId);
    const type = doc?.type ?? event.docType ?? '';
    const asset = assetKind(type);
    let link: SheetCell = null;
    if (!doc?.deleted) {
      const fileUrl = asset
        ? assetFileUrl(event.documentId, context.cdn)
        : null;
      if (fileUrl) {
        link = {
          type: 'link',
          value: asset === 'image' ? 'Otwórz obraz' : 'Otwórz plik',
          url: fileUrl,
        };
      } else if (!asset && type) {
        link = {
          type: 'link',
          value: 'Otwórz w Studio',
          url: studioEditUrl(context.studioUrl, event.documentId, type),
        };
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

    const cells: SheetCell[] = [
      date(event.at, context.timeZone),
      time(event.at, context.timeZone),
      number(event.sessionIndex),
      text(documentLabel(event.documentId, doc)),
      text(documentTypeLabel(type)),
      text(eventActionLabel({ ...event, docType: type })),
    ];
    for (const [field, item] of fields) {
      rows.push([
        ...cells,
        text(field),
        text(item),
        text(context.authorName),
        link,
      ]);
    }
  }
  return { name: 'Zmiany', header: CHANGES_HEADER, rows };
}

/** ASCII file-name slug: Polish diacritics folded, everything else dashed. */
export function slugify(value: string): string {
  const slug = value
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'redaktor' : slug;
}

/** `raport-pracy-<slug(author)>-<from>-<to>.xlsx` */
export function exportFileName(
  authorName: string,
  from: string,
  to: string,
): string {
  return `raport-pracy-${slugify(authorName)}-${from}-${to}.xlsx`;
}
