import { stegaClean } from 'next-sanity';
import { describe, expect, test } from 'vitest';

import {
  hasText,
  STEGA_CHARS,
  stripStega,
  textOrUndefined,
} from './stega-text';

/**
 * The encoder's own alphabet, spelled the way `vercelStegaEncode` emits it: a
 * four-character U+200B prefix, then two-bit groups drawn from U+200B, U+200C,
 * U+200D and U+FEFF. The payload is arbitrary; the test is about the class.
 */
const ENCODED_MARKERS =
  '\u{200B}\u{200B}\u{200B}\u{200B}' +
  '\u{200C}\u{200D}\u{FEFF}\u{200B}\u{200D}\u{200C}\u{200B}\u{FEFF}\u{200C}\u{200C}\u{200D}\u{200D}';

/** The legacy encoder's alphabet (`legacyStegaEncode`), still in the vendor regex. */
const LEGACY_MARKERS =
  '\u{2060}\u{2061}\u{2062}\u{2063}\u{1D173}\u{1D174}\u{1D179}\u{1D17A}';

describe('STEGA_CHARS mirrors the vendor alphabet', () => {
  test('an encoded string cleans to what next-sanity cleans it to', () => {
    const encoded = `Tekst${ENCODED_MARKERS}`;
    expect(stripStega(encoded)).toBe('Tekst');
    expect(stripStega(encoded)).toBe(stegaClean(encoded));
  });

  test('the legacy alphabet is covered too', () => {
    expect(stripStega(`Tekst${LEGACY_MARKERS}`)).toBe('Tekst');
  });

  test('the TAG block is not part of the class', () => {
    const tagged = 'Tekst\u{E0001}\u{E0020}\u{E007F}';
    expect(stegaClean(tagged)).toBe(tagged);
    expect(new RegExp(STEGA_CHARS.source, 'u').test('\u{E0001}')).toBe(false);
  });

  test('published strings pass through untouched', () => {
    expect(stripStega('Zwykły tekst — ze znakami: „ł” i „ż”.')).toBe(
      'Zwykły tekst — ze znakami: „ł” i „ż”.',
    );
  });
});

describe('hasText', () => {
  test('a cleared field still carrying markers is empty', () => {
    expect(hasText(ENCODED_MARKERS)).toBe(false);
    expect(hasText(`   ${ENCODED_MARKERS}  `)).toBe(false);
  });

  test('a string with words is text', () => {
    expect(hasText(`Tekst${ENCODED_MARKERS}`)).toBe(true);
    expect(hasText('  Tekst  ')).toBe(true);
  });

  test('non-strings are never text', () => {
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
    expect(hasText(0)).toBe(false);
    expect(hasText([])).toBe(false);
  });
});

describe('textOrUndefined', () => {
  test('keeps the encoded value when it has text, drops it otherwise', () => {
    const encoded = `Marka${ENCODED_MARKERS}`;
    expect(textOrUndefined(encoded)).toBe(encoded);
    expect(textOrUndefined(` ${ENCODED_MARKERS} `)).toBeUndefined();
    expect(textOrUndefined(undefined)).toBeUndefined();
  });
});
