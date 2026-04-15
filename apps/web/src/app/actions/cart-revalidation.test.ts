import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadCartPageRuntime,
  revalidateCartLines,
  revalidateCpoCartLines,
  revalidateStandardCartLines,
} from '@/src/app/actions/cart-revalidation';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { CompletePricingData } from '@/src/global/supabase/types';

vi.mock('@/src/global/supabase/queries', () => ({
  fetchProductPricing: vi.fn(),
}));

vi.mock('@/src/global/sanity/fetch', () => ({
  sanityFetch: vi.fn(),
}));

const pricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: 'artesania-audio/test',
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
      ],
    },
  ],
  hasMultipleModels: false,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

const pricingDataWithOptionalGroup = {
  ...pricingData,
  variants: pricingData.variants.map((variant) => ({
    ...variant,
    groups: variant.groups.map((group) => ({
      ...group,
      required: false,
    })),
  })),
} satisfies CompletePricingData;

function createConfiguredLine(overrides?: {
  lineId?: string;
  productKey?: string;
  configurationSelection?: {
    variantId: string;
    selectedOptions: Record<string, string>;
  };
}) {
  return createStandardCartLine({
    lineId: overrides?.lineId ?? 'line-1',
    productId: 'product-1',
    productKey: overrides?.productKey ?? 'artesania-audio/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 1,
    unitPriceCents: 100_00,
    isReturnable: true,
    configurationSelection: overrides?.configurationSelection ?? {
      variantId: 'variant-1',
      selectedOptions: {
        finish: 'walnut',
      },
    },
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
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

function createCpoLine(overrides?: { lineId?: string; productKey?: string }) {
  return createCpoCartLine({
    lineId: overrides?.lineId ?? 'cpo-line-1',
    productId: 'cpo-1',
    productKey:
      overrides?.productKey ?? '/certyfikowany-sprzet-uzywany/test-cpo/',
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
}

describe('revalidateStandardCartLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates standard lines against shared pricing truth and fetches each product once', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockResolvedValue({
      isSellableOnline: true,
    });

    const result = await revalidateStandardCartLines([
      createConfiguredLine({ lineId: 'line-1' }),
      createConfiguredLine({ lineId: 'line-2' }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 130_00,
      },
      {
        lineId: 'line-2',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 130_00,
      },
    ]);
    expect(fetchProductPricing).toHaveBeenCalledTimes(1);
    expect(fetchProductPricing).toHaveBeenCalledWith('test');
    expect(sanityFetch).toHaveBeenCalledTimes(1);
    expect(sanityFetch).toHaveBeenCalledWith({
      query: expect.stringContaining('*[_type == "product"'),
      params: { slug: '/produkty/test/' },
      tags: ['product', 'product:test'],
    });
  });

  it('marks a saved configuration as invalid when current product options no longer support it', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockResolvedValue({
      isSellableOnline: true,
    });

    const result = await revalidateStandardCartLines([
      createConfiguredLine({
        configurationSelection: {
          variantId: 'variant-1',
          selectedOptions: {
            finish: 'unknown',
          },
        },
      }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: false,
        unitPriceCents: null,
      },
    ]);
  });

  it('marks an old optionless line as invalid when the product gained options later, even if those options are not required', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(
      pricingDataWithOptionalGroup,
    );
    vi.mocked(sanityFetch).mockResolvedValue({
      isSellableOnline: true,
    });

    const legacyOptionlessLine = createStandardCartLine({
      lineId: 'line-optionless',
      productId: 'product-1',
      productKey: 'artesania-audio/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {},
      },
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

    const result = await revalidateStandardCartLines([legacyOptionlessLine]);

    expect(result).toEqual([
      {
        lineId: 'line-optionless',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: false,
        unitPriceCents: null,
      },
    ]);
  });

  it('marks malformed or unsupported product keys as unavailable without crashing the action', async () => {
    const result = await revalidateStandardCartLines([
      createConfiguredLine({
        productKey: 'BROKEN-KEY',
      }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: false,
        isConfigurationValid: false,
        unitPriceCents: null,
      },
    ]);
    expect(fetchProductPricing).not.toHaveBeenCalled();
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('normalizes mixed-case pricing keys before querying Supabase and Sanity', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockImplementation(async ({ params }) => {
      if (params?.slug === '/produkty/absolute-rack/') {
        return {
          isSellableOnline: true,
        };
      }

      return null;
    });

    const result = await revalidateStandardCartLines([
      createConfiguredLine({
        productKey: 'artesania-audio/Absolute-Rack',
      }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 130_00,
      },
    ]);
    expect(fetchProductPricing).toHaveBeenCalledWith('absolute-rack');
    expect(sanityFetch).toHaveBeenCalledWith({
      query: expect.stringContaining('*[_type == "product"'),
      params: { slug: '/produkty/absolute-rack/' },
      tags: ['product', 'product:absolute-rack'],
    });
  });

  it('keeps buyability and configuration validity separate for legacy lines without saved selection', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockResolvedValue({
      isSellableOnline: true,
    });

    const legacyLine = createStandardCartLine({
      lineId: 'line-legacy',
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

    const result = await revalidateStandardCartLines([legacyLine]);

    expect(result).toEqual([
      {
        lineId: 'line-legacy',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: false,
        unitPriceCents: null,
      },
    ]);
  });
});

describe('revalidateCpoCartLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates cpo lines against current availability and price truth', async () => {
    vi.mocked(sanityFetch).mockImplementation(async ({ params }) => {
      if (params?.slug === '/certyfikowany-sprzet-uzywany/test-cpo/') {
        return {
          isArchived: false,
          isSellableOnline: true,
          priceCents: 250_00,
          availabilityStatus: 'available',
        };
      }

      return null;
    });

    const result = await revalidateCpoCartLines([createCpoLine()]);

    expect(result).toEqual([
      {
        lineId: 'cpo-line-1',
        lineType: 'cpo',
        isBuyable: true,
        availabilityStatus: 'available',
        unitPriceCents: 250_00,
      },
    ]);
    expect(fetchProductPricing).not.toHaveBeenCalled();
    expect(sanityFetch).toHaveBeenCalledWith({
      query: expect.stringContaining('*[_type == "cpoProduct"'),
      params: { slug: '/certyfikowany-sprzet-uzywany/test-cpo/' },
      tags: ['cpoProduct', 'cpoProduct:test-cpo'],
    });
  });

  it('marks unavailable or malformed cpo lines as unavailable', async () => {
    const result = await revalidateCpoCartLines([
      createCpoLine({
        lineId: 'cpo-line-1',
        productKey: 'BROKEN-CPO-KEY',
      }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'cpo-line-1',
        lineType: 'cpo',
        isBuyable: false,
        availabilityStatus: null,
        unitPriceCents: null,
      },
    ]);
  });
});

describe('revalidateCartLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates mixed cart lines to the correct standard and cpo revalidators', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockImplementation(async ({ query, params }) => {
      if (
        query.includes('*[_type == "product"') &&
        params?.slug === '/produkty/test/'
      ) {
        return {
          isSellableOnline: true,
        };
      }

      if (
        query.includes('*[_type == "cpoProduct"') &&
        params?.slug === '/certyfikowany-sprzet-uzywany/test-cpo/'
      ) {
        return {
          isArchived: false,
          isSellableOnline: true,
          priceCents: 250_00,
          availabilityStatus: 'available',
        };
      }

      return null;
    });

    const result = await revalidateCartLines([
      createConfiguredLine({ lineId: 'line-1' }),
      createCpoLine({ lineId: 'cpo-line-1' }),
    ]);

    expect(result).toEqual([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 130_00,
      },
      {
        lineId: 'cpo-line-1',
        lineType: 'cpo',
        isBuyable: true,
        availabilityStatus: 'available',
        unitPriceCents: 250_00,
      },
    ]);
  });
});

describe('loadCartPageRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns revalidation results together with standard pricing cache entries for the cart page', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(pricingData);
    vi.mocked(sanityFetch).mockImplementation(async ({ query, params }) => {
      if (
        query.includes('*[_type == "product"') &&
        params?.slug === '/produkty/test/'
      ) {
        return {
          isSellableOnline: true,
        };
      }

      if (
        query.includes('*[_type == "cpoProduct"') &&
        params?.slug === '/certyfikowany-sprzet-uzywany/test-cpo/'
      ) {
        return {
          isArchived: false,
          isSellableOnline: true,
          priceCents: 250_00,
          availabilityStatus: 'available',
        };
      }

      return null;
    });

    const standardLine = createConfiguredLine({ lineId: 'line-1' });
    const cpoLine = createCpoLine({ lineId: 'cpo-line-1' });

    const result = await loadCartPageRuntime([standardLine, cpoLine]);

    expect(result).toEqual({
      revalidationResults: [
        {
          lineId: 'line-1',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: true,
          unitPriceCents: 130_00,
        },
        {
          lineId: 'cpo-line-1',
          lineType: 'cpo',
          isBuyable: true,
          availabilityStatus: 'available',
          unitPriceCents: 250_00,
        },
      ],
      standardPricingByProductKey: {
        'artesania-audio/test': {
          status: 'found',
          pricingData,
        },
      },
    });
  });

  it('includes pricing cache entries for optionless standard lines so added-options recovery can render', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValue(
      pricingDataWithOptionalGroup,
    );
    vi.mocked(sanityFetch).mockResolvedValue({
      isSellableOnline: true,
    });

    const optionlessLine = createStandardCartLine({
      lineId: 'line-optionless',
      productId: 'product-1',
      productKey: 'artesania-audio/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {},
      },
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

    const result = await loadCartPageRuntime([optionlessLine]);

    expect(result).toEqual({
      revalidationResults: [
        {
          lineId: 'line-optionless',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: false,
          unitPriceCents: null,
        },
      ],
      standardPricingByProductKey: {
        'artesania-audio/test': {
          status: 'found',
          pricingData: pricingDataWithOptionalGroup,
        },
      },
    });
  });
});
