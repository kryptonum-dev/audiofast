import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCartLinePricing } from '@/src/app/actions/cart-pricing';
import { fetchProductPricing } from '@/src/global/supabase/queries';

vi.mock('@/src/global/supabase/queries', () => ({
  fetchProductPricing: vi.fn(),
}));

describe('fetchCartLinePricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads pricing data for standard cart product keys', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValueOnce({
      variants: [],
      hasMultipleModels: false,
      lowestPrice: 100_00,
    });

    const result = await fetchCartLinePricing('/produkty/test/');

    expect(result).toEqual({
      status: 'found',
      pricingData: {
        variants: [],
        hasMultipleModels: false,
        lowestPrice: 100_00,
      },
    });
    expect(fetchProductPricing).toHaveBeenCalledWith('test');
  });

  it('loads pricing data for real database price_key values', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValueOnce({
      variants: [],
      hasMultipleModels: true,
      lowestPrice: 167_300,
    });

    const result = await fetchCartLinePricing('artesania-audio/prestige');

    expect(result).toEqual({
      status: 'found',
      pricingData: {
        variants: [],
        hasMultipleModels: true,
        lowestPrice: 167_300,
      },
    });
    expect(fetchProductPricing).toHaveBeenCalledWith('prestige');
  });

  it('returns a not-found result when pricing is no longer available', async () => {
    vi.mocked(fetchProductPricing).mockResolvedValueOnce(null);

    const result = await fetchCartLinePricing('/produkty/test');

    expect(result).toEqual({
      status: 'not_found',
      message: 'Ta konfiguracja produktu nie jest już dostępna.',
    });
  });

  it('returns an error result for unsupported product keys', async () => {
    const result = await fetchCartLinePricing('CPO-KEY-1');

    expect(result).toEqual({
      status: 'error',
      message: 'Nie udało się wczytać aktualnej konfiguracji tego produktu.',
    });
    expect(fetchProductPricing).not.toHaveBeenCalled();
  });
});
