import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import CartLineConfigurator from './CartLineConfigurator';

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
    {
      id: 'variant-2',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: 'Walnut',
      base_price_cents: 120_00,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      groups: [
        {
          id: 'finish',
          variant_id: 'variant-2',
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
  hasMultipleModels: true,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

describe('CartLineConfigurator', () => {
  it('emits the settled calculated total on first mount callback', async () => {
    const onSelectionChange = vi.fn();

    render(
      <CartLineConfigurator
        pricingData={pricingData}
        initialSelection={{
          variantId: 'variant-2',
          selectedOptions: {
            finish: 'walnut',
          },
        }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled());

    const [selection, configData] = onSelectionChange.mock.calls[0] as [
      { variantId: string; calculatedPrice: number },
      { totalPrice: number },
    ];

    expect(selection.variantId).toBe('variant-2');
    expect(selection.calculatedPrice).toBe(150_00);
    expect(configData.totalPrice).toBe(150_00);
  });
});
