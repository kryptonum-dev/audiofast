import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';

import CartSidebar from './CartSidebar';
import type { CartSupportCardData } from './types';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

function getByExactText(text: string) {
  return screen.getByText((_, element) => element?.textContent === text);
}

function createStandardLine() {
  return createStandardCartLine({
    lineId: 'standard-line-1',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 2,
    unitPriceCents: 100_00,
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
      totalPrice: 100_00,
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

function createSupportCard(): CartSupportCardData {
  return {
    paragraph: 'Mozemy pomoc. Skontaktuj sie z nami tutaj.',
    phoneNumber: '+48 555 555 555',
    image: {
      id: 'image-3',
      preview: null,
      alt: null,
      naturalWidth: null,
      naturalHeight: null,
      hotspot: null,
      crop: null,
    },
  };
}

describe('CartSidebar', () => {
  it('renders summary totals and allows checkout for a valid cart', async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();

    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine(), createCpoLine()],
      coupon: {
        code: 'SAVE20',
        couponId: 'coupon-1',
        discountType: 'fixed_order' as const,
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        matchedProductKeys: ['/produkty/test', 'CPO-KEY-1'],
        isValid: true,
        message: null,
        totalDiscountCents: 20_00,
        lineDiscounts: {
          'standard-line-1': 10_00,
          'cpo-line-1': 10_00,
        },
      },
    };

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={onCheckout}
        onApplyCoupon={vi.fn()}
        onClearCoupon={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Podsumowanie' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Produkty (3 szt.)')).toBeInTheDocument();
    expect(getByExactText('420 zł')).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
    expect(getByExactText('20 zł')).toBeInTheDocument();
    expect(screen.getByText('Do zapłaty')).toBeInTheDocument();
    expect(getByExactText('400 zł')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Do kasy' }));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('disables checkout and shows blocking message when the cart contains invalid items', () => {
    const invalidLine = createStandardLine();
    invalidLine.issues = [
      {
        code: 'configuration_invalid',
        blocking: true,
        message: 'Wybrana konfiguracja nie jest już dostępna.',
      },
    ];

    const cart = {
      ...createEmptyCart(),
      lines: [invalidLine],
    };

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn()}
        onClearCoupon={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Koszyk zawiera pozycje wymagające poprawy przed przejściem dalej.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do kasy' })).toBeDisabled();
  });

  it('renders coupon section with active coupon state and allows clearing it', async () => {
    const user = userEvent.setup();
    const onClearCoupon = vi.fn();

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

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn()}
        onClearCoupon={onClearCoupon}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Kod rabatowy' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('SAVE20')).toBeInTheDocument();
    expect(screen.getByText('Kod został zastosowany.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń kod rabatowy' }));
    expect(onClearCoupon).toHaveBeenCalledTimes(1);
  });

  it('renders support section with paragraph and phone link', () => {
    render(
      <CartSidebar
        cart={createEmptyCart()}
        totals={getCartTotals(createEmptyCart())}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn()}
        onClearCoupon={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Wsparcie' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Wsparcie' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Mozemy pomoc. Skontaktuj sie z nami tutaj.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+48 555 555 555' }),
    ).toHaveAttribute('href', 'tel:+48555555555');
  });
});
