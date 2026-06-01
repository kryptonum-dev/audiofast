import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import AddToCartConfirmationModal from './index';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

describe('AddToCartConfirmationModal', () => {
  it('renders product details and closes on continue', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AddToCartConfirmationModal
        isOpen
        product={{
          name: 'Alexx',
          brandName: 'Wilson Audio',
          image: { id: 'image-1' },
          totalPrice: 100_00,
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Dodano do koszyka')).toBeInTheDocument();
    expect(screen.getByText('Alexx')).toBeInTheDocument();
    expect(screen.getByText('Wilson Audio')).toBeInTheDocument();
    expect(screen.getByText(/zł/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kontynuuj zakupy' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the go-to-cart CTA as a cart link', () => {
    render(
      <AddToCartConfirmationModal
        isOpen
        product={{
          name: 'Alexx',
          brandName: 'Wilson Audio',
          image: { id: 'image-1' },
          totalPrice: 100_00,
        }}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Przejdź do koszyka' }),
    ).toHaveAttribute('href', '/koszyk');
  });

  it('hides the price row when price is missing', () => {
    render(
      <AddToCartConfirmationModal
        isOpen
        product={{
          name: 'Alexx',
          brandName: 'Wilson Audio',
          image: { id: 'image-1' },
          totalPrice: null,
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText(/zł/)).not.toBeInTheDocument();
  });
});
