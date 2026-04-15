import { describe, expect, it } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import {
  buildStandardConfigurationData,
  createStandardConfigurationSelectionState,
  settleStandardConfigurationSelection,
  validateStandardConfigurationSelection,
} from './standard-configuration';

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
            {
              id: 'walnut',
              group_id: 'finish',
              name: 'Walnut',
              price_delta_cents: 30_00,
              position: 1,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          numeric_rule: null,
        },
        {
          id: 'cable',
          variant_id: 'variant-1',
          name: 'Cable length',
          input_type: 'numeric_step',
          unit: 'm',
          required: true,
          position: 1,
          parent_value_id: 'walnut',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          values: [],
          numeric_rule: {
            id: 'rule-1',
            group_id: 'cable',
            value_id: null,
            min_value: 1,
            max_value: 3,
            step_value: 0.5,
            price_per_step_cents: 10_00,
            base_included_value: 1,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
    },
  ],
  hasMultipleModels: false,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

describe('standard configuration helpers', () => {
  it('creates a settled initial selection with defaults for visible groups', () => {
    expect(
      createStandardConfigurationSelectionState(pricingData, {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'walnut',
        },
      }),
    ).toEqual({
      variantId: 'variant-1',
      selectedOptions: {
        finish: 'walnut',
        cable: '1',
      },
      calculatedPrice: 130_00,
    });
  });

  it('removes orphaned child selections when the parent choice changes', () => {
    expect(
      settleStandardConfigurationSelection(pricingData, {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'matte',
          cable: '2',
        },
      }),
    ).toEqual({
      variantId: 'variant-1',
      selectedOptions: {
        finish: 'matte',
      },
      calculatedPrice: 100_00,
    });
  });

  it('builds configuration data from the shared selection truth', () => {
    expect(
      buildStandardConfigurationData(pricingData, {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'walnut',
          cable: '2',
        },
      }),
    ).toEqual({
      basePrice: 100_00,
      options: [
        {
          label: 'Finish',
          value: 'Walnut',
          priceDelta: 30_00,
        },
        {
          label: 'Cable length',
          value: '2 m',
          priceDelta: 20_00,
        },
      ],
      totalPrice: 150_00,
    });
  });

  it('validates stale and impossible selections without silently fixing them', () => {
    expect(
      validateStandardConfigurationSelection(pricingData, {
        variantId: 'variant-1',
        selectedOptions: {
          finish: 'walnut',
          cable: '7',
          staleGroup: 'ignore-me',
        },
      }),
    ).toEqual({
      isValid: false,
      issues: [
        {
          code: 'stale_group_selection',
          groupId: 'staleGroup',
        },
        {
          code: 'invalid_numeric_value',
          groupId: 'cable',
        },
      ],
      unitPriceCents: null,
      variant: pricingData.variants[0],
    });
  });
});
