import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CpoProductInquirySection from './CpoProductInquirySection';

vi.mock('@/src/components/products/ProductInquiryModal', () => ({
  default: () => null,
}));

describe('CpoProductInquirySection', () => {
  it('shows inquiry-only CTA when the CPO item is not buyable', () => {
    render(
      <CpoProductInquirySection
        productId="cpo-1"
        productName="Test CPO"
        priceCents={100_00}
        isBuyable={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o ten egzemplarz' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dodaj do koszyka' }),
    ).not.toBeInTheDocument();
  });

  it('shows and triggers the add-to-cart CTA when the CPO item is buyable', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();

    render(
      <CpoProductInquirySection
        productId="cpo-1"
        productName="Test CPO"
        priceCents={100_00}
        isBuyable
        onAddToCart={onAddToCart}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o ten egzemplarz' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dodaj do koszyka' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(onAddToCart).toHaveBeenCalledTimes(1);
  });
});
