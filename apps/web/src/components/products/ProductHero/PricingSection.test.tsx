import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CompletePricingData } from '@/src/global/supabase/types';

import PricingSection from './PricingSection';

vi.mock('../ProductInquiryModal', () => ({
  default: () => null,
}));

vi.mock('./PricingConfigurator', () => ({
  default: () => <div data-testid="pricing-configurator" />,
}));

const pricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: null,
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

const product = {
  id: 'product-1',
  name: 'Test product',
  brandName: 'Test brand',
  image: { id: 'image-1' },
};

describe('PricingSection', () => {
  it('shows inquiry-only CTA when the product is not buyable', () => {
    render(
      <PricingSection
        pricingData={pricingData}
        isBuyable={false}
        product={product as never}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o produkt' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dodaj do koszyka' }),
    ).not.toBeInTheDocument();
  });

  it('shows and triggers the add-to-cart CTA when the product is buyable', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();

    render(
      <PricingSection
        pricingData={pricingData}
        isBuyable
        product={product as never}
        onAddToCart={onAddToCart}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o produkt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dodaj do koszyka' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(onAddToCart).toHaveBeenCalledTimes(1);
  });
});
