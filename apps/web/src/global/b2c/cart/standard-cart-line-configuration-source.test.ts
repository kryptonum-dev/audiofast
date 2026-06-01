import { describe, expect, it } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import { createStandardCartLineConfigurationSource } from './standard-cart-line-configuration-source';
import { createStandardCartLine } from './standard-cart-line';

const pricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: 'Default',
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
              id: 'matte',
              group_id: 'finish',
              name: 'Matte',
              price_delta_cents: 0,
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

describe('createStandardCartLineConfigurationSource', () => {
  it('returns a missing-selection status for legacy cart lines', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(createStandardCartLineConfigurationSource(line, pricingData)).toEqual({
      status: 'missing_selection',
    });
  });

  it('returns a variant-unavailable status when the stored variant no longer exists', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-2',
        selectedOptions: {},
      },
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(createStandardCartLineConfigurationSource(line, pricingData)).toEqual({
      status: 'variant_unavailable',
    });
  });

  it('builds a ready minimal initial selection for cart editing', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'matte',
          staleGroup: 'ignore-me',
        },
      },
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(createStandardCartLineConfigurationSource(line, pricingData)).toEqual({
      status: 'ready',
      initialSelection: {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'matte',
        },
      },
    });
  });

  it('builds default initial selections when a saved line has no options but the product now requires them', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {},
      },
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    expect(createStandardCartLineConfigurationSource(line, pricingData)).toEqual({
      status: 'ready',
      initialSelection: {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'matte',
        },
      },
    });
  });
});
