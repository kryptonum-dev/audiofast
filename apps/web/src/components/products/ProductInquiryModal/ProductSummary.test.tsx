import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ProductSummary from './ProductSummary';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

describe('ProductSummary', () => {
  it('hides standard price output when the product has no price', () => {
    render(
      <ProductSummary
        product={{
          id: 'product-1',
          name: 'Alexx',
          brandName: 'Wilson Audio',
          kind: 'standard',
          image: { id: 'image-1' },
          basePrice: null,
          configurationOptions: [],
          totalPrice: null,
        }}
      />,
    );

    expect(screen.queryByText('Razem')).not.toBeInTheDocument();
    expect(screen.queryByText(/zł/)).not.toBeInTheDocument();
  });

  it('hides cpo price output when the cpo product has no price', () => {
    render(
      <ProductSummary
        layout="cpo"
        product={{
          id: 'cpo-1',
          name: 'Alexx CPO',
          brandName: 'Wilson Audio',
          kind: 'cpo',
          image: { id: 'image-1' },
          basePrice: null,
          configurationOptions: [],
          totalPrice: null,
        }}
      />,
    );

    expect(screen.queryByText('Cena CPO')).not.toBeInTheDocument();
    expect(screen.queryByText(/zł/)).not.toBeInTheDocument();
  });
});
