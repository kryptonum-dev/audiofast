import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';

import CartSidebar from './CartSidebar';
import type { CartSupportCardData } from './types';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Podsumowanie' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Produkty (3 szt.)')).toBeInTheDocument();
    expect(getByExactText('420 zł')).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
    expect(getByExactText('-20 zł')).toBeInTheDocument();
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
        onApplyCoupon={vi.fn(async () => {})}
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
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={onClearCoupon}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Kod rabatowy' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Wpisz kod')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Usuń kod rabatowy SAVE20' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Usuń kod rabatowy' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Możesz użyć jednego kodu rabatowego na zamówienie.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Usuń kod rabatowy SAVE20' }),
    );
    expect(onClearCoupon).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('Kod rabatowy został usunięty.');
  });

  it('renders support section with paragraph and phone link', () => {
    render(
      <CartSidebar
        cart={createEmptyCart()}
        totals={getCartTotals(createEmptyCart())}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn(async () => {})}
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

  it('submits a trimmed coupon code through the async coupon handler', async () => {
    const user = userEvent.setup();
    const onApplyCoupon = vi.fn(async () => {});

    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={onApplyCoupon}
        onClearCoupon={vi.fn()}
      />,
    );

    await user.clear(screen.getByPlaceholderText('Wpisz kod'));
    await user.type(screen.getByPlaceholderText('Wpisz kod'), ' save20 ');
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onApplyCoupon).toHaveBeenCalledWith('save20');
    expect(onApplyCoupon).toHaveBeenCalledTimes(1);
  });

  it('keeps empty coupon validation local to the field and skips coupon apply', async () => {
    const user = userEvent.setup();
    const onApplyCoupon = vi.fn(async () => {});

    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={onApplyCoupon}
        onClearCoupon={vi.fn()}
      />,
    );

    await user.clear(screen.getByPlaceholderText('Wpisz kod'));
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onApplyCoupon).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Wpisz kod rabatowy.');
    expect(
      screen.getByText('Możesz użyć jednego kodu rabatowego na zamówienie.'),
    ).toBeInTheDocument();
  });

  it('shows transient coupon request errors with invalid styling', () => {
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
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
        couponRequestError="Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie."
      />,
    );

    const fieldError = screen.getByRole('alert');

    expect(fieldError).toHaveTextContent(
      'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    );
    expect(
      screen.getByText('Możesz użyć jednego kodu rabatowego na zamówienie.'),
    ).toBeInTheDocument();
  });

  it('shows a hydrated coupon revalidation message and exposes retry only for transient failures', async () => {
    const user = userEvent.setup();
    const onRetryCouponRevalidation = vi.fn(async () => {});
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
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
        couponRevalidationNotice={{
          title: 'Nie udało się odświeżyć kodu rabatowego.',
          description:
            'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
          tone: 'neutral',
        }}
        canRetryCouponRevalidation
        onRetryCouponRevalidation={onRetryCouponRevalidation}
      />,
    );

    expect(
      screen.getByText('Nie udało się odświeżyć kodu rabatowego.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(onRetryCouponRevalidation).toHaveBeenCalledTimes(1);
  });

  it('clears the coupon field after a valid coupon is applied, keeps the helper paragraph visible, and shows a success toast', async () => {
    const user = userEvent.setup();
    const initialCart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    const appliedCart = {
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

    const { rerender } = render(
      <CartSidebar
        cart={initialCart}
        totals={getCartTotals(initialCart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText('Wpisz kod'), 'SAVE20');

    rerender(
      <CartSidebar
        cart={appliedCart}
        totals={getCartTotals(appliedCart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Wpisz kod')).toHaveValue('');
    expect(
      screen.getByText('Możesz użyć jednego kodu rabatowego na zamówienie.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Kod został zastosowany.'),
    ).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      'Kod rabatowy został zastosowany.',
    );
  });

  it('disables coupon controls while coupon lookup or refresh revalidation is in progress', () => {
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
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
        isApplyingCoupon
      />,
    );

    expect(screen.getByPlaceholderText('Wpisz kod')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Sprawdzanie...' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Usuń kod rabatowy SAVE20' }),
    ).toBeDisabled();

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
        isRevalidatingCoupon
        couponRevalidationNotice={{
          title: 'Nie udało się odświeżyć kodu rabatowego.',
          description:
            'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
          tone: 'neutral',
        }}
        canRetryCouponRevalidation
        onRetryCouponRevalidation={vi.fn(async () => {})}
      />,
    );

    expect(screen.getAllByPlaceholderText('Wpisz kod')[1]).toBeDisabled();
    expect(
      screen.getAllByRole('button', { name: 'Sprawdzanie...' })[0],
    ).toBeDisabled();
    expect(
      screen.getAllByRole('button', { name: 'Spróbuj ponownie' })[0],
    ).toBeDisabled();
  });

  it('clears provider coupon input errors when the user types again', async () => {
    const user = userEvent.setup();
    const onCouponInputChange = vi.fn();

    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    render(
      <CartSidebar
        cart={cart}
        totals={getCartTotals(cart)}
        supportCard={createSupportCard()}
        onCheckout={vi.fn()}
        onApplyCoupon={vi.fn(async () => {})}
        onClearCoupon={vi.fn()}
        couponRequestError="Kod rabatowy nie istnieje."
        onCouponInputChange={onCouponInputChange}
      />,
    );

    await user.type(screen.getByPlaceholderText('Wpisz kod'), 'A');

    expect(onCouponInputChange).toHaveBeenCalled();
  });
});
