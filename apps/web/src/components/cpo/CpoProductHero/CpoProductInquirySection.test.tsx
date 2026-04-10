import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

import { CartProvider } from '@/src/global/b2c/cart/cart-provider';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import { toast } from 'sonner';

import CpoProductInquirySection from './CpoProductInquirySection';

vi.mock('@/src/components/products/ProductInquiryModal', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

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

describe('CpoProductInquirySection', () => {
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

  it('shows inquiry-only CTA when the CPO item is not buyable', () => {
    renderWithCart(
      <CpoProductInquirySection
        productId="cpo-1"
        productKey="/certyfikowany-sprzet-uzywany/test-cpo/"
        productName="Test CPO"
        priceCents={100_00}
        isBuyable={false}
        isReturnable={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Zapytaj o ten egzemplarz' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dodaj do koszyka' }),
    ).not.toBeInTheDocument();
  });

  it('adds a cpo line into the cart runtime', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <CpoProductInquirySection
        productId="cpo-1"
        productKey="/certyfikowany-sprzet-uzywany/test-cpo/"
        productName="Test CPO"
        brandName="Test brand"
        priceCents={100_00}
        isBuyable
        isReturnable={false}
      />,
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

    expect(cartState.lines[0]?.lineType).toBe('cpo');
    expect(cartState.lines[0]?.productKey).toBe(
      '/certyfikowany-sprzet-uzywany/test-cpo/',
    );
    expect(cartState.lines[0]?.quantity).toBe(1);
    expect(
      screen.getByRole('button', { name: 'Usuń z koszyka' }),
    ).toBeInTheDocument();
  });

  it('removes the cpo line when the toggle is clicked again', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <CpoProductInquirySection
        productId="cpo-1"
        productKey="/certyfikowany-sprzet-uzywany/test-cpo/"
        productName="Test CPO"
        brandName="Test brand"
        priceCents={100_00}
        isBuyable
        isReturnable={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Usuń z koszyka' }));

    expect(screen.getByTestId('line-count')).toHaveTextContent('0');
    expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    expect(toast.info).toHaveBeenCalledWith('Test CPO usunięty z koszyka');
    expect(
      screen.getByRole('button', { name: 'Dodaj do koszyka' }),
    ).toBeInTheDocument();
  });

  it('shows the remove CTA when the specimen is already in cart after hydration', async () => {
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({
        version: 1,
        lines: [
          {
            lineId: 'line-1',
            lineType: 'cpo',
            productId: 'cpo-1',
            productKey: '/certyfikowany-sprzet-uzywany/test-cpo/',
            productName: 'Test CPO',
            brandName: 'Test brand',
            quantity: 1,
            unitPriceCents: 100_00,
            isReturnable: false,
            availabilityStatus: 'available',
            issues: [],
            product: {
              id: 'cpo-1',
              name: 'Test CPO',
              brandName: 'Test brand',
              kind: 'cpo',
              image: { id: 'image-1' },
              basePrice: 100_00,
              configurationOptions: [],
              totalPrice: 100_00,
            },
          },
        ],
        coupon: null,
      }),
    );

    renderWithCart(
      <CpoProductInquirySection
        productId="cpo-1"
        productKey="/certyfikowany-sprzet-uzywany/test-cpo/"
        productName="Test CPO"
        brandName="Test brand"
        priceCents={100_00}
        isBuyable
        isReturnable={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    expect(
      screen.getByRole('button', { name: 'Usuń z koszyka' }),
    ).toBeInTheDocument();
  });

  it('opens the add-to-cart confirmation popup after successful add', async () => {
    const user = userEvent.setup();

    renderWithCart(
      <CpoProductInquirySection
        productId="cpo-1"
        productKey="/certyfikowany-sprzet-uzywany/test-cpo/"
        productName="Test CPO"
        brandName="Test brand"
        priceCents={100_00}
        isBuyable
        isReturnable={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj do koszyka' }));

    expect(screen.getByText('Dodano do koszyka')).toBeInTheDocument();
    expect(screen.getByText('Produkt został dodany')).toBeInTheDocument();
    expect(screen.getByText('Test CPO')).toBeInTheDocument();
  });
});
