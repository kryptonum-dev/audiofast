import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitCheckout } from '@/src/app/actions/checkout-submit';
import { CHECKOUT_CART_CLEANUP_STORAGE_KEY } from '@/src/global/b2c/cart/cart-checkout-cleanup';
import type { CartContextValue } from '@/src/global/b2c/cart/cart-context';
import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type { CheckoutDraft } from '@/src/global/b2c/checkout/types';

import CheckoutPageClient from './CheckoutPageClient';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/src/global/b2c/cart/use-cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/src/app/actions/checkout-submit', () => ({
  submitCheckout: vi.fn(),
}));

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

function createStandardLine() {
  return createStandardCartLine({
    lineId: 'standard-line-1',
    productId: 'product-1',
    productKey: '/produkty/test-product/',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 2,
    unitPriceCents: 120_00,
    isReturnable: true,
    configurationSummary: [
      {
        label: 'Model',
        value: 'Reference',
      },
      {
        label: 'Kolor',
        value: 'Czarny',
      },
    ],
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 120_00,
      configurationOptions: [],
      totalPrice: 120_00,
    },
  });
}

function createUseCartValue(
  overrides: Partial<CartContextValue> = {},
): CartContextValue {
  const cart = overrides.cart ?? {
    version: 1,
    lines: [createStandardLine()],
    coupon: {
      code: 'WIOSNA10',
      couponId: 'coupon-1',
      discountType: 'fixed_order',
      discountValueCents: 10_00,
      discountPercent: null,
      productKeys: null,
      matchedProductKeys: ['/produkty/test-product/'],
      isValid: true,
      message: null,
      totalDiscountCents: 10_00,
      lineDiscounts: {
        'standard-line-1': 10_00,
      },
    },
  };

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

function createInitialDraft(overrides?: Partial<CheckoutDraft>): CheckoutDraft {
  return {
    contact: {
      email: 'jan@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
    },
    shippingAddress: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      streetName: 'Testowa',
      buildingNumber: '1',
      apartmentNumber: null,
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    invoice: {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    },
    consents: {
      termsAccepted: false,
      privacyPolicyAccepted: false,
    },
    newsletterOptIn: false,
    saveToProfile: false,
    updatedAt: null,
    ...overrides,
  };
}

describe('CheckoutPageClient', () => {
  const localStorageMock = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  };

  beforeEach(() => {
    let storageValue: string | null = null;

    vi.clearAllMocks();
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

    vi.mocked(useCart).mockReturnValue(createUseCartValue());
    vi.mocked(submitCheckout).mockResolvedValue({
      ok: true,
      value: {
        orderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        redirectUrl:
          'http://localhost:3000/podziekowania-za-zakup/?order=AF-2026-00001',
        registration: {
          provider: 'przelewy24',
          merchantId: 999999,
          posId: 999999,
          sessionId: 'AF-2026-00001',
          responseCode: 0,
          token: 'mock-p24-token-af202600001',
          redirectUrl:
            'https://sandbox.przelewy24.pl/trnRequest/mock-p24-token-af202600001',
          providerOrderId: 202600001,
          providerReference: null,
        },
        wasAlreadyPaid: false,
      },
    } as never);
  });

  it('renders the checkout structure with form sections and a read-only summary sidebar', () => {
    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={{
          paragraph: 'Masz pytania o zamówienie? Chętnie pomożemy.',
          phoneNumber: '855 855 855',
          image: { id: 'image-1' },
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Koszyk (1)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kontakt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Dane do dostawy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kupuję jako' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Osoba fizyczna' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Firma/przedsiębiorca' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Zgody i finalizacja' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Podsumowanie' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kod rabatowy (WIOSNA10)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wróć do koszyka' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '855 855 855' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Masz już konto\? Zaloguj się/i }),
    ).toHaveAttribute(
      'href',
      '/konto-klienta?returnTo=%2Fkoszyk%2Ftwoje-dane%2F',
    );
  });

  it('renders a checkout skeleton while the cart is still hydrating', () => {
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        isHydrated: false,
      }),
    );

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    expect(screen.getByTestId('checkout-loading-state')).toBeInTheDocument();
  });

  it('locks the email field for authenticated customers and shows only the flat checkout consents', () => {
    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked
        sessionContext={{
          isAuthenticated: true,
          authUserId: 'user-1',
          authenticatedEmail: 'jan@example.com',
          customerProfileId: 'profile-1',
        }}
        supportCard={null}
      />,
    );

    const emailField = screen.getByLabelText('Adres e-mail');

    expect(emailField).toHaveAttribute('readonly');
    expect(
      screen.getByLabelText('Zapisz te dane do kolejnych zamówień'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {
        name: /Wyrażam zgodę na przetwarzanie moich danych osobowych przez Audiofast/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Zaznacz wszystkie'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Masz już konto\? Zaloguj się/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps a separate delivery recipient optional and reveals it with a checkbox', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    expect(screen.queryByLabelText('Imię odbiorcy')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Nazwisko odbiorcy'),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Telefon odbiorcy')).not.toBeInTheDocument();

    await user.click(
      screen.getByLabelText('Chcę wysłać zamówienie na inne dane odbiorcy'),
    );

    expect(screen.getByLabelText('Imię odbiorcy')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwisko odbiorcy')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon odbiorcy')).toBeInTheDocument();
  });

  it('reveals the company invoice branch and maps same-as-shipping data on submit', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('radio', { name: 'Firma/przedsiębiorca' }),
    );

    expect(screen.getByLabelText('Nazwa firmy')).toBeInTheDocument();
    expect(screen.getByLabelText('NIP')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Nazwa firmy'),
      'Audiofast Sp. z o.o.',
    );
    await user.type(screen.getByLabelText('NIP'), '1234567890');
    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: /Wyrażam zgodę na przetwarzanie moich danych osobowych przez Audiofast/i,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(submitCheckout).toHaveBeenCalledTimes(1);
    });

    expect(submitCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Testowa',
            buildingNumber: '1',
            apartmentNumber: null,
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
        },
        newsletterOptIn: true,
      }),
      expect.objectContaining({
        lines: expect.any(Array),
      }),
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      expect.stringContaining('"orderNumber":"AF-2026-00001"'),
    );
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        'http://localhost:3000/podziekowania-za-zakup/?order=AF-2026-00001',
      );
    });
  });

  it('shows a payment error when checkout succeeds but payment start fails', async () => {
    const user = userEvent.setup();

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'payment_registration_failed',
        message:
          'Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.',
      },
      revalidatedCart: null,
      revalidationResults: null,
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.',
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows server-side field errors returned by checkout submit', async () => {
    const user = userEvent.setup();

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'form_invalid',
        message:
          'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
        fieldErrors: {
          contact: {
            email: 'Ten adres e-mail jest już w użyciu.',
          },
          formErrors: [
            'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
          ],
        },
      },
      revalidatedCart: null,
      revalidationResults: null,
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    expect(
      await screen.findByText('Ten adres e-mail jest już w użyciu.'),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
    );
  });

  it('renders flat guest checkout consents without the old select-all control', () => {
    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    expect(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /Wyrażam zgodę na przetwarzanie moich danych osobowych przez Audiofast/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Zaznacz wszystkie'),
    ).not.toBeInTheDocument();
  });

  it('does not send newsletter consent from authenticated checkout when the checkbox is hidden', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked
        sessionContext={{
          isAuthenticated: true,
          authUserId: 'user-1',
          authenticatedEmail: 'jan@example.com',
          customerProfileId: 'profile-1',
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Zapisz te dane do kolejnych zamówień',
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(submitCheckout).toHaveBeenCalledTimes(1);
    });

    expect(submitCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        newsletterOptIn: false,
        saveToProfile: true,
      }),
      expect.objectContaining({
        lines: expect.any(Array),
      }),
    );
  });

  it('keeps the guest newsletter checkbox opt-in separate from required consent', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    const requiredConsent = screen.getByRole('checkbox', {
      name: /Akceptuję regulamin i politykę prywatności/,
    });
    const newsletterConsent = screen.getByRole('checkbox', {
      name: /Wyrażam zgodę na przetwarzanie moich danych osobowych przez Audiofast/i,
    });

    await user.click(requiredConsent);

    expect(requiredConsent).toBeChecked();
    expect(newsletterConsent).not.toBeChecked();
  });

  it('shows the blur overlay and dispatches revalidation when submit returns cart_invalid', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({ applyCartLineRevalidation }),
    );

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'cart_invalid',
        message:
          'Nie udało się przejść dalej, ponieważ koszyk zawiera pozycje wymagające poprawy.',
        blockingReasonCodes: ['invalid_lines'],
      },
      revalidatedCart: createUseCartValue().cart,
      revalidationResults: [
        {
          lineId: 'standard-line-1',
          lineType: 'standard',
          isBuyable: false,
          isConfigurationValid: true,
          unitPriceCents: 120_00,
        },
      ],
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(applyCartLineRevalidation).toHaveBeenCalledTimes(1);
    });

    expect(applyCartLineRevalidation).toHaveBeenCalledWith([
      expect.objectContaining({
        lineId: 'standard-line-1',
        isBuyable: false,
      }),
    ]);
    expect(
      await screen.findByRole('heading', {
        name: 'Koszyk wymaga aktualizacji',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Przejdź do koszyka' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zamknij' }));

    expect(
      screen.queryByRole('heading', { name: 'Koszyk wymaga aktualizacji' }),
    ).not.toBeInTheDocument();
  });

  it('shows the price-change notice and keeps the form usable when submit returns cart_price_updated', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({ applyCartLineRevalidation }),
    );

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'cart_price_updated',
        message:
          'Ceny w koszyku zostały zaktualizowane. Sprawdź nową łączną kwotę i potwierdź zamówienie ponownie.',
      },
      revalidatedCart: createUseCartValue().cart,
      revalidationResults: [
        {
          lineId: 'standard-line-1',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: true,
          unitPriceCents: 130_00,
        },
      ],
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(applyCartLineRevalidation).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText('Ceny zostały zaktualizowane'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Koszyk wymaga aktualizacji' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    ).toBeEnabled();
  });

  it('clears the cart when submit returns cart_empty', async () => {
    const user = userEvent.setup();
    const clearCart = vi.fn();

    vi.mocked(useCart).mockReturnValue(createUseCartValue({ clearCart }));

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'cart_empty',
        message: 'Koszyk jest pusty.',
      },
      revalidatedCart: createEmptyCart(),
      revalidationResults: [],
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(clearCart).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Koszyk jest pusty.')).not.toBeInTheDocument();
  });

  it('renders an empty-cart guard when checkout is opened without lines', () => {
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart: createEmptyCart(),
        totals: getCartTotals(createEmptyCart()),
      }),
    );

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        supportCard={null}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Twój koszyk jest pusty' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wróć do koszyka' }),
    ).toBeInTheDocument();
  });
});
