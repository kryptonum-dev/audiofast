import { describe, expect, it } from 'vitest';

import { createCpoCartLine } from './cpo-cart-line';

describe('createCpoCartLine', () => {
  it('creates a normalized cpo cart line with fixed quantity', () => {
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

    expect(line.lineType).toBe('cpo');
    expect(line.quantity).toBe(1);
    expect(line.productKey).toBe('CPO-KEY-1');
    expect(line.issues).toEqual([]);
  });
});
