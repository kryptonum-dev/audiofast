import { describe, expect, it } from 'vitest';

import {
  getCpoProductBuyability,
  getStandardProductBuyability,
} from './buyability';

describe('getStandardProductBuyability', () => {
  it('returns not sellable when the runtime flag is false', () => {
    expect(
      getStandardProductBuyability({
        isSellableOnline: false,
        pricingData: {
          lowestPrice: 100_00,
          variants: [{}],
        },
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'not_sellable_online',
    });
  });

  it('returns missing price when pricing data is missing', () => {
    expect(
      getStandardProductBuyability({
        isSellableOnline: true,
        pricingData: null,
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'missing_price',
    });
  });

  it('returns missing price when the lowest price is invalid', () => {
    expect(
      getStandardProductBuyability({
        isSellableOnline: true,
        pricingData: {
          lowestPrice: 0,
          variants: [{}],
        },
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'missing_price',
    });
  });

  it('returns buyable when the runtime flag and pricing are valid', () => {
    expect(
      getStandardProductBuyability({
        isSellableOnline: true,
        pricingData: {
          lowestPrice: 100_00,
          variants: [{}],
        },
      }),
    ).toEqual({
      isBuyable: true,
      reason: null,
    });
  });
});

describe('getCpoProductBuyability', () => {
  it('returns archived when the CPO item is archived', () => {
    expect(
      getCpoProductBuyability({
        isArchived: true,
        isSellableOnline: true,
        priceCents: 100_00,
        availabilityStatus: 'available',
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'archived',
    });
  });

  it('returns not sellable when the runtime flag is false', () => {
    expect(
      getCpoProductBuyability({
        isArchived: false,
        isSellableOnline: false,
        priceCents: 100_00,
        availabilityStatus: 'available',
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'not_sellable_online',
    });
  });

  it('returns missing price when the fixed price is invalid', () => {
    expect(
      getCpoProductBuyability({
        isArchived: false,
        isSellableOnline: true,
        priceCents: 0,
        availabilityStatus: 'available',
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'missing_price',
    });
  });

  it('returns unavailable when the operational status is not available', () => {
    expect(
      getCpoProductBuyability({
        isArchived: false,
        isSellableOnline: true,
        priceCents: 100_00,
        availabilityStatus: 'on_hold',
      }),
    ).toEqual({
      isBuyable: false,
      reason: 'unavailable',
    });
  });

  it('returns buyable when all CPO conditions are met', () => {
    expect(
      getCpoProductBuyability({
        isArchived: false,
        isSellableOnline: true,
        priceCents: 100_00,
        availabilityStatus: 'available',
      }),
    ).toEqual({
      isBuyable: true,
      reason: null,
    });
  });
});
