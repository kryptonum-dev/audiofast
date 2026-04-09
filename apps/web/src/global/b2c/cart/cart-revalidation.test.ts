import { describe, expect, it } from 'vitest';

import { createEmptyCart } from './cart-domain';
import { applyCartRevalidation } from './cart-revalidation';
import { createCpoCartLine } from './cpo-cart-line';
import { createStandardCartLine } from './standard-cart-line';

describe('cart-revalidation', () => {
  it('marks a standard line as invalid when configuration is no longer valid', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
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

    const state = applyCartRevalidation(
      {
        ...createEmptyCart(),
        lines: [line],
      },
      [
        {
          lineId: 'line-1',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: false,
          unitPriceCents: 100_00,
        },
      ],
    );

    expect(state.lines[0]?.issues).toEqual([
      {
        code: 'configuration_invalid',
        blocking: true,
        message: 'Wybrana konfiguracja nie jest już dostępna.',
      },
    ]);
  });

  it('updates a changed price and keeps it as a non-blocking issue', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
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

    const state = applyCartRevalidation(
      {
        ...createEmptyCart(),
        lines: [line],
      },
      [
        {
          lineId: 'line-1',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: true,
          unitPriceCents: 120_00,
        },
      ],
    );

    expect(state.lines[0]?.unitPriceCents).toBe(120_00);
    expect(state.lines[0]?.issues).toEqual([
      {
        code: 'price_changed',
        blocking: false,
        message: 'Cena produktu została zaktualizowana.',
      },
    ]);
  });

  it('marks a cpo line as unavailable when the specimen is no longer available', () => {
    const line = createCpoCartLine({
      lineId: 'line-1',
      productId: 'cpo-1',
      productKey: 'CPO-KEY-1',
      productName: 'Test CPO',
      brandName: 'Test brand',
      unitPriceCents: 200_00,
      isReturnable: false,
      availabilityStatus: 'available',
      product: {
        id: 'cpo-1',
        name: 'Test CPO',
        brandName: 'Test brand',
        kind: 'cpo',
        image: { id: 'image-1' },
        basePrice: 200_00,
        configurationOptions: [],
        totalPrice: 200_00,
      },
    });

    const state = applyCartRevalidation(
      {
        ...createEmptyCart(),
        lines: [line],
      },
      [
        {
          lineId: 'line-1',
          lineType: 'cpo',
          isBuyable: false,
          availabilityStatus: 'sold_out',
          unitPriceCents: 200_00,
        },
      ],
    );

    expect(
      state.lines[0]?.lineType === 'cpo' ? state.lines[0].availabilityStatus : null,
    ).toBe('sold_out');
    expect(state.lines[0]?.issues).toEqual([
      {
        code: 'cpo_unavailable',
        blocking: true,
        message: 'Ten egzemplarz CPO nie jest już dostępny.',
      },
    ]);
  });
});
