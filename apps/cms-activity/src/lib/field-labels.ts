import generated from '../generated/field-labels.json' with { type: 'json' };

/**
 * Polish labels generated from the Studio schema sources by
 * `scripts/generate-field-labels.ts` (`bun run generate:labels`).
 */
export type FieldLabels = {
  /** Field name → title (global, first occurrence in the schema wins). */
  fields: Record<string, string>;
  /** Type name (document, object, array member) → title. */
  types: Record<string, string>;
  /** Type name → its direct field names → title. Optional. */
  byType?: Record<string, Record<string, string>>;
};

export const fieldLabels: FieldLabels = generated;

/**
 * Generic field names whose first-occurrence title in the schema is too
 * specific (e.g. `name` → "Nazwa nagrody"). Used when the document type gives
 * no better answer. Fields without a title in the schema (`pageBuilder`,
 * `slug` from the slug helper) get the label editors know.
 */
const COMMON_FIELDS: Record<string, string> = {
  name: 'Nazwa',
  title: 'Tytuł',
  subtitle: 'Podtytuł',
  description: 'Opis',
  heading: 'Nagłówek',
  image: 'Zdjęcie',
  slug: 'Adres URL (slug)',
  seo: 'SEO',
  pageBuilder: 'Sekcje',
  content: 'Treść',
  buttons: 'Przyciski',
  publishedDate: 'Data publikacji',
};

/** Labels for built-in Sanity types that have no schema title. */
const BUILTIN_TYPES: Record<string, string> = {
  block: 'Tekst',
  image: 'Zdjęcie',
  file: 'Plik',
  reference: 'Odnośnik',
  slug: 'Slug',
};

/** `technicalData` → `Technical data`, `hero_image` → `Hero image`. */
export function humanize(name: string): string {
  const words = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  if (words === '') return name;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Label of a field path. Only the last segment is labelled; `typeHint` (the
 * document type) makes top-level labels exact when the schema defines the
 * field directly on that type.
 */
export function fieldLabel(
  path: readonly string[],
  typeHint?: string,
  labels: FieldLabels = fieldLabels,
): string {
  const name = path[path.length - 1];
  if (!name) return '';
  if (typeHint && path.length === 1) {
    const own = labels.byType?.[typeHint]?.[name];
    if (own) return own;
  }
  return COMMON_FIELDS[name] ?? labels.fields[name] ?? humanize(name);
}

/** Label of a document or object type (`heroCarousel` → "Sekcja Hero…"). */
export function typeLabel(
  type: string,
  labels: FieldLabels = fieldLabels,
): string {
  return labels.types[type] ?? BUILTIN_TYPES[type] ?? humanize(type);
}

/**
 * Label of a changed array item: the schema title of its `_type`, else its
 * own name, else the raw type. Returns null when nothing useful identifies
 * the item (Portable Text blocks, bare references or images).
 */
export function blockLabel(
  item: { type?: string; name?: string },
  labels: FieldLabels = fieldLabels,
): string | null {
  const { type, name } = item;
  if (type && labels.types[type]) return labels.types[type];
  if (name && name.trim() !== '') return name.trim();
  if (!type || type in BUILTIN_TYPES || type === 'object') return null;
  return humanize(type);
}
