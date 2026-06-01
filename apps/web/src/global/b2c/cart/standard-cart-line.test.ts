import { describe, expect, it } from 'vitest';

import {
  buildStandardConfigurationSignature,
  createStandardCartLine,
} from './standard-cart-line';

describe('createStandardCartLine', () => {
  it('creates a normalized standard cart line', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [
        {
          label: 'Model',
          value: 'Default',
        },
      ],
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

    expect(line.lineType).toBe('standard');
    expect(line.quantity).toBe(1);
    expect(line.productKey).toBe('/produkty/test');
    expect(line.issues).toEqual([]);
    expect(line.configurationSignature).toBe(
      buildStandardConfigurationSignature(line.configurationSummary),
    );
  });

  it('normalizes quantity to at least one', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 0,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
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

    expect(line.quantity).toBe(1);
  });

  it('stores a minimal canonical configuration selection when provided', () => {
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
          groupA: 'value-1',
          groupB: '2.5',
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

    expect(line.configurationSelection).toEqual({
      variantId: 'variant-1',
      selectedOptions: {
        groupA: 'value-1',
        groupB: '2.5',
      },
    });
  });
});
