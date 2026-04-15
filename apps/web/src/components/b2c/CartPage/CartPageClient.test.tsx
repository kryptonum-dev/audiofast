import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCartLinePricing } from '@/src/app/actions/cart-pricing';
import { loadCartPageRuntime } from '@/src/app/actions/cart-revalidation';
import type { CartContextValue } from '@/src/global/b2c/cart/cart-context';
import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';

import CartPageClient from './CartPageClient';

const pushMock = vi.fn();
let pathnameMock = '/koszyk';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => pathnameMock,
}));

vi.mock('@/src/global/b2c/cart/use-cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/src/app/actions/cart-pricing', () => ({
  fetchCartLinePricing: vi.fn(),
}));

vi.mock('@/src/app/actions/cart-revalidation', () => ({
  loadCartPageRuntime: vi.fn(),
}));

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('./CartItemCard', () => ({
  default: ({
    line,
    onReconfigure,
    isInteractionDisabled,
  }: {
    line: { lineType: string; productName: string; lineId: string };
    onReconfigure?: (lineId: string) => void;
    isInteractionDisabled?: boolean;
  }) => (
    <div
      data-testid="cart-item-card"
      data-interaction-disabled={isInteractionDisabled ? 'true' : 'false'}
    >
      <span>
        {line.lineType}: {line.productName}
      </span>
      {onReconfigure ? (
        <button
          type="button"
          disabled={isInteractionDisabled}
          onClick={() => onReconfigure(line.lineId)}
        >
          Edytuj konfigurację testowo
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@/src/components/b2c/CartLineConfigurationModal', () => ({
  default: ({
    isOpen,
    line,
    pricingState,
    onSave,
  }: {
    isOpen: boolean;
    line: { lineId: string; productName: string } | null;
    pricingState: { status: string };
    onSave: (lineId: string, nextLine: unknown) => void;
  }) =>
    isOpen && line ? (
      <div data-testid="cart-line-configuration-modal">
        <span>{line.productName}</span>
        <span>pricing-state: {pricingState.status}</span>
        <button type="button" onClick={() => onSave(line.lineId, line)}>
          Zapisz konfigurację testowo
        </button>
      </div>
    ) : null,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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
    applyCartLineRevalidation: vi.fn(),
    applyCoupon: vi.fn(),
    revalidateHydratedCouponAfterInitialLoad: vi.fn(),
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

function createOptionlessSavedStandardLine() {
  const line = createStandardCartLine({
    lineId: 'standard-line-2',
    productId: 'product-2',
    productKey: '/produkty/test',
    productName: 'Legacy optionless product',
    brandName: 'Test brand',
    quantity: 1,
    unitPriceCents: 100_00,
    isReturnable: true,
    configurationSelection: {
      variantId: 'variant-1',
      selectedOptions: {},
    },
    configurationSummary: [],
    product: {
      id: 'product-2',
      name: 'Legacy optionless product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-3' },
      basePrice: 100_00,
      configurationOptions: [],
      totalPrice: 100_00,
    },
  });

  line.issues = [
    {
      code: 'configuration_invalid',
      blocking: true,
      message: 'Produkt wymaga nowej konfiguracji.',
    },
  ];

  return line;
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

beforeEach(() => {
  vi.clearAllMocks();
  pushMock.mockReset();
  pathnameMock = '/koszyk';
  vi.mocked(loadCartPageRuntime).mockResolvedValue({
    revalidationResults: [],
    standardPricingByProductKey: {
      '/produkty/test': {
        status: 'found',
        pricingData: {
          variants: [],
          hasMultipleModels: false,
          lowestPrice: 0,
        },
      },
    },
  });
  vi.mocked(fetchCartLinePricing).mockResolvedValue({
    status: 'found',
    pricingData: {
      variants: [],
      hasMultipleModels: false,
      lowestPrice: 0,
    },
  } as never);
});

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
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
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

    return waitFor(() => {
      expect(screen.getAllByTestId('cart-item-card')).toHaveLength(2);
      expect(screen.getByText('standard: Test product')).toBeInTheDocument();
      expect(screen.getByText('cpo: Test CPO')).toBeInTheDocument();
    });
  });

  it('revalidates again on checkout click, keeps the button pending, and redirects on success', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();
    const deferredCheckoutRuntime =
      createDeferred<Awaited<ReturnType<typeof loadCartPageRuntime>>>();
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };
    const checkoutResults = [
      {
        lineId: 'standard-line-1',
        lineType: 'standard' as const,
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 120_00,
      },
    ];

    vi.mocked(loadCartPageRuntime)
      .mockResolvedValueOnce({
        revalidationResults: [],
        standardPricingByProductKey: {
          '/produkty/test': {
            status: 'found',
            pricingData: {
              variants: [],
              hasMultipleModels: false,
              lowestPrice: 0,
            },
          },
        },
      })
      .mockReturnValueOnce(deferredCheckoutRuntime.promise);

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        applyCartLineRevalidation,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );
    applyCartLineRevalidation.mockClear();

    await user.click(screen.getByRole('button', { name: 'Dalej' }));

    expect(screen.getByRole('button', { name: 'Dalej' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByTestId('cart-item-card')).toHaveAttribute(
      'data-interaction-disabled',
      'true',
    );

    deferredCheckoutRuntime.resolve({
      revalidationResults: checkoutResults,
      standardPricingByProductKey: {
        '/produkty/test': {
          status: 'found',
          pricingData: {
            variants: [],
            hasMultipleModels: false,
            lowestPrice: 0,
          },
        },
      },
    });

    await waitFor(() =>
      expect(applyCartLineRevalidation).toHaveBeenCalledWith(checkoutResults),
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/koszyk/twoje-dane'),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).not.toHaveAttribute(
        'aria-busy',
      ),
    );
  });

  it('clears checkout pending and reruns cart runtime loading after navigating back to the cart', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();
    const deferredCheckoutRuntime =
      createDeferred<Awaited<ReturnType<typeof loadCartPageRuntime>>>();
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };
    const checkoutResults = [
      {
        lineId: 'standard-line-1',
        lineType: 'standard' as const,
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 120_00,
      },
    ];

    vi.mocked(loadCartPageRuntime)
      .mockResolvedValueOnce({
        revalidationResults: [],
        standardPricingByProductKey: {
          '/produkty/test': {
            status: 'found',
            pricingData: {
              variants: [],
              hasMultipleModels: false,
              lowestPrice: 0,
            },
          },
        },
      })
      .mockReturnValueOnce(deferredCheckoutRuntime.promise)
      .mockResolvedValueOnce({
        revalidationResults: [],
        standardPricingByProductKey: {
          '/produkty/test': {
            status: 'found',
            pricingData: {
              variants: [],
              hasMultipleModels: false,
              lowestPrice: 0,
            },
          },
        },
      });

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        applyCartLineRevalidation,
      }),
    );

    const { rerender } = render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );
    applyCartLineRevalidation.mockClear();

    await user.click(screen.getByRole('button', { name: 'Dalej' }));

    deferredCheckoutRuntime.resolve({
      revalidationResults: checkoutResults,
      standardPricingByProductKey: {
        '/produkty/test': {
          status: 'found',
          pricingData: {
            variants: [],
            hasMultipleModels: false,
            lowestPrice: 0,
          },
        },
      },
    });

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/koszyk/twoje-dane'),
    );

    pathnameMock = '/koszyk/twoje-dane';
    rerender(<CartPageClient />);

    pathnameMock = '/koszyk';
    rerender(<CartPageClient />);

    await waitFor(() => expect(loadCartPageRuntime).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).not.toBeDisabled(),
    );
  });

  it('applies checkout revalidation results and stays on the cart when checkout revalidation fails', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };
    const checkoutResults = [
      {
        lineId: 'standard-line-1',
        lineType: 'standard' as const,
        isBuyable: true,
        isConfigurationValid: false,
        unitPriceCents: null,
      },
    ];

    vi.mocked(loadCartPageRuntime)
      .mockResolvedValueOnce({
        revalidationResults: [],
        standardPricingByProductKey: {
          '/produkty/test': {
            status: 'found',
            pricingData: {
              variants: [],
              hasMultipleModels: false,
              lowestPrice: 0,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        revalidationResults: checkoutResults,
        standardPricingByProductKey: {
          '/produkty/test': {
            status: 'found',
            pricingData: {
              variants: [],
              hasMultipleModels: false,
              lowestPrice: 0,
            },
          },
        },
      });

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        applyCartLineRevalidation,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );
    applyCartLineRevalidation.mockClear();

    await user.click(screen.getByRole('button', { name: 'Dalej' }));

    await waitFor(() =>
      expect(applyCartLineRevalidation).toHaveBeenCalledWith(checkoutResults),
    );
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).not.toBeDisabled(),
    );
  });

  it('defers hydrated coupon revalidation until the initial cart runtime load finishes', async () => {
    const deferredRuntime =
      createDeferred<Awaited<ReturnType<typeof loadCartPageRuntime>>>();
    const revalidateHydratedCouponAfterInitialLoad = vi.fn(async () => {});
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

    vi.mocked(loadCartPageRuntime).mockReturnValueOnce(deferredRuntime.promise);
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        revalidateHydratedCouponAfterInitialLoad,
      }),
    );

    render(<CartPageClient />);

    expect(screen.getByPlaceholderText('Wpisz kod')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Sprawdzanie...' }),
    ).toBeDisabled();
    expect(revalidateHydratedCouponAfterInitialLoad).not.toHaveBeenCalled();

    deferredRuntime.resolve({
      revalidationResults: [],
      standardPricingByProductKey: {
        '/produkty/test': {
          status: 'found',
          pricingData: {
            variants: [],
            hasMultipleModels: false,
            lowestPrice: 0,
          },
        },
      },
    });

    await waitFor(() =>
      expect(revalidateHydratedCouponAfterInitialLoad).toHaveBeenCalledTimes(1),
    );
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

    const couponInput = await screen.findByPlaceholderText('Wpisz kod');

    await user.clear(couponInput);
    await user.type(couponInput, ' save20 ');
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));
    await user.click(
      screen.getByRole('button', { name: 'Usuń kod rabatowy SAVE20' }),
    );

    expect(applyCoupon).toHaveBeenCalledWith('save20');
    expect(clearCouponRequestError).toHaveBeenCalled();
    expect(clearCoupon).toHaveBeenCalledTimes(1);
  });

  it('passes coupon pending and input error state into the rendered cart sidebar', async () => {
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    );
    expect(screen.getByPlaceholderText('Wpisz kod')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Sprawdzanie...' }),
    ).toBeDisabled();
    expect(
      await screen.findByText(
        'Możesz użyć jednego kodu rabatowego na zamówienie.',
      ),
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

    await user.click(
      await screen.findByRole('button', { name: 'Spróbuj ponownie' }),
    );

    expect(retryCouponRevalidation).toHaveBeenCalledTimes(1);
  });

  it('opens the cart configurator modal from a standard line and saves via replaceStandardLine', async () => {
    const user = userEvent.setup();
    const replaceStandardLine = vi.fn();
    const applyCartLineRevalidation = vi.fn();
    const line = createStandardLine();
    const cart = {
      ...createEmptyCart(),
      lines: [line],
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        replaceStandardLine,
        applyCartLineRevalidation,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );

    await user.click(
      screen.getByRole('button', { name: 'Edytuj konfigurację testowo' }),
    );

    expect(
      screen.getByTestId('cart-line-configuration-modal'),
    ).toBeInTheDocument();
    expect(screen.getByText('Test product')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Zapisz konfigurację testowo' }),
    );

    expect(replaceStandardLine).toHaveBeenCalledWith('standard-line-1', line);
    expect(applyCartLineRevalidation).toHaveBeenCalledWith([]);
  });

  it('exposes the configurator action for blocked optionless lines when pricing shows newly added options', async () => {
    const user = userEvent.setup();
    const line = createOptionlessSavedStandardLine();
    const cart = {
      ...createEmptyCart(),
      lines: [line],
    };

    vi.mocked(loadCartPageRuntime).mockResolvedValue({
      revalidationResults: [],
      standardPricingByProductKey: {
        '/produkty/test': {
          status: 'found',
          pricingData: {
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
                groups: [
                  {
                    id: 'finish',
                    variant_id: 'variant-1',
                    name: 'Finish',
                    input_type: 'select',
                    unit: null,
                    required: true,
                    position: 0,
                    parent_value_id: null,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                    values: [
                      {
                        id: 'matte',
                        group_id: 'finish',
                        name: 'Matte',
                        price_delta_cents: 0,
                        position: 0,
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-01T00:00:00.000Z',
                      },
                    ],
                    numeric_rule: null,
                  },
                ],
              },
            ],
            hasMultipleModels: false,
            lowestPrice: 100_00,
          },
        },
      },
    });

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edytuj konfigurację testowo' }),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Edytuj konfigurację testowo' }),
    );

    expect(
      screen.getByTestId('cart-line-configuration-modal'),
    ).toBeInTheDocument();
    expect(screen.getByText('Legacy optionless product')).toBeInTheDocument();
  });

  it('does not expose the configurator action for optionless lines until revalidation marks them invalid', async () => {
    const line = createOptionlessSavedStandardLine();
    line.issues = [];
    const cart = {
      ...createEmptyCart(),
      lines: [line],
    };

    vi.mocked(loadCartPageRuntime).mockResolvedValue({
      revalidationResults: [],
      standardPricingByProductKey: {
        '/produkty/no-config': {
          status: 'found',
          pricingData: {
            variants: [
              {
                id: 'variant-1',
                price_key: '/produkty/no-config',
                brand: 'Brand',
                product: 'Product',
                model: 'Default',
                base_price_cents: 99_00,
                currency: 'PLN',
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                groups: [
                  {
                    id: 'finish',
                    variant_id: 'variant-1',
                    name: 'Finish',
                    input_type: 'select',
                    unit: null,
                    required: true,
                    position: 0,
                    parent_value_id: null,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                    values: [
                      {
                        id: 'matte',
                        group_id: 'finish',
                        name: 'Matte',
                        price_delta_cents: 0,
                        position: 0,
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-01T00:00:00.000Z',
                      },
                    ],
                    numeric_rule: null,
                  },
                ],
              },
            ],
            hasMultipleModels: false,
            lowestPrice: 99_00,
          },
        },
      },
    });

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Edytuj konfigurację testowo' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('loads cart runtime once after hydration and applies revalidation plus pricing cache', async () => {
    const applyCartLineRevalidation = vi.fn();
    const cart = {
      ...createEmptyCart(),
      lines: [
        createStandardLine(),
        createStandardCartLine({
          lineId: 'standard-line-2',
          productId: 'product-2',
          productKey: '/produkty/test',
          productName: 'Test product duplicate',
          brandName: 'Test brand',
          quantity: 1,
          unitPriceCents: 120_00,
          isReturnable: true,
          configurationSummary: [
            {
              label: 'Model',
              value: 'Default',
            },
          ],
          product: {
            id: 'product-2',
            name: 'Test product duplicate',
            brandName: 'Test brand',
            kind: 'standard',
            image: { id: 'image-3' },
            basePrice: 100_00,
            configurationOptions: [],
            totalPrice: 120_00,
          },
        }),
      ],
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
        applyCartLineRevalidation,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );
    expect(loadCartPageRuntime).toHaveBeenCalledTimes(1);
    expect(applyCartLineRevalidation).toHaveBeenCalledWith([]);
    expect(fetchCartLinePricing).not.toHaveBeenCalled();
  });

  it('renders cart lines immediately and keeps checkout busy while initial revalidation is in progress', async () => {
    const deferred =
      createDeferred<Awaited<ReturnType<typeof loadCartPageRuntime>>>();
    const cart = {
      ...createEmptyCart(),
      lines: [createStandardLine()],
    };

    vi.mocked(loadCartPageRuntime).mockReturnValue(deferred.promise);
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
      }),
    );

    render(<CartPageClient />);

    expect(screen.getByTestId('cart-item-card')).toBeInTheDocument();
    expect(screen.getByTestId('cart-item-card')).toHaveAttribute(
      'data-interaction-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dalej' })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    deferred.resolve({
      revalidationResults: [],
      standardPricingByProductKey: {
        '/produkty/test': {
          status: 'found',
          pricingData: {
            variants: [],
            hasMultipleModels: false,
            lowestPrice: 0,
          },
        },
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dalej' })).not.toHaveAttribute(
        'aria-busy',
      ),
    );
    expect(screen.getByTestId('cart-item-card')).toHaveAttribute(
      'data-interaction-disabled',
      'false',
    );
  });

  it('opens the configuration modal with cached pricing state', async () => {
    const user = userEvent.setup();
    const line = createStandardLine();
    const cart = {
      ...createEmptyCart(),
      lines: [line],
    };

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart,
      }),
    );

    render(<CartPageClient />);

    await waitFor(() =>
      expect(loadCartPageRuntime).toHaveBeenCalledWith(cart.lines),
    );

    await user.click(
      screen.getByRole('button', { name: 'Edytuj konfigurację testowo' }),
    );

    expect(screen.getByText('pricing-state: found')).toBeInTheDocument();
    expect(fetchCartLinePricing).not.toHaveBeenCalled();
  });
});
