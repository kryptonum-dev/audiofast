import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  lookupCouponDefinition,
  type LookupCouponDefinitionResult,
} from '@/src/app/actions/cart-coupon';
import { CartProvider } from '@/src/global/b2c/cart/cart-provider';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';

vi.mock('@/src/app/actions/cart-coupon', () => ({
  lookupCouponDefinition: vi.fn(),
}));

function CartTestConsumer() {
  const {
    cart,
    totals,
    isHydrated,
    isApplyingCoupon,
    isRevalidatingCoupon,
    couponRequestError,
    couponRevalidationNotice,
    canRetryCouponRevalidation,
    addLine,
    applyCoupon,
    retryCouponRevalidation,
    clearCoupon,
    clearCart,
  } = useCart();

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
      <div data-testid="coupon-code">{cart.coupon?.code ?? 'none'}</div>
      <div data-testid="coupon-valid">
        {cart.coupon ? String(cart.coupon.isValid) : 'none'}
      </div>
      <div data-testid="discount-total">{totals.discountTotalCents}</div>
      <div data-testid="coupon-message">{cart.coupon?.message ?? 'none'}</div>
      <div data-testid="coupon-request-error">
        {couponRequestError ?? 'none'}
      </div>
      <div data-testid="coupon-revalidation-title">
        {couponRevalidationNotice?.title ?? 'none'}
      </div>
      <div data-testid="coupon-revalidation-description">
        {couponRevalidationNotice?.description ?? 'none'}
      </div>
      <div data-testid="can-retry-coupon-revalidation">
        {canRetryCouponRevalidation ? 'yes' : 'no'}
      </div>
      <div data-testid="applying-coupon">{isApplyingCoupon ? 'yes' : 'no'}</div>
      <div data-testid="revalidating-coupon">
        {isRevalidatingCoupon ? 'yes' : 'no'}
      </div>
      <button type="button" onClick={() => addLine(line)}>
        add
      </button>
      <button type="button" onClick={() => void applyCoupon(' save20 ')}>
        apply
      </button>
      <button type="button" onClick={() => void applyCoupon(' save30 ')}>
        apply-replace
      </button>
      <button type="button" onClick={() => void applyCoupon(' missing ')}>
        apply-invalid
      </button>
      <button type="button" onClick={() => clearCoupon()}>
        clear-coupon
      </button>
      <button type="button" onClick={() => void retryCouponRevalidation()}>
        retry-revalidation
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

  it('revalidates a hydrated coupon and removes it when it is no longer available', async () => {
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
          }),
        ],
        coupon: {
          code: 'SAVE20',
          couponId: 'coupon-1',
          discountType: 'fixed_order',
          discountValueCents: 20_00,
          discountPercent: null,
          productKeys: null,
          matchedProductKeys: ['/produkty/test'],
          isValid: true,
          message: null,
          totalDiscountCents: 20_00,
          lineDiscounts: {
            'line-1': 20_00,
          },
        },
      }),
    );

    vi.mocked(lookupCouponDefinition).mockResolvedValue({
      status: 'not_found',
      code: 'SAVE20',
      message: 'Kod rabatowy nie istnieje.',
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await waitFor(() =>
      expect(screen.getByTestId('coupon-code')).toHaveTextContent('none'),
    );

    expect(lookupCouponDefinition).toHaveBeenCalledWith('SAVE20');
    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('none');
    expect(screen.getByTestId('discount-total')).toHaveTextContent('0');
    expect(screen.getByTestId('coupon-revalidation-title')).toHaveTextContent(
      'Kod zmienił się po odświeżeniu strony.',
    );
    expect(
      screen.getByTestId('coupon-revalidation-description'),
    ).toHaveTextContent(
      'Zapisany kod nie jest już dostępny, więc usunęliśmy go z koszyka.',
    );
    expect(
      screen.getByTestId('can-retry-coupon-revalidation'),
    ).toHaveTextContent('no');
  });

  it('keeps a hydrated coupon when background revalidation fails and supports retrying', async () => {
    const user = userEvent.setup();

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
          }),
        ],
        coupon: {
          code: 'SAVE20',
          couponId: 'coupon-1',
          discountType: 'fixed_order',
          discountValueCents: 20_00,
          discountPercent: null,
          productKeys: null,
          matchedProductKeys: ['/produkty/test'],
          isValid: true,
          message: null,
          totalDiscountCents: 20_00,
          lineDiscounts: {
            'line-1': 20_00,
          },
        },
      }),
    );

    vi.mocked(lookupCouponDefinition)
      .mockResolvedValueOnce({
        status: 'error',
        code: 'SAVE20',
        message:
          'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
      })
      .mockResolvedValueOnce({
        status: 'found',
        coupon: {
          id: 'coupon-1',
          code: 'SAVE20',
          isActive: true,
          discountType: 'fixed_order',
          discountValueCents: 20_00,
          discountPercent: null,
          productKeys: null,
          usageLimit: null,
          usageCount: 0,
          startsAt: null,
          expiresAt: null,
        },
      });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await waitFor(() =>
      expect(screen.getByTestId('coupon-revalidation-title')).toHaveTextContent(
        'Nie udało się odświeżyć kodu rabatowego.',
      ),
    );

    expect(
      screen.getByTestId('coupon-revalidation-description'),
    ).toHaveTextContent(
      'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
    );

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20');
    expect(
      screen.getByTestId('can-retry-coupon-revalidation'),
    ).toHaveTextContent('yes');

    await user.click(
      screen.getByRole('button', { name: 'retry-revalidation' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('coupon-revalidation-title')).toHaveTextContent(
        'none',
      ),
    );

    expect(
      screen.getByTestId('coupon-revalidation-description'),
    ).toHaveTextContent('none');
    expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20');
    expect(
      screen.getByTestId('can-retry-coupon-revalidation'),
    ).toHaveTextContent('no');
    expect(lookupCouponDefinition).toHaveBeenNthCalledWith(1, 'SAVE20');
    expect(lookupCouponDefinition).toHaveBeenNthCalledWith(2, 'SAVE20');
  });

  it('applies a valid coupon returned by the server lookup action', async () => {
    const user = userEvent.setup();

    vi.mocked(lookupCouponDefinition).mockResolvedValue({
      status: 'found',
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(screen.getByRole('button', { name: 'apply' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20'),
    );

    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('true');
    expect(screen.getByTestId('discount-total')).toHaveTextContent('2000');
    expect(screen.getByTestId('coupon-request-error')).toHaveTextContent(
      'none',
    );
    expect(lookupCouponDefinition).toHaveBeenCalledWith('save20');
  });

  it('replaces an existing valid coupon when a new valid coupon is applied', async () => {
    const user = userEvent.setup();

    vi.mocked(lookupCouponDefinition).mockResolvedValueOnce({
      status: 'found',
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    vi.mocked(lookupCouponDefinition).mockResolvedValueOnce({
      status: 'found',
      coupon: {
        id: 'coupon-2',
        code: 'SAVE30',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 30_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(screen.getByRole('button', { name: 'apply' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20'),
    );

    await user.click(screen.getByRole('button', { name: 'apply-replace' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE30'),
    );

    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('true');
    expect(screen.getByTestId('discount-total')).toHaveTextContent('3000');
    expect(screen.getByTestId('coupon-request-error')).toHaveTextContent(
      'none',
    );
  });

  it('keeps invalid coupon attempts out of cart state when the lookup reports no match', async () => {
    const user = userEvent.setup();

    vi.mocked(lookupCouponDefinition).mockResolvedValue({
      status: 'not_found',
      code: 'MISSING',
      message: 'Kod rabatowy nie istnieje.',
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'apply-invalid' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-request-error')).toHaveTextContent(
        'Kod rabatowy nie istnieje.',
      ),
    );

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('none');
    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('none');
    expect(screen.getByTestId('discount-total')).toHaveTextContent('0');
  });

  it('surfaces transient lookup errors without mutating the persisted coupon state', async () => {
    const user = userEvent.setup();

    vi.mocked(lookupCouponDefinition).mockResolvedValue({
      status: 'error',
      code: 'SAVE20',
      message: 'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'apply' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-request-error')).toHaveTextContent(
        'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
      ),
    );

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('none');
    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('none');
  });

  it('does not replace an applied coupon with a coupon that fails runtime validity checks', async () => {
    const user = userEvent.setup();

    vi.mocked(lookupCouponDefinition).mockResolvedValueOnce({
      status: 'found',
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    vi.mocked(lookupCouponDefinition).mockResolvedValueOnce({
      status: 'found',
      coupon: {
        id: 'coupon-2',
        code: 'SAVEINACTIVE',
        isActive: false,
        discountType: 'fixed_order',
        discountValueCents: 30_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    render(
      <CartProvider>
        <CartTestConsumer />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'),
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(screen.getByRole('button', { name: 'apply' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20'),
    );

    await user.click(screen.getByRole('button', { name: 'apply-invalid' }));

    await waitFor(() =>
      expect(screen.getByTestId('coupon-request-error')).toHaveTextContent(
        'Kod rabatowy jest nieaktywny.',
      ),
    );

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20');
    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('true');
    expect(screen.getByTestId('discount-total')).toHaveTextContent('2000');
  });

  it('tracks pending coupon application and supports explicit coupon clearing', async () => {
    const user = userEvent.setup();
    let resolveLookup!: (value: LookupCouponDefinitionResult) => void;

    vi.mocked(lookupCouponDefinition).mockImplementation(
      () =>
        new Promise<LookupCouponDefinitionResult>((resolve) => {
          resolveLookup = resolve;
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

    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(screen.getByRole('button', { name: 'apply' }));

    expect(screen.getByTestId('applying-coupon')).toHaveTextContent('yes');

    resolveLookup({
      status: 'found',
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 0,
        startsAt: null,
        expiresAt: null,
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId('applying-coupon')).toHaveTextContent('no'),
    );

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('SAVE20');

    await user.click(screen.getByRole('button', { name: 'clear-coupon' }));

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('none');
    expect(screen.getByTestId('coupon-valid')).toHaveTextContent('none');
  });
});
