import {
  ASSET_ACTION_LABELS,
  ASSET_TYPE_LABELS,
  assetKind,
} from './assets.js';
import { typeLabel } from './field-labels.js';
import type {
  ActivityAction,
  ActivityEvent,
  ResolvedDocument,
} from './types.js';

/** Polish label per action, shared by the events table and the CSV export. */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  edit: 'Edycja',
  create: 'Utworzenie',
  publish: 'Publikacja',
  unpublish: 'Cofnięcie publikacji',
  delete: 'Usunięcie',
  discard: 'Odrzucenie szkicu',
};

/** Label shown for an edit written straight to the published document. */
export const DIRECT_EDIT_LABEL = 'Edycja opublikowanej wersji';

export function actionLabel(
  event: Pick<ActivityEvent, 'action' | 'direct'>,
): string {
  if (event.action === 'edit' && event.direct) return DIRECT_EDIT_LABEL;
  return ACTION_LABELS[event.action];
}

/** Display name of a document, falling back to its id. */
export function documentLabel(
  documentId: string,
  doc: ResolvedDocument | undefined,
): string {
  const name = doc?.name?.trim();
  const base = name && name !== '' ? name : documentId;
  return doc?.deleted ? `${base} (usunięty)` : base;
}

/** Placeholder for an empty "changed fields" cell. */
export const EMPTY_CELL = '—';

/**
 * Polish label of a document type (`product` → "Produkt audio"), shared by
 * the report screen and the CSV "Typ" column. Empty for an unknown type.
 */
export function documentTypeLabel(type: string | null | undefined): string {
  if (!type) return '';
  const asset = assetKind(type);
  if (asset) return ASSET_TYPE_LABELS[asset];
  return typeLabel(type);
}

/** Action label of an event; asset uploads read "Dodanie obrazu/pliku". */
export function eventActionLabel(
  event: Pick<ActivityEvent, 'action' | 'direct' | 'docType'>,
): string {
  const asset = assetKind(event.docType);
  if (asset) return ASSET_ACTION_LABELS[asset];
  return actionLabel(event);
}
