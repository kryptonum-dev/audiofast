import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

import { CartProvider } from '@/src/global/b2c/cart/cart-provider';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type { CompletePricingData } from '@/src/global/supabase/types';

import PricingSection from './PricingSection';

vi.mock('../ProductInquiryModal', () => ({
  default: () => null,
}));

vi.mock('./PricingConfigurator', () => ({
  default: ({
    onSelectionChange,
  }: {
    onSelectionChange?: (...args: unknown[]) => void;
  }) => (
    <div>
      <div data-testid="pricing-configurator" />
      <button
        type="button"
        onClick={() =>
          onSelectionChange?.(
            {
              variantId: 'variant-1',
              selectedOptions: {
                model: 'default',
              },
              calculatedPrice: 100_00,
            },
            {
              basePrice: 100_00,
              options: [
                {
                  label: 'Model',
                  value: 'Default',
                  priceDelta: 0,
                },
              ],
              totalPrice: 100_00,
            },
          )
        }
      >
        wybierz konfigurację domyślną
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange?.(
            {
              variantId: 'variant-2',
              selectedOptions: {
                model: 'alt',
              },
              calculatedPrice: 150_00,
            },
            {
              basePrice: 100_00,
              options: [
                {
                  label: 'Model',
                  value: 'Alt',
                  priceDelta: 50_00,
                },
              ],
              totalPrice: 150_00,
            },
          )
        }
      >
        wybierz konfigurację alternatywną
      </button>
    </div>
  ),
}));

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
      groups: [],
    },
  ],
  hasMultipleModels: true,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

const product = {
  id: 'product-1',
  name: 'Test product',
  brandName: 'Test brand',
  isReturnable: true,
  image: { id: 'image-1' },
};

function CartStateProbe() {
  const { cart, totals, isHydrated } = useCart();

  return (
    <>
      <div data-testid="hydrated">{isHydrated ? 'yes' : 'no'}</div>
      <div data-testid="line-count">{cart.lines.length}</div>
      <div data-testid="item-count">{totals.itemCount}</div>
      <pre data-testid="cart-state">{JSON.stringify(cart)}</pre>
    </>
  );
}

function renderWithCart(ui: React.ReactNode) {
  return render(
    <CartProvider>
      {ui}
      <CartStateProbe />
    </CartProvider>,
  );
}

describe('PricingSection', () => {
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

  it('shows inquiry-only CTA when the product is not buyable', () => {
    renderWithCart(
      <PricingSection
        pricingData={pricingData}
        isBuyable={false}
        product={product}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o produkt' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dodaj do koszyka' }),
    ).not.toBeInTheDocument();
  });

  it('adds a standard line into the cart runtime', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <PricingSection pricingData={pricingData} isBuyable product={product} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');

    const cartState = JSON.parse(
      screen.getByTestId('cart-state').textContent ?? '{}',
    );

    expect(cartState.lines[0]?.lineType).toBe('standard');
    expect(cartState.lines[0]?.productKey).toBe('/produkty/test');
  });

  it('merges the same standard configuration into one cart line', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <PricingSection pricingData={pricingData} isBuyable product={product} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(
      screen.getByRole('button', { name: 'wybierz konfigurację domyślną' }),
    );
    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('2');
  });

  it('creates a separate line when the standard configuration changes', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <PricingSection pricingData={pricingData} isBuyable product={product} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(
      screen.getByRole('button', { name: 'wybierz konfigurację domyślną' }),
    );
    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));
    await user.click(
      screen.getByRole('button', { name: 'wybierz konfigurację alternatywną' }),
    );
    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('2');
  });

  it('opens the add-to-cart confirmation popup and closes it on continue', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <PricingSection pricingData={pricingData} isBuyable product={product} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByText('Dodano do koszyka')).toBeInTheDocument();
    expect(screen.getByText('Produkt został dodany')).toBeInTheDocument();
    expect(screen.getByText('Test product')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kontynuuj zakupy' }));

    expect(screen.queryByText('Dodano do koszyka')).not.toBeInTheDocument();
  });

  it('renders a cart link inside the add-to-cart confirmation popup', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <PricingSection pricingData={pricingData} isBuyable product={product} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(
      screen.getByRole('link', { name: 'Przejdź do koszyka' }),
    ).toHaveAttribute('href', '/koszyk');
  });
});
