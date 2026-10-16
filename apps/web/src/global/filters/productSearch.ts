/**
 * Product text search shared by the server listing (ProductsListing → GROQ)
 * and the client filter sidebar (computeFilters), so both always agree on
 * which products match.
 *
 * Searchable text is "brand name + product name". Every query word has to
 * match, in any order:
 * - the start of a word ("gri" → Grimm Audio, "clock" → Vivaldi Clock),
 *   where a word is either a whitespace chunk with its punctuation removed
 *   ("LS-3" → "ls3", "D'Agostino" → "dagostino", "R_volution" → "rvolution")
 *   or a piece between punctuation ("ls", "3", "agostino", "volution"),
 * - or, for words of at least SUBSTRING_MIN_LENGTH characters, any part of a
 *   single chunk ("aldi" → Vivaldi). The substring never crosses chunks, so
 *   short fragments don't produce noise across brand + name boundaries.
 * Case, Polish/other diacritics and surrounding spaces are ignored.
 */

export type ProductSearchFields = {
  _id?: string;
  name?: string | null;
  brandName?: string | null;
};

/**
 * Relevance tiers, best first. The listing GROQ (productsFilterConditions and
 * the relevance sort in sanity/query.ts) expects exactly PRODUCT_SEARCH_TIER_COUNT tiers.
 * - 0: the whole query is the product name ("mu1", "ls 3")
 * - 1: every word matches the product name by word start
 * - 2: every word matches by word start, some only through the brand name
 * - 3: at least one word matched only as a fragment inside a word
 */
export type ProductSearchTier = 0 | 1 | 2 | 3;
export const PRODUCT_SEARCH_TIER_COUNT = 4;

export type ProductSearchQuery = {
  /** Canonical form of the query (normalized words joined by a space) */
  normalized: string;
  /** The query with all whitespace and punctuation removed */
  compact: string;
  terms: SearchTerm[];
};

type SearchTerm = {
  compact: string;
  pieces: string[];
};

type FieldIndex = {
  /** Compact chunks and punctuation pieces, used for word-start matching */
  words: string[];
  /** Compact chunks, used for fragment matching */
  chunks: string[];
};

type ProductIndex = {
  name: FieldIndex;
  brand: FieldIndex;
  all: FieldIndex;
  compactName: string;
};

const SUBSTRING_MIN_LENGTH = 4;

// Letters NFD does not decompose into base letter + combining mark
const SPECIAL_LETTERS: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
};

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[łøđßæœ]/g, (letter) => SPECIAL_LETTERS[letter] ?? letter)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function splitChunks(normalized: string): SearchTerm[] {
  return normalized
    .split(/\s+/)
    .map((chunk) => ({
      compact: chunk.replace(/[^a-z0-9]/g, ''),
      pieces: chunk.split(/[^a-z0-9]+/).filter(Boolean),
    }))
    .filter((chunk) => chunk.compact !== '');
}

function buildFieldIndex(value: string | null | undefined): FieldIndex {
  const chunks = splitChunks(normalizeSearchText(value ?? ''));
  return {
    words: [
      ...new Set(chunks.flatMap((chunk) => [chunk.compact, ...chunk.pieces])),
    ],
    chunks: chunks.map((chunk) => chunk.compact),
  };
}

// Filter metadata objects are stable per cached fetch, so the index is built
// once per product instead of on every computeFilters pass.
const indexCache = new WeakMap<ProductSearchFields, ProductIndex>();

function getProductIndex(product: ProductSearchFields): ProductIndex {
  const cached = indexCache.get(product);
  if (cached) return cached;

  const name = buildFieldIndex(product.name);
  const brand = buildFieldIndex(product.brandName);
  const index: ProductIndex = {
    name,
    brand,
    all: {
      words: [...brand.words, ...name.words],
      chunks: [...brand.chunks, ...name.chunks],
    },
    compactName: name.chunks.join(''),
  };
  indexCache.set(product, index);
  return index;
}

/**
 * Parse a raw search string. Returns null when it has no searchable
 * characters (empty, only spaces or only punctuation like `"`, `*`, `'`),
 * which callers treat as "no search".
 */
export function parseProductSearch(query: string): ProductSearchQuery | null {
  const normalized = normalizeSearchText(query).split(/\s+/).join(' ');
  const terms = splitChunks(normalized);
  if (terms.length === 0) return null;

  return {
    normalized,
    compact: terms.map((term) => term.compact).join(''),
    terms,
  };
}

function matchesWordStart(term: SearchTerm, field: FieldIndex): boolean {
  if (field.words.some((word) => word.startsWith(term.compact))) return true;
  // "r_volution" → "r" + "volution", "audio-research" → "audio" + "research"
  return (
    term.pieces.length > 1 &&
    term.pieces.every((piece) =>
      field.words.some((word) => word.startsWith(piece)),
    )
  );
}

function matchesFragment(term: SearchTerm, field: FieldIndex): boolean {
  return (
    term.compact.length >= SUBSTRING_MIN_LENGTH &&
    field.chunks.some((chunk) => chunk.includes(term.compact))
  );
}

export function getProductSearchTier(
  product: ProductSearchFields,
  search: ProductSearchQuery,
): ProductSearchTier | null {
  const index = getProductIndex(product);
  let tier: ProductSearchTier = 1;

  for (const term of search.terms) {
    if (matchesWordStart(term, index.name)) continue;
    if (matchesWordStart(term, index.all)) {
      tier = Math.max(tier, 2) as ProductSearchTier;
      continue;
    }
    if (matchesFragment(term, index.all)) {
      tier = 3;
      continue;
    }
    return null;
  }

  return tier === 1 && index.compactName === search.compact ? 0 : tier;
}

export function matchesProductSearch(
  product: ProductSearchFields,
  search: ProductSearchQuery | string,
): boolean {
  const parsed =
    typeof search === 'string' ? parseProductSearch(search) : search;
  if (!parsed) return true;
  return getProductSearchTier(product, parsed) !== null;
}

/**
 * Group the ids of matching products by relevance tier (index = tier).
 * Always returns PRODUCT_SEARCH_TIER_COUNT arrays, as the GROQ expects.
 */
export function rankProductSearch(
  products: ProductSearchFields[],
  search: ProductSearchQuery,
): string[][] {
  const tiers: string[][] = Array.from(
    { length: PRODUCT_SEARCH_TIER_COUNT },
    () => [],
  );

  for (const product of products) {
    if (!product._id) continue;
    const tier = getProductSearchTier(product, search);
    if (tier !== null) tiers[tier]!.push(product._id);
  }

  return tiers;
}
