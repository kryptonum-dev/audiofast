/**
 * The ONE owner of "does this CMS string say anything" under draft mode.
 *
 * Presentation's stega layer appends invisible marker characters to every
 * string it encodes, so a field stored as `""` or whitespace (Excel imports,
 * the YouTube importer, migrations) still arrives as a non-empty string inside
 * the preview iframe. Every emptiness predicate that trims and tests has to
 * strip the markers first, or it behaves differently in production and in
 * Presentation. Components use `hasText` / `stripStega`; none hand-rolls the
 * character class (the Phase 10 `emptiness-predicates` gate keeps that true).
 *
 * THE CHARACTER CLASS IS MIRRORED FROM `@vercel/stega` (`VERCEL_STEGA_REGEX`,
 * the alphabet `@sanity/client` encodes with): the four zero-width code points
 * the current encoder emits (U+200B, U+200C, U+200D, U+FEFF) plus the legacy
 * encoder's invisible operators and musical symbols (U+2060–U+2063,
 * U+1D173–U+1D17A). The package is a transitive dependency, which is why the
 * class is restated; `stega-text.test.ts` cross-checks it against
 * `next-sanity`'s `stegaClean`.
 *
 * Never use the Unicode TAG block (U+E0000–U+E007F) for this: no encoder
 * version has ever emitted it, and lsse-www's predicates silently did nothing
 * in draft mode for weeks because they stripped it.
 *
 * `stripStega` removes every marker character, not only runs of four or more
 * as the vendor's decoder does: for an emptiness test the aggressive form is
 * correct, and the only other content it touches (a lone ZWJ inside an emoji
 * sequence) is invisible by definition.
 */
const STEGA_CODE_POINTS = [
  // The current encoder's four-symbol alphabet.
  0x200b, 0x200c, 0x200d, 0xfeff,
  // The legacy encoder's hex alphabet.
  0x2062, 0x2063, 0x2060, 0x2061, 0x1d173, 0x1d174, 0x1d175, 0x1d176, 0x1d177,
  0x1d178, 0x1d179, 0x1d17a,
];

// Built rather than written as a literal, the way the vendor builds its own
// regex: a literal class holding a joiner (U+200D) trips ESLint's
// `no-misleading-character-class`.
export const STEGA_CHARS = new RegExp(
  `[${STEGA_CODE_POINTS.map((point) => `\\u{${point.toString(16)}}`).join('')}]`,
  'gu',
);

/** The string without its draft-mode markers. Published strings pass through unchanged. */
export function stripStega(value: string): string {
  return value.replace(STEGA_CHARS, '');
}

/**
 * True when the value is a string that still says something once its markers
 * and surrounding whitespace are gone. The type guard lets a call site use the
 * value as a string on the truthy branch.
 */
export function hasText(value: unknown): value is string {
  return typeof value === 'string' && stripStega(value).trim() !== '';
}

/**
 * The trimmed, marker-free value when it has text, otherwise `undefined`.
 * For `a || b` fallbacks where the winning string is rendered: the marker-free
 * form is what an `||` chain should compare, and the original (encoded) value
 * should still be rendered, so prefer `hasText(a) ? a : b` when the overlay on
 * `a` matters.
 */
export function textOrUndefined(value: unknown): string | undefined {
  return hasText(value) ? value : undefined;
}
