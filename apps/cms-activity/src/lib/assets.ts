/**
 * Image and file uploads show up in the history as `sanity.imageAsset` /
 * `sanity.fileAsset` documents. They are not content the editor works on,
 * so the report folds them into a single "added N images" line.
 */

export type AssetKind = 'image' | 'file';

const ASSET_TYPES: Record<string, AssetKind> = {
  'sanity.imageAsset': 'image',
  'sanity.fileAsset': 'file',
};

/** Asset kind of a document type, or null for regular documents. */
export function assetKind(docType: string | null | undefined): AssetKind | null {
  if (!docType) return null;
  return ASSET_TYPES[docType] ?? null;
}

export function isAssetType(docType: string | null | undefined): boolean {
  return assetKind(docType) !== null;
}

/** Polish plural forms: [1, 2–4 (not 12–14), 5+ / 0]. */
export type PluralForms = readonly [one: string, few: string, many: string];

export function pluralForm(count: number, forms: PluralForms): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return forms[0];
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return forms[1];
  }
  return forms[2];
}

/** `3 obrazy`, `5 plików`. */
export function countLabel(count: number, forms: PluralForms): string {
  return `${count} ${pluralForm(count, forms)}`;
}

export const PLURALS = {
  image: ['obraz', 'obrazy', 'obrazów'],
  file: ['plik', 'pliki', 'plików'],
  document: ['dokument', 'dokumenty', 'dokumentów'],
  session: ['sesja', 'sesje', 'sesji'],
  save: ['zapis', 'zapisy', 'zapisów'],
  day: ['dzień', 'dni', 'dni'],
  publish: ['publikacja', 'publikacje', 'publikacji'],
  field: ['pole', 'pola', 'pól'],
  other: ['inny', 'inne', 'innych'],
} as const satisfies Record<string, PluralForms>;

/** CSV "Typ" of an asset row. */
export const ASSET_TYPE_LABELS: Record<AssetKind, string> = {
  image: 'Obraz',
  file: 'Plik',
};

/** CSV "Akcja" of an asset row. */
export const ASSET_ACTION_LABELS: Record<AssetKind, string> = {
  image: 'Dodanie obrazu',
  file: 'Dodanie pliku',
};

export type AssetCounts = { images: number; files: number };

/** `Dodano 3 obrazy i 1 plik`, or null when nothing was added. */
export function assetSummary(counts: AssetCounts): string | null {
  const parts: string[] = [];
  if (counts.images > 0) parts.push(countLabel(counts.images, PLURALS.image));
  if (counts.files > 0) parts.push(countLabel(counts.files, PLURALS.file));
  if (parts.length === 0) return null;
  return `Dodano ${parts.join(' i ')}`;
}
