import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CartProvider } from '@/src/global/b2c/cart/cart-provider';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';

function CartTestConsumer() {
  const { cart, totals, isHydrated, addLine, clearCart } = useCart();

  const line = createStandardCartLine({
    lineId: 'line-1',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 1,
    unitPriceCents: 100_00,
    isReturnable: true,
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

  return (
    <div>
      <div data-testid="hydrated">{isHydrated ? 'yes' : 'no'}</div>
      <div data-testid="line-count">{cart.lines.length}</div>
      <div data-testid="item-count">{totals.itemCount}</div>
      <button type="button" onClick={() => addLine(line)}>
        add
      </button>
      <button type="button" onClick={() => clearCart()}>
        clear
      </button>
    </div>
  );
}

describe('CartProvider', () => {
  const localStorageMock = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  };

  beforeEach(() => {
    let storageValue: string | null = null;

    localStorageMock.getItem.mockImplementation(() => storageValue);
    localStorageMock.setItem.mockImplementation((_, value) => {
      storageValue = value;
    });
    localStorageMock.removeItem.mockImplementation(() => {
      storageValue = null;
    });

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates from storage and exposes hydrated state', async () => {
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({
        version: 1,
        lines: [
          createStandardCartLine({
            lineId: 'line-1',
            productId: 'product-1',
            productKey: '/produkty/test',
            productName: 'Test product',
            brandName: 'Test brand',
            quantity: 2,
            unitPriceCents: 100_00,
            isReturnable: true,
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
          }),
        ],
        coupon: null,
      }),
    );

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    expect(screen.getByTestId('line-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('2');
  });

  it('persists cart changes after runtime actions', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('1');
    expect(localStorageMock.setItem).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('0');
  });
});
