import { describe, expect, it } from 'vitest';

import { deriveCpoFilterMetadata, getGlobalPriceRange } from './filterMetadata';

describe('getGlobalPriceRange', () => {
  it('returns the min and max of the numeric prices', () => {
    expect(
      getGlobalPriceRange([
        { basePriceCents: 500 },
        { basePriceCents: null },
        { basePriceCents: 120 },
        {},
        { basePriceCents: 9_900 },
      ]),
    ).toEqual({ globalMaxPrice: 9_900, globalMinPrice: 120 });
  });

  it('returns null bounds when no row has a price (GROQ math::max of [])', () => {
    expect(getGlobalPriceRange([{ basePriceCents: null }, {}])).toEqual({
      globalMaxPrice: null,
      globalMinPrice: null,
    });
    expect(getGlobalPriceRange([])).toEqual({
      globalMaxPrice: null,
      globalMinPrice: null,
    });
  });
});

describe('deriveCpoFilterMetadata', () => {
  it('derives distinct brands in first-occurrence order and the price bounds', () => {
    const rows = [
      { _id: 'a', brandSlug: 'naim', brandName: 'Naim', basePriceCents: 300 },
      { _id: 'b', brandSlug: 'rega', brandName: 'Rega', basePriceCents: 100 },
      { _id: 'c', brandSlug: 'naim', brandName: 'Naim', basePriceCents: null },
      { _id: 'd', brandSlug: 'naim', brandName: 'NAIM', basePriceCents: 900 },
    ];

    expect(deriveCpoFilterMetadata(rows)).toEqual({
      products: rows,
      brands: [
        { _id: 'naim', name: 'Naim', slug: 'naim' },
        { _id: 'rega', name: 'Rega', slug: 'rega' },
        { _id: 'naim', name: 'NAIM', slug: 'naim' },
      ],
      globalMaxPrice: 900,
      globalMinPrice: 100,
    });
  });

  it('handles a missing result', () => {
    expect(deriveCpoFilterMetadata(null)).toEqual({
      products: [],
      brands: [],
      globalMaxPrice: null,
      globalMinPrice: null,
    });
  });
});
