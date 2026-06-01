import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import PricingConfigurator from './PricingConfigurator';

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
      groups: [],
    },
    {
      id: 'variant-2',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: 'Alt',
      base_price_cents: 150_00,
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
  hasMultipleModels: true,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

describe('PricingConfigurator', () => {
  it('boots from a provided initial selection for editing flows', async () => {
    const onSelectionChange = vi.fn();

    render(
      <PricingConfigurator
        pricingData={pricingData}
        initialSelection={{
          variantId: 'variant-2',
          selectedOptions: {
            finish: 'matte',
            staleGroup: 'ignore-me',
          },
        }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled());

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      {
        variantId: 'variant-2',
        selectedOptions: {
          finish: 'matte',
        },
        calculatedPrice: 150_00,
      },
      {
        basePrice: 150_00,
        options: [
          {
            label: 'Model',
            value: 'Alt',
            priceDelta: 0,
          },
          {
            label: 'Finish',
            value: 'Matte',
            priceDelta: 0,
          },
        ],
        totalPrice: 150_00,
      },
    );
  });
});
