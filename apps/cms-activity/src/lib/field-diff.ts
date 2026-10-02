import {
  blockLabel,
  fieldLabel,
  fieldLabels as defaultLabels,
  type FieldLabels,
} from './field-labels.js';
import type { FieldChange } from './types.js';

/** One changed top-level field; `item` identifies a changed array element. */
export type ChangedField = {
  field: string;
  item?: { key?: string; type?: string; name?: string };
};

/** System fields that change on every write and say nothing about content. */
const IGNORED_FIELDS = new Set([
  '_rev',
  '_updatedAt',
  '_createdAt',
  '_id',
  '_type',
  '_system',
]);

/** Item fields tried, in order, for a human-readable array item name. */
const ITEM_NAME_FIELDS = ['name', 'title', 'label', 'heading'] as const;

/** At most this many item labels per field; the rest become `+N`. */
const MAX_ITEMS_PER_FIELD = 3;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural equality for JSON values (mendoza shares unchanged subtrees). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Undefined, null, empty string and empty array/object count as "empty". */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) {
    return Object.keys(value).every((key) => isEmptyValue(value[key]));
  }
  return false;
}

function itemKey(item: unknown): string | undefined {
  if (!isPlainObject(item)) return undefined;
  return typeof item._key === 'string' ? item._key : undefined;
}

function describeItem(item: unknown): ChangedField['item'] {
  if (!isPlainObject(item)) return {};
  const described: NonNullable<ChangedField['item']> = {};
  const key = itemKey(item);
  if (key) described.key = key;
  if (typeof item._type === 'string') described.type = item._type;
  for (const field of ITEM_NAME_FIELDS) {
    const value = item[field];
    if (typeof value === 'string' && value.trim() !== '') {
      described.name = value.trim();
      break;
    }
  }
  return described;
}

/**
 * Changed items of a keyed array (added, removed or deep-changed, matched by
 * `_key`). Returns null when the array is not keyed, so the caller reports
 * the field alone. An order-only change yields an empty list.
 */
function diffKeyedArray(
  prev: unknown[],
  next: unknown[],
): ChangedField['item'][] | null {
  const all = [...prev, ...next];
  if (all.length === 0 || !all.every((item) => itemKey(item) !== undefined)) {
    return null;
  }

  const before = new Map(prev.map((item) => [itemKey(item) as string, item]));
  const after = new Map(next.map((item) => [itemKey(item) as string, item]));
  const changed: ChangedField['item'][] = [];

  for (const [key, item] of after) {
    const old = before.get(key);
    if (old === undefined || !deepEqual(old, item)) {
      changed.push(describeItem(item));
    }
  }
  for (const [key, item] of before) {
    if (!after.has(key)) changed.push(describeItem(item));
  }
  return changed;
}

/**
 * List changed top-level fields between two versions of one document. Either
 * side may be null (document created / deleted). Fields whose value goes
 * between two "empty" states (undefined, null, '', []) are not changes. For
 * keyed arrays every added, removed or modified item is reported separately.
 */
export function diffDocuments(prev: unknown, next: unknown): ChangedField[] {
  const before = isPlainObject(prev) ? prev : {};
  const after = isPlainObject(next) ? next : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !IGNORED_FIELDS.has(key))
    .sort();

  const changes: ChangedField[] = [];
  for (const field of keys) {
    const a = before[field];
    const b = after[field];
    if (a === b || deepEqual(a, b)) continue;
    if (isEmptyValue(a) && isEmptyValue(b)) continue;

    if (Array.isArray(a) || Array.isArray(b)) {
      const items = diffKeyedArray(
        Array.isArray(a) ? a : [],
        Array.isArray(b) ? b : [],
      );
      if (items && items.length > 0) {
        for (const item of items) changes.push({ field, item });
        continue;
      }
    }
    changes.push({ field });
  }
  return changes;
}

/** Stable identity of a change, for de-duplication across transactions. */
export function changeKey(change: ChangedField): string {
  const item = change.item;
  if (!item) return change.field;
  return `${change.field}|${item.key ?? ''}|${item.type ?? ''}|${item.name ?? ''}`;
}

type GroupedChange = { field: string; items: string[] };

/**
 * Changes grouped per top-level field in first-seen order, with the
 * de-duplicated labels of their changed array items. Items without a useful
 * label (Portable Text blocks, bare references) leave the field alone.
 */
function groupChanges(
  changes: readonly ChangedField[],
  labels: FieldLabels,
): GroupedChange[] {
  const groups = new Map<string, string[]>();
  for (const change of changes) {
    let items = groups.get(change.field);
    if (!items) {
      items = [];
      groups.set(change.field, items);
    }
    if (!change.item) continue;
    const label = blockLabel(change.item, labels);
    if (label && !items.includes(label)) items.push(label);
  }
  return [...groups].map(([field, items]) => ({ field, items }));
}

/**
 * Human-readable, de-duplicated list of changed fields, e.g. `Opis`,
 * `Sekcje: Sekcja Hero / Sekcja FAQ`. One entry per top-level field, in
 * first-seen order; items without a useful label collapse into the field.
 */
export function formatChangedFields(
  changes: readonly ChangedField[],
  options: { typeHint?: string; labels?: FieldLabels } = {},
): string[] {
  const labels = options.labels ?? defaultLabels;
  return groupChanges(changes, labels).map(({ field, items }) => {
    const label = fieldLabel([field], options.typeHint, labels);
    if (items.length === 0) return label;
    const shown = items.slice(0, MAX_ITEMS_PER_FIELD);
    const rest = items.length - shown.length;
    return `${label}: ${shown.join(' / ')}${rest > 0 ? ` / +${rest}` : ''}`;
  });
}

/**
 * The same changes one per field and item, for the CSV: `Sekcje` with
 * `Sekcja Hero` and `Sekcje` with `Sekcja FAQ` are two entries, and no
 * item is cut off. A field without labelled items is one entry, item null.
 */
export function listFieldChanges(
  changes: readonly ChangedField[],
  options: { typeHint?: string; labels?: FieldLabels } = {},
): FieldChange[] {
  const labels = options.labels ?? defaultLabels;
  return groupChanges(changes, labels).flatMap(
    ({ field, items }): FieldChange[] => {
      const label = fieldLabel([field], options.typeHint, labels);
      if (items.length === 0) return [{ field: label, item: null }];
      return items.map((item) => ({ field: label, item }));
    },
  );
}

/** Union of field changes, first-seen order, de-duplicated by field and item. */
export function mergeFieldChanges(
  ...lists: readonly (readonly FieldChange[])[]
): FieldChange[] {
  const seen = new Set<string>();
  const merged: FieldChange[] = [];
  for (const change of lists.flat()) {
    const key = `${change.field}\u0000${change.item ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(change);
  }
  return merged;
}
