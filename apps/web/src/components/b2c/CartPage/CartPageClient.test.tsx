import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CartContextValue } from '@/src/global/b2c/cart/cart-context';
import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';

import CartPageClient from './CartPageClient';

vi.mock('@/src/global/b2c/cart/use-cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('./CartItemCard', () => ({
  default: ({ line }: { line: { lineType: string; productName: string } }) => (
    <div data-testid="cart-item-card">
      {line.lineType}: {line.productName}
    </div>
  ),
}));

function createUseCartValue(
  overrides: Partial<CartContextValue> = {},
): CartContextValue {
  const cart = overrides.cart ?? createEmptyCart();

  return {
    cart,
    totals: overrides.totals ?? getCartTotals(cart),
    isHydrated: overrides.isHydrated ?? true,
    isApplyingCoupon: overrides.isApplyingCoupon ?? false,
    isRevalidatingCoupon: overrides.isRevalidatingCoupon ?? false,
    couponRequestError: overrides.couponRequestError ?? null,
    couponRevalidationNotice: overrides.couponRevalidationNotice ?? null,
    canRetryCouponRevalidation: overrides.canRetryCouponRevalidation ?? false,
    addLine: vi.fn(),
    removeLine: vi.fn(),
    setStandardLineQuantity: vi.fn(),
    incrementStandardLineQuantity: vi.fn(),
    decrementStandardLineQuantity: vi.fn(),
    replaceStandardLine: vi.fn(),
    applyCoupon: vi.fn(),
    clearCouponRequestError: vi.fn(),
    retryCouponRevalidation: vi.fn(),
    clearCoupon: vi.fn(),
    clearCart: vi.fn(),
    ...overrides,
  };
}

function createStandardLine() {
  return createStandardCartLine({
    lineId: 'standard-line-1',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 2,
    unitPriceCents: 120_00,
    isReturnable: true,
    configurationSummary: [
      {
        label: 'Model',
        value: 'Default',
      },
    ],
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 100_00,
      configurationOptions: [],
      totalPrice: 120_00,
    },
  });
}

function createCpoLine() {
  return createCpoCartLine({
    lineId: 'cpo-line-1',
    productId: 'cpo-1',
    productKey: 'CPO-KEY-1',
    productName: 'Test CPO',
    brandName: 'Test brand',
    unitPriceCents: 220_00,
    isReturnable: false,
    availabilityStatus: 'available',
    product: {
      id: 'cpo-1',
      name: 'Test CPO',
      brandName: 'Test brand',
      kind: 'cpo',
      image: { id: 'image-2' },
      basePrice: 220_00,
      configurationOptions: [],
      totalPrice: 220_00,
    },
  });
}

describe('CartPageClient', () => {
  it('renders a loading state before the cart finishes hydration', () => {
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        isHydrated: false,
      }),
    );

    render(<CartPageClient />);

    expect(screen.getByTestId('cart-loading-state')).toBeInTheDocument();
    expect(screen.getByText('Trwa ładowanie koszyka...')).toBeInTheDocument();
    expect(screen.getAllByTestId('cart-loading-item')).toHaveLength(2);
    expect(screen.getByTestId('cart-loading-summary')).toBeInTheDocument();
    expect(screen.getByTestId('cart-loading-coupon')).toBeInTheDocument();
    expect(screen.getByTestId('cart-loading-support')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Koszyk' }),
    ).not.toBeInTheDocument();
  });

  it('renders a loading preview state even after hydration', () => {
    vi.mocked(useCart).mockReturnValue(createUseCartValue());

    render(<CartPageClient previewState="loading" />);

    expect(screen.getByTestId('cart-loading-state')).toBeInTheDocument();
    expect(screen.getByText('Trwa ładowanie koszyka...')).toBeInTheDocument();
    expect(screen.getAllByTestId('cart-loading-item')).toHaveLength(2);
    expect(screen.getByTestId('cart-loading-summary')).toBeInTheDocument();
    expect(screen.getByTestId('cart-loading-coupon')).toBeInTheDocument();
    expect(screen.getByTestId('cart-loading-support')).toBeInTheDocument();
    expect(screen.queryByText('Koszyk jest pusty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-item-card')).not.toBeInTheDocument();
  });

  it('renders an empty cart state after hydration', () => {
    vi.mocked(useCart).mockReturnValue(createUseCartValue());

    render(<CartPageClient />);

    expect(screen.getByText('Koszyk jest pusty')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Kontynuuj zakupy' }),
    ).toHaveAttribute('href', '/produkty');
    expect(
      screen.getByRole('heading', { name: 'Podsumowanie' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kod rabatowy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do kasy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Kod rabatowy' }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText('Podsumowanie pustego koszyka'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cart-item-card')).not.toBeInTheDocument();
  });

  it('renders Sanity-provided empty state content when available', () => {
    vi.mocked(useCart).mockReturnValue(createUseCartValue());

    render(
      <CartPageClient
        emptyStateContent={{
          heading: 'Twój koszyk czeka',
          description:
            'Dodaj pierwszy produkt, aby rozpocząć kompletowanie zamówienia.',
          buttonText: 'Przeglądaj ofertę',
        }}
      />,
    );

    expect(screen.getByText('Twój koszyk czeka')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dodaj pierwszy produkt, aby rozpocząć kompletowanie zamówienia.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Przeglądaj ofertę' }),
    ).toHaveAttribute('href', '/produkty');
  });

  it('renders one cart item card per cart line when the cart has mixed products', () => {
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine(), createCpoLine()],
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
      }),
    );

    render(<CartPageClient />);

    expect(screen.getAllByTestId('cart-item-card')).toHaveLength(2);
    expect(screen.getByText('standard: Test product')).toBeInTheDocument();
    expect(screen.getByText('cpo: Test CPO')).toBeInTheDocument();
  });

  it('wires coupon submit and clear actions through the cart runtime', async () => {
    const user = userEvent.setup();
    const applyCoupon = vi.fn(async () => {});
    const clearCouponRequestError = vi.fn();
    const clearCoupon = vi.fn();
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
      coupon: {
        code: 'SAVE20',
        couponId: 'coupon-1',
        discountType: 'fixed_order' as const,
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        matchedProductKeys: ['/produkty/test'],
        isValid: true,
        message: null,
        totalDiscountCents: 20_00,
        lineDiscounts: {
          'standard-line-1': 20_00,
        },
      },
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        applyCoupon,
        clearCouponRequestError,
        clearCoupon,
      }),
    );

    render(<CartPageClient />);

    await user.clear(screen.getByPlaceholderText('Wpisz kod'));
    await user.type(screen.getByPlaceholderText('Wpisz kod'), ' save20 ');
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));
    await user.click(screen.getByRole('button', { name: 'Usuń kod rabatowy' }));

    expect(applyCoupon).toHaveBeenCalledWith('save20');
    expect(clearCouponRequestError).toHaveBeenCalled();
    expect(clearCoupon).toHaveBeenCalledTimes(1);
  });

  it('passes coupon pending and input error state into the rendered cart sidebar', () => {
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        isApplyingCoupon: true,
        couponRequestError:
          'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
      }),
    );

    render(<CartPageClient />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    );
    expect(screen.getByPlaceholderText('Wpisz kod')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Sprawdzanie...' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Możesz użyć jednego kodu rabatowego na zamówienie.'),
    ).toBeInTheDocument();
  });

  it('wires hydrated coupon revalidation retry through the cart runtime', async () => {
    const user = userEvent.setup();
    const retryCouponRevalidation = vi.fn(async () => {});
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
      coupon: {
        code: 'SAVE20',
        couponId: 'coupon-1',
        discountType: 'fixed_order' as const,
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        matchedProductKeys: ['/produkty/test'],
        isValid: true,
        message: null,
        totalDiscountCents: 20_00,
        lineDiscounts: {
          'standard-line-1': 20_00,
        },
      },
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        couponRevalidationNotice: {
          title: 'Nie udało się odświeżyć kodu rabatowego.',
          description:
            'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
          tone: 'neutral',
        },
        canRetryCouponRevalidation: true,
        retryCouponRevalidation,
      }),
    );

    render(<CartPageClient />);

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(retryCouponRevalidation).toHaveBeenCalledTimes(1);
  });
});
