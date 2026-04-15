import { describe, expect, it } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import { createStandardCartLine } from './standard-cart-line';
import {
  canReconfigureStandardLineWithAddedOptions,
  canKeepStandardLineWithoutOptions,
  createStandardCartLineWithoutOptions,
} from './standard-cart-line-option-recovery';

const optionlessPricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: 'artesania-audio/prestige',
      brand: 'Artesania Audio',
      product: 'Prestige',
      model: 'Prestige',
      base_price_cents: 100_00,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      groups: [],
    },
  ],
  hasMultipleModels: false,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

const configurablePricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: 'artesania-audio/prestige',
      brand: 'Artesania Audio',
      product: 'Prestige',
      model: 'Prestige',
      base_price_cents: 100_00,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      groups: [
        {
          id: 'finish',
          variant_id: 'variant-1',
          name: 'Finish',
          input_type: 'select',
          unit: null,
          required: true,
          position: 0,
          parent_value_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          values: [
            {
              id: 'walnut',
              group_id: 'finish',
              name: 'Walnut',
              price_delta_cents: 30_00,
              position: 0,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          numeric_rule: null,
        },
      ],
    },
  ],
  hasMultipleModels: false,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

function createConfiguredLine() {
  return createStandardCartLine({
    lineId: 'line-1',
    productId: 'product-1',
    productKey: 'artesania-audio/prestige',
    productName: 'Prestige',
    brandName: 'Artesania Audio',
    quantity: 1,
    unitPriceCents: 130_00,
    isReturnable: true,
    configurationSelection: {
      variantId: 'variant-1',
      selectedOptions: {
        finish: 'walnut',
      },
    },
    product: {
      id: 'product-1',
      name: 'Prestige',
      brandName: 'Artesania Audio',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 100_00,
      configurationOptions: [
        {
          label: 'Finish',
          value: 'Walnut',
          priceDelta: 30_00,
        },
      ],
      totalPrice: 130_00,
    },
  });
}

describe('standard cart line option recovery', () => {
  it('detects when a saved configured line can be kept without options', () => {
    expect(
      canKeepStandardLineWithoutOptions(
        createConfiguredLine(),
        optionlessPricingData,
      ),
    ).toBe(true);
  });

  it('creates a normalized optionless line with the updated price and no blocking state', () => {
    const recoveredLine = createStandardCartLineWithoutOptions(
      createConfiguredLine(),
      optionlessPricingData,
    );

    expect(recoveredLine).toEqual(
      expect.objectContaining({
        lineId: 'line-1',
        productKey: 'artesania-audio/prestige',
        unitPriceCents: 100_00,
        configurationSelection: {
          variantId: 'variant-1',
          selectedOptions: {},
        },
        configurationSummary: [],
        issues: [],
        product: expect.objectContaining({
          basePrice: 100_00,
          totalPrice: 100_00,
          configurationOptions: [],
        }),
      }),
    );
  });

  it('does not offer optionless recovery when the product still has active groups', () => {
    expect(
      canKeepStandardLineWithoutOptions(
        createConfiguredLine(),
        configurablePricingData,
      ),
    ).toBe(false);
    expect(
      createStandardCartLineWithoutOptions(
        createConfiguredLine(),
        configurablePricingData,
      ),
    ).toBeNull();
  });

  it('detects when an old optionless cart line now needs newly added options', () => {
    const optionlessSavedLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-1',
      productKey: 'artesania-audio/prestige',
      productName: 'Prestige',
      brandName: 'Artesania Audio',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {},
      },
      product: {
        id: 'product-1',
        name: 'Prestige',
        brandName: 'Artesania Audio',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(
      canReconfigureStandardLineWithAddedOptions(
        optionlessSavedLine,
        configurablePricingData,
      ),
    ).toBe(true);
    expect(
      canReconfigureStandardLineWithAddedOptions(
        optionlessSavedLine,
        optionlessPricingData,
      ),
    ).toBe(false);
  });

  it('also detects newly added options for legacy lines without a saved selection payload', () => {
    const legacyLineWithoutSelection = createStandardCartLine({
      lineId: 'line-3',
      productId: 'product-1',
      productKey: 'artesania-audio/prestige',
      productName: 'Prestige',
      brandName: 'Artesania Audio',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Prestige',
        brandName: 'Artesania Audio',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(
      canReconfigureStandardLineWithAddedOptions(
        legacyLineWithoutSelection,
        configurablePricingData,
      ),
    ).toBe(true);
  });
});
