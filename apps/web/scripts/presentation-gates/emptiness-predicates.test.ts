// @vitest-environment node
/**
 * Gate 0.4: emptiness predicates.
 *
 * Stega appends markers even to `""`, so in draft mode a cleared CMS string
 * is truthy and `x?.trim()` / `x?.trim() || fallback` fire differently in
 * production and in Presentation. `global/utils/stega-text.ts` (`hasText`,
 * `stripStega`) is the one owner of "does this string say anything"; this test
 * keeps it that way. Ported from lsse-www, ALLOW rebuilt for audiofast.
 *
 *   (a) The Unicode TAG block `\u{E0000}-\u{E007F}` (which no stega encoder
 *       ever emitted; lsse stripped it for weeks) appears in no code under
 *       `apps/web/src`.
 *   (b) Nobody hand-rolls the marker alphabet: a zero-width code point escape
 *       appears only in `global/utils/stega-text.ts`.
 *   (c) Every `.trim()` under `apps/web/src/components/**` is part of a
 *       marker-stripping chain (`stripStega(`, `hasText(` or `stegaClean(` on
 *       the same line or the two above it) or listed in `ALLOW` with a
 *       reason. A new occurrence fails until it is reviewed; a stale ALLOW row
 *       fails too.
 *
 * ALLOW `sites` are `<path relative to components/>#<substring of the line>`.
 */
import { describe, expect, test } from 'vitest';

import {
  isTest,
  isTypeScript,
  read,
  relative,
  repoPath,
  stripComments,
  walk,
} from './source';

const SRC = repoPath('apps/web/src/');
const COMPONENTS = repoPath('apps/web/src/components/');
const STEGA_TEXT = 'apps/web/src/global/utils/stega-text.ts';

const RETIRED_CLASS = /\\u\{?E00[0-7][0-9A-F]\}?/i;
const HAND_ROLLED = /\\u(?:\{?200[BCD]\}?|\{?FEFF\}?|\{?206[0-3]\}?)/i;
const CLEAN_CHAIN = /\b(?:stripStega|hasText|stegaClean)\(/;

type AllowGroup = { reason: string; sites: string[] };

const ALLOW: AllowGroup[] = [
  {
    reason:
      'visitor input: a search query, a URL search param or a form value typed in the browser, never a CMS string',
    sites: [
      'ui/Searchbar/index.tsx#if (value.trim())',
      'ui/Searchbar/index.tsx#params.set(name, value.trim())',
      'ui/Searchbar/index.tsx#inputValue.trim()',
      'ui/QuantityStepper/index.tsx#quantityInput.trim()',
      'ui/BlogAside/index.tsx#if (updates.search.trim())',
      "ui/BlogAside/index.tsx#params.set('search', updates.search.trim())",
      "products/ProductsListing/index.tsx#(params.search || '').trim()",
      'products/ProductInquiryModal/ProductInquiryForm.tsx#data.name.trim()',
      'products/ProductsAside/index.tsx#activeFilters.search.trim()',
      'products/ProductsAside/index.tsx#localFilters.search.trim()',
      'b2c/CheckoutPage/helpers.ts#value.trim().length',
      'b2c/CartPage/CartCouponCard.tsx#couponCode.trim()',
      'comparison/ProductSelector/index.tsx#searchQuery.trim()',
      'pageBuilder/ContactForm/ContactForm.tsx#data.name.trim()',
      'pageBuilder/FaqSection/ContactForm.tsx#data.name.trim()',
    ],
  },
  {
    reason:
      'a string built in code: a formatted price, a geocoding query, an excerpt of plain text already derived by the caller',
    sites: [
      'ui/StoreLocations/index.tsx#.trim()',
      "b2c/CheckoutPage/helpers.ts#.replace(/\\s+/g, ' ').trim()",
      "b2c/CheckoutPage/CheckoutSummaryCard.tsx#.replace(/\\s+/g, ' ').trim()",
      "b2c/CartPage/CartSummaryCard.tsx#.replace(/\\s+/g, ' ').trim()",
      "b2c/CartPage/CartEmptyState.tsx#formatPrice(0).replace(/\\s+/g, ' ').trim()",
    ],
  },
  {
    reason: 'order data from Supabase (customer panel), never a CMS string',
    sites: [
      'b2c/CustomerPanel/OrderDetails/OrderCancellationSection/index.tsx#value.trim().length',
      'b2c/CustomerPanel/OrderDetails/OrderRefundSection/index.tsx#value.trim().length',
      'b2c/CustomerPanel/OrderDetails/OrderDetailsHeader/index.tsx#value.trim().length',
      'b2c/CustomerPanel/OrderDetails/OrderDataSection/index.tsx#value.trim().length',
    ],
  },
  {
    reason:
      'B2C route (cart / checkout): always published (P10), never a Presentation target, so its CMS strings are never stega-encoded',
    sites: [
      'b2c/shared/SupportCard.tsx#supportCard?.paragraph?.trim()',
      'b2c/shared/SupportCard.tsx#supportCard?.phoneNumber?.trim()',
      'b2c/CartPage/CartEmptyState.tsx#emptyStateContent?.heading?.trim()',
      'b2c/CartPage/CartEmptyState.tsx#emptyStateContent?.description?.trim()',
      'b2c/CartPage/CartEmptyState.tsx#emptyStateContent?.buttonText?.trim()',
    ],
  },
  {
    reason:
      'JSON-LD: fed from published data only (`sanityFetchPublished`), so the strings it trims are never stega-encoded',
    sites: ['schema/ArticleSchema.tsx#.substring(0, 200).trim()'],
  },
  {
    reason:
      'never encoded: `slug` is a `select()` over `slug.current` / `pdfSlug.current` / `externalUrl` (no Content Source Map through `select()`, and the vendor filter skips `slug.current` and URLs)',
    sites: ['portableText/ReviewEmbed/index.tsx#review.slug?.trim()'],
  },
];

type Site = { file: string; match: string; reason: string };

const allowSites: Site[] = ALLOW.flatMap((group) =>
  group.sites.map((site) => {
    const hash = site.indexOf('#');
    return {
      file: site.slice(0, hash),
      match: site.slice(hash + 1),
      reason: group.reason,
    };
  }),
);

type Occurrence = { file: string; line: number; text: string };

function trimOccurrences(): Occurrence[] {
  const out: Occurrence[] = [];
  for (const path of walk(COMPONENTS, isTypeScript)) {
    if (isTest(path)) continue;
    const lines = stripComments(read(path)).split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('.trim()')) return;
      const window = lines.slice(Math.max(0, index - 2), index + 1).join('\n');
      if (CLEAN_CHAIN.test(window)) return;
      out.push({
        file: relative(path).replace('apps/web/src/components/', ''),
        line: index + 1,
        text: line.trim(),
      });
    });
  }
  return out;
}

const occurrences = trimOccurrences();
const sources = walk(SRC, isTypeScript).filter((path) => !isTest(path));

describe('emptiness predicates', () => {
  test('(a) the TAG-block class is in no code under apps/web/src', () => {
    const hits: string[] = [];
    for (const path of sources) {
      stripComments(read(path))
        .split('\n')
        .forEach((line, index) => {
          if (RETIRED_CLASS.test(line))
            hits.push(`${relative(path)}:${index + 1}`);
        });
    }
    expect(
      hits,
      'the `\\u{E0000}-\\u{E007F}` class strips nothing the encoder emits: use stripStega / hasText from global/utils/stega-text.ts',
    ).toEqual([]);
  });

  test('(b) only stega-text.ts spells the marker alphabet', () => {
    const hits: string[] = [];
    for (const path of sources) {
      if (relative(path) === STEGA_TEXT) continue;
      stripComments(read(path))
        .split('\n')
        .forEach((line, index) => {
          if (HAND_ROLLED.test(line))
            hits.push(`${relative(path)}:${index + 1}`);
        });
    }
    expect(
      hits,
      'a hand-rolled zero-width class: import stripStega / hasText from global/utils/stega-text.ts',
    ).toEqual([]);
  });

  test('(c) every bare .trim() under components/ is reviewed', () => {
    const unreviewed = occurrences.filter(
      (occurrence) =>
        !allowSites.some(
          (site) =>
            site.file === occurrence.file &&
            occurrence.text.includes(site.match),
        ),
    );
    expect(
      unreviewed.map((o) => `${o.file}:${o.line}  ${o.text}`),
      'bare `.trim()` on a value that may carry stega markers: use hasText() / stripStega(), or add an ALLOW row with the reason',
    ).toEqual([]);
  });

  test('(c) no ALLOW row is stale', () => {
    const stale = allowSites.filter(
      (site) =>
        !occurrences.some(
          (occurrence) =>
            occurrence.file === site.file &&
            occurrence.text.includes(site.match),
        ),
    );
    expect(
      stale.map((site) => `${site.file}#${site.match}`),
      'ALLOW rows that match no remaining .trim(): delete them',
    ).toEqual([]);
  });
});
